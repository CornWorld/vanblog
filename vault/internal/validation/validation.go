// Package validation provides Go-side Zod schema validation for PocketBase
// records. It embeds the CJS bundle and runs it in a fresh Goja VM for each
// record validation event.
package validation

import (
	_ "embed"
	"errors"
	"fmt"
	"sort"
	"strings"

	"github.com/dop251/goja"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/filesystem"
	"github.com/pocketbase/pocketbase/tools/types"
)

//go:embed models.js
var modelsScript string

// ModelSource supplies one compiled JavaScript models bundle.
type ModelSource interface {
	Load() ([]byte, error)
}

// EmbeddedSource loads the models bundle embedded in the binary.
type EmbeddedSource struct{}

func (EmbeddedSource) Load() ([]byte, error) {
	return []byte(modelsScript), nil
}

func compileProgram(script string) (*goja.Program, error) {
	return goja.Compile(
		"models.js",
		"globalThis.exports = {};class File {};globalThis.module = {exports: globalThis.exports};\n"+script,
		false,
	)
}

func loadModels(prog *goja.Program) (*goja.Runtime, *goja.Object, error) {
	vm := goja.New()
	if _, err := vm.RunProgram(prog); err != nil {
		return nil, nil, fmt.Errorf("validation: failed to run models bundle: %w", err)
	}

	exports := vm.Get("exports")
	if exports == nil || goja.IsUndefined(exports) || goja.IsNull(exports) {
		return nil, nil, fmt.Errorf("validation: models bundle is missing exports")
	}

	models := exports.ToObject(vm).Get("models")
	if models == nil || goja.IsUndefined(models) || goja.IsNull(models) {
		return nil, nil, fmt.Errorf("validation: models bundle is missing exports.models")
	}

	return vm, models.ToObject(vm), nil
}

func modelKeys(prog *goja.Program) ([]string, error) {
	_, models, err := loadModels(prog)
	if err != nil {
		return nil, err
	}

	keys := models.Keys()
	sort.Strings(keys)
	return keys, nil
}

func validatePayload(prog *goja.Program, collectionName string, payload any) error {
	vm, models, err := loadModels(prog)
	if err != nil {
		return err
	}
	return validateModel(vm, models, collectionName, vm.ToValue(payload))
}

func validateModel(vm *goja.Runtime, models *goja.Object, collectionName string, payload goja.Value) error {
	model := models.Get(collectionName)
	if model == nil || goja.IsUndefined(model) || goja.IsNull(model) {
		return fmt.Errorf("validation: collection %q is missing from exports.models", collectionName)
	}

	parse, ok := goja.AssertFunction(model.ToObject(vm).Get("safeParse"))
	if !ok {
		return fmt.Errorf("validation: collection %q schema is missing safeParse", collectionName)
	}

	result, err := parse(model, payload)
	if err != nil {
		return fmt.Errorf("%s validation error: %w", collectionName, err)
	}
	if result == nil || goja.IsUndefined(result) || goja.IsNull(result) {
		return fmt.Errorf("%s validation error: safeParse returned no result", collectionName)
	}

	resultObj := result.ToObject(vm)
	if resultObj.Get("success").ToBoolean() {
		return nil
	}

	return fmt.Errorf("%s validation failed: %s", collectionName, formatIssues(vm, resultObj.Get("error")))
}

func formatIssues(vm *goja.Runtime, errValue goja.Value) string {
	if errValue == nil || goja.IsUndefined(errValue) || goja.IsNull(errValue) {
		return "unknown validation error"
	}

	issues := errValue.ToObject(vm).Get("issues")
	if issues == nil || goja.IsUndefined(issues) || goja.IsNull(issues) {
		return "unknown validation error"
	}

	var messages []string
	if items, ok := issues.Export().([]interface{}); ok {
		for _, item := range items {
			issue, ok := item.(map[string]interface{})
			if !ok {
				continue
			}

			path := "(root)"
			if segments, ok := issue["path"].([]interface{}); ok && len(segments) > 0 {
				parts := make([]string, len(segments))
				for i, segment := range segments {
					parts[i] = fmt.Sprint(segment)
				}
				path = strings.Join(parts, ".")
			}

			message, _ := issue["message"].(string)
			messages = append(messages, path+": "+message)
		}
	}
	if len(messages) == 0 {
		return "unknown validation error"
	}
	return strings.Join(messages, "; ")
}

func recordValues(vm *goja.Runtime, record *core.Record) (*goja.Object, error) {
	values := vm.NewObject()
	for _, field := range record.Collection().Fields {
		name := field.GetName()
		if name == "" || field.GetSystem() {
			continue
		}

		value := record.Get(name)
		if dateTime, ok := value.(types.DateTime); ok {
			value = dateTime.String()
		}

		if field.Type() == core.FieldTypeJSON {
			if raw, ok := value.(types.JSONRaw); ok && len(raw) > 0 {
				parsed, err := vm.RunString("(" + string(raw) + ")")
				if err != nil {
					if setErr := values.Set(name, string(raw)); setErr != nil {
						return nil, setErr
					}
				} else if setErr := values.Set(name, parsed); setErr != nil {
					return nil, setErr
				}
				continue
			}
		}

		if field.Type() == core.FieldTypeFile {
			switch files := value.(type) {
			case []*filesystem.File:
				names := make([]string, len(files))
				for i, file := range files {
					names[i] = file.Name
				}
				value = names
			case *filesystem.File:
				value = files.Name
			}
		}

		if err := values.Set(name, value); err != nil {
			return nil, fmt.Errorf("validation: failed to set field %q: %w", name, err)
		}
	}
	return values, nil
}

func shouldSkipCollection(collection *core.Collection) bool {
	return collection.System
}

// Register attaches strict Zod validation using the embedded model bundle.
func Register(app core.App) error {
	return RegisterWithSource(app, EmbeddedSource{})
}

// RegisterWithSource loads and compiles source once for this registration.
func RegisterWithSource(app core.App, source ModelSource) error {
	if source == nil {
		return errors.New("validation: model source is nil")
	}
	script, err := source.Load()
	if err != nil {
		return fmt.Errorf("validation: failed to load models bundle: %w", err)
	}
	if len(strings.TrimSpace(string(script))) == 0 {
		return errors.New("validation: models bundle is empty")
	}
	prog, err := compileProgram(string(script))
	if err != nil {
		return fmt.Errorf("validation: failed to compile models bundle: %w", err)
	}
	if _, _, err := loadModels(prog); err != nil {
		return err
	}

	app.OnRecordValidate().BindFunc(func(event *core.RecordEvent) error {
		collection := event.Record.Collection()
		if shouldSkipCollection(collection) {
			return event.Next()
		}
		vm, models, err := loadModels(prog)
		if err != nil {
			return err
		}
		values, err := recordValues(vm, event.Record)
		if err != nil {
			return err
		}
		if err := validateModel(vm, models, collection.Name, values); err != nil {
			return err
		}
		return event.Next()
	})
	return nil
}

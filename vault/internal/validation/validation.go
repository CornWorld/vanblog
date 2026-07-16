// Package validation provides Go-side Zod schema validation for PocketBase
// records. It loads explicit CJS artifacts and runs them in fresh Goja VMs.
package validation

import (
	"errors"
	"fmt"
	"io/fs"
	"log"
	"sort"
	"strings"

	"github.com/dop251/goja"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/filesystem"
	"github.com/pocketbase/pocketbase/tools/types"
)

// ModelSource supplies one compiled JavaScript models bundle.
type ModelSource interface {
	Load() ([]byte, error)
}

// NamedModelSource associates a model bundle with a stable source name.
type NamedModelSource struct {
	Name   string
	Source ModelSource
}

// ArtifactSource loads a mandatory core or external schema artifact.
type ArtifactSource struct {
	FS   fs.FS
	Name string
	Path string
}

func (s ArtifactSource) Load() ([]byte, error) {
	path := s.Path
	if path == "" {
		path = "models.js"
	}
	return fs.ReadFile(s.FS, path)
}

// PackSource loads a pre-compiled schema.js CJS bundle from a Pack's filesystem.
// The bundle must export `models` in the same format as the core artifact.
// If the Pack does not contain schema.js, Load returns fs.ErrNotExist.
type PackSource struct {
	FS   fs.FS
	Name string
	Path string
}

func (s PackSource) Load() ([]byte, error) {
	path := s.Path
	if path == "" {
		path = "schema.js"
	}
	return fs.ReadFile(s.FS, path)
}

// ResolveModelSource is retained for single-source compatibility callers.
// Runtime registration uses RegisterWithSources and loads every Pack schema.
func ResolveModelSource(packs []PackSource) ModelSource {
	for _, p := range packs {
		if _, err := fs.Stat(p.FS, "schema.js"); err == nil {
			return p
		}
	}
	return nil
}

// gojaPrelude provides missing ES builtins that the Zod bundle relies on.
// Goja does not ship a URL constructor, so Zod v4's z.url() crashes with
// "URL is not defined". The polyfill performs structural validation that is
// sufficient for record validation — it is not a full WHATWG URL implementation.
const gojaPrelude = `globalThis.exports = {};class File {};globalThis.module = {exports: globalThis.exports};
if (typeof globalThis.URL === "undefined") {
  globalThis.URL = function URL(input) {
    if (typeof input !== "string") { throw new TypeError("URL input must be a string"); }
    var s = input.trim();
    var m = /^([a-z][a-z0-9+.-]*):\/\/([^\/\?#]*)([^\?#]*)?(\?[^#]*)?(#.*)?$/i.exec(s);
    if (!m) { throw new TypeError("Invalid URL: " + input); }
    this.href = s;
    this.protocol = m[1] + ":";
    this.host = m[2];
    this.hostname = m[2].split(":")[0];
    this.pathname = m[3] || "/";
    this.search = m[4] || "";
    this.hash = m[5] || "";
    this.origin = m[1] + "://" + m[2];
  };
}
`

func compileProgram(script string) (*goja.Program, error) {
	return goja.Compile(
		"models.js",
		gojaPrelude+script,
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
	// Skip system collections and auth collections. Auth records have
	// hidden fields (password hash, tokenKey) and internal module
	// validation that is incompatible with Goja-based Zod validation.
	return collection.System || collection.IsAuth()
}

// ValidateModelSource verifies that a model bundle can be compiled and executed by Goja.
func ValidateModelSource(source ModelSource) error {
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
	_, _, err = loadModels(prog)
	return err
}

// Register is retained only as a compatibility shell; runtime registration requires an explicit artifact source.
func Register(app core.App) error {
	return errors.New("validation: core model source is required")
}

// RegisterWithSources registers one core model source plus all Pack sources.
// Every model name must have exactly one owner: Pack/Pack and Pack/core
// collisions are rejected rather than resolved by precedence.
func RegisterWithSources(app core.App, coreSource ModelSource, packs []NamedModelSource) error {
	if coreSource == nil {
		return errors.New("validation: core model source is required")
	}
	sorted := append([]NamedModelSource(nil), packs...)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i].Name < sorted[j].Name })

	type compiledSource struct {
		name    string
		program *goja.Program
	}
	compiled := make([]compiledSource, 0, len(sorted)+1)
	claimed := make(map[string]string)
	for _, named := range sorted {
		if named.Name == "" {
			return errors.New("validation: Pack model source name is empty")
		}
		program, keys, err := compileModelSource(named.Source)
		if err != nil {
			return fmt.Errorf("validation: Pack %q: %w", named.Name, err)
		}
		for _, key := range keys {
			if owner, ok := claimed[key]; ok {
				return fmt.Errorf("validation: model %q is declared by both Packs %q and %q", key, owner, named.Name)
			}
			claimed[key] = named.Name
		}
		compiled = append(compiled, compiledSource{name: named.Name, program: program})
	}
	coreProgram, coreKeys, err := compileModelSource(coreSource)
	if err != nil {
		return fmt.Errorf("validation: core model source: %w", err)
	}
	for _, key := range coreKeys {
		if owner, ok := claimed[key]; ok {
			return fmt.Errorf("validation: model %q is declared by core and Pack %q", key, owner)
		}
	}
	compiled = append(compiled, compiledSource{name: "core", program: coreProgram})

	app.OnRecordValidate().BindFunc(func(event *core.RecordEvent) error {
		collection := event.Record.Collection()
		if shouldSkipCollection(collection) {
			return event.Next()
		}
		for _, source := range compiled {
			vm, models, err := loadModels(source.program)
			if err != nil {
				return fmt.Errorf("validation: load %s model source: %w", source.name, err)
			}
			model := models.Get(collection.Name)
			if model == nil || goja.IsUndefined(model) || goja.IsNull(model) {
				continue
			}
			values, err := recordValues(vm, event.Record)
			if err != nil {
				return err
			}
			if err := validateModel(vm, models, collection.Name, values); err != nil {
				log.Printf("validation error: collection=%s record=%s source=%s err=%v", collection.Name, event.Record.Id, source.name, err)
				return err
			}
			return event.Next()
		}
		return fmt.Errorf("validation: collection %q is missing from all model sources", collection.Name)
	})
	return nil
}

func compileModelSource(source ModelSource) (*goja.Program, []string, error) {
	if source == nil {
		return nil, nil, errors.New("model source is nil")
	}
	script, err := source.Load()
	if err != nil {
		return nil, nil, fmt.Errorf("failed to load models bundle: %w", err)
	}
	if len(strings.TrimSpace(string(script))) == 0 {
		return nil, nil, errors.New("models bundle is empty")
	}
	program, err := compileProgram(string(script))
	if err != nil {
		return nil, nil, fmt.Errorf("failed to compile models bundle: %w", err)
	}
	keys, err := modelKeys(program)
	if err != nil {
		return nil, nil, err
	}
	return program, keys, nil
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
			log.Printf("validation error: collection=%s record=%s err=%v",
				collection.Name, event.Record.Id, err)
			return err
		}
		return event.Next()
	})
	return nil
}

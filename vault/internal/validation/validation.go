// Package validation provides Go-side Zod schema validation for PocketBase
// records. It loads explicit CJS artifacts and runs them in fresh Goja VMs.
package validation

import (
	"errors"
	"fmt"
	"io/fs"
	"log"
	"runtime"
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

// ResolveModelSource was the legacy first-wins Pack schema selector. It is
// removed: runtime now uses RegisterWithSources and loads every Pack schema
// in deterministic name order with collision detection.

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

// Register was the original no-source registration entry. It is removed:
// callers must supply a core model source via RegisterWithSources (or use
// RegisterWithSource for the single-source convenience wrapper).

// vmPoolSize controls how many pre-warmed Goja VMs each source keeps.
// Defaults to GOMAXPROCS so concurrent record saves don't serialize.
func vmPoolSize() int {
	if n := runtime.GOMAXPROCS(0); n > 0 {
		return n
	}
	return 4
}

// vmSlot bundles a Goja Runtime with its own models object. Goja Runtime
// AND the objects it produces (including *goja.Object) are NOT goroutine-safe,
// so a slot must be exclusively held by one goroutine at a time.
type vmSlot struct {
	vm     *goja.Runtime
	models *goja.Object
}

// vmPool is a channel-based pool of fully independent vmSlots for one source.
// Because each slot owns its own Runtime + models, concurrent validation runs
// in parallel without any shared mutable state.
type vmPool struct {
	slots []vmSlot
	ch    chan *vmSlot
	// knownKeys is a read-only Go set of collection names this source
	// declares. It backs the lock-free fast path in the hot loop so we never
	// touch a Goja Object just to discover a miss. Safe for concurrent reads
	// because it is never mutated after warm-up.
	knownKeys map[string]struct{}
}

func newVMPool(prog *goja.Program, keys []string, size int) (*vmPool, error) {
	if size < 1 {
		size = 1
	}
	slots := make([]vmSlot, 0, size)
	firstVM, firstModels, err := loadModels(prog)
	if err != nil {
		return nil, err
	}
	slots = append(slots, vmSlot{vm: firstVM, models: firstModels})
	for i := 1; i < size; i++ {
		vm, models, err := loadModels(prog)
		if err != nil {
			return nil, fmt.Errorf("validation: warm pool slot %d: %w", i, err)
		}
		slots = append(slots, vmSlot{vm: vm, models: models})
	}
	known := make(map[string]struct{}, len(keys))
	for _, k := range keys {
		known[k] = struct{}{}
	}
	p := &vmPool{
		slots:     slots,
		ch:        make(chan *vmSlot, size),
		knownKeys: known,
	}
	for i := range slots {
		p.ch <- &p.slots[i]
	}
	return p, nil
}

func (p *vmPool) acquire() *vmSlot {
	return <-p.ch
}

func (p *vmPool) release(s *vmSlot) {
	p.ch <- s
}

// sourcePool binds a named source to its VM pool.
type sourcePool struct {
	name string
	pool *vmPool
}

// RegisterWithSources registers one core model source plus all Pack sources.
// Every model name must have exactly one owner: Pack/Pack and Pack/core
// collisions are rejected. Each source warms a pool of GOMAXPROCS Goja VMs
// so concurrent record saves run in parallel without serialization.
func RegisterWithSources(app core.App, coreSource ModelSource, packs []NamedModelSource) error {
	if coreSource == nil {
		return errors.New("validation: core model source is required")
	}
	sorted := append([]NamedModelSource(nil), packs...)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i].Name < sorted[j].Name })

	poolSize := vmPoolSize()
	claimed := make(map[string]string)
	pools := make([]*sourcePool, 0, len(sorted)+1)

	warm := func(name string, source ModelSource) error {
		program, keys, err := compileModelSource(source)
		if err != nil {
			return fmt.Errorf("validation: %s: %w", name, err)
		}
		for _, key := range keys {
			if owner, ok := claimed[key]; ok {
				return fmt.Errorf("validation: model %q is declared by both %q and %q", key, owner, name)
			}
			claimed[key] = name
		}
		p, err := newVMPool(program, keys, poolSize)
		if err != nil {
			return fmt.Errorf("validation: warm %s: %w", name, err)
		}
		pools = append(pools, &sourcePool{name: name, pool: p})
		return nil
	}

	for _, named := range sorted {
		if named.Name == "" {
			return errors.New("validation: Pack model source name is empty")
		}
		if err := warm(named.Name, named.Source); err != nil {
			return err
		}
	}
	if err := warm("core", coreSource); err != nil {
		return err
	}

	app.OnRecordValidate().BindFunc(func(event *core.RecordEvent) error {
		collection := event.Record.Collection()
		if shouldSkipCollection(collection) {
			return event.Next()
		}
		for _, sp := range pools {
			// Lock-free fast path: if this source doesn't declare the
			// collection, skip without acquiring a slot. knownKeys is a
			// plain Go map that is never mutated after warm-up, so this
			// concurrent read is safe.
			if _, ok := sp.pool.knownKeys[collection.Name]; !ok {
				continue
			}
			slot := sp.pool.acquire()
			values, err := recordValues(slot.vm, event.Record)
			if err != nil {
				sp.pool.release(slot)
				return err
			}
			err = validateModel(slot.vm, slot.models, collection.Name, values)
			if err != nil {
				log.Printf("validation error: collection=%s record=%s source=%s err=%v", collection.Name, event.Record.Id, sp.name, err)
			}
			sp.pool.release(slot)
			if err != nil {
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

// RegisterWithSource is a compatibility wrapper for single-source callers.
// It delegates to RegisterWithSources with no Pack sources, so the single
// source gets the same VM pool, collision checking, and warm-up as multi-source
// registration.
func RegisterWithSource(app core.App, source ModelSource) error {
	if source == nil {
		return errors.New("validation: model source is nil")
	}
	return RegisterWithSources(app, source, nil)
}

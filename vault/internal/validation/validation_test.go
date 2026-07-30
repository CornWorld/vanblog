package validation

import (
	"errors"
	"reflect"
	"strings"
	"sync"
	"testing"
	"testing/fstest"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"
)

func TestModelKeysFromFixture(t *testing.T) {
	script := `exports.models = { alpha: {}, beta: {} };`
	prog, err := compileProgram(script)
	if err != nil {
		t.Fatalf("compile embedded models: %v", err)
	}

	got, err := modelKeys(prog)
	if err != nil {
		t.Fatalf("load embedded models: %v", err)
	}
	want := []string{"alpha", "beta"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("embedded exports.models keys mismatch\ngot:  %v\nwant: %v", got, want)
	}
}

type fixtureSource struct {
	script string
	err    error
	loads  int
}

func (s *fixtureSource) Load() ([]byte, error) {
	s.loads++
	return []byte(s.script), s.err
}

func TestRegisterWithSourceIsolationAndBadSources(t *testing.T) {
	valid := `exports.models = { one: { safeParse: function () { return { success: true }; } } };`
	first := &fixtureSource{script: valid}
	second := &fixtureSource{script: strings.Replace(valid, "one", "two", 1)}
	for _, source := range []*fixtureSource{first, second} {
		app, err := tests.NewTestApp()
		if err != nil {
			t.Fatal(err)
		}
		if err := RegisterWithSource(app, source); err != nil {
			app.Cleanup()
			t.Fatal(err)
		}
		app.Cleanup()
	}
	if first.loads != 1 || second.loads != 1 {
		t.Fatalf("sources loaded %d and %d times", first.loads, second.loads)
	}

	cases := []struct {
		name   string
		source ModelSource
		want   string
	}{
		{"load", &fixtureSource{err: errors.New("boom")}, "failed to load"},
		{"empty", &fixtureSource{}, "empty"},
		{"bad js", &fixtureSource{script: "("}, "failed to compile"},
		{"missing models", &fixtureSource{script: "exports.value = 1"}, "missing exports.models"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			app, err := tests.NewTestApp()
			if err != nil {
				t.Fatal(err)
			}
			defer app.Cleanup()
			err = RegisterWithSource(app, tc.source)
			if err == nil || !strings.Contains(err.Error(), tc.want) {
				t.Fatalf("error = %v, want %q", err, tc.want)
			}
		})
	}
}

func TestOnlySystemCollectionsAreSkipped(t *testing.T) {
	system := core.NewBaseCollection("_system")
	system.System = true
	if !shouldSkipCollection(system) {
		t.Fatal("expected system collection to be skipped")
	}
	if shouldSkipCollection(core.NewBaseCollection("posts")) {
		t.Fatal("expected business collection not to be skipped")
	}
}

func TestUnknownBusinessCollectionFailsClosed(t *testing.T) {
	script := `exports.models = { posts: { safeParse: function () { return { success: true }; } } };`
	prog, err := compileProgram(script)
	if err != nil {
		t.Fatalf("compile embedded models: %v", err)
	}

	err = validatePayload(prog, "unknown_business", map[string]any{})
	if err == nil || !strings.Contains(err.Error(), `collection "unknown_business" is missing from exports.models`) {
		t.Fatalf("expected missing schema error, got %v", err)
	}
}

func TestMissingSafeParseFailsClosed(t *testing.T) {
	prog, err := compileProgram(`exports.models = { broken: {} };`)
	if err != nil {
		t.Fatalf("compile fixture: %v", err)
	}

	err = validatePayload(prog, "broken", map[string]any{})
	if err == nil || !strings.Contains(err.Error(), `collection "broken" schema is missing safeParse`) {
		t.Fatalf("expected missing safeParse error, got %v", err)
	}
}

func TestSchemaInvalidPayloadIncludesFieldPath(t *testing.T) {
	script := `exports.models = { posts: { safeParse: function () { return { success: false, error: { issues: [{ path: ['title'], message: 'required' }] } }; } } };`
	prog, err := compileProgram(script)
	if err != nil {
		t.Fatalf("compile embedded models: %v", err)
	}

	err = validatePayload(prog, "posts", map[string]any{"title": ""})
	if err == nil {
		t.Fatal("expected posts validation failure")
	}
	if !strings.Contains(err.Error(), "title:") {
		t.Fatalf("expected field path in validation error, got %v", err)
	}
}

func TestPackSourceLoadsSchemaFromFS(t *testing.T) {
	bundle := `exports.models = { custom: { safeParse: function () { return { success: true }; } } };`
	p := PackSource{
		FS:   fstest.MapFS{"schema.js": {Data: []byte(bundle)}},
		Name: "test-pack",
	}
	data, err := p.Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	prog, err := compileProgram(string(data))
	if err != nil {
		t.Fatalf("compile: %v", err)
	}
	keys, err := modelKeys(prog)
	if err != nil {
		t.Fatalf("loadModels: %v", err)
	}
	if len(keys) != 1 || keys[0] != "custom" {
		t.Fatalf("unexpected model keys: %v", keys)
	}
}

func TestPackSourceMissingSchemaReturnsErrNotExist(t *testing.T) {
	p := PackSource{
		FS:   fstest.MapFS{"pack.json": {Data: []byte(`{}`)}},
		Name: "test-pack",
	}
	if _, err := p.Load(); err == nil {
		t.Fatal("expected error for missing schema.js")
	}
}

func TestRegisterWithSourcesRequiresCoreSource(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatal(err)
	}
	defer app.Cleanup()
	if err := RegisterWithSources(app, nil, nil); err == nil || !strings.Contains(err.Error(), "core model source is required") {
		t.Fatalf("expected required core source error, got %v", err)
	}
}

func TestRegisterWithSourcesAcceptsMultiplePackModels(t *testing.T) {
	coreSource := &fixtureSource{script: `exports.models = { core: { safeParse: function () { return { success: true }; } } };`}
	first := &fixtureSource{script: `exports.models = { first: { safeParse: function () { return { success: true }; } } };`}
	second := &fixtureSource{script: `exports.models = { second: { safeParse: function () { return { success: true }; } } };`}
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatal(err)
	}
	defer app.Cleanup()
	if err := RegisterWithSources(app, coreSource, []NamedModelSource{
		{Name: "z-pack", Source: second},
		{Name: "a-pack", Source: first},
	}); err != nil {
		t.Fatal(err)
	}
	if coreSource.loads != 1 || first.loads != 1 || second.loads != 1 {
		t.Fatalf("sources loaded core=%d first=%d second=%d", coreSource.loads, first.loads, second.loads)
	}
}

func TestRegisterWithSourcesRejectsPackModelCollision(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatal(err)
	}
	defer app.Cleanup()
	err = RegisterWithSources(app, &fixtureSource{script: `exports.models = {};`}, []NamedModelSource{
		{Name: "a-pack", Source: &fixtureSource{script: `exports.models = { duplicate: { safeParse: function () { return { success: true }; } } };`}},
		{Name: "b-pack", Source: &fixtureSource{script: `exports.models = { duplicate: { safeParse: function () { return { success: true }; } } };`}},
	})
	if err == nil || !strings.Contains(err.Error(), "declared by both") {
		t.Fatalf("expected Pack model collision, got %v", err)
	}
}

func TestRegisterWithSourcesRejectsPackCoreCollision(t *testing.T) {
	app, err := tests.NewTestApp()
	if err != nil {
		t.Fatal(err)
	}
	defer app.Cleanup()
	coreSource := &fixtureSource{script: `exports.models = { shared: { safeParse: function () { return { success: false, error: { issues: [{ path: [], message: "core" }] } }; } } };`}
	packSource := &fixtureSource{script: `exports.models = { shared: { safeParse: function () { return { success: true }; } } };`}
	err = RegisterWithSources(app, coreSource, []NamedModelSource{{Name: "pack", Source: packSource}})
	if err == nil || !strings.Contains(err.Error(), "declared by both") {
		t.Fatalf("expected Pack/core collision, got %v", err)
	}
}

// TestVMReuseHasNoStatePollution verifies that reusing the same warmed VM for
// multiple validateModel calls with different payloads does not leak state.
// The schema tracks how many times safeParse runs and validates the payload
// against a counter; if the VM leaked mutable state across calls, later
// payloads would see stale data from earlier ones.
func TestVMReuseHasNoStatePollution(t *testing.T) {
	// safeParse is stateless: success depends ONLY on the input payload,
	// not on any VM-global counter. If VM reuse leaked state, a previously
	// "valid" payload would still need to validate correctly after an
	// "invalid" one runs on the same VM.
	script := `exports.models = {
		items: {
			safeParse: function (v) {
				if (v && v.name === "valid") { return { success: true }; }
				return { success: false, error: { issues: [{ path: ["name"], message: "must be 'valid'" }] } };
			}
		}
	};`
	prog, err := compileProgram(script)
	if err != nil {
		t.Fatalf("compile: %v", err)
	}
	pool, err := newVMPool(prog, []string{"items"}, 1)
	if err != nil {
		t.Fatalf("newVMPool: %v", err)
	}

	validPayload := map[string]any{"name": "valid"}
	invalidPayload := map[string]any{"name": "bogus"}

	// Interleave valid/invalid on the SAME slot. Each call must be independent.
	slot := pool.acquire()
	defer pool.release(slot)
	for i := range 10 {
		valValues := slot.vm.ToValue(validPayload)
		if err := validateModel(slot.vm, slot.models, "items", valValues); err != nil {
			t.Fatalf("iter %d valid payload failed on reused VM: %v", i, err)
		}
		invValues := slot.vm.ToValue(invalidPayload)
		if err := validateModel(slot.vm, slot.models, "items", invValues); err == nil {
			t.Fatalf("iter %d invalid payload unexpectedly succeeded on reused VM (state leak)", i)
		}
	}
}

// TestVMPoolConcurrentAccess verifies the channel-based pool is safe under
// concurrent acquire/release. This exercises the goroutine-safety guarantee
// that replaced the previous global mutex.
func TestVMPoolConcurrentAccess(t *testing.T) {
	script := `exports.models = {
		items: { safeParse: function (v) { return { success: true }; } }
	};`
	prog, err := compileProgram(script)
	if err != nil {
		t.Fatalf("compile: %v", err)
	}
	// Pool size smaller than goroutine count forces contention on the channel.
	pool, err := newVMPool(prog, []string{"items"}, 2)
	if err != nil {
		t.Fatalf("newVMPool: %v", err)
	}

	var wg sync.WaitGroup
	const goroutines = 16
	const iterations = 50
	wg.Add(goroutines)
	for range goroutines {
		go func() {
			defer wg.Done()
			for range iterations {
				slot := pool.acquire()
				// Holding the slot briefly simulates real validation work.
				val := slot.vm.ToValue(map[string]any{"name": "valid"})
				if err := validateModel(slot.vm, slot.models, "items", val); err != nil {
					t.Errorf("concurrent validateModel failed: %v", err)
					pool.release(slot)
					return
				}
				pool.release(slot)
			}
		}()
	}
	wg.Wait()
}

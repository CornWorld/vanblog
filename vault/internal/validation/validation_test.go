package validation

import (
	"errors"
	"reflect"
	"strings"
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

func TestResolveModelSourceReturnsNilWithoutSchema(t *testing.T) {
	packs := []PackSource{{FS: fstest.MapFS{"pack.json": {Data: []byte(`{}`)}}, Name: "no-schema"}}
	if source := ResolveModelSource(packs); source != nil {
		t.Fatalf("expected nil source, got %T", source)
	}
}

func TestResolveModelSourcePicksFirstPackWithSchema(t *testing.T) {
	bundle := `exports.models = { frompack: { safeParse: function () { return { success: true }; } } };`
	packs := []PackSource{
		{FS: fstest.MapFS{"pack.json": {Data: []byte(`{}`)}}, Name: "no-schema"},
		{FS: fstest.MapFS{"schema.js": {Data: []byte(bundle)}}, Name: "with-schema"},
		{FS: fstest.MapFS{"schema.js": {Data: []byte(bundle)}}, Name: "also-with-schema"},
	}
	source := ResolveModelSource(packs)
	ps, ok := source.(PackSource)
	if !ok {
		t.Fatalf("expected PackSource, got %T", source)
	}
	if ps.Name != "with-schema" {
		t.Fatalf("expected with-schema, got %s", ps.Name)
	}
}

func TestResolveModelSourceEmptyPacksReturnsNil(t *testing.T) {
	if source := ResolveModelSource(nil); source != nil {
		t.Fatalf("expected nil source, got %T", source)
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
	if err == nil || !strings.Contains(err.Error(), "declared by both Packs") {
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
	if err == nil || !strings.Contains(err.Error(), "declared by core and Pack") {
		t.Fatalf("expected Pack/core collision, got %v", err)
	}
}

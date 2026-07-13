package validation

import (
	"errors"
	"reflect"
	"strings"
	"testing"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"
)

func TestEmbeddedModelKeys(t *testing.T) {
	prog, err := compileProgram(modelsScript)
	if err != nil {
		t.Fatalf("compile embedded models: %v", err)
	}

	got, err := modelKeys(prog)
	if err != nil {
		t.Fatalf("load embedded models: %v", err)
	}
	want := []string{
		"audits",
		"bookmarks",
		"categories",
		"media",
		"moments",
		"posts",
		"revisions",
		"site",
		"tags",
		"users",
		"visits",
	}
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
	prog, err := compileProgram(modelsScript)
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

func TestRealSchemaInvalidPayloadIncludesFieldPath(t *testing.T) {
	prog, err := compileProgram(modelsScript)
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

package packcli

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/cornworld/vanblog/internal/validation"
)

func TestListAndInspectBuiltin(t *testing.T) {
	for _, args := range [][]string{{"list"}, {"inspect", "bookmarks"}} {
		var output bytes.Buffer
		if err := Execute(args, &output, &output); err != nil {
			t.Fatalf("Execute(%v): %v", args, err)
		}
		if !strings.Contains(output.String(), "bookmarks") || !strings.Contains(output.String(), "builtin") {
			t.Fatalf("unexpected output: %q", output.String())
		}
	}
}

func TestLocalOverrideAndValidate(t *testing.T) {
	root := t.TempDir()
	directory := filepath.Join(root, "bookmarks")
	if err := os.Mkdir(directory, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(directory, "pack.json"), []byte(`{"name":"bookmarks","version":"2.0.0"}`), 0o644); err != nil {
		t.Fatal(err)
	}
	for _, args := range [][]string{{"--packsDir", root, "inspect", "bookmarks"}, {"validate", directory}} {
		var output bytes.Buffer
		if err := Execute(args, &output, &output); err != nil {
			t.Fatalf("Execute(%v): %v", args, err)
		}
		if !strings.Contains(output.String(), "2.0.0") {
			t.Fatalf("unexpected output: %q", output.String())
		}
	}
}

func TestAddRequiresDestinationAndCopiesPack(t *testing.T) {
	if err := Execute([]string{"add", "bookmarks"}, &bytes.Buffer{}, &bytes.Buffer{}); err == nil {
		t.Fatal("expected missing destination error")
	}
	destination := filepath.Join(t.TempDir(), "bookmarks")
	var output bytes.Buffer
	if err := Execute([]string{"add", "bookmarks", destination}, &output, &output); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(destination, "pack.json")); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(output.String(), "added source") || !strings.Contains(output.String(), "needs build artifact") {
		t.Fatalf("unexpected output: %q", output.String())
	}
}

func TestBuildNoSchemaIsNoop(t *testing.T) {
	directory := writeTestPack(t, "plain", "1.0.0")
	var output bytes.Buffer
	if err := Execute([]string{"build", directory}, &output, &output); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(directory, "schema.js")); !os.IsNotExist(err) {
		t.Fatalf("expected no schema.js, got err=%v", err)
	}
	if !strings.Contains(output.String(), "built artifacts") {
		t.Fatalf("unexpected output: %q", output.String())
	}
}

func TestBuildSchemaProducesLoadableArtifact(t *testing.T) {
	directory := writeTestPack(t, "schema-pack", "1.0.0")
	schema := "export const models = { custom: { safeParse: function () { return { success: true }; } } };\n"
	if err := os.WriteFile(filepath.Join(directory, "schema.ts"), []byte(schema), 0o644); err != nil {
		t.Fatal(err)
	}
	var output bytes.Buffer
	if err := Execute([]string{"build", directory}, &output, &output); err != nil {
		t.Fatal(err)
	}
	artifact := filepath.Join(directory, "schema.js")
	data, err := os.ReadFile(artifact)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(data), "exports.models") {
		t.Fatalf("schema.js does not expose exports.models")
	}
	loaded, err := (validation.PackSource{FS: os.DirFS(directory), Name: "schema-pack"}).Load()
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(loaded), "exports.models") {
		t.Fatalf("loaded schema.js does not expose exports.models")
	}
	if err := validation.ValidateModelSource(validation.PackSource{FS: os.DirFS(directory), Name: "schema-pack"}); err != nil {
		t.Fatalf("generated schema.js is not Goja-loadable: %v", err)
	}
}

func TestEjectIsNotACommand(t *testing.T) {
	var output bytes.Buffer
	err := Execute([]string{"eject"}, &output, &output)
	if err == nil {
		t.Fatal("expected eject to be unknown")
	}
	if !strings.Contains(err.Error(), "unknown command") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func writeTestPack(t *testing.T, name, version string) string {
	t.Helper()
	directory := filepath.Join(t.TempDir(), name)
	if err := os.Mkdir(directory, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(directory, "pack.json"), []byte(`{"name":"`+name+`","version":"`+version+`"}`), 0o644); err != nil {
		t.Fatal(err)
	}
	return directory
}

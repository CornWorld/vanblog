package packcli

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/cornworld/vanblog/internal/validation"
)

func TestResolveExistingPathFindsRepositoryRootRelativeDirectory(t *testing.T) {
	original, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Chdir(filepath.Join(original, "..")); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chdir(original) })

	resolved := resolveExistingPath("packs")
	info, err := os.Stat(resolved)
	if err != nil {
		t.Fatalf("resolveExistingPath(%q): %v", "packs", err)
	}
	if !info.IsDir() {
		t.Fatalf("resolved path is not a directory: %q", resolved)
	}
}

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

func TestStatusReportsResolvedLifecycleState(t *testing.T) {
	var output bytes.Buffer
	if err := Execute([]string{"status"}, &output, &output); err != nil {
		t.Fatal(err)
	}
	lines := strings.Split(strings.TrimSpace(output.String()), "\n")
	if len(lines) == 0 || !strings.Contains(output.String(), "builtin-enabled") {
		t.Fatalf("unexpected output: %q", output.String())
	}
	if !strings.Contains(lines[0], "\t") {
		t.Fatalf("expected tabular status output: %q", output.String())
	}
	fields := strings.Split(lines[0], "\t")
	if len(fields) < 7 || len(fields[6]) != 64 {
		t.Fatalf("expected SHA-256 source fingerprint in status output: %q", output.String())
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
	metadata, err := os.ReadFile(filepath.Join(directory, "schema.js.meta.json"))
	if err != nil || !strings.Contains(string(metadata), "sourceHash") {
		t.Fatalf("expected artifact freshness metadata, data=%q err=%v", metadata, err)
	}
}

func TestPlanCommandSupportsLocalDirectory(t *testing.T) {
	directory := writeTestPack(t, "planned", "1.0.0")
	if err := os.WriteFile(filepath.Join(directory, "schema.ts"), []byte("export const models = {}"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(filepath.Join(directory, "migrations"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(directory, "migrations", "001.js"), []byte("migration"), 0o644); err != nil {
		t.Fatal(err)
	}
	var output bytes.Buffer
	if err := Execute([]string{"plan", directory}, &output, &output); err != nil {
		t.Fatal(err)
	}
	fields := strings.Split(strings.TrimSpace(output.String()), "\t")
	if len(fields) < 12 || fields[0] != "planned" || fields[3] != "needs-build" || fields[6] != "1" || fields[7] != "001" || fields[9] != "true" || fields[10] != "pocketbase-create-backup-before-migration" || fields[11] == "" {
		t.Fatalf("unexpected plan output: %q", output.String())
	}
}

func TestPromoteArtifactBundleUpdatesArtifactAndMetadata(t *testing.T) {
	directory := t.TempDir()
	artifact := filepath.Join(directory, "schema.js")
	metadata := filepath.Join(directory, "schema.js.meta.json")
	stagedArtifact := filepath.Join(directory, ".staged-schema.js")
	stagedMetadata := filepath.Join(directory, ".staged-schema.js.meta.json")
	for path, data := range map[string][]byte{
		artifact:       []byte("old schema"),
		metadata:       []byte(`{"sourceHash":"old"}`),
		stagedArtifact: []byte("new schema"),
		stagedMetadata: []byte(`{"sourceHash":"new"}`),
	} {
		if err := os.WriteFile(path, data, 0o644); err != nil {
			t.Fatal(err)
		}
	}

	if err := promoteArtifactBundle(directory, stagedArtifact, stagedMetadata); err != nil {
		t.Fatal(err)
	}
	for path, expected := range map[string]string{
		artifact: "new schema", metadata: `{"sourceHash":"new"}`,
	} {
		data, err := os.ReadFile(path)
		if err != nil || string(data) != expected {
			t.Fatalf("path=%s data=%q err=%v", path, data, err)
		}
	}
}

func TestPromoteArtifactBundleRestoresPreviousBundleOnFailure(t *testing.T) {
	directory := t.TempDir()
	artifact := filepath.Join(directory, "schema.js")
	metadata := filepath.Join(directory, "schema.js.meta.json")
	stagedArtifact := filepath.Join(directory, ".staged-schema.js")
	if err := os.WriteFile(artifact, []byte("old schema"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(metadata, []byte(`{"sourceHash":"old"}`), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(stagedArtifact, []byte("new schema"), 0o644); err != nil {
		t.Fatal(err)
	}

	if err := promoteArtifactBundle(directory, stagedArtifact, filepath.Join(directory, "missing-metadata")); err == nil {
		t.Fatal("expected metadata promotion failure")
	}
	for path, expected := range map[string]string{
		artifact: "old schema", metadata: `{"sourceHash":"old"}`,
	} {
		data, err := os.ReadFile(path)
		if err != nil || string(data) != expected {
			t.Fatalf("restored path=%s data=%q err=%v", path, data, err)
		}
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

package packcli

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"
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

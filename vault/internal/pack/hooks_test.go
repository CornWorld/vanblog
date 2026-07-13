package pack

import (
	"io/fs"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"testing/fstest"
)

func TestStageHooksCopiesCoreTreeAndBuiltinHook(t *testing.T) {
	core := t.TempDir()
	writeFile(t, filepath.Join(core, "core.pb.js"), "core")
	writeFile(t, filepath.Join(core, "lib", "helper.js"), "helper")
	destination := filepath.Join(t.TempDir(), "hooks")
	if err := StageHooks(core, []Pack{builtinBookmarks(t)}, destination); err != nil {
		t.Fatal(err)
	}
	for path, want := range map[string]string{
		"core.pb.js":                       "core",
		"lib/helper.js":                    "helper",
		"pack--bookmarks--bookmarks.pb.js": "onRecordBeforeCreateRequest",
	} {
		got, err := os.ReadFile(filepath.Join(destination, filepath.FromSlash(path)))
		if err != nil || !strings.Contains(string(got), want) {
			t.Fatalf("staged %s = %q, %v", path, got, err)
		}
	}
}

func TestStageHooksLocalWholeOverride(t *testing.T) {
	builtins, _ := Builtins(os.DirFS("../../../packs"))
	local := hookPack("bookmarks", fstest.MapFS{
		"pack.json":             {Data: []byte(`{"name":"bookmarks","version":"2.0.0"}`)},
		"hooks/bookmarks.pb.js": {Data: []byte("local")},
	})
	resolved, err := Resolve(builtins, []Pack{local})
	if err != nil {
		t.Fatal(err)
	}
	destination := filepath.Join(t.TempDir(), "hooks")
	if err := StageHooks(t.TempDir(), resolved, destination); err != nil {
		t.Fatal(err)
	}
	got, err := os.ReadFile(filepath.Join(destination, "pack--bookmarks--bookmarks.pb.js"))
	if err != nil || string(got) != "local" {
		t.Fatalf("local hook = %q, %v", got, err)
	}
}

func TestStageHooksRejectsInvalidPackHookResources(t *testing.T) {
	tests := map[string]fstest.MapFS{
		"nested":  {"pack.json": {Data: []byte("x")}, "hooks/nested/hook.pb.js": {Data: []byte("x")}},
		"non pb":  {"pack.json": {Data: []byte("x")}, "hooks/readme.txt": {Data: []byte("x")}},
		"symlink": {"pack.json": {Data: []byte("x")}, "hooks/hook.pb.js": {Data: []byte("x"), Mode: fs.ModeSymlink}},
	}
	for name, filesystem := range tests {
		t.Run(name, func(t *testing.T) {
			if err := StageHooks(t.TempDir(), []Pack{hookPack("invalid", filesystem)}, filepath.Join(t.TempDir(), "hooks")); err == nil {
				t.Fatal("expected invalid hook resource error")
			}
		})
	}
}

func TestStageHooksStableResult(t *testing.T) {
	core := t.TempDir()
	writeFile(t, filepath.Join(core, "z.pb.js"), "z")
	packs := []Pack{
		hookPack("zulu", fstest.MapFS{"hooks/z.pb.js": {Data: []byte("z")}}),
		hookPack("alpha", fstest.MapFS{"hooks/a.pb.js": {Data: []byte("a")}}),
	}
	destination := filepath.Join(t.TempDir(), "hooks")
	if err := StageHooks(core, packs, destination); err != nil {
		t.Fatal(err)
	}
	first := diskTree(t, destination)
	if err := StageHooks(core, []Pack{packs[1], packs[0]}, destination); err != nil {
		t.Fatal(err)
	}
	if second := diskTree(t, destination); !reflect.DeepEqual(first, second) {
		t.Fatalf("unstable staging\nfirst: %v\nsecond: %v", first, second)
	}
}

func TestStageHooksFailurePreservesOldState(t *testing.T) {
	destination := filepath.Join(t.TempDir(), "hooks")
	writeFile(t, filepath.Join(destination, "good.pb.js"), "good")
	bad := hookPack("broken", fstest.MapFS{"hooks/bad.txt": {Data: []byte("bad")}})
	if err := StageHooks(t.TempDir(), []Pack{bad}, destination); err == nil {
		t.Fatal("expected staging failure")
	}
	got, err := os.ReadFile(filepath.Join(destination, "good.pb.js"))
	if err != nil || string(got) != "good" {
		t.Fatalf("previous state lost: %q, %v", got, err)
	}
}

func hookPack(name string, filesystem fs.FS) Pack {
	return Pack{Name: name, Version: "1.0.0", FS: filesystem, Source: Local}
}

func writeFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

func diskTree(t *testing.T, root string) map[string]string {
	t.Helper()
	result := map[string]string{}
	if err := filepath.WalkDir(root, func(path string, entry fs.DirEntry, err error) error {
		if err != nil || entry.IsDir() {
			return err
		}
		rel, _ := filepath.Rel(root, path)
		data, readErr := os.ReadFile(path)
		if readErr != nil {
			return readErr
		}
		result[filepath.ToSlash(rel)] = string(data)
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	return result
}

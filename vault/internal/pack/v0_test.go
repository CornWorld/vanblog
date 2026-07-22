package pack

import (
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestValidateV0AllowsSourceFrontend(t *testing.T) {
	for _, resource := range []string{
		"pages/index.astro",
		"admin/index.ts",
		"astro.config.js",
		"astro.config.mjs",
		"astro.config.ts",
	} {
		t.Run(resource, func(t *testing.T) {
			root := t.TempDir()
			dir := filepath.Join(root, "bookmarks")
			writeFile(t, filepath.Join(dir, "pack.json"), `{"name":"bookmarks","version":"1.0.0"}`)
			writeFile(t, filepath.Join(dir, filepath.FromSlash(resource)), "source")
			item, err := LoadLocal(dir)
			if err != nil {
				t.Fatal(err)
			}
			if err := ValidateV0([]Pack{item}); err != nil {
				t.Fatalf("expected valid source Pack, got %v", err)
			}
		})
	}
}

func TestRuntimeLoadableV0SkipsLocalSourceFrontend(t *testing.T) {
	root := t.TempDir()
	dir := filepath.Join(root, "bookmarks")
	writeFile(t, filepath.Join(dir, "pack.json"), `{"name":"bookmarks","version":"1.0.0"}`)
	writeFile(t, filepath.Join(dir, "pages", "index.astro"), "source")
	writeFile(t, filepath.Join(dir, "hooks", "bookmarks.pb.js"), "hook")
	item, err := LoadLocal(dir)
	if err != nil {
		t.Fatal(err)
	}
	loadable, warnings, err := RuntimeLoadableV0([]Pack{item})
	if err != nil {
		t.Fatal(err)
	}
	if len(loadable) != 0 {
		t.Fatalf("expected local source frontend Pack to be skipped, got %#v", loadable)
	}
	if len(warnings) != 1 || warnings[0].Pack != "bookmarks" || !strings.Contains(warnings[0].Reason, "requires a dev-image build artifact") {
		t.Fatalf("unexpected warnings: %#v", warnings)
	}
}

func TestRuntimeLoadableV0AllowsLocalHooksAndBuiltinFrontend(t *testing.T) {
	root := t.TempDir()
	dir := filepath.Join(root, "bookmarks")
	writeFile(t, filepath.Join(dir, "pack.json"), `{"name":"bookmarks","version":"1.0.0"}`)
	writeFile(t, filepath.Join(dir, "hooks", "bookmarks.pb.js"), "hook")
	local, err := LoadLocal(dir)
	if err != nil {
		t.Fatal(err)
	}
	builtins, err := Builtins(os.DirFS("../../../packs"))
	if err != nil {
		t.Fatal(err)
	}
	loadable, warnings, err := RuntimeLoadableV0(append(builtins, local))
	if err != nil {
		t.Fatal(err)
	}
	if len(warnings) != 0 {
		t.Fatalf("unexpected warnings: %#v", warnings)
	}
	if len(loadable) != 4 {
		t.Fatalf("unexpected loadable packs: %#v", loadable)
	}
}

func TestLocalPackUsesImmutableSnapshot(t *testing.T) {
	root := t.TempDir()
	dir := filepath.Join(root, "bookmarks")
	writeFile(t, filepath.Join(dir, "pack.json"), `{"name":"bookmarks","version":"1.0.0"}`)
	hook := filepath.Join(dir, "hooks", "bookmarks.pb.js")
	writeFile(t, hook, "snapshot")
	item, err := LoadLocal(dir)
	if err != nil {
		t.Fatal(err)
	}
	outside := filepath.Join(t.TempDir(), "outside.pb.js")
	writeFile(t, outside, "outside")
	if err := os.Remove(hook); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outside, hook); err != nil {
		t.Fatal(err)
	}
	got, err := fs.ReadFile(item.FS, "hooks/bookmarks.pb.js")
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != "snapshot" {
		t.Fatalf("snapshot changed after source mutation: %q", got)
	}
}

func TestLoadLocalRequiresDirectoryName(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "wrong")
	writeFile(t, filepath.Join(dir, "pack.json"), `{"name":"bookmarks","version":"1.0.0"}`)
	if _, err := LoadLocal(dir); err == nil {
		t.Fatal("expected directory/name mismatch")
	}
}

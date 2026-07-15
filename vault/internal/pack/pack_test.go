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

func TestBuiltinOnly(t *testing.T) {
	builtins, err := Builtins(os.DirFS("../../../packs"))
	if err != nil {
		t.Fatal(err)
	}
	resolved, err := Resolve(builtins, nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(resolved) != 1 || resolved[0].Name != "bookmarks" || resolved[0].Version != "1.0.0" || resolved[0].Source != Builtin {
		t.Fatalf("unexpected builtin packs: %#v", resolved)
	}
	if _, err := fs.ReadFile(resolved[0].FS, "pages/index.astro"); err != nil {
		t.Fatalf("read builtin resource: %v", err)
	}
	hook, err := fs.ReadFile(resolved[0].FS, "hooks/bookmarks.pb.js")
	if err != nil {
		t.Fatalf("read builtin hook: %v", err)
	}
	if strings.Contains(string(hook), "$vanblog.servePlugin") || !strings.Contains(string(hook), "onRecordCreateRequest") {
		t.Fatalf("unexpected builtin hook: %s", hook)
	}
}

func TestBuiltinsDiscoversAndSortsAllDirectChildren(t *testing.T) {
	packs, err := Builtins(fstest.MapFS{
		"zulu/pack.json":     {Data: []byte(`{"name":"zulu","version":"1.0.0"}`)},
		"zulu/hooks/z.pb.js": {Data: []byte("// z")},
		"alpha/pack.json":    {Data: []byte(`{"name":"alpha","version":"1.0.0"}`)},
		"alpha/pages/index":  {Data: []byte("page")},
		"ignored-file.txt":   {Data: []byte("ignored")},
	})
	if err != nil {
		t.Fatal(err)
	}
	got := []string{packs[0].Name, packs[1].Name}
	if want := []string{"alpha", "zulu"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("builtin order = %v, want %v", got, want)
	}
	for _, p := range packs {
		if p.Source != Builtin {
			t.Fatalf("pack %q source = %v, want builtin", p.Name, p.Source)
		}
	}
}

func TestBuiltinsRejectsDirectoryNameMismatch(t *testing.T) {
	if _, err := Builtins(fstest.MapFS{
		"bookmarks/pack.json": {Data: []byte(`{"name":"other","version":"1.0.0"}`)},
	}); err == nil {
		t.Fatal("expected builtin directory/name mismatch")
	}
}

func TestDiscoverLocal(t *testing.T) {
	root := t.TempDir()
	writeLocalPack(t, root, "bookmarks", `{"name":"bookmarks","version":"1.2.3"}`)
	if err := os.WriteFile(filepath.Join(root, "bookmarks", "local.txt"), []byte("local"), 0o644); err != nil {
		t.Fatal(err)
	}
	packs, err := DiscoverLocal(root)
	if err != nil {
		t.Fatal(err)
	}
	if len(packs) != 1 || packs[0].Name != "bookmarks" || packs[0].Version != "1.2.3" || packs[0].Source != Local {
		t.Fatalf("unexpected local packs: %#v", packs)
	}
}

func TestLocalWholePackOverride(t *testing.T) {
	builtins, err := Builtins(os.DirFS("../../../packs"))
	if err != nil {
		t.Fatal(err)
	}
	local := Pack{
		Name:    "bookmarks",
		Version: "2.0.0",
		Source:  Local,
		FS: fstest.MapFS{
			"pack.json": {Data: []byte(`{"name":"bookmarks","version":"2.0.0"}`)},
			"local.txt": {Data: []byte("local")},
		},
	}
	resolved, err := Resolve(builtins, []Pack{local})
	if err != nil {
		t.Fatal(err)
	}
	if len(resolved) != 1 || resolved[0].Source != Local || resolved[0].Version != "2.0.0" {
		t.Fatalf("unexpected resolution: %#v", resolved)
	}
	if _, err := fs.ReadFile(resolved[0].FS, "local.txt"); err != nil {
		t.Fatalf("local file missing: %v", err)
	}
	if _, err := fs.ReadFile(resolved[0].FS, "pages/index.astro"); !os.IsNotExist(err) {
		t.Fatalf("builtin-only file leaked into local override: %v", err)
	}
}

func TestResolveSortsDeterministically(t *testing.T) {
	packFS := fstest.MapFS{"pack.json": {Data: []byte("{}")}}
	packs, err := Resolve(
		[]Pack{{Name: "zulu", Version: "1.0.0", FS: packFS, Source: Builtin}},
		[]Pack{
			{Name: "middle", Version: "1.0.0", FS: packFS, Source: Local},
			{Name: "alpha", Version: "1.0.0", FS: packFS, Source: Local},
		},
	)
	if err != nil {
		t.Fatal(err)
	}
	got := []string{packs[0].Name, packs[1].Name, packs[2].Name}
	if want := []string{"alpha", "middle", "zulu"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("order = %v, want %v", got, want)
	}
}

func TestDiscoverLocalRejectsMalformedIdentity(t *testing.T) {
	tests := map[string]string{
		"invalid name":       `{"name":"Bad_Name","version":"1.0.0"}`,
		"invalid version":    `{"name":"bad-version","version":"v1"}`,
		"unknown field":      `{"name":"unknown-field","version":"1.0.0","title":"no"}`,
		"directory mismatch": `{"name":"other","version":"1.0.0"}`,
	}
	for name, identity := range tests {
		t.Run(name, func(t *testing.T) {
			root := t.TempDir()
			directory := strings.ReplaceAll(name, " ", "-")
			if name == "directory mismatch" {
				directory = "mismatch"
			}
			writeLocalPack(t, root, directory, identity)
			if _, err := DiscoverLocal(root); err == nil {
				t.Fatal("expected malformed identity error")
			}
		})
	}
}

func TestResolveRejectsDuplicates(t *testing.T) {
	packFS := fstest.MapFS{"pack.json": {Data: []byte("{}")}}
	p := Pack{Name: "duplicate", Version: "1.0.0", FS: packFS, Source: Builtin}
	if _, err := Resolve([]Pack{p, p}, nil); err == nil {
		t.Fatal("expected duplicate builtin error")
	}
	local := Pack{Name: p.Name, Version: p.Version, FS: packFS, Source: Local}
	if _, err := Resolve(nil, []Pack{local, local}); err == nil {
		t.Fatal("expected duplicate local error")
	}
}

func TestDiscoverLocalRejectsSymlinkEscape(t *testing.T) {
	root := t.TempDir()
	writeLocalPack(t, root, "bookmarks", `{"name":"bookmarks","version":"1.0.0"}`)
	outside := filepath.Join(t.TempDir(), "secret")
	if err := os.WriteFile(outside, []byte("secret"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outside, filepath.Join(root, "bookmarks", "escape")); err != nil {
		t.Fatal(err)
	}
	if _, err := DiscoverLocal(root); err == nil {
		t.Fatal("expected symlink escape error")
	}
}

func TestDiscoverLocalRejectsSymlinkPackDirectory(t *testing.T) {
	root := t.TempDir()
	outside := t.TempDir()
	writeLocalPack(t, outside, "bookmarks", `{"name":"bookmarks","version":"1.0.0"}`)
	if err := os.Symlink(filepath.Join(outside, "bookmarks"), filepath.Join(root, "bookmarks")); err != nil {
		t.Fatal(err)
	}
	if _, err := DiscoverLocal(root); err == nil {
		t.Fatal("expected symlink pack directory error")
	}
}

func TestAddRejectsExistingDestination(t *testing.T) {
	p := builtinBookmarks(t)
	destination := filepath.Join(t.TempDir(), "bookmarks")
	if err := os.Mkdir(destination, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := Add(p, destination); err == nil {
		t.Fatal("expected existing destination error")
	}
}

func TestAddCopiesCompleteTreeByteIdentically(t *testing.T) {
	p := builtinBookmarks(t)
	destination := filepath.Join(t.TempDir(), "bookmarks")
	if err := Add(p, destination); err != nil {
		t.Fatal(err)
	}
	added := os.DirFS(destination)
	wantPaths := treePaths(t, p.FS)
	gotPaths := treePaths(t, added)
	if !reflect.DeepEqual(gotPaths, wantPaths) {
		t.Fatalf("added tree = %v, want %v", gotPaths, wantPaths)
	}
	for _, path := range wantPaths {
		wantInfo, err := fs.Stat(p.FS, path)
		if err != nil {
			t.Fatal(err)
		}
		if wantInfo.IsDir() {
			continue
		}
		want, err := fs.ReadFile(p.FS, path)
		if err != nil {
			t.Fatal(err)
		}
		got, err := fs.ReadFile(added, path)
		if err != nil {
			t.Fatal(err)
		}
		if !reflect.DeepEqual(got, want) {
			t.Fatalf("file %q differs after add", path)
		}
	}
	if _, err := fs.Stat(added, "pack.json"); err != nil {
		t.Fatalf("pack.json missing: %v", err)
	}
}

func TestAddRejectsSymlinkParent(t *testing.T) {
	realParent := t.TempDir()
	link := filepath.Join(t.TempDir(), "linked")
	if err := os.Symlink(realParent, link); err != nil {
		t.Fatal(err)
	}
	if err := Add(builtinBookmarks(t), filepath.Join(link, "bookmarks")); err == nil {
		t.Fatal("expected symlink parent error")
	}
}

func TestInspectAndValidate(t *testing.T) {
	p := builtinBookmarks(t)
	got, err := Inspect([]Pack{p}, "bookmarks")
	if err != nil {
		t.Fatal(err)
	}
	if got.Name != p.Name {
		t.Fatalf("inspect returned %q", got.Name)
	}
	if _, err := Inspect([]Pack{p}, "../bookmarks"); err == nil {
		t.Fatal("expected invalid inspect name error")
	}
	bad := p
	bad.Version = "latest"
	if err := Validate(bad); err == nil {
		t.Fatal("expected validation error")
	}
}

func builtinBookmarks(t *testing.T) Pack {
	t.Helper()
	packs, err := Builtins(os.DirFS("../../../packs"))
	if err != nil {
		t.Fatal(err)
	}
	return packs[0]
}

func writeLocalPack(t *testing.T, root, name, identity string) {
	t.Helper()
	directory := filepath.Join(root, name)
	if err := os.Mkdir(directory, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(directory, "pack.json"), []byte(identity), 0o644); err != nil {
		t.Fatal(err)
	}
}

func treePaths(t *testing.T, filesystem fs.FS) []string {
	t.Helper()
	var paths []string
	if err := fs.WalkDir(filesystem, ".", func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if path != "." {
			paths = append(paths, path)
		}
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	return paths
}

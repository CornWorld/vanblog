package pack

import (
	"io/fs"
	"os"
	"path/filepath"
	"reflect"
	"testing"
	"testing/fstest"
)

func TestStageMigrationsNamespacesPackFiles(t *testing.T) {
	p := migrationPack("bookmarks", fstest.MapFS{
		"pack.json":               {Data: []byte(`{"name":"bookmarks","version":"1.0.0"}`)},
		"migrations/0001_init.js": {Data: []byte("init")},
		"migrations/0002_add.js":  {Data: []byte("add")},
	})
	destination := filepath.Join(t.TempDir(), "migrations")
	if err := StageMigrations("", []Pack{p}, destination); err != nil {
		t.Fatal(err)
	}

	got := diskTree(t, destination)
	want := map[string]string{
		"pack--bookmarks--0001_init.js": "init",
		"pack--bookmarks--0002_add.js":  "add",
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("staged tree = %v, want %v", got, want)
	}
}

func TestStageMigrationsNoCollisionAcrossPacks(t *testing.T) {
	alpha := migrationPack("alpha", fstest.MapFS{
		"pack.json":               {Data: []byte(`{"name":"alpha","version":"1.0.0"}`)},
		"migrations/0001_init.js": {Data: []byte("alpha")},
	})
	beta := migrationPack("beta", fstest.MapFS{
		"pack.json":               {Data: []byte(`{"name":"beta","version":"1.0.0"}`)},
		"migrations/0001_init.js": {Data: []byte("beta")},
	})
	destination := filepath.Join(t.TempDir(), "migrations")
	if err := StageMigrations("", []Pack{beta, alpha}, destination); err != nil {
		t.Fatal(err)
	}

	got := diskTree(t, destination)
	if got["pack--alpha--0001_init.js"] != "alpha" || got["pack--beta--0001_init.js"] != "beta" {
		t.Fatalf("unexpected staged tree: %v", got)
	}
}

func TestStageMigrationsRejectsDuplicateIdWithinPack(t *testing.T) {
	p := migrationPack("dup", fstest.MapFS{
		"pack.json":           {Data: []byte(`{"name":"dup","version":"1.0.0"}`)},
		"migrations/0001_a.js": {Data: []byte("a")},
		"migrations/0001_b.js": {Data: []byte("b")},
	})
	if err := StageMigrations("", []Pack{p}, filepath.Join(t.TempDir(), "migrations")); err == nil {
		t.Fatal("expected duplicate migration id error")
	}
}

func TestStageMigrationsCopiesCoreAndPack(t *testing.T) {
	core := t.TempDir()
	writeFile(t, filepath.Join(core, "0001_core.js"), "core")

	p := migrationPack("bookmarks", fstest.MapFS{
		"pack.json":               {Data: []byte(`{"name":"bookmarks","version":"1.0.0"}`)},
		"migrations/0001_init.js": {Data: []byte("pack")},
	})
	destination := filepath.Join(t.TempDir(), "migrations")
	if err := StageMigrations(core, []Pack{p}, destination); err != nil {
		t.Fatal(err)
	}

	got := diskTree(t, destination)
	if got["0001_core.js"] != "core" || got["pack--bookmarks--0001_init.js"] != "pack" {
		t.Fatalf("unexpected staged tree: %v", got)
	}
}

func TestStageMigrationsMissingCoreDirIsSkipped(t *testing.T) {
	p := migrationPack("bookmarks", fstest.MapFS{
		"pack.json":               {Data: []byte(`{"name":"bookmarks","version":"1.0.0"}`)},
		"migrations/0001_init.js": {Data: []byte("pack")},
	})
	destination := filepath.Join(t.TempDir(), "migrations")
	if err := StageMigrations(filepath.Join(t.TempDir(), "does-not-exist"), []Pack{p}, destination); err != nil {
		t.Fatal(err)
	}
	if got := diskTree(t, destination); len(got) != 1 || got["pack--bookmarks--0001_init.js"] != "pack" {
		t.Fatalf("unexpected staged tree: %v", got)
	}
}

func TestStageMigrationsRejectsInvalidResources(t *testing.T) {
	tests := map[string]fstest.MapFS{
		"nested":  {"pack.json": {Data: []byte(`{"name":"nested","version":"1.0.0"}`)}, "migrations/sub/0001.js": {Data: []byte("x")}},
		"non js":  {"pack.json": {Data: []byte(`{"name":"nonjs","version":"1.0.0"}`)}, "migrations/readme.txt": {Data: []byte("x")}},
		"no id":   {"pack.json": {Data: []byte(`{"name":"noid","version":"1.0.0"}`)}, "migrations/init.js": {Data: []byte("x")}},
		"symlink": {"pack.json": {Data: []byte(`{"name":"symlink","version":"1.0.0"}`)}, "migrations/0001.js": {Data: []byte("x"), Mode: fs.ModeSymlink}},
	}
	for name, filesystem := range tests {
		t.Run(name, func(t *testing.T) {
			if err := StageMigrations("", []Pack{migrationPack(name, filesystem)}, filepath.Join(t.TempDir(), "migrations")); err == nil {
				t.Fatal("expected invalid migration resource error")
			}
		})
	}
}

func TestStageMigrationsFailurePreservesOldState(t *testing.T) {
	destination := filepath.Join(t.TempDir(), "migrations")
	writeFile(t, filepath.Join(destination, "good.js"), "good")

	bad := migrationPack("broken", fstest.MapFS{
		"pack.json":           {Data: []byte(`{"name":"broken","version":"1.0.0"}`)},
		"migrations/0001_a.js": {Data: []byte("a")},
		"migrations/0001_b.js": {Data: []byte("b")},
	})
	if err := StageMigrations("", []Pack{bad}, destination); err == nil {
		t.Fatal("expected staging failure")
	}

	got, err := os.ReadFile(filepath.Join(destination, "good.js"))
	if err != nil || string(got) != "good" {
		t.Fatalf("previous state lost: %q, %v", got, err)
	}
}

func migrationPack(name string, filesystem fs.FS) Pack {
	return Pack{Name: name, Version: "1.0.0", FS: filesystem, Source: Local}
}

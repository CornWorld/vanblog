package pack

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
)

// Add atomically copies a builtin Pack into a new local destination directory.
func Add(p Pack, destination string) error {
	if p.Source != Builtin {
		return fmt.Errorf("pack %q is not builtin", p.Name)
	}
	if err := Validate(p); err != nil {
		return err
	}
	if destination == "" {
		return errors.New("add destination is empty")
	}
	destination = filepath.Clean(destination)
	if _, err := os.Lstat(destination); err == nil {
		return fmt.Errorf("add destination already exists: %q", destination)
	} else if !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("inspect add destination: %w", err)
	}
	parent := filepath.Dir(destination)
	parentInfo, err := os.Lstat(parent)
	if err != nil {
		return fmt.Errorf("inspect add parent: %w", err)
	}
	if parentInfo.Mode()&os.ModeSymlink != 0 || !parentInfo.IsDir() {
		return fmt.Errorf("add parent must be a real directory: %q", parent)
	}

	temp, err := os.MkdirTemp(parent, ".pack-add-")
	if err != nil {
		return fmt.Errorf("create add staging directory: %w", err)
	}
	committed := false
	defer func() {
		if !committed {
			_ = os.RemoveAll(temp)
		}
	}()

	if err := copyTree(p.FS, temp); err != nil {
		return fmt.Errorf("add pack %q: %w", p.Name, err)
	}
	if _, err := os.Stat(filepath.Join(temp, "pack.json")); err != nil {
		return fmt.Errorf("added pack %q has no pack.json: %w", p.Name, err)
	}
	if err := os.Rename(temp, destination); err != nil {
		return fmt.Errorf("publish added pack %q: %w", p.Name, err)
	}
	committed = true
	return nil
}

func copyTree(source fs.FS, destination string) error {
	return fs.WalkDir(source, ".", func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if path == "." {
			return nil
		}
		if !fs.ValidPath(path) {
			return fmt.Errorf("invalid resource path %q", path)
		}
		if entry.Type()&fs.ModeSymlink != 0 {
			return fmt.Errorf("resource %q is a symlink", path)
		}
		target := filepath.Join(destination, filepath.FromSlash(path))
		rel, err := filepath.Rel(destination, target)
		if err != nil || rel == ".." || filepath.IsAbs(rel) {
			return fmt.Errorf("resource path escapes destination: %q", path)
		}
		if entry.IsDir() {
			return os.Mkdir(target, 0o755)
		}
		data, err := fs.ReadFile(source, path)
		if err != nil {
			return err
		}
		return os.WriteFile(target, data, 0o644) //nolint:gosec // pack resources stay world-readable
	})
}

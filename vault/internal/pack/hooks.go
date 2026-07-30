package pack

import (
	"cmp"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"slices"
	"strings"
)

// StageHooks publishes core and resolved Pack hooks together. Failures before
// publication preserve the previous tree; concurrent readers are not guaranteed
// an atomic view across the directory rename sequence.
func StageHooks(coreDir string, packs []Pack, destination string) error {
	if coreDir == "" {
		return errors.New("core hooks directory is empty")
	}
	if destination == "" {
		return errors.New("hooks staging destination is empty")
	}
	parent := filepath.Dir(filepath.Clean(destination))
	if err := os.MkdirAll(parent, 0o755); err != nil {
		return fmt.Errorf("create hooks staging parent: %w", err)
	}
	temp, err := os.MkdirTemp(parent, ".hooks-stage-")
	if err != nil {
		return fmt.Errorf("create hooks staging directory: %w", err)
	}
	defer os.RemoveAll(temp)
	if err := copyCoreHooks(coreDir, temp); err != nil {
		return err
	}

	sorted := append([]Pack(nil), packs...)
	slices.SortFunc(sorted, func(a, b Pack) int { return cmp.Compare(a.Name, b.Name) })
	for _, p := range sorted {
		if err := stagePackHooks(p, temp); err != nil {
			return err
		}
	}
	return replaceDirectory(temp, filepath.Clean(destination))
}

func copyCoreHooks(source, destination string) error {
	info, err := os.Lstat(source)
	if err != nil {
		return fmt.Errorf("inspect core hooks: %w", err)
	}
	if info.Mode()&os.ModeSymlink != 0 || !info.IsDir() {
		return fmt.Errorf("core hooks must be a real directory: %q", source)
	}
	return filepath.WalkDir(source, func(sourcePath string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return fmt.Errorf("read core hook %q: %w", sourcePath, walkErr)
		}
		if entry.Type()&os.ModeSymlink != 0 {
			return fmt.Errorf("core hook %q is a symlink", sourcePath)
		}
		rel, err := filepath.Rel(source, sourcePath)
		if err != nil || rel == ".." || filepath.IsAbs(rel) {
			return fmt.Errorf("core hook path escapes source: %q", sourcePath)
		}
		if rel == "." {
			return nil
		}
		target := filepath.Join(destination, rel)
		if entry.IsDir() {
			return os.Mkdir(target, 0o755)
		}
		data, err := os.ReadFile(sourcePath)
		if err != nil {
			return err
		}
		return os.WriteFile(target, data, 0o644)
	})
}

func stagePackHooks(p Pack, destination string) error {
	if err := Validate(p); err != nil {
		return err
	}
	entries, err := fs.ReadDir(p.FS, "hooks")
	if errors.Is(err, fs.ErrNotExist) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("pack %q hooks: %w", p.Name, err)
	}
	for _, entry := range entries {
		resource := path.Join("hooks", entry.Name())
		if entry.Type()&fs.ModeSymlink != 0 {
			return fmt.Errorf("pack %q hook %q is a symlink", p.Name, resource)
		}
		if entry.IsDir() {
			return fmt.Errorf("pack %q hooks must not be nested: %q", p.Name, resource)
		}
		if !strings.HasSuffix(entry.Name(), ".pb.js") {
			return fmt.Errorf("pack %q hook resource %q is not a .pb.js file", p.Name, resource)
		}
		data, err := fs.ReadFile(p.FS, resource)
		if err != nil {
			return fmt.Errorf("read pack %q hook %q: %w", p.Name, resource, err)
		}
		target := filepath.Join(destination, "pack--"+p.Name+"--"+entry.Name())
		if err := os.WriteFile(target, data, 0o644); err != nil {
			return fmt.Errorf("write pack %q hook %q: %w", p.Name, resource, err)
		}
	}
	return nil
}

func replaceDirectory(staged, destination string) error {
	backupFile, err := os.CreateTemp(filepath.Dir(destination), ".hooks-backup-")
	if err != nil {
		return fmt.Errorf("reserve hooks backup name: %w", err)
	}
	backup := backupFile.Name()
	if err := backupFile.Close(); err != nil {
		return fmt.Errorf("close hooks backup reservation: %w", err)
	}
	if err := os.Remove(backup); err != nil {
		return fmt.Errorf("release hooks backup reservation: %w", err)
	}
	hadOld := false
	if _, err := os.Lstat(destination); err == nil {
		if err := os.Rename(destination, backup); err != nil {
			return fmt.Errorf("backup hooks staging directory: %w", err)
		}
		hadOld = true
	} else if !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("inspect hooks staging destination: %w", err)
	}
	if err := os.Rename(staged, destination); err != nil {
		if hadOld {
			if restoreErr := os.Rename(backup, destination); restoreErr != nil {
				return fmt.Errorf("publish hooks staging: %v; restore previous hooks: %w", err, restoreErr)
			}
		}
		return fmt.Errorf("publish hooks staging: %w", err)
	}
	if hadOld {
		if err := os.RemoveAll(backup); err != nil {
			return fmt.Errorf("remove hooks staging backup: %w", err)
		}
	}
	return nil
}

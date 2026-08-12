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
	"sort"
	"strings"
)

// StageMigrations publishes core and resolved Pack JS migrations together into
// a flat directory consumed by the jsvm plugin's MigrationsDir loader. Pack
// migration files are namespaced as "pack--<name>--<original>" so that multiple
// Packs (and core) coexist in the shared, flat _migrations tracking table
// without filename collisions. Failures before publication preserve the
// previous tree.
//
// coreDir is optional: pass "" when there is no core/user JS migrations dir to
// copy (e.g. when only Pack migrations are staged). If coreDir is non-empty but
// does not exist, it is treated as "no core migrations" and skipped.
func StageMigrations(coreDir string, packs []Pack, destination string) error {
	if destination == "" {
		return errors.New("migrations staging destination is empty")
	}

	parent := filepath.Dir(filepath.Clean(destination))
	if err := os.MkdirAll(parent, 0o755); err != nil {
		return fmt.Errorf("create migrations staging parent: %w", err)
	}

	temp, err := os.MkdirTemp(parent, ".migrations-stage-")
	if err != nil {
		return fmt.Errorf("create migrations staging directory: %w", err)
	}
	defer os.RemoveAll(temp)

	seen := make(map[string]string) // staged filename -> source description

	if coreDir != "" {
		if err := stageCoreMigrations(coreDir, temp, seen); err != nil {
			return err
		}
	}

	sorted := append([]Pack(nil), packs...)
	slices.SortFunc(sorted, func(a, b Pack) int { return cmp.Compare(a.Name, b.Name) })

	for _, p := range sorted {
		if err := stagePackMigrations(p, temp, seen); err != nil {
			return err
		}
	}

	return replaceDirectory(temp, filepath.Clean(destination))
}

// stageCoreMigrations copies flat runnable .js migration files from source
// into destination. It mirrors the jsvm loader's flat-directory contract: only
// direct children are staged; nested directories are ignored (jsvm does not
// load them either).
func stageCoreMigrations(source, destination string, seen map[string]string) error {
	info, err := os.Lstat(source)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return nil // no core migrations; Pack-only staging
		}
		return fmt.Errorf("inspect core migrations: %w", err)
	}
	if info.Mode()&os.ModeSymlink != 0 || !info.IsDir() {
		return fmt.Errorf("core migrations must be a real directory: %q", source)
	}

	entries, err := os.ReadDir(source)
	if err != nil {
		return fmt.Errorf("read core migrations: %w", err)
	}
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		if entry.Type()&os.ModeSymlink != 0 {
			return fmt.Errorf("core migration %q is a symlink", entry.Name())
		}
		if !isJSMigrationFile(entry.Name()) {
			continue
		}
		if prev, ok := seen[entry.Name()]; ok {
			return fmt.Errorf("core migration %q collides with %q", entry.Name(), prev)
		}
		data, err := os.ReadFile(filepath.Join(source, entry.Name()))
		if err != nil {
			return fmt.Errorf("read core migration %q: %w", entry.Name(), err)
		}
		if err := os.WriteFile(filepath.Join(destination, entry.Name()), data, 0o600); err != nil {
			return fmt.Errorf("stage core migration %q: %w", entry.Name(), err)
		}
		seen[entry.Name()] = "core:" + entry.Name()
	}
	return nil
}

// stagePackMigrations stages one Pack's migrations/ (or migration/) directory
// into destination, namespacing each file as "pack--<name>--<original>".
func stagePackMigrations(p Pack, destination string, seen map[string]string) error {
	if err := Validate(p); err != nil {
		return err
	}

	resource, files, err := packMigrationFiles(p)
	if err != nil {
		return fmt.Errorf("pack %q migrations: %w", p.Name, err)
	}
	if len(files) == 0 {
		return nil
	}

	for _, name := range files {
		staged := "pack--" + p.Name + "--" + name
		if prev, ok := seen[staged]; ok {
			return fmt.Errorf("migration %q collides with %q", staged, prev)
		}
		data, err := fs.ReadFile(p.FS, path.Join(resource, name))
		if err != nil {
			return fmt.Errorf("read pack %q migration %q: %w", p.Name, name, err)
		}
		if err := os.WriteFile(filepath.Join(destination, staged), data, 0o600); err != nil {
			return fmt.Errorf("stage pack %q migration %q: %w", p.Name, name, err)
		}
		seen[staged] = "pack:" + p.Name + ":" + name
	}
	return nil
}

// packMigrationFiles returns the flat, sorted migration filenames in a Pack's
// migrations/ (preferred) or migration/ directory, after validating that each
// has a numeric id and no duplicate ids within the Pack. An empty result means
// the Pack has no migrations.
func packMigrationFiles(p Pack) (string, []string, error) {
	for _, dir := range []string{"migrations", "migration"} {
		entries, err := fs.ReadDir(p.FS, dir)
		if errors.Is(err, fs.ErrNotExist) {
			continue
		}
		if err != nil {
			return "", nil, fmt.Errorf("read %s: %w", dir, err)
		}

		files := make([]string, 0, len(entries))
		seenIDs := make(map[string]string)
		for _, entry := range entries {
			if entry.IsDir() {
				return "", nil, fmt.Errorf("%s must be flat (no subdirectories): %q", dir, entry.Name())
			}
			if entry.Type()&fs.ModeSymlink != 0 {
				return "", nil, fmt.Errorf("%s entry %q is a symlink", dir, entry.Name())
			}
			if !isJSMigrationFile(entry.Name()) {
				return "", nil, fmt.Errorf("%s entry %q is not a runnable .js migration file", dir, entry.Name())
			}

			match := migrationIDPattern.FindStringSubmatch(entry.Name())
			if len(match) == 0 {
				return "", nil, fmt.Errorf("migration file %q has no numeric id", entry.Name())
			}
			id := match[2]
			if prev, ok := seenIDs[id]; ok {
				return "", nil, fmt.Errorf("duplicate migration id %s (%s and %s)", id, prev, entry.Name())
			}
			seenIDs[id] = entry.Name()
			files = append(files, entry.Name())
		}

		sort.Strings(files)
		return dir, files, nil
	}

	return "", nil, nil
}

// isJSMigrationFile reports whether name is a runnable PocketBase JS migration
// file. goja executes JavaScript only, so .ts files are deliberately excluded:
// PB's MigrationsFilesPattern also matches .ts for IDE linting, but such files
// cannot be run by the migration VM and would only fail later inside jsvm.
func isJSMigrationFile(name string) bool {
	return strings.HasSuffix(name, ".js")
}

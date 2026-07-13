package pack

import (
	"fmt"
	"io/fs"
	"regexp"
)

// Pack is an identity and its resource filesystem.
type Pack struct {
	Name    string
	Version string
	FS      fs.FS
	Source  Source
}

var (
	namePattern    = regexp.MustCompile(`^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$`)
	versionPattern = regexp.MustCompile(`^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$`)
)

func validateIdentity(name, version string) error {
	if !namePattern.MatchString(name) {
		return fmt.Errorf("invalid pack name %q", name)
	}
	if !versionPattern.MatchString(version) {
		return fmt.Errorf("invalid pack version %q", version)
	}
	return nil
}

// Validate verifies a Pack's identity and complete resource tree.
func Validate(p Pack) error {
	if err := validateIdentity(p.Name, p.Version); err != nil {
		return err
	}
	if p.FS == nil {
		return fmt.Errorf("pack %q has no filesystem", p.Name)
	}
	if p.Source != Builtin && p.Source != Local {
		return fmt.Errorf("pack %q has invalid source %d", p.Name, p.Source)
	}
	return fs.WalkDir(p.FS, ".", func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return fmt.Errorf("pack %q resource %q: %w", p.Name, path, walkErr)
		}
		if path != "." && !fs.ValidPath(path) {
			return fmt.Errorf("pack %q has invalid resource path %q", p.Name, path)
		}
		if entry.Type()&fs.ModeSymlink != 0 {
			return fmt.Errorf("pack %q resource %q is a symlink", p.Name, path)
		}
		return nil
	})
}

// Inspect returns the resolved Pack with the requested name.
func Inspect(packs []Pack, name string) (Pack, error) {
	if !namePattern.MatchString(name) {
		return Pack{}, fmt.Errorf("invalid pack name %q", name)
	}
	for _, p := range packs {
		if p.Name == name {
			if err := Validate(p); err != nil {
				return Pack{}, err
			}
			return p, nil
		}
	}
	return Pack{}, fmt.Errorf("pack %q not found", name)
}

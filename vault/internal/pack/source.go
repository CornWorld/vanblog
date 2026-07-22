package pack

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/fs"
	"sort"
)

// Source identifies where a Pack's resources originated.
type Source uint8

const (
	Builtin Source = iota
	Local
)

func (s Source) String() string {
	switch s {
	case Builtin:
		return "builtin"
	case Local:
		return "local"
	default:
		return fmt.Sprintf("unknown(%d)", s)
	}
}

// Builtins loads the virtual builtin Pack set from an explicitly supplied
// filesystem whose direct children are Pack directories.
func Builtins(root fs.FS) ([]Pack, error) {
	if root == nil {
		return nil, fmt.Errorf("builtin packs filesystem is nil")
	}
	entries, err := fs.ReadDir(root, ".")
	if err != nil {
		return nil, fmt.Errorf("read builtin packs root: %w", err)
	}
	packs := make([]Pack, 0, len(entries))
	seen := make(map[string]struct{}, len(entries))
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		packFS, err := fs.Sub(root, entry.Name())
		if err != nil {
			return nil, fmt.Errorf("open builtin pack %q: %w", entry.Name(), err)
		}
		p, err := loadBuiltin(entry.Name(), packFS)
		if err != nil {
			return nil, err
		}
		if _, exists := seen[p.Name]; exists {
			return nil, fmt.Errorf("duplicate builtin pack %q", p.Name)
		}
		seen[p.Name] = struct{}{}
		packs = append(packs, p)
	}
	sort.Slice(packs, func(i, j int) bool { return packs[i].Name < packs[j].Name })
	return packs, nil
}

func loadBuiltin(directory string, packFS fs.FS) (Pack, error) {
	data, err := fs.ReadFile(packFS, "pack.json")
	if err != nil {
		return Pack{}, fmt.Errorf("read builtin pack %q identity: %w", directory, err)
	}
	// Allow optional Astro-facing metadata fields (title, nav, frontend) so
	// the Astro resolver can keep using pack.json as the single source of
	// truth. Go itself only consumes name and version.
	var meta packMetadata
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&meta); err != nil {
		return Pack{}, fmt.Errorf("decode builtin pack %q identity: %w", directory, err)
	}
	if err := validateIdentity(meta.Name, meta.Version); err != nil {
		return Pack{}, err
	}
	p := Pack{Name: meta.Name, Version: meta.Version, FS: packFS, Source: Builtin}
	if p.Name != directory {
		return Pack{}, fmt.Errorf("builtin directory %q declares name %q", directory, p.Name)
	}
	if err := Validate(p); err != nil {
		return Pack{}, err
	}
	return p, nil
}

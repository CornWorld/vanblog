package pack

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/fs"
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
	bookmarksFS, err := fs.Sub(root, "bookmarks")
	if err != nil {
		return nil, fmt.Errorf("open builtin bookmarks: %w", err)
	}
	data, err := fs.ReadFile(bookmarksFS, "pack.json")
	if err != nil {
		return nil, fmt.Errorf("read builtin bookmarks identity: %w", err)
	}
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	var identity identity
	if err := decoder.Decode(&identity); err != nil {
		return nil, fmt.Errorf("decode builtin bookmarks identity: %w", err)
	}
	if err := validateIdentity(identity.Name, identity.Version); err != nil {
		return nil, err
	}
	p := Pack{Name: identity.Name, Version: identity.Version, FS: bookmarksFS, Source: Builtin}
	if p.Name != "bookmarks" {
		return nil, fmt.Errorf("builtin directory bookmarks declares name %q", p.Name)
	}
	if err := Validate(p); err != nil {
		return nil, err
	}
	return []Pack{p}, nil
}

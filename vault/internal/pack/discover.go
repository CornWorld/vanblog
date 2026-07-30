package pack

import (
	"cmp"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"testing/fstest"
)

type identity struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

// packMetadata mirrors the optional fields allowed in pack.json beyond
// identity. The JSON schema intentionally stays strict (unknown fields
// rejected) so typos in metadata keys fail closed at discovery time.
type packMetadata struct {
	Name     string            `json:"name"`
	Version  string            `json:"version"`
	Title    *string           `json:"title,omitempty"`
	Nav      *navMetadata      `json:"nav,omitempty"`
	Frontend *frontendMetadata `json:"frontend,omitempty"`
}

type navMetadata struct {
	Label string `json:"label"`
	Href  string `json:"href"`
}

type frontendMetadata struct {
	Scope   string   `json:"scope"`
	Styles  []string `json:"styles"`
	Scripts []string `json:"scripts"`
}

// LoadLocal validates one local Pack directory.
func LoadLocal(directory string) (Pack, error) {
	if directory == "" {
		return Pack{}, errors.New("local pack directory is empty")
	}
	info, err := os.Lstat(directory)
	if err != nil {
		return Pack{}, fmt.Errorf("inspect local pack directory: %w", err)
	}
	if info.Mode()&os.ModeSymlink != 0 || !info.IsDir() {
		return Pack{}, fmt.Errorf("local pack must be a real directory: %q", directory)
	}
	id, err := readIdentity(filepath.Join(directory, "pack.json"))
	if err != nil {
		return Pack{}, err
	}
	if filepath.Base(filepath.Clean(directory)) != id.Name {
		return Pack{}, fmt.Errorf("local pack directory %q does not match name %q", filepath.Base(filepath.Clean(directory)), id.Name)
	}
	filesystem, err := snapshotLocal(directory)
	if err != nil {
		return Pack{}, err
	}
	p := Pack{Name: id.Name, Version: id.Version, FS: filesystem, Source: Local}
	if err := Validate(p); err != nil {
		return Pack{}, err
	}
	return p, nil
}

// DiscoverLocal loads one Pack from each direct child directory of root.
func DiscoverLocal(root string) ([]Pack, error) {
	if root == "" {
		return nil, errors.New("local pack root is empty")
	}
	info, err := os.Lstat(root)
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("inspect local pack root: %w", err)
	}
	if info.Mode()&os.ModeSymlink != 0 || !info.IsDir() {
		return nil, fmt.Errorf("local pack root must be a real directory: %q", root)
	}

	entries, err := os.ReadDir(root)
	if err != nil {
		return nil, fmt.Errorf("read local pack root: %w", err)
	}
	packs := make([]Pack, 0, len(entries))
	seen := make(map[string]struct{}, len(entries))
	for _, entry := range entries {
		if entry.Type()&os.ModeSymlink != 0 {
			return nil, fmt.Errorf("local pack entry %q is a symlink", entry.Name())
		}
		if !entry.IsDir() {
			continue
		}
		packDir := filepath.Join(root, entry.Name())
		id, err := readIdentity(filepath.Join(packDir, "pack.json"))
		if err != nil {
			return nil, fmt.Errorf("local pack %q: %w", entry.Name(), err)
		}
		if id.Name != entry.Name() {
			return nil, fmt.Errorf("local pack directory %q does not match name %q", entry.Name(), id.Name)
		}
		if _, exists := seen[id.Name]; exists {
			return nil, fmt.Errorf("duplicate local pack %q", id.Name)
		}
		seen[id.Name] = struct{}{}
		filesystem, err := snapshotLocal(packDir)
		if err != nil {
			return nil, fmt.Errorf("local pack %q: %w", entry.Name(), err)
		}
		p := Pack{Name: id.Name, Version: id.Version, FS: filesystem, Source: Local}
		if err := Validate(p); err != nil {
			return nil, err
		}
		packs = append(packs, p)
	}
	slices.SortFunc(packs, func(a, b Pack) int { return cmp.Compare(a.Name, b.Name) })
	return packs, nil
}

func snapshotLocal(root string) (fstest.MapFS, error) {
	snapshot := fstest.MapFS{}
	var total int64
	err := filepath.WalkDir(root, func(filename string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if entry.Type()&os.ModeSymlink != 0 {
			return fmt.Errorf("resource %q is a symlink", filename)
		}
		rel, err := filepath.Rel(root, filename)
		if err != nil || rel == ".." || filepath.IsAbs(rel) {
			return fmt.Errorf("resource path escapes local Pack: %q", filename)
		}
		resource := filepath.ToSlash(rel)
		if !validSnapshotPath(resource) {
			return fmt.Errorf("invalid local Pack resource path %q", resource)
		}
		if resource == "." {
			return nil
		}
		if entry.IsDir() {
			snapshot[resource] = &fstest.MapFile{Mode: fs.ModeDir | 0o755}
			return nil
		}
		info, err := entry.Info()
		if err != nil {
			return err
		}
		if !info.Mode().IsRegular() {
			return fmt.Errorf("resource %q is not a regular file", resource)
		}
		if info.Size() > maxLocalPackFileBytes {
			return fmt.Errorf("resource %q exceeds %d bytes", resource, maxLocalPackFileBytes)
		}
		total += info.Size()
		if total > maxLocalPackBytes {
			return fmt.Errorf("local Pack exceeds %d bytes", maxLocalPackBytes)
		}
		data, err := os.ReadFile(filename)
		if err != nil {
			return err
		}
		if int64(len(data)) != info.Size() {
			return fmt.Errorf("resource %q changed while snapshotting", resource)
		}
		snapshot[resource] = &fstest.MapFile{Data: data, Mode: 0o644}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return snapshot, nil
}

func readIdentity(path string) (identity, error) {
	file, err := os.Open(path)
	if err != nil {
		return identity{}, fmt.Errorf("open pack.json: %w", err)
	}
	defer file.Close()
	decoder := json.NewDecoder(io.LimitReader(file, 64*1024))
	decoder.DisallowUnknownFields()
	// Decode into packMetadata so optional Astro-facing fields (title, nav,
	// frontend) are accepted without breaking Go discovery. Go itself only
	// consumes name and version; the rest is read by the Astro resolver.
	var meta packMetadata
	if err := decoder.Decode(&meta); err != nil {
		return identity{}, fmt.Errorf("decode pack.json: %w", err)
	}
	id := identity{Name: meta.Name, Version: meta.Version}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return identity{}, errors.New("pack.json must contain one JSON object")
	}
	if err := validateIdentity(id.Name, id.Version); err != nil {
		return identity{}, err
	}
	return id, nil
}

// Resolve validates and combines builtin and local Packs using whole-Pack replacement.
func Resolve(builtins, locals []Pack) ([]Pack, error) {
	resolved, _, err := ResolveWithDiagnostics(builtins, locals)
	return resolved, err
}

// OverrideWarning describes a whole-Pack replacement that is valid but worth
// flagging — currently only used for local override versions that are older
// than the builtin they replace.
type OverrideWarning struct {
	Pack           string
	BuiltinVersion string
	LocalVersion   string
	Reason         string
}

// ResolveWithDiagnostics behaves like Resolve but also returns warnings about
// suspicious overrides (for example, a local Pack whose SemVer is strictly
// older than the builtin it replaces). The resolved slice is still authoritative;
// warnings never block activation, they only give operators a visible signal
// in startup logs.
func ResolveWithDiagnostics(builtins, locals []Pack) ([]Pack, []OverrideWarning, error) {
	builtinByName := make(map[string]Pack, len(builtins))
	resolved := make(map[string]Pack, len(builtins)+len(locals))
	for _, p := range builtins {
		if p.Source != Builtin {
			return nil, nil, fmt.Errorf("builtin pack %q has wrong source", p.Name)
		}
		if err := Validate(p); err != nil {
			return nil, nil, err
		}
		if _, exists := resolved[p.Name]; exists {
			return nil, nil, fmt.Errorf("duplicate builtin pack %q", p.Name)
		}
		resolved[p.Name] = p
		builtinByName[p.Name] = p
	}
	localNames := make(map[string]struct{}, len(locals))
	var warnings []OverrideWarning
	for _, p := range locals {
		if p.Source != Local {
			return nil, nil, fmt.Errorf("local pack %q has wrong source", p.Name)
		}
		if err := Validate(p); err != nil {
			return nil, nil, err
		}
		if _, exists := localNames[p.Name]; exists {
			return nil, nil, fmt.Errorf("duplicate local pack %q", p.Name)
		}
		localNames[p.Name] = struct{}{}
		if builtin, ok := builtinByName[p.Name]; ok {
			if cmp, err := compareSemVer(p.Version, builtin.Version); err == nil && cmp < 0 {
				warnings = append(warnings, OverrideWarning{
					Pack:           p.Name,
					BuiltinVersion: builtin.Version,
					LocalVersion:   p.Version,
					Reason:         fmt.Sprintf("local override %s is older than builtin %s; replacement proceeds but may regress behavior", p.Version, builtin.Version),
				})
			}
		}
		resolved[p.Name] = p
	}
	packs := make([]Pack, 0, len(resolved))
	for _, p := range resolved {
		packs = append(packs, p)
	}
	slices.SortFunc(packs, func(a, b Pack) int { return cmp.Compare(a.Name, b.Name) })
	return packs, warnings, nil
}

// compareSemVer compares two SemVer strings. Returns -1, 0, +1 per the usual
// comparator contract. An error means either string is not a valid SemVer;
// callers should treat that as "no comparison possible" and skip the check.
// Only major.minor.patch plus optional pre-release are considered; build
// metadata is ignored per SemVer spec.
func compareSemVer(a, b string) (int, error) {
	av, err := parseSemVer(a)
	if err != nil {
		return 0, err
	}
	bv, err := parseSemVer(b)
	if err != nil {
		return 0, err
	}
	if av.major != bv.major {
		if av.major < bv.major {
			return -1, nil
		}
		return 1, nil
	}
	if av.minor != bv.minor {
		if av.minor < bv.minor {
			return -1, nil
		}
		return 1, nil
	}
	if av.patch != bv.patch {
		if av.patch < bv.patch {
			return -1, nil
		}
		return 1, nil
	}
	// Per SemVer: a version with a pre-release tag is LOWER than the same
	// major.minor.patch without one.
	switch {
	case av.pre == "" && bv.pre != "":
		return 1, nil
	case av.pre != "" && bv.pre == "":
		return -1, nil
	case av.pre != bv.pre:
		return comparePreRelease(av.pre, bv.pre), nil
	}
	return 0, nil
}

// comparePreRelease implements the SemVer 2.0.0 spec §11 pre-release
// comparison rules:
//   - Split on '.' into dot-separated identifiers.
//   - Compare identifier-by-identifier; the first difference decides.
//   - Numeric identifiers (all digits) compare numerically; a numeric
//     identifier is LOWER than any alphanumeric identifier at the same
//     position.
//   - If all compared identifiers are equal, the longer set of identifiers
//     has HIGHER precedence (1.0.0-alpha < 1.0.0-alpha.1).
func comparePreRelease(a, b string) int {
	aIDs := strings.Split(a, ".")
	bIDs := strings.Split(b, ".")
	minLen := min(len(aIDs), len(bIDs))
	for i := range minLen {
		ai, aIsNum := parsePreReleaseIdentifier(aIDs[i])
		bi, bIsNum := parsePreReleaseIdentifier(bIDs[i])
		switch {
		case aIsNum && bIsNum:
			if ai != bi {
				if ai < bi {
					return -1
				}
				return 1
			}
		case aIsNum && !bIsNum:
			// Numeric identifiers have lower precedence than alphanumeric.
			return -1
		case !aIsNum && bIsNum:
			return 1
		default:
			if aIDs[i] != bIDs[i] {
				if aIDs[i] < bIDs[i] {
					return -1
				}
				return 1
			}
		}
	}
	// All shared identifiers are equal. The longer pre-release wins.
	switch {
	case len(aIDs) < len(bIDs):
		return -1
	case len(aIDs) > len(bIDs):
		return 1
	}
	return 0
}

// parsePreReleaseIdentifier returns the numeric value of the identifier when
// it is composed entirely of digits, and a numeric flag. Non-numeric
// identifiers are returned as (0, false); the caller should use the string
// form directly. Per SemVer spec §11, numeric identifiers must not have
// leading zeros, so "01" is treated as non-numeric (lexical comparison).
func parsePreReleaseIdentifier(s string) (int, bool) {
	if s == "" {
		return 0, false
	}
	// SemVer §11: numeric identifiers must not have leading zeros.
	if len(s) > 1 && s[0] == '0' {
		return 0, false
	}
	for _, r := range s {
		if r < '0' || r > '9' {
			return 0, false
		}
	}
	n, err := strconv.Atoi(s)
	if err != nil {
		return 0, false
	}
	return n, true
}

type semVer struct {
	major, minor, patch int
	pre                 string
}

var semVerPattern = regexp.MustCompile(`^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$`)

func parseSemVer(s string) (semVer, error) {
	m := semVerPattern.FindStringSubmatch(s)
	if m == nil {
		return semVer{}, fmt.Errorf("invalid semver %q", s)
	}
	var v semVer
	v.major, _ = strconv.Atoi(m[1])
	v.minor, _ = strconv.Atoi(m[2])
	v.patch, _ = strconv.Atoi(m[3])
	v.pre = m[4]
	return v, nil
}

package pack

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io/fs"
	"sort"
)

// Status describes the derived lifecycle state of a resolved Pack. It is
// diagnostic state only; it is never persisted in PocketBase.
type Status struct {
	Name        string
	Version     string
	Source      Source
	State       string
	SourceHash  string
	HasArtifact bool
	Freshness   string
	Reason      string
}

// Statuses derives read-only lifecycle states from the resolved Pack set and
// runtime loadability warnings. The active set is exactly the resolved set;
// this function does not enable, disable, install, or remove anything.
func Statuses(packs []Pack) ([]Status, error) {
	loadable, warnings, err := RuntimeLoadableV0(packs)
	if err != nil {
		return nil, err
	}
	warningByPack := make(map[string]string, len(warnings))
	for _, warning := range warnings {
		warningByPack[warning.Pack] = warning.Reason
	}
	loadableByPack := make(map[string]struct{}, len(loadable))
	for _, item := range loadable {
		loadableByPack[item.Name] = struct{}{}
	}

	statuses := make([]Status, 0, len(packs))
	for _, item := range packs {
		sourceHash, err := Fingerprint(item)
		if err != nil {
			return nil, fmt.Errorf("fingerprint pack %q: %w", item.Name, err)
		}
		freshness, freshnessErr := ArtifactFreshness(item)
		if freshnessErr != nil {
			freshness = "invalid"
		}
		status := Status{
			Name:        item.Name,
			Version:     item.Version,
			Source:      item.Source,
			State:       "active",
			SourceHash:  sourceHash,
			HasArtifact: HasSchemaArtifact(item),
			Freshness:   freshness,
		}
		if item.Source == Builtin {
			status.State = "builtin-enabled"
		}
		if reason, ok := warningByPack[item.Name]; ok {
			status.State = "needs-rebuild"
			status.Reason = reason
		} else if _, ok := loadableByPack[item.Name]; !ok {
			return nil, fmt.Errorf("pack %q has no derived runtime state", item.Name)
		}
		statuses = append(statuses, status)
	}
	return statuses, nil
}

const sha256HexLength = sha256.Size * 2

// Fingerprint returns a deterministic SHA-256 fingerprint of Pack source
// resources. Generated schema.js is excluded so rebuilding an artifact does
// not falsely appear to change the authored source.
func Fingerprint(p Pack) (string, error) {
	if p.FS == nil {
		return "", fmt.Errorf("pack filesystem is nil")
	}
	paths := make([]string, 0)
	if err := fs.WalkDir(p.FS, ".", func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if path != "." && !entry.IsDir() && path != "schema.js" && path != artifactMetadataPath {
			paths = append(paths, path)
		}
		return nil
	}); err != nil {
		return "", err
	}
	sort.Strings(paths)
	hash := sha256.New()
	for _, path := range paths {
		data, err := fs.ReadFile(p.FS, path)
		if err != nil {
			return "", err
		}
		fmt.Fprintf(hash, "%s\\x00%d\\x00", path, len(data))
		_, _ = hash.Write(data)
	}
	return hex.EncodeToString(hash.Sum(nil)), nil
}

// HasSchemaArtifact reports whether a Pack contains the runtime schema
// artifact. It is intentionally a small diagnostic helper and does not imply
// that the artifact is valid; Goja validation remains the authority.
func HasSchemaArtifact(p Pack) bool {
	if p.FS == nil {
		return false
	}
	_, err := fs.Stat(p.FS, "schema.js")
	return err == nil
}

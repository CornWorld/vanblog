package pack

import (
	"encoding/json"
	"os"
	"path"
	"path/filepath"
	"slices"
	"strings"
)

// FrontendManifest is the runtime pack-frontend contract consumed by the
// theme layouts via GET /api/vanblog/packs/frontend: which packs exist
// (nav metadata) and which styles/scripts every pack injects into public
// pages. Asset URLs are stable /pack-static/<pack>/<path> locations served
// from the LIVE pack directories (builtin + user, user wins), so a pack
// installed into the packs volume takes effect without rebuilding any
// theme — the historical build-time baking (virtual module + hashed ?url
// emission) only covered the packs present at image build.
type FrontendManifest struct {
	Packs         []FrontendPack         `json:"packs"`
	Contributions []FrontendContribution `json:"contributions"`
}

type FrontendPack struct {
	Name    string       `json:"name"`
	Title   string       `json:"title"`
	Version string       `json:"version"`
	Nav     *FrontendNav `json:"nav"`
}

type FrontendNav struct {
	Label string `json:"label"`
	Href  string `json:"href"`
}

type FrontendContribution struct {
	Name    string   `json:"name"`
	Scope   string   `json:"scope"`
	Styles  []string `json:"styles"`
	Scripts []string `json:"scripts"`
}

// FrontendManifestMaxAge is the shared cache lifetime of the manifest: the
// HTTP response header and the Node-side layout cache both use it, and the
// custom-code writer schedules its revalidate past this window so a page
// re-render always observes a fresh manifest.
const FrontendManifestMaxAge = "10"

// manifestEntry couples a pack directory with its decoded pack.json.
type manifestEntry struct {
	dir  string
	meta packMetadata
}

// readPackMetadataFile decodes one pack.json with the same strict unknown-
// key rejection the boot-time discovery uses, so a typo'd field fails
// closed here too.
func readPackMetadataFile(file string) (packMetadata, error) {
	data, err := os.ReadFile(file)
	if err != nil {
		return packMetadata{}, err
	}
	var meta packMetadata
	dec := json.NewDecoder(strings.NewReader(string(data)))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&meta); err != nil {
		return packMetadata{}, err
	}
	if err := validateIdentity(meta.Name, meta.Version); err != nil {
		return packMetadata{}, err
	}
	return meta, nil
}

// BuildFrontendManifest merges the builtin + local pack roots (user wins on
// name collision — the same precedence as the boot-time resolution) into the
// runtime frontend manifest. Broken individual packs are skipped silently:
// the manifest is advisory and one bad pack.json must not take the whole
// site's navigation or stylesheet injection down. Missing roots are not an
// error (some environments run without a user packs volume).
func BuildFrontendManifest(builtinDir, localDir string) FrontendManifest {
	byName := map[string]manifestEntry{}
	for _, root := range []string{builtinDir, localDir} {
		if root == "" {
			continue
		}
		entries, err := os.ReadDir(root)
		if err != nil {
			continue
		}
		for _, e := range entries {
			if !e.IsDir() || !namePattern.MatchString(e.Name()) {
				continue
			}
			dir := filepath.Join(root, e.Name())
			meta, err := readPackMetadataFile(filepath.Join(dir, "pack.json"))
			if err != nil || meta.Name != e.Name() {
				continue
			}
			// User root is iterated after builtin, so a colliding user pack
			// overwrites the builtin entry → user wins.
			byName[e.Name()] = manifestEntry{dir: dir, meta: meta}
		}
	}

	names := make([]string, 0, len(byName))
	for name := range byName {
		names = append(names, name)
	}
	slices.Sort(names)

	manifest := FrontendManifest{
		Packs:         make([]FrontendPack, 0, len(names)),
		Contributions: []FrontendContribution{},
	}
	for _, name := range names {
		entry := byName[name]
		manifest.Packs = append(manifest.Packs, buildFrontendPack(name, entry.meta))
		if entry.meta.Frontend != nil && entry.meta.Frontend.Scope == "public" {
			if contribution, ok := buildFrontendContribution(name, entry.dir, *entry.meta.Frontend); ok {
				manifest.Contributions = append(manifest.Contributions, contribution)
			}
		}
	}
	return manifest
}

// buildFrontendPack normalizes exactly like the Astro-side resolver
// (app/integrations/packs/resolver.mjs loadPackMetadata): title defaults to
// the name, and a pack's nav href is ALWAYS forced into its /p/<name>
// namespace so a pack.json can never point navigation off-site.
func buildFrontendPack(name string, meta packMetadata) FrontendPack {
	title := name
	if meta.Title != nil && *meta.Title != "" {
		title = *meta.Title
	}
	pack := FrontendPack{Name: name, Title: title, Version: meta.Version}
	if meta.Nav != nil {
		label := title
		if meta.Nav.Label != "" {
			label = meta.Nav.Label
		}
		pack.Nav = &FrontendNav{Label: label, Href: "/p/" + name}
	}
	return pack
}

func buildFrontendContribution(name, dir string, frontend frontendMetadata) (FrontendContribution, bool) {
	contribution := FrontendContribution{Name: name, Scope: "public"}
	appendURLs := func(rels []string, dst *[]string) {
		for _, rel := range rels {
			clean, ok := safePackRelPath(rel)
			if !ok {
				continue
			}
			if !isRegularFile(filepath.Join(dir, "frontend", filepath.FromSlash(clean))) {
				continue
			}
			*dst = append(*dst, "/pack-static/"+name+"/"+clean)
		}
	}
	appendURLs(frontend.Styles, &contribution.Styles)
	appendURLs(frontend.Scripts, &contribution.Scripts)
	if len(contribution.Styles) == 0 && len(contribution.Scripts) == 0 {
		return contribution, false
	}
	return contribution, true
}

// safePackRelPath validates a pack.json frontend path before it becomes a
// URL / disk lookup: non-empty, slash-separated relative path without
// traversal, NUL or backslash. Mirrors the resolver's frontend path rules.
func safePackRelPath(rel string) (string, bool) {
	if rel == "" || strings.ContainsAny(rel, "\x00\\") || path.IsAbs(rel) {
		return "", false
	}
	clean := path.Clean(rel)
	if clean == "." || clean == ".." || strings.HasPrefix(clean, "../") {
		return "", false
	}
	return clean, true
}

func isRegularFile(file string) bool {
	info, err := os.Lstat(file)
	return err == nil && info.Mode().IsRegular()
}

// openPackStaticFile resolves a "/pack-static/<pack>/<rest...>" URL against
// the merged pack roots (user root first — user wins) and opens the file
// under <root>/<pack>/frontend/<rest>. Symlinks and non-regular files are
// rejected, mirroring pack.Validate's symlink ban: a writable packs volume
// must not be able to pivot the file server onto arbitrary paths.
func openPackStaticFile(builtinDir, localDir, urlPath string) (*os.File, os.FileInfo, error) {
	rest := strings.TrimPrefix(urlPath, "/pack-static/")
	packName, rel, ok := strings.Cut(rest, "/")
	if !ok || !namePattern.MatchString(packName) {
		return nil, nil, os.ErrNotExist
	}
	clean, ok := safePackRelPath(rel)
	if !ok {
		return nil, nil, os.ErrNotExist
	}
	for _, root := range []string{localDir, builtinDir} {
		if root == "" {
			continue
		}
		file := filepath.Join(root, packName, "frontend", filepath.FromSlash(clean))
		if !isRegularFile(file) {
			continue
		}
		f, err := os.Open(file)
		if err != nil {
			continue
		}
		info, err := f.Stat()
		if err != nil || !info.Mode().IsRegular() {
			f.Close()
			continue
		}
		return f, info, nil
	}
	return nil, nil, os.ErrNotExist
}

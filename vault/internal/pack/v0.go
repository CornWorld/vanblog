package pack

import (
	"fmt"
	"io/fs"
	"path"
	"strings"
)

const (
	maxLocalPackFileBytes = 4 << 20
	maxLocalPackBytes     = 16 << 20
)

// RuntimeWarning describes a Pack that is valid source but cannot be consumed by
// the current v0 runtime without a builder-produced artifact.
type RuntimeWarning struct {
	Pack   string
	Reason string
}

// RuntimeLoadableV0 returns the subset of resolved Packs that the current v0
// runtime may load directly. Source Packs are valid Pack inputs, but local
// frontend source/resources require the dev-image builder to produce runtime
// artifacts first. The prod runtime does not install dependencies or build
// Packs; it skips those user Packs and reports warnings to the caller.
//
// Builtin Packs remain fatal on invalid state because they are part of the
// shipped product image. User/local Packs degrade with warnings so a broken
// extension does not take the whole site down.
func RuntimeLoadableV0(packs []Pack) ([]Pack, []RuntimeWarning, error) {
	loadable := make([]Pack, 0, len(packs))
	var warnings []RuntimeWarning
	for _, p := range packs {
		if p.Source == Local {
			resource, hasRuntimeUnsupportedFrontend, err := firstRuntimeUnsupportedFrontendResource(p)
			if err != nil {
				return nil, nil, err
			}
			if hasRuntimeUnsupportedFrontend {
				warnings = append(warnings, RuntimeWarning{
					Pack:   p.Name,
					Reason: fmt.Sprintf("source frontend resource %q requires a dev-image build artifact", resource),
				})
				continue
			}
		}
		loadable = append(loadable, p)
	}
	return loadable, warnings, nil
}

// ValidateV0 is kept as a source-level compatibility check for callers that
// still use the old name. Runtime loadability is intentionally separate; use
// RuntimeLoadableV0 before staging hooks or serving Pack artifacts.
func ValidateV0(packs []Pack) error {
	for _, p := range packs {
		if err := Validate(p); err != nil {
			return err
		}
	}
	return nil
}

func firstRuntimeUnsupportedFrontendResource(p Pack) (string, bool, error) {
	err := fs.WalkDir(p.FS, ".", func(resource string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if resource == "." {
			return nil
		}
		first := strings.Split(resource, "/")[0]
		isAstroConfig := first == "astro.config.js" || first == "astro.config.mjs" || first == "astro.config.ts"
		if first == "pages" || first == "admin" || first == "package.json" || isAstroConfig {
			return runtimeUnsupportedFrontendResource(resource)
		}
		return nil
	})
	if err == nil {
		return "", false, nil
	}
	if resource, ok := err.(runtimeUnsupportedFrontendResource); ok {
		return string(resource), true, nil
	}
	return "", false, err
}

type runtimeUnsupportedFrontendResource string

func (e runtimeUnsupportedFrontendResource) Error() string { return string(e) }

func validSnapshotPath(resource string) bool {
	return resource == "." || (fs.ValidPath(resource) && path.Clean(resource) == resource)
}

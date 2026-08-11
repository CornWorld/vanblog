package mcp

// paths.go implements the MCP path whitelist as a pure function so it can be
// unit-tested without any IO.
//
// Security model: the admin UI / agent tooling may only read and write files
// inside two whitelisted subtrees of the repo root:
//
//   - themes/<name>/src/       (name matches ^[A-Za-z0-9_-]+$)
//   - hooks/palettes/<name>/   (name matches ^[A-Za-z0-9_-]+$)
//
// Everything else (app/, sdk/, vault/, docs/, scripts/, themes/*/app/, outside
// the root) is rejected for both read and write. When write=true, the
// write-forbidden override zones are rejected as well — mirroring the
// integration's FORBIDDEN override list so MCP can never bypass the
// fail-closed check on those subtrees.

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// themeNameRe constrains theme/palette directory names so they can never
// contain path separators or escape characters.
var themeNameRe = regexp.MustCompile(`^[A-Za-z0-9_-]+$`)

// writeForbiddenPrefixes are override zones under themes/<name>/src/ that must
// never be written by MCP tooling (control-plane / data-layer owned by vanblog),
// mirroring the integration's FORBIDDEN_OVERRIDE_PATTERNS.
//
// Entries ending with "/" are directory prefixes — they reject the directory
// itself (with or without a trailing slash) and everything beneath it
// (pages/admin/, pages/api/, lib/, loaders/).
// Entries ending with "." are filename prefixes — they reject any file whose
// name starts with the prefix (base-overrides/live.config. matches
// live.config.ts/js/mjs; base-overrides/middleware. matches middleware.ts/js).
var writeForbiddenPrefixes = []string{
	"base-overrides/pages/admin/",
	"base-overrides/pages/api/",
	"base-overrides/lib/",
	"base-overrides/loaders/",
	"base-overrides/live.config.",
	"base-overrides/middleware.",
}

// isWriteForbidden reports whether rel (which must already be inside
// themes/<name>/src/) targets a write-forbidden override zone.
func isWriteForbidden(rel, name string) bool {
	base := "themes/" + name + "/src/"
	if !strings.HasPrefix(rel, base) {
		return false
	}
	sub := rel[len(base):]
	for _, p := range writeForbiddenPrefixes {
		if strings.HasSuffix(p, "/") {
			// directory prefix: reject the directory itself (no trailing
			// slash) as well as everything beneath it.
			if sub == p[:len(p)-1] || strings.HasPrefix(sub, p) {
				return true
			}
		} else if strings.HasPrefix(sub, p) {
			// filename prefix, e.g. live.config. → live.config.ts/js/mjs.
			return true
		}
	}
	return false
}

// resolveAllowed validates rel against the MCP path whitelist and returns the
// safe absolute path under root. root should be the repository root
// (VANBLOG_MCP_ROOT or the process cwd in the dev container).
//
// rel must be relative, non-empty, and free of leading "/", ".." segments,
// backslashes and NUL bytes. The resolved path must stay inside root.
func resolveAllowed(root, rel string, write bool) (string, error) {
	if rel == "" {
		return "", fmt.Errorf("path is empty")
	}
	if strings.Contains(rel, `\`) {
		return "", fmt.Errorf("path must not contain backslash: %q", rel)
	}
	if strings.ContainsRune(rel, 0) {
		return "", fmt.Errorf("path must not contain NUL")
	}

	rel = filepath.ToSlash(rel)

	if strings.HasPrefix(rel, "/") {
		return "", fmt.Errorf("path must be relative, got %q", rel)
	}

	segments := strings.Split(rel, "/")
	for _, seg := range segments {
		switch seg {
		case "":
			return "", fmt.Errorf("path must not contain empty segments: %q", rel)
		case ".":
			return "", fmt.Errorf("path must not contain '.' segments: %q", rel)
		case "..":
			return "", fmt.Errorf("path must not contain '..' segments: %q", rel)
		}
	}

	// Identify the whitelisted subtree the rel belongs to.
	switch {
	case strings.HasPrefix(rel, "themes/"):
		if len(segments) < 3 {
			return "", fmt.Errorf("themes path too shallow: %q", rel)
		}
		name := segments[1]
		if !themeNameRe.MatchString(name) {
			return "", fmt.Errorf("invalid theme name %q in path %q", name, rel)
		}
		if segments[2] != "src" {
			return "", fmt.Errorf("only themes/<name>/src is allowed, got %q", rel)
		}
		if write && isWriteForbidden(rel, name) {
			return "", fmt.Errorf("write to forbidden override zone is not allowed: %q", rel)
		}

	case strings.HasPrefix(rel, "hooks/palettes/"):
		if len(segments) < 3 {
			return "", fmt.Errorf("palette path too shallow: %q", rel)
		}
		name := segments[2]
		if !themeNameRe.MatchString(name) {
			return "", fmt.Errorf("invalid palette name %q in path %q", name, rel)
		}

	default:
		return "", fmt.Errorf("path outside whitelist (themes/<name>/src or hooks/palettes/<name> required): %q", rel)
	}

	// Defense in depth: ensure the resolved absolute path stays inside root.
	absRoot, err := filepath.Abs(root)
	if err != nil {
		return "", fmt.Errorf("cannot resolve root %q: %w", root, err)
	}
	abs := filepath.Join(absRoot, filepath.FromSlash(rel))
	relToRoot, err := filepath.Rel(absRoot, abs)
	if err != nil {
		return "", fmt.Errorf("cannot resolve path under root: %w", err)
	}
	if relToRoot == ".." || strings.HasPrefix(relToRoot, ".."+string(filepath.Separator)) {
		return "", fmt.Errorf("path escapes root: %q", rel)
	}
	return abs, nil
}

// guardSymlink is a defense-in-depth check: resolveAllowed only validates the
// path lexically, but the actual IO calls (Open/ReadDir/MkdirAll/WriteFile)
// follow symlinks. This helper verifies that abs — already validated to be
// lexically under root — does not resolve, through any symlink, to a location
// outside root.
//
//   - forWrite=false (read/list): the target must already exist; EvalSymlinks
//     resolves the full path (including the final component) and the result
//     must stay under root.
//   - forWrite=true (write): the target may not exist yet; walk up to the
//     deepest existing ancestor, EvalSymlinks it and verify it stays under
//     root (guards against a symlinked parent directory).
func guardSymlink(root, abs string, forWrite bool) error {
	absRoot, err := filepath.Abs(root)
	if err != nil {
		return fmt.Errorf("cannot resolve root %q: %w", root, err)
	}
	// Resolve the root itself too, so a symlinked prefix (e.g. /var on macOS
	// resolves to /private/var) doesn't cause false rejections of otherwise
	// safe in-root paths.
	resolvedRoot, err := filepath.EvalSymlinks(absRoot)
	if err != nil {
		return fmt.Errorf("cannot resolve root %q: %w", absRoot, err)
	}

	probe := abs
	if !forWrite {
		// read/list: the target must exist for the full-path resolution to
		// be meaningful (missing files are surfaced as 404 by the handler).
		if _, err := os.Lstat(abs); err != nil {
			return err
		}
	} else {
		// write: resolve the deepest existing ancestor so a symlinked parent
		// directory is caught even when the final component does not exist yet.
		for {
			if _, err := os.Lstat(probe); err == nil {
				break
			}
			parent := filepath.Dir(probe)
			if parent == probe {
				return fmt.Errorf("no existing ancestor of %q to resolve", abs)
			}
			probe = parent
		}
	}

	resolved, err := filepath.EvalSymlinks(probe)
	if err != nil {
		return err
	}

	relToRoot, err := filepath.Rel(resolvedRoot, resolved)
	if err != nil {
		return fmt.Errorf("cannot resolve path under root: %w", err)
	}
	if relToRoot == ".." || strings.HasPrefix(relToRoot, ".."+string(filepath.Separator)) {
		return fmt.Errorf("path escapes root: %q", abs)
	}
	return nil
}

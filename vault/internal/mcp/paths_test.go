package mcp

import (
	"os"
	"path/filepath"
	"testing"
)

// TestResolveAllowed exercises the pure path-whitelist function.
//
// root is absolute ("/repo") so filepath.Abs is deterministic and the test
// does not depend on the process working directory.
func TestResolveAllowed(t *testing.T) {
	const root = "/repo"

	tests := []struct {
		name  string
		rel   string
		write bool
		want  string // expected resolved abs path; "" means the call must error
	}{
		// normal reads
		{
			name: "normal read theme src page",
			rel:  "themes/vanblog/src/pages/index.astro",
			want: "/repo/themes/vanblog/src/pages/index.astro",
		},
		{
			name: "normal read palette token",
			rel:  "hooks/palettes/catppuccin/tokens.css",
			want: "/repo/hooks/palettes/catppuccin/tokens.css",
		},
		{
			name: "read write-forbidden zone allowed",
			rel:  "themes/vanblog/src/base-overrides/pages/admin/settings.astro",
			want: "/repo/themes/vanblog/src/base-overrides/pages/admin/settings.astro",
		},

		// normal writes
		{
			name:  "normal write theme override",
			rel:   "themes/vanblog/src/base-overrides/layouts/BaseLayout.astro",
			write: true,
			want:  "/repo/themes/vanblog/src/base-overrides/layouts/BaseLayout.astro",
		},
		{
			name:  "palette write allowed",
			rel:   "hooks/palettes/my-palette/components.css",
			write: true,
			want:  "/repo/hooks/palettes/my-palette/components.css",
		},

		// escapes / shape violations
		{
			name: "dotdot escape from root",
			rel:  "../app/src/layouts/BaseLayout.astro",
			want: "",
		},
		{
			name: "dotdot segment in middle",
			rel:  "themes/vanblog/src/../../sdk/src/index.ts",
			want: "",
		},
		{
			name: "absolute path",
			rel:  "/etc/passwd",
			want: "",
		},
		{
			name: "empty path",
			rel:  "",
			want: "",
		},
		{
			name: "backslash path",
			rel:  `themes\vanblog\src\index.astro`,
			want: "",
		},
		{
			name: "empty segment",
			rel:  "themes//vanblog/src/x",
			want: "",
		},
		{
			name: "themes too shallow",
			rel:  "themes/vanblog",
			want: "",
		},

		// theme name grammar
		{
			name: "bad theme name contains slash",
			rel:  "themes/a/b/src/pages/x.astro",
			want: "",
		},
		{
			name: "theme app subtree denied",
			rel:  "themes/vanblog/app/entry.mjs",
			want: "",
		},
		{
			name: "theme dist denied",
			rel:  "themes/vanblog/dist/server/entry.mjs",
			want: "",
		},

		// reserved top-level dirs
		{
			name: "app denied read",
			rel:  "app/src/layouts/BaseLayout.astro",
			want: "",
		},
		{
			name: "sdk denied read",
			rel:  "sdk/src/index.ts",
			want: "",
		},
		{
			name:  "sdk denied write",
			rel:   "sdk/src/index.ts",
			write: true,
			want:  "",
		},
		{
			name: "vault denied",
			rel:  "vault/internal/mcp/mcp.go",
			want: "",
		},
		{
			name: "docs denied",
			rel:  "docs/theme-implementer-guide.md",
			want: "",
		},
		{
			name: "scripts denied",
			rel:  "scripts/check/override-check.mjs",
			want: "",
		},

		// write-forbidden override zones (write only)
		{
			name:  "write base-overrides/pages/admin forbidden",
			rel:   "themes/vanblog/src/base-overrides/pages/admin/foo.astro",
			write: true,
			want:  "",
		},
		{
			name:  "write base-overrides/pages/api forbidden",
			rel:   "themes/vanblog/src/base-overrides/pages/api/revalidate.ts",
			write: true,
			want:  "",
		},
		{
			name:  "write base-overrides/lib forbidden",
			rel:   "themes/vanblog/src/base-overrides/lib/markdown.ts",
			write: true,
			want:  "",
		},
		{
			name:  "write base-overrides/loaders forbidden",
			rel:   "themes/vanblog/src/base-overrides/loaders/posts.ts",
			write: true,
			want:  "",
		},
		{
			// read of the same zone must still be allowed
			name: "read base-overrides/loaders allowed",
			rel:  "themes/vanblog/src/base-overrides/loaders/posts.ts",
			want: "/repo/themes/vanblog/src/base-overrides/loaders/posts.ts",
		},

		// write-forbidden filename prefixes (mirror FORBIDDEN_OVERRIDE_PATTERNS)
		{
			name:  "write base-overrides/live.config.ts forbidden",
			rel:   "themes/vanblog/src/base-overrides/live.config.ts",
			write: true,
			want:  "",
		},
		{
			name:  "write base-overrides/live.config.mjs forbidden",
			rel:   "themes/vanblog/src/base-overrides/live.config.mjs",
			write: true,
			want:  "",
		},
		{
			name:  "write base-overrides/middleware.ts forbidden",
			rel:   "themes/vanblog/src/base-overrides/middleware.ts",
			write: true,
			want:  "",
		},
		{
			name:  "write base-overrides/middleware.js forbidden",
			rel:   "themes/vanblog/src/base-overrides/middleware.js",
			write: true,
			want:  "",
		},
		// exact directory name, no trailing slash — must still be rejected
		{
			name:  "write exact dir base-overrides/pages/admin no trailing slash forbidden",
			rel:   "themes/vanblog/src/base-overrides/pages/admin",
			write: true,
			want:  "",
		},
		{
			name:  "write exact dir base-overrides/lib no trailing slash forbidden",
			rel:   "themes/vanblog/src/base-overrides/lib",
			write: true,
			want:  "",
		},
		// reads of the new forbidden zones remain allowed
		{
			name: "read base-overrides/live.config.ts allowed",
			rel:  "themes/vanblog/src/base-overrides/live.config.ts",
			want: "/repo/themes/vanblog/src/base-overrides/live.config.ts",
		},
		{
			name: "read exact dir base-overrides/pages/admin no trailing slash allowed",
			rel:  "themes/vanblog/src/base-overrides/pages/admin",
			want: "/repo/themes/vanblog/src/base-overrides/pages/admin",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := resolveAllowed(root, tc.rel, tc.write)
			if tc.want == "" {
				if err == nil {
					t.Fatalf("resolveAllowed(%q, write=%v) = %q, want error", tc.rel, tc.write, got)
				}
				return
			}
			if err != nil {
				t.Fatalf("resolveAllowed(%q, write=%v) unexpected error: %v", tc.rel, tc.write, err)
			}
			if got != tc.want {
				t.Fatalf("resolveAllowed(%q, write=%v) = %q, want %q", tc.rel, tc.write, got, tc.want)
			}
		})
	}
}

// TestGuardSymlink exercises the symlink-escape defense-in-depth helper using
// real temp directories and symlinks.
func TestGuardSymlink(t *testing.T) {
	t.Run("read rejects symlink escaping root", func(t *testing.T) {
		root := t.TempDir()
		outside := filepath.Join(t.TempDir(), "secret.txt")
		if err := os.WriteFile(outside, []byte("secret"), 0o644); err != nil {
			t.Fatal(err)
		}
		dir := filepath.Join(root, "themes", "vanblog", "src")
		if err := os.MkdirAll(dir, 0o755); err != nil {
			t.Fatal(err)
		}
		link := filepath.Join(dir, "leak.txt")
		if err := os.Symlink(outside, link); err != nil {
			t.Fatal(err)
		}
		if err := guardSymlink(root, link, false); err == nil {
			t.Fatal("expected guardSymlink to reject a symlink escaping root")
		}
	})

	t.Run("read allows symlink inside root", func(t *testing.T) {
		root := t.TempDir()
		target := filepath.Join(root, "themes", "vanblog", "src", "real.txt")
		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(target, []byte("ok"), 0o644); err != nil {
			t.Fatal(err)
		}
		link := filepath.Join(root, "themes", "vanblog", "src", "alias.txt")
		if err := os.Symlink(target, link); err != nil {
			t.Fatal(err)
		}
		if err := guardSymlink(root, link, false); err != nil {
			t.Fatalf("expected guardSymlink to allow in-root symlink, got %v", err)
		}
	})

	t.Run("read missing file surfaces IsNotExist", func(t *testing.T) {
		root := t.TempDir()
		dir := filepath.Join(root, "themes", "vanblog", "src", "pages")
		if err := os.MkdirAll(dir, 0o755); err != nil {
			t.Fatal(err)
		}
		target := filepath.Join(dir, "missing.astro")
		err := guardSymlink(root, target, false)
		if err == nil {
			t.Fatal("expected error for missing file")
		}
		if !os.IsNotExist(err) {
			t.Fatalf("expected IsNotExist error, got %v", err)
		}
	})

	t.Run("write rejects symlinked parent (deepest existing ancestor)", func(t *testing.T) {
		root := t.TempDir()
		outside := t.TempDir()
		linkParent := filepath.Join(root, "themes", "vanblog", "src", "pages")
		if err := os.MkdirAll(filepath.Dir(linkParent), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.Symlink(outside, linkParent); err != nil {
			t.Fatal(err)
		}
		target := filepath.Join(linkParent, "new.ts") // does not exist yet
		if err := guardSymlink(root, target, true); err == nil {
			t.Fatal("expected guardSymlink to reject write under a symlinked parent")
		}
	})

	t.Run("write allows missing target under real dir", func(t *testing.T) {
		root := t.TempDir()
		dir := filepath.Join(root, "themes", "vanblog", "src", "components")
		if err := os.MkdirAll(dir, 0o755); err != nil {
			t.Fatal(err)
		}
		target := filepath.Join(dir, "new.astro") // does not exist yet
		if err := guardSymlink(root, target, true); err != nil {
			t.Fatalf("expected guardSymlink to allow write to missing target under real dir, got %v", err)
		}
	})

	t.Run("write rejects existing symlink target escaping root", func(t *testing.T) {
		root := t.TempDir()
		outside := filepath.Join(t.TempDir(), "secret.txt")
		if err := os.WriteFile(outside, []byte("secret"), 0o644); err != nil {
			t.Fatal(err)
		}
		dir := filepath.Join(root, "themes", "vanblog", "src")
		if err := os.MkdirAll(dir, 0o755); err != nil {
			t.Fatal(err)
		}
		link := filepath.Join(dir, "overwrite.txt")
		if err := os.Symlink(outside, link); err != nil {
			t.Fatal(err)
		}
		// overwriting the symlink itself would follow it to the outside file
		if err := guardSymlink(root, link, true); err == nil {
			t.Fatal("expected guardSymlink to reject overwrite of an escaping symlink")
		}
	})
}

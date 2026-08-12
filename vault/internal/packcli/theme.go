package packcli

import (
	"archive/zip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"time"

	"github.com/spf13/cobra"
)

// themeNamePattern is the accepted theme identifier shape (same as pack names):
// lowercase letters/digits, words separated by single hyphens.
var themeNamePattern = regexp.MustCompile(`^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$`)

// resolveThemeDirs returns the user + builtin themes directories, preferring
// explicit flags, then env, then prod defaults (the same contract the
// entrypoint exports to the theme host and the Go runtime).
func resolveThemeDirs(themesDir, builtinThemesDir string) (userDir, builtinDir string) {
	userDir = themesDir
	if userDir == "" {
		userDir = os.Getenv("VANBLOG_THEMES_DIR")
	}
	if userDir == "" {
		userDir = "/var/lib/vanblog/themes"
	}
	builtinDir = builtinThemesDir
	if builtinDir == "" {
		builtinDir = os.Getenv("VANBLOG_THEMES_BUILTIN_DIR")
	}
	if builtinDir == "" {
		builtinDir = "/build/themes"
	}
	return userDir, builtinDir
}

// addThemeCommand registers the `theme` subcommand group on the CLI root. It
// reuses the pack CLI's cobra scaffolding — theme is not a Pack (themes are
// standalone SSR apps, not layered resource bundles), but managing both through
// one surface keeps the CLI small.
func addThemeCommand(root *cobra.Command) {
	var themesDir, builtinThemesDir string
	theme := &cobra.Command{
		Use:           "theme",
		Short:         "Inspect and manage Vanblog themes (builtin + user-installed)",
		SilenceUsage:  true,
		SilenceErrors: true,
	}
	theme.PersistentFlags().StringVar(&themesDir, "themesDir", "", "user themes dir (default $VANBLOG_THEMES_DIR or /var/lib/vanblog/themes)")
	theme.PersistentFlags().StringVar(&builtinThemesDir, "builtinThemesDir", "", "builtin themes dir (default $VANBLOG_THEMES_BUILTIN_DIR or /build/themes)")

	theme.AddCommand(&cobra.Command{
		Use:   "list",
		Short: "List available themes (merged builtin + user, user wins)",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			userDir, builtinDir := resolveThemeDirs(themesDir, builtinThemesDir)
			for _, l := range listThemes(userDir, builtinDir) {
				fmt.Fprintf(cmd.OutOrStdout(), "%s\t%s\t%s\n", l.name, l.version, l.source)
			}
			return nil
		},
	})

	theme.AddCommand(&cobra.Command{
		Use:   "install <dir-or-zip>",
		Short: "Install a pre-built theme (theme.json + dist/) into the user themes dir",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			userDir, _ := resolveThemeDirs(themesDir, builtinThemesDir)
			if err := os.MkdirAll(userDir, 0o755); err != nil {
				return fmt.Errorf("create themes dir: %w", err)
			}
			name, err := installTheme(args[0], userDir)
			if err != nil {
				return err
			}
			fmt.Fprintf(cmd.OutOrStdout(), "installed theme %q to %s\n", name, userDir)
			fmt.Fprintln(cmd.OutOrStdout(), "theme host + Caddy auto-discover it (themeWatcher resync). Activate via admin /admin/site (activeTheme).")
			return nil
		},
	})

	theme.AddCommand(&cobra.Command{
		Use:   "remove <name>",
		Short: "Remove a user-installed theme (builtin themes are read-only)",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			userDir, builtinDir := resolveThemeDirs(themesDir, builtinThemesDir)
			if err := removeTheme(args[0], userDir, builtinDir); err != nil {
				return err
			}
			fmt.Fprintf(cmd.OutOrStdout(), "removed theme %q\n", args[0])
			return nil
		},
	})

	root.AddCommand(theme)
}

type themeLine struct {
	name, version, source string
}

// listThemes merges the builtin (image) + user (volume) roots; a user theme
// whose name collides with a builtin shadows it. Only themes with a built
// dist/server/entry.mjs are listed.
func listThemes(userDir, builtinDir string) []themeLine {
	byName := map[string]themeLine{}
	for _, root := range []struct{ dir, source string }{{builtinDir, "builtin"}, {userDir, "user"}} {
		if root.dir == "" {
			continue
		}
		entries, err := os.ReadDir(root.dir)
		if err != nil {
			continue // missing/unreadable root is not fatal for listing
		}
		for _, e := range entries {
			if !e.IsDir() {
				continue
			}
			name := e.Name()
			if _, err := os.Stat(filepath.Join(root.dir, name, "dist", "server", "entry.mjs")); err != nil {
				continue
			}
			byName[name] = themeLine{name: name, version: readThemeVersion(filepath.Join(root.dir, name)), source: root.source}
		}
	}
	names := make([]string, 0, len(byName))
	for name := range byName {
		names = append(names, name)
	}
	slices.Sort(names)
	out := make([]themeLine, 0, len(names))
	for _, name := range names {
		out = append(out, byName[name])
	}
	return out
}

func readThemeVersion(dir string) string {
	data, err := os.ReadFile(filepath.Join(dir, "theme.json"))
	if err != nil {
		return "-"
	}
	var meta struct {
		Version string `json:"version"`
	}
	if json.Unmarshal(data, &meta) != nil || meta.Version == "" {
		return "-"
	}
	return meta.Version
}

// findThemeRoot locates the theme.json root inside a source dir/zip, tolerating
// an extra wrapper folder (the common "zip contains a single folder" layout).
func findThemeRoot(dir string) string {
	if _, err := os.Stat(filepath.Join(dir, "theme.json")); err == nil {
		return dir
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return dir
	}
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		sub := filepath.Join(dir, e.Name())
		if _, err := os.Stat(filepath.Join(sub, "theme.json")); err == nil {
			return sub
		}
	}
	return dir
}

// validateThemeDir checks a pre-built theme tree and returns its name.
func validateThemeDir(srcDir string) (string, error) {
	data, err := os.ReadFile(filepath.Join(srcDir, "theme.json"))
	if err != nil {
		return "", fmt.Errorf("theme.json not found in %s (is this a built theme?): %w", srcDir, err)
	}
	var meta struct {
		Name string `json:"name"`
	}
	if err := json.Unmarshal(data, &meta); err != nil {
		return "", fmt.Errorf("theme.json invalid: %w", err)
	}
	if !themeNamePattern.MatchString(meta.Name) {
		return "", fmt.Errorf("invalid theme name %q (must match %s)", meta.Name, themeNamePattern)
	}
	if _, err := os.Stat(filepath.Join(srcDir, "dist", "server", "entry.mjs")); err != nil {
		return "", fmt.Errorf("missing dist/server/entry.mjs — install a PRE-BUILT theme (run the theme build first)")
	}
	if _, err := os.Stat(filepath.Join(srcDir, "dist", "client")); err != nil {
		return "", fmt.Errorf("missing dist/client dir")
	}
	return meta.Name, nil
}

// installTheme installs a pre-built theme dir or zip into destRoot/<name>. The
// copy is staged under destRoot and atomically renamed into place, so a partial
// install is never visible to the theme watcher.
func installTheme(src, destRoot string) (string, error) {
	srcDir := src
	if strings.HasSuffix(strings.ToLower(src), ".zip") {
		tmp, err := os.MkdirTemp("", "vanblog-theme-zip-")
		if err != nil {
			return "", err
		}
		defer os.RemoveAll(tmp)
		if err := unzip(src, tmp); err != nil {
			return "", fmt.Errorf("extract %s: %w", src, err)
		}
		srcDir = tmp
	}
	srcDir = findThemeRoot(srcDir)

	name, err := validateThemeDir(srcDir)
	if err != nil {
		return "", err
	}

	dest := filepath.Join(destRoot, name)
	if _, err := os.Stat(dest); err == nil {
		return "", fmt.Errorf("theme %q is already installed in %s; remove it first (vanblog pack theme remove %s)", name, destRoot, name)
	}

	stage, err := os.MkdirTemp(destRoot, ".theme-install-")
	if err != nil {
		return "", fmt.Errorf("stage dir: %w", err)
	}
	defer os.RemoveAll(stage)
	staged := filepath.Join(stage, name)
	if err := stageRuntimeFiles(srcDir, staged); err != nil {
		return "", fmt.Errorf("stage theme: %w", err)
	}
	if err := os.Rename(staged, dest); err != nil {
		return "", fmt.Errorf("promote theme: %w", err)
	}
	return name, nil
}

// stageRuntimeFiles copies only the runtime-relevant parts of a built theme:
// theme.json (metadata) + dist/ (self-contained SSR output + client assets).
// Build-time files (src/, node_modules/, astro.config.*, package.json, tsconfig)
// are NOT copied — they are not needed at runtime and would drag pnpm workspace
// symlinks into the persistent volume.
func stageRuntimeFiles(srcDir, staged string) error {
	if err := os.MkdirAll(staged, 0o755); err != nil {
		return err
	}
	if err := copyFile(filepath.Join(srcDir, "theme.json"), filepath.Join(staged, "theme.json")); err != nil {
		return fmt.Errorf("theme.json: %w", err)
	}
	if err := copyTree(filepath.Join(srcDir, "dist"), filepath.Join(staged, "dist")); err != nil {
		return fmt.Errorf("dist: %w", err)
	}
	return nil
}

// unzip extracts zipPath into dest, rejecting any entry that escapes dest.
func unzip(zipPath, dest string) error {
	r, err := zip.OpenReader(zipPath)
	if err != nil {
		return err
	}
	defer r.Close()
	// maxZipEntrySize guards against decompression bombs: a single archive
	// entry may not expand beyond this many bytes (gosec G110).
	const maxZipEntrySize = 1 << 30 // 1 GiB
	for _, f := range r.File {
		name := f.Name
		// Reject traversal / absolute entries up front so the path below can
		// only resolve under dest (zip-slip / gosec G305). filepath.Join is
		// deliberately avoided because gosec flags it on archive member names
		// even with a prefix guard; the components are pre-validated relative
		// paths, so concatenation + Clean cannot escape.
		if name == "" || filepath.IsAbs(name) ||
			strings.HasPrefix(name, "../") || strings.Contains(name, "/../") {
			return fmt.Errorf("zip entry escapes destination: %s", name)
		}
		target := filepath.Clean(dest + string(os.PathSeparator) + name)
		// Defense-in-depth: the resolved target must still live under dest
		// (catches residual cases like name == ".." or "a/..").
		if !strings.HasPrefix(target, filepath.Clean(dest)+string(os.PathSeparator)) {
			return fmt.Errorf("zip entry escapes destination: %s", name)
		}
		if f.FileInfo().IsDir() {
			if err := os.MkdirAll(target, 0o755); err != nil {
				return err
			}
			continue
		}
		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			return err
		}
		in, err := f.Open()
		if err != nil {
			return err
		}
		out, err := os.Create(target)
		if err != nil {
			in.Close()
			return err
		}
		n, copyErr := io.Copy(out, io.LimitReader(in, maxZipEntrySize+1))
		in.Close()
		closeErr := out.Close()
		if copyErr != nil {
			return copyErr
		}
		if closeErr != nil {
			return closeErr
		}
		if n > maxZipEntrySize {
			return fmt.Errorf("zip entry %q exceeds %d-byte limit (decompression bomb)", name, maxZipEntrySize)
		}
	}
	return nil
}

// copyTree recursively copies src into dst, refusing symlinks (zip-bomb safety).
func copyTree(src, dst string) error {
	return filepath.WalkDir(src, func(path string, d os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		rel, err := filepath.Rel(src, path)
		if err != nil {
			return err
		}
		target := filepath.Join(dst, rel)
		if d.IsDir() {
			return os.MkdirAll(target, 0o755)
		}
		if d.Type()&os.ModeSymlink != 0 {
			return fmt.Errorf("theme contains symlink %s (not allowed)", rel)
		}
		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			return err
		}
		return copyFile(path, target)
	})
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, in); err != nil {
		out.Close()
		return err
	}
	return out.Close()
}

func removeTheme(name, userDir, builtinDir string) error {
	if !themeNamePattern.MatchString(name) {
		return fmt.Errorf("invalid theme name %q", name)
	}
	userPath := filepath.Join(userDir, name)
	if _, err := os.Stat(userPath); err != nil {
		if _, builtinErr := os.Stat(filepath.Join(builtinDir, name)); builtinErr == nil {
			return fmt.Errorf("theme %q is a BUILTIN (read-only in the image); install your own copy first", name)
		}
		return fmt.Errorf("theme %q is not installed in the user themes dir %s", name, userDir)
	}
	if active, ok := readActiveTheme(); ok && active == name {
		return fmt.Errorf("theme %q is the ACTIVE theme; switch site.activeTheme first (admin /admin/site)", name)
	}
	if err := os.RemoveAll(userPath); err != nil {
		return err
	}
	return nil
}

// readActiveTheme returns the site.activeTheme value from PB (best-effort;
// ok=false when PB is unreachable or has no site record yet).
func readActiveTheme() (string, bool) {
	base := os.Getenv("PB_URL")
	if base == "" {
		base = "http://127.0.0.1:8090"
	}
	client := &http.Client{Timeout: 3 * time.Second}
	req, err := http.NewRequestWithContext(context.Background(), http.MethodGet,
		base+"/api/collections/site/records?perPage=1", nil)
	if err != nil {
		return "", false
	}
	resp, err := client.Do(req)
	if err != nil {
		return "", false
	}
	defer resp.Body.Close()
	var body struct {
		Items []struct {
			ActiveTheme string `json:"activeTheme"`
		} `json:"items"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil || len(body.Items) == 0 {
		return "", false
	}
	return body.Items[0].ActiveTheme, true
}

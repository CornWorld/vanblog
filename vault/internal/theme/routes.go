package theme

import (
	"cmp"
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"slices"

	"github.com/pocketbase/pocketbase/core"
)

// themeNamePattern is the accepted theme identifier shape — the same contract
// the pack CLI enforces (vault/internal/packcli/theme.go). ResolveDir validates
// names against it before probing the filesystem, so a name containing path
// separators or ".." segments can never escape the themes roots.
var themeNamePattern = regexp.MustCompile(`^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$`)

// New registers theme enumeration route on the PB server.
func New(app core.App) {
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		se.Router.GET("/api/themes", serveThemes)
		return se.Next()
	})
}

// roots returns the [builtin, user] themes directories in merge order — user is
// last so a name collision resolves in its favour. Defaults mirror the
// entrypoint env (VANBLOG_THEMES_DIR / VANBLOG_THEMES_BUILTIN_DIR).
func roots() []string {
	user := os.Getenv("VANBLOG_THEMES_DIR")
	if user == "" {
		user = "/var/lib/vanblog/themes"
	}
	builtin := os.Getenv("VANBLOG_THEMES_BUILTIN_DIR")
	if builtin == "" {
		builtin = "/build/themes"
	}
	return []string{builtin, user}
}

// ResolveDir returns the directory holding the named theme (user wins), or ""
// when the theme is absent from both roots. Shared by the theme and palette
// routes so recommendedPalette reads the same merged view as /api/themes.
func ResolveDir(name string) string {
	if name == "" || !themeNamePattern.MatchString(name) {
		return ""
	}
	// User root wins on a name collision, so scan roots() (=[builtin, user]) in
	// reverse — this keeps the merge precedence identical to serveThemes, the
	// theme host (core.mjs) and Caddy's buildStaticRoutes.
	dirs := roots()
	for i := len(dirs) - 1; i >= 0; i-- {
		dir := filepath.Join(dirs[i], name)
		if _, err := os.Stat(filepath.Join(dir, "theme.json")); err == nil {
			return dir
		}
	}
	return ""
}

func serveThemes(e *core.RequestEvent) error {
	// Merge builtin (image, read-only) + user (volume) themes; a user theme
	// whose name collides with a builtin shadows it. Only themes that have a
	// built dist/server/entry.mjs count as installable.
	dirByName := map[string]string{}
	for _, root := range roots() {
		entries, err := os.ReadDir(root)
		if err != nil {
			slog.Warn("[theme] cannot list themes dir", "dir", root, "err", err)
			continue
		}
		for _, entry := range entries {
			if !entry.IsDir() {
				continue
			}
			if _, err := os.Stat(filepath.Join(root, entry.Name(), "dist", "server", "entry.mjs")); err != nil {
				continue
			}
			dirByName[entry.Name()] = filepath.Join(root, entry.Name()) // user (2nd) wins
		}
	}

	type themeMeta struct {
		Name                 string `json:"name"`
		Label                string `json:"label,omitempty"`
		Version              string `json:"version,omitempty"`
		Author               string `json:"author,omitempty"`
		Description          string `json:"description,omitempty"`
		Screenshot           string `json:"screenshot,omitempty"`
		RecommendedPalette   string `json:"recommendedPalette,omitempty"`
		PaletteMigrationMode string `json:"paletteMigrationMode,omitempty"`
	}

	var themes []themeMeta
	for name, dir := range dirByName {
		meta := themeMeta{Name: name}
		jsonPath := filepath.Join(dir, "theme.json")
		if data, err := os.ReadFile(jsonPath); err == nil {
			var raw map[string]any
			if json.Unmarshal(data, &raw) == nil {
				if v, ok := raw["label"].(string); ok {
					meta.Label = v
				}
				if v, ok := raw["version"].(string); ok {
					meta.Version = v
				}
				if v, ok := raw["author"].(string); ok {
					meta.Author = v
				}
				if v, ok := raw["description"].(string); ok {
					meta.Description = v
				}
				if v, ok := raw["screenshot"].(string); ok {
					meta.Screenshot = v
				}
				if v, ok := raw["recommendedPalette"].(string); ok {
					meta.RecommendedPalette = v
				}
				if v, ok := raw["paletteMigrationMode"].(string); ok {
					meta.PaletteMigrationMode = v
				}
			}
		}
		themes = append(themes, meta)
	}

	slices.SortFunc(themes, func(a, b themeMeta) int { return cmp.Compare(a.Name, b.Name) })

	return e.JSON(http.StatusOK, map[string]any{"themes": themes})
}

package theme

import (
	"cmp"
	"database/sql"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"time"

	"github.com/pocketbase/pocketbase/core"

	"github.com/cornworld/vanblog/internal/article"
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
		se.Router.GET("/api/vanblog/theme-settings/{theme}", serveThemeSettings)
		se.Router.PUT("/api/vanblog/theme-settings/{theme}", handleSaveThemeSettings)
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
		if _, err := os.Stat(filepath.Join(dir, "theme.json")); err != nil {
			continue
		}
		// Only resolve themes that are actually runnable — the same criterion
		// serveThemes and the theme host (core.mjs resolveThemeDir) use, so a
		// partial user dir (theme.json without a built dist) never shadows a
		// builtin for recommendedPalette.
		if _, err := os.Stat(filepath.Join(dir, "dist", "server", "entry.mjs")); err == nil {
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
			// Same name contract as the pack CLI and ResolveDir, so the merged
			// view never surfaces a theme that cannot be resolved/installed.
			if !themeNamePattern.MatchString(entry.Name()) {
				continue
			}
			if _, err := os.Stat(filepath.Join(root, entry.Name(), "dist", "server", "entry.mjs")); err != nil {
				continue
			}
			dirByName[entry.Name()] = filepath.Join(root, entry.Name()) // user (2nd) wins
		}
	}

	type themeMeta struct {
		Name                 string                 `json:"name"`
		Label                string                 `json:"label,omitempty"`
		Version              string                 `json:"version,omitempty"`
		Author               string                 `json:"author,omitempty"`
		Description          string                 `json:"description,omitempty"`
		Screenshot           string                 `json:"screenshot,omitempty"`
		RecommendedPalette   string                 `json:"recommendedPalette,omitempty"`
		PaletteMigrationMode string                 `json:"paletteMigrationMode,omitempty"`
		Settings             map[string]SettingSpec `json:"settings,omitempty"`
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
		meta.Settings = ReadSettingsSchema(dir)
		themes = append(themes, meta)
	}

	slices.SortFunc(themes, func(a, b themeMeta) int { return cmp.Compare(a.Name, b.Name) })

	return e.JSON(http.StatusOK, map[string]any{"themes": themes})
}

// serveThemeSettings returns the theme's MERGED settings (schema defaults,
// then the stored row overlaid) so SSR consumers never need the schema: the
// row is full-merged at write time and defaults are overlaid again here for
// themes that gained new keys since the last save. Anonymous + 10s cache —
// same shape as the pack-frontend manifest.
func serveThemeSettings(e *core.RequestEvent) error {
	name := e.Request.PathValue("theme")
	dir := ResolveDir(name)
	if dir == "" {
		return e.NotFoundError("theme not found", "")
	}
	values, err := storedSettingsValues(e.App, name)
	if err != nil {
		return e.Error(http.StatusInternalServerError, err.Error(), "")
	}
	merged := MergeSettings(ReadSettingsSchema(dir), values)
	e.Response.Header().Set("Cache-Control", "public, max-age=10")
	return e.JSON(http.StatusOK, map[string]any{"theme": name, "values": merged})
}

// handleSaveThemeSettings validates the incoming values against the theme's
// declared schema and upserts the full-merged row. Admin-only. Follows the
// custom-code pattern: the revalidate is scheduled past the middleware's
// settings cache window so the next render observes the new values.
func handleSaveThemeSettings(e *core.RequestEvent) error {
	if e.Auth == nil || e.Auth.GetString("role") != "admin" {
		return e.ForbiddenError("admin role required", "")
	}
	name := e.Request.PathValue("theme")
	dir := ResolveDir(name)
	if dir == "" {
		return e.NotFoundError("theme not found", "")
	}
	var body struct {
		Values map[string]any `json:"values"`
	}
	if err := e.BindBody(&body); err != nil || body.Values == nil {
		return e.BadRequestError("body must be {\"values\": {...}}", "")
	}
	schema := ReadSettingsSchema(dir)
	validated, err := ValidateSettingsValues(schema, body.Values)
	if err != nil {
		return e.BadRequestError(err.Error(), "")
	}
	stored, err := storedSettingsValues(e.App, name)
	if err != nil {
		return e.Error(http.StatusInternalServerError, err.Error(), "")
	}
	merged := MergeSettings(schema, stored, validated)

	col, err := e.App.FindCachedCollectionByNameOrId("theme_settings")
	if err != nil {
		return e.Error(http.StatusInternalServerError, err.Error(), "")
	}
	// The theme name is regex-validated ([a-z][a-z0-9-]*) so it cannot
	// break out of the quoted filter literal.
	row, err := e.App.FindFirstRecordByFilter("theme_settings", "theme='"+name+"'")
	if err != nil {
		row = core.NewRecord(col)
		row.Set("theme", name)
	}
	row.Set("values", merged)
	if err := e.App.Save(row); err != nil {
		return e.Error(http.StatusInternalServerError, err.Error(), "")
	}

	time.AfterFunc(12*time.Second, func() {
		article.RevalidateCache(e.App, []string{"posts", "home"})
	})
	return e.JSON(http.StatusOK, map[string]any{"theme": name, "values": merged})
}

// storedSettingsValues reads the theme's persisted row (empty map when the
// theme was never configured). ResolveDir-style name validation happens in
// the callers.
func storedSettingsValues(app core.App, name string) (map[string]any, error) {
	row, err := app.FindFirstRecordByFilter("theme_settings", "theme='"+name+"'")
	if err != nil {
		if !errors.Is(err, sql.ErrNoRows) {
			return nil, err // real lookup failure — do not mask as "unset"
		}
		return map[string]any{}, nil // no row yet
	}
	values := map[string]any{}
	if err := row.UnmarshalJSONField("values", &values); err == nil {
		return filterStoredValues(values), nil
	}
	// Malformed row falls back to defaults only — the merged GET response is
	// advisory and one bad row must not take the theme's settings page down.
	return map[string]any{}, nil
}

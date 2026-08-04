package palette

import (
	"cmp"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"slices"

	"github.com/pocketbase/pocketbase/core"
)

// New registers palette-related routes on the PB server.
func New(app core.App) {
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		se.Router.GET("/api/palettes", servePalettes)
		se.Router.GET("/api/palette.css", servePaletteCSS(app))
		return se.Next()
	})
}

func servePalettes(e *core.RequestEvent) error {
	root := os.Getenv("VANBLOG_PALETTES_DIR")
	if root == "" {
		root = "/build/hooks/palettes"
	}

	entries, err := os.ReadDir(root)
	if err != nil {
		return e.JSON(http.StatusOK, map[string]any{"palettes": []any{}})
	}

	type paletteMeta struct {
		Name    string `json:"name"`
		Label   string `json:"label,omitempty"`
		Version string `json:"version,omitempty"`
		Type    string `json:"type,omitempty"` // "dark" | "light" (atomic palette light/dark category)
	}

	var palettes []paletteMeta
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		meta := paletteMeta{Name: entry.Name()}
		jsonPath := filepath.Join(root, entry.Name(), "palette.json")
		if data, err := os.ReadFile(jsonPath); err == nil {
			var raw map[string]any
			if json.Unmarshal(data, &raw) == nil {
				if v, ok := raw["label"].(string); ok {
					meta.Label = v
				}
				if v, ok := raw["version"].(string); ok {
					meta.Version = v
				}
				if v, ok := raw["type"].(string); ok {
					meta.Type = v
				}
			}
		}
		palettes = append(palettes, meta)
	}

	slices.SortFunc(palettes, func(a, b paletteMeta) int { return cmp.Compare(a.Name, b.Name) })

	return e.JSON(http.StatusOK, map[string]any{"palettes": palettes})
}

func servePaletteCSS(app core.App) func(*core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		// User-level override via ?name= (persisted in localStorage by the SDK);
		// otherwise fall back to the site.palette, then to the active theme's
		// recommendedPalette from its theme.json.
		paletteName := e.Request.URL.Query().Get("name")
		if paletteName == "" {
			records, err := app.FindRecordsByFilter("site", "1=1", "", 1, 0)
			if err != nil || len(records) == 0 {
				return e.String(http.StatusOK, "/* no site config */")
			}
			rec := records[0]
			paletteName = rec.GetString("palette")
			if paletteName == "" {
				paletteName = readRecommendedPalette(rec.GetString("activeTheme"))
			}
		}
		if paletteName == "" {
			return e.String(http.StatusOK, "/* no palette configured */")
		}

		root := os.Getenv("VANBLOG_PALETTES_DIR")
		if root == "" {
			root = "/build/hooks/palettes"
		}
		paletteDir := filepath.Join(root, paletteName)

		// Concatenate tokens.css + typography.css + components.css
		var result []byte
		for _, name := range []string{"tokens.css", "typography.css", "components.css"} {
			data, err := os.ReadFile(filepath.Join(paletteDir, name))
			if err != nil {
				continue // skip missing files
			}
			result = append(result, data...)
			result = append(result, '\n')
		}
		return e.Blob(http.StatusOK, "text/css; charset=utf-8", result)
	}
}

// readRecommendedPalette returns the active theme's recommendedPalette from its
// theme.json (VANBLOG_THEMES_DIR or /var/lib/vanblog/themes). Empty on any error.
func readRecommendedPalette(activeTheme string) string {
	if activeTheme == "" {
		return ""
	}
	root := os.Getenv("VANBLOG_THEMES_DIR")
	if root == "" {
		root = "/var/lib/vanblog/themes"
	}
	data, err := os.ReadFile(filepath.Join(root, activeTheme, "theme.json"))
	if err != nil {
		return ""
	}
	var raw map[string]any
	if json.Unmarshal(data, &raw) != nil {
		return ""
	}
	if v, ok := raw["recommendedPalette"].(string); ok {
		return v
	}
	return ""
}

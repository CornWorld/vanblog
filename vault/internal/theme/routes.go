package theme

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"sort"

	"github.com/pocketbase/pocketbase/core"
)

// New registers theme enumeration route on the PB server.
func New(app core.App) {
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		se.Router.GET("/api/themes", serveThemes)
		return se.Next()
	})
}

func serveThemes(e *core.RequestEvent) error {
	root := os.Getenv("VANBLOG_THEMES_DIR")
	if root == "" {
		root = "/var/lib/vanblog/themes"
	}

	entries, err := os.ReadDir(root)
	if err != nil {
		return e.JSON(http.StatusOK, map[string]any{"themes": []any{}})
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
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		// Only include themes that have dist/server/entry.mjs
		if _, err := os.Stat(filepath.Join(root, entry.Name(), "dist", "server", "entry.mjs")); err != nil {
			continue
		}
		meta := themeMeta{Name: entry.Name()}
		jsonPath := filepath.Join(root, entry.Name(), "theme.json")
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

	sort.Slice(themes, func(i, j int) bool {
		return themes[i].Name < themes[j].Name
	})

	return e.JSON(http.StatusOK, map[string]any{"themes": themes})
}

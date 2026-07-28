package palette

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"sort"

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
			}
		}
		palettes = append(palettes, meta)
	}

	sort.Slice(palettes, func(i, j int) bool {
		return palettes[i].Name < palettes[j].Name
	})

	return e.JSON(http.StatusOK, map[string]any{"palettes": palettes})
}

func servePaletteCSS(app core.App) func(*core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		// Read site.palette from DB
		records, err := app.FindRecordsByFilter("site", "1=1", "", 1, 0)
		if err != nil || len(records) == 0 {
			return e.String(http.StatusOK, "/* no site config */")
		}
		paletteName := records[0].GetString("palette")
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

//go:build ignore
package main

import (
	"fmt"
	"os"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

func main() {
	tmpDir, _ := os.MkdirTemp("", "pb-check")
	defer os.RemoveAll(tmpDir)

	app := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: tmpDir})
	app.Bootstrap()

	// List all collections
	collections, err := app.FindRecordsByFilter(
		"_collections", "", "name", 0, 0,
	)
	if err != nil {
		fmt.Printf("Error listing collections: %v\n", err)
		// Try direct query
		db := app.DB()
		rows, err := db.NewQuery("SELECT name FROM _collections").Rows()
		if err != nil {
			fmt.Printf("Direct query failed: %v\n", err)
			return
		}
		defer rows.Close()
		for rows.Next() {
			var name string
			rows.Scan(&name)
			fmt.Printf("  - %s\n", name)
		}
		return
	}
	for _, c := range collections {
		fmt.Printf("  - %s\n", c.GetString("name"))
	}

	_ = core.App(nil) // keep import
}

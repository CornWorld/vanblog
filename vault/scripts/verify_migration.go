//go:build ignore

package main

import (
	"fmt"
	"os"

	_ "github.com/cornworld/vanblog/pb_migrations"
	"github.com/pocketbase/pocketbase"
)

func main() {
	tmpDir, _ := os.MkdirTemp("", "pb-migration-verify")
	defer os.RemoveAll(tmpDir)

	app := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: tmpDir})

	if err := app.Bootstrap(); err != nil {
		fmt.Printf("Bootstrap failed: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("=== Migration verification ===")

	collections := []string{"tags", "categories", "users", "posts", "revisions",
		"media", "site", "visits", "audits", "tokens"}

	for _, name := range collections {
		col, err := app.FindCollectionByNameOrId(name)
		if err != nil {
			fmt.Printf("  ❌ %s: not found (%v)\n", name, err)
			continue
		}
		fieldCount := len(col.Fields)
		fmt.Printf("  ✅ %s: %d fields, type=%s\n", name, fieldCount, col.Type)
	}

	// Check site record
	siteRecords, _ := app.FindRecordsByFilter("site", "", "", 1, 0)
	if len(siteRecords) > 0 {
		r := siteRecords[0]
		fmt.Printf("\n  site record: theme=%s comments=%s\n",
			r.GetString("theme"), r.GetString("commentsProvider"))
	} else {
		fmt.Println("\n  ❌ no site record found")
	}

	// Test posts.tags relation
	postsCol, _ := app.FindCollectionByNameOrId("posts")
	if postsCol != nil {
		tagsField := postsCol.Fields.GetByName("tags")
		if tagsField != nil {
			fmt.Printf("  posts.tags field exists: %s\n", tagsField.GetName())
		}
	}

	fmt.Println("\n=== Done ===")
}

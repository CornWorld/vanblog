//go:build ignore
package main

import (
	"fmt"
	"os"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"

	_ "github.com/cornworld/vanblog/pb_migrations"
)

func main() {
	tmpDir, _ := os.MkdirTemp("", "pb-mig3")
	defer os.RemoveAll(tmpDir)

	app := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: tmpDir})

	if err := app.Bootstrap(); err != nil {
		fmt.Printf("Bootstrap failed: %v\n", err)
		os.Exit(1)
	}

	// Manually run app migrations
	if err := app.RunAppMigrations(); err != nil {
		fmt.Printf("RunAppMigrations failed: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("=== Migration verification ===")
	for _, name := range []string{"tags", "categories", "users", "posts", "revisions", "media", "site", "visits", "audits", "tokens"} {
		col, err := app.FindCollectionByNameOrId(name)
		if err != nil {
			fmt.Printf("  ❌ %s: %v\n", name, err)
		} else {
			fmt.Printf("  ✅ %s (%d fields, type=%s)\n", name, len(col.Fields), col.Type)
		}
	}

	// Check site record
	siteRecords, _ := app.FindRecordsByFilter("site", "", "", 1, 0)
	if len(siteRecords) > 0 {
		r := siteRecords[0]
		fmt.Printf("\n  site record: theme=%s comments=%s\n",
			r.GetString("theme"), r.GetString("commentsProvider"))
	} else {
		fmt.Println("\n  ❌ no site record")
	}

	_ = core.App(nil)
}

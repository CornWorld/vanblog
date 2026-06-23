//go:build ignore

package main

import (
	"fmt"
	"os"

	_ "github.com/cornworld/vanblog/pb_migrations"
	"github.com/pocketbase/pocketbase"
)

func main() {
	tmpDir, _ := os.MkdirTemp("", "pb-mig-debug")
	defer os.RemoveAll(tmpDir)

	app := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: tmpDir})
	app.Bootstrap()

	// List existing collections BEFORE migration
	fmt.Println("=== Collections BEFORE app migration ===")
	rows, err := app.DB().NewQuery("SELECT name FROM _collections ORDER BY name").Rows()
	if err != nil {
		fmt.Printf("query failed: %v\n", err)
	} else {
		for rows.Next() {
			var name string
			rows.Scan(&name)
			fmt.Printf("  - %s\n", name)
		}
		rows.Close()
	}

	// Run app migrations
	fmt.Println("\n=== Running app migrations ===")
	if err := app.RunAppMigrations(); err != nil {
		fmt.Printf("RunAppMigrations error: %v\n", err)
	}

	// List collections AFTER
	fmt.Println("\n=== Collections AFTER app migration ===")
	rows2, _ := app.DB().NewQuery("SELECT name FROM _collections ORDER BY name").Rows()
	if rows2 != nil {
		for rows2.Next() {
			var name string
			rows2.Scan(&name)
			fmt.Printf("  - %s\n", name)
		}
		rows2.Close()
	}
}

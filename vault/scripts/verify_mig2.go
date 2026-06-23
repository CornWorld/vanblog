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
	tmpDir, _ := os.MkdirTemp("", "pb-mig2")
	defer os.RemoveAll(tmpDir)

	app := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: tmpDir})

	// Intercept migration errors
	app.OnBootstrap().BindFunc(func(e *core.BootstrapEvent) error {
		fmt.Println("=== before Bootstrap ===")
		if err := e.Next(); err != nil {
			fmt.Printf("=== Bootstrap error: %v ===\n", err)
			return err
		}
		fmt.Println("=== after Bootstrap (success) ===")

		// Check collections
		for _, name := range []string{"tags", "categories", "users", "posts", "site"} {
			col, err := app.FindCollectionByNameOrId(name)
			if err != nil {
				fmt.Printf("  ❌ %s: %v\n", name, err)
			} else {
				fmt.Printf("  ✅ %s (%d fields)\n", name, len(col.Fields))
			}
		}
		return nil
	})

	if err := app.Bootstrap(); err != nil {
		fmt.Printf("Bootstrap returned error: %v\n", err)
	}
}

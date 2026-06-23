package main

import (
	"log"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"

	// Register vanblog schema migrations (runs on first boot)
	_ "github.com/cornworld/vanblog/pb_migrations"
)

func main() {
	app := pocketbase.New()

	// Register vanblog-specific hooks and custom routes here as we build them.
	// For now this is a vanilla PocketBase with vanblog's schema migrations.
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		// vanblog hooks will be registered here:
		// - caddy admin API integration
		// - caddy/ask endpoint
		// - revisions snapshot on posts update
		// - migration import endpoint
		// - etc.
		return se.Next()
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}

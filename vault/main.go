package main

import (
	"log"

	"github.com/cornworld/vanblog/internal/hooks"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"

	// Register vanblog schema migrations (runs on first boot)
	_ "github.com/cornworld/vanblog/pb_migrations"
)

func main() {
	app := pocketbase.New()

	// Register vanblog hooks, custom routes, and Caddy sync.
	// This wires all Go SDK modules into PocketBase's event system.
	hooks.Register(app)

	// The OnServe placeholder is kept for any future inline registrations.
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		return se.Next()
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}

package main

import (
	"log"
	"os"

	"github.com/cornworld/vanblog/internal/hooks"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/jsvm"
	"github.com/pocketbase/pocketbase/plugins/migratecmd"

	// Register vanblog schema migrations (runs on first boot)
	_ "github.com/cornworld/vanblog/pb_migrations"
)

func main() {
	app := pocketbase.New()

	// ---------------------------------------------------------------
	// CLI flags (override defaults via command line)
	// ---------------------------------------------------------------
	var (
		hooksDir      string
		hooksWatch    bool
		hooksPool     int
		migrationsDir string
		automigrate   bool
	)

	app.RootCmd.PersistentFlags().StringVar(
		&hooksDir, "hooksDir", "",
		"the directory with the JS app hooks",
	)
	app.RootCmd.PersistentFlags().BoolVar(
		&hooksWatch, "hooksWatch", true,
		"auto reload the app on pb_hooks file change (UNIX only)",
	)
	app.RootCmd.PersistentFlags().IntVar(
		&hooksPool, "hooksPool", 15,
		"the total prewarm goja.Runtime instances for the JS app hooks execution",
	)
	app.RootCmd.PersistentFlags().StringVar(
		&migrationsDir, "migrationsDir", "",
		"the directory with the user defined JS migrations",
	)
	app.RootCmd.PersistentFlags().BoolVar(
		&automigrate, "automigrate", true,
		"enable/disable auto execution of JS migrations",
	)

	app.RootCmd.ParseFlags(os.Args[1:])

	// ---------------------------------------------------------------
	// Plugins: load JSVM (pb_hooks + JS migrations)
	// ---------------------------------------------------------------
	// pb 0.39 no longer auto-registers the JSVM, so we register it here
	// to enable pb_hooks/*.pb.js files (system.pb.js, examples.pb.js).
	// Go migrations registered via init() in pb_migrations/ run regardless.
	jsvm.MustRegister(app, jsvm.Config{
		MigrationsDir: migrationsDir,
		HooksDir:      hooksDir,
		HooksWatch:    hooksWatch,
		HooksPoolSize: hooksPool,
	})

	// `migrate` CLI subcommand for creating/running JS migrations
	migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{
		TemplateLang: migratecmd.TemplateLangJS,
		Automigrate:  automigrate,
		Dir:          migrationsDir,
	})

	// ---------------------------------------------------------------
	// Vanblog hooks: wire Go SDK modules into PocketBase events + routes
	// ---------------------------------------------------------------
	hooks.Register(app)

	// Placeholder for any future inline registrations.
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		return se.Next()
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}

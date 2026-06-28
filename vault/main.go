package main

import (
	"log"
	"os"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/plugins/jsvm"
	"github.com/pocketbase/pocketbase/plugins/migratecmd"

	"github.com/cornworld/vanblog/internal/article"
	"github.com/cornworld/vanblog/internal/caddy"
	"github.com/cornworld/vanblog/internal/feed"
	"github.com/cornworld/vanblog/internal/media"
	"github.com/cornworld/vanblog/internal/migration"
	"github.com/cornworld/vanblog/internal/revisions"
	"github.com/cornworld/vanblog/internal/visits"

	// Register vanblog schema migrations (runs on first boot)
	_ "github.com/cornworld/vanblog/pb_migrations"
)

func main() {
	app := pocketbase.New()

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

	jsvm.MustRegister(app, jsvm.Config{
		MigrationsDir: migrationsDir,
		HooksDir:      hooksDir,
		HooksWatch:    hooksWatch,
		HooksPoolSize: hooksPool,
	})

	migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{
		TemplateLang: migratecmd.TemplateLangJS,
		Automigrate:  automigrate,
		Dir:          migrationsDir,
	})

	// Each manager registers its own pb hooks (events + routes + startup
	// init) in its constructor. Order only affects same-event Bind order;
	// no cross-manager dependency.
	_ = revisions.New(app)
	_ = visits.New(app)
	_ = media.New(app)
	_ = article.New(app)
	migration.RegisterRoutes(app)
	_ = feed.New(app)
	_ = caddy.New(app)

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}

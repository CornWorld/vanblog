package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/jsvm"
	"github.com/pocketbase/pocketbase/plugins/migratecmd"
	"github.com/spf13/cobra"

	"github.com/cornworld/vanblog/internal/admin"
	"github.com/cornworld/vanblog/internal/article"
	"github.com/cornworld/vanblog/internal/bootstrap"
	"github.com/cornworld/vanblog/internal/caddy"
	"github.com/cornworld/vanblog/internal/devseed"
	"github.com/cornworld/vanblog/internal/feed"
	"github.com/cornworld/vanblog/internal/media"
	"github.com/cornworld/vanblog/internal/migration"
	"github.com/cornworld/vanblog/internal/pack"
	"github.com/cornworld/vanblog/internal/packcli"
	"github.com/cornworld/vanblog/internal/plugins"
	"github.com/cornworld/vanblog/internal/revisions"
	"github.com/cornworld/vanblog/internal/schema"
	"github.com/cornworld/vanblog/internal/validation"
	"github.com/cornworld/vanblog/internal/visits"
	_ "github.com/cornworld/vanblog/pb_migrations"
)

func main() {
	if len(os.Args) > 1 && os.Args[1] == "pack" {
		os.Exit(packcli.Main(os.Args[2:]))
	}

	app := pocketbase.New()
	var hooksDir string
	var hooksWatch bool
	var hooksPool int
	var migrationsDir string
	var automigrate bool
	var pluginsDir string
	var builtinPacksDir string
	var packsDir string
	var packRuntimeDir string
	app.RootCmd.PersistentFlags().StringVar(&hooksDir, "hooksDir", "", "the directory with the JS app hooks")
	app.RootCmd.PersistentFlags().BoolVar(&hooksWatch, "hooksWatch", true, "auto reload the app on pb_hooks file change (UNIX only)")
	app.RootCmd.PersistentFlags().IntVar(&hooksPool, "hooksPool", 15, "the total prewarm goja.Runtime instances for the JS app hooks execution")
	app.RootCmd.PersistentFlags().StringVar(&migrationsDir, "migrationsDir", "", "the directory with the user defined JS migrations")
	app.RootCmd.PersistentFlags().BoolVar(&automigrate, "automigrate", true, "enable/disable auto execution of JS migrations")
	app.RootCmd.PersistentFlags().StringVar(&pluginsDir, "pluginsDir", "/plugins", "the directory with the plugin packages")
	app.RootCmd.PersistentFlags().StringVar(&builtinPacksDir, "builtinPacksDir", "/packs", "the directory with builtin Pack resources")
	app.RootCmd.PersistentFlags().StringVar(&packsDir, "packsDir", "", "the directory with local Pack overrides")
	app.RootCmd.PersistentFlags().StringVar(&packRuntimeDir, "packRuntimeDir", "", "private directory for staged Pack runtime resources")
	privateRuntimeDir, err := os.MkdirTemp("", "vanblog-hooks-*")
	if err != nil {
		log.Fatalf("reserve private Pack runtime directory: %v", err)
	}
	if err := os.Remove(privateRuntimeDir); err != nil {
		log.Fatalf("release private Pack runtime directory reservation: %v", err)
	}
	staging := filepath.Join(privateRuntimeDir, "pb_hooks")
	app.OnServe().BindFunc(func(event *core.ServeEvent) error {
		if pluginsDir == "" {
			pluginsDir = "/plugins"
		}
		coreHooksDir := hooksDir
		if coreHooksDir == "" {
			coreHooksDir = "pb_hooks"
			if _, err := os.Stat(coreHooksDir); err != nil {
				coreHooksDir = "/pb_hooks"
			}
		}
		builtins, err := pack.Builtins(os.DirFS(builtinPacksDir))
		if err != nil {
			return err
		}
		var locals []pack.Pack
		if packsDir != "" {
			locals, err = pack.DiscoverLocal(packsDir)
			if err != nil {
				return err
			}
		}
		resolved, err := pack.Resolve(builtins, locals)
		if err != nil {
			return err
		}
		if err := pack.ValidateV0(resolved); err != nil {
			return err
		}
		loadable, warnings, err := pack.RuntimeLoadableV0(resolved)
		if err != nil {
			return err
		}
		for _, warning := range warnings {
			log.Printf("[vanblog] warning: pack %s skipped: %s; run vanblog pack build with the dev image", warning.Pack, warning.Reason)
		}
		if packRuntimeDir != "" {
			staging = filepath.Join(packRuntimeDir, "pb_hooks")
		}
		if err := pack.StageHooks(coreHooksDir, loadable, staging); err != nil {
			return err
		}
		return event.Next()
	})
	pluginMgr := plugins.New(app, pluginsDir)
	jsvm.MustRegister(app, jsvm.Config{
		MigrationsDir: migrationsDir,
		HooksDir:      staging,
		HooksWatch:    hooksWatch,
		HooksPoolSize: hooksPool,
		OnInit:        pluginMgr.Bind(),
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
	_ = schema.New(app)
	if err := validation.Register(app); err != nil {
		log.Fatal(err)
	}
	_ = visits.New(app)
	_ = media.New(app)
	_ = article.New(app)
	_ = admin.New(app)
	_ = bootstrap.New(app)
	migration.RegisterRoutes(app)
	_ = feed.New(app)
	_ = caddy.New(app)

	// seed subcommand: populate dev database with sample data
	seedCmd := &cobra.Command{
		Use:   "seed",
		Short: "Populate database with sample data for development",
		Run: func(cmd *cobra.Command, args []string) {
			count, _ := cmd.Flags().GetInt("count")
			if err := devseed.Seed(app, count); err != nil {
				fmt.Fprintf(os.Stderr, "seed: %v\n", err)
				os.Exit(1)
			}
			fmt.Println("seed: done")
		},
	}
	seedCmd.Flags().Int("count", 3, "number of posts to seed")
	app.RootCmd.AddCommand(seedCmd)

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}

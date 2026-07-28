package main

import (
	"fmt"
	"io/fs"
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
	"github.com/cornworld/vanblog/internal/palette"
	"github.com/cornworld/vanblog/internal/theme"
	"github.com/cornworld/vanblog/internal/migration"
	"github.com/cornworld/vanblog/internal/pack"
	"github.com/cornworld/vanblog/internal/packcli"
	"github.com/cornworld/vanblog/internal/revisions"
	"github.com/cornworld/vanblog/internal/schema"
	"github.com/cornworld/vanblog/internal/traceid"
	"github.com/cornworld/vanblog/internal/validation"
	"github.com/cornworld/vanblog/internal/visits"
	_ "github.com/cornworld/vanblog/pb_migrations"
)

func resolveCoreSchemaSource(path string) (validation.ModelSource, error) {
	if path == "" {
		return nil, fmt.Errorf("core schema artifact path is required; pass --coreSchemaPath")
	}
	info, err := os.Stat(path)
	if err != nil {
		return nil, fmt.Errorf("core schema artifact %q is unavailable: %w", path, err)
	}
	if info.IsDir() {
		return nil, fmt.Errorf("core schema artifact %q is a directory", path)
	}
	return validation.ArtifactSource{FS: os.DirFS(filepath.Dir(path)), Name: "core", Path: filepath.Base(path)}, nil
}

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
	var builtinPacksDir string
	var packsDir string
	var packRuntimeDir string
	var coreSchemaPath string
	app.RootCmd.PersistentFlags().StringVar(&hooksDir, "hooksDir", "", "the directory with the JS app hooks")
	app.RootCmd.PersistentFlags().BoolVar(&hooksWatch, "hooksWatch", true, "auto reload the app on pb_hooks file change (UNIX only)")
	app.RootCmd.PersistentFlags().IntVar(&hooksPool, "hooksPool", 15, "the total prewarm goja.Runtime instances for the JS app hooks execution")
	app.RootCmd.PersistentFlags().StringVar(&migrationsDir, "migrationsDir", "", "the directory with the user defined JS migrations")
	app.RootCmd.PersistentFlags().BoolVar(&automigrate, "automigrate", true, "enable/disable auto execution of JS migrations")
	app.RootCmd.PersistentFlags().StringVar(&builtinPacksDir, "builtinPacksDir", "/packs", "the directory with builtin Pack resources")
	app.RootCmd.PersistentFlags().StringVar(&packsDir, "packsDir", "", "the directory with local Pack overrides")
	app.RootCmd.PersistentFlags().StringVar(&packRuntimeDir, "packRuntimeDir", "", "private directory for staged Pack runtime resources")
	app.RootCmd.PersistentFlags().StringVar(&coreSchemaPath, "coreSchemaPath", "runtime/core-schema/models.js", "path to the generated core schema artifact")
	privateRuntimeDir, err := os.MkdirTemp("", "vanblog-hooks-*")
	if err != nil {
		log.Fatalf("reserve private Pack runtime directory: %v", err)
	}
	if err := os.Remove(privateRuntimeDir); err != nil {
		log.Fatalf("release private Pack runtime directory reservation: %v", err)
	}
	staging := filepath.Join(privateRuntimeDir, "pb_hooks")

	// --- Pack resolution and hook staging (before JSVM registration) ---
	// jsvm.MustRegister calls registerHooks() immediately, which reads HooksDir.
	// We must resolve and stage hooks BEFORE that call so JSVM sees the files.
	coreHooksDir := hooksDir
	if coreHooksDir == "" {
		coreHooksDir = "pb_hooks"
		if _, err := os.Stat(coreHooksDir); err != nil {
			coreHooksDir = "/pb_hooks"
		}
	}
	builtins, err := pack.Builtins(os.DirFS(builtinPacksDir))
	if err != nil {
		log.Fatalf("load builtin packs: %v", err)
	}
	var locals []pack.Pack
	if packsDir != "" {
		locals, err = pack.DiscoverLocal(packsDir)
		if err != nil {
			log.Fatalf("load local packs: %v", err)
		}
	}
	// Single resolution pass with diagnostics: surfaces override warnings
	// (e.g. local pack pinned to an older version than builtin) without
	// running the whole validate + sort + semver compare twice.
	resolved, overrideWarnings, err := pack.ResolveWithDiagnostics(builtins, locals)
	if err != nil {
		log.Fatalf("resolve packs: %v", err)
	}
	for _, warning := range overrideWarnings {
		log.Printf("[vanblog] warning: pack %s local override %s is older than builtin %s; replacement proceeds but may regress behavior", warning.Pack, warning.LocalVersion, warning.BuiltinVersion)
	}
	if err := pack.ValidateV0(resolved); err != nil {
		log.Fatalf("validate packs: %v", err)
	}
	loadable, warnings, err := pack.RuntimeLoadableV0(resolved)
	if err != nil {
		log.Fatalf("runtime loadability check: %v", err)
	}
	for _, warning := range warnings {
		log.Printf("[vanblog] warning: pack %s skipped: %s; run vanblog pack build with the dev image", warning.Pack, warning.Reason)
	}
	startupLines, err := pack.StartupSummary(resolved, loadable, warnings)
	if err != nil {
		log.Fatalf("pack startup summary: %v", err)
	}
	for _, line := range startupLines {
		log.Printf("[vanblog] %s", line)
	}
	if packRuntimeDir != "" {
		staging = filepath.Join(packRuntimeDir, "pb_hooks")
	}
	if err := pack.StageHooks(coreHooksDir, loadable, staging); err != nil {
		log.Fatalf("stage hooks: %v", err)
	}

	jsvm.MustRegister(app, jsvm.Config{
		MigrationsDir: migrationsDir,
		HooksDir:      staging,
		HooksWatch:    hooksWatch,
		HooksPoolSize: hooksPool,
	})

	// Loadable packs captured for OnServe schema resolution.
	loadablePacks := loadable

	app.OnServe().BindFunc(func(event *core.ServeEvent) error {
		// Trace ID middleware: generates a request ID, stores it in the
		// event data store (e.Get / e.Set), and sets the X-Trace-Id
		// response header for client-side correlation.
		event.Router.BindFunc(func(e *core.RequestEvent) error {
			// Always generate server-side. We do NOT trust X-Request-ID from
			// clients — accepting external input opens log injection and
			// trace collision vectors for no benefit in a blog system.
			// Reverse proxies that need their own request ID can log it
			// independently in their access logs.
			id := traceid.Generate()
			e.Set("trace_id", id)
			e.Response.Header().Set("X-Trace-Id", id)
			return e.Next()
		})
		// Register the generated core artifact together with every Pack schema.
		// Pack schemas are ordered by name and no longer use first-wins resolution.
		var packSources []validation.NamedModelSource
		for _, p := range loadablePacks {
			if _, err := fs.Stat(p.FS, "schema.js"); err != nil {
				continue
			}
			packSources = append(packSources, validation.NamedModelSource{
				Name:   p.Name,
				Source: validation.PackSource{FS: p.FS, Name: p.Name},
			})
		}
		coreSource, err := resolveCoreSchemaSource(coreSchemaPath)
		if err != nil {
			return err
		}
		if err := validation.RegisterWithSources(app, coreSource, packSources); err != nil {
			return err
		}

		// Disable PocketBase's default browser opening behavior.
		event.InstallerFunc = nil

		return event.Next()
	})

	migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{
		TemplateLang: migratecmd.TemplateLangJS,
		Automigrate:  automigrate,
		Dir:          migrationsDir,
	})

	// Each manager registers its own pb hooks (events + routes + startup
	// init) in its constructor. Order only affects same-event Bind order;
	// no cross-manager dependency.
	// jsvm.MustRegister is called inside OnServe after StageHooks.
	_ = revisions.New(app)
	_ = schema.New(app)
	// validation.RegisterWithSource is now called inside OnServe after Pack
	// resolution, so it can use Pack-provided schema.js when available.
	_ = visits.New(app)
	_ = media.New(app)
	_ = article.New(app)
	_ = admin.New(app)
	_ = bootstrap.New(app)
	migration.RegisterRoutes(app)
	_ = feed.New(app)
	palette.New(app)
	theme.New(app)
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

// Package hooks is a thin glue layer that wires vanblog's business packages
// into PocketBase's event hooks and HTTP routes.
//
// This package should contain NO business logic.
// Every route handler delegates to the appropriate business package.
package hooks

import (
	"bytes"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"

	"github.com/cornworld/vanblog/internal/article"
	"github.com/cornworld/vanblog/internal/caddy"
	"github.com/cornworld/vanblog/internal/feed"
	"github.com/cornworld/vanblog/internal/media"
	"github.com/cornworld/vanblog/internal/migration"
	"github.com/cornworld/vanblog/internal/revisions"
	"github.com/cornworld/vanblog/internal/site"
	"github.com/cornworld/vanblog/internal/visits"
	"github.com/pocketbase/pocketbase/core"
)

// Register wires all vanblog hooks and routes into PocketBase.
func Register(app core.App) {
	revMgr := revisions.New(app)
	articleMgr := article.New(app)
	visitMgr := visits.New(app)
	mediaMgr := media.New(app)
	imp := migration.New(app)

	// --- Event hooks ---

	// Revisions: snapshot before post update (HTTP-triggered only)
	app.OnRecordUpdateRequest("posts").BindFunc(func(e *core.RecordRequestEvent) error {
		oldRecord, err := app.FindRecordById("posts", e.Record.Id)
		if err == nil && oldRecord != nil {
			if err := revMgr.CaptureBeforeUpdate(oldRecord, revisions.ReasonAutoSave, ""); err != nil {
				log.Printf("[vanblog] revisions capture failed: %v", err)
			}
		}
		return e.Next()
	})

	// Visits: increment post viewCount after visit create
	app.OnRecordCreateRequest("visits").BindFunc(func(e *core.RecordRequestEvent) error {
		if err := e.Next(); err != nil {
			return err
		}
		postID := e.Record.GetString("post")
		if postID != "" {
			visitMgr.IncrementPostView(postID)
		}
		return nil
	})

	// Media dedup: after file upload, compute MD5 sign and check for duplicates
	app.OnRecordAfterCreateSuccess("media").BindFunc(func(e *core.RecordEvent) error {
		record := e.Record
		filename := record.GetString("file")
		if filename == "" {
			return nil // skip external URL records
		}
		content, err := mediaMgr.ReadFileContent(record)
		if err != nil {
			log.Printf("[vanblog] media dedup: failed to read file: %v", err)
			return nil
		}
		sign := media.ComputeSign(content)
		record.Set("sign", sign)
		app.Save(record)

		existing, err := mediaMgr.CheckDuplicate(content)
		if err != nil || existing == nil || existing.Id == record.Id {
			return nil
		}
		log.Printf("[vanblog] media dedup: duplicate of %s, deleting %s", existing.Id, record.Id)
		app.Delete(record)
		return nil
	})

	// Astro cache invalidation: when posts change, notify Astro SSR server
	app.OnRecordAfterCreateSuccess("posts").BindFunc(func(e *core.RecordEvent) error {
		go revalidateAstroCache([]string{"posts"})
		return nil
	})
	app.OnRecordAfterUpdateSuccess("posts").BindFunc(func(e *core.RecordEvent) error {
		go revalidateAstroCache([]string{"posts"})
		return nil
	})
	app.OnRecordAfterDeleteSuccess("posts").BindFunc(func(e *core.RecordEvent) error {
		go revalidateAstroCache([]string{"posts"})
		return nil
	})

	// --- HTTP routes (thin delegates) ---

	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		// Migration import
		se.Router.POST("/api/vanblog/migrate/import", func(e *core.RequestEvent) error {
			// Limit body to 100MB to prevent OOM on large legacy backups
			body, err := io.ReadAll(io.LimitReader(e.Request.Body, 100*1024*1024))
			if err != nil {
				return e.BadRequestError("Failed to read body", "")
			}
			result, err := imp.Import(body)
			if err != nil {
				return e.BadRequestError("Migration failed", err.Error())
			}
			return e.JSON(200, result)
		})

		// Caddy on-demand TLS ask
		// Caddy calls this before issuing a certificate for a new domain.
		// Logic: if no superuser exists → allow all (setup window);
		//        if superuser exists → strict whitelist from site.allowedDomains.
		se.Router.GET("/api/hooks/caddy/ask", func(e *core.RequestEvent) error {
			domain := e.Request.URL.Query().Get("domain")
			info, err := site.GetInfo(app)
			if err != nil {
				// Can't read site config — fail open during setup, fail closed after
				hasAdmin, _ := hasSuperuser(app)
				if !hasAdmin {
					return e.JSON(200, map[string]bool{"allowed": true})
				}
				return e.JSON(403, map[string]bool{"allowed": false})
			}
			hasAdmin, _ := hasSuperuser(app)
			return e.JSON(200, map[string]bool{"allowed": caddy.AskHandler(info.AllowedDomains, domain, hasAdmin)})
		})

		// RSS feed
		se.Router.GET("/api/feed.xml", func(e *core.RequestEvent) error {
			data, err := feed.GenerateRSS(app, 20)
			if err != nil {
				return e.String(500, "rss failed")
			}
			e.Set("Content-Type", "application/rss+xml; charset=utf-8")
			return e.String(200, string(data))
		})

		// Atom feed
		se.Router.GET("/api/atom.xml", func(e *core.RequestEvent) error {
			data, err := feed.GenerateAtom(app, 20)
			if err != nil {
				return e.String(500, "atom failed")
			}
			e.Set("Content-Type", "application/atom+xml; charset=utf-8")
			return e.String(200, string(data))
		})

		// Sitemap
		se.Router.GET("/api/sitemap.xml", func(e *core.RequestEvent) error {
			data, err := feed.GenerateSitemap(app)
			if err != nil {
				return e.String(500, "sitemap failed")
			}
			e.Set("Content-Type", "application/xml; charset=utf-8")
			return e.String(200, string(data))
		})

		// Timeline
		se.Router.GET("/api/vanblog/timeline", func(e *core.RequestEvent) error {
			timeline, err := articleMgr.GetTimeline()
			if err != nil {
				return e.JSON(500, err.Error())
			}
			return e.JSON(200, timeline)
		})

		// Search
		se.Router.GET("/api/vanblog/search", func(e *core.RequestEvent) error {
			q := e.Request.URL.Query().Get("q")
			if q == "" {
				return e.JSON(400, "missing param 'q'")
			}
			results, err := articleMgr.Search(q, 20)
			if err != nil {
				return e.JSON(500, err.Error())
			}
			return e.JSON(200, results)
		})

		// TLS status — shows Caddy reachability, allowed domains, issued certificates
		se.Router.GET("/api/vanblog/tls/status", func(e *core.RequestEvent) error {
			status, err := caddy.GetTLSStatus(app, "http://127.0.0.1:2019")
			if err != nil {
				return e.JSON(500, err.Error())
			}
			return e.JSON(200, status)
		})

		return se.Next()
	})

	// --- Caddy bootstrap on startup ---
	app.OnBootstrap().BindFunc(func(e *core.BootstrapEvent) error {
		if err := e.Next(); err != nil {
			return err
		}
		go caddy.BootstrapSync(app, "srv0", "http://127.0.0.1:2019")
		return nil
	})
}

// hasSuperuser checks whether at least one superuser/admin user exists.
// Used by the TLS ask endpoint to distinguish setup window from post-setup.
func hasSuperuser(app core.App) (bool, error) {
	records, err := app.FindRecordsByFilter("_superusers", "", "", 1, 0)
	if err != nil {
		return false, err
	}
	return len(records) > 0, nil
}

// revalidateAstroCache notifies the Astro SSR server to invalidate cached pages.
// Called asynchronously when posts are created/updated/deleted.
func revalidateAstroCache(tags []string) {
	astroURL := os.Getenv("ASTRO_URL")
	if astroURL == "" {
		astroURL = "http://127.0.0.1:4321"
	}

	body, _ := json.Marshal(map[string][]string{"tags": tags})
	resp, err := http.Post(astroURL+"/api/revalidate", "application/json", bytes.NewReader(body))
	if err != nil {
		log.Printf("[vanblog] revalidate: failed to reach Astro at %s: %v", astroURL, err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		log.Printf("[vanblog] revalidate: Astro returned %d", resp.StatusCode)
	} else {
		log.Printf("[vanblog] revalidate: cache invalidated for tags %v", tags)
	}
}

// Package hooks wires vanblog's Go SDK modules into PocketBase's
// event hook system and custom routes.
package hooks

import (
	"encoding/json"
	"io"
	"log"

	"github.com/cornworld/vanblog/internal/article"
	"github.com/cornworld/vanblog/internal/caddy"
	"github.com/cornworld/vanblog/internal/migration"
	"github.com/cornworld/vanblog/internal/revisions"
	"github.com/cornworld/vanblog/internal/rss"
	"github.com/cornworld/vanblog/internal/sitemap"
	"github.com/cornworld/vanblog/internal/visits"
	"github.com/cornworld/vanblog/utils/caddyadmin"
	"github.com/pocketbase/pocketbase/core"
)

// Register wires all vanblog hooks and custom routes into the PocketBase app.
func Register(app core.App) {
	revMgr := revisions.New(app)
	articleMgr := article.New(app)
	imp := migration.New(app)
	_ = visits.New(app) // used in visit hook

	// --- 1. Revisions: snapshot before post update ---
	app.OnRecordUpdateRequest("posts").BindFunc(func(e *core.RecordRequestEvent) error {
		oldRecord, err := app.FindRecordById("posts", e.Record.Id)
		if err == nil && oldRecord != nil {
			if err := revMgr.CaptureBeforeUpdate(oldRecord, revisions.ReasonAutoSave, ""); err != nil {
				log.Printf("[vanblog] revisions capture failed: %v", err)
			}
		}
		return e.Next()
	})

	// --- 2. Visits: increment post viewCount after visit create ---
	app.OnRecordCreateRequest("visits").BindFunc(func(e *core.RecordRequestEvent) error {
		if err := e.Next(); err != nil {
			return err
		}
		postID := e.Record.GetString("post")
		if postID != "" {
			if post, err := app.FindRecordById("posts", postID); err == nil {
				post.Set("viewCount", post.GetInt("viewCount")+1)
				app.Save(post)
			}
		}
		return nil
	})

	// --- 3. Custom routes ---
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		// Migration import
		se.Router.POST("/api/vanblog/migrate/import", func(e *core.RequestEvent) error {
			body, err := io.ReadAll(e.Request.Body)
			if err != nil {
				return e.BadRequestError("Failed to read body", err.Error())
			}
			result, err := imp.Import(body)
			if err != nil {
				return e.BadRequestError("Migration failed", err.Error())
			}
			return e.JSON(200, result)
		})

		// Caddy on-demand TLS ask
		se.Router.GET("/api/hooks/caddy/ask", func(e *core.RequestEvent) error {
			domain := e.Request.URL.Query().Get("domain")
			site, err := app.FindFirstRecordByFilter("site", "")
			if err != nil || site == nil {
				return e.JSON(200, map[string]bool{"allowed": true})
			}
			allowed := site.GetStringSlice("allowedDomains")
			if len(allowed) == 0 {
				return e.JSON(200, map[string]bool{"allowed": true})
			}
			for _, d := range allowed {
				if d == domain {
					return e.JSON(200, map[string]bool{"allowed": true})
				}
			}
			return e.JSON(403, map[string]bool{"allowed": false})
		})

		// RSS feed
		se.Router.GET("/api/feed.xml", func(e *core.RequestEvent) error {
			site, _ := app.FindFirstRecordByFilter("site", "")
			baseURL, siteName := "", "Vanblog"
			if site != nil {
				baseURL = site.GetString("baseUrl")
				if n := site.GetString("siteName"); n != "" {
					siteName = n
				}
			}
			posts, err := app.FindRecordsByFilter("posts", "status='published' && deleted=false", "-created", 20, 0)
			if err != nil {
				return e.JSON(500, "query failed")
			}
			items := make([]rss.FeedItem, len(posts))
			for i, p := range posts {
				path := p.GetString("pathname")
				if path == "" {
					path = "/posts/" + p.Id
				}
				items[i] = rss.FeedItem{
					Title:   p.GetString("title"),
					Link:    baseURL + path,
					PubDate: p.GetDateTime("created").Time(),
					GUID:    baseURL + path,
				}
			}
			data, err := rss.GenerateRSS(rss.Feed{Title: siteName, Link: baseURL, Description: siteName, Items: items})
			if err != nil {
				return e.JSON(500, "rss failed")
			}
			return e.JSON(200, string(data))
		})

		// Sitemap
		se.Router.GET("/api/sitemap.xml", func(e *core.RequestEvent) error {
			site, _ := app.FindFirstRecordByFilter("site", "")
			baseURL := "http://localhost:8090"
			if site != nil && site.GetString("baseUrl") != "" {
				baseURL = site.GetString("baseUrl")
			}
			posts, _ := app.FindRecordsByFilter("posts", "status='published' && deleted=false", "", 0, 0)
			urls := []sitemap.URL{{Loc: baseURL + "/", ChangeFreq: "daily", Priority: 1.0}}
			for _, p := range posts {
				path := p.GetString("pathname")
				if path == "" {
					path = "/posts/" + p.Id
				}
				urls = append(urls, sitemap.URL{Loc: baseURL + path, LastMod: p.GetDateTime("created").Time(), ChangeFreq: "weekly", Priority: 0.8})
			}
			data, err := sitemap.GenerateSitemap(baseURL, urls)
			if err != nil {
				return e.JSON(500, "sitemap failed")
			}
			return e.JSON(200, string(data))
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

		return se.Next()
	})

	// --- 4. Sync Caddy routes on startup ---
	app.OnBootstrap().BindFunc(func(e *core.BootstrapEvent) error {
		if err := e.Next(); err != nil {
			return err
		}
		go syncCaddyRoutes(app)
		return nil
	})
}

// syncCaddyRoutes reads site.routing and applies to Caddy admin API.
func syncCaddyRoutes(app core.App) {
	site, err := app.FindFirstRecordByFilter("site", "")
	if err != nil || site == nil {
		return
	}
	routingStr := site.GetString("routing")
	if routingStr == "" || routingStr == "[]" {
		return
	}
	var rules []caddy.UserRule
	if err := json.Unmarshal([]byte(routingStr), &rules); err != nil {
		log.Printf("[vanblog] failed to parse routing: %v", err)
		return
	}
	if len(rules) == 0 {
		return
	}
	routes, err := caddy.TranslateAll(rules, nil)
	if err != nil {
		log.Printf("[vanblog] routing translation failed: %v", err)
		return
	}
	client := caddyadmin.NewClient("http://127.0.0.1:2019")
	for _, route := range routes {
		if err := client.AddRoute("srv0", route); err != nil {
			log.Printf("[vanblog] caddy route %s failed: %v", route.ID, err)
		}
	}
}

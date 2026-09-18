package feed

import (
	"encoding/json"
	"net/http"

	"github.com/pocketbase/pocketbase/core"
)

// Service registers the RSS/Atom/sitemap HTTP routes.
type Service struct {
	app core.App
}

// New creates a feed Service and registers RSS/Atom/sitemap routes.
// Feeds are generated per-request; caching is delegated to Astro SSR.
func New(app core.App) *Service {
	s := &Service{app: app}
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		se.Router.GET("/api/feed.xml", s.serveRSS)
		se.Router.GET("/api/atom.xml", s.serveAtom)
		se.Router.GET("/api/sitemap.xml", s.serveSitemap)
		// 根路径别名:上游原版后端在站点根服务 /feed.xml 等(vendor RssButton/
		// AuthorCard 与 BaseLayout auto-discovery 的既有 URL 契约),Caddy 把
		// 这组 ReservedPaths 反代到 pb(见 caddy config_builder),与 /api/*
		// 同源。缺省不服务会让 RSS 按钮 404(2026-09-11 parity 验证发现)。
		se.Router.GET("/feed.xml", s.serveRSS)
		se.Router.GET("/atom.xml", s.serveAtom)
		se.Router.GET("/sitemap.xml", s.serveSitemap)
		return se.Next()
	})
	return s
}

// feedLimit reads site.displayOptions.feedLimit, clamped to [1,100].
// 缺省 20(上游原版可配,本仓曾写死);越界/读失败回缺省。
func feedLimit(app core.App) int {
	const def, max = 20, 100
	rec, err := app.FindFirstRecordByFilter("site", "")
	if err != nil {
		return def
	}
	var opts map[string]any
	if raw := rec.GetString("displayOptions"); raw != "" {
		_ = json.Unmarshal([]byte(raw), &opts)
	}
	if v, ok := opts["feedLimit"].(float64); ok {
		if n := int(v); n >= 1 && n <= max {
			return n
		}
	}
	return def
}

func (s *Service) serveRSS(e *core.RequestEvent) error {
	data, err := GenerateRSS(s.app, feedLimit(s.app))
	if err != nil {
		return e.String(http.StatusInternalServerError, "rss failed")
	}
	return e.Blob(http.StatusOK, "application/rss+xml; charset=utf-8", data)
}

func (s *Service) serveAtom(e *core.RequestEvent) error {
	data, err := GenerateAtom(s.app, feedLimit(s.app))
	if err != nil {
		return e.String(http.StatusInternalServerError, "atom failed")
	}
	return e.Blob(http.StatusOK, "application/atom+xml; charset=utf-8", data)
}

func (s *Service) serveSitemap(e *core.RequestEvent) error {
	data, err := GenerateSitemap(s.app)
	if err != nil {
		return e.String(http.StatusInternalServerError, "sitemap failed")
	}
	return e.Blob(http.StatusOK, "application/xml", data)
}

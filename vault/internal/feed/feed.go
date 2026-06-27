// Package feed generates RSS/Atom feeds and sitemap data from posts.
// It combines article data + site config into feed-ready structures.
package feed

import (
	"github.com/cornworld/vanblog/internal/rss"
	"github.com/cornworld/vanblog/internal/site"
	"github.com/cornworld/vanblog/internal/sitemap"
	"github.com/pocketbase/pocketbase/core"
)

// GenerateRSS builds an RSS 2.0 feed from published posts + site config.
func GenerateRSS(app core.App, limit int) ([]byte, error) {
	info, err := site.GetInfo(app)
	if err != nil {
		info = &site.Info{SiteName: "Vanblog", Description: "Vanblog"}
	}

	posts, err := app.FindRecordsByFilter(
		"posts", "status='published' && deleted=false", "-created", limit, 0,
	)
	if err != nil {
		return nil, err
	}

	items := make([]rss.FeedItem, len(posts))
	for i, p := range posts {
		path := p.GetString("pathname")
		if path == "" {
			path = "/posts/" + p.Id
		}
		items[i] = rss.FeedItem{
			Title:       p.GetString("title"),
			Link:        info.BaseURL + path,
			Description: excerpt(p.GetString("content")),
			PubDate:     p.GetDateTime("created").Time(),
			GUID:        info.BaseURL + path,
		}
	}

	return rss.GenerateRSS(rss.Feed{
		Title:       info.SiteName,
		Link:        info.BaseURL,
		Description: info.Description,
		Items:       items,
	})
}

// GenerateAtom builds an Atom 1.0 feed.
func GenerateAtom(app core.App, limit int) ([]byte, error) {
	info, err := site.GetInfo(app)
	if err != nil {
		info = &site.Info{SiteName: "Vanblog", Description: "Vanblog"}
	}

	posts, err := app.FindRecordsByFilter(
		"posts", "status='published' && deleted=false", "-created", limit, 0,
	)
	if err != nil {
		return nil, err
	}

	items := make([]rss.FeedItem, len(posts))
	for i, p := range posts {
		path := p.GetString("pathname")
		if path == "" {
			path = "/posts/" + p.Id
		}
		items[i] = rss.FeedItem{
			Title:       p.GetString("title"),
			Link:        info.BaseURL + path,
			Description: excerpt(p.GetString("content")),
			PubDate:     p.GetDateTime("created").Time(),
			GUID:        info.BaseURL + path,
		}
	}

	return rss.GenerateAtom(rss.Feed{
		Title:       info.SiteName,
		Link:        info.BaseURL,
		Description: info.Description,
		Items:       items,
	})
}

// GenerateSitemap builds a sitemap.xml from published posts + site config.
func GenerateSitemap(app core.App) ([]byte, error) {
	info, err := site.GetInfo(app)
	baseURL := "http://localhost:8090"
	if err == nil && info.BaseURL != "" {
		baseURL = info.BaseURL
	}

	posts, _ := app.FindRecordsByFilter(
		"posts", "status='published' && deleted=false", "", 0, 0,
	)

	urls := []sitemap.URL{
		{Loc: baseURL + "/", ChangeFreq: "daily", Priority: 1.0},
	}
	for _, p := range posts {
		path := p.GetString("pathname")
		if path == "" {
			path = "/posts/" + p.Id
		}
		urls = append(urls, sitemap.URL{
			Loc:        baseURL + path,
			LastMod:    p.GetDateTime("created").Time(),
			ChangeFreq: "weekly",
			Priority:   0.8,
		})
	}

	return sitemap.GenerateSitemap(baseURL, urls)
}

// excerpt returns a plain-text summary of content (first 200 runes).
// Uses rune slicing to avoid splitting multi-byte UTF-8 sequences (e.g. Chinese).
func excerpt(content string) string {
	r := []rune(content)
	if len(r) <= 200 {
		return content
	}
	return string(r[:200]) + "..."
}

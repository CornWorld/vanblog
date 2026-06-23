// Package sitemap provides sitemap.xml generation.
package sitemap

import (
	"encoding/xml"
	"fmt"
	"time"
)

// URL represents a single URL entry in the sitemap.
type URL struct {
	Loc      string // Full URL
	LastMod  time.Time
	ChangeFreq string // always/hourly/daily/weekly/monthly/yearly/never
	Priority  float32 // 0.0 - 1.0
}

// GenerateSitemap produces a sitemap.xml 0.9 document.
func GenerateSitemap(baseURL string, urls []URL) ([]byte, error) {
	type sitemapURL struct {
		XMLName    xml.Name `xml:"url"`
		Loc        string   `xml:"loc"`
		LastMod    string   `xml:"lastmod,omitempty"`
		ChangeFreq string   `xml:"changefreq,omitempty"`
		Priority   string   `xml:"priority,omitempty"`
	}

	type urlset struct {
		XMLName xml.Name `xml:"urlset"`
		Xmlns   string   `xml:"xmlns,attr"`
		URLs    []sitemapURL `xml:"url"`
	}

	entries := make([]sitemapURL, len(urls))
	for i, u := range urls {
		entries[i] = sitemapURL{
			Loc:        u.Loc,
			LastMod:    u.LastMod.Format("2006-01-02"),
			ChangeFreq: u.ChangeFreq,
			Priority:   fmt.Sprintf("%.1f", u.Priority),
		}
	}

	doc := urlset{
		Xmlns: "http://www.sitemaps.org/schemas/sitemap/0.9",
		URLs:  entries,
	}

	output, err := xml.MarshalIndent(doc, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("sitemap: marshal failed: %w", err)
	}
	return append([]byte(xml.Header), output...), nil
}

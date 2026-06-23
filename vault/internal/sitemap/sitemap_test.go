package sitemap

import (
	"encoding/xml"
	"strings"
	"testing"
	"time"
)

func TestGenerateSitemap_ValidXML(t *testing.T) {
	urls := []URL{
		{
			Loc:        "https://blog.example.com/",
			LastMod:    time.Date(2026, 6, 23, 0, 0, 0, 0, time.UTC),
			ChangeFreq: "daily",
			Priority:   1.0,
		},
		{
			Loc:        "https://blog.example.com/posts/hello",
			LastMod:    time.Date(2026, 6, 20, 0, 0, 0, 0, time.UTC),
			ChangeFreq: "weekly",
			Priority:   0.8,
		},
	}

	data, err := GenerateSitemap("https://blog.example.com", urls)
	if err != nil {
		t.Fatalf("GenerateSitemap failed: %v", err)
	}

	var v interface{}
	if err := xml.Unmarshal(data, &v); err != nil {
		t.Fatalf("invalid XML: %v", err)
	}
}

func TestGenerateSitemap_ContainsURLs(t *testing.T) {
	urls := []URL{
		{Loc: "https://blog.example.com/", ChangeFreq: "daily", Priority: 1.0},
		{Loc: "https://blog.example.com/about", ChangeFreq: "monthly", Priority: 0.5},
	}

	data, _ := GenerateSitemap("", urls)
	xmlStr := string(data)

	checks := []string{
		"<urlset", "xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\"",
		"https://blog.example.com/",
		"https://blog.example.com/about",
		"<changefreq>daily</changefreq>",
		"<priority>1.0</priority>",
	}
	for _, s := range checks {
		if !strings.Contains(xmlStr, s) {
			t.Errorf("sitemap XML missing %q", s)
		}
	}
}

func TestGenerateSitemap_Empty(t *testing.T) {
	data, err := GenerateSitemap("", nil)
	if err != nil {
		t.Fatalf("empty sitemap: %v", err)
	}
	if !strings.Contains(string(data), "<urlset") {
		t.Error("empty sitemap should still be valid")
	}
}

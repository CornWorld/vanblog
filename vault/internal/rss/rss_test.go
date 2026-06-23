package rss

import (
	"encoding/xml"
	"strings"
	"testing"
	"time"
)

func sampleFeed() Feed {
	return Feed{
		Title:       "My Blog",
		Link:        "https://blog.example.com",
		Description: "A tech blog",
		Items: []FeedItem{
			{
				Title:       "First Post",
				Link:        "https://blog.example.com/posts/first",
				Description: "Hello world",
				PubDate:     time.Date(2026, 1, 15, 10, 0, 0, 0, time.UTC),
				Categories:  []string{"Go", "Docker"},
				GUID:        "https://blog.example.com/posts/first",
			},
			{
				Title:       "Second Post",
				Link:        "https://blog.example.com/posts/second",
				Description: "More content",
				PubDate:     time.Date(2026, 2, 20, 14, 30, 0, 0, time.UTC),
				Categories:  []string{"Rust"},
				GUID:        "https://blog.example.com/posts/second",
			},
		},
	}
}

func TestGenerateRSS_ValidXML(t *testing.T) {
	data, err := GenerateRSS(sampleFeed())
	if err != nil {
		t.Fatalf("GenerateRSS failed: %v", err)
	}

	// Verify it's valid XML
	var v interface{}
	if err := xml.Unmarshal(data, &v); err != nil {
		t.Fatalf("invalid XML: %v", err)
	}
}

func TestGenerateRSS_ContainsItems(t *testing.T) {
	data, _ := GenerateRSS(sampleFeed())
	xmlStr := string(data)

	checks := []string{
		"<rss", "version=\"2.0\"",
		"My Blog", "https://blog.example.com",
		"First Post", "Second Post",
		"<category>Go</category>", "<category>Docker</category>",
		"<guid>", "</guid>",
		"<item>", "</item>",
	}
	for _, s := range checks {
		if !strings.Contains(xmlStr, s) {
			t.Errorf("RSS XML missing %q", s)
		}
	}
}

func TestGenerateRSS_EmptyFeed(t *testing.T) {
	feed := Feed{Title: "Empty", Link: "http://example.com"}
	data, err := GenerateRSS(feed)
	if err != nil {
		t.Fatalf("GenerateRSS empty: %v", err)
	}
	if !strings.Contains(string(data), "<rss") {
		t.Error("empty feed should still produce valid RSS")
	}
}

func TestGenerateAtom_ValidXML(t *testing.T) {
	data, err := GenerateAtom(sampleFeed())
	if err != nil {
		t.Fatalf("GenerateAtom failed: %v", err)
	}

	var v interface{}
	if err := xml.Unmarshal(data, &v); err != nil {
		t.Fatalf("invalid XML: %v", err)
	}
}

func TestGenerateAtom_ContainsEntries(t *testing.T) {
	data, _ := GenerateAtom(sampleFeed())
	xmlStr := string(data)

	checks := []string{
		"<feed", "xmlns=\"http://www.w3.org/2005/Atom\"",
		"My Blog",
		"<entry>", "</entry>",
		"First Post", "Second Post",
		"<category", "term=\"Go\"",
	}
	for _, s := range checks {
		if !strings.Contains(xmlStr, s) {
			t.Errorf("Atom XML missing %q", s)
		}
	}
}

func TestGenerateAtom_DateFormat(t *testing.T) {
	data, _ := GenerateAtom(sampleFeed())
	xmlStr := string(data)
	// Atom uses RFC3339 dates
	if !strings.Contains(xmlStr, "2026-01-15T10:00:00") {
		t.Errorf("Atom should have RFC3339 date, got: %s", xmlStr)
	}
}

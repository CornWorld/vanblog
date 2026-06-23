// Package rss provides RSS 2.0 and Atom 1.0 feed generation.
package rss

import (
	"encoding/xml"
	"fmt"
	"time"
)

// Feed represents an RSS 2.0 / Atom 1.0 feed.
type Feed struct {
	Title       string
	Link        string // Site base URL
	Description string
	Items       []FeedItem
}

// FeedItem represents a single article in the feed.
type FeedItem struct {
	Title       string
	Link        string // Full URL to article
	Description string // Excerpt or summary
	PubDate     time.Time
	Categories  []string
	GUID        string // Unique identifier (usually the Link)
}

// GenerateRSS produces RSS 2.0 XML.
func GenerateRSS(feed Feed) ([]byte, error) {
	type rssItem struct {
		XMLName     xml.Name `xml:"item"`
		Title       string   `xml:"title"`
		Link        string   `xml:"link"`
		Description string   `xml:"description"`
		PubDate     string   `xml:"pubDate"`
		Categories  []string `xml:"category"`
		GUID        string   `xml:"guid"`
	}

	type rssChannel struct {
		XMLName       xml.Name `xml:"channel"`
		Title         string   `xml:"title"`
		Link          string   `xml:"link"`
		Description   string   `xml:"description"`
		LastBuildDate string   `xml:"lastBuildDate"`
		Items         []rssItem `xml:"item"`
	}

	type rssDoc struct {
		XMLName xml.Name   `xml:"rss"`
		Version string     `xml:"version,attr"`
		Channel rssChannel `xml:"channel"`
	}

	items := make([]rssItem, len(feed.Items))
	for i, item := range feed.Items {
		pubDate := item.PubDate.Format(time.RFC1123Z)
		items[i] = rssItem{
			Title:       item.Title,
			Link:        item.Link,
			Description: item.Description,
			PubDate:     pubDate,
			Categories:  item.Categories,
			GUID:        item.GUID,
		}
	}

	lastBuild := time.Now().Format(time.RFC1123Z)
	if len(feed.Items) > 0 {
		lastBuild = feed.Items[0].PubDate.Format(time.RFC1123Z)
	}

	doc := rssDoc{
		Version: "2.0",
		Channel: rssChannel{
			Title:         feed.Title,
			Link:          feed.Link,
			Description:   feed.Description,
			LastBuildDate: lastBuild,
			Items:         items,
		},
	}

	output, err := xml.MarshalIndent(doc, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("rss: marshal failed: %w", err)
	}
	return append([]byte(xml.Header), output...), nil
}

// GenerateAtom produces Atom 1.0 XML.
func GenerateAtom(feed Feed) ([]byte, error) {
	type atomLink struct {
		Href string `xml:"href,attr"`
	}

	type atomCategory struct {
		Term string `xml:"term,attr"`
	}

	type atomEntry struct {
		XMLName    xml.Name      `xml:"entry"`
		Title      string        `xml:"title"`
		Link       atomLink      `xml:"link"`
		ID         string        `xml:"id"`
		Updated    string        `xml:"updated"`
		Summary    string        `xml:"summary"`
		Categories []atomCategory `xml:"category"`
	}

	type atomFeed struct {
		XMLName xml.Name    `xml:"feed"`
		Xmlns   string      `xml:"xmlns,attr"`
		Title   string      `xml:"title"`
		Link    atomLink    `xml:"link"`
		ID      string      `xml:"id"`
		Updated string      `xml:"updated"`
		Entries []atomEntry `xml:"entry"`
	}

	entries := make([]atomEntry, len(feed.Items))
	for i, item := range feed.Items {
		cats := make([]atomCategory, len(item.Categories))
		for j, c := range item.Categories {
			cats[j] = atomCategory{Term: c}
		}
		entries[i] = atomEntry{
			Title:      item.Title,
			Link:       atomLink{Href: item.Link},
			ID:         item.GUID,
			Updated:    item.PubDate.Format(time.RFC3339),
			Summary:    item.Description,
			Categories: cats,
		}
	}

	updated := time.Now().Format(time.RFC3339)
	if len(feed.Items) > 0 {
		updated = feed.Items[0].PubDate.Format(time.RFC3339)
	}

	doc := atomFeed{
		Xmlns:   "http://www.w3.org/2005/Atom",
		Title:   feed.Title,
		Link:    atomLink{Href: feed.Link},
		ID:      feed.Link,
		Updated: updated,
		Entries: entries,
	}

	output, err := xml.MarshalIndent(doc, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("rss: atom marshal failed: %w", err)
	}
	return append([]byte(xml.Header), output...), nil
}

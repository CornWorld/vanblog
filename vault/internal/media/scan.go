package media

import (
	"encoding/json"
	"fmt"
	"io"
	"regexp"

	"github.com/pocketbase/pocketbase/core"
)

// ScanArticleImages scans a post's content for <img src="..."> URLs and
// creates or links media records for each unique image.
//
// This replaces the original static.provider.ts scanLinksOfArticles() behavior.
// Only external URLs (http/https) are tracked; pb-hosted images are already
// in the media collection.
func (m *Manager) ScanArticleImages(postID string) error {
	post, err := m.app.FindRecordById("posts", postID)
	if err != nil {
		return fmt.Errorf("media: post not found: %w", err)
	}

	content := post.GetString("content")
	if content == "" {
		return nil
	}

	// Extract all <img src="..."> URLs
	urls := extractImgSrcs(content)
	if len(urls) == 0 {
		return nil
	}

	col, err := m.app.FindCollectionByNameOrId("media")
	if err != nil {
		return fmt.Errorf("media: collection not found: %w", err)
	}

	for _, url := range urls {
		// Skip pb-hosted images (they're already tracked)
		if isInternalURL(url) {
			continue
		}

		// Check if this URL already has a media record
		existing, err := m.app.FindFirstRecordByFilter(
			"media",
			"externalUrl={:url}",
			map[string]any{"url": url},
		)
		if err == nil && existing != nil {
			continue // already tracked
		}

		// Create a media record for the external image
		record := core.NewRecord(col)
		record.Set("staticType", "img")
		record.Set("storageType", "external")
		record.Set("externalUrl", url)
		record.Set("meta", json.RawMessage(`{"source": "article_scan", "post": "`+postID+`"}`))
		if err := m.app.Save(record); err != nil {
			// Log but continue — partial scan is better than none
			continue
		}
	}

	return nil
}

// imgSrcPattern matches <img src="..."> and <img src='...'> tags.
var imgSrcPattern = regexp.MustCompile(`<img[^>]+src=["']([^"']+)["']`)

// extractImgSrcs returns all unique image URLs from HTML content.
func extractImgSrcs(html string) []string {
	matches := imgSrcPattern.FindAllStringSubmatch(html, -1)
	seen := make(map[string]bool)
	var urls []string
	for _, m := range matches {
		if len(m) >= 2 && !seen[m[1]] {
			seen[m[1]] = true
			urls = append(urls, m[1])
		}
	}
	return urls
}

// isInternalURL checks if a URL points to the vanblog instance itself
// (relative path or localhost).
func isInternalURL(url string) bool {
	// Relative URLs (starts with / or ./ )
	if len(url) > 0 && (url[0] == '/' || url[:2] == "./") {
		return true
	}
	// pb-served files
	return regexp.MustCompile(`^https?://[^/]+/(api/files|static)/`).MatchString(url)
}

// ReadFileContent reads the file content from a media record's FileField.
// Used by the dedup hook to compute MD5 after upload.
func (m *Manager) ReadFileContent(record *core.Record) ([]byte, error) {
	fsys, err := m.app.NewFilesystem()
	if err != nil {
		return nil, fmt.Errorf("media: filesystem init failed: %w", err)
	}
	defer fsys.Close()

	filename := record.GetString("file")
	if filename == "" {
		return nil, fmt.Errorf("media: no file attached to record")
	}

	// pb stores files as <recordID>/<filename>
	path := record.Id + "/" + filename
	r, err := fsys.GetReader(path)
	if err != nil {
		return nil, fmt.Errorf("media: failed to read file %q: %w", path, err)
	}
	defer r.Close()

	return io.ReadAll(r)
}

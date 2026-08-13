package media

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"

	"github.com/cornworld/vanblog/internal/mediaurl"
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
	urls := mediaurl.ExtractImgSrcs(content)
	if len(urls) == 0 {
		return nil
	}

	col, err := m.app.FindCollectionByNameOrId("media")
	if err != nil {
		return fmt.Errorf("media: collection not found: %w", err)
	}

	for _, url := range urls {
		// Skip pb-hosted images (they're already tracked)
		if mediaurl.IsInternalURL(url) {
			continue
		}

		// Check if this URL already has a media record
		existing, err := m.app.FindFirstRecordByFilter(
			"media",
			"externalUrl={:url}",
			map[string]any{"url": url},
		)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return fmt.Errorf("media: scan query failed for url %q: %w", url, err)
		}
		if existing != nil {
			continue // already tracked
		}

		// Create a media record for the external image
		meta, _ := json.Marshal(map[string]string{
			"source": "article_scan",
			"post":   postID,
		})
		record := core.NewRecord(col)
		record.Set("staticType", "img")
		record.Set("storageType", "external")
		record.Set("externalUrl", url)
		record.Set("meta", json.RawMessage(meta))
		if err := m.app.Save(record); err != nil {
			// Log but continue — partial scan is better than none
			continue
		}
	}

	return nil
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

	// pb stores files as <collectionId>/<recordId>/<filename> (see Record.BaseFilesPath)
	path := record.BaseFilesPath() + "/" + filename
	r, err := fsys.GetReader(path)
	if err != nil {
		return nil, fmt.Errorf("media: failed to read file %q: %w", path, err)
	}
	defer r.Close()

	return io.ReadAll(r)
}


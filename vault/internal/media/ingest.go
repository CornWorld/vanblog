package media

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"path"
	"strings"
	"time"

	"github.com/cornworld/vanblog/internal/mediaurl"
	"github.com/pocketbase/pocketbase/core"
)

// IngestExternalImages scans a post's content for external image URLs
// (http/https), downloads each one, stores it as a local media record, and
// rewrites the content to reference the new local URL.
//
// This implements #434: "是否可以添加图片外链转化功能" — users paste articles
// from CSDN/Zhihu/etc. with external image URLs and want them localized.
//
// The operation is destructive (modifies post.content), so it is exposed as
// an explicit API call (POST /api/vanblog/posts/{id}/ingest-images) rather
// than an automatic hook. The caller must be an admin or article:* holder.
func (m *Manager) IngestExternalImages(postID string) (ingested int, failed int, err error) {
	post, err := m.app.FindRecordById("posts", postID)
	if err != nil {
		return 0, 0, fmt.Errorf("media: post not found: %w", err)
	}

	content := post.GetString("content")
	if content == "" {
		return 0, 0, nil
	}

	urls := mediaurl.ExtractExternalImgURLs(content)
	if len(urls) == 0 {
		return 0, 0, nil
	}

	mediaCol, err := m.app.FindCollectionByNameOrId("media")
	if err != nil {
		return 0, 0, fmt.Errorf("media: collection not found: %w", err)
	}

	client := &http.Client{Timeout: 30 * time.Second}

	for _, imgURL := range urls {
		newURL, err := m.downloadAndStore(client, mediaCol, imgURL)
		if err != nil {
			slog.Warn("[media] ingest: failed to download",
				"url", imgURL, "err", err)
			failed++
			continue
		}
		content = strings.ReplaceAll(content, imgURL, newURL)
		ingested++

		// The scan hook (async goroutine) may race with us and create a
		// duplicate file-less tracking record for the same externalUrl.
		// Clean up any such records so only the localized one remains.
		m.cleanupDuplicateTrackers(imgURL)
	}

	// Only save if content changed
	if ingested > 0 {
		post.Set("content", content)
		if err := m.app.Save(post); err != nil {
			return ingested, failed, fmt.Errorf("media: failed to save post: %w", err)
		}
	}

	return ingested, failed, nil
}

// downloadAndStore fetches an external image, stores it as a local media
// record, and returns the new local /api/files/ URL.
func (m *Manager) downloadAndStore(
	client *http.Client,
	mediaCol *core.Collection,
	imgURL string,
) (string, error) {
	// Check if this URL was already ingested (idempotent)
	existing, err := m.app.FindFirstRecordByFilter(
		"media",
		"externalUrl={:url}",
		map[string]any{"url": imgURL},
	)
	if err == nil && existing != nil && existing.GetString("file") != "" {
		// Already downloaded — reuse the existing file URL
		filename := existing.GetString("file")
		return fmt.Sprintf("/api/files/%s/%s",
			existing.BaseFilesPath(), filename), nil
	}
req, err := http.NewRequestWithContext(context.Background(), http.MethodGet, imgURL, nil)
	if err != nil {
		return "", fmt.Errorf("create request: %w", err)
	}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("download failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("download returned status %d", resp.StatusCode)
	}

	// Read up to 25MB to prevent abuse
	body, err := io.ReadAll(io.LimitReader(resp.Body, 25*1024*1024))
	if err != nil {
		return "", fmt.Errorf("read body: %w", err)
	}

	// Determine filename from URL path
	filename := path.Base(imgURL)
	if filename == "" || filename == "/" || filename == "." {
		filename = "image"
	}

	// If the scan hook already created a tracking record for this externalUrl
	// (file empty), attach the file to it instead of creating a duplicate.
	var record *core.Record
	if existing != nil {
		record = existing
		record.Set("storageType", "local")
		if err := AttachFile(m.app, record, body, filename); err != nil {
			return "", err
		}
	} else {
		var err error
		record, err = StoreLocalFile(m.app, body, filename, imgURL, "img")
		if err != nil {
			return "", err
		}
	}

	newFilename := record.GetString("file")
	return fmt.Sprintf("/api/files/%s/%s",
		record.BaseFilesPath(), newFilename), nil
}

// cleanupDuplicateTrackers removes media records for the same externalUrl
// that were created by the scan hook without a file (tracking-only), after a
// localized copy has been stored. This guards against the async scan
// goroutine racing IngestExternalImages and leaving a duplicate record.
func (m *Manager) cleanupDuplicateTrackers(externalURL string) {
	records, err := m.app.FindRecordsByFilter(
		"media",
		"externalUrl={:url}",
		"created",
		0, 0,
		map[string]any{"url": externalURL},
	)
	if err != nil {
		slog.Warn("[media] ingest: cleanup query failed", "err", err)
		return
	}
	for _, rec := range records {
		if rec.GetString("file") != "" {
			continue // this is the localized copy — keep it
		}
		if err := m.app.Delete(rec); err != nil {
			slog.Warn("[media] ingest: failed to delete tracker", "id", rec.Id, "err", err)
		}
	}
}

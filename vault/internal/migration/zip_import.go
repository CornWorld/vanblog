package migration

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"path"
	"strings"

	"github.com/cornworld/vanblog/internal/media"
	"github.com/cornworld/vanblog/internal/migrationschema"
	"github.com/cornworld/vanblog/internal/mediaurl"
	"github.com/pocketbase/pocketbase/core"
)

// ImportZip reads a zip archive produced by the export endpoints and imports
// all posts + images into pb collections.
//
// Zip layout (produced by admin/export.go):
//
//	posts.json          — array of migrationschema.Post
//	images/{collId}/{recId}/{filename} — binary image files
//
// For each post:
//  1. Create a posts record (title, content, status, category, tags, etc.)
//  2. For each image referenced in content: upload to pb filesystem under
//     a NEW media record, then rewrite the <img src> in content to point
//     to the new record's file URL.
//  3. Category/tag names are resolved to IDs (creating records as needed).
//
// ImportZip creates fresh records — exported IDs are ephemeral.
func (imp *Importer) ImportZip(zipData []byte) (*Result, error) {
	result := &Result{Errors: []string{}}

	zr, err := zip.NewReader(bytes.NewReader(zipData), int64(len(zipData)))
	if err != nil {
		return nil, fmt.Errorf("migration: failed to open zip: %w", err)
	}

	// Read posts.json (full export) or post.json (single-post export).
	var posts []migrationschema.Post
	isSingle := false
	postsFile := findZipEntry(zr, "posts.json")
	if postsFile == nil {
		// Maybe single-post export (post.json) — a single object, not array
		postsFile = findZipEntry(zr, "post.json")
		isSingle = true
		if postsFile == nil {
			return nil, fmt.Errorf("migration: zip missing posts.json/post.json")
		}
	}

	rc, err := postsFile.Open()
	if err != nil {
		return nil, fmt.Errorf("migration: failed to open posts json: %w", err)
	}
	defer rc.Close()
	data, err := io.ReadAll(rc)
	if err != nil {
		return nil, fmt.Errorf("migration: failed to read posts json: %w", err)
	}

	if isSingle {
		var single migrationschema.Post
		if err := json.Unmarshal(data, &single); err != nil {
			return nil, fmt.Errorf("migration: failed to parse post json: %w", err)
		}
		posts = []migrationschema.Post{single}
	} else if err := json.Unmarshal(data, &posts); err != nil {
		return nil, fmt.Errorf("migration: failed to parse posts json: %w", err)
	}

	// Build image map: {collId}/{recId}/{filename} → zip entry
	imageEntries := make(map[string]*zip.File)
	for _, f := range zr.File {
		if strings.HasPrefix(f.Name, "images/") {
			cleanPath := strings.TrimPrefix(f.Name, "images/")
			imageEntries[cleanPath] = f
		}
	}

	// Process each post in a transaction
	err = imp.app.RunInTransaction(func(txApp core.App) error {
		catMap := make(map[string]string) // name → new record ID
		tagMap := make(map[string]string)

		for _, ep := range posts {
			if err := imp.importZipPost(txApp, ep, imageEntries, catMap, tagMap); err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("post %q: %v", ep.Title, err))
				continue
			}
			result.Posts++
		}
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("migration: zip import transaction failed: %w", err)
	}

	return result, nil
}

// importZipPost creates a single post from an export entry, uploads its
// images, and rewrites content URLs.
func (imp *Importer) importZipPost(
	txApp core.App,
	ep migrationschema.Post,
	imageEntries map[string]*zip.File,
	catMap, tagMap map[string]string,
) error {
	col, err := txApp.FindCollectionByNameOrId("posts")
	if err != nil {
		return err
	}

	content := ep.Content

	// Upload images and rewrite content URLs.
	// Extract all /api/files/{path} references from content and replace
	// with new media record URLs.
	content = imp.uploadImagesAndRewrite(txApp, content, imageEntries)

	record := core.NewRecord(col)
	record.Set("title", ep.Title)
	record.Set("content", content)
	record.Set("status", ep.Status)
	if ep.Status == "" {
		record.Set("status", "published")
	}
	record.Set("pathname", ep.Pathname)
	record.Set("private", ep.Private)
	if ep.Password != "" {
		record.Set("password", ep.Password)
	}
	record.Set("top", ep.Top)
	record.Set("copyright", ep.Copyright)

	// Resolve category
	if ep.Category != "" {
		catID, ok := catMap[ep.Category]
		if !ok {
			catID, err = imp.findOrCreateCategory(txApp, ep.Category)
			if err != nil {
				return fmt.Errorf("category %q: %w", ep.Category, err)
			}
			catMap[ep.Category] = catID
		}
		record.Set("category", catID)
	}

	// Resolve tags
	if len(ep.Tags) > 0 {
		tagIDs := []string{}
		for _, tagName := range ep.Tags {
			if tagName == "" {
				continue
			}
			tagID, ok := tagMap[tagName]
			if !ok {
				tagID, err = imp.findOrCreateTag(txApp, tagName)
				if err != nil {
					continue
				}
				tagMap[tagName] = tagID
			}
			tagIDs = append(tagIDs, tagID)
		}
		record.Set("tags", tagIDs)
	}

	return txApp.Save(record)
}

// uploadImagesAndRewrite finds all /api/files/{path} URLs in content,
// uploads the corresponding image from the zip to a new media record,
// and rewrites the URL to point to the new record.
func (imp *Importer) uploadImagesAndRewrite(
	txApp core.App,
	content string,
	imageEntries map[string]*zip.File,
) string {
	paths := mediaurl.ExtractAPIFilePaths(content)
	if len(paths) == 0 {
		return content
	}

	for _, oldPath := range paths {
		zipEntry, ok := imageEntries[oldPath]
		if !ok {
			// Image not in zip (external URL or missing) — leave URL as-is
			continue
		}

		// Read image bytes from zip
		rc, err := zipEntry.Open()
		if err != nil {
			slog.Warn("[migration] failed to open zip image", "path", oldPath, "err", err)
			continue
		}
		imgData, err := io.ReadAll(rc)
		rc.Close()
		if err != nil {
			slog.Warn("[migration] failed to read zip image", "path", oldPath, "err", err)
			continue
		}

		// Create a media record carrying the file. media.StoreLocalFile handles
		// pb's FileField random-prefix renaming; we must read the stored name
		// back from the record for the URL.
		filename := path.Base(oldPath)
		mediaRecord, err := media.StoreLocalFile(txApp, imgData, filename, "", "img")
		if err != nil {
			slog.Warn("[migration] failed to store media", "file", filename, "err", err)
			continue
		}

		// Rewrite content: replace old /api/files/{oldPath} with the new URL.
		newFilename := mediaRecord.GetString("file")
		if newFilename == "" {
			newFilename = filename
		}
		newURL := fmt.Sprintf("/api/files/%s/%s",
			mediaRecord.BaseFilesPath(), newFilename)
		oldURL := "/api/files/" + oldPath
		content = strings.ReplaceAll(content, oldURL, newURL)
	}

	return content
}

// findOrCreateCategory looks up a category by name, creating it if missing.
func (imp *Importer) findOrCreateCategory(txApp core.App, name string) (string, error) {
	existing, err := txApp.FindFirstRecordByFilter(
		"categories", "name={:name}", map[string]any{"name": name},
	)
	if err == nil && existing != nil {
		return existing.Id, nil
	}

	col, err := txApp.FindCollectionByNameOrId("categories")
	if err != nil {
		return "", err
	}
	record := core.NewRecord(col)
	record.Set("name", name)
	if err := txApp.Save(record); err != nil {
		return "", err
	}
	return record.Id, nil
}

// findOrCreateTag looks up a tag by name, creating it if missing.
func (imp *Importer) findOrCreateTag(txApp core.App, name string) (string, error) {
	existing, err := txApp.FindFirstRecordByFilter(
		"tags", "name={:name}", map[string]any{"name": name},
	)
	if err == nil && existing != nil {
		return existing.Id, nil
	}

	col, err := txApp.FindCollectionByNameOrId("tags")
	if err != nil {
		return "", err
	}
	record := core.NewRecord(col)
	record.Set("name", name)
	record.Set("oldName", name)
	if err := txApp.Save(record); err != nil {
		return "", err
	}
	return record.Id, nil
}

// findZipEntry searches for a file in the zip by name.
func findZipEntry(zr *zip.Reader, name string) *zip.File {
	for _, f := range zr.File {
		if path.Base(f.Name) == name {
			return f
		}
	}
	return nil
}

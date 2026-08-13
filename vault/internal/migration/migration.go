// Package migration provides ZIP-based post import for Vanblog.
//
// The import endpoint accepts a ZIP archive produced by the export API
// (GET /api/vanblog/export/post/{id} or GET /api/vanblog/export/all).
// The ZIP contains:
//
//	posts.json (or post.json)  — array of post metadata
//	images/{collId}/{recId}/{filename} — referenced image binaries
//
// Import creates fresh posts/media records and rewrites image URLs in post
// content to point to the new records.
package migration

import "github.com/pocketbase/pocketbase/core"

// Result reports the outcome of an import operation.
type Result struct {
	Posts  int      `json:"posts"`
	Errors []string `json:"errors"`
}

// Importer handles ZIP-based data import.
type Importer struct {
	app core.App
}

// New creates an Importer.
func New(app core.App) *Importer {
	return &Importer{app: app}
}

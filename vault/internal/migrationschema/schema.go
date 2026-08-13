// Package migrationschema defines the JSON wire format shared between the
// export API (admin/export.go) and the ZIP import (migration/zip_import.go).
//
// Both sides must agree on this shape. Before this package existed, the two
// packages each declared their own copy (exportPostJSON / exportPostShape),
// held together only by a comment — a change to one silently broke the other.
// Now there is a single source of truth.
package migrationschema

// Post is the JSON representation of one post in an export zip.
// Both the full-export array (posts.json) and single-post export (post.json)
// use this shape. Category/Tags are stored by NAME (not record id) so the
// import side can resolve-or-create them by name.
type Post struct {
	ID        string   `json:"id"`
	Title     string   `json:"title"`
	Content   string   `json:"content"`
	Status    string   `json:"status"`
	Pathname  string   `json:"pathname"`
	Private   bool     `json:"private"`
	Password  string   `json:"password,omitempty"`
	Top       int      `json:"top"`
	Copyright string   `json:"copyright"`
	Category  string   `json:"category"`
	Tags      []string `json:"tags"`
	Created   string   `json:"created"`
	Updated   string   `json:"updated"`
}

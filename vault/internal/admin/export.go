package admin

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"path"

	"github.com/cornworld/vanblog/internal/migrationschema"
	"github.com/cornworld/vanblog/internal/mediaurl"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/filesystem"
)

// handleExportPost returns a single post + its internal images as a zip.
//
// The zip contains:
//   - post.json: post metadata + rendered content
//   - images/:  binary files for <img src="/api/files/..."> referenced in content
//
// External images (http/https URLs) are NOT downloaded — only pb-hosted files
// are included, since those are the ones the user owns and would lose on
// migration.
func (m *Manager) handleExportPost(e *core.RequestEvent) error {
	if !requireAdmin(e.Auth) {
		return e.ForbiddenError("admin role required", "")
	}

	postID := e.Request.PathValue("id")
	if postID == "" {
		return e.BadRequestError("missing path parameter {id}", "")
	}

	post, err := m.app.FindRecordById("posts", postID)
	if err != nil {
		return e.NotFoundError("post not found", "")
	}

	ep := buildExportPost(m.app, post)
	imagePaths := mediaurl.ExtractAPIFilePaths(post.GetString("content"))

	e.Response.Header().Set("Content-Type", "application/zip")
	e.Response.Header().Set("Content-Disposition",
		fmt.Sprintf(`attachment; filename="post_%s.zip"`, postID))

	zw := zip.NewWriter(e.Response)
	defer zw.Close()

	writeZipJSON(zw, "post.json", ep)

	fsys, err := m.app.NewFilesystem()
	if err != nil {
		slog.Warn("[export] filesystem init failed", "err", err)
	} else {
		defer fsys.Close()
		for _, imgPath := range imagePaths {
			if err := writeZipFileFromFS(zw, fsys, imgPath); err != nil {
				slog.Warn("[export] failed to include image", "path", imgPath, "err", err)
			}
		}
	}

	return nil
}

// handleExportAll exports every non-deleted post + all referenced internal
// images as a zip. This is the "full backup for migration" endpoint.
func (m *Manager) handleExportAll(e *core.RequestEvent) error {
	if !requireAdmin(e.Auth) {
		return e.ForbiddenError("admin role required", "")
	}

	// perPage=0 means "all records" in pb's FindRecordsByFilter
	posts, err := m.app.FindRecordsByFilter("posts", "deleted=false", "-created", 0, 0)
	if err != nil {
		return e.InternalServerError("failed to query posts", "")
	}

	e.Response.Header().Set("Content-Type", "application/zip")
	e.Response.Header().Set("Content-Disposition",
		`attachment; filename="vanblog_export.zip"`)

	zw := zip.NewWriter(e.Response)
	defer zw.Close()

	allImagePaths := make(map[string]bool)
	exportPosts := make([]migrationschema.Post, 0, len(posts))
	for _, p := range posts {
		ep := buildExportPost(m.app, p)
		exportPosts = append(exportPosts, ep)
		for _, imgPath := range mediaurl.ExtractAPIFilePaths(p.GetString("content")) {
			allImagePaths[imgPath] = true
		}
	}

	writeZipJSON(zw, "posts.json", exportPosts)

	fsys, err := m.app.NewFilesystem()
	if err != nil {
		slog.Warn("[export] filesystem init failed", "err", err)
	} else {
		defer fsys.Close()
		for imgPath := range allImagePaths {
			if err := writeZipFileFromFS(zw, fsys, imgPath); err != nil {
				slog.Warn("[export] failed to include image", "path", imgPath, "err", err)
			}
		}
	}

	return nil
}

// buildExportPost resolves category/tag IDs to names and builds the export shape.
func buildExportPost(app core.App, post *core.Record) migrationschema.Post {
	ep := migrationschema.Post{
		ID:        post.Id,
		Title:     post.GetString("title"),
		Content:   post.GetString("content"),
		Status:    post.GetString("status"),
		Pathname:  post.GetString("pathname"),
		Private:   post.GetBool("private"),
		Password:  post.GetString("password"),
		Top:       post.GetInt("top"),
		Copyright: post.GetString("copyright"),
		Created:   post.GetString("created"),
		Updated:   post.GetString("updated"),
	}

	if catID := post.GetString("category"); catID != "" {
		if cat, err := app.FindRecordById("categories", catID); err == nil {
			ep.Category = cat.GetString("name")
		}
	}

	ep.Tags = []string{}
	for _, tagID := range post.GetStringSlice("tags") {
		if tag, err := app.FindRecordById("tags", tagID); err == nil {
			ep.Tags = append(ep.Tags, tag.GetString("name"))
		}
	}

	return ep
}

// writeZipJSON marshals v as JSON and writes it to the zip under filename.
func writeZipJSON(zw *zip.Writer, filename string, v any) {
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		slog.Warn("[export] JSON marshal failed", "file", filename, "err", err)
		return
	}
	w, err := zw.Create(filename)
	if err != nil {
		slog.Warn("[export] zip create failed", "file", filename, "err", err)
		return
	}
	if _, err := w.Write(data); err != nil {
		slog.Warn("[export] zip write failed", "file", filename, "err", err)
	}
}

// writeZipFileFromFS reads a file from pb's filesystem and adds it to the zip.
// srcPath is the pb filesystem path: {collectionId}/{recordId}/{filename}
func writeZipFileFromFS(zw *zip.Writer, fsys *filesystem.System, srcPath string) error {
	r, err := fsys.GetReader(srcPath)
	if err != nil {
		return err
	}
	defer r.Close()

	w, err := zw.Create(path.Join("images", srcPath))
	if err != nil {
		return err
	}

	_, err = io.Copy(w, r)
	return err
}

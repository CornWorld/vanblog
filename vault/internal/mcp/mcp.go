package mcp

// mcp.go implements the admin-only MCP-style tool endpoints for theme /
// palette authoring tooling (agent + admin UI).
//
// All routes are mounted under /api/vanblog/mcp/* and require an admin auth
// record — non-admins get 403, mirroring internal/agent and internal/caddy.
// Endpoints deliberately do not touch vault/, sdk/, docs/, scripts/ (the path
// whitelist in paths.go enforces that); pb_query is strictly read-only.
//
// preview and build tools are intentionally NOT implemented in this phase —
// they depend on infra that does not exist yet. See docs/theme-implementer-guide.md §11.

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"time"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/search"
)

const (
	// maxReadSize caps read_file responses at 100 KB (larger files are
	// truncated and flagged).
	maxReadSize = 100 * 1024
	// maxWriteSize caps a single write_file payload (defensive; admin-only).
	maxWriteSize = 1 * 1024 * 1024
	// overrideCheckTimeout bounds the node subprocess run.
	overrideCheckTimeout = 30 * time.Second

	// rootEnv overrides the repo root used to anchor path resolution and the
	// override-check subprocess. Defaults to os.Getwd() (dev container cwd =
	// repo root).
	rootEnv = "VANBLOG_MCP_ROOT"
)

// Manager serves the MCP tool endpoints.
type Manager struct {
	app core.App
}

// New wires the MCP tool routes onto the PB serve mux.
func New(app core.App) *Manager {
	m := &Manager{app: app}
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		se.Router.POST("/api/vanblog/mcp/read_file", m.handleReadFile)
		se.Router.POST("/api/vanblog/mcp/list_dir", m.handleListDir)
		se.Router.POST("/api/vanblog/mcp/write_file", m.handleWriteFile)
		se.Router.Any("/api/vanblog/mcp/pb_schema", m.handlePBSchema)
		se.Router.Any("/api/vanblog/mcp/pb_query", m.handlePBQuery)
		se.Router.GET("/api/vanblog/mcp/override_check", m.handleOverrideCheck)
		return se.Next()
	})
	return m
}

// isAdmin mirrors internal/agent.isAdmin — duplicated here (like internal/caddy
// duplicates requireAdmin) so the mcp package stays dependency-free and the
// admin-only gate is self-contained.
func isAdmin(e *core.RequestEvent) bool {
	if e.Auth == nil {
		return false
	}
	return e.Auth.GetString("role") == "admin"
}

// repoRoot returns the repository root for MCP path resolution.
func repoRoot() (string, error) {
	if root := os.Getenv(rootEnv); root != "" {
		return root, nil
	}
	return os.Getwd()
}

// resolve validates rel against the whitelist and returns the safe absolute
// path under the repo root.
func resolve(rel string, write bool) (string, error) {
	root, err := repoRoot()
	if err != nil {
		return "", err
	}
	return resolveAllowed(root, rel, write)
}

type pathRequest struct {
	Path string `json:"path"`
}

type writeRequest struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

// read_file: POST {"path": ...} → {ok, content, truncated?}
//
//	404 if missing, 403 if outside the whitelist, >100KB truncated.
func (m *Manager) handleReadFile(e *core.RequestEvent) error {
	if !isAdmin(e) {
		return e.ForbiddenError("admin required", "")
	}
	// Cap the request body before decoding so an oversized payload cannot
	// exhaust server memory (defense-in-depth; admin-only endpoint).
	e.Request.Body = http.MaxBytesReader(e.Response, e.Request.Body, maxWriteSize+8*1024)
	var req pathRequest
	if err := json.NewDecoder(e.Request.Body).Decode(&req); err != nil {
		return e.BadRequestError("invalid JSON body", "")
	}
	abs, err := resolve(req.Path, false)
	if err != nil {
		slog.Error("mcp read_file: path not allowed", "path", req.Path, "err", err)
		return e.ForbiddenError("path not allowed", "")
	}

	root, err := repoRoot()
	if err != nil {
		slog.Error("mcp read_file: cannot resolve repo root", "err", err)
		return e.ForbiddenError("path not allowed", "")
	}
	if err := guardSymlink(root, abs, false); err != nil {
		if os.IsNotExist(err) {
			return e.NotFoundError("file not found", "")
		}
		slog.Error("mcp read_file: symlink guard failed", "path", req.Path, "err", err)
		return e.ForbiddenError("path not allowed", "")
	}

	info, err := os.Stat(abs)
	if err != nil {
		if os.IsNotExist(err) {
			return e.NotFoundError("file not found", "")
		}
		slog.Error("mcp read_file: stat failed", "path", req.Path, "err", err)
		return e.JSON(http.StatusInternalServerError, map[string]any{"ok": false, "error": "file operation failed"})
	}
	if info.IsDir() {
		return e.BadRequestError("path is a directory, use list_dir", "")
	}

	f, err := os.Open(abs)
	if err != nil {
		slog.Error("mcp read_file: open failed", "path", req.Path, "err", err)
		return e.JSON(http.StatusInternalServerError, map[string]any{"ok": false, "error": "file operation failed"})
	}
	defer f.Close()

	// Read up to maxReadSize+1 so we can detect truncation reliably.
	data, err := io.ReadAll(io.LimitReader(f, maxReadSize+1))
	if err != nil {
		slog.Error("mcp read_file: read failed", "path", req.Path, "err", err)
		return e.JSON(http.StatusInternalServerError, map[string]any{"ok": false, "error": "file operation failed"})
	}
	truncated := len(data) > maxReadSize
	if truncated {
		data = data[:maxReadSize]
	}
	return e.JSON(http.StatusOK, map[string]any{
		"ok":        true,
		"content":   string(data),
		"truncated": truncated,
	})
}

// list_dir: POST {"path": ...} → {ok, entries:[{name,isDir}]} sorted by name.
func (m *Manager) handleListDir(e *core.RequestEvent) error {
	if !isAdmin(e) {
		return e.ForbiddenError("admin required", "")
	}
	// Cap the request body before decoding so an oversized payload cannot
	// exhaust server memory (defense-in-depth; admin-only endpoint).
	e.Request.Body = http.MaxBytesReader(e.Response, e.Request.Body, maxWriteSize+8*1024)
	var req pathRequest
	if err := json.NewDecoder(e.Request.Body).Decode(&req); err != nil {
		return e.BadRequestError("invalid JSON body", "")
	}
	abs, err := resolve(req.Path, false)
	if err != nil {
		slog.Error("mcp list_dir: path not allowed", "path", req.Path, "err", err)
		return e.ForbiddenError("path not allowed", "")
	}

	root, err := repoRoot()
	if err != nil {
		slog.Error("mcp list_dir: cannot resolve repo root", "err", err)
		return e.ForbiddenError("path not allowed", "")
	}
	if err := guardSymlink(root, abs, false); err != nil {
		if os.IsNotExist(err) {
			return e.NotFoundError("directory not found", "")
		}
		slog.Error("mcp list_dir: symlink guard failed", "path", req.Path, "err", err)
		return e.ForbiddenError("path not allowed", "")
	}

	info, err := os.Stat(abs)
	if err != nil {
		if os.IsNotExist(err) {
			return e.NotFoundError("directory not found", "")
		}
		slog.Error("mcp list_dir: stat failed", "path", req.Path, "err", err)
		return e.JSON(http.StatusInternalServerError, map[string]any{"ok": false, "error": "file operation failed"})
	}
	if !info.IsDir() {
		return e.BadRequestError("path is not a directory, use read_file", "")
	}

	entries, err := os.ReadDir(abs)
	if err != nil {
		slog.Error("mcp list_dir: readdir failed", "path", req.Path, "err", err)
		return e.JSON(http.StatusInternalServerError, map[string]any{"ok": false, "error": "file operation failed"})
	}

	type dirEntry struct {
		Name  string `json:"name"`
		IsDir bool   `json:"isDir"`
	}
	list := make([]dirEntry, 0, len(entries))
	for _, de := range entries {
		list = append(list, dirEntry{Name: de.Name(), IsDir: de.IsDir()})
	}
	sort.Slice(list, func(i, j int) bool { return list[i].Name < list[j].Name })

	return e.JSON(http.StatusOK, map[string]any{"ok": true, "entries": list})
}

// write_file: POST {"path": ..., "content": ...} → {ok}
//
//	403 on out-of-whitelist / write-forbidden zones; parent dirs auto-created.
func (m *Manager) handleWriteFile(e *core.RequestEvent) error {
	if !isAdmin(e) {
		return e.ForbiddenError("admin required", "")
	}
	// Cap the request body before decoding so an oversized payload cannot
	// exhaust server memory (defense-in-depth; admin-only endpoint).
	e.Request.Body = http.MaxBytesReader(e.Response, e.Request.Body, maxWriteSize+8*1024)
	var req writeRequest
	if err := json.NewDecoder(e.Request.Body).Decode(&req); err != nil {
		return e.BadRequestError("invalid JSON body", "")
	}
	if len(req.Content) > maxWriteSize {
		return e.BadRequestError("content too large", "")
	}
	abs, err := resolve(req.Path, true)
	if err != nil {
		slog.Error("mcp write_file: path not allowed", "path", req.Path, "err", err)
		return e.ForbiddenError("path not allowed", "")
	}

	root, err := repoRoot()
	if err != nil {
		slog.Error("mcp write_file: cannot resolve repo root", "err", err)
		return e.ForbiddenError("path not allowed", "")
	}
	if err := guardSymlink(root, abs, true); err != nil {
		slog.Error("mcp write_file: symlink guard failed", "path", req.Path, "err", err)
		return e.ForbiddenError("path not allowed", "")
	}

	if err := os.MkdirAll(filepath.Dir(abs), 0o755); err != nil {
		slog.Error("mcp write_file: mkdir failed", "path", req.Path, "err", err)
		return e.JSON(http.StatusInternalServerError, map[string]any{"ok": false, "error": "file operation failed"})
	}
	if err := os.WriteFile(abs, []byte(req.Content), 0o600); err != nil {
		slog.Error("mcp write_file: write failed", "path", req.Path, "err", err)
		return e.JSON(http.StatusInternalServerError, map[string]any{"ok": false, "error": "file operation failed"})
	}
	return e.JSON(http.StatusOK, map[string]any{"ok": true})
}

// pb_schema (GET only): ?collection=<name> → {ok, collection:{name,type,fields,...}}
//
//	Non-GET → 405; unknown collection → 404.
func (m *Manager) handlePBSchema(e *core.RequestEvent) error {
	if !isAdmin(e) {
		return e.ForbiddenError("admin required", "")
	}
	if e.Request.Method != http.MethodGet {
		return e.Error(http.StatusMethodNotAllowed, "GET required", "")
	}

	name := e.Request.URL.Query().Get("collection")
	if name == "" {
		return e.BadRequestError("collection is required", "")
	}
	col, err := m.app.FindCollectionByNameOrId(name)
	if err != nil {
		return e.NotFoundError("collection not found", "")
	}

	raw, err := json.Marshal(col)
	if err != nil {
		return e.JSON(http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
	}
	var schema map[string]any
	if err := json.Unmarshal(raw, &schema); err != nil {
		return e.JSON(http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
	}
	return e.JSON(http.StatusOK, map[string]any{"ok": true, "collection": schema})
}

// pb_query (GET only): ?collection=&filter=&page=&perPage= → paginated read.
//
//	Non-GET → 405. Strictly read-only — never writes.
func (m *Manager) handlePBQuery(e *core.RequestEvent) error {
	if !isAdmin(e) {
		return e.ForbiddenError("admin required", "")
	}
	if e.Request.Method != http.MethodGet {
		return e.Error(http.StatusMethodNotAllowed, "GET required", "")
	}

	name := e.Request.URL.Query().Get("collection")
	if name == "" {
		return e.BadRequestError("collection is required", "")
	}

	col, err := m.app.FindCollectionByNameOrId(name)
	if err != nil {
		return e.NotFoundError("collection not found", "")
	}

	// Parse the request through the same search provider used by PB's own
	// list endpoint so relational filters (e.g. category.name="x") resolve
	// with the proper joins, and page/perPage are bounded by the provider
	// (eliminating the previous (page-1)*perPage integer overflow). The
	// provider ignores unknown params, so the encoded query string may keep
	// the collection param.
	requestInfo, err := e.RequestInfo()
	if err != nil {
		return e.BadRequestError("invalid request", "")
	}

	query := m.app.RecordQuery(col)
	fieldsResolver := core.NewRecordFieldResolver(m.app, col, requestInfo, true)
	fieldsResolver.SetAllowHiddenFields(true) // admin-only tool: hidden fields are visible

	searchProvider := search.NewProvider(fieldsResolver).Query(query)
	if !col.IsView() {
		searchProvider.CountCol("_rowid_")
	}

	records := []*core.Record{}
	result, err := searchProvider.ParseAndExec(e.Request.URL.Query().Encode(), &records)
	if err != nil {
		return e.BadRequestError("invalid query: "+err.Error(), "")
	}

	items := make([]map[string]any, 0, len(records))
	for _, r := range records {
		raw, err := json.Marshal(r)
		if err != nil {
			return e.JSON(http.StatusInternalServerError, map[string]any{"ok": false, "error": "record serialization failed"})
		}
		var rec map[string]any
		if err := json.Unmarshal(raw, &rec); err != nil {
			return e.JSON(http.StatusInternalServerError, map[string]any{"ok": false, "error": "record serialization failed"})
		}
		items = append(items, rec)
	}

	return e.JSON(http.StatusOK, map[string]any{
		"ok":         true,
		"items":      items,
		"totalItems": result.TotalItems,
		"totalPages": result.TotalPages,
		"page":       result.Page,
		"perPage":    result.PerPage,
	})
}

// override_check (GET): ?theme=<name> → text/plain report.
//
//	Runs `node scripts/override-check.mjs themes/<name> app/src` in the repo root.
//	Invalid theme name → 400; exec failure → 500.
func (m *Manager) handleOverrideCheck(e *core.RequestEvent) error {
	if !isAdmin(e) {
		return e.ForbiddenError("admin required", "")
	}

	name := e.Request.URL.Query().Get("theme")
	if name == "" || !themeNameRe.MatchString(name) {
		return e.BadRequestError("invalid theme name (must match ^[A-Za-z0-9_-]+$)", "")
	}

	root, err := repoRoot()
	if err != nil {
		return e.JSON(http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
	}

	ctx, cancel := context.WithTimeout(e.Request.Context(), overrideCheckTimeout)
	defer cancel()

	//nolint:gosec // name is regex-validated ^[A-Za-z0-9_-]+$ above; fixed argv, no shell
	cmd := exec.CommandContext(ctx, "node", "scripts/override-check.mjs", "themes/"+name, "app/src")
	cmd.Dir = root
	out, err := cmd.CombinedOutput()
	if err != nil {
		return e.JSON(http.StatusInternalServerError, map[string]any{
			"ok":     false,
			"error":  err.Error(),
			"output": string(out),
		})
	}
	return e.String(http.StatusOK, string(out))
}

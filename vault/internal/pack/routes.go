package pack

import (
	"errors"
	"fmt"
	"net/http"
	"path"
	"strings"
	"time"

	"github.com/pocketbase/pocketbase/core"

	"github.com/cornworld/vanblog/internal/article"
)

// RegisterRoutes mounts the runtime pack frontend surface:
//
//	GET /api/vanblog/packs/frontend  anonymous manifest (nav + injection URLs)
//	GET /pack-static/*               live pack assets (builtin + user, user wins)
//	PUT /api/vanblog/custom-code     admin-managed custom CSS/JS pseudo pack
//
// builtinDir/localDir mirror the --builtinPacksDir/--packsDir flags. Unlike
// the boot-time resolution this surface re-reads the directories per
// request, so a pack dropped into the volume (plus a PB restart for its
// hooks/migrations) needs no Caddy resync and no theme rebuild for its
// frontend to go live.
func RegisterRoutes(app core.App, builtinDir, localDir string) {
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		se.Router.GET("/api/vanblog/packs/frontend", func(e *core.RequestEvent) error {
			e.Response.Header().Set("Cache-Control", "public, max-age="+FrontendManifestMaxAge)
			return e.JSON(http.StatusOK, BuildFrontendManifest(builtinDir, localDir))
		})

		se.Router.GET("/pack-static/{path...}", func(e *core.RequestEvent) error {
			if err := ServePackStatic(e.Response, e.Request, builtinDir, localDir); err != nil {
				return e.NotFoundError("pack asset not found", "")
			}
			return nil
		})

		se.Router.PUT("/api/vanblog/custom-code", func(e *core.RequestEvent) error {
			if e.Auth == nil || e.Auth.GetString("role") != "admin" {
				return e.ForbiddenError("admin role required", "")
			}
			var code CustomCode
			if err := e.BindBody(&code); err != nil {
				return e.BadRequestError("invalid custom-code body", "")
			}
			if len(code.CSS) > CustomCodeMaxBytes || len(code.JS) > CustomCodeMaxBytes {
				return e.Error(http.StatusRequestEntityTooLarge, fmt.Sprintf("custom code exceeds %d bytes per slot", CustomCodeMaxBytes), "")
			}
			if err := WriteCustomCodePack(localDir, code); err != nil {
				return e.BadRequestError(err.Error(), "")
			}
			// Cached pages embed the manifest's <link>/<script> list. The
			// Node-side manifest cache lives for FrontendManifestMaxAge
			// seconds, so the revalidate is scheduled past that window: the
			// next render is guaranteed to observe the new manifest.
			delay, _ := time.ParseDuration(FrontendManifestMaxAge + "s")
			time.AfterFunc(delay+2*time.Second, func() {
				article.RevalidateCache(app, []string{"posts", "home"})
			})
			return e.JSON(http.StatusOK, map[string]any{"ok": true})
		})

		return se.Next()
	})
}

// packStaticContentType maps asset extensions the packs realistically ship.
// Unknown extensions fall through empty → http.ServeContent sniffs.
func packStaticContentType(name string) string {
	switch strings.ToLower(path.Ext(name)) {
	case ".css":
		return "text/css; charset=utf-8"
	case ".js", ".mjs":
		return "text/javascript; charset=utf-8"
	case ".json":
		return "application/json; charset=utf-8"
	case ".svg":
		return "image/svg+xml"
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".gif":
		return "image/gif"
	case ".webp":
		return "image/webp"
	case ".ico":
		return "image/x-icon"
	case ".woff":
		return "font/woff"
	case ".woff2":
		return "font/woff2"
	case ".txt":
		return "text/plain; charset=utf-8"
	default:
		return ""
	}
}

// ServePackStatic serves one /pack-static/<pack>/<rest> asset from the live
// pack directories (builtin + user, user wins). Split out of the route
// closure so tests can drive it with plain httptest pairs. A non-nil return
// is always errFileNotFound → callers translate it to 404.
func ServePackStatic(w http.ResponseWriter, r *http.Request, builtinDir, localDir string) error {
	f, info, err := openPackStaticFile(builtinDir, localDir, r.URL.Path)
	if err != nil {
		return errFileNotFound
	}
	defer f.Close()
	// Fixed URLs whose content can change on pack upgrade → always
	// revalidate; the ETag (size+mtime) makes revalidation a cheap 304 for
	// unchanged files.
	w.Header().Set("Cache-Control", "public, max-age=0, must-revalidate")
	w.Header().Set("Etag", fmt.Sprintf(`"%x-%x"`, info.Size(), info.ModTime().UnixNano()))
	if ct := packStaticContentType(info.Name()); ct != "" {
		w.Header().Set("Content-Type", ct)
	}
	http.ServeContent(w, r, info.Name(), info.ModTime(), f)
	return nil
}

// errFileNotFound marks a miss for the route closure to translate into 404.
var errFileNotFound = errors.New("pack asset not found")

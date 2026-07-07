// Package plugins provides a Go-level $vanblog JSVM library that
// simplifies plugin authoring. Instead of ~80 lines of boilerplate JS
// per plugin (read manifest, parse JSON, build page data, load template,
// handle auth), plugin authors write ~25 lines calling Go helpers via
// the $vanblog object injected into PocketBase's JavaScript VM.
package plugins

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sync"

	"github.com/dop251/goja"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	tplreg "github.com/pocketbase/pocketbase/tools/template"
)

// Manifest represents a plugin's manifest.json
type Manifest struct {
	Name        string `json:"name"`
	Version     string `json:"version"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Author      string `json:"author"`
	Routes      struct {
		Public struct {
			Path     string `json:"path"`
			Title    string `json:"title"`
			Template string `json:"template"`
		} `json:"public"`
		Admin struct {
			Path     string `json:"path"`
			Title    string `json:"title"`
			Template string `json:"template"`
		} `json:"admin"`
	} `json:"routes"`
	NavItems []struct {
		Path     string `json:"path"`
		Title    string `json:"title"`
		Position string `json:"position"`
	} `json:"navItems"`
	Scripts []string `json:"scripts"`
	Styles  []string `json:"styles"`
}

// Manager handles plugin lifecycle — manifest caching, nav aggregation,
// template rendering, and static asset serving.
type Manager struct {
	app               core.App
	cache             map[string]*Manifest
	navItems          []map[string]any
	mu                sync.RWMutex
	tmplReg           *tplreg.Registry
	pluginsDir        string
	registeredPlugins []string // names captured by servePlugin() during JSVM OnInit; routed in OnServe
}

// New creates a new plugin Manager. It subscribes to OnServe so that plugins
// registered via $vanblog.servePlugin() (which runs during JSVM OnInit, before
// the router exists) get their public/admin/static routes wired up once the
// HTTP server is ready.
func New(app core.App, pluginsDir string) *Manager {
	m := &Manager{
		app:        app,
		cache:      make(map[string]*Manifest),
		pluginsDir: pluginsDir,
		tmplReg:    tplreg.NewRegistry(),
	}

	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		m.mu.RLock()
		plugins := make([]string, len(m.registeredPlugins))
		copy(plugins, m.registeredPlugins)
		m.mu.RUnlock()

		for _, name := range plugins {
			m.addNavItemsInternal(name)
			se.Router.GET(fmt.Sprintf("/_plugin/%s/render", name), m.servePluginPublic(name))
			se.Router.GET(fmt.Sprintf("/_plugin/%s/admin", name), m.servePluginAdmin(name))
			staticDir := filepath.Join(m.pluginsDir, name, "frontend")
			se.Router.GET(fmt.Sprintf("/plugins/%s/{path...}", name), apis.Static(os.DirFS(staticDir), false))
		}
		return se.Next()
	})

	return m
}

// Bind returns an OnInit callback that registers $vanblog into the JSVM
// runtime. Each vm.GetOrCreate pool instance receives the full object so
// concurrent handlers don't step on each other.
func (m *Manager) Bind() func(vm *goja.Runtime) {
	return func(vm *goja.Runtime) {
		obj := vm.NewObject()

		// readManifest(name string) map[string]any
		obj.Set("readManifest", func(call goja.FunctionCall) goja.Value {
			name := call.Argument(0).String()
			manifest, err := m.loadManifest(name)
			if err != nil {
				panic(vm.NewGoError(fmt.Errorf("plugin %s: %w", name, err)))
			}
			return vm.ToValue(map[string]any{
				"name":    manifest.Name,
				"version": manifest.Version,
				"title":   manifest.Title,
				"routes": map[string]any{
					"public": map[string]any{
						"path":     manifest.Routes.Public.Path,
						"title":    manifest.Routes.Public.Title,
						"template": manifest.Routes.Public.Template,
					},
					"admin": map[string]any{
						"path":     manifest.Routes.Admin.Path,
						"title":    manifest.Routes.Admin.Title,
						"template": manifest.Routes.Admin.Template,
					},
				},
				"scripts": manifest.Scripts,
				"styles":  manifest.Styles,
			})
		})

		// buildPageData(manifest map[string]any, authId string) map[string]any
		obj.Set("buildPageData", func(call goja.FunctionCall) goja.Value {
			manifestVal := call.Argument(0).Export()
			authId := call.Argument(1).String()

			manifest, ok := manifestVal.(map[string]any)
			if !ok {
				panic(vm.NewGoError(fmt.Errorf("buildPageData: first argument must be an object")))
			}

			data := map[string]any{
				"PluginName": manifest["name"],
				"Title":      manifest["title"],
			}

			// Read site config
			site, err := m.app.FindFirstRecordByFilter("site", "id != ''")
			if err == nil && site != nil {
				data["SiteName"] = site.GetString("siteName")
			}

			// Read user info
			if authId != "" {
				user, err := m.app.FindRecordById("users", authId)
				if err == nil && user != nil {
					data["User"] = map[string]any{
						"id":       user.Id,
						"username": user.GetString("username"),
						"nickname": user.GetString("nickname"),
					}
				}
			}

			return vm.ToValue(data)
		})

		// renderTemplate(pluginName string, templateRelPath string, data map[string]any) string
		obj.Set("renderTemplate", func(call goja.FunctionCall) goja.Value {
			name := call.Argument(0).String()
			tplRel := call.Argument(1).String()
			dataVal := call.Argument(2).Export()

			data, ok := dataVal.(map[string]any)
			if !ok {
				data = map[string]any{}
			}

			tplPath := filepath.Join(m.pluginsDir, name, tplRel)
			html, err := m.tmplReg.LoadFiles(tplPath).Render(data)
			if err != nil {
				panic(vm.NewGoError(fmt.Errorf("renderTemplate: %w", err)))
			}
			return vm.ToValue(html)
		})

		// serveStatic(pluginName string) returns a Go request handler
		// suitable for passing directly to routerAdd:
		//
		//   routerAdd("GET", "/plugins/{name}/{path...}", $vanblog.serveStatic("name"))
		obj.Set("serveStatic", func(call goja.FunctionCall) goja.Value {
			name := call.Argument(0).String()
			dir := filepath.Join(m.pluginsDir, name, "frontend")
			handler := apis.Static(os.DirFS(dir), false)
			return vm.ToValue(handler)
		})

		// addNavItems(pluginName string)
		obj.Set("addNavItems", func(call goja.FunctionCall) goja.Value {
			name := call.Argument(0).String()
			manifest, err := m.loadManifest(name)
			if err != nil {
				log.Printf("[plugins] addNavItems: %v", err)
				return goja.Undefined()
			}
			m.mu.Lock()
			for _, item := range manifest.NavItems {
				m.navItems = append(m.navItems, map[string]any{
					"path":     item.Path,
					"title":    item.Title,
					"position": item.Position,
				})
			}
			m.mu.Unlock()
			return goja.Undefined()
		})

		// getNavItems() []map[string]any
		obj.Set("getNavItems", func(call goja.FunctionCall) goja.Value {
			m.mu.RLock()
			defer m.mu.RUnlock()
			// Return a copy to avoid concurrent mutation issues
			items := make([]map[string]any, len(m.navItems))
			copy(items, m.navItems)
			return vm.ToValue(items)
		})

		// servePlugin(name string) — one-shot registration of a plugin's
		// public render route, admin render route (auth-guarded), and static
		// asset route, plus nav items. Called at hook load time (JSVM OnInit);
		// because the router doesn't exist yet, we only capture the name here
		// and defer the actual route wiring to the OnServe hook installed in
		// New(). Replaces ~30 lines of boilerplate per plugin.
		obj.Set("servePlugin", func(call goja.FunctionCall) goja.Value {
			name := call.Argument(0).String()
			m.mu.Lock()
			m.registeredPlugins = append(m.registeredPlugins, name)
			m.mu.Unlock()
			return goja.Undefined()
		})

		// readFile(path string) string — convenience wrapper
		obj.Set("readFile", func(call goja.FunctionCall) goja.Value {
			path := call.Argument(0).String()
			data, err := os.ReadFile(path)
			if err != nil {
				panic(vm.NewGoError(err))
			}
			return vm.ToValue(string(data))
		})

		vm.Set("$vanblog", obj)
	}
}

// loadManifest reads and caches a plugin's manifest.json
func (m *Manager) loadManifest(name string) (*Manifest, error) {
	m.mu.RLock()
	cached, ok := m.cache[name]
	m.mu.RUnlock()
	if ok {
		return cached, nil
	}

	path := filepath.Join(m.pluginsDir, name, "manifest.json")
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read manifest: %w", err)
	}

	var manifest Manifest
	if err := json.Unmarshal(data, &manifest); err != nil {
		return nil, fmt.Errorf("parse manifest: %w", err)
	}

	m.mu.Lock()
	m.cache[name] = &manifest
	m.mu.Unlock()

	return &manifest, nil
}

// ClearCache clears the manifest cache. Useful for hot-reload scenarios.
func (m *Manager) ClearCache() {
	m.mu.Lock()
	m.cache = make(map[string]*Manifest)
	m.navItems = nil
	m.mu.Unlock()
}

// addNavItemsInternal is the Go-side equivalent of the $vanblog.addNavItems()
// JSVM helper. Used by servePlugin's OnServe wiring so that a single
// servePlugin() call also registers nav items without requiring the plugin
// author to call addNavItems() separately.
func (m *Manager) addNavItemsInternal(name string) {
	manifest, err := m.loadManifest(name)
	if err != nil {
		log.Printf("[plugins] addNavItemsInternal %s: %v", name, err)
		return
	}
	m.mu.Lock()
	for _, item := range manifest.NavItems {
		m.navItems = append(m.navItems, map[string]any{
			"path":     item.Path,
			"title":    item.Title,
			"position": item.Position,
		})
	}
	m.mu.Unlock()
}

// buildPageDataGo mirrors the $vanblog.buildPageData() JSVM helper. It exists
// separately because servePlugin's Go handlers can't round-trip through the
// VM — they build page data directly. The collection name is "site" (the
// real collection); historically the JSVM helper used "site_config" which was
// a bug, fixed here.
func (m *Manager) buildPageDataGo(manifest *Manifest, authId string) map[string]any {
	data := map[string]any{
		"PluginName": manifest.Name,
		"Title":      manifest.Title,
	}

	// Read site config
	site, err := m.app.FindFirstRecordByFilter("site", "id != ''")
	if err == nil && site != nil {
		data["SiteName"] = site.GetString("siteName")
	}

	// Read user info
	if authId != "" {
		user, err := m.app.FindRecordById("users", authId)
		if err == nil && user != nil {
			data["User"] = map[string]any{
				"id":       user.Id,
				"username": user.GetString("username"),
				"nickname": user.GetString("nickname"),
			}
		}
	}

	return data
}

// renderTemplateGo renders a plugin template relative path against the given
// data, returning the HTML. Shared by both public and admin handlers.
func (m *Manager) renderTemplateGo(name, tplRel string, data map[string]any) (string, error) {
	tplPath := filepath.Join(m.pluginsDir, name, tplRel)
	return m.tmplReg.LoadFiles(tplPath).Render(data)
}

// servePluginPublic returns a handler that renders the plugin's public entry
// template (frontend/index.html) and returns the JSON envelope expected by
// vanblog's frontend plugin renderer:
//
//	{ html, title, head, scripts, styles }
//
// The title falls back to manifest.Title when the manifest's public route has
// no title. Mirrors moments.pb.js's /_plugin/{name}/render route.
func (m *Manager) servePluginPublic(name string) func(*core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		manifest, err := m.loadManifest(name)
		if err != nil {
			return e.JSON(http.StatusInternalServerError, map[string]any{
				"error": fmt.Sprintf("plugin %s: %v", name, err),
			})
		}

		authId := ""
		if e.Auth != nil {
			authId = e.Auth.Id
		}
		data := m.buildPageDataGo(manifest, authId)

		html, err := m.renderTemplateGo(name, manifest.Routes.Public.Template, data)
		if err != nil {
			return e.JSON(http.StatusInternalServerError, map[string]any{
				"error": fmt.Sprintf("render: %v", err),
			})
		}

		title := manifest.Routes.Public.Title
		if title == "" {
			title = manifest.Title
		}

		return e.JSON(http.StatusOK, map[string]any{
			"html":    html,
			"title":   title,
			"head":    "",
			"scripts": manifest.Scripts,
			"styles":  manifest.Styles,
		})
	}
}

// servePluginAdmin returns an auth-guarded handler that renders the plugin's
// admin template (frontend/admin.html) and returns the same JSON envelope as
// servePluginPublic. Returns 401 when no authenticated user is present,
// matching the behavior of the legacy JS handler in moments.pb.js.
func (m *Manager) servePluginAdmin(name string) func(*core.RequestEvent) error {
	return func(e *core.RequestEvent) error {
		if e.Auth == nil {
			return e.JSON(http.StatusUnauthorized, map[string]any{"error": "Unauthorized"})
		}

		manifest, err := m.loadManifest(name)
		if err != nil {
			return e.JSON(http.StatusInternalServerError, map[string]any{
				"error": fmt.Sprintf("plugin %s: %v", name, err),
			})
		}

		data := m.buildPageDataGo(manifest, e.Auth.Id)

		html, err := m.renderTemplateGo(name, manifest.Routes.Admin.Template, data)
		if err != nil {
			return e.JSON(http.StatusInternalServerError, map[string]any{
				"error": fmt.Sprintf("render: %v", err),
			})
		}

		return e.JSON(http.StatusOK, map[string]any{
			"html":    html,
			"title":   manifest.Routes.Admin.Title,
			"head":    "",
			"scripts": manifest.Scripts,
			"styles":  manifest.Styles,
		})
	}
}

package demo

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	_ "github.com/cornworld/vanblog/pb_migrations"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

func TestIsBlocked(t *testing.T) {
	cases := []struct {
		path string
		want bool
	}{
		{"/api/vanblog/agent/terminal", true},
		{"/api/vanblog/agent/validate", true},
		{"/api/vanblog/mcp/write_file", true},
		{"/api/vanblog/mcp/list_dir", true},
		{"/api/vanblog/backups", true},
		{"/api/vanblog/backups/bk.zip/download", true},
		{"/api/vanblog/backups/bk.zip/restore", true},
		{"/api/vanblog/migrate/import", true},
		{"/api/vanblog/routing/apply", true},
		{"/api/vanblog/routing/rules", true},
		{"/api/vanblog/system/restart", true},
		{"/api/vanblog/themes/reload", true},
		// 内容面必须保持可用(随便折腾是 demo 的意义)
		{"/api/vanblog/search", false},
		{"/api/vanblog/posts/trash", false},
		{"/api/vanblog/custom-code", false},
		{"/api/collections/posts/records", false},
		{"/api/vanblog/routing/status", false},
		{"/api/vanblog/system/metrics", false},
	}
	for _, c := range cases {
		if got := IsBlocked(c.path); got != c.want {
			t.Errorf("IsBlocked(%q) = %v, want %v", c.path, got, c.want)
		}
	}
}

func setupGuardedApp(t *testing.T) *pocketbase.PocketBase {
	t.Helper()
	t.Setenv("VANBLOG_DEMO", "1")
	app := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: t.TempDir()})
	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Bootstrap: %v", err)
	}
	t.Cleanup(func() { _ = app.ClearBootstrap() })
	if err := app.RunAppMigrations(); err != nil {
		t.Fatalf("Migration: %v", err)
	}
	New(app)
	return app
}

func buildMux(t *testing.T, app core.App) http.Handler {
	t.Helper()
	baseRouter, err := apis.NewRouter(app)
	if err != nil {
		t.Fatalf("apis.NewRouter: %v", err)
	}
	serveEvent := &core.ServeEvent{App: app, Router: baseRouter}
	if err := app.OnServe().Trigger(serveEvent, func(e *core.ServeEvent) error {
		return e.Next()
	}); err != nil {
		t.Fatalf("OnServe trigger: %v", err)
	}
	mux, err := baseRouter.BuildMux()
	if err != nil {
		t.Fatalf("BuildMux: %v", err)
	}
	return mux
}

func TestGuardBlocksShellAndInfraSurface(t *testing.T) {
	app := setupGuardedApp(t)
	mux := buildMux(t, app)
	for _, path := range []string{
		"/api/vanblog/agent/terminal",
		"/api/vanblog/mcp/write_file",
		"/api/vanblog/routing/apply",
	} {
		req, _ := http.NewRequest(http.MethodGet, path, strings.NewReader(""))
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, req)
		if rec.Code != http.StatusForbidden {
			t.Errorf("%s: got %d, want 403(演示模式必须封禁 shell/infra 面)", path, rec.Code)
		}
	}
}

func TestGuardLetsContentSurfaceThrough(t *testing.T) {
	app := setupGuardedApp(t)
	mux := buildMux(t, app)
	for _, path := range []string{"/api/vanblog/search?q=x", "/api/vanblog/timeline"} {
		req, _ := http.NewRequest(http.MethodGet, path, strings.NewReader(""))
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, req)
		if rec.Code == http.StatusForbidden {
			t.Errorf("%s: 不应被演示守卫拦截(内容面要能随便折腾)", path)
		}
	}
}

func TestInactiveWithoutEnv(t *testing.T) {
	t.Setenv("VANBLOG_DEMO", "")
	app := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: t.TempDir()})
	if err := app.Bootstrap(); err != nil {
		t.Fatalf("Bootstrap: %v", err)
	}
	t.Cleanup(func() { _ = app.ClearBootstrap() })
	if err := app.RunAppMigrations(); err != nil {
		t.Fatalf("Migration: %v", err)
	}
	New(app) // env 未设 → 不注册任何中间件
	mux := buildMux(t, app)
	req, _ := http.NewRequest(http.MethodGet, "/api/vanblog/agent/terminal", strings.NewReader(""))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code == http.StatusForbidden {
		t.Error("非演示模式不应启用守卫(agent 面不该被 403)")
	}
}

package article

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/cornworld/vanblog/internal/media"
	"github.com/cornworld/vanblog/internal/site"
	"github.com/pocketbase/pocketbase/core"
)

// TestWriteHooksTriggerAstroRevalidate pins that posts CRUD fires the Astro
// cache invalidation webhook. Regression context: 2026-09-15 e2e found the
// container serving a stale home page (X-Astro-Cache: HIT) after posts were
// created via the REST API — the revalidate webhook never reached Astro.
func TestWriteHooksTriggerAstroRevalidate(t *testing.T) {
	var mu sync.Mutex
	var got []struct {
		Path string
		Body string
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body := make([]byte, 256)
		n, _ := r.Body.Read(body)
		mu.Lock()
		got = append(got, struct {
			Path string
			Body string
		}{r.URL.Path, string(body[:n])})
		mu.Unlock()
		w.WriteHeader(200)
	}))
	defer srv.Close()
	t.Setenv("ASTRO_URL", srv.URL)

	app := setupApp(t)
	_ = New(app)

	createPost(t, app, "Hook Probe", "body", "published", "/hook-probe")
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		mu.Lock()
		n := len(got)
		mu.Unlock()
		if n > 0 {
			break
		}
		time.Sleep(20 * time.Millisecond)
	}
	mu.Lock()
	defer mu.Unlock()
	if len(got) == 0 {
		t.Fatal("posts create did not trigger /api/revalidate webhook")
	}
	if got[0].Path != "/api/revalidate" {
		t.Errorf("webhook path = %q, want /api/revalidate", got[0].Path)
	}
	var payload struct {
		Tags []string `json:"tags"`
	}
	if err := json.Unmarshal([]byte(got[0].Body), &payload); err != nil {
		t.Fatalf("webhook body %q: %v", got[0].Body, err)
	}
	if len(payload.Tags) == 0 {
		t.Errorf("webhook body %q carries no tags", got[0].Body)
	}
}

// TestMediaThenArticleChainFiresWebhook replicates the production manager
// registration order (main.go: media.New BEFORE article.New). Regression
// context: 2026-09-15 e2e found media.scanPostImages returned nil without
// e.Next(), silently terminating the posts AfterCreateSuccess hook chain —
// article's revalidate webhook never fired in any serve deployment, and SSR
// served stale pages until natural cache expiry.
func TestMediaThenArticleChainFiresWebhook(t *testing.T) {
	var mu sync.Mutex
	var hits int
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		hits++
		mu.Unlock()
		w.WriteHeader(200)
	}))
	defer srv.Close()
	t.Setenv("ASTRO_URL", srv.URL)

	app := setupApp(t)
	_ = media.New(app) // MUST come before article.New, mirroring main.go
	_ = New(app)

	createPost(t, app, "Chain Probe", "body", "published", "/chain-probe")
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		mu.Lock()
		n := hits
		mu.Unlock()
		if n > 0 {
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatal("webhook did not fire with media.New registered before article.New")
}

var _ = os.Getenv // keep os import if test evolves

// TestRevalidateFailureWritesFailedAuditRow 钉住自愈提醒机制:Astro 不可达
// 时,失效失败必须写一条 result=failure 的审计行(管理员审计页可见)——
// 失效通知是单次 fire-and-forget,无此行则丢失后既不自愈也无法感知。
func TestRevalidateFailureWritesFailedAuditRow(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
	}))
	defer srv.Close()
	t.Setenv("ASTRO_URL", srv.URL)

	app := setupApp(t)
	_ = New(app)

	createPost(t, app, "Fail Probe", "body", "published", "/fail-probe")
	// 失效失败 → OpsFailed 审计行由后台 goroutine 落库;测试主协程的读询
	// 压力可能让该 goroutine 的调度延迟数秒(实测 ~10s),窗口放宽到 30s。
	deadline := time.Now().Add(30 * time.Second)
	var failed *core.Record
	for time.Now().Before(deadline) && failed == nil {
		all, _ := app.FindRecordsByFilter("audits", "", "-created", 10, 0)
		for _, a := range all {
			if a.GetString("action") == "revalidate.failure" && a.GetString("result") == "failure" {
				failed = a
				break
			}
		}
		if failed == nil {
			time.Sleep(500 * time.Millisecond)
		}
	}
	if failed.GetString("result") != "failure" {
		t.Errorf("result = %q, want failure", failed.GetString("result"))
	}
}

// TestSelfHealCronRegistered 钉住:每日自愈 cron 必须注册——失效通知丢失
// 的兜底重发依赖它(2026-09-17 长流程审查沉淀)。
func TestSelfHealCronRegistered(t *testing.T) {
	app := setupApp(t)
	_ = New(app)

	found := false
	for _, job := range app.Cron().Jobs() {
		if job.Id() == "posts-revalidate-selfheal" {
			found = true
		}
	}
	if !found {
		t.Fatal("cron job posts-revalidate-selfheal not registered")
	}
}

// TestSelfHealGatedBySiteConfig 钉住开关语义:site.displayOptions
// .revalidateSelfHeal=false 时每日自愈跳过(不发 Astro 请求);缺省开启。
// 开关运行时读取,改配置无需重启。
func TestSelfHealGatedBySiteConfig(t *testing.T) {
	var hits int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&hits, 1)
		w.WriteHeader(200)
	}))
	defer srv.Close()
	t.Setenv("ASTRO_URL", srv.URL)

	app := setupApp(t)
	m := New(app)

	setFlag := func(v bool) {
		siteRec, err := site.Get(app)
		if err != nil {
			t.Fatalf("site get: %v", err)
		}
		var opts map[string]any
		if raw := siteRec.GetString("displayOptions"); raw != "" {
			_ = json.Unmarshal([]byte(raw), &opts)
		}
		if opts == nil {
			opts = map[string]any{}
		}
		opts["revalidateSelfHeal"] = v
		b, _ := json.Marshal(opts)
		siteRec.Set("displayOptions", string(b))
		if err := app.Save(siteRec); err != nil {
			t.Fatalf("site save: %v", err)
		}
	}

	setFlag(false)
	m.runSelfHeal()
	if got := atomic.LoadInt32(&hits); got != 0 {
		t.Fatalf("disabled: astro hits = %d, want 0", got)
	}

	setFlag(true)
	m.runSelfHeal()
	if got := atomic.LoadInt32(&hits); got != 1 {
		t.Fatalf("enabled: astro hits = %d, want 1", got)
	}
}

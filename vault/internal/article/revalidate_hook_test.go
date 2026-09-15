package article

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/cornworld/vanblog/internal/media"
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

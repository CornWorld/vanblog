package article

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/core"
)

// TestRestCreateTriggersAstroRevalidate replicates the container path exactly:
// a REST POST /api/collections/posts/records through pb's router must fire the
// Astro revalidate webhook. Regression context: 2026-09-15 container e2e saw
// X-Astro-Cache: HIT persist >20s after REST creates (webhook never arrived),
// while app.Save-based creates fired it — this test pins the REST path.
func TestRestCreateTriggersAstroRevalidate(t *testing.T) {
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
	mux := buildRouter(t, app)

	super := createSuperuserToken(t, app)

	body := `{"title":"REST Hook Probe","content":"body","status":"published","pathname":"/rest-hook-probe","deleted":false}`
	req := httptest.NewRequest(http.MethodPost, "/api/collections/posts/records", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", super)
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != 200 {
		t.Fatalf("REST create: HTTP %d: %s", rec.Code, rec.Body.String())
	}

	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		mu.Lock()
		n := hits
		mu.Unlock()
		if n > 0 {
			return // hook fired
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatal("REST create did not trigger /api/revalidate webhook within 2s")
}

func createSuperuserToken(t *testing.T, app core.App) string {
	t.Helper()
	col, err := app.FindCollectionByNameOrId("_superusers")
	if err != nil {
		t.Fatalf("find _superusers: %v", err)
	}
	rec := core.NewRecord(col)
	rec.SetEmail("hook-probe@test.dev")
	rec.Set("password", "password12345")
	rec.Set("passwordConfirm", "password12345")
	if err := app.Save(rec); err != nil {
		t.Fatalf("create superuser: %v", err)
	}
	token, err := rec.NewAuthToken()
	if err != nil {
		t.Fatalf("auth token: %v", err)
	}
	return token
}

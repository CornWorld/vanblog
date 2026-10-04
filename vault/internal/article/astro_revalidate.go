package article

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"maps"
	"net/http"
	"os"
	"path/filepath"
	"runtime/debug"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/cornworld/vanblog/internal/audit"
	"github.com/pocketbase/pocketbase/core"
)

// astroBaseURL returns the Astro SSR base URL. ASTRO_URL env overrides the
// default (host-side Astro dev :4321, or the in-container Astro SSR in prod).
func astroBaseURL() string {
	if u := os.Getenv("ASTRO_URL"); u != "" {
		return u
	}
	return "http://127.0.0.1:4321"
}

// postRevalidate sends one cache-invalidation POST to Astro. A nil error
// means Astro acknowledged with 200 — the only signal that invalidation
// actually happened.
func postRevalidate(tags []string) error {
	astroURL := astroBaseURL()
	body, _ := json.Marshal(map[string][]string{"tags": tags})
	client := &http.Client{Timeout: 5 * time.Second}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, astroURL+"/api/revalidate", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("reach Astro: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("astro returned non-OK: %d", resp.StatusCode)
	}
	return nil
}

// revalidateAstroCache notifies the Astro SSR server to invalidate cached
// pages. Called asynchronously when posts are created/updated/deleted.
//
// Failure handling is durable: a failed invalidation (network error /
// non-200 / Astro unreachable — typically Astro restarting at publish time)
// is merged into pb_data/revalidate.pending.json and replayed by the
// background retry loop (startRevalidateRetry). Every failure also writes a
// result="failure" audits row (admin 可见)——重试负责最终送达,审计行负责
// 让管理员知道曾经丢过。
func revalidateAstroCache(app core.App, tags []string) {
	defer func() {
		if r := recover(); r != nil {
			// This runs on a goroutine per post edit / restore / purge. A panic
			// would crash the whole process (Go has no global panic hook) and
			// take the entire site down over a cache invalidation — never allow it.
			slog.Error("[article] revalidate: recovered from panic", "panic", r, "stack", string(debug.Stack()))
		}
	}()
	astroURL := astroBaseURL()
	fail := func(reason string) {
		slog.Error("[article] revalidate failed", "reason", reason, "tags", tags, "url", astroURL)
		audit.OpsFailed(app, "revalidate.failure", strings.Join(tags, ","), map[string]any{
			"reason": reason, "url": astroURL,
		})
	}

	if err := postRevalidate(tags); err != nil {
		fail(err.Error())
		persistPending(app, tags)
		return
	}
	slog.Info("[article] revalidate: cache invalidated", "tags", tags)
}

// RevalidateCache exposes revalidateAstroCache to the other managers: the
// pack custom-code writer (vault/internal/pack/routes.go) busts stale page
// caches after rewriting the managed pack, since cached HTML embeds the
// pack-frontend manifest's <link>/<script> list. Durable-failure semantics
// are identical to the record-hook callers.
func RevalidateCache(app core.App, tags []string) {
	revalidateAstroCache(app, tags)
}

// revalidateWG tracks in-flight revalidateAstroCache goroutines so
// short-lived utility processes (`vanblog seed`) can drain them before
// exit — an in-flight audits save racing process teardown panics on
// already-closed handles (observed once as a recovered nil deref).
var revalidateWG sync.WaitGroup

// goRevalidate launches revalidateAstroCache tracked by revalidateWG.
// Replaces raw `go revalidateAstroCache(...)` at every call site.
func goRevalidate(app core.App, tags []string) {
	revalidateWG.Add(1)
	go func() {
		defer revalidateWG.Done()
		revalidateAstroCache(app, tags)
	}()
}

// WaitForRevalidations drains outstanding invalidations, bounded by timeout.
// Called by utility commands before exit; serve never needs it.
func WaitForRevalidations(timeout time.Duration) {
	done := make(chan struct{})
	go func() {
		revalidateWG.Wait()
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(timeout):
		slog.Warn("[article] revalidate drain timed out", "timeout", timeout)
	}
}

// revalidateRetryInterval is the replay cadence for the durable backlog.
// Package-level so tests can shorten it.
var revalidateRetryInterval = 5 * time.Second

// revalidatePending is the durable backlog of cache tags whose invalidation
// POST to Astro failed. Stored as pb_data/revalidate.pending.json — a file,
// not a collection, because the semantics are a single opaque backlog
// ("Astro may have missed these tags"), not queryable records. It survives
// restarts, so the dominant loss scenario ("published while Astro was
// restarting") self-heals without a catch-all cron — the former
// pb_hooks/selfheal.pb.js daily 04:00 resend, retired 2026-09-29.
type revalidatePending struct {
	Tags  []string `json:"tags"`
	Since string   `json:"since"` // RFC3339, first failure time
}

// revalidatePendingMu serializes read-modify-write on the backlog file: a
// failing revalidateAstroCache (merge) can race the retry loop (replay).
var revalidatePendingMu sync.Mutex

func revalidatePendingPath(app core.App) string {
	return filepath.Join(app.DataDir(), "revalidate.pending.json")
}

// persistPending merges tags into the durable backlog (atomic write: temp
// file + rename). Best-effort: a persistence failure just downgrades to the
// old fire-and-forget semantics, logged — never panics.
func persistPending(app core.App, tags []string) {
	revalidatePendingMu.Lock()
	defer revalidatePendingMu.Unlock()

	path := revalidatePendingPath(app)
	cur := revalidatePending{}
	if b, err := os.ReadFile(path); err == nil {
		if err := json.Unmarshal(b, &cur); err != nil {
			slog.Warn("[article] revalidate: backlog file unreadable, replacing", "err", err)
			cur = revalidatePending{}
		}
	}
	if cur.Since == "" {
		cur.Since = time.Now().UTC().Format(time.RFC3339)
	}
	seen := make(map[string]struct{}, len(cur.Tags)+len(tags))
	for _, t := range cur.Tags {
		seen[t] = struct{}{}
	}
	for _, t := range tags {
		seen[t] = struct{}{}
	}
	cur.Tags = slices.Sorted(maps.Keys(seen))

	b, err := json.Marshal(cur)
	if err != nil {
		slog.Error("[article] revalidate: marshal backlog", "err", err)
		return
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, b, 0o600); err != nil {
		slog.Error("[article] revalidate: write backlog", "err", err)
		return
	}
	if err := os.Rename(tmp, path); err != nil {
		slog.Error("[article] revalidate: rename backlog", "err", err)
		return
	}
	slog.Info("[article] revalidate: queued durable retry", "tags", tags, "file", path)
}

// replayPending posts the backlog to Astro once and deletes the file on
// success (200). Failure stays silent — the next tick retries; the original
// failure already wrote its audits row. Corrupt/empty backlog is dropped
// rather than blocking the queue forever.
func replayPending(app core.App) {
	revalidatePendingMu.Lock()
	defer revalidatePendingMu.Unlock()

	path := revalidatePendingPath(app)
	b, err := os.ReadFile(path)
	if err != nil {
		return // no backlog — the common case
	}
	var cur revalidatePending
	if err := json.Unmarshal(b, &cur); err != nil || len(cur.Tags) == 0 {
		slog.Warn("[article] revalidate: dropping unreadable backlog", "err", err)
		os.Remove(path)
		return
	}
	if err := postRevalidate(cur.Tags); err != nil {
		slog.Debug("[article] revalidate: backlog replay failed, will retry", "err", err)
		return
	}
	if err := os.Remove(path); err != nil {
		slog.Error("[article] revalidate: backlog replayed but remove failed", "err", err)
		return
	}
	slog.Info("[article] revalidate: replayed cache invalidation", "tags", cur.Tags, "since", cur.Since)
}

// startRevalidateRetry launches the background backlog replayer: one
// immediate pass at startup (covers "published while Astro was restarting"
// — the main loss scenario), then every revalidateRetryInterval. Runs for
// the process lifetime; OnServe binds once per serve, so there is exactly
// one loop per process.
func startRevalidateRetry(app core.App) {
	go func() {
		replayPending(app)
		ticker := time.NewTicker(revalidateRetryInterval)
		defer ticker.Stop()
		for range ticker.C {
			replayPending(app)
		}
	}()
}

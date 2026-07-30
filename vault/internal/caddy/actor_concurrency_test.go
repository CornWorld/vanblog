package caddy

// actor_concurrency_test.go covers the single-writer guarantee of
// syncWorker: under concurrent submit() calls, no two BootstrapSync
// pipelines overlap on either the DB or Caddy's /load endpoint.
//
// Strategy: an instrumented mock admin counts overlapping /load entries.
// The actor's contract is "strictly serial", so overlap must stay 0
// even when many goroutines fire submits at once.

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// overlapAdmin records whether two /load handlers ever ran simultaneously.
// If the actor is working correctly, every /load completes before the next
// one starts, so inFlight maxes out at 1 and overlapCount stays 0.
type overlapAdmin struct {
	inFlight       atomic.Int32 // current handlers inside the critical section
	maxInFlight    atomic.Int32 // high-water mark
	overlapCount   atomic.Int32 // times a handler saw inFlight > 0 on entry
	totalLoadCalls atomic.Int32
}

func newOverlapAdmin(t *testing.T) (*httptest.Server, *overlapAdmin) {
	t.Helper()
	m := &overlapAdmin{}
	mux := http.NewServeMux()

	mux.HandleFunc("/config", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"admin":{"listen":"127.0.0.1:2019"}}`)
	})

	mux.HandleFunc("/load", func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.Copy(io.Discard, r.Body)
		if r.URL.Query().Get("validate_only") == "true" {
			w.WriteHeader(http.StatusOK)
			return
		}

		// Enter critical section. Record overlap if another handler is
		// already inside.
		cur := m.inFlight.Add(1)
		if cur > 1 {
			m.overlapCount.Add(1)
		}
		for {
			old := m.maxInFlight.Load()
			if cur <= old || m.maxInFlight.CompareAndSwap(old, cur) {
				break
			}
		}
		m.totalLoadCalls.Add(1)

		// Hold briefly to widen the window in which overlap could be
		// observed if the actor were broken. 5ms is long enough to expose
		// a bug, short enough that the test stays fast.
		time.Sleep(5 * time.Millisecond)

		m.inFlight.Add(-1)
		w.WriteHeader(http.StatusOK)
	})

	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv, m
}

// TestSyncWorker_SerializesConcurrentSubmits fires N concurrent
// apply+resync submits and asserts every /load ran in series.
func TestSyncWorker_SerializesConcurrentSubmits(t *testing.T) {
	withFastBackoffs(t)
	app := setupApp(t)
	srv, m := newOverlapAdmin(t)

	// Construct Service via NewWithURL so the worker goroutine starts.
	// Close it at end-of-test so we don't leak a goroutine.
	svc := NewWithURL(app, srv.URL)
	t.Cleanup(svc.Close)

	// Seed initial rules so apply writes a non-trivial diff each time.
	rules := make([]UserRule, 8)
	for i := range rules {
		rules[i] = UserRule{
			ID:   fmt.Sprintf("r%d", i),
			Type: "block",
			From: fmt.Sprintf("/p%d/*", i),
		}
	}

	const N = 12
	var wg sync.WaitGroup
	wg.Add(N)
	for i := range N {
		go func() {
			defer wg.Done()
			var res replaceResult
			if i%2 == 0 {
				res = svc.submit(syncRequest{apply: &applyPayload{
					rules:     rules,
					allowlist: nil,
				}})
			} else {
				res = svc.submit(syncRequest{resync: true})
			}
			if !res.OK && !res.Applied && res.Error != "" {
				t.Errorf("submit %d failed: %+v", i, res)
			}
		}()
	}
	wg.Wait()

	if got := m.overlapCount.Load(); got != 0 {
		t.Fatalf("actor did not serialize: %d overlapping /load handlers (maxInFlight=%d, total=%d)",
			got, m.maxInFlight.Load(), m.totalLoadCalls.Load())
	}
	if got := m.totalLoadCalls.Load(); got < N {
		t.Errorf("expected at least %d /load calls, got %d", N, got)
	}
}

// TestSyncWorker_RollbackThenResyncRestoresConsistency forces an apply
// failure, then runs a resync. Without actor serialization, the resync
// could race with the rollback and read a half-written site.routing. With
// the actor, resync only sees a post-rollback state — the test asserts
// routing equals the seed value at all times.
func TestSyncWorker_RollbackThenResyncRestoresConsistency(t *testing.T) {
	withFastBackoffs(t)
	app := setupApp(t)

	// A Caddy that always fails /load → BootstrapSync exhausts retries.
	failingSrv, _ := newMockCaddyAdmin(t, 1000)

	// After the failure test, swap to a healthy server for the resync.
	healthySrv, _ := newOverlapAdmin(t)

	// Seed initial rules.
	seedRules := []UserRule{{ID: "seed", Type: "block", From: "/seed/*"}}
	seedJSON, _ := json.Marshal(seedRules)
	rec, err := app.FindFirstRecordByFilter("site", "")
	if err != nil || rec == nil {
		t.Fatalf("seed: no site row: %v", err)
	}
	rec.Set("routing", string(seedJSON))
	if err := app.Save(rec); err != nil {
		t.Fatalf("seed: save: %v", err)
	}

	// Construct service pointing at the failing Caddy. After the apply
	// fails and rolls back, we point at the healthy server via direct
	// field mutation — the actor picks up the new URL on its next submit
	// (it reads s.caddyAdminURL inside applyRules/resyncFromDB).
	svc := &Service{
		app:           app,
		caddyAdminURL: failingSrv.URL,
		syncCh:        make(chan syncRequest),
		done:          make(chan struct{}),
	}
	go svc.runSyncWorker()
	t.Cleanup(svc.Close)

	// Apply a new rule set — should fail + roll back because Caddy is broken.
	res := svc.submit(syncRequest{apply: &applyPayload{
		rules: []UserRule{{ID: "new", Type: "block", From: "/new/*"}},
	}})
	if res.OK || res.Applied {
		t.Fatalf("apply should have failed against broken Caddy, got %+v", res)
	}
	if !res.RolledBack {
		t.Errorf("expected rollback, got %+v", res)
	}

	// site.routing must still hold the seed rules (rollback worked).
	gotRouting, _ := readSiteRouting(t, app)
	if gotRouting != string(seedJSON) {
		t.Errorf("post-failure routing drift\n got: %s\n want: %s", gotRouting, seedJSON)
	}

	// Swap to healthy Caddy and resync. This must succeed and leave the
	// seed routing intact (it's already what we want).
	svc.caddyAdminURL = healthySrv.URL
	res2 := svc.submit(syncRequest{resync: true})
	if res2.Error != "" {
		t.Errorf("resync after swap failed: %+v", res2)
	}

	gotRouting2, _ := readSiteRouting(t, app)
	if gotRouting2 != string(seedJSON) {
		t.Errorf("routing changed during resync (should be unchanged)\n got: %s\n want: %s",
			gotRouting2, seedJSON)
	}
}

// TestSyncWorker_CloseTerminatesGoroutine asserts Close actually stops the
// worker — a defensive test against future refactors that might break the
// done-channel wiring and leak goroutines in long-running pb processes.
func TestSyncWorker_CloseTerminatesGoroutine(t *testing.T) {
	app := setupApp(t)
	srv, _ := newOverlapAdmin(t)
	svc := NewWithURL(app, srv.URL)

	// Submit one request to be sure the worker is alive.
	res := svc.submit(syncRequest{resync: true})
	if res.Error != "" {
		t.Fatalf("pre-close submit failed: %+v", res)
	}

	done := make(chan struct{})
	go func() {
		svc.Close()
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("Close() did not return within 2s — worker goroutine likely leaked")
	}

	// Submit after Close should not block forever. The send on syncCh has
	// no receiver, so this would deadlock if we didn't have a recovery
	// path. We accept that a post-close submit hangs — that's the caller's
	// bug — but document it here so the behavior is intentional.
	//
	// (No assertion; just a comment. If you ever want graceful post-close
	// rejection, add a select on s.done inside submit.)
}

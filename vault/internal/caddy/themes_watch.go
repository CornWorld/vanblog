package caddy

import (
	"log/slog"
	"os"
	"path/filepath"
	"slices"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
)

// ThemeWatchDebounce is how long the watcher waits for the themes directory to
// go quiet before triggering a Caddy resync. Theme installs copy a whole tree
// (theme.json + dist/), so the event burst is coalesced into a single push.
var ThemeWatchDebounce = 2 * time.Second

// themeWatcher watches VANBLOG_THEMES_DIR and re-syncs Caddy whenever a theme
// is added or removed at runtime. buildStaticRoutes enumerates the themes dir
// at config-build time, so without this the /themes/<name>/ file_server routes
// for a runtime-added theme would not exist until a manual reload
// (POST /api/vanblog/themes/reload) or a container restart.
//
// The resync goes through the same actor (syncWorker) as admin routing saves,
// preserving the single-writer invariant on Caddy's /load endpoint.
type themeWatcher struct {
	service   *Service
	themesDir string
	watcher   *fsnotify.Watcher
	done      chan struct{}
}

// startThemeWatcher begins watching the themes dir. Returns nil (non-fatal)
// when the directory is absent or fsnotify is unavailable — the manual reload
// endpoint remains a fallback. Only called in prod (VANBLOG_SKIP_CADDY_SYNC=0).
func startThemeWatcher(s *Service) *themeWatcher {
	themesDir := os.Getenv("VANBLOG_THEMES_DIR")
	if themesDir == "" {
		themesDir = "/var/lib/vanblog/themes"
	}
	if _, err := os.Stat(themesDir); err != nil {
		slog.Warn("[caddy] theme watcher disabled: themes dir not found", "dir", themesDir)
		return nil
	}
	w, err := fsnotify.NewWatcher()
	if err != nil {
		slog.Warn("[caddy] theme watcher disabled: fsnotify unavailable", "err", err)
		return nil
	}
	if err := w.Add(themesDir); err != nil {
		slog.Warn("[caddy] theme watcher disabled: cannot watch themes dir", "dir", themesDir, "err", err)
		_ = w.Close()
		return nil
	}
	tw := &themeWatcher{service: s, themesDir: themesDir, watcher: w, done: make(chan struct{})}
	tw.reconcile() // watch already-present theme subdirs too
	go tw.run()
	slog.Info("[caddy] theme watcher started", "dir", themesDir)
	return tw
}

// run keeps the watcher alive. It runs the consume loop, and if the loop ever
// dies — a recovered panic, or the fsnotify watcher closing under us — it
// recreates the watcher and resumes. Auto-discovery must never silently stop:
// a full container restart (PB + Caddy + theme host) for a background watcher
// hiccup would be far worse than rebuilding just the watcher.
func (tw *themeWatcher) run() {
	for {
		if tw.closed() {
			return
		}
		tw.loop()
		// loop() returned: Close, a closed watcher channel, or a recovered
		// panic. Unless we're shutting down, rebuild and continue.
		if tw.closed() {
			return
		}
		slog.Error("[caddy] theme watcher loop ended unexpectedly; restarting")
		if !tw.recreate() {
			slog.Error("[caddy] theme watcher could not be recreated; auto-discovery stopped (manual reload endpoint still works)")
			return
		}
		time.Sleep(time.Second) // backoff so a pathological loop can't spin
	}
}

func (tw *themeWatcher) closed() bool {
	select {
	case <-tw.done:
		return true
	default:
		return false
	}
}

// loop consumes fsnotify events and debounces a resync. Any create/write/remove
// in the themes dir (or inside a watched theme dir) (re)arms the debounce; when
// the dir goes quiet, one resync is triggered. Returns on Close or when the
// watcher's Events channel closes (recreate() in run() takes over).
func (tw *themeWatcher) loop() {
	defer tw.watcher.Close()
	defer func() {
		if r := recover(); r != nil {
			slog.Error("[caddy] theme watcher loop recovered from panic", "panic", r)
		}
	}()
	var timer *time.Timer
	var debounceC <-chan time.Time
	for {
		select {
		case <-tw.done:
			return
		case _, ok := <-tw.watcher.Events:
			if !ok {
				return // watcher closed externally; run() recreates
			}
			// New theme dirs may have appeared — start watching them so events
			// inside (e.g. dist/client appearing after a partial copy) count too.
			tw.reconcile()
			if timer != nil {
				timer.Stop()
			}
			timer = time.NewTimer(ThemeWatchDebounce)
			debounceC = timer.C
		case <-tw.watcher.Errors:
			// Non-fatal; keep watching.
		case <-debounceC:
			timer = nil
			debounceC = nil
			tw.triggerResync()
		}
	}
}

// recreate builds a fresh fsnotify watcher over the themes dir and existing
// theme subdirs so auto-discovery resumes after the loop died. Returns false
// when the watcher can't be rebuilt (e.g. the themes dir was deleted) — the
// caller then stops, leaving the manual reload endpoint as the fallback.
func (tw *themeWatcher) recreate() bool {
	w, err := fsnotify.NewWatcher()
	if err != nil {
		slog.Warn("[caddy] theme watcher recreate failed", "err", err)
		return false
	}
	if err := w.Add(tw.themesDir); err != nil {
		slog.Warn("[caddy] theme watcher recreate: cannot watch themes dir", "err", err)
		_ = w.Close()
		return false
	}
	tw.watcher = w
	tw.reconcile()
	slog.Info("[caddy] theme watcher recreated", "dir", tw.themesDir)
	return true
}

// triggerResync pushes the current themes-dir state into Caddy. Runs off the
// watcher goroutine so a slow push (Caddy down → BootstrapSync retries) can't
// block event consumption. reloadThemes() guards skip-caddy mode internally.
func (tw *themeWatcher) triggerResync() {
	go func() {
		defer func() {
			if r := recover(); r != nil {
				slog.Error("[caddy] theme watcher resync goroutine recovered from panic", "panic", r)
			}
		}()
		applied, _, errMsg := tw.service.reloadThemes()
		switch {
		case errMsg != "":
			slog.Warn("[caddy] theme watcher resync failed", "error", errMsg)
		case applied:
			slog.Info("[caddy] theme watcher resynced Caddy after themes dir change")
		}
	}()
}

// reconcile ensures every theme subdir is being watched. Self-healing: themes
// added while the watcher was idle get picked up on the next event.
func (tw *themeWatcher) reconcile() {
	entries, err := os.ReadDir(tw.themesDir)
	if err != nil {
		throttledSlogWarn.Warn("watchReconcile", "cannot read themes dir during reconcile", "dir", tw.themesDir, "err", err)
		return
	}
	watched := tw.watcher.WatchList()
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		path := filepath.Join(tw.themesDir, e.Name())
		if slices.Contains(watched, path) {
			continue
		}
		if err := tw.watcher.Add(path); err != nil {
			throttledSlogWarn.Warn("watchAdd", "cannot watch theme subdir", "dir", path, "err", err)
		} else {
			slog.Debug("[caddy] theme watcher: watching", "dir", path)
		}
	}
}

// throttledSlogWarn logs a warn at most once per minute per key — reconcile
// runs on every fsnotify event, so a persistently unwatchable dir must not
// spam one line per event.
var throttledSlogWarn = newThrottledSlog()

type throttledSlog struct {
	mu   sync.Mutex
	last map[string]time.Time
}

func newThrottledSlog() *throttledSlog {
	return &throttledSlog{last: make(map[string]time.Time)}
}

func (t *throttledSlog) Warn(key, msg string, kv ...any) {
	t.mu.Lock()
	now := time.Now()
	if t.last[key].Add(time.Minute).After(now) {
		t.mu.Unlock()
		return
	}
	t.last[key] = now
	t.mu.Unlock()
	slog.Warn(msg, kv...)
}

// Close stops the watcher and releases fsnotify resources.
func (tw *themeWatcher) Close() {
	if tw == nil {
		return
	}
	select {
	case <-tw.done:
	default:
		close(tw.done)
	}
}

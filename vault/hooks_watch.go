package main

import (
	"log/slog"
	"os"
	"path/filepath"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/pocketbase/pocketbase/core"
)

// watchHookSources watches the SOURCE hook/migration directories and, on any
// change, re-stages them into the jsvm staging copies and execve-restarts the
// process (app.Restart) so the fresh staging is reloaded.
//
// Why not jsvm's built-in HooksWatch: it watches HooksDir — the staging copy —
// which is written once at startup and never again. A watcher on a file that
// cannot change never fires; --hooksWatch was structurally dead since staging
// moved into a private temp dir. This watcher closes the loop at the source.
//
// Pack hooks/migrations are NOT watched: builtin packs are embedded in the
// binary (immutable at runtime) and Pack does not expose local pack source
// dirs. Editing pack sources still requires a container restart.
func watchHookSources(app core.App, sources []string, restage func() error) {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		slog.Warn("[vanblog] hooks source watcher unavailable, falling back to manual restarts", "err", err)
		return
	}
	watched := 0
	for _, src := range sources {
		err := filepath.WalkDir(src, func(p string, d os.DirEntry, walkErr error) error {
			if walkErr != nil {
				return walkErr
			}
			if d.IsDir() {
				return watcher.Add(p)
			}
			return nil
		})
		if err != nil {
			slog.Warn("[vanblog] watch source skipped", "dir", src, "err", err)
			continue
		}
		watched++
	}
	if watched == 0 {
		_ = watcher.Close()
		return
	}

	// Debounce: editors and re-stages emit event bursts; one restart per
	// burst is enough. execve-restarting on every single event would thrash.
	var debounce *time.Timer
	go func() {
		defer watcher.Close()
		for {
			select {
			case ev, ok := <-watcher.Events:
				if !ok {
					return
				}
				if ev.Op == fsnotify.Chmod {
					continue
				}
				file := ev.Name
				if debounce != nil {
					debounce.Stop()
				}
				debounce = time.AfterFunc(300*time.Millisecond, func() {
					if err := restage(); err != nil {
						// Keep serving the previous staging: a failed re-stage
						// means the sources are broken, and restarting would
						// crash-loop on them at startup (jsvm fail-fast panic).
						slog.Error("[vanblog] hooks restage failed, staying on previous staging", "err", err)
						return
					}
					slog.Info("[vanblog] hooks source changed, restarting", "file", file)
					if err := app.Restart(); err != nil {
						slog.Error("[vanblog] hooks restart failed", "err", err)
					}
				})
			case err, ok := <-watcher.Errors:
				if !ok {
					return
				}
				slog.Warn("[vanblog] hooks watcher error", "err", err)
			}
		}
	}()
}

// nonMissingDirs filters the given dirs down to those that exist on disk.
func nonMissingDirs(dirs ...string) []string {
	out := make([]string, 0, len(dirs))
	for _, d := range dirs {
		if d == "" {
			continue
		}
		if info, err := os.Stat(d); err == nil && info.IsDir() {
			out = append(out, d)
		}
	}
	return out
}

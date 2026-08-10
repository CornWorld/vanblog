package article

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
	"time"
)

// revalidateAstroCache notifies the Astro SSR server to invalidate cached
// pages. Called asynchronously when posts are created/updated/deleted.
//
// ASTRO_URL env overrides the default (host-side Astro dev :4321, or the
// in-container Astro SSR in prod). Non-200 responses are logged but not
// retried — Astro caches are eventually consistent via SWR.
func revalidateAstroCache(tags []string) {
	defer func() {
		if r := recover(); r != nil {
			// This runs on a goroutine per post edit / restore / purge. A panic
			// would crash the whole process (Go has no global panic hook) and
			// take the entire site down over a cache invalidation — never allow it.
			slog.Error("[article] revalidate: recovered from panic", "panic", r)
		}
	}()
	astroURL := os.Getenv("ASTRO_URL")
	if astroURL == "" {
		astroURL = "http://127.0.0.1:4321"
	}

	body, _ := json.Marshal(map[string][]string{"tags": tags})
	client := &http.Client{Timeout: 5 * time.Second}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, astroURL+"/api/revalidate", bytes.NewReader(body))
	if err != nil {
		slog.Error("[article] revalidate: failed to build request", "url", astroURL, "err", err)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		slog.Error("[article] revalidate: failed to reach Astro", "url", astroURL, "err", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		slog.Warn("[article] revalidate: Astro returned non-OK", "status", resp.StatusCode)
	} else {
		slog.Info("[article] revalidate: cache invalidated", "tags", tags)
	}
}

package article

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/cornworld/vanblog/internal/audit"
	"github.com/pocketbase/pocketbase/core"
)

// revalidateAstroCache notifies the Astro SSR server to invalidate cached
// pages. Called asynchronously when posts are created/updated/deleted, and
// daily by the self-heal cron.
//
// ASTRO_URL env overrides the default (host-side Astro dev :4321, or the
// in-container Astro SSR in prod). Non-200 responses and network errors
// write a result="failure" audits row (admin 可见)——失效通知是单次
// fire-and-forget,丢失即首页停旧内容,必须让管理员知道。
func revalidateAstroCache(app core.App, tags []string) {
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
	fail := func(reason string) {
		slog.Error("[article] revalidate failed", "reason", reason, "tags", tags, "url", astroURL)
		audit.OpsFailed(app, "revalidate.failure", strings.Join(tags, ","), map[string]any{
			"reason": reason, "url": astroURL,
		})
	}

	body, _ := json.Marshal(map[string][]string{"tags": tags})
	client := &http.Client{Timeout: 5 * time.Second}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, astroURL+"/api/revalidate", bytes.NewReader(body))
	if err != nil {
		fail("failed to build request")
		return
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		fail("failed to reach Astro: " + err.Error())
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		fail(fmt.Sprintf("Astro returned non-OK: %d", resp.StatusCode))
	} else {
		slog.Info("[article] revalidate: cache invalidated", "tags", tags)
	}
}

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

// selfhealCronId must match the cronAdd id in pb_hooks/selfheal.pb.js.
const selfhealCronId = "posts-revalidate-selfheal"

// verifySelfhealCron warns at serve time when the JSVM self-heal cron is
// absent. The daily cache self-heal moved from a Go cron (formerly
// MustAdd here, now removed) to a user-editable JSVM file — a pb_hooks
// volume override or upgrade reset silently drops it, which is the exact
// "后台安全网失灵不可见" incident shape (docs/lessons-learned §1: JSVM
// hook not executing, no error surfaced). JSVM hook files register their
// crons during jsvm.MustRegister, i.e. before any OnServe bind fires — so
// at this point a missing id means the file did not load/register.
// slog + audit row: both surfaces, because this is precisely the failure
// that must be observable (与 backup.prune 同一哲学).
func verifySelfhealCron(app core.App) {
	for _, job := range app.Cron().Jobs() {
		if job.Id() == selfhealCronId {
			return
		}
	}
	slog.Error("[selfheal] cron posts-revalidate-selfheal not registered — daily cache self-heal is OFF",
		"hint", "check pb_hooks/selfheal.pb.js (volume override, reset by upgrade, or JS syntax error)")
	audit.OpsFailed(app, "selfheal.cron.missing", "pb_hooks/selfheal.pb.js", map[string]any{
		"reason": "cron id posts-revalidate-selfheal absent at serve time",
	})
}

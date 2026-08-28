// Package visits provides atomic view counter and daily aggregation.
package visits

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
)

// Manager handles visit tracking operations.
type Manager struct {
	app core.App
}

// New creates a visits Manager and registers its pb hook subscriptions.
//
// Hook: OnRecordCreateRequest("visits") — when a visit record is created
// via the HTTP API, also bump the linked post's viewCount atomically.
// (Internal Increment() already does this; this hook covers the rare path
// where a client POSTs a visits record directly.)
func New(app core.App) *Manager {
	m := &Manager{app: app}
	app.OnRecordCreateRequest("visits").BindFunc(m.bumpPostViewOnVisitCreate)

	// Public counting endpoints. `record` is the hot path (fired on every
	// page load by the theme); `summary` feeds read-side displays (total
	// views in the footer). Both are plain SQL — no Pack/JSVM involvement.
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		se.Router.POST("/api/vanblog/visits/record", m.handleRecord)
		se.Router.GET("/api/vanblog/visits/summary", m.handleSummary)
		return se.Next()
	})
	return m
}

// recordRequest is the body of POST /api/vanblog/visits/record.
type recordRequest struct {
	// Path is the canonical article path (e.g. /posts/abc). Used for the
	// per-path daily row.
	Path string `json:"path"`
	// PostID is the article id, sent by the theme from the article page.
	// When set, that post's viewCount is bumped atomically — this avoids
	// relying on the posts.pathname field (optional custom permalink).
	PostID string `json:"postId"`
}

// handleRecord counts one page view: per-path daily rows plus (when a post is
// identified) an atomic viewCount bump. Public — no auth: page loads are
// fire-and-forget from the theme.
func (m *Manager) handleRecord(e *core.RequestEvent) error {
	var req recordRequest
	if err := json.NewDecoder(e.Request.Body).Decode(&req); err != nil {
		return e.BadRequestError("invalid JSON body", "")
	}
	path := strings.TrimSpace(req.Path)
	if path == "" {
		return e.BadRequestError("missing 'path'", "")
	}

	// Resolve post id: prefer the explicit postId the theme sends; fall back
	// to pathname lookup (best effort; non-article paths still count).
	postID := strings.TrimSpace(req.PostID)
	if postID == "" {
		if post, err := m.app.FindFirstRecordByFilter(
			"posts",
			"pathname={:p} && deleted=false",
			dbx.Params{"p": path},
		); err == nil && post != nil {
			postID = post.Id
		}
	}

	if err := m.Increment(path, postID); err != nil {
		return e.JSON(http.StatusInternalServerError, err.Error())
	}
	return e.JSON(http.StatusOK, map[string]bool{"ok": true})
}

// handleSummary returns the site-wide total view count (sum of all per-path
// daily rows), for footer/stat displays.
func (m *Manager) handleSummary(e *core.RequestEvent) error {
	var total int64
	if err := m.app.DB().NewQuery(
		"SELECT COALESCE(SUM(views), 0) FROM visits WHERE path != ''",
	).Row(&total); err != nil {
		return e.JSON(http.StatusInternalServerError, err.Error())
	}
	return e.JSON(http.StatusOK, map[string]int64{"totalViews": total})
}

// bumpPostViewOnVisitCreate runs after the visit record is created by an
// HTTP request; reads the linked post id and increments its viewCount.
func (m *Manager) bumpPostViewOnVisitCreate(e *core.RecordRequestEvent) error {
	if err := e.Next(); err != nil {
		return err
	}
	postID := e.Record.GetString("post")
	if postID != "" {
		m.IncrementPostView(postID)
	}
	return nil
}

// Increment records a page view for a given path.
func (m *Manager) Increment(path string, postID string) error {
	today := time.Now().Format("2006-01-02")

	// Find existing record for today + path
	existing, err := m.app.FindFirstRecordByFilter(
		"visits",
		"date={:date} && path={:path}",
		dbx.Params{"date": today, "path": path},
	)

	if err != nil || existing == nil {
		// Create new visit record
		col, err := m.app.FindCollectionByNameOrId("visits")
		if err != nil {
			return fmt.Errorf("visits: collection not found: %w", err)
		}
		record := core.NewRecord(col)
		record.Set("date", today)
		record.Set("path", path)
		record.Set("views", 1)
		record.Set("uniques", 1)
		record.Set("lastVisitedAt", time.Now().UTC().Format(time.RFC3339))
		if postID != "" {
			record.Set("post", postID)
		}
		if err := m.app.Save(record); err != nil {
			return fmt.Errorf("visits: failed to create record: %w", err)
		}
	} else {
		// Atomically bump the daily counter (SQL `views = views + 1`),
		// avoiding the read-modify-write race that loses increments under
		// concurrent requests. The find above only decides create-vs-update.
		now := time.Now().UTC().Format(time.RFC3339)
		if _, err := m.app.DB().
			Update("visits",
				dbx.Params{
					"views":         dbx.NewExp("views + 1"),
					"lastVisitedAt": now,
				},
				dbx.NewExp("date = {:date} AND path = {:path}", dbx.Params{"date": today, "path": path}),
			).Execute(); err != nil {
			return fmt.Errorf("visits: failed to bump views: %w", err)
		}
	}

	// Increment post's viewCount
	if postID != "" {
		m.IncrementPostView(postID)
	}

	return nil
}

// IncrementPostView atomically bumps a post's viewCount via SQL
// (`viewCount = viewCount + 1`). A missing post is a no-op (0 rows affected).
func (m *Manager) IncrementPostView(postID string) {
	if _, err := m.app.DB().
		Update("posts",
			dbx.Params{"viewCount": dbx.NewExp("viewCount + 1")},
			dbx.NewExp("id = {:id}", dbx.Params{"id": postID}),
		).Execute(); err != nil {
		slog.Warn("[visits] failed to bump post viewCount", "post", postID, "err", err)
	}
}

// GetDailySummary returns aggregated stats for a specific date.
func (m *Manager) GetDailySummary(date string) (views int, uniques int, err error) {
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}

	records, err := m.app.FindRecordsByFilter(
		"visits",
		"date={:date}",
		"", 0, 0,
		dbx.Params{"date": date},
	)
	if err != nil {
		return 0, 0, fmt.Errorf("visits: daily summary query failed: %w", err)
	}

	for _, r := range records {
		views += r.GetInt("views")
		uniques += r.GetInt("uniques")
	}
	return views, uniques, nil
}

// AggregateDaily creates or updates the site-wide aggregate row (path="").
func (m *Manager) AggregateDaily(date string) error {
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}

	// Sum all per-path visits for this date
	records, err := m.app.FindRecordsByFilter(
		"visits",
		"date={:date} && path != ''",
		"", 0, 0,
		dbx.Params{"date": date},
	)
	if err != nil {
		return fmt.Errorf("visits: aggregate query failed: %w", err)
	}

	totalViews := 0
	totalUniques := 0
	for _, r := range records {
		totalViews += r.GetInt("views")
		totalUniques += r.GetInt("uniques")
	}

	// Find or create aggregate row (path="")
	existing, err := m.app.FindFirstRecordByFilter(
		"visits",
		"date={:date} && path = ''",
		dbx.Params{"date": date},
	)

	col, _ := m.app.FindCollectionByNameOrId("visits")

	if err != nil || existing == nil {
		record := core.NewRecord(col)
		record.Set("date", date)
		record.Set("path", "")
		record.Set("views", totalViews)
		record.Set("uniques", totalUniques)
		return m.app.Save(record)
	}

	existing.Set("views", totalViews)
	existing.Set("uniques", totalUniques)
	return m.app.Save(existing)
}

// GetTopPosts returns the most viewed published posts.
func (m *Manager) GetTopPosts(limit int) ([]*core.Record, error) {
	if limit <= 0 {
		limit = 10
	}

	records, err := m.app.FindRecordsByFilter(
		"posts",
		"status='published' && deleted=false",
		"-viewCount",
		limit, 0,
	)
	if err != nil {
		return nil, fmt.Errorf("visits: top posts query failed: %w", err)
	}
	return records, nil
}

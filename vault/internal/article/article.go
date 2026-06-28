// Package article provides article-specific business logic
// that goes beyond pb's automatic CRUD API.
package article

import (
	"fmt"
	"net/http"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
)

// Manager handles article operations.
type Manager struct {
	app core.App
}

// New creates an article Manager and registers its pb hook subscriptions.
//
// Hooks:
//   - OnRecordAfterCreateSuccess/UpdateSuccess/DeleteSuccess("posts"):
//     invalidate Astro SSR cache so readers see the change immediately.
//   - OnServe: register /api/vanblog/timeline and /api/vanblog/search.
func New(app core.App) *Manager {
	m := &Manager{app: app}
	m.handlePostsCacheInvalidation(app)
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		se.Router.GET("/api/vanblog/timeline", m.handleTimelineEndpoint)
		se.Router.GET("/api/vanblog/search", m.handleSearchEndpoint)
		return se.Next()
	})
	return m
}

// handlePostsCacheInvalidation wires Astro cache revalidation to posts CRUD.
// Each handler runs in a goroutine so the request isn't blocked on Astro's
// response.
func (m *Manager) handlePostsCacheInvalidation(app core.App) {
	invalidate := func() { go revalidateAstroCache([]string{"posts"}) }
	app.OnRecordAfterCreateSuccess("posts").BindFunc(func(e *core.RecordEvent) error {
		invalidate()
		return nil
	})
	app.OnRecordAfterUpdateSuccess("posts").BindFunc(func(e *core.RecordEvent) error {
		invalidate()
		return nil
	})
	app.OnRecordAfterDeleteSuccess("posts").BindFunc(func(e *core.RecordEvent) error {
		invalidate()
		return nil
	})
}

func (m *Manager) handleTimelineEndpoint(e *core.RequestEvent) error {
	timeline, err := m.GetTimeline()
	if err != nil {
		return e.JSON(http.StatusInternalServerError, err.Error())
	}
	return e.JSON(http.StatusOK, timeline)
}

func (m *Manager) handleSearchEndpoint(e *core.RequestEvent) error {
	q := e.Request.URL.Query().Get("q")
	if q == "" {
		return e.JSON(http.StatusBadRequest, "missing param 'q'")
	}
	results, err := m.Search(q, 20)
	if err != nil {
		return e.JSON(http.StatusInternalServerError, err.Error())
	}
	return e.JSON(http.StatusOK, results)
}

// TimelineEntry represents articles grouped by year and month.
type TimelineEntry struct {
	Year    int            `json:"year"`
	Count   int            `json:"count"`
	Months  []MonthSummary `json:"months"`
}

// MonthSummary represents articles in a single month.
type MonthSummary struct {
	Month  int    `json:"month"`
	Count  int    `json:"count"`
	Titles []PostSummary `json:"titles"`
}

// PostSummary is a lightweight article representation.
type PostSummary struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Pathname  string `json:"pathname"`
	CreatedAt string `json:"createdAt"`
}

// SearchResult represents a search hit.
type SearchResult struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	Path  string `json:"path"`
}

// GetTimeline returns published articles grouped by year → month.
// This replaces the original article.provider.ts getTimeLineInfo().
func (m *Manager) GetTimeline() ([]TimelineEntry, error) {
	records, err := m.app.FindRecordsByFilter(
		"posts",
		"status='published' && deleted=false",
		"-created",
		0, 0,
	)
	if err != nil {
		return nil, fmt.Errorf("article: timeline query failed: %w", err)
	}

	// Group by year → month
	type monthKey struct{ year, month int }
	type yearKey struct{ year int }

	yearMap := map[int]map[monthKey][]PostSummary{}
	yearOrder := []int{}

	for _, r := range records {
		created := r.GetDateTime("created").Time()
		y := created.Year()
		mk := monthKey{y, int(created.Month())}

		if _, ok := yearMap[y]; !ok {
			yearMap[y] = map[monthKey][]PostSummary{}
			yearOrder = append(yearOrder, y)
		}
		yearMap[y][mk] = append(yearMap[y][mk], PostSummary{
			ID:        r.Id,
			Title:     r.GetString("title"),
			Pathname:  r.GetString("pathname"),
			CreatedAt: created.Format("2006-01-02"),
		})
	}

	// Build sorted result
	result := make([]TimelineEntry, 0, len(yearOrder))
	for _, y := range yearOrder {
		entry := TimelineEntry{Year: y}
		months := yearMap[y]
		monthKeys := make([]monthKey, 0, len(months))
		for k := range months {
			monthKeys = append(monthKeys, k)
		}
		// Sort months descending
		for i := 0; i < len(monthKeys); i++ {
			for j := i + 1; j < len(monthKeys); j++ {
				if monthKeys[j].month > monthKeys[i].month {
					monthKeys[i], monthKeys[j] = monthKeys[j], monthKeys[i]
				}
			}
		}

		for _, mk := range monthKeys {
			summaries := months[mk]
			entry.Months = append(entry.Months, MonthSummary{
				Month:  mk.month,
				Count:  len(summaries),
				Titles: summaries,
			})
			entry.Count += len(summaries)
		}
		result = append(result, entry)
	}

	return result, nil
}

// Search performs a simple LIKE search across title and content.
// For a production blog with many articles, consider SQLite FTS5,
// but LIKE is sufficient for personal blogs (< 10k articles).
func (m *Manager) Search(query string, limit int) ([]SearchResult, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	// Search in title and content using OR
	records, err := m.app.FindRecordsByFilter(
		"posts",
		"status='published' && deleted=false && (title~{:query} || content~{:query})",
		"-created",
		limit, 0,
		dbx.Params{"query": query},
	)
	if err != nil {
		return nil, fmt.Errorf("article: search query failed: %w", err)
	}

	results := make([]SearchResult, 0, len(records))
	for _, r := range records {
		results = append(results, SearchResult{
			ID:    r.Id,
			Title: r.GetString("title"),
			Path:  r.GetString("pathname"),
		})
	}
	return results, nil
}

// Publish changes a post's status from draft to published.
func (m *Manager) Publish(postID string) error {
	post, err := m.app.FindRecordById("posts", postID)
	if err != nil {
		return fmt.Errorf("article: post not found: %w", err)
	}

	if post.GetString("status") == "published" {
		return nil // already published, no-op
	}

	post.Set("status", "published")
	return m.app.Save(post)
}

// Unpublish changes a post's status back to draft.
func (m *Manager) Unpublish(postID string) error {
	post, err := m.app.FindRecordById("posts", postID)
	if err != nil {
		return fmt.Errorf("article: post not found: %w", err)
	}

	post.Set("status", "draft")
	return m.app.Save(post)
}

// GetByPathname finds a published post by its custom URL path.
func (m *Manager) GetByPathname(pathname string) (*core.Record, error) {
	record, err := m.app.FindFirstRecordByFilter(
		"posts",
		"pathname={:path} && status='published' && deleted=false",
		dbx.Params{"path": pathname},
	)
	if err != nil {
		return nil, fmt.Errorf("article: not found by path %q: %w", pathname, err)
	}
	return record, nil
}

// GetRecent returns the most recently published posts.
func (m *Manager) GetRecent(limit int) ([]*core.Record, error) {
	if limit <= 0 {
		limit = 10
	}

	records, err := m.app.FindRecordsByFilter(
		"posts",
		"status='published' && deleted=false",
		"-created",
		limit, 0,
	)
	if err != nil {
		return nil, fmt.Errorf("article: recent query failed: %w", err)
	}
	return records, nil
}

// GetByCategory returns published posts in a specific category.
func (m *Manager) GetByCategory(categoryID string, limit int, offset int) ([]*core.Record, error) {
	if limit <= 0 {
		limit = 20
	}

	records, err := m.app.FindRecordsByFilter(
		"posts",
		"status='published' && deleted=false && category={:cat}",
		"-created",
		limit, offset,
		dbx.Params{"cat": categoryID},
	)
	if err != nil {
		return nil, fmt.Errorf("article: category query failed: %w", err)
	}
	return records, nil
}

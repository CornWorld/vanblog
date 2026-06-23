// Package visits provides atomic view counter and daily aggregation.
package visits

import (
	"fmt"
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
)

// Manager handles visit tracking operations.
type Manager struct {
	app core.App
}

// New creates a visits Manager.
func New(app core.App) *Manager {
	return &Manager{app: app}
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
		// Increment existing record
		views := existing.GetInt("views") + 1
		existing.Set("views", views)
		existing.Set("lastVisitedAt", time.Now().UTC().Format(time.RFC3339))
		if err := m.app.Save(existing); err != nil {
			return fmt.Errorf("visits: failed to update record: %w", err)
		}
	}

	// Increment post's viewCount
	if postID != "" {
		m.incrementPostView(postID)
	}

	return nil
}

func (m *Manager) incrementPostView(postID string) {
	post, err := m.app.FindRecordById("posts", postID)
	if err != nil {
		return
	}
	current := post.GetInt("viewCount")
	post.Set("viewCount", current+1)
	m.app.Save(post)
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

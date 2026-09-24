// Package site provides centralized access to the single-row site configuration.
// This prevents scattered FindFirstRecordByFilter("site", "") calls across packages.
package site

import (
	"cmp"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/pocketbase/pocketbase/core"
)

// ErrDisplayOptionAbsent marks "key not set in displayOptions" — distinct
// from an unreadable config, so callers can fail closed on the latter
// (unreadable config must never be treated as "use the default" where the
// default direction is destructive; see admin backupKeep retention).
var ErrDisplayOptionAbsent = errors.New("site: displayOptions key absent")

// DisplayNumber reads displayOptions[key] as a JSON number.
//   - key absent or non-numeric → (0, ErrDisplayOptionAbsent)
//   - site record unreadable or displayOptions unparsable → (0, err)
//
// Callers own the clamping and the failure semantics (default vs fail-closed);
// this helper only centralizes the record fetch + JSON parse so they don't
// proliferate (was copy-pasted in feedLimit / unlockTTLDuration / backupKeep).
func DisplayNumber(app core.App, key string) (float64, error) {
	rec, err := Get(app)
	if err != nil {
		return 0, err
	}
	var opts map[string]any
	if raw := rec.GetString("displayOptions"); raw != "" {
		if err := json.Unmarshal([]byte(raw), &opts); err != nil {
			return 0, fmt.Errorf("site: displayOptions unparsable: %w", err)
		}
	}
	v, ok := opts[key].(float64)
	if !ok {
		return 0, ErrDisplayOptionAbsent
	}
	return v, nil
}

// Info holds commonly-used site fields extracted from the single site record.
type Info struct {
	SiteName         string
	BaseURL          string
	Author           string
	Description      string
	CommentsProvider string
	AnalyticsScript  string
	Theme            string
	AllowedDomains   []string
}

// Get fetches the site config record (there should be exactly one).
// Returns error if no site record exists.
func Get(app core.App) (*core.Record, error) {
	record, err := app.FindFirstRecordByFilter("site", "")
	if err != nil {
		return nil, fmt.Errorf("site: config record not found: %w", err)
	}
	return record, nil
}

// GetInfo extracts commonly-used fields into a typed struct.
func GetInfo(app core.App) (*Info, error) {
	record, err := Get(app)
	if err != nil {
		return nil, err
	}

	info := &Info{
		SiteName:         record.GetString("siteName"),
		BaseURL:          record.GetString("baseUrl"),
		Author:           record.GetString("author"),
		CommentsProvider: record.GetString("commentsProvider"),
		AnalyticsScript:  record.GetString("analyticsScript"),
		Theme:            record.GetString("theme"),
		AllowedDomains:   record.GetStringSlice("allowedDomains"),
	}

	info.Description = cmp.Or(record.GetString("siteDesc"), info.SiteName)

	if info.SiteName == "" {
		info.SiteName = "Vanblog"
	}

	return info, nil
}

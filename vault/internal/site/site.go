// Package site provides centralized access to the single-row site configuration.
// This prevents scattered FindFirstRecordByFilter("site", "") calls across packages.
package site

import (
	"fmt"

	"github.com/pocketbase/pocketbase/core"
)

// Info holds commonly-used site fields extracted from the single site record.
type Info struct {
	SiteName        string
	BaseURL         string
	Author          string
	Description     string
	CommentsProvider string
	AnalyticsScript string
	Theme           string
	AllowedDomains  []string
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

	if desc := record.GetString("siteDesc"); desc != "" {
		info.Description = desc
	} else {
		info.Description = info.SiteName
	}

	if info.SiteName == "" {
		info.SiteName = "Vanblog"
	}

	return info, nil
}

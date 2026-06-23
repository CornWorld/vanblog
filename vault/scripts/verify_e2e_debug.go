//go:build ignore

// Debug failing E2E checks.
package main

import (
	"encoding/json"
	"fmt"
	"os"

	_ "github.com/cornworld/vanblog/pb_migrations"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

func main() {
	tmpDir, _ := os.MkdirTemp("", "pb-e2e-debug")
	defer os.RemoveAll(tmpDir)

	app := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: tmpDir})
	app.Bootstrap()
	app.RunAppMigrations()

	// Create basic data
	usersCol, _ := app.FindCollectionByNameOrId("users")
	admin := core.NewRecord(usersCol)
	admin.Set("username", "admin")
	admin.Set("email", "admin@test.com")
	admin.Set("password", "password12345")
	admin.Set("passwordConfirm", "password12345")
	admin.Set("role", "admin")
	app.Save(admin)

	postsCol, _ := app.FindCollectionByNameOrId("posts")
	p1 := core.NewRecord(postsCol)
	p1.Set("title", "Published")
	p1.Set("status", "published")
	app.Save(p1)

	p2 := core.NewRecord(postsCol)
	p2.Set("title", "Draft")
	p2.Set("status", "draft")
	app.Save(p2)

	p3 := core.NewRecord(postsCol)
	p3.Set("title", "Hidden")
	p3.Set("status", "hidden")
	app.Save(p3)

	// Test 1: status filter
	fmt.Println("=== Filter tests ===")
	tests := []struct {
		desc   string
		filter string
	}{
		{"status='published'", "status='published'"},
		{"status='draft'", "status='draft'"},
		{"status='hidden'", "status='hidden'"},
		{"status!='published'", "status!='published'"},
		{"empty filter (all)", ""},
	}
	for _, tc := range tests {
		records, err := app.FindRecordsByFilter("posts", tc.filter, "", 0, 0)
		if err != nil {
			fmt.Printf("  ❌ %s → error: %v\n", tc.desc, err)
			continue
		}
		titles := make([]string, len(records))
		for i, r := range records {
			titles[i] = r.GetString("title")
		}
		fmt.Printf("  [%s] → %d results: %v\n", tc.desc, len(records), titles)
	}

	// Test 2: Revisions
	fmt.Println("\n=== Revision tests ===")
	revCol, _ := app.FindCollectionByNameOrId("revisions")
	rev := core.NewRecord(revCol)
	rev.Set("target", p1.Id)
	rev.Set("snapshot", json.RawMessage(`{"title":"old"}`))
	rev.Set("reason", "auto-save")
	rev.Set("authoredBy", admin.Id)
	if err := app.Save(rev); err != nil {
		fmt.Printf("  save revision error: %v\n", err)
	} else {
		fmt.Printf("  revision saved: id=%s\n", rev.Id)
	}

	// Query revisions
	revRecords, err := app.FindRecordsByFilter("revisions", "target='"+p1.Id+"'", "", 0, 0)
	if err != nil {
		fmt.Printf("  query revisions error: %v\n", err)
	} else {
		fmt.Printf("  revisions for post %s: %d results\n", p1.Id, len(revRecords))
	}

	// Test 3: Audits
	fmt.Println("\n=== Audit tests ===")
	auditCol, _ := app.FindCollectionByNameOrId("audits")
	audit := core.NewRecord(auditCol)
	audit.Set("actor", admin.Id)
	audit.Set("action", "post.update")
	audit.Set("target", p1.Id)
	audit.Set("result", "success")
	audit.Set("detail", json.RawMessage(`{"field":"title"}`))
	if err := app.Save(audit); err != nil {
		fmt.Printf("  save audit error: %v\n", err)
	} else {
		fmt.Printf("  audit saved: id=%s\n", audit.Id)
	}

	auditRecords, err := app.FindRecordsByFilter("audits", "", "", 0, 0)
	if err != nil {
		fmt.Printf("  query audits error: %v\n", err)
	} else {
		fmt.Printf("  total audits: %d\n", len(auditRecords))
	}
}

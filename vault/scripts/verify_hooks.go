//go:build ignore

// Verify pb 0.39 model-level hooks (triggered by app.Save, not HTTP).
// Run: go run scripts/verify_hooks.go

package main

import (
	"fmt"
	"os"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

func main() {
	tmpDir, _ := os.MkdirTemp("", "pb-hook-test")
	defer os.RemoveAll(tmpDir)

	app := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: tmpDir})

	hookFired := map[string]bool{}

	// Model-level hooks (triggered by app.Save / app.Delete)
	// These fire regardless of HTTP vs Go-layer save.
	app.OnRecordCreate().BindFunc(func(e *core.RecordEvent) error {
		hookFired["create"] = true
		fmt.Printf("  [hook] OnRecordCreate: collection=%s title=%s\n", e.Record.Collection().Name, e.Record.GetString("title"))
		return nil
	})

	app.OnRecordUpdate().BindFunc(func(e *core.RecordEvent) error {
		hookFired["update"] = true
		fmt.Printf("  [hook] OnRecordUpdate: collection=%s title=%s\n", e.Record.Collection().Name, e.Record.GetString("title"))
		return nil
	})

	app.OnRecordDelete().BindFunc(func(e *core.RecordEvent) error {
		hookFired["delete"] = true
		fmt.Printf("  [hook] OnRecordDelete: collection=%s\n", e.Record.Collection().Name)
		return nil
	})

	// HTTP-level hooks (triggered by API requests, not Go Save)
	// OnRecordCreateRequest = before API create
	// OnRecordUpdateRequest = before API update
	// These have different event type: *RecordRequestEvent
	app.OnRecordCreateRequest("posts").BindFunc(func(e *core.RecordRequestEvent) error {
		hookFired["createRequest"] = true
		fmt.Printf("  [hook] OnRecordCreateRequest (HTTP): title=%s\n", e.Record.GetString("title"))
		return e.Next()
	})

	app.OnRecordUpdateRequest("posts").BindFunc(func(e *core.RecordRequestEvent) error {
		hookFired["updateRequest"] = true
		fmt.Printf("  [hook] OnRecordUpdateRequest (HTTP): title=%s\n", e.Record.GetString("title"))
		return e.Next()
	})

	if err := app.Bootstrap(); err != nil {
		fmt.Printf("Bootstrap failed: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("=== pb 0.39 Hook API verification ===")

	// Create collection
	postsCol := core.NewCollection("base", "posts")
	postsCol.Fields.Add(&core.TextField{Name: "title"})
	postsCol.ListRule = ptr("")
	postsCol.ViewRule = ptr("")
	postsCol.CreateRule = ptr("")
	postsCol.UpdateRule = ptr("")
	postsCol.DeleteRule = ptr("")
	app.Save(postsCol)

	// Test model-level create
	fmt.Println("\n--- app.Save (create) ---")
	r := core.NewRecord(postsCol)
	r.Set("title", "Hello")
	app.Save(r)

	// Test model-level update
	fmt.Println("\n--- app.Save (update) ---")
	r.Set("title", "Updated")
	app.Save(r)

	// Test model-level delete
	fmt.Println("\n--- app.Delete ---")
	app.Delete(r)

	// Results
	fmt.Println("\n--- Hook results ---")
	expected := []string{"create", "update", "delete"}
	for _, name := range expected {
		status := "❌"
		if hookFired[name] {
			status = "✅"
		}
		fmt.Printf("  %s OnRecord%s (model-level, app.Save triggered)\n", status, titleCase(name))
	}

	// HTTP-level hooks only fire on API requests, not Go Save
	for _, name := range []string{"createRequest", "updateRequest"} {
		fmt.Printf("  ⏭️  OnRecord%s (HTTP-level, skipped — needs API call)\n", titleCase(name))
	}
}

func ptr(s string) *string { return &s }

func titleCase(s string) string {
	if len(s) == 0 {
		return s
	}
	return string(s[0]-32) + s[1:]
}

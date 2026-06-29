//go:build ignore

// Smoke test: load minimal hooks and check which events fire on
// app.Save() create/update/delete.
//
// Run: HOOKS_DIR=/tmp/test-hooks go run scripts/verify_hook_names.go

package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/jsvm"

	_ "github.com/cornworld/vanblog/pb_migrations"
)

func main() {
	tmpDir, _ := os.MkdirTemp("", "pb-hook-test")
	defer os.RemoveAll(tmpDir)

	hooksDir := os.Getenv("HOOKS_DIR")
	if hooksDir == "" {
		hooksDir, _ = filepath.Abs("./pb_hooks")
	}

	app := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: tmpDir})
	if err := app.Bootstrap(); err != nil {
		fmt.Printf("Bootstrap: %v\n", err)
		os.Exit(1)
	}
	if err := app.RunAppMigrations(); err != nil {
		fmt.Printf("Migration: %v\n", err)
		os.Exit(1)
	}

	jsvm.MustRegister(app, jsvm.Config{
		HooksDir:      hooksDir,
		HooksWatch:    false,
		HooksPoolSize: 5,
	})

	// Also bind Go-layer hooks directly to compare.
	app.OnRecordCreate("posts").BindFunc(func(e *core.RecordEvent) error {
		fmt.Printf("[GO] OnRecordCreate posts: id=%s title=%s isNew=%v\n",
			e.Record.Id, e.Record.GetString("title"), e.Record.IsNew())
		return nil
	})
	app.OnRecordUpdate("posts").BindFunc(func(e *core.RecordEvent) error {
		fmt.Printf("[GO] OnRecordUpdate posts: id=%s\n", e.Record.Id)
		return nil
	})
	app.OnRecordAfterCreateSuccess("posts").BindFunc(func(e *core.RecordEvent) error {
		fmt.Printf("[GO] OnRecordAfterCreateSuccess posts: id=%s\n", e.Record.Id)
		return nil
	})

	fmt.Println("=== test create/update/delete ===")

	postsCol, _ := app.FindCollectionByNameOrId("posts")

	// 1. Create
	post := core.NewRecord(postsCol)
	post.Set("title", "T1")
	if err := app.Save(post); err != nil {
		fmt.Printf("create: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("after create: IsNew=%v PK=%q\n", post.IsNew(), post.PK())

	// 2. Update
	post.Set("title", "T2")
	fmt.Printf("before update save: IsNew=%v\n", post.IsNew())
	if err := app.Save(post); err != nil {
		fmt.Printf("update: %v\n", err)
		os.Exit(1)
	}

	// 3. Delete
	if err := app.Delete(post); err != nil {
		fmt.Printf("delete: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("=== done ===")
}

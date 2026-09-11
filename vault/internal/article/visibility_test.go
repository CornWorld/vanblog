package article

import (
	"strings"
	"testing"

	"github.com/pocketbase/pocketbase/core"
)

// FindPublicPosts must DERIVE its predicate from the collection's ListRule, not
// from a copied constant: visibility changes land in the migrations once
// and every public surface follows automatically. This test pins that —
// tightening the rule must tighten FindPublicPosts, without touching this
// package.

func TestFindPublicPostsFollowsListRule(t *testing.T) {
	app := setupApp(t)

	col, err := app.FindCollectionByNameOrId("posts")
	if err != nil {
		t.Fatalf("find posts: %v", err)
	}

	createPost := func(title, pathname string) {
		t.Helper()
		r := core.NewRecord(col)
		r.Set("title", title)
		r.Set("content", "body of "+title)
		r.Set("status", "published")
		r.Set("pathname", pathname)
		if err := app.Save(r); err != nil {
			t.Fatalf("create %s: %v", title, err)
		}
	}
	createPost("RuleHidden", "/rule-hidden")
	createPost("StillVisible", "/still-visible")

	posts, err := FindPublicPosts(app, "", "-created", 0, 0, nil)
	if err != nil {
		t.Fatalf("baseline query: %v", err)
	}
	if len(posts) != 2 {
		t.Fatalf("baseline = %d posts, want 2", len(posts))
	}

	// Parenthesize the original rule first: && binds tighter than ||, so a
	// bare append would land inside the last || branch instead of the
	// top-level conjunction (the same trap FindPublicPosts guards against).
	tightened := "(" + *col.ListRule + `) && title != "RuleHidden"`
	col.ListRule = &tightened
	if err := app.Save(col); err != nil {
		t.Fatalf("save tightened rule: %v", err)
	}

	posts, err = FindPublicPosts(app, "", "-created", 0, 0, nil)
	if err != nil {
		t.Fatalf("query after rule change: %v", err)
	}
	for _, p := range posts {
		if p.GetString("title") == "RuleHidden" {
			t.Error("tightened ListRule did not propagate to FindPublicPosts")
		}
	}
	if len(posts) != 1 {
		t.Fatalf("after tightening = %d posts, want 1", len(posts))
	}
}

// Fail-closed: without a rule pb itself forbids anonymous reads, so
// FindPublicPosts must refuse to serve a public artifact ungated.
func TestFindPublicPostsFailClosedWithoutRule(t *testing.T) {
	app := setupApp(t)

	col, err := app.FindCollectionByNameOrId("posts")
	if err != nil {
		t.Fatalf("find posts: %v", err)
	}
	saved := *col.ListRule
	col.ListRule = nil
	if err := app.Save(col); err != nil {
		t.Fatalf("save nil rule: %v", err)
	}
	t.Cleanup(func() {
		col.ListRule = &saved
		_ = app.Save(col)
	})

	posts, err := FindPublicPosts(app, "", "", 0, 0, nil)
	if err == nil {
		t.Fatalf("expected error with nil ListRule, got %d posts", len(posts))
	}
	if !strings.Contains(err.Error(), "ListRule is unset") {
		t.Errorf("unexpected error: %v", err)
	}
}

// Pins the two load-bearing facts FindPublicPosts rests on:
//
//  1. Anonymous collapse: FindPublicPosts evaluates the rule with a nil
//     RequestInfo, so the rule's `@request.auth.id != ""` branch must
//     collapse to false — private and draft rows stay hidden. If pb ever
//     changes nil-RequestInfo resolution, this fails before any public
//     artifact leaks non-public rows.
//  2. The publicArtifactDelta: locked rows pass the ListRule by upstream
//     design (teaser cards on the REST surface) and are excluded only by
//     `password = ”`. Deleting the delta must fail here, not surface in
//     RSS/sitemap/search output.
func TestFindPublicPostsAnonymousExclusions(t *testing.T) {
	app := setupApp(t)

	col, err := app.FindCollectionByNameOrId("posts")
	if err != nil {
		t.Fatalf("find posts: %v", err)
	}

	create := func(title, status string, private bool, password string) {
		t.Helper()
		r := core.NewRecord(col)
		r.Set("title", title)
		r.Set("content", "body of "+title)
		r.Set("status", status)
		r.Set("pathname", "/"+strings.ToLower(title))
		r.Set("private", private)
		r.Set("password", password)
		if err := app.Save(r); err != nil {
			t.Fatalf("create %s: %v", title, err)
		}
	}
	create("Plain", "published", false, "")
	create("PrivateRow", "published", true, "")
	create("LockedRow", "published", false, "secret")
	create("DraftRow", "draft", false, "")

	posts, err := FindPublicPosts(app, "", "-created", 0, 0, nil)
	if err != nil {
		t.Fatalf("query: %v", err)
	}

	got := make([]string, 0, len(posts))
	for _, p := range posts {
		got = append(got, p.GetString("title"))
	}
	if len(got) != 1 || got[0] != "Plain" {
		t.Fatalf("public artifacts saw %v, want only [Plain]", got)
	}
}

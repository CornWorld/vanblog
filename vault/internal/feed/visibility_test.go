package feed

import (
	"strings"
	"testing"

	"github.com/cornworld/vanblog/internal/article"
	_ "github.com/cornworld/vanblog/pb_migrations"
	"github.com/pocketbase/pocketbase/core"
)

// Public-visibility contract tests: the feed package consumes
// article.FindPublicPosts, which derives its predicate from the posts
// ListRule — so locked (password) and private posts must never surface in
// RSS, Atom or the sitemap, and rule changes must propagate automatically.
// (2026-09 audit: feeds filtered password but missed private; sitemap missed
// both.)

func createLockedPost(t *testing.T, app core.App) {
	t.Helper()
	col, err := app.FindCollectionByNameOrId("posts")
	if err != nil {
		t.Fatalf("find posts: %v", err)
	}
	r := core.NewRecord(col)
	r.Set("title", "LockedTitle")
	r.Set("content", "LOCKED-SECRET-BODY")
	r.Set("status", "published")
	r.Set("pathname", "/locked")
	r.Set("password", "pw")
	if err := app.Save(r); err != nil {
		t.Fatalf("create locked post: %v", err)
	}
}

func createPrivatePost(t *testing.T, app core.App) {
	t.Helper()
	col, err := app.FindCollectionByNameOrId("posts")
	if err != nil {
		t.Fatalf("find posts: %v", err)
	}
	r := core.NewRecord(col)
	r.Set("title", "PrivateTitle")
	r.Set("content", "PRIVATE-SECRET-BODY")
	r.Set("status", "published")
	r.Set("pathname", "/priv")
	r.Set("private", true)
	if err := app.Save(r); err != nil {
		t.Fatalf("create private post: %v", err)
	}
}

func TestFeedsExcludeLockedAndPrivatePosts(t *testing.T) {
	app := setupApp(t)
	createLockedPost(t, app)
	createPrivatePost(t, app)
	createPost(t, app, "Open")

	for name, xml := range map[string][]byte{
		"rss":     mustGenerate(t, func() ([]byte, error) { return GenerateRSS(app, 20) }),
		"atom":    mustGenerate(t, func() ([]byte, error) { return GenerateAtom(app, 20) }),
		"sitemap": mustGenerate(t, func() ([]byte, error) { return GenerateSitemap(app) }),
	} {
		for _, token := range []string{"LockedTitle", "PrivateTitle", "/locked", "/priv"} {
			if strings.Contains(string(xml), token) {
				t.Errorf("%s leaks hidden post token %q", name, token)
			}
		}
		if !strings.Contains(string(xml), "/open") {
			t.Errorf("%s missing public post", name)
		}
	}
}

func mustGenerate(t *testing.T, gen func() ([]byte, error)) []byte {
	t.Helper()
	b, err := gen()
	if err != nil {
		t.Fatalf("generate: %v", err)
	}
	return b
}

// FindPublicPosts itself must refuse to weaken: extra conditions compose under the
// derived filter, so a caller-supplied "||" cannot widen visibility.
func TestFindPublicPostsExtraCannotWiden(t *testing.T) {
	app := setupApp(t)
	createLockedPost(t, app)

	posts, err := article.FindPublicPosts(app,
		`password = "pw" || private = true`, "", 0, 0, nil)
	if err != nil {
		t.Fatalf("FindPublicPosts: %v", err)
	}
	if len(posts) != 0 {
		t.Errorf("extra condition widened visibility: %d posts", len(posts))
	}
}

// The feed surfaces query through FindPublicPosts, so a ListRule change must propagate
// to RSS/Atom/sitemap without touching this package — the rules are the
// spec, and every call site understands them mechanically.
func TestFeedsFollowListRule(t *testing.T) {
	app := setupApp(t)
	createLockedPost(t, app)
	createPrivatePost(t, app)
	createPost(t, app, "Open")

	col, err := app.FindCollectionByNameOrId("posts")
	if err != nil {
		t.Fatalf("find posts: %v", err)
	}
	// Parenthesize the original rule first: && binds tighter than ||, so a
	// bare append would land inside the last || branch instead of the
	// top-level conjunction.
	tightened := "(" + *col.ListRule + `) && title != "Open"`
	col.ListRule = &tightened
	if err := app.Save(col); err != nil {
		t.Fatalf("save tightened rule: %v", err)
	}

	for name, xml := range map[string][]byte{
		"rss":     mustGenerate(t, func() ([]byte, error) { return GenerateRSS(app, 20) }),
		"atom":    mustGenerate(t, func() ([]byte, error) { return GenerateAtom(app, 20) }),
		"sitemap": mustGenerate(t, func() ([]byte, error) { return GenerateSitemap(app) }),
	} {
		if strings.Contains(string(xml), "/open") {
			t.Errorf("%s did not follow the tightened ListRule", name)
		}
	}
}

package migrationschema

import (
	"encoding/json"
	"reflect"
	"testing"
)

// The JSON wire format is the contract: admin/export.go writes it,
// migration/zip_import.go reads it (posts.json arrays and single post.json
// objects alike — the array-vs-single import behavior is covered by
// migration's zip_import tests end to end).
//
// A struct self round-trip can't detect a tag rename: marshal and unmarshal
// share the same tags, so a renamed field round-trips cleanly while every
// existing export zip becomes unreadable. The format is therefore pinned
// with golden strings.
func TestPostGoldenJSON(t *testing.T) {
	p := Post{
		ID:        "abc123",
		Title:     "My Post",
		Content:   "# Hello\n\nworld",
		Status:    "published",
		Pathname:  "my-post",
		Private:   true,
		Password:  "secret",
		Top:       1,
		Copyright: "cc-by",
		Category:  "dev",
		Tags:      []string{"go", "web"},
		Created:   "2026-01-01T00:00:00.000Z",
		Updated:   "2026-01-02T00:00:00.000Z",
	}

	b, err := json.Marshal(p)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	want := `{"id":"abc123","title":"My Post","content":"# Hello\n\nworld","status":"published","pathname":"my-post","private":true,"password":"secret","top":1,"copyright":"cc-by","category":"dev","tags":["go","web"],"created":"2026-01-01T00:00:00.000Z","updated":"2026-01-02T00:00:00.000Z"}`
	if string(b) != want {
		t.Fatalf("wire format drifted:\n got:  %s\n want: %s", b, want)
	}

	// Import side: the golden must decode back to the exact struct.
	var back Post
	if err := json.Unmarshal([]byte(want), &back); err != nil {
		t.Fatalf("unmarshal golden: %v", err)
	}
	if !reflect.DeepEqual(p, back) {
		t.Fatalf("golden does not round-trip:\nwant: %+v\ngot:  %+v", p, back)
	}
}

// TestPostGoldenJSON_OmittedAndZero pins the remaining wire behaviors the
// import side relies on: password is omitted when empty (omitempty), nil tags
// marshal as null, and every other key is always present (no omitempty) so
// importers can rely on the key set.
func TestPostGoldenJSON_OmittedAndZero(t *testing.T) {
	b, err := json.Marshal(Post{Title: "Two", Status: "draft", Pathname: "two"})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	want := `{"id":"","title":"Two","content":"","status":"draft","pathname":"two","private":false,"top":0,"copyright":"","category":"","tags":null,"created":"","updated":""}`
	if string(b) != want {
		t.Fatalf("wire format drifted:\n got:  %s\n want: %s", b, want)
	}
}

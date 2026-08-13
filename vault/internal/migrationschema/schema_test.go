package migrationschema

import (
	"encoding/json"
	"reflect"
	"testing"
)

func TestPostJSONRoundTrip(t *testing.T) {
	original := Post{
		ID:        "abc123",
		Title:     "My Post",
		Content:   "# Hello\n\n<img src=\"/api/files/x/y/a.png\">",
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

	data, err := json.Marshal(original)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var decoded Post
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if !reflect.DeepEqual(original, decoded) {
		t.Errorf("round-trip mismatch:\noriginal: %+v\ndecoded:  %+v", original, decoded)
	}
}

func TestPostArrayRoundTrip(t *testing.T) {
	// Full export writes posts.json as an array of Post.
	posts := []Post{
		{Title: "One", Status: "published"},
		{Title: "Two", Status: "draft", Pathname: "two"},
	}
	data, err := json.Marshal(posts)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	var decoded []Post
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("unmarshal array: %v", err)
	}
	if len(decoded) != 2 {
		t.Fatalf("len = %d, want 2", len(decoded))
	}
	if decoded[1].Pathname != "two" {
		t.Errorf("decoded[1].Pathname = %q, want two", decoded[1].Pathname)
	}
}

func TestPost_SingleObjectUnmarshal(t *testing.T) {
	// Single-post export writes post.json as one object, not an array.
	raw := `{"title":"Solo","content":"body","status":"published"}`
	var post Post
	if err := json.Unmarshal([]byte(raw), &post); err != nil {
		t.Fatalf("unmarshal single: %v", err)
	}
	if post.Title != "Solo" || post.Status != "published" {
		t.Errorf("unexpected: %+v", post)
	}
	if post.Password != "" {
		t.Errorf("password should default empty, got %q", post.Password)
	}
	if post.Tags != nil {
		t.Errorf("tags should default nil, got %v", post.Tags)
	}
}

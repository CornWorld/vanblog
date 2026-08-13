package mediaurl

import (
	"reflect"
	"testing"
)

func TestExtractAPIFilePaths(t *testing.T) {
	content := `<p>text</p>` +
		`<img src="/api/files/abc123/rec1/photo.png">` +
		`<img src='https://example.com/api/files/def456/rec2/cover.jpg'>` +
		`<img src="/static/non-api.png">` +
		`<p><a href="/api/files/abc123/rec1/photo.png">link</a></p>`

	got := ExtractAPIFilePaths(content)
	want := []string{"abc123/rec1/photo.png", "def456/rec2/cover.jpg"}

	if !reflect.DeepEqual(got, want) {
		t.Errorf("ExtractAPIFilePaths = %v, want %v", got, want)
	}
}

func TestExtractAPIFilePaths_Deduplicated(t *testing.T) {
	content := `<img src="/api/files/x/y/a.png"><img src="/api/files/x/y/a.png">`
	got := ExtractAPIFilePaths(content)
	if len(got) != 1 {
		t.Errorf("expected dedup, got %v", got)
	}
}

func TestExtractAPIFilePaths_Empty(t *testing.T) {
	if got := ExtractAPIFilePaths("no images here"); len(got) != 0 {
		t.Errorf("expected no paths, got %v", got)
	}
}

func TestExtractImgSrcs(t *testing.T) {
	content := `<img src="http://a.com/1.png">` +
		`<img src='https://b.com/2.jpg'>` +
		`<img src="/api/files/x/y/3.png">` +
		`<p>not an image</p>`

	got := ExtractImgSrcs(content)
	want := []string{
		"http://a.com/1.png",
		"https://b.com/2.jpg",
		"/api/files/x/y/3.png",
	}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("ExtractImgSrcs = %v, want %v", got, want)
	}
}

func TestExtractImgSrcs_NoImg(t *testing.T) {
	if got := ExtractImgSrcs("<p>hello</p>"); len(got) != 0 {
		t.Errorf("expected no img srcs, got %v", got)
	}
}

func TestIsInternalURL(t *testing.T) {
	cases := []struct {
		url  string
		want bool
	}{
		{"/api/files/x/y/a.png", true},                 // relative path
		{"./images/a.png", true},                       // relative path
		{"https://host/api/files/x/y/a.png", true},     // pb file behind host
		{"https://host/static/style.css", true},        // static behind host
		{"https://host/api/files/", true},              // pb path even bare
		{"http://external.com/a.png", false},           // external
		{"https://cdn.example.com/b.jpg", false},       // external
		{"https://host/api/notfiles/x", false},         // not a file path
		{"//protocol-relative.com/x.png", false},       // not matched by internal rules
	}
	for _, tc := range cases {
		if got := IsInternalURL(tc.url); got != tc.want {
			t.Errorf("IsInternalURL(%q) = %v, want %v", tc.url, got, tc.want)
		}
	}
}

func TestExtractExternalImgURLs(t *testing.T) {
	content := `<img src="http://external.com/a.png">` +
		`<img src="https://cdn.example.com/b.jpg">` +
		`<img src="/api/files/col/rec/x.png">` + // local relative
		`<img src="/relative.png">` + // relative
		`<img src="https://proxied/api/files/col/rec/y.png">` // proxied local

	got := ExtractExternalImgURLs(content)
	want := []string{"http://external.com/a.png", "https://cdn.example.com/b.jpg"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("ExtractExternalImgURLs = %v, want %v", got, want)
	}
}

func TestExtractExternalImgURLs_None(t *testing.T) {
	content := `<img src="/api/files/x/y/a.png"><img src="/local.png">`
	if got := ExtractExternalImgURLs(content); len(got) != 0 {
		t.Errorf("expected no external URLs, got %v", got)
	}
}

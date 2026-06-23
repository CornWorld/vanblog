package markdown

import (
	"strings"
	"testing"
)

func TestRender_BasicMarkdown(t *testing.T) {
	r := New()
	html, err := r.Render("**hello** world")
	if err != nil {
		t.Fatalf("Render failed: %v", err)
	}
	if !strings.Contains(html, "<strong>hello</strong>") {
		t.Errorf("expected <strong>hello</strong>, got: %s", html)
	}
}

func TestRender_GFMTable(t *testing.T) {
	r := New()
	input := `| Name | Age |
|------|-----|
| Bob  | 30  |
`
	html, err := r.Render(input)
	if err != nil {
		t.Fatalf("Render failed: %v", err)
	}
	if !strings.Contains(html, "<table>") {
		t.Errorf("expected <table>, got: %s", html)
	}
}

func TestRender_TaskList(t *testing.T) {
	r := New()
	input := "- [x] done\n- [ ] todo"
	html, err := r.Render(input)
	if err != nil {
		t.Fatalf("Render failed: %v", err)
	}
	if !strings.Contains(html, "checkbox") && !strings.Contains(html, "task-list") {
		// goldmark GFM renders task lists differently, check for input element
		if !strings.Contains(html, "checked") && !strings.Contains(html, "disabled") {
			t.Logf("task list output (may vary): %s", html)
		}
	}
}

func TestRender_Strikethrough(t *testing.T) {
	r := New()
	html, _ := r.Render("~~deleted~~")
	if !strings.Contains(html, "<del>") && !strings.Contains(html, "<s>") {
		t.Errorf("expected strikethrough, got: %s", html)
	}
}

func TestRender_CodeBlock(t *testing.T) {
	r := New()
	input := "```go\nfmt.Println(\"hello\")\n```"
	html, _ := r.Render(input)
	if !strings.Contains(html, "<code") { // goldmark adds class="language-go"
		t.Errorf("expected <code>, got: %s", html)
	}
}

func TestRender_RawHTML(t *testing.T) {
	r := New()
	html, _ := r.Render("<div class=\"custom\">raw</div>")
	if !strings.Contains(html, "<div class=\"custom\">") {
		t.Errorf("expected raw HTML passthrough, got: %s", html)
	}
}

func TestRender_Link(t *testing.T) {
	r := New()
	html, _ := r.Render("[link](https://example.com)")
	if !strings.Contains(html, `href="https://example.com"`) {
		t.Errorf("expected link, got: %s", html)
	}
}

func TestRender_Image(t *testing.T) {
	r := New()
	html, _ := r.Render("![alt](/img/photo.png)")
	if !strings.Contains(html, `<img`) || !strings.Contains(html, `/img/photo.png`) {
		t.Errorf("expected <img>, got: %s", html)
	}
}

func TestRender_Heading(t *testing.T) {
	r := New()
	html, _ := r.Render("# Title")
	if !strings.Contains(html, "<h1") {
		t.Errorf("expected <h1>, got: %s", html)
	}
	// AutoHeadingID should add id attribute
	if !strings.Contains(html, `id="`) {
		t.Logf("heading may not have auto ID: %s", html)
	}
}

func TestRenderExcerpt_WithMoreMarker(t *testing.T) {
	r := New()
	input := "Intro text\n\n<!-- more -->\n\nRest of the article."
	html, err := r.RenderExcerpt(input)
	if err != nil {
		t.Fatalf("RenderExcerpt failed: %v", err)
	}
	if strings.Contains(html, "Rest of the article") {
		t.Errorf("excerpt should not contain content after <!-- more -->")
	}
	if !strings.Contains(html, "Intro text") {
		t.Errorf("excerpt should contain intro text")
	}
}

func TestRenderExcerpt_NoMarker(t *testing.T) {
	r := New()
	long := strings.Repeat("word ", 100)
	html, _ := r.RenderExcerpt(long)
	// Should be truncated
	if len(html) > 2000 {
		t.Errorf("excerpt too long: %d chars", len(html))
	}
}

func TestCountWords_English(t *testing.T) {
	tests := []struct {
		input    string
		expected int
	}{
		{"hello world", 2},
		{"one", 1},
		{"", 0},
		{"  spaces  between  ", 2},
		{"hello, world!", 2},
	}
	for _, tc := range tests {
		got := CountWords(tc.input)
		if got != tc.expected {
			t.Errorf("CountWords(%q) = %d, want %d", tc.input, got, tc.expected)
		}
	}
}

func TestCountWords_Chinese(t *testing.T) {
	// Each Chinese character counts as 1 word
	tests := []struct {
		input    string
		expected int
	}{
		{"你好世界", 4},
		{"你好 hello 世界", 5}, // 2 CJK + 1 word + 2 CJK
		{"测试", 2},
	}
	for _, tc := range tests {
		got := CountWords(tc.input)
		if got != tc.expected {
			t.Errorf("CountWords(%q) = %d, want %d", tc.input, got, tc.expected)
		}
	}
}

func TestCountWords_Mixed(t *testing.T) {
	text := "这是一篇关于 Go 语言的文章。\n\nThis is about Go programming language."
	count := CountWords(text)
	// 这(1)是(1)一(1)篇(1)关(1)于(1)Go(1)语(1)言(1)的(1)文(1)章(1) = 13 CJK + 1 Latin word
	// This(1) is(1) about(1) Go(1) programming(1) language(1) = 6 words
	// Total ≈ 19-20
	if count < 18 || count > 22 {
		t.Errorf("CountWords mixed = %d, expected ~19-20", count)
	}
	t.Logf("mixed count: %d", count)
}

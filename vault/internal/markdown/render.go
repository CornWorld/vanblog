// Package markdown provides Markdown to HTML rendering using goldmark
// with GFM (GitHub Flavored Markdown) extensions.
package markdown

import (
	"bytes"
	"strings"

	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/renderer/html"
)

// Renderer wraps a configured goldmark Markdown instance.
type Renderer struct {
	md goldmark.Markdown
}

// New creates a configured Markdown renderer.
func New() *Renderer {
	md := goldmark.New(
		goldmark.WithExtensions(
			extension.GFM,        // tables, strikethrough, task lists, autolinks
			extension.Typographer, // smart quotes, dashes
		),
		goldmark.WithParserOptions(
			parser.WithAutoHeadingID(),
		),
		goldmark.WithRendererOptions(
			html.WithHardWraps(),   // \n → <br>
			html.WithUnsafe(),      // allow raw HTML (vanblog needs embedded content)
		),
	)
	return &Renderer{md: md}
}

// Render converts Markdown to HTML.
func (r *Renderer) Render(mdText string) (string, error) {
	var buf bytes.Buffer
	if err := r.md.Convert([]byte(mdText), &buf); err != nil {
		return "", err
	}
	return buf.String(), nil
}

// RenderExcerpt extracts and renders the content before <!-- more -->.
// If no marker is found, renders the first 300 characters of content.
func (r *Renderer) RenderExcerpt(mdText string) (string, error) {
	excerpt := extractExcerpt(mdText)
	return r.Render(excerpt)
}

// extractExcerpt returns the markdown before <!-- more -->,
// or the first 300 chars if no marker exists.
func extractExcerpt(mdText string) string {
	marker := "<!-- more -->"
	if idx := strings.Index(strings.ToLower(mdText), marker); idx >= 0 {
		return strings.TrimSpace(mdText[:idx])
	}

	// No marker: take first ~300 chars, try to break at paragraph end
	if len(mdText) <= 300 {
		return mdText
	}

	// Find paragraph break near 300 chars
	cut := mdText[:300]
	if idx := strings.LastIndex(cut, "\n\n"); idx > 100 {
		return strings.TrimSpace(cut[:idx])
	}
	return strings.TrimSpace(cut) + "..."
}

// CountWords estimates word count for mixed CJK + Latin text.
// Chinese/Japanese/Korean characters are counted individually.
// Latin words are counted by whitespace separation.
func CountWords(text string) int {
	count := 0
	inWord := false

	for _, r := range text {
		if isCJK(r) {
			if inWord {
				count++
				inWord = false
			}
			count++
			continue
		}

		if r == ' ' || r == '\t' || r == '\n' || r == '\r' {
			if inWord {
				count++
				inWord = false
			}
			continue
		}
		inWord = true
	}

	if inWord {
		count++
	}

	return count
}

// isCJK returns true for Chinese, Japanese, Korean characters.
func isCJK(r rune) bool {
	switch {
	case r >= 0x4E00 && r <= 0x9FFF: // CJK Unified Ideographs
		return true
	case r >= 0x3040 && r <= 0x309F: // Hiragana
		return true
	case r >= 0x30A0 && r <= 0x30FF: // Katakana
		return true
	case r >= 0xAC00 && r <= 0xD7AF: // Hangul
		return true
	case r >= 0xFF00 && r <= 0xFFEF: // Fullwidth Forms
		return true
	default:
		return false
	}
}

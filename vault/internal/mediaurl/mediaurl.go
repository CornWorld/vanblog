// Package mediaurl centralizes the string parsing shared by every module that
// touches image URLs embedded in post content:
//
//   - admin/export.go   — extract /api/files/ paths to bundle into a zip
//   - migration/zip_import.go — extract /api/files/ paths to rewrite URLs
//   - media/scan.go     — extract <img src> to track external images
//   - media/ingest.go   — extract external URLs to localize them
//
// Before this package existed, each of the four had its own near-duplicate
// scanner with subtly different rules, which caused mis-classification and
// race-style duplicate records. Keep ALL URL parsing here so the rules stay
// consistent.
package mediaurl

import (
	"regexp"
	"strings"
)

// APIFilePrefix is the pb file-serving path prefix.
// Full URL shape: /api/files/{collectionId}/{recordId}/{filename}
const APIFilePrefix = "/api/files/"

// ExtractAPIFilePaths returns the {collectionId}/{recordId}/{filename} portion
// of every /api/files/ reference found in content. Deduplicated, order kept.
//
// Used by export (to find files to bundle) and import (to know which URLs to
// rewrite). Works on any HTML-ish content — it scans for the prefix, not for
// a full URL, so absolute URLs like https://host/api/files/... also match.
func ExtractAPIFilePaths(content string) []string {
	var paths []string
	seen := make(map[string]bool)

	idx := 0
	for {
		pos := strings.Index(content[idx:], APIFilePrefix)
		if pos == -1 {
			break
		}
		pos += idx
		idx = pos + len(APIFilePrefix)

		end := idx
		for end < len(content) {
			c := content[end]
			if c == '"' || c == '\'' || c == ' ' || c == '>' || c == ')' {
				break
			}
			end++
		}

		filePath := content[idx:end]
		if filePath != "" && !seen[filePath] {
			seen[filePath] = true
			paths = append(paths, filePath)
		}
	}

	return paths
}

// imgSrcPattern matches <img src="..."> and <img src='...'> tags.
var imgSrcPattern = regexp.MustCompile(`<img[^>]+src=["']([^"']+)["']`)

// ExtractImgSrcs returns all unique <img src> values from HTML content.
func ExtractImgSrcs(html string) []string {
	matches := imgSrcPattern.FindAllStringSubmatch(html, -1)
	seen := make(map[string]bool)
	var urls []string
	for _, m := range matches {
		if len(m) >= 2 && !seen[m[1]] {
			seen[m[1]] = true
			urls = append(urls, m[1])
		}
	}
	return urls
}

// internalURLPattern matches pb-served file URLs behind a host (api/files or
// static). Plain relative paths are handled in IsInternalURL directly.
var internalURLPattern = regexp.MustCompile(`^https?://[^/]+/(api/files|static)/`)

// IsInternalURL reports whether url points to this vanblog instance itself:
// a relative path, or an absolute URL whose path starts with /api/files/ or
// /static/.
//
// Protocol-relative URLs (//host/...) reference another host and are treated
// as EXTERNAL, so the scan hook can track them. A single leading slash
// (/path/...) is a same-instance relative path.
func IsInternalURL(url string) bool {
	// Same-instance relative paths. `//` (protocol-relative) is a cross-host
	// reference and must NOT be treated as internal.
	if strings.HasPrefix(url, "/") && !strings.HasPrefix(url, "//") {
		return true
	}
	if strings.HasPrefix(url, "./") || strings.HasPrefix(url, "../") {
		return true
	}
	return internalURLPattern.MatchString(url)
}

// ExtractExternalImgURLs returns external (http/https) image URLs from HTML,
// excluding already-localized /api/files/ URLs (even behind a proxy host) and
// relative paths. Deduplicated.
func ExtractExternalImgURLs(html string) []string {
	allURLs := ExtractImgSrcs(html)
	var external []string
	seen := make(map[string]bool)
	for _, u := range allURLs {
		if !strings.HasPrefix(u, "http://") && !strings.HasPrefix(u, "https://") {
			continue
		}
		// Skip URLs that are already local pb API paths behind a proxy
		if strings.Contains(u, APIFilePrefix) {
			continue
		}
		if !seen[u] {
			seen[u] = true
			external = append(external, u)
		}
	}
	return external
}

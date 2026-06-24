package caddy

import "testing"

func TestAskHandler(t *testing.T) {
	tests := []struct {
		name           string
		allowedDomains []string
		domain         string
		want           bool
	}{
		{"empty allowlist allows all", nil, "anything.com", true},
		{"empty slice allows all", []string{}, "anything.com", true},
		{"exact match allowed", []string{"blog.example.com"}, "blog.example.com", true},
		{"exact match blocked", []string{"blog.example.com"}, "evil.com", false},
		{"multiple domains match", []string{"a.com", "b.com", "c.com"}, "b.com", true},
		{"multiple domains no match", []string{"a.com", "b.com"}, "z.com", false},
		{"case sensitive", []string{"Blog.com"}, "blog.com", false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := AskHandler(tc.allowedDomains, tc.domain)
			if got != tc.want {
				t.Errorf("AskHandler(%v, %q) = %v, want %v",
					tc.allowedDomains, tc.domain, got, tc.want)
			}
		})
	}
}

package caddy

import "testing"

func TestAskHandler(t *testing.T) {
	tests := []struct {
		name           string
		allowedDomains []string
		domain         string
		hasAdmin       bool
		want           bool
	}{
		// Setup window (no admin): allow all
		{"setup: empty allowlist allows all", nil, "anything.com", false, true},
		{"setup: any domain allowed", nil, "evil.com", false, true},

		// Post-setup (has admin): strict whitelist
		{"post-setup: empty allowlist denies all", nil, "anything.com", true, false},
		{"post-setup: exact match allowed", []string{"blog.example.com"}, "blog.example.com", true, true},
		{"post-setup: exact match blocked", []string{"blog.example.com"}, "evil.com", true, false},
		{"post-setup: multiple domains match", []string{"a.com", "b.com", "c.com"}, "b.com", true, true},
		{"post-setup: multiple domains no match", []string{"a.com", "b.com"}, "z.com", true, false},
		{"post-setup: case insensitive match", []string{"Blog.com"}, "blog.com", true, true},
		{"post-setup: empty slice denies all", []string{}, "anything.com", true, false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := AskHandler(tc.allowedDomains, tc.domain, tc.hasAdmin)
			if got != tc.want {
				t.Errorf("AskHandler(%v, %q, %v) = %v, want %v",
					tc.allowedDomains, tc.domain, tc.hasAdmin, got, tc.want)
			}
		})
	}
}

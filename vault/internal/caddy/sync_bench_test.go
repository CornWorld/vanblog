package caddy

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"
)

// buildBenchOpts creates BuildOpts with `themeCount` built themes on disk, so
// buildStaticRoutes emits a realistic number of file_server routes.
func buildBenchOpts(b *testing.B, themeCount int) BuildOpts {
	b.Helper()
	themesDir := b.TempDir()
	for i := 0; i < themeCount; i++ {
		_ = os.MkdirAll(filepath.Join(themesDir, fmt.Sprintf("theme%d", i), "dist", "client"), 0o755)
	}
	return BuildOpts{ThemesDir: themesDir, AdminDistDir: filepath.Join(themesDir, "no-admin")}
}

func benchRules(n int) []UserRule {
	rules := make([]UserRule, 0, n)
	for i := 0; i < n; i++ {
		rules = append(rules, UserRule{
			ID:   fmt.Sprintf("r%d", i),
			Type: "rewrite",
			From: fmt.Sprintf("/path%d/*", i),
			To:   "/static/docs/*",
		})
	}
	return rules
}

// BenchmarkBuildFullConfig_Small measures the CPU cost of one sync at personal-
// blog scale (~2 themes + 10 user rules). This is the dominating cost of a
// resync; the HTTP validate + load round-trips to a localhost Caddy add only
// sub-millisecond network latency on top.
func BenchmarkBuildFullConfig_Small(b *testing.B) {
	opts := buildBenchOpts(b, 2)
	opts.Defaults()
	rules := benchRules(10)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		cfg, err := BuildFullConfig(opts, rules)
		if err != nil {
			b.Fatal(err)
		}
		if _, err := cfg.JSON(); err != nil {
			b.Fatal(err)
		}
	}
}

// BenchmarkBuildFullConfig_Large stresses the upper bound: 20 themes + the
// MaxUserRules cap (50 rules). A single sync must stay in the low-millisecond
// range so the fsnotify watcher's resync never feels heavy.
func BenchmarkBuildFullConfig_Large(b *testing.B) {
	opts := buildBenchOpts(b, 20)
	opts.Defaults()
	rules := benchRules(50)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		cfg, err := BuildFullConfig(opts, rules)
		if err != nil {
			b.Fatal(err)
		}
		if _, err := cfg.JSON(); err != nil {
			b.Fatal(err)
		}
	}
}

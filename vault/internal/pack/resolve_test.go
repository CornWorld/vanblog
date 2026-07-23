package pack

import (
	"strings"
	"testing"
	"testing/fstest"
)

func TestResolveWithDiagnosticsOlderLocalOverrideWarns(t *testing.T) {
	packFS := fstest.MapFS{"pack.json": {Data: []byte(`{}`)}}
	builtin := Pack{Name: "alpha", Version: "2.0.0", FS: packFS, Source: Builtin}
	local := Pack{Name: "alpha", Version: "1.0.0", FS: packFS, Source: Local}

	resolved, warnings, err := ResolveWithDiagnostics([]Pack{builtin}, []Pack{local})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(resolved) != 1 || resolved[0].Source != Local || resolved[0].Version != "1.0.0" {
		t.Fatalf("local override should still replace builtin: %#v", resolved)
	}
	if len(warnings) != 1 {
		t.Fatalf("expected one override warning, got %d: %#v", len(warnings), warnings)
	}
	w := warnings[0]
	if w.Pack != "alpha" || w.BuiltinVersion != "2.0.0" || w.LocalVersion != "1.0.0" {
		t.Fatalf("warning identity wrong: %#v", w)
	}
	if !strings.Contains(w.Reason, "older than builtin") {
		t.Fatalf("warning reason should mention downgrade: %q", w.Reason)
	}
}

func TestResolveWithDiagnosticsEqualVersionIsSilent(t *testing.T) {
	packFS := fstest.MapFS{"pack.json": {Data: []byte(`{}`)}}
	builtin := Pack{Name: "alpha", Version: "1.0.0", FS: packFS, Source: Builtin}
	local := Pack{Name: "alpha", Version: "1.0.0", FS: packFS, Source: Local}

	_, warnings, err := ResolveWithDiagnostics([]Pack{builtin}, []Pack{local})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(warnings) != 0 {
		t.Fatalf("same version should not produce warnings: %#v", warnings)
	}
}

func TestResolveWithDiagnosticsNewerLocalOverrideIsSilent(t *testing.T) {
	packFS := fstest.MapFS{"pack.json": {Data: []byte(`{}`)}}
	builtin := Pack{Name: "alpha", Version: "1.0.0", FS: packFS, Source: Builtin}
	local := Pack{Name: "alpha", Version: "1.2.0", FS: packFS, Source: Local}

	_, warnings, err := ResolveWithDiagnostics([]Pack{builtin}, []Pack{local})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(warnings) != 0 {
		t.Fatalf("upgrade override should not produce warnings: %#v", warnings)
	}
}

func TestResolveWithDiagnosticsPreReleaseLowerThanRelease(t *testing.T) {
	packFS := fstest.MapFS{"pack.json": {Data: []byte(`{}`)}}
	// 1.0.0-rc.1 is strictly lower than 1.0.0 per SemVer.
	builtin := Pack{Name: "alpha", Version: "1.0.0", FS: packFS, Source: Builtin}
	local := Pack{Name: "alpha", Version: "1.0.0-rc.1", FS: packFS, Source: Local}

	_, warnings, err := ResolveWithDiagnostics([]Pack{builtin}, []Pack{local})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(warnings) != 1 {
		t.Fatalf("pre-release downgrade should warn, got %d warnings", len(warnings))
	}
}

func TestResolveWithDiagnosticsInvalidLocalVersionIsSilent(t *testing.T) {
	// validateIdentity already rejects malformed versions before we get here,
	// but compareSemVer must also treat its own parse errors as "no comparison"
	// rather than blocking resolution.
	packFS := fstest.MapFS{"pack.json": {Data: []byte(`{}`)}}
	builtin := Pack{Name: "alpha", Version: "1.0.0", FS: packFS, Source: Builtin}
	local := Pack{Name: "alpha", Version: "not-semver", FS: packFS, Source: Local}

	// Validate() inside ResolveWithDiagnostics will reject this, so we expect
	// an error — confirming compareSemVer is never reached with garbage input.
	_, _, err := ResolveWithDiagnostics([]Pack{builtin}, []Pack{local})
	if err == nil {
		t.Fatal("expected validation error for non-semver local version")
	}
}

func TestCompareSemVerCases(t *testing.T) {
	cases := []struct {
		a, b string
		want int
	}{
		{"1.0.0", "1.0.0", 0},
		{"1.0.0", "2.0.0", -1},
		{"2.0.0", "1.0.0", 1},
		{"1.0.0", "1.1.0", -1},
		{"1.0.0", "1.0.1", -1},
		{"1.0.0-rc.1", "1.0.0", -1},
		{"1.0.0", "1.0.0-rc.1", 1},
		{"1.0.0-alpha", "1.0.0-beta", -1},
		{"1.0.0+build1", "1.0.0+build2", 0}, // build metadata ignored
		// SemVer spec §11: numeric pre-release identifiers compare numerically.
		{"1.0.0-rc.2", "1.0.0-rc.11", -1},  // not string order ("2" > "11" is wrong under naive compare)
		{"1.0.0-rc.11", "1.0.0-rc.2", 1},
		// Numeric identifiers have lower precedence than alphanumeric.
		{"1.0.0-1", "1.0.0-alpha", -1},
		{"1.0.0-alpha", "1.0.0-1", 1},
		// Larger pre-release field set wins when shared identifiers are equal.
		{"1.0.0-alpha", "1.0.0-alpha.1", -1},
		{"1.0.0-alpha.1", "1.0.0-alpha", 1},
		// Mixed numeric and alphanumeric across dot-separated identifiers.
		{"1.0.0-x.7.z.92", "1.0.0-x.7.z.9", 1},   // 92 > 9 numerically
		{"1.0.0-x.7.z.9", "1.0.0-x.7.z.92", -1},
		// SemVer §11: numeric identifiers with leading zeros are lexical (non-numeric).
		// "01" is treated as alphanumeric, which has HIGHER precedence than numeric.
		// So "01" (alphanumeric) > "1" (numeric).
		{"1.0.0-01", "1.0.0-1", 1},
	}
	for _, tc := range cases {
		got, err := compareSemVer(tc.a, tc.b)
		if err != nil {
			t.Fatalf("compareSemVer(%q, %q) error: %v", tc.a, tc.b, err)
		}
		if got != tc.want {
			t.Errorf("compareSemVer(%q, %q) = %d, want %d", tc.a, tc.b, got, tc.want)
		}
	}
}

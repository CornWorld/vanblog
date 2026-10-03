package theme

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func writeThemeJSON(t *testing.T, dir, content string) {
	t.Helper()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "theme.json"), []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestReadSettingsSchema(t *testing.T) {
	dir := t.TempDir()
	writeThemeJSON(t, dir, `{
		"name": "x",
		"settings": {
			"footerText": {"type": "text", "label": "页脚", "default": ""},
			"showToc":    {"type": "boolean", "default": true},
			"cardStyle":  {"type": "select", "values": ["flat", "bordered"], "default": "flat"},
			"banner":     {"type": "string", "placeholder": "https://..."},
			"bad-type":   {"type": "color"},
			"empty-sel":  {"type": "select"},
			"garbage":    "not-an-object"
		}
	}`)

	schema := ReadSettingsSchema(dir)
	want := []string{"footerText", "showToc", "cardStyle", "banner"}
	if len(schema) != len(want) {
		t.Fatalf("schema keys = %v (malformed entries must be dropped)", keysOf(schema))
	}
	for _, k := range want {
		if _, ok := schema[k]; !ok {
			t.Errorf("missing key %q", k)
		}
	}
	if schema["showToc"].Default != true {
		t.Errorf("showToc default = %v", schema["showToc"].Default)
	}
}

func TestReadSettingsSchema_EmptyVariants(t *testing.T) {
	dir := t.TempDir()
	writeThemeJSON(t, dir, `{"name":"x"}`)
	if schema := ReadSettingsSchema(dir); len(schema) != 0 {
		t.Errorf("no settings block → %v", schema)
	}
	writeThemeJSON(t, dir, `{not json`)
	if schema := ReadSettingsSchema(dir); len(schema) != 0 {
		t.Errorf("malformed theme.json must yield empty schema, got %v", schema)
	}
	if schema := ReadSettingsSchema(filepath.Join(t.TempDir(), "missing")); len(schema) != 0 {
		t.Errorf("missing dir must yield empty schema")
	}
}

func TestValidateSettingsValues(t *testing.T) {
	schema := map[string]SettingSpec{
		"footerText": {Type: "text"},
		"showToc":    {Type: "boolean", Default: true},
		"cardStyle":  {Type: "select", Values: []string{"flat", "bordered"}},
	}

	ok, err := ValidateSettingsValues(schema, map[string]any{
		"footerText": "hello",
		"showToc":    false,
		"cardStyle":  "bordered",
	})
	if err != nil {
		t.Fatal(err)
	}
	if ok["footerText"] != "hello" || ok["showToc"] != false || ok["cardStyle"] != "bordered" {
		t.Fatalf("validated = %v", ok)
	}

	for name, bad := range map[string]map[string]any{
		"string type":    {"footerText": 42},
		"boolean type":   {"showToc": "yes"},
		"select value":   {"cardStyle": "rounded"},
		"select type":    {"cardStyle": true},
		"object value":   {"footerText": map[string]any{"a": 1}},
		"unknown number": {"future": 123},
	} {
		if _, err := ValidateSettingsValues(schema, bad); err == nil {
			t.Errorf("%s: expected error for %v", name, bad)
		}
	}

	// Unknown PRIMITIVE keys survive (theme upgrade / downgrade recovery).
	out, err := ValidateSettingsValues(schema, map[string]any{"legacyKey": "kept"})
	if err != nil {
		t.Fatal(err)
	}
	if out["legacyKey"] != "kept" {
		t.Errorf("unknown primitive key must be preserved, got %v", out)
	}

	// Size caps.
	if _, err := ValidateSettingsValues(schema, map[string]any{"footerText": strings.Repeat("x", settingValueMaxBytes+1)}); err == nil {
		t.Error("oversized single value must fail")
	}
	big := map[string]any{}
	for i := range 8 {
		big[string(rune('a'+i))] = strings.Repeat("x", 40_000) // 8×40KB > 256KB total
	}
	if _, err := ValidateSettingsValues(schema, big); err == nil {
		t.Error("oversized total must fail")
	}
}

func TestMergeSettings(t *testing.T) {
	schema := map[string]SettingSpec{
		"footerText": {Type: "text", Default: "默认页脚"},
		"showToc":    {Type: "boolean", Default: true},
		"cardStyle":  {Type: "select", Values: []string{"flat"}, Default: "flat"},
	}
	stored := map[string]any{"footerText": "存量值", "legacy": "old"}
	incoming := map[string]any{"showToc": false}

	merged := MergeSettings(schema, stored, incoming)
	if merged["footerText"] != "存量值" {
		t.Errorf("stored must beat default: %v", merged["footerText"])
	}
	if merged["showToc"] != false {
		t.Errorf("incoming must beat stored: %v", merged["showToc"])
	}
	if merged["cardStyle"] != "flat" {
		t.Errorf("default must fill unset: %v", merged["cardStyle"])
	}
	if merged["legacy"] != "old" {
		t.Errorf("unknown stored key must survive: %v", merged)
	}
}

func TestFilterStoredValues(t *testing.T) {
	got := filterStoredValues(map[string]any{
		"footerText": "ok",
		"showToc":    true,
		"cleared":    nil,
		"legacyNum":  123, // pre-tightening residue
		"legacyObj":  map[string]any{"a": 1},
	})
	if _, ok := got["legacyNum"]; ok {
		t.Errorf("numeric residue must be dropped: %v", got)
	}
	if _, ok := got["legacyObj"]; ok {
		t.Errorf("object residue must be dropped: %v", got)
	}
	if got["footerText"] != "ok" || got["showToc"] != true {
		t.Errorf("valid values must survive: %v", got)
	}
}

func keysOf(m map[string]SettingSpec) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	return out
}

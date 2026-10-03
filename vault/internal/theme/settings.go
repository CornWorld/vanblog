package theme

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// SettingSpec is one theme.json `settings` entry — a deliberately tiny DSL
// (four types) instead of full JSON Schema, so the admin form renderer and
// this validator stay ~100 lines each. The key of the map is the storage key.
type SettingSpec struct {
	Type        string   `json:"type"`              // string | text | boolean | select
	Label       string   `json:"label,omitempty"`   // admin form label
	Default     any      `json:"default,omitempty"` // fallback when unset
	Values      []string `json:"values,omitempty"`  // select: allowed values
	Placeholder string   `json:"placeholder,omitempty"`
}

// settingTypeMaxBytes caps a single value (all types serialize as JSON
// primitives; strings are the only realistically large ones).
const settingValueMaxBytes = 64 << 10

// settingsTotalMaxBytes caps one theme's whole values object.
const settingsTotalMaxBytes = 256 << 10

// ReadSettingsSchema loads the `settings` map from a theme directory's
// theme.json. A theme without settings (or with a malformed settings block —
// themes are third-party code) yields an empty schema, never an error: a bad
// declaration must not take the theme's pages down.
func ReadSettingsSchema(dir string) map[string]SettingSpec {
	schema := map[string]SettingSpec{}
	data, err := os.ReadFile(filepath.Join(dir, "theme.json"))
	if err != nil {
		return schema
	}
	var raw struct {
		Settings map[string]json.RawMessage `json:"settings"`
	}
	if json.Unmarshal(data, &raw) != nil || raw.Settings == nil {
		return schema
	}
	for key, blob := range raw.Settings {
		var spec SettingSpec
		if json.Unmarshal(blob, &spec) != nil {
			continue // skip malformed entry, keep the rest
		}
		if !validSettingType(spec.Type) {
			continue
		}
		if spec.Type == "select" && len(spec.Values) == 0 {
			continue
		}
		schema[key] = spec
	}
	return schema
}

func validSettingType(t string) bool {
	return t == "string" || t == "text" || t == "boolean" || t == "select"
}

// ValidateSettingsValues checks incoming user values against the schema and
// returns the sanitized map to persist. Semantics:
//   - known keys: type-checked strictly (string/text→string, boolean→bool,
//     select→one of Values); a violation fails the whole write.
func ValidateSettingsValues(schema map[string]SettingSpec, incoming map[string]any) (map[string]any, error) {
	out := make(map[string]any, len(incoming))
	total := 0
	for key, value := range incoming {
		blob, err := json.Marshal(value)
		if err != nil || len(blob) > settingValueMaxBytes {
			return nil, fmt.Errorf("setting %q exceeds %d bytes or is not a JSON value", key, settingValueMaxBytes)
		}
		total += len(blob)
		spec, known := schema[key]
		if !known {
			if !isSettingValuePrimitive(value) {
				return nil, fmt.Errorf("setting %q must be a JSON primitive", key)
			}
			out[key] = value
			continue
		}
		switch spec.Type {
		case "string", "text":
			s, ok := value.(string)
			if !ok {
				return nil, fmt.Errorf("setting %q must be a string", key)
			}
			out[key] = s
		case "boolean":
			b, ok := value.(bool)
			if !ok {
				return nil, fmt.Errorf("setting %q must be a boolean", key)
			}
			out[key] = b
		case "select":
			s, ok := value.(string)
			if !ok || !containsString(spec.Values, s) {
				return nil, fmt.Errorf("setting %q must be one of %v", key, spec.Values)
			}
			out[key] = s
		}
	}
	if total > settingsTotalMaxBytes {
		return nil, fmt.Errorf("settings total exceeds %d bytes", settingsTotalMaxBytes)
	}
	return out, nil
}

// filterStoredValues drops stored values outside the DSL's value space
// (e.g. written by an older, looser validator). Known-key values stay
// untouched — re-validating them against a possibly-changed schema would
// silently drop user data on theme upgrades.
func filterStoredValues(values map[string]any) map[string]any {
	out := make(map[string]any, len(values))
	for key, value := range values {
		if isSettingValuePrimitive(value) {
			out[key] = value
		}
	}
	return out
}

// isSettingValuePrimitive restricts stored values to the DSL's value space
// (strings and booleans; nil clears). Numbers are rejected even for unknown
// keys — the DSL has no numeric type, so a number can only be a mistake.
func isSettingValuePrimitive(value any) bool {
	switch value.(type) {
	case string, bool, nil:
		return true
	default:
		return false
	}
}

// MergeSettings overlays value sources in precedence order (later wins):
// schema defaults → existing stored row → incoming validated write. The
// stored row stays "full", so SSR consumers never need to read the schema.
func MergeSettings(schema map[string]SettingSpec, layers ...map[string]any) map[string]any {
	merged := map[string]any{}
	for key, spec := range schema {
		if spec.Default != nil {
			merged[key] = spec.Default
		}
	}
	for _, layer := range layers {
		for key, value := range layer {
			merged[key] = value
		}
	}
	return merged
}

func containsString(values []string, want string) bool {
	for _, v := range values {
		if v == want {
			return true
		}
	}
	return false
}

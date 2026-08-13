package migration

import (
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestGetString(t *testing.T) {
	tests := []struct {
		name string
		doc  bson.M
		key  string
		want string
	}{
		{"string value", bson.M{"x": "hello"}, "x", "hello"},
		{"int value", bson.M{"x": 42}, "x", "42"},
		{"missing key", bson.M{}, "x", ""},
		{"nil value", bson.M{"x": nil}, "x", ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := getString(tt.doc, tt.key); got != tt.want {
				t.Errorf("getString() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestGetInt(t *testing.T) {
	tests := []struct {
		name string
		doc  bson.M
		key  string
		want int
	}{
		{"int", bson.M{"x": 42}, "x", 42},
		{"int32", bson.M{"x": int32(42)}, "x", 42},
		{"int64", bson.M{"x": int64(42)}, "x", 42},
		{"float64", bson.M{"x": float64(42.0)}, "x", 42},
		{"float64 truncated", bson.M{"x": float64(42.9)}, "x", 42},
		{"missing key", bson.M{}, "x", 0},
		{"nil value", bson.M{"x": nil}, "x", 0},
		{"unsupported type", bson.M{"x": "42"}, "x", 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := getInt(tt.doc, tt.key); got != tt.want {
				t.Errorf("getInt() = %d, want %d", got, tt.want)
			}
		})
	}
}

func TestGetBool(t *testing.T) {
	tests := []struct {
		name string
		doc  bson.M
		key  string
		want bool
	}{
		{"true", bson.M{"x": true}, "x", true},
		{"false", bson.M{"x": false}, "x", false},
		{"missing key", bson.M{}, "x", false},
		{"nil value", bson.M{"x": nil}, "x", false},
		{"unsupported type", bson.M{"x": 1}, "x", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := getBool(tt.doc, tt.key); got != tt.want {
				t.Errorf("getBool() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestGetStringSlice(t *testing.T) {
	tests := []struct {
		name string
		doc  bson.M
		key  string
		want []string
	}{
		{"primitive.A", bson.M{"x": primitive.A{"a", "b"}}, "x", []string{"a", "b"}},
		{"[]any", bson.M{"x": []any{"a", "b"}}, "x", []string{"a", "b"}},
		{"[]string", bson.M{"x": []string{"a", "b"}}, "x", []string{"a", "b"}},
		{"missing key", bson.M{}, "x", nil},
		{"nil value", bson.M{"x": nil}, "x", nil},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := getStringSlice(tt.doc, tt.key)
			if len(got) != len(tt.want) {
				t.Fatalf("getStringSlice() len = %d, want %d", len(got), len(tt.want))
			}
			for i := range got {
				if got[i] != tt.want[i] {
					t.Errorf("getStringSlice()[%d] = %q, want %q", i, got[i], tt.want[i])
				}
			}
		})
	}
}

func TestGetDate(t *testing.T) {
	ts := time.Date(2024, 3, 15, 10, 30, 0, 0, time.UTC)
	want := "2024-03-15T10:30:00.000Z"

	tests := []struct {
		name string
		doc  bson.M
		key  string
		want string
	}{
		{"primitive.DateTime", bson.M{"x": primitive.NewDateTimeFromTime(ts)}, "x", want},
		{"time.Time", bson.M{"x": ts}, "x", want},
		{"missing key", bson.M{}, "x", ""},
		{"nil value", bson.M{"x": nil}, "x", ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := getDate(tt.doc, tt.key); got != tt.want {
				t.Errorf("getDate() = %q, want %q", got, tt.want)
			}
		})
	}
}

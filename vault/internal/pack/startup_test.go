package pack

import (
	"strings"
	"testing"
	"testing/fstest"
)

func TestStartupSummaryIsSafeAndActionable(t *testing.T) {
	packs := []Pack{{Name: "demo", Version: "1.0.0", Source: Local, FS: fstest.MapFS{"pack.json": {Data: []byte(`{"name":"demo","version":"1.0.0"}`)}}}}
	lines, err := StartupSummary(packs, nil, []RuntimeWarning{{Pack: "demo", Reason: "source frontend resource requires a dev-image build artifact"}})
	if err != nil {
		t.Fatal(err)
	}
	output := strings.Join(lines, "\n")
	for _, expected := range []string{"resolved Packs: 1", "name=demo", "version=1.0.0", "source=local", "state=needs-rebuild", "action=run vanblog pack build"} {
		if !strings.Contains(output, expected) {
			t.Fatalf("summary missing %q: %q", expected, output)
		}
	}
	for _, forbidden := range []string{"pack.json", "source frontend resource requires", "password", "token", "secret"} {
		if strings.Contains(output, forbidden) {
			t.Fatalf("summary contains forbidden detail %q: %q", forbidden, output)
		}
	}
}

func TestStartupSummaryRequiresDerivedRuntimeState(t *testing.T) {
	packs := []Pack{{Name: "demo", Version: "1.0.0", Source: Builtin, FS: fstest.MapFS{"pack.json": {Data: []byte(`{"name":"demo","version":"1.0.0"}`)}}}}
	if _, err := StartupSummary(packs, nil, nil); err == nil || !strings.Contains(err.Error(), "no derived runtime state") {
		t.Fatalf("expected missing runtime state error, got %v", err)
	}
}

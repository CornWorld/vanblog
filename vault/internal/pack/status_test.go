package pack

import (
	"testing"
	"testing/fstest"
)

func TestStatusesDerivesBuiltinAndActiveStates(t *testing.T) {
	packs := []Pack{
		{Name: "alpha", Version: "1.0.0", Source: Builtin, FS: fstest.MapFS{"pack.json": {Data: []byte("{}")}}},
		{Name: "beta", Version: "1.0.0", Source: Local, FS: fstest.MapFS{"pack.json": {Data: []byte("{}")}}},
	}
	statuses, err := Statuses(packs)
	if err != nil {
		t.Fatal(err)
	}
	if statuses[0].State != "builtin-enabled" || statuses[1].State != "active" {
		t.Fatalf("unexpected statuses: %#v", statuses)
	}
}

func TestStatusesMarksLocalSourceAsNeedsRebuild(t *testing.T) {
	pack := Pack{
		Name:    "local-pack",
		Version: "1.0.0",
		Source:  Local,
		FS: fstest.MapFS{
			"pack.json":         {Data: []byte("{}")},
			"pages/index.astro": {Data: []byte("source")},
		},
	}
	statuses, err := Statuses([]Pack{pack})
	if err != nil {
		t.Fatal(err)
	}
	if statuses[0].State != "needs-rebuild" || statuses[0].Reason == "" {
		t.Fatalf("unexpected status: %#v", statuses[0])
	}
}

func TestFingerprintChangesWhenAuthoredSourceChanges(t *testing.T) {
	first, err := Fingerprint(Pack{FS: fstest.MapFS{"pack.json": {Data: []byte("one")}}})
	if err != nil {
		t.Fatal(err)
	}
	second, err := Fingerprint(Pack{FS: fstest.MapFS{"pack.json": {Data: []byte("two")}}})
	if err != nil {
		t.Fatal(err)
	}
	if first == second {
		t.Fatal("authored source change did not change fingerprint")
	}
}

func TestFingerprintIgnoresGeneratedSchemaArtifact(t *testing.T) {
	base := fstest.MapFS{
		"pack.json":         {Data: []byte(`{"name":"demo","version":"1.0.0"}`)},
		"pages/index.astro": {Data: []byte("source")},
		"schema.js":         {Data: []byte("old artifact")},
	}
	changedArtifact := fstest.MapFS{
		"pack.json":         {Data: []byte(`{"name":"demo","version":"1.0.0"}`)},
		"pages/index.astro": {Data: []byte("source")},
		"schema.js":         {Data: []byte("new artifact")},
	}
	first, err := Fingerprint(Pack{FS: base})
	if err != nil {
		t.Fatal(err)
	}
	second, err := Fingerprint(Pack{FS: changedArtifact})
	if err != nil {
		t.Fatal(err)
	}
	if first != second || len(first) != sha256HexLength {
		t.Fatalf("artifact changed source fingerprint: %q != %q", first, second)
	}
}

func TestHasSchemaArtifact(t *testing.T) {
	withArtifact := Pack{FS: fstest.MapFS{"schema.js": {Data: []byte("exports.models = {}")}}}
	withoutArtifact := Pack{FS: fstest.MapFS{}}
	if !HasSchemaArtifact(withArtifact) || HasSchemaArtifact(withoutArtifact) {
		t.Fatal("unexpected schema artifact detection")
	}
}

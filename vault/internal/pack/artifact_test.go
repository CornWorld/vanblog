package pack

import (
	"encoding/json"
	"testing"
	"testing/fstest"
)

func TestArtifactFreshness(t *testing.T) {
	packFS := fstest.MapFS{
		"schema.js": {Data: []byte("exports.models = {}")},
		"pack.json": {Data: []byte("source")},
	}
	pack := Pack{FS: packFS}
	freshness, err := ArtifactFreshness(pack)
	if err != nil || freshness != "unknown" {
		t.Fatalf("without metadata: freshness=%q err=%v", freshness, err)
	}
	hash, err := Fingerprint(pack)
	if err != nil {
		t.Fatal(err)
	}
	metadata, err := json.Marshal(ArtifactMetadata{SourceHash: hash})
	if err != nil {
		t.Fatal(err)
	}
	packFS[artifactMetadataPath] = &fstest.MapFile{Data: metadata}
	freshness, err = ArtifactFreshness(pack)
	if err != nil || freshness != "fresh" {
		t.Fatalf("matching metadata: freshness=%q err=%v", freshness, err)
	}
	packFS["pack.json"] = &fstest.MapFile{Data: []byte("changed source")}
	freshness, err = ArtifactFreshness(pack)
	if err != nil || freshness != "stale" {
		t.Fatalf("changed source: freshness=%q err=%v", freshness, err)
	}
}

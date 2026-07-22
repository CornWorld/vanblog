package pack

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
)

const artifactMetadataPath = "schema.js.meta.json"

type ArtifactMetadata struct {
	SourceHash string `json:"sourceHash"`
}

func ReadArtifactMetadata(p Pack) (ArtifactMetadata, bool, error) {
	data, err := fs.ReadFile(p.FS, artifactMetadataPath)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return ArtifactMetadata{}, false, nil
		}
		return ArtifactMetadata{}, false, err
	}
	var metadata ArtifactMetadata
	if err := json.Unmarshal(data, &metadata); err != nil {
		return ArtifactMetadata{}, false, fmt.Errorf("decode %s: %w", artifactMetadataPath, err)
	}
	if metadata.SourceHash == "" {
		return ArtifactMetadata{}, false, fmt.Errorf("%s has empty sourceHash", artifactMetadataPath)
	}
	return metadata, true, nil
}

func ArtifactFreshness(p Pack) (string, error) {
	if !HasSchemaArtifact(p) {
		return "missing", nil
	}
	metadata, ok, err := ReadArtifactMetadata(p)
	if err != nil {
		return "invalid", err
	}
	if !ok {
		return "unknown", nil
	}
	hash, err := Fingerprint(p)
	if err != nil {
		return "invalid", err
	}
	if metadata.SourceHash != hash {
		return "stale", nil
	}
	return "fresh", nil
}

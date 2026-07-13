package pack

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"testing/fstest"
)

type identity struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

// LoadLocal validates one local Pack directory.
func LoadLocal(directory string) (Pack, error) {
	if directory == "" {
		return Pack{}, errors.New("local pack directory is empty")
	}
	info, err := os.Lstat(directory)
	if err != nil {
		return Pack{}, fmt.Errorf("inspect local pack directory: %w", err)
	}
	if info.Mode()&os.ModeSymlink != 0 || !info.IsDir() {
		return Pack{}, fmt.Errorf("local pack must be a real directory: %q", directory)
	}
	id, err := readIdentity(filepath.Join(directory, "pack.json"))
	if err != nil {
		return Pack{}, err
	}
	if filepath.Base(filepath.Clean(directory)) != id.Name {
		return Pack{}, fmt.Errorf("local pack directory %q does not match name %q", filepath.Base(filepath.Clean(directory)), id.Name)
	}
	filesystem, err := snapshotLocal(directory)
	if err != nil {
		return Pack{}, err
	}
	p := Pack{Name: id.Name, Version: id.Version, FS: filesystem, Source: Local}
	if err := Validate(p); err != nil {
		return Pack{}, err
	}
	return p, nil
}

// DiscoverLocal loads one Pack from each direct child directory of root.
func DiscoverLocal(root string) ([]Pack, error) {
	if root == "" {
		return nil, errors.New("local pack root is empty")
	}
	info, err := os.Lstat(root)
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("inspect local pack root: %w", err)
	}
	if info.Mode()&os.ModeSymlink != 0 || !info.IsDir() {
		return nil, fmt.Errorf("local pack root must be a real directory: %q", root)
	}

	entries, err := os.ReadDir(root)
	if err != nil {
		return nil, fmt.Errorf("read local pack root: %w", err)
	}
	packs := make([]Pack, 0, len(entries))
	seen := make(map[string]struct{}, len(entries))
	for _, entry := range entries {
		if entry.Type()&os.ModeSymlink != 0 {
			return nil, fmt.Errorf("local pack entry %q is a symlink", entry.Name())
		}
		if !entry.IsDir() {
			continue
		}
		packDir := filepath.Join(root, entry.Name())
		id, err := readIdentity(filepath.Join(packDir, "pack.json"))
		if err != nil {
			return nil, fmt.Errorf("local pack %q: %w", entry.Name(), err)
		}
		if id.Name != entry.Name() {
			return nil, fmt.Errorf("local pack directory %q does not match name %q", entry.Name(), id.Name)
		}
		if _, exists := seen[id.Name]; exists {
			return nil, fmt.Errorf("duplicate local pack %q", id.Name)
		}
		seen[id.Name] = struct{}{}
		filesystem, err := snapshotLocal(packDir)
		if err != nil {
			return nil, fmt.Errorf("local pack %q: %w", entry.Name(), err)
		}
		p := Pack{Name: id.Name, Version: id.Version, FS: filesystem, Source: Local}
		if err := Validate(p); err != nil {
			return nil, err
		}
		packs = append(packs, p)
	}
	sort.Slice(packs, func(i, j int) bool { return packs[i].Name < packs[j].Name })
	return packs, nil
}

func snapshotLocal(root string) (fstest.MapFS, error) {
	snapshot := fstest.MapFS{}
	var total int64
	err := filepath.WalkDir(root, func(filename string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if entry.Type()&os.ModeSymlink != 0 {
			return fmt.Errorf("resource %q is a symlink", filename)
		}
		rel, err := filepath.Rel(root, filename)
		if err != nil || rel == ".." || filepath.IsAbs(rel) {
			return fmt.Errorf("resource path escapes local Pack: %q", filename)
		}
		resource := filepath.ToSlash(rel)
		if !validSnapshotPath(resource) {
			return fmt.Errorf("invalid local Pack resource path %q", resource)
		}
		if resource == "." {
			return nil
		}
		if entry.IsDir() {
			snapshot[resource] = &fstest.MapFile{Mode: fs.ModeDir | 0o755}
			return nil
		}
		info, err := entry.Info()
		if err != nil {
			return err
		}
		if !info.Mode().IsRegular() {
			return fmt.Errorf("resource %q is not a regular file", resource)
		}
		if info.Size() > maxLocalPackFileBytes {
			return fmt.Errorf("resource %q exceeds %d bytes", resource, maxLocalPackFileBytes)
		}
		total += info.Size()
		if total > maxLocalPackBytes {
			return fmt.Errorf("local Pack exceeds %d bytes", maxLocalPackBytes)
		}
		data, err := os.ReadFile(filename)
		if err != nil {
			return err
		}
		if int64(len(data)) != info.Size() {
			return fmt.Errorf("resource %q changed while snapshotting", resource)
		}
		snapshot[resource] = &fstest.MapFile{Data: data, Mode: 0o644}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return snapshot, nil
}

func readIdentity(path string) (identity, error) {
	file, err := os.Open(path)
	if err != nil {
		return identity{}, fmt.Errorf("open pack.json: %w", err)
	}
	defer file.Close()
	decoder := json.NewDecoder(io.LimitReader(file, 64*1024))
	decoder.DisallowUnknownFields()
	var id identity
	if err := decoder.Decode(&id); err != nil {
		return identity{}, fmt.Errorf("decode pack.json: %w", err)
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return identity{}, errors.New("pack.json must contain one JSON object")
	}
	if err := validateIdentity(id.Name, id.Version); err != nil {
		return identity{}, err
	}
	return id, nil
}

// Resolve validates and combines builtin and local Packs using whole-Pack replacement.
func Resolve(builtins, locals []Pack) ([]Pack, error) {
	resolved := make(map[string]Pack, len(builtins)+len(locals))
	for _, p := range builtins {
		if p.Source != Builtin {
			return nil, fmt.Errorf("builtin pack %q has wrong source", p.Name)
		}
		if err := Validate(p); err != nil {
			return nil, err
		}
		if _, exists := resolved[p.Name]; exists {
			return nil, fmt.Errorf("duplicate builtin pack %q", p.Name)
		}
		resolved[p.Name] = p
	}
	localNames := make(map[string]struct{}, len(locals))
	for _, p := range locals {
		if p.Source != Local {
			return nil, fmt.Errorf("local pack %q has wrong source", p.Name)
		}
		if err := Validate(p); err != nil {
			return nil, err
		}
		if _, exists := localNames[p.Name]; exists {
			return nil, fmt.Errorf("duplicate local pack %q", p.Name)
		}
		localNames[p.Name] = struct{}{}
		resolved[p.Name] = p
	}
	packs := make([]Pack, 0, len(resolved))
	for _, p := range resolved {
		packs = append(packs, p)
	}
	sort.Slice(packs, func(i, j int) bool { return packs[i].Name < packs[j].Name })
	return packs, nil
}

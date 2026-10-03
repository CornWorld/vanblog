package pack

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

const (
	// CustomCodePackName is the reserved pack name backing the admin
	// "custom code" feature (PUT /api/vanblog/custom-code). It is a normal
	// local pack in every respect — same manifest surface, same
	// /pack-static serving, same discovery on next boot — so the custom CSS
	// box and CLI-installed packs share ONE extension mechanism.
	CustomCodePackName = "site-custom"

	// customCodeMarker brands the directory as admin-managed so the writer
	// can never clobber a hand-installed pack that happens to own the name.
	customCodeMarker = ".vanblog-managed"

	// CustomCodeMaxBytes caps each of css/js to keep the pack.json lists and
	// the injected pages bounded. 512 KiB is far beyond any sane snippet.
	CustomCodeMaxBytes = 512 << 10
)

// CustomCode is the PUT /api/vanblog/custom-code body.
type CustomCode struct {
	CSS string `json:"css"`
	JS  string `json:"js"`
}

// customPackJSON is the pack.json written for the managed pack. Field set
// stays within the strict allowlist (name/version/title/frontend).
type customPackJSON struct {
	Name     string              `json:"name"`
	Version  string              `json:"version"`
	Title    string              `json:"title"`
	Frontend *customFrontendJSON `json:"frontend"`
}

type customFrontendJSON struct {
	Scope   string   `json:"scope"`
	Styles  []string `json:"styles"`
	Scripts []string `json:"scripts"`
}

// WriteCustomCodePack (re)writes the managed site-custom pack under localDir.
// An empty css/js string removes the corresponding file; both empty removes
// the pack entirely (uninstall). The write is staged into a temp sibling and
// atomically renamed, so a crash never leaves a half-written pack visible to
// the manifest or the file server.
func WriteCustomCodePack(localDir string, code CustomCode) error {
	if err := os.MkdirAll(localDir, 0o755); err != nil {
		return fmt.Errorf("create packs dir: %w", err)
	}

	dir := filepath.Join(localDir, CustomCodePackName)
	if info, err := os.Lstat(dir); err == nil {
		if !info.IsDir() {
			return fmt.Errorf("%q exists and is not a directory", dir)
		}
		if _, err := os.Lstat(filepath.Join(dir, customCodeMarker)); err != nil {
			return fmt.Errorf("pack %q already exists and is not managed by vanblog", CustomCodePackName)
		}
	}

	// Both empty → uninstall.
	if code.CSS == "" && code.JS == "" {
		return os.RemoveAll(dir)
	}

	tmp, err := os.MkdirTemp(localDir, "."+CustomCodePackName+"-*")
	if err != nil {
		return fmt.Errorf("stage custom code pack: %w", err)
	}
	write := func(name, content string) error {
		if err := os.MkdirAll(filepath.Join(tmp, "frontend"), 0o755); err != nil {
			return err
		}
		return os.WriteFile(filepath.Join(tmp, "frontend", name), []byte(content), 0o600)
	}
	if err := os.WriteFile(filepath.Join(tmp, customCodeMarker), []byte("managed by PUT /api/vanblog/custom-code\n"), 0o600); err != nil {
		return err
	}
	meta := customPackJSON{
		Name:     CustomCodePackName,
		Version:  "1.0.0",
		Title:    "自定义代码",
		Frontend: &customFrontendJSON{Scope: "public"},
	}
	if code.CSS != "" {
		if err := write("style.css", code.CSS); err != nil {
			return err
		}
		meta.Frontend.Styles = []string{"style.css"}
	}
	if code.JS != "" {
		if err := write("script.js", code.JS); err != nil {
			return err
		}
		meta.Frontend.Scripts = []string{"script.js"}
	}
	data, err := json.MarshalIndent(meta, "", "  ")
	if err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(tmp, "pack.json"), append(data, '\n'), 0o600); err != nil {
		return err
	}

	// Atomic publish: remove the old pack, then rename the staged tree in.
	// The window between the two is one rename-wide gap with no pack —
	// acceptable for an admin-edited snippet (worst case one manifest read
	// misses it for 10s).
	if err := os.RemoveAll(dir); err != nil {
		return err
	}
	return os.Rename(tmp, dir)
}

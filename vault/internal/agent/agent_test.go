package agent

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadEngineConfigDefault(t *testing.T) {
	t.Setenv("VANBLOG_WORKSPACE", t.TempDir()) // no agent-config/engine.json
	t.Setenv("VANBLOG_AGENT_BIN", "")
	t.Setenv("VANBLOG_AGENT_EXTRA_ARGS", "")
	cfg := loadEngineConfig()
	if cfg.Bin != piBinary {
		t.Fatalf("default bin = %q, want %q", cfg.Bin, piBinary)
	}
	if len(cfg.ExtraArgs) != 0 {
		t.Fatalf("default extraArgs = %v, want empty", cfg.ExtraArgs)
	}
}

func TestEngineConfigFileDriven(t *testing.T) {
	ws := t.TempDir()
	t.Setenv("VANBLOG_WORKSPACE", ws)
	t.Setenv("VANBLOG_AGENT_BIN", "")
	t.Setenv("VANBLOG_AGENT_EXTRA_ARGS", "")
	if err := os.MkdirAll(filepath.Join(ws, "agent-config"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(ws, "agent-config", "engine.json"),
		[]byte(`{"bin":"/app/scripts/dev/agent-rpc-bridge.sh"}`), 0o600); err != nil {
		t.Fatal(err)
	}
	cfg := loadEngineConfig()
	if cfg.Bin != "/app/scripts/dev/agent-rpc-bridge.sh" {
		t.Fatalf("file bin = %q", cfg.Bin)
	}
	if len(cfg.ExtraArgs) != 0 {
		t.Fatalf("file extraArgs = %v, want empty", cfg.ExtraArgs)
	}
	// env overrides the file, per-field
	t.Setenv("VANBLOG_AGENT_BIN", "omp")
	if got := loadEngineConfig().Bin; got != "omp" {
		t.Fatalf("env bin override = %q", got)
	}
}

func TestEnabledDefaultClosed(t *testing.T) {
	t.Setenv("VANBLOG_MODE", "")
	if Enabled() {
		t.Fatal("agent must be disabled without explicit VANBLOG_MODE=dev (prod default)")
	}
	t.Setenv("VANBLOG_MODE", "dev")
	if !Enabled() {
		t.Fatal("agent must be enabled with VANBLOG_MODE=dev")
	}
}

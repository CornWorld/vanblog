package system

import (
	"runtime/debug"
	"testing"
)

// currentGCPercent reads the GC target percent via a round-trip, restoring it
// immediately. This is the same trick newMetricsCollector uses; debug exposes
// no side-effect-free getter.
func currentGCPercent() int {
	prev := debug.SetGCPercent(-1)
	debug.SetGCPercent(prev)
	return prev
}

// Regression: readSample used to call debug.SetGCPercent(-1) per sample, which
// DISABLES the GC (GOGC=off) as a side effect. Polled every 30s, this kept the
// GC off for the process lifetime, so garbage piled up until the cgroup limit
// OOM-killed the container. Sampling must never change runtime GC knobs.
func TestReadSampleDoesNotDisableGC(t *testing.T) {
	before := currentGCPercent()
	if before < 0 {
		t.Skipf("GC already disabled outside this test (percent=%d)", before)
	}

	mc := &metricsCollector{goGC: before}
	for i := range 3 {
		s := mc.readSample("")
		if s.GoGC != before {
			t.Errorf("sample %d: gogc = %d, want %d (value captured at startup)", i, s.GoGC, before)
		}
	}

	if after := currentGCPercent(); after != before {
		t.Fatalf("readSample changed GC percent: before=%d after=%d (GC disabled: %v)", before, after, after < 0)
	}
}

// newMetricsCollector must leave the GC percent unchanged after its one-shot
// round-trip read, and report that value in samples.
func TestNewMetricsCollectorPreservesGCPercent(t *testing.T) {
	before := currentGCPercent()
	if before < 0 {
		t.Skipf("GC already disabled outside this test (percent=%d)", before)
	}

	mc := newMetricsCollector(nil)
	if mc.goGC != before {
		t.Errorf("collector goGC = %d, want %d", mc.goGC, before)
	}
	if after := currentGCPercent(); after != before {
		t.Fatalf("constructor changed GC percent: before=%d after=%d", before, after)
	}
}

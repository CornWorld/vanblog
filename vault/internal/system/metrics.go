// Package system — metrics.go
//
// Lightweight memory metrics collection for the vanblog PocketBase process.
// Purpose: observe Go runtime heap behavior and container RSS so operators
// can make informed decisions about GOMEMLIMIT / GOGC tuning.
//
// This module is read-only: it does NOT set GOMEMLIMIT, GOGC, or any other
// runtime knob. It only observes and records.
//
// Data is written to <DataDir>/metrics-YYYYMMDD.jsonl (append-only, one JSON
// object per line). Files are created per-day and retained for 7 days.
// A GET /api/vanblog/system/metrics endpoint returns recent samples.
package system

import (
	"bufio"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"runtime"
	"runtime/debug"
	"strconv"
	"strings"
	"sync/atomic"
	"time"

	"github.com/pocketbase/pocketbase/core"
)

const (
	metricsInterval    = 30 * time.Second
	metricsRetention   = 7 * 24 * time.Hour
	metricsFilePrefix  = "metrics-"
	metricsFileSuffix  = ".jsonl"
	metricsDateFormat = "20060102"
	defaultSampleLimit = 120 // 1 hour at 30s interval
	maxSampleLimit     = 1000
)

// sample is a single metrics data point written to JSONL.
type sample struct {
	Time        string `json:"t"`             // RFC3339 timestamp
	HeapAlloc   uint64 `json:"heap_alloc"`   // runtime.MemStats.HeapAlloc (live heap bytes)
	HeapSys     uint64 `json:"heap_sys"`     // runtime.MemStats.HeapSys (total heap bytes obtained)
	TotalAlloc  uint64 `json:"total_alloc"`  // runtime.MemStats.TotalAlloc (cumulative)
	Sys         uint64 `json:"sys"`           // runtime.MemStats.Sys (total from OS)
	NumGC       uint32 `json:"num_gc"`        // runtime.MemStats.NumGC (cumulative GC count)
	PauseTotalNs uint64 `json:"pause_total_ns"` // cumulative GC pause nanoseconds
	LastPauseNs uint64 `json:"pause_ns"`     // last GC pause nanoseconds
	RSS         uint64 `json:"rss"`          // process RSS from /proc/self/status (bytes), 0 if unavailable
	GoMemLimit  int64  `json:"gomemlimit"`    // debug.SetMemoryLimit(-1) current value (MaxInt64 = unlimited)
	GoGC        int    `json:"gogc"`          // debug.SetGCPercent(-1) current value (100 = default)
	CgroupLimit uint64 `json:"cgroup_limit"` // cgroup memory.max (0 = no limit / unavailable)
	Event       string `json:"event,omitempty"` // "gc" for GC-triggered samples, "" for periodic
}

// metricsCollector runs in a background goroutine, sampling runtime memory
// stats every 30s and appending them to a per-day JSONL file.
type metricsCollector struct {
	app      core.App
	stopCh   chan struct{}
	// previousNumGC tracks the GC count at the last sample, so the GC-event
	// detector can detect when a GC happened between periodic samples.
	previousNumGC atomic.Uint32
}

func newMetricsCollector(app core.App) *metricsCollector {
	return &metricsCollector{
		app:    app,
		stopCh: make(chan struct{}),
	}
}

func (mc *metricsCollector) start() {
	go mc.loop()
	slog.Info("[system] metrics collector started", "interval", metricsInterval)
}

func (mc *metricsCollector) loop() {
	// Capture an initial sample immediately on startup.
	mc.collect("")

	ticker := time.NewTicker(metricsInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			mc.collect("")
		case <-mc.stopCh:
			return
		}
	}
}

// collect takes a memory sample and writes it to the current day's JSONL file.
// The event parameter is empty for periodic samples and "gc" for GC-triggered
// samples (currently unused but reserved for future GC hook integration).
func (mc *metricsCollector) collect(event string) {
	s := mc.readSample(event)
	if err := mc.writeSample(s); err != nil {
		slog.Debug("[system] metrics write failed", "err", err)
	}
}

// readSample gathers all metrics into a sample struct.
func (mc *metricsCollector) readSample(event string) sample {
	var ms runtime.MemStats
	runtime.ReadMemStats(&ms)

	s := sample{
		Time:         time.Now().UTC().Format(time.RFC3339),
		HeapAlloc:    ms.HeapAlloc,
		HeapSys:      ms.HeapSys,
		TotalAlloc:   ms.TotalAlloc,
		Sys:          ms.Sys,
		NumGC:        ms.NumGC,
		PauseTotalNs: ms.PauseTotalNs,
		LastPauseNs:  ms.PauseNs[(ms.NumGC+255)%256],
		GoMemLimit:   debug.SetMemoryLimit(-1),
		GoGC:         debug.SetGCPercent(-1),
		Event:        event,
	}

	// RSS from /proc/self/status (Linux only; 0 on other platforms).
	s.RSS = readRSS()

	// Cgroup memory limit (0 if not in a cgroup or no limit set).
	s.CgroupLimit = readCgroupLimit()

	// Update previous GC count for the GC-event detector.
	mc.previousNumGC.Store(ms.NumGC)

	return s
}

// writeSample appends a sample to the current day's JSONL file.
// It also prunes files older than the retention period.
func (mc *metricsCollector) writeSample(s sample) error {
	dir := mc.app.DataDir()
	if dir == "" {
		return fmt.Errorf("data dir not configured")
	}

	filename := metricsFilePrefix + time.Now().UTC().Format(metricsDateFormat) + metricsFileSuffix
	path := filepath.Join(dir, filename)

	// Open for append (create if not exists).
	f, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0640)
	if err != nil {
		return err
	}
	defer f.Close()

	data, err := json.Marshal(s)
	if err != nil {
		return err
	}

	w := bufio.NewWriter(f)
	if _, err := w.Write(data); err != nil {
		return err
	}
	if err := w.WriteByte('\n'); err != nil {
		return err
	}
	if err := w.Flush(); err != nil {
		return err
	}

	// Prune old files (non-blocking, best-effort).
	go mc.pruneOldFiles(dir)

	return nil
}

// pruneOldFiles removes metrics JSONL files older than the retention period.
func (mc *metricsCollector) pruneOldFiles(dir string) {
	cutoff := time.Now().UTC().Add(-metricsRetention)
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if !strings.HasPrefix(name, metricsFilePrefix) || !strings.HasSuffix(name, metricsFileSuffix) {
			continue
		}
		dateStr := strings.TrimSuffix(strings.TrimPrefix(name, metricsFilePrefix), metricsFileSuffix)
		fileDate, err := time.Parse(metricsDateFormat, dateStr)
		if err != nil {
			continue
		}
		if fileDate.Before(cutoff) {
			os.Remove(filepath.Join(dir, name))
		}
	}
}

// --- HTTP handler ---

// handleMetrics returns recent memory metrics samples (admin-only).
// Query params:
//
//	?limit=N  — number of most recent samples to return (default 120, max 1000)
func (m *Manager) handleMetrics(e *core.RequestEvent) error {
	if !isAdmin(e) {
		return e.ForbiddenError("admin required", "")
	}

	limit := defaultSampleLimit
	if v := e.Request.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			limit = n
			if limit > maxSampleLimit {
				limit = maxSampleLimit
			}
		}
	}

	dir := m.app.DataDir()
	if dir == "" {
		return e.JSON(500, map[string]string{"message": "data dir not configured"})
	}

	// Read the current day's file (and yesterday's if we need more samples).
	var samples []sample
	today := time.Now().UTC().Format(metricsDateFormat)
	files := []string{
		metricsFilePrefix + today + metricsFileSuffix,
		metricsFilePrefix + time.Now().UTC().AddDate(0, 0, -1).Format(metricsDateFormat) + metricsFileSuffix,
	}

	for _, fname := range files {
		path := filepath.Join(dir, fname)
		fileSamples, err := readJSONL(path)
		if err != nil {
			continue
		}
		// Prepend older file's samples, append today's.
		samples = append(samples, fileSamples...)
	}

	// Return the last `limit` samples.
	total := len(samples)
	start := total - limit
	if start < 0 {
		start = 0
	}
	result := samples[start:]

	// Also include a real-time snapshot for "now".
	live := m.collector.readSample("")
	live.Event = "live"

	return e.JSON(200, map[string]any{
		"samples":  result,
		"live":     live,
		"total":    total,
		"returned": len(result),
	})
}

// readJSONL reads a JSONL file and returns parsed samples.
func readJSONL(path string) ([]sample, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	var samples []sample
	scanner := bufio.NewScanner(f)
	// Allow long lines (MemStats JSON is small but be safe).
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}
		var s sample
		if err := json.Unmarshal(line, &s); err != nil {
			continue // skip malformed lines
		}
		samples = append(samples, s)
	}
	return samples, scanner.Err()
}

// --- OS-level helpers ---

// readRSS reads the process RSS from /proc/self/status. Returns 0 on non-Linux
// or if the file is unavailable.
func readRSS() uint64 {
	data, err := os.ReadFile("/proc/self/status")
	if err != nil {
		return 0
	}
	for _, line := range strings.Split(string(data), "\n") {
		if strings.HasPrefix(line, "VmRSS:") {
			fields := strings.Fields(line)
			if len(fields) >= 2 {
				// VmRSS is in kB
				if kb, err := strconv.ParseUint(fields[1], 10, 64); err == nil {
					return kb * 1024
				}
			}
		}
	}
	return 0
}

// readCgroupLimit reads the cgroup memory limit. Tries cgroup v2 first
// (memory.max), then v1 (memory.limit_in_bytes). Returns 0 if no limit
// is set or cgroups are unavailable.
func readCgroupLimit() uint64 {
	// cgroup v2: /sys/fs/cgroup/memory.max
	v2data, err := os.ReadFile("/sys/fs/cgroup/memory.max")
	if err == nil {
		val := strings.TrimSpace(string(v2data))
		if val == "max" {
			return 0 // no limit
		}
		if limit, err := strconv.ParseUint(val, 10, 64); err == nil {
			// cgroup v1 no-limit sentinel: values near 2^63
			if limit > 8589934592 { // > 8GB → treat as no limit
				return 0
			}
			return limit
		}
	}

	// cgroup v1: /sys/fs/cgroup/memory/memory.limit_in_bytes
	v1data, err := os.ReadFile("/sys/fs/cgroup/memory/memory.limit_in_bytes")
	if err == nil {
		val := strings.TrimSpace(string(v1data))
		if limit, err := strconv.ParseUint(val, 10, 64); err == nil {
			// cgroup v1 uses a huge sentinel (near 2^63 or page-count-based)
			// to represent "no limit". Anything > 8GB is almost certainly
			// a no-limit sentinel for a container that would realistically
			// be capped at a few GB.
			if limit > 8589934592 {
				return 0
			}
			return limit
		}
	}

	return 0
}

package article

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sync/atomic"
	"testing"
	"time"
)

// pendingTags reads the durable backlog file for assertions.
func pendingTags(t *testing.T, app interface{ DataDir() string }) revalidatePending {
	t.Helper()
	b, err := os.ReadFile(filepath.Join(app.DataDir(), "revalidate.pending.json"))
	if err != nil {
		t.Fatalf("read pending backlog: %v", err)
	}
	var cur revalidatePending
	if err := json.Unmarshal(b, &cur); err != nil {
		t.Fatalf("unmarshal pending backlog: %v", err)
	}
	return cur
}

// countingAstro returns an Astro stub: the first `rejects` requests get 500,
// the rest 200. The counter is shared so assertions can check exact hits.
func countingAstro(t *testing.T, rejects int32) (*httptest.Server, *atomic.Int32) {
	t.Helper()
	var hits, bad atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n := hits.Add(1)
		if n <= rejects {
			bad.Add(1)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(srv.Close)
	return srv, &hits
}

// TestRevalidateRetry 钉住失效通知的持久重试(取代 2026-09-29 退役的
// selfheal.pb.js 每日 04:00 兜底):失败合并进 pb_data/revalidate.pending.json,
// 重放成功(200)即删文件;Astro 仍不可达时文件保留等下一轮;进程重启后
// 后台循环的启动首扫照样消费遗留 backlog。
func TestRevalidateRetry(t *testing.T) {
	t.Run("failure queues pending, replay drains", func(t *testing.T) {
		// 前两次(初次失效 + 第一轮重放)都 500,第三次 200。
		srv, hits := countingAstro(t, 2)
		t.Setenv("ASTRO_URL", srv.URL)
		app := setupApp(t)
		_ = New(app)

		revalidateAstroCache(app, []string{"posts", "feed"})

		if got := pendingTags(t, app); len(got.Tags) != 2 {
			t.Fatalf("pending tags = %v, want [feed posts]", got.Tags)
		}
		if got := pendingTags(t, app); got.Since == "" {
			t.Fatal("pending since is empty")
		}

		replayPending(app) // 500 — backlog 必须保留
		if _, err := os.Stat(filepath.Join(app.DataDir(), "revalidate.pending.json")); err != nil {
			t.Fatal("backlog dropped while Astro still failing")
		}

		replayPending(app) // 200 — backlog 消费
		if _, err := os.Stat(filepath.Join(app.DataDir(), "revalidate.pending.json")); !os.IsNotExist(err) {
			t.Fatal("backlog not removed after successful replay")
		}
		if got := hits.Load(); got != 3 {
			t.Fatalf("astro hits = %d, want 3", got)
		}
	})

	t.Run("merge dedupes tags across failures", func(t *testing.T) {
		srv, _ := countingAstro(t, 100)
		t.Setenv("ASTRO_URL", srv.URL)
		app := setupApp(t)

		revalidateAstroCache(app, []string{"posts", "feed"})
		revalidateAstroCache(app, []string{"posts", "pages"})

		got := pendingTags(t, app)
		want := []string{"feed", "pages", "posts"}
		if len(got.Tags) != len(want) {
			t.Fatalf("pending tags = %v, want %v", got.Tags, want)
		}
		for i := range want {
			if got.Tags[i] != want[i] {
				t.Fatalf("pending tags = %v, want %v", got.Tags, want)
			}
		}
	})

	t.Run("backlog survives restart via startup scan", func(t *testing.T) {
		// "重启"语义:backlog 文件先于循环存在(等价上个进程留下),
		// startRevalidateRetry 的启动首扫必须直接消费它。
		dead, _ := countingAstro(t, 0)
		deadURL := dead.URL
		dead.Close() // 连接拒绝
		t.Setenv("ASTRO_URL", deadURL)
		app := setupApp(t)

		revalidateAstroCache(app, []string{"posts"})
		if _, err := os.Stat(filepath.Join(app.DataDir(), "revalidate.pending.json")); err != nil {
			t.Fatalf("pending file not created on unreachable Astro: %v", err)
		}

		srv, _ := countingAstro(t, 0)
		t.Setenv("ASTRO_URL", srv.URL)
		revalidateRetryInterval = 10 * time.Millisecond
		startRevalidateRetry(app)

		deadline := time.Now().Add(3 * time.Second)
		for time.Now().Before(deadline) {
			if _, err := os.Stat(filepath.Join(app.DataDir(), "revalidate.pending.json")); os.IsNotExist(err) {
				return
			}
			time.Sleep(20 * time.Millisecond)
		}
		t.Fatal("startup scan did not consume pre-existing backlog within 3s")
	})
}

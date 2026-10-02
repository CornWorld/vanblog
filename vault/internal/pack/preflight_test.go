package pack

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func stage(t *testing.T, files map[string]string) string {
	t.Helper()
	dir := t.TempDir()
	for name, content := range files {
		path := filepath.Join(dir, name)
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	return dir
}

// TestPreflight 钉住 boot 预检的分档策略:用户钩子语法错 → 从 staging 剔除并
// 报告(响亮降级,站点照常);pack 钩子语法错 → fatal(自家代码必须响);
// 合法文件原样保留。
func TestPreflight(t *testing.T) {
	staging := stage(t, map[string]string{
		"good.pb.js":                   `onRecordCreateRequest(function (e) { return e.next(); }, "moments");`,
		"bad.pb.js":                    "onRecordCreateRequest(function (e) {\n  e.record.set(\"author\"\n}, \"moments\");",
		"pack--moments--moments.pb.js": "function broken() {\n  return ???;\n}",
		"lib/vanblog.d.ts":             "// not a hook",
	})

	excluded, fatal, err := Preflight(staging)
	if err != nil {
		t.Fatalf("Preflight: %v", err)
	}

	if len(fatal) != 1 || !strings.HasPrefix(fatal[0].Owner, "pack:moments") {
		t.Fatalf("fatal = %+v, want exactly the pack failure", fatal)
	}
	if fatal[0].Line != 2 {
		t.Errorf("fatal line = %d, want 2", fatal[0].Line)
	}
	if !strings.Contains(fatal[0].Snippet, "return ???") || !strings.Contains(fatal[0].Snippet, "^") {
		t.Errorf("snippet missing source/caret: %q", fatal[0].Snippet)
	}

	if len(excluded) != 1 || excluded[0].Path != "bad.pb.js" || excluded[0].Owner != "user" {
		t.Fatalf("excluded = %+v, want exactly bad.pb.js as user", excluded)
	}
	// goja 报的是"意外的 token"位置(`}`),不是用户少写括号的那行。
	if excluded[0].Line != 3 || excluded[0].Column != 1 {
		t.Errorf("user failure position = %d:%d, want 3:1", excluded[0].Line, excluded[0].Column)
	}
	if !strings.Contains(excluded[0].Snippet, `}, "moments");`) {
		t.Errorf("snippet missing offending line: %q", excluded[0].Snippet)
	}

	if _, err := os.Stat(filepath.Join(staging, "bad.pb.js")); !os.IsNotExist(err) {
		t.Fatal("broken user hook not removed from staging — jsvm would still load it")
	}
	if _, err := os.Stat(filepath.Join(staging, "good.pb.js")); err != nil {
		t.Fatal("valid hook was removed")
	}
}

func TestPreflightCleanStaging(t *testing.T) {
	staging := stage(t, map[string]string{
		"ok.pb.js":                   "console.log(1);",
		"pack--online--online.pb.js": "routerAdd(\"GET\", \"/x\", (c) => { return c.next(); });",
	})
	excluded, fatal, err := Preflight(staging)
	if err != nil {
		t.Fatalf("Preflight: %v", err)
	}
	if len(excluded) != 0 || len(fatal) != 0 {
		t.Fatalf("clean staging produced failures: excluded=%v fatal=%v", excluded, fatal)
	}
}

// TestRenderSnippetCaretAlignment 钉住 caret 列对齐:源码从 numLen+3 列开始
// ("%4d | "),caret 必须落在第 col 个字符正下方——旧实现对每列左偏 3。
func TestRenderSnippetCaretAlignment(t *testing.T) {
	content := "line one\nreturn ???;\n"
	snippet := renderSnippet(content, 2, 8) // "return ???;" 第 8 个字符是 '?'
	lines := strings.Split(snippet, "\n")
	srcIdx := strings.Index(lines[0], "return ???;")
	if srcIdx < 0 {
		t.Fatalf("snippet missing source line: %q", lines[0])
	}
	caretIdx := strings.Index(lines[1], "^")
	// caret 与源码列的关系:行内第 8 个字符(0-based 7)处
	if caretIdx != srcIdx+7 {
		t.Fatalf("caret at %d, want %d (under 8th char of source):\n%s", caretIdx, srcIdx+7, snippet)
	}
}

// TestRenderSnippetClampsOutOfRangeColumn:越界列号钳到行尾,caret 不飘出源码行。
func TestRenderSnippetClampsOutOfRangeColumn(t *testing.T) {
	snippet := renderSnippet("ab;\n", 1, 999)
	lines := strings.Split(snippet, "\n")
	srcIdx := strings.Index(lines[0], "ab;")
	caretIdx := strings.Index(lines[1], "^")
	if caretIdx != srcIdx+len("ab;") {
		t.Fatalf("caret at %d, want %d (one past line end):\n%s", caretIdx, srcIdx+len("ab;"), snippet)
	}
}

// TestPreflightVanishedUserHookNotFatal:用户 hook 在 ReadDir 与 ReadFile 之间
// 消失按响亮降级处理(excluded + 报告),不是致命 staging 错误;pack hook 消失
// 仍然致命。
func TestPreflightVanishedUserHookNotFatal(t *testing.T) {
	// 悬空 symlink:ReadDir 列得出条目,ReadFile 却 ENOENT——精确模拟
	// 「ReadDir 之后、ReadFile 之前文件消失」的窗口
	staging := t.TempDir()
	if err := os.Symlink(filepath.Join(staging, "no-such-target"), filepath.Join(staging, "gone.pb.js")); err != nil {
		t.Fatal(err)
	}
	excluded, fatal, err := Preflight(staging)
	if err != nil {
		t.Fatalf("vanished user hook must not be fatal: %v", err)
	}
	if len(fatal) != 0 || len(excluded) != 1 || excluded[0].Path != "gone.pb.js" {
		t.Fatalf("excluded=%+v fatal=%+v, want the vanished hook reported as excluded", excluded, fatal)
	}

	packStaging := t.TempDir()
	if err := os.Symlink(filepath.Join(packStaging, "no-such-target"), filepath.Join(packStaging, "pack--x--y.pb.js")); err != nil {
		t.Fatal(err)
	}
	if _, _, err := Preflight(packStaging); err == nil {
		t.Fatal("vanished pack hook must stay fatal (staging is pack-owned)")
	}
}

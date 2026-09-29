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

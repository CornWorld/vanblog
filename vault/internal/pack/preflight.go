package pack

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"github.com/dop251/goja"
)

// Failure is one hook file that failed boot preflight.
type Failure struct {
	Path    string // path as it appeared in staging
	Owner   string // "pack:<name>" or "user"
	Message string // parser message
	Line    int    // 1-based
	Column  int    // 1-based
	Snippet string // offending line with caret, already rendered
}

// lastExclusions holds the hooks removed by the most recent Preflight run.
// Process-lifetime by design: one boot = one preflight; consumed by main's
// OnServe to write hook.load.failed audit rows once the DB is available.
var lastExclusions []Failure

// LastPreflightExclusions returns hooks removed by this boot's Preflight.
func LastPreflightExclusions() []Failure { return lastExclusions }

// Preflight syntax-checks every staged hook (*.pb.js) BEFORE jsvm loads them.
//
// Policy (2026-09-29):
//   - pack hooks (staging name "pack--<name>--<file>.pb.js") are first-party:
//     a parse failure is returned as fatal — CI should have caught it, and a
//     broken invariant-carrying hook must not be skipped silently.
//   - user hooks are decorum or local invariants whose absence must be loud
//     but must NOT take the blog down (a one-character typo in a webhook
//     example should not crash-loop the site). They are REMOVED from staging
//     and reported; the caller surfaces them (boot report + audits row).
//
// Parse-only: no execution, no side effects. Top-level runtime errors cannot
// be caught here — they still panic inside jsvm at load; the caller renders
// that panic as a readable fatal report.
func Preflight(staging string) (excluded []Failure, fatal []Failure, err error) {
	entries, err := os.ReadDir(staging)
	if err != nil {
		return nil, nil, fmt.Errorf("read hooks staging: %w", err)
	}

	for _, entry := range entries {
		name := entry.Name()
		if entry.IsDir() || !strings.HasSuffix(name, ".pb.js") {
			continue
		}
		path := filepath.Join(staging, name)
		content, err := os.ReadFile(path)
		if err != nil {
			// 用户 hook 中途消失(restage/手工删除):不是语法错误,按响亮降级
			// 处理——报告并跳过,不升级为致命 staging 错误;pack hook 仍致命
			// (staging 由 pack 独占,消失即 pack 自身 bug)。
			if errors.Is(err, fs.ErrNotExist) && !strings.HasPrefix(name, "pack--") {
				if rmErr := os.Remove(path); rmErr != nil && !errors.Is(rmErr, fs.ErrNotExist) {
					return nil, nil, fmt.Errorf("exclude broken hook %q: %w", name, rmErr)
				}
				excluded = append(excluded, Failure{Path: name, Owner: "user", Message: "hook file disappeared during preflight: " + err.Error()})
				continue
			}
			return nil, nil, fmt.Errorf("read staged hook %q: %w", name, err)
		}

		if _, perr := goja.Compile(name, string(content), true); perr != nil {
			f := failureFrom(name, content, perr)
			if owner, ok := strings.CutPrefix(name, "pack--"); ok {
				f.Owner = "pack:" + strings.SplitN(owner, "--", 2)[0]
				fatal = append(fatal, f)
				continue
			}
			f.Owner = "user"
			// Loud degrade: remove from staging so jsvm never sees it.
			if rmErr := os.Remove(path); rmErr != nil {
				return nil, nil, fmt.Errorf("exclude broken hook %q: %w", name, rmErr)
			}
			excluded = append(excluded, f)
		}
	}
	lastExclusions = excluded
	return excluded, fatal, nil
}

func failureFrom(name string, content []byte, perr error) Failure {
	f := Failure{Path: name, Message: perr.Error()}
	if e, ok := perr.(*goja.CompilerSyntaxError); ok && e.File != nil {
		pos := e.File.Position(e.Offset)
		f.Line, f.Column = pos.Line, pos.Column
	} else {
		f.Line, f.Column = parsePosition(f.Message)
	}
	if f.Line > 0 {
		f.Snippet = renderSnippet(string(content), f.Line, f.Column)
	}
	return f
}

// parsePosition extracts line/column from goja compile messages, which come
// in several shapes: "file: Line 2:10 message", "(2:15)", "(line 2)".
func parsePosition(msg string) (line, col int) {
	if m := lineColRe.FindStringSubmatch(msg); m != nil {
		line, _ = strconv.Atoi(m[1])
		col, _ = strconv.Atoi(m[2])
		return line, col
	}
	if m := parenPosRe.FindStringSubmatch(msg); m != nil {
		line, _ = strconv.Atoi(m[1])
		col, _ = strconv.Atoi(m[2])
	}
	return line, col
}

var lineColRe = regexp.MustCompile(`(?i)line\s+(\d+)(?::\s*(\d+))?`)
var parenPosRe = regexp.MustCompile(`\((\d+):(\d+)\)`)

// renderSnippet returns the offending line prefixed with its number and a
// caret row pointing at the column — PHP-style, so a blog admin can see the
// typo without opening the file.
func renderSnippet(content string, line, col int) string {
	if line <= 0 {
		return ""
	}
	lines := strings.Split(content, "\n")
	if line > len(lines) {
		return ""
	}
	src := lines[line-1]
	num := fmt.Sprintf("%4d", line)
	caret := ""
	if col > 0 {
		if col > len(src)+1 { // 越界列号钳到行尾,不让 caret 飘出源码行
			col = len(src) + 1
		}
		// 源码从第 numLen+3 列开始("%4d | "),caret 指向第 col 个字符
		caret = strings.Repeat(" ", numLen+3+col-1) + "^"
	} else {
		caret = strings.Repeat(" ", numLen+3) + "^"
	}
	var b strings.Builder
	fmt.Fprintf(&b, "%s | %s\n", num, src)
	b.WriteString(caret)
	return b.String()
}

const numLen = 4 // width of "%4d" line numbers in snippets

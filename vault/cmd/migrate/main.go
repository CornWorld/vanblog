// Command migrate is an interactive CLI tool that reads data from an old
// VanBlog MongoDB database and imports it into a running VanBlog instance.
//
// Usage:
//
//	go run ./cmd/migrate
//
// The program guides the user through three steps:
//  1. Extract content data from old VanBlog MongoDB
//  2. (Optional) Waline → Artalk comment migration instructions
//  3. Import into a running VanBlog instance
package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/cornworld/vanblog/internal/migration"
)

var (
	cyan   = "\033[0;36m"
	green  = "\033[0;32m"
	yellow = "\033[1;33m"
	red    = "\033[0;31m"
	reset  = "\033[0m"

	scanner = bufio.NewScanner(os.Stdin)
)

func main() {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Catch Ctrl+C for cleanup
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigCh
		cancel()
		fmt.Printf("\n%s中断。%s\n", yellow, reset)
		os.Exit(1)
	}()

	printBanner()

	// ═══════════════════════════════════════════
	// Step 1: Detect / connect MongoDB
	// ═══════════════════════════════════════════
	fmt.Printf("%s步骤 1：提取旧 VanBlog 内容数据%s\n\n", yellow, reset)

	mongoURI, tempCleanup := resolveMongoURI(ctx)
	defer tempCleanup()

	if mongoURI == "" {
		fmt.Printf("\n%s无法连接 MongoDB，退出。%s\n", red, reset)
		tempCleanup()
		os.Exit(1) //nolint:gocritic // tempCleanup already ran above; remaining defers are context cancel only
	}

	dbName := prompt("数据库名", "vanblog")

	doContent := promptBool("是否提取内容数据？", true)
	if !doContent {
		fmt.Printf("  跳过内容提取。\n")
	}

	// ═══════════════════════════════════════════
	// Step 2: Waline comment migration
	// ═══════════════════════════════════════════
	fmt.Printf("\n%s步骤 2：评论数据迁移（Waline → Artalk）%s\n\n", yellow, reset)

	doWaline := promptBool("是否迁移 Waline 评论数据？", false)
	var walineInfo WalineConfig
	if doWaline {
		walineInfo = promptWaline()
	}

	// ═══════════════════════════════════════════
	// Step 3: Import target
	// ═══════════════════════════════════════════
	fmt.Printf("\n%s步骤 3：导入到新版 VanBlog%s\n\n", yellow, reset)

	targetURL := prompt("VanBlog 实例地址 (如 http://localhost:8090，留空则仅输出 JSON)", "")

	// ═══════════════════════════════════════════
	// Execute
	// ═══════════════════════════════════════════
	fmt.Printf("\n%s────────────────────────────────────%s\n\n", cyan, reset)

	step := 0
	totalSteps := 1
	if doWaline {
		totalSteps = 2
	}

	if doContent {
		step++
		fmt.Printf("%s[%d/%d] 提取内容数据...%s\n", green, step, totalSteps, reset)

		fmt.Printf("  → 连接 MongoDB，读取 articles/drafts/categories/tags/statics\n")

		mongoCtx, mongoCancel := context.WithTimeout(ctx, 30*time.Second)
		defer mongoCancel()

		backup, err := migration.ReadFromMongo(mongoCtx, mongoURI, dbName)
		if err != nil {
			fmt.Printf("  %s错误: %v%s\n", red, err, reset)
			os.Exit(1)
		}

		fmt.Printf("\n  %s执行完成：%d 篇文章、%d 个分类、%d 个标签、%d 张图片%s\n",
			green, len(backup.Articles), len(backup.Categories), len(backup.Tags), len(backup.Static), reset)

		jsonData, err := json.MarshalIndent(backup, "", "  ")
		if err != nil {
			fmt.Printf("  %sJSON 序列化错误: %v%s\n", red, err, reset)
			os.Exit(1)
		}

		if targetURL != "" {
			importURL := strings.TrimRight(targetURL, "/") + "/api/vanblog/migrate/import"
			fmt.Printf("  → 正在导入到 %s ...\n", importURL)

			req, err := http.NewRequestWithContext(ctx, http.MethodPost, importURL, bytes.NewReader(jsonData))
			if err != nil {
				// Shouldn't happen for a valid URL; keep data safe regardless.
				fmt.Printf("  %s导入请求构造失败: %v%s\n", red, err, reset)
				tmpFile := writeTempJSON(jsonData)
				fmt.Printf("  %s数据已保存到: %s%s\n", yellow, tmpFile, reset)
			} else {
				req.Header.Set("Content-Type", "application/json")
				resp, err := http.DefaultClient.Do(req)
				if err != nil {
					fmt.Printf("  %s导入请求失败: %v%s\n", red, err, reset)
					// Still write JSON to temp file so data isn't lost
					tmpFile := writeTempJSON(jsonData)
					fmt.Printf("  %s数据已保存到: %s%s\n", yellow, tmpFile, reset)
				} else {
					defer resp.Body.Close()
					body, _ := io.ReadAll(resp.Body)

					var result migration.Result
					if err := json.Unmarshal(body, &result); err == nil {
						fmt.Printf("  %s✅ 导入完成：%d 篇文章、%d 个分类、%d 个标签、%d 个媒体%s\n",
							green, result.Posts, result.Categories, result.Tags, result.Media, reset)
						if len(result.Errors) > 0 {
							for _, e := range result.Errors {
								fmt.Printf("  %s⚠ %s%s\n", yellow, e, reset)
							}
						}
					} else {
						fmt.Printf("  %s响应 (%d): %s%s\n", green, resp.StatusCode, string(body), reset)
					}
				}
			}
		} else {
			tmpFile := writeTempJSON(jsonData)
			fmt.Printf("\n  %sJSON 已保存到: %s%s\n", green, tmpFile, reset)
			fmt.Printf("  手动导入:\n")
			fmt.Printf("    curl -X POST http://localhost:8090/api/vanblog/migrate/import \\\n")
			fmt.Printf("      -H 'Content-Type: application/json' -d @%s\n", tmpFile)
		}
	}

	if doWaline {
		step++
		fmt.Printf("\n%s[%d/%d] 迁移评论数据...%s\n\n", green, step, totalSteps, reset)

		printArtransferInstructions(walineInfo)
	}

	fmt.Printf("\n%s────────────────────────────────────%s\n", cyan, reset)
	fmt.Printf("%s迁移完成！%s\n", green, reset)
	fmt.Println()
}

// ─── Banner ──────────────────────────────────────────────

func printBanner() {
	fmt.Printf("%s╔══════════════════════════════════╗%s\n", cyan, reset)
	fmt.Printf("%s║   VanBlog  数据迁移工具            ║%s\n", cyan, reset)
	fmt.Printf("%s╚══════════════════════════════════╝%s\n", cyan, reset)
	fmt.Println()
}

// ─── MongoDB detection ─────────────────────────────────

// resolveMongoURI detects a running MongoDB and optionally starts a temp container.
// Returns the URI and a cleanup function (caller must defer it).
func resolveMongoURI(ctx context.Context) (uri string, cleanup func()) {
	cleanup = func() {}

	fmt.Printf("  正在检测运行中的 MongoDB...\n")

	// 1. Check Docker containers
	uri = detectDockerMongo(ctx)
	if uri != "" {
		fmt.Printf("  → 检测到运行中的 MongoDB 容器\n")
		fmt.Printf("  MongoDB 连接: %s\n", uri)
		if !promptBool("使用此连接？", true) {
			uri = ""
		}
	}

	// 2. Check local ports
	if uri == "" {
		uri = detectLocalMongo()
		if uri != "" {
			fmt.Printf("  → 检测到本地 MongoDB\n")
			fmt.Printf("  MongoDB 连接: %s\n", uri)
			if !promptBool("使用此连接？", true) {
				uri = ""
			}
		}
	}

	// 3. No running Mongo — ask for data dir and start temp container
	if uri == "" {
		fmt.Printf("\n  未连接到运行中的 MongoDB。\n")
		fmt.Printf("  请提供旧数据目录路径，程序会自动启动临时 MongoDB 读取数据。\n\n")

		dataDir := guessDataDir()
		dataDir = prompt("数据目录路径", dataDir)

		// Validate data dir
		if info, err := os.Stat(dataDir); err != nil || !info.IsDir() {
			fmt.Printf("  %s错误: 目录不存在: %s%s\n", red, dataDir, reset)
			fmt.Printf("  提示: MongoDB 数据目录通常包含 WiredTiger、collection、index 等文件\n")
			fmt.Printf("  可通过 'find / -name WiredTiger -type f 2>/dev/null' 搜索\n")
			return "", cleanup
		}

		// Warn if directory doesn't look like MongoDB data
		if !looksLikeMongoData(dataDir) {
			fmt.Printf("  %s警告: 该目录不像 MongoDB 数据目录（缺少 WiredTiger 文件）%s\n", yellow, reset)
			if !promptBool("仍然继续？", false) {
				return "", cleanup
			}
		}

		uri, cleanup = startTempMongo(ctx, dataDir)
		if uri == "" {
			return "", cleanup
		}
	}

	return uri, cleanup
}

// detectDockerMongo looks for running Docker containers with "mongo" in the name.
func detectDockerMongo(ctx context.Context) string {
	out, err := exec.Command("docker", "ps", "--format", "{{.Names}}").Output()
	if err != nil {
		return ""
	}

	for name := range strings.SplitSeq(strings.TrimSpace(string(out)), "\n") {
		name = strings.TrimSpace(name)
		if name == "" || !strings.Contains(strings.ToLower(name), "mongo") {
			continue
		}

		// Try to ping
		pingCmd := exec.Command("docker", "exec", name,
			"mongosh", "--quiet", "--eval", "db.runCommand({ping:1})")
		pingOut, err := pingCmd.Output()
		if err != nil {
			continue
		}
		if !strings.Contains(string(pingOut), "ok") {
			continue
		}

		// Get port mapping
		portOut, err := exec.Command("docker", "port", name, "27017").Output()
		port := "27017"
		if err == nil {
			lines := strings.Split(strings.TrimSpace(string(portOut)), "\n")
			if len(lines) > 0 {
				// format: 0.0.0.0:27017 or [::]:27017
				parts := strings.Split(lines[0], ":")
				if len(parts) > 0 {
					port = parts[len(parts)-1]
				}
			}
		}

		return fmt.Sprintf("mongodb://localhost:%s", port)
	}

	return ""
}

// detectLocalMongo tries to connect to MongoDB on common local ports.
func detectLocalMongo() string {
	for _, port := range []int{27017, 27018, 27019} {
		if !canDial(port) {
			continue
		}
		pingCmd := exec.Command("mongosh", "--port", strconv.Itoa(port),
			"--quiet", "--eval", "db.runCommand({ping:1})")
		pingOut, err := pingCmd.Output()
		if err != nil {
			continue
		}
		if strings.Contains(string(pingOut), "ok") {
			return fmt.Sprintf("mongodb://localhost:%d", port)
		}
	}
	return ""
}

// guessDataDir tries to guess common MongoDB data directory locations.
func guessDataDir() string {
	paths := []string{
		"/var/vanblog/data/mongo",
		"/var/vanblog/mongo/db",
		"/opt/vanblog/mongo/db",
	}
	for _, p := range paths {
		if info, err := os.Stat(p); err == nil && info.IsDir() {
			if looksLikeMongoData(p) {
				return p
			}
		}
	}
	return ""
}

// looksLikeMongoData checks if a directory looks like MongoDB data.
func looksLikeMongoData(dir string) bool {
	checks := []string{
		dir + "/WiredTiger",
		dir + "/WiredTiger.wt",
		dir + "/journal",
	}
	for _, c := range checks {
		if _, err := os.Stat(c); err == nil {
			return true
		}
	}
	return false
}

// canDial checks if a TCP port is reachable.
func canDial(port int) bool {
	conn, err := net.DialTimeout("tcp", fmt.Sprintf("127.0.0.1:%d", port), 2*time.Second)
	if err != nil {
		return false
	}
	conn.Close()
	return true
}

// startTempMongo starts a temporary Docker MongoDB container mounted to dataDir.
func startTempMongo(ctx context.Context, dataDir string) (uri string, cleanup func()) {
	cleanup = func() {
		fmt.Printf("  清理临时 MongoDB 容器...\n")
		_ = exec.Command("docker", "rm", "-f", "vanblog-migrate-mongo").Run()
	}

	// Remove any leftover container
	_ = exec.Command("docker", "rm", "-f", "vanblog-migrate-mongo").Run()

	port := findFreePort()

	fmt.Printf("  启动临时 MongoDB 读取数据...\n")
	startCmd := exec.Command("docker", "run", "-d", "--name", "vanblog-migrate-mongo", "--rm",
		"-v", dataDir+":/data/db:ro",
		"-p", fmt.Sprintf("%d:27017", port),
		"mongo:7", "--bind_ip_all")
	startCmd.Stdout = nil
	startCmd.Stderr = nil
	if err := startCmd.Run(); err != nil {
		fmt.Printf("  %s启动临时 MongoDB 失败: %v%s\n", red, err, reset)
		return "", cleanup
	}

	// Wait for MongoDB to be ready
	fmt.Printf("  等待 MongoDB 就绪...\n")
	for range 30 {
		select {
		case <-ctx.Done():
			return "", cleanup
		default:
		}

		pingCmd := exec.Command("docker", "exec", "vanblog-migrate-mongo",
			"mongosh", "--quiet", "--eval", "db.runCommand({ping:1})")
		pingOut, err := pingCmd.Output()
		if err == nil && strings.Contains(string(pingOut), "ok") {
			fmt.Printf("  MongoDB 临时容器已就绪\n")
			return fmt.Sprintf("mongodb://localhost:%d", port), cleanup
		}
		time.Sleep(1 * time.Second)
	}

	fmt.Printf("  %sMongoDB 启动超时%s\n", red, reset)
	cleanup()
	return "", func() {}
}

// findFreePort finds an available TCP port.
func findFreePort() int {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return 27018 // fallback
	}
	defer listener.Close()
	return listener.Addr().(*net.TCPAddr).Port
}

// ─── Interactive prompts ───────────────────────────────

func prompt(text, defaultVal string) string {
	if defaultVal != "" {
		fmt.Printf("  %s [%s]: ", text, defaultVal)
	} else {
		fmt.Printf("  %s: ", text)
	}
	if !scanner.Scan() {
		os.Exit(0)
	}
	result := strings.TrimSpace(scanner.Text())
	if result == "" {
		return defaultVal
	}
	return result
}

func promptBool(text string, defaultYes bool) bool {
	yn := "[y/N]"
	if defaultYes {
		yn = "[Y/n]"
	}
	fmt.Printf("  %s %s ", text, yn)
	if !scanner.Scan() {
		os.Exit(0)
	}
	r := strings.ToLower(strings.TrimSpace(scanner.Text()))
	if r == "" {
		return defaultYes
	}
	return r == "y" || r == "yes"
}

// ─── Waline migration ──────────────────────────────────

type WalineConfig struct {
	DBType      string // mysql, sqlite, postgres
	Host        string
	Port        string
	User        string
	Password    string
	Name        string
	TablePrefix string
	FilePath    string // sqlite only
}

func promptWaline() WalineConfig {
	var cfg WalineConfig

	fmt.Println()
	fmt.Printf("  选择 Waline 数据库类型:\n")
	fmt.Printf("    [1] MySQL / MariaDB\n")
	fmt.Printf("    [2] SQLite\n")
	fmt.Printf("    [3] PostgreSQL\n")
	choice := prompt("请选择", "1")

	switch choice {
	case "2":
		cfg.DBType = "sqlite"
	case "3":
		cfg.DBType = "postgres"
	default:
		cfg.DBType = "mysql"
	}

	if cfg.DBType == "sqlite" {
		cfg.FilePath = prompt("SQLite 数据库文件路径", "")
	} else {
		cfg.Host = prompt("数据库主机", "localhost")

		defaultPort := "3306"
		if cfg.DBType == "postgres" {
			defaultPort = "5432"
		}
		cfg.Port = prompt("数据库端口", defaultPort)

		cfg.User = prompt("数据库用户名", "root")
		cfg.Password = promptSensitive("数据库密码")
	}

	cfg.Name = prompt("数据库名称", "waline")
	cfg.TablePrefix = prompt("表前缀", "wl_")

	return cfg
}

func promptSensitive(text string) string {
	fmt.Printf("  %s: ", text)
	// Disable echo by reading password-style
	// We use a simple approach: just read normally since Go's bufio can't easily do no-echo
	// In practice, users on macOS/Linux can pipe input if needed
	if !scanner.Scan() {
		os.Exit(0)
	}
	return strings.TrimSpace(scanner.Text())
}

func printArtransferInstructions(cfg WalineConfig) {
	osName := runtime.GOOS
	arch := runtime.GOARCH

	// Normalize arch names
	archName := "amd64"
	if arch == "arm64" {
		archName = "arm64"
	}

	fmt.Printf("  评论迁移需要 Artransfer-CLI 工具。\n")
	fmt.Printf("  请运行以下命令（或在 Artalk 控制中心手动操作）：\n\n")

	fmt.Printf("  %sStep 1 - 下载工具:%s\n", green, reset)

	switch {
	case osName == "darwin" && archName == "amd64":
		fmt.Printf("    curl -sL https://github.com/ArtalkJS/Artransfer-CLI/releases/latest/download/artransfer_darwin_amd64.tar.gz | tar xz\n")
	case osName == "darwin" && archName == "arm64":
		fmt.Printf("    curl -sL https://github.com/ArtalkJS/Artransfer-CLI/releases/latest/download/artransfer_darwin_arm64.tar.gz | tar xz\n")
	case osName == "linux":
		fmt.Printf("    curl -sL https://github.com/ArtalkJS/Artransfer-CLI/releases/latest/download/artransfer_linux_amd64.tar.gz | tar xz\n")
	default:
		fmt.Printf("    访问 https://github.com/ArtalkJS/Artransfer-CLI/releases/latest 下载对应版本\n")
	}

	fmt.Println()
	fmt.Printf("  %sStep 2 - 导出 Waline 数据:%s\n", green, reset)

	if cfg.DBType == "sqlite" {
		fmt.Printf("    ./artransfer waline --db=sqlite --file=%s --name=%s --table-prefix=%s\n",
			cfg.FilePath, cfg.Name, cfg.TablePrefix)
	} else {
		fmt.Printf("    ./artransfer waline \\\n")
		fmt.Printf("      --db=%s \\\n", cfg.DBType)
		fmt.Printf("      --host=%s \\\n", cfg.Host)
		fmt.Printf("      --port=%s \\\n", cfg.Port)
		fmt.Printf("      --user=%s \\\n", cfg.User)
		fmt.Printf("      --password=YOUR_PASSWORD \\\n")
		fmt.Printf("      --name=%s \\\n", cfg.Name)
		fmt.Printf("      --table-prefix=%s\n", cfg.TablePrefix)
	}

	fmt.Println()
	fmt.Printf("  %sStep 3 - 导入 Artalk:%s\n", green, reset)
	fmt.Printf("    在 Artalk 控制中心 → 迁移 → 上传 .artrans 文件\n")
	fmt.Println()
}

// ─── Helpers ────────────────────────────────────────────

// writeTempJSON writes data to a temp file and returns the path.
func writeTempJSON(data []byte) string {
	f, err := os.CreateTemp("", "vanblog-migrate-*.json")
	if err != nil {
		fmt.Printf("  %s无法创建临时文件: %v%s\n", red, err, reset)
		return ""
	}
	defer f.Close()
	if _, err := f.Write(data); err != nil {
		fmt.Printf("  %s写入临时文件失败: %v%s\n", red, err, reset)
		return ""
	}
	return f.Name()
}

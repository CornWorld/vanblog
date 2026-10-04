// Package demo — 公开演示站(VANBLOG_DEMO=1)的危险管理面守卫。
//
// demo 账号(role=admin,公开凭据)可以自由折腾内容,但以下能力一律 403:
//   - /api/vanblog/agent/*    —— agent 终端/校验,容器内 shell 执行面
//   - /api/vanblog/mcp/*      —— 宿主文件系统读写
//   - /api/vanblog/backups    —— 全量下载 / 恢复覆盖
//   - /api/vanblog/migrate/*  —— 数据全量替换
//   - /api/vanblog/routing/apply|rules —— caddy 路由接管
//   - /api/vanblog/system/restart、/api/vanblog/themes/reload —— 服务生命周期
//
// superuser 面不归本守卫管:公开凭据 ≠ superuser 由 demo-setup 的随机
// 密码轮换兜底(见 scripts/ops/demo-setup.sh)。
package demo

import (
	"net/http"
	"os"
	"strings"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

// blockedPrefixes — 前缀匹配即封禁,覆盖对应全部子路径与 HTTP 方法。
var blockedPrefixes = []string{
	"/api/vanblog/agent/",
	"/api/vanblog/mcp/",
	"/api/vanblog/backups",
	"/api/vanblog/migrate/",
	"/api/vanblog/routing/apply",
	"/api/vanblog/routing/rules",
	"/api/vanblog/system/restart",
	"/api/vanblog/themes/reload",
}

// IsBlocked 报告路径是否落在演示模式封禁清单内。
func IsBlocked(path string) bool {
	for _, p := range blockedPrefixes {
		if strings.HasPrefix(path, p) {
			return true
		}
	}
	return false
}

// New 注册演示模式守卫;VANBLOG_DEMO != "1" 时空操作。
// 中间件挂在路由根,先于各 manager 的路由匹配执行,不受注册顺序影响。
func New(app *pocketbase.PocketBase) {
	if os.Getenv("VANBLOG_DEMO") != "1" {
		return
	}
	app.OnServe().BindFunc(func(event *core.ServeEvent) error {
		event.Router.BindFunc(func(e *core.RequestEvent) error {
			if IsBlocked(e.Request.URL.Path) {
				return e.JSON(http.StatusForbidden, map[string]string{
					"message": "演示模式已禁用该能力(VANBLOG_DEMO=1)",
				})
			}
			return e.Next()
		})
		return event.Next()
	})
}

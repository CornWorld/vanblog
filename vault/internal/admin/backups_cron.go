// Daily scheduled backups with config-driven retention.
//
// 缺口背景:备份此前只有手动端点(handleCreateBackup)与升级前自动备份,
// 无定时、无保留清理——健忘的博主永远没有备份,磁盘却会无限累积。
// 归位:备份本体是数据安全 → Go cron;保留份数是偏好 → site 配置。
package admin

import (
	"context"
	"encoding/json"
	"log/slog"
	"slices"
	"strings"
	"time"

	"github.com/cornworld/vanblog/internal/audit"
	"github.com/pocketbase/pocketbase/tools/filesystem/blob"
)

const (
	// backupCronId 每日备份任务;03:00,与 04:00 自愈、00:00 访问聚合错峰。
	backupCronId = "backups-daily"
	// defaultBackupKeep 缺省保留最近 7 份;<=0 = 不限(只增不删)。
	defaultBackupKeep = 7
)

// registerDailyBackup registers the nightly backup cron.
func (m *Manager) registerDailyBackup() {
	m.app.Cron().MustAdd(backupCronId, "0 3 * * *", func() {
		m.runDailyBackup()
	})
}

// runDailyBackup creates one backup and prunes beyond backupKeep. Failure
// writes a result=failure audits row(与失效链同一哲学:后台安全网失灵
// 必须可感知),绝不 panic cron。
func (m *Manager) runDailyBackup() {
	if backupConflict(m.app) {
		slog.Warn("[backups] daily backup skipped: another backup/restore running")
		return
	}
	name := newBackupName(time.Now())
	ctx, cancel := context.WithTimeout(context.Background(), backupOperationTimeout)
	defer cancel()
	if err := m.app.CreateBackup(ctx, name); err != nil {
		slog.Error("[backups] daily backup failed", "name", name, "err", err)
		audit.OpsFailed(m.app, "backup.failure", name, map[string]any{"reason": err.Error()})
		return
	}
	slog.Info("[backups] daily backup created", "name", name)
	if keep := m.backupKeep(); keep > 0 {
		m.pruneOldBackups(ctx, keep)
	}
}

// backupKeep reads site.displayOptions.backupKeep. Absent/unreadable →
// defaultBackupKeep;<=0 → 0(= 不限,不裁剪)。
func (m *Manager) backupKeep() int {
	rec, err := m.app.FindFirstRecordByFilter("site", "")
	if err != nil {
		return defaultBackupKeep
	}
	var opts map[string]any
	if raw := rec.GetString("displayOptions"); raw != "" {
		if err := json.Unmarshal([]byte(raw), &opts); err != nil {
			return defaultBackupKeep
		}
	}
	if v, ok := opts["backupKeep"].(float64); ok {
		if int(v) <= 0 {
			return 0 // unlimited
		}
		return int(v)
	}
	return defaultBackupKeep
}

// pruneOldBackups deletes oldest vanblog_backup_* beyond keep. 只裁剪本仓
// 命名前缀的备份——PB 原生/外部工具创建的其他命名不受影响。
func (m *Manager) pruneOldBackups(ctx context.Context, keep int) {
	fsys, err := openBackupsFilesystem(m.app, ctx)
	if err != nil {
		slog.Error("[backups] prune: open filesystem failed", "err", err)
		return
	}
	defer fsys.Close()
	files, err := fsys.List("")
	if err != nil {
		slog.Error("[backups] prune: list failed", "err", err)
		return
	}
	ours := make([]*blob.ListObject, 0, len(files))
	for _, f := range files {
		if !f.IsDir && strings.HasPrefix(f.Key, backupNamePrefix) {
			ours = append(ours, f)
		}
	}
	slices.SortFunc(ours, func(a, b *blob.ListObject) int { return b.ModTime.Compare(a.ModTime) })
	for i := keep; i < len(ours); i++ {
		if err := fsys.Delete(ours[i].Key); err != nil {
			slog.Error("[backups] prune: delete failed", "key", ours[i].Key, "err", err)
			continue
		}
		slog.Info("[backups] pruned old backup", "key", ours[i].Key)
	}
}

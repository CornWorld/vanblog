// Daily scheduled backups with config-driven retention.
//
// 缺口背景:备份此前只有手动端点(handleCreateBackup)与升级前自动备份,
// 无定时、无保留清理——健忘的博主永远没有备份,磁盘却会无限累积。
// 归位:备份本体是数据安全 → Go cron;保留份数是偏好 → site 配置。
package admin

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"slices"
	"strings"
	"time"

	"github.com/cornworld/vanblog/internal/audit"
	"github.com/cornworld/vanblog/internal/site"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/filesystem/blob"
)

const (
	// backupCronId 每日备份任务;03:00,与 04:00 自愈、00:00 访问聚合错峰。
	backupCronId = "backups-daily"
	// defaultBackupKeep 缺省保留最近 7 份;<=0 = 不限(只增不删)。
	defaultBackupKeep = 7
	// backupPruneTimeout 裁剪的独立预算:prune 不复用 CreateBackup 的
	// context——S3 类后端上备份吃满 10 分钟不应把当天的裁剪一起拖死。
	backupPruneTimeout = 5 * time.Minute
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
		if err := m.pruneOldBackups(keep); err != nil {
			slog.Error("[backups] prune failed", "err", err)
			// 裁剪失灵必须可感知(与 backup.failure 同一哲学):只 slog
			// 的话,备份目录静默膨胀在审计链里不可见。
			audit.OpsFailed(m.app, "backup.prune", "", map[string]any{"reason": err.Error()})
		}
	}
}

// backupKeep reads site.displayOptions.backupKeep via the site helper.
//   - 未配置 → defaultBackupKeep;
//   - <=0 → 0(= 不限,不裁剪);
//   - 站点记录/displayOptions 读失败 → 0(跳过裁剪)。
//
// 读失败不做 default fallback:那是数据丢失方向的 fail-open——管理员
// 配了保留 30,一次暂时性读失败就把保留裁到 7。宁可只增不删。
func (m *Manager) backupKeep() int {
	v, err := site.DisplayNumber(m.app, "backupKeep")
	switch {
	case errors.Is(err, site.ErrDisplayOptionAbsent):
		v = defaultBackupKeep
	case err != nil:
		slog.Warn("[backups] retention config unreadable, skipping prune", "err", err)
		return 0
	}
	if int(v) <= 0 {
		return 0 // unlimited
	}
	return int(v)
}

// pruneOldBackups deletes oldest vanblog_backup_* beyond keep. 只裁剪本仓
// 命名前缀的备份——PB 原生/外部工具创建的其他命名不受影响。注意:手动
// 端点(handleCreateBackup)创建的快照同名前缀,同样参与保留裁剪——
// 「升级前手动快照」不在裁剪豁免之列,要长期保留请调大 backupKeep 或
// 下载后另行归档(docs/guide/backup-upgrade.md)。
//
// 返回聚合错误(打开存储/列举/逐个删除),由调用方写审计——裁剪失败
// 只 slog 会在审计链里不可见。 Restore 正在读的备份(core.StoreKeyActiveBackup)
// 一律跳过,且**每次删除前实时读 Store**:快照式(列举后读一次)只覆盖
// 「裁剪前已设置的 restore」,裁剪列举后才开始的目标仍会被删(竞态窗
// = 整个裁剪时长,S3 类后端可达分钟级)。check 与 delete 之间的残余
// TOCTOU 微窗不另加锁——与 handleDeleteBackup 的在用守卫同水位。
// 保留线内(下标 < keep)本就不删,在用跳过只对保留线外的候选生效。
func (m *Manager) pruneOldBackups(keep int) error {
	ctx, cancel := context.WithTimeout(context.Background(), backupPruneTimeout)
	defer cancel()
	fsys, err := openBackupsFilesystem(m.app, ctx)
	if err != nil {
		return fmt.Errorf("open filesystem: %w", err)
	}
	defer fsys.Close()
	files, err := fsys.List("")
	if err != nil {
		return fmt.Errorf("list: %w", err)
	}
	ours := make([]*blob.ListObject, 0, len(files))
	for _, f := range files {
		if !f.IsDir && strings.HasPrefix(f.Key, backupNamePrefix) {
			ours = append(ours, f)
		}
	}
	slices.SortFunc(ours, func(a, b *blob.ListObject) int { return b.ModTime.Compare(a.ModTime) })
	var delErrs []error
	for i := keep; i < len(ours); i++ {
		if active, _ := m.app.Store().Get(core.StoreKeyActiveBackup).(string); ours[i].Key == active {
			slog.Info("[backups] prune: skipping in-use backup", "key", ours[i].Key)
			continue
		}
		if err := fsys.Delete(ours[i].Key); err != nil {
			slog.Error("[backups] prune: delete failed", "key", ours[i].Key, "err", err)
			delErrs = append(delErrs, fmt.Errorf("%s: %w", ours[i].Key, err))
			continue
		}
		slog.Info("[backups] pruned old backup", "key", ours[i].Key)
	}
	return errors.Join(delErrs...)
}

package admin

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"path/filepath"
	"slices"
	"strings"
	"time"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/filesystem"
)

const (
	backupListTimeout      = 30 * time.Second
	backupDownloadTimeout  = 10 * time.Minute
	backupOperationTimeout = 10 * time.Minute
)

type backupFileInfo struct {
	Key      string    `json:"key"`
	Size     int64     `json:"size"`
	Modified time.Time `json:"modified"`
}

func validateBackupKey(key string) error {
	if key == "" || filepath.Base(key) != key || !strings.EqualFold(filepath.Ext(key), ".zip") {
		return fmt.Errorf("invalid backup key")
	}
	return nil
}

func newBackupName(now time.Time) string {
	return "vanblog_backup_" + now.UTC().Format("20060102_150405.000000000") + ".zip"
}

func backupConflict(app core.App) bool {
	return app.Store().Has(core.StoreKeyActiveBackup)
}

func openBackupsFilesystem(app core.App, ctx context.Context) (*filesystem.System, error) {
	fsys, err := app.NewBackupsFilesystem()
	if err != nil {
		return nil, err
	}
	fsys.SetContext(ctx)
	return fsys, nil
}

func ensureBackupExists(fsys *filesystem.System, key string) error {
	exists, err := fsys.Exists(key)
	if err != nil {
		return err
	}
	if !exists {
		return filesystem.ErrNotFound
	}
	return nil
}

func (m *Manager) requireBackupAdmin(e *core.RequestEvent) error {
	if !requireAdmin(e.Auth) {
		return e.ForbiddenError("admin role required", "")
	}
	return nil
}

func (m *Manager) handleListBackups(e *core.RequestEvent) error {
	if err := m.requireBackupAdmin(e); err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(e.Request.Context(), backupListTimeout)
	defer cancel()
	fsys, err := openBackupsFilesystem(m.app, ctx)
	if err != nil {
		slog.Error("[backups] initialize filesystem", "err", err)
		return e.InternalServerError("failed to load backup storage", nil)
	}
	defer fsys.Close()

	files, err := fsys.List("")
	if err != nil {
		slog.Error("[backups] list", "err", err)
		return e.InternalServerError("failed to list backups", nil)
	}

	result := make([]backupFileInfo, 0, len(files))
	for _, file := range files {
		if file.IsDir || validateBackupKey(file.Key) != nil {
			continue
		}
		result = append(result, backupFileInfo{Key: file.Key, Size: file.Size, Modified: file.ModTime.UTC()})
	}
	slices.SortFunc(result, func(a, b backupFileInfo) int { return b.Modified.Compare(a.Modified) })
	return e.JSON(http.StatusOK, result)
}

func (m *Manager) handleCreateBackup(e *core.RequestEvent) error {
	if err := m.requireBackupAdmin(e); err != nil {
		return err
	}
	if backupConflict(m.app) {
		return e.JSON(http.StatusConflict, map[string]string{"error": "another backup or restore operation is already running"})
	}

	name := newBackupName(time.Now())
	ctx, cancel := context.WithTimeout(e.Request.Context(), backupOperationTimeout)
	defer cancel()
	if err := m.app.CreateBackup(ctx, name); err != nil {
		slog.Error("[backups] create", "name", name, "err", err)
		if backupConflict(m.app) || strings.Contains(err.Error(), "another backup/restore") {
			return e.JSON(http.StatusConflict, map[string]string{"error": "another backup or restore operation is already running"})
		}
		return e.InternalServerError("failed to create backup", nil)
	}
	return e.JSON(http.StatusCreated, map[string]string{"key": name})
}

func (m *Manager) handleDownloadBackup(e *core.RequestEvent) error {
	// Normal API calls use the Authorization header. Browser navigation cannot
	// set it, so downloads may alternatively use PB's short-lived file token.
	if !requireAdmin(e.Auth) {
		token := e.Request.URL.Query().Get("token")
		auth, err := m.app.FindAuthRecordByToken(token, core.TokenTypeFile)
		if err != nil || !requireAdmin(auth) {
			return e.ForbiddenError("admin role required", "")
		}
	}
	key := e.Request.PathValue("key")
	if validateBackupKey(key) != nil {
		return e.BadRequestError("invalid backup key", "")
	}

	ctx, cancel := context.WithTimeout(e.Request.Context(), backupDownloadTimeout)
	defer cancel()
	fsys, err := openBackupsFilesystem(m.app, ctx)
	if err != nil {
		slog.Error("[backups] initialize download filesystem", "err", err)
		return e.InternalServerError("failed to load backup storage", nil)
	}
	defer fsys.Close()
	if err := ensureBackupExists(fsys, key); err != nil {
		return e.NotFoundError("backup not found", "")
	}

	// filesystem.Serve supports local and S3 storage, range requests and streaming.
	return fsys.Serve(e.Response, e.Request, key, filepath.Base(key))
}

func (m *Manager) handleDeleteBackup(e *core.RequestEvent) error {
	if err := m.requireBackupAdmin(e); err != nil {
		return err
	}
	key := e.Request.PathValue("key")
	if validateBackupKey(key) != nil {
		return e.BadRequestError("invalid backup key", "")
	}
	if active, ok := m.app.Store().Get(core.StoreKeyActiveBackup).(string); ok && active == key {
		return e.JSON(http.StatusConflict, map[string]string{"error": "backup is currently in use"})
	}

	ctx, cancel := context.WithTimeout(e.Request.Context(), backupListTimeout)
	defer cancel()
	fsys, err := openBackupsFilesystem(m.app, ctx)
	if err != nil {
		slog.Error("[backups] initialize delete filesystem", "err", err)
		return e.InternalServerError("failed to load backup storage", nil)
	}
	defer fsys.Close()
	if err := ensureBackupExists(fsys, key); err != nil {
		return e.NotFoundError("backup not found", "")
	}
	if err := fsys.Delete(key); err != nil {
		slog.Error("[backups] delete", "key", key, "err", err)
		return e.InternalServerError("failed to delete backup", nil)
	}
	return e.NoContent(http.StatusNoContent)
}

func (m *Manager) handleRestoreBackup(e *core.RequestEvent) error {
	if err := m.requireBackupAdmin(e); err != nil {
		return err
	}
	key := e.Request.PathValue("key")
	if validateBackupKey(key) != nil {
		return e.BadRequestError("invalid backup key", "")
	}
	if backupConflict(m.app) {
		return e.JSON(http.StatusConflict, map[string]string{"error": "another backup or restore operation is already running"})
	}

	ctx, cancel := context.WithTimeout(e.Request.Context(), backupListTimeout)
	defer cancel()
	fsys, err := openBackupsFilesystem(m.app, ctx)
	if err != nil {
		slog.Error("[backups] initialize restore filesystem", "err", err)
		return e.InternalServerError("failed to load backup storage", nil)
	}
	defer fsys.Close()
	if err := ensureBackupExists(fsys, key); err != nil {
		return e.NotFoundError("backup not found", "")
	}

	// Return before RestoreBackup replaces the process. This mirrors PB's native API.
	go func() {
		defer func() {
			if r := recover(); r != nil {
				slog.Error("[backups] restore panicked", "key", key, "panic", r)
			}
		}()
		time.Sleep(time.Second)
		ctx, cancel := context.WithTimeout(context.Background(), backupOperationTimeout)
		defer cancel()
		if err := m.app.RestoreBackup(ctx, key); err != nil {
			slog.Error("[backups] restore failed", "key", key, "err", err)
		}
	}()
	return e.JSON(http.StatusAccepted, map[string]any{"accepted": true, "key": key})
}

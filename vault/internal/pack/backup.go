package pack

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
)

// BackupBeforePendingMigrations creates a pre-migration backup if any
// registered app migration (Go core or Pack JS) has not yet been applied.
// It is intended to be bound to OnBootstrap after e.Next() so the data DB is
// initialized before we inspect _migrations.
//
// This is best-effort safety: PocketBase's migration runner is already
// transactional, so a failed migration rolls back; the backup is an additional
// disaster-recovery snapshot captured before the first schema change.
func BackupBeforePendingMigrations(app core.App) {
	pending, err := hasPendingAppMigrations(app)
	if err != nil {
		slog.Warn("[pack] skip pre-migration backup: cannot inspect pending migrations", "err", err)
		return
	}
	if !pending {
		return
	}

	name := "pre-migrate-" + time.Now().UTC().Format("20060102T150405Z")
	if err := app.CreateBackup(context.Background(), name); err != nil {
		slog.Warn("[pack] pre-migration backup failed; continuing without snapshot", "err", err)
		return
	}
	slog.Info("[pack] created pre-migration backup", "backup", name)
}

// hasPendingAppMigrations reports whether any entry in core.AppMigrations is
// missing from the shared _migrations tracking table (i.e. will run on the
// next RunAllMigrations call).
func hasPendingAppMigrations(app core.App) (bool, error) {
	for _, m := range core.AppMigrations.Items() {
		var exists int
		err := app.DB().
			Select("(1)").
			From(core.DefaultMigrationsTable).
			Where(dbx.HashExp{"file": m.File}).
			Limit(1).
			Row(&exists)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return true, nil // pending (not yet applied)
			}
			return false, fmt.Errorf("check migration %q: %w", m.File, err)
		}
		if exists == 0 {
			return true, nil
		}
	}
	return false, nil
}

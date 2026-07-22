package pack

import (
	"fmt"
	"io/fs"
	"regexp"
	"sort"
	"strings"
)

const (
	BackupStrategyPocketBase = "pocketbase-create-backup-before-migration"
	BackupScopePocketBase    = "data.db, auxiliary.db, storage, pb_hooks, pb_migrations, pb_data.json"
)

var migrationIDPattern = regexp.MustCompile(`(^|/)([0-9]{3,})[^/]*$`)

// Plan is a read-only deployment preflight for a resolved Pack. It does not
// activate code, run migrations, or modify PocketBase data.
type Plan struct {
	Name            string
	Version         string
	Source          Source
	SourceHash      string
	Freshness       string
	Artifact        string
	MigrationFiles  []string
	MigrationIDs    []string
	MigrationTarget string
	BackupRequired  bool
	BackupStrategy  string
	BackupScope     string
	State           string
	Reason          string
}

// Plans derives deployment diagnostics for resolved Packs without booting the
// application or executing any Pack lifecycle operation.
func Plans(packs []Pack) ([]Plan, error) {
	plans := make([]Plan, 0, len(packs))
	for _, item := range packs {
		if err := Validate(item); err != nil {
			return nil, err
		}
		hash, err := Fingerprint(item)
		if err != nil {
			return nil, fmt.Errorf("fingerprint pack %q: %w", item.Name, err)
		}
		freshness, freshnessErr := ArtifactFreshness(item)
		if freshnessErr != nil {
			freshness = "invalid"
		}
		migrations, migrationIDs, migrationTarget, migrationErr := migrationFiles(item.FS)
		if migrationErr != nil {
			return nil, fmt.Errorf("inspect migrations for pack %q: %w", item.Name, migrationErr)
		}
		state := "ready"
		reason := "source and artifact can be reviewed for deployment"
		if !HasSchemaArtifact(item) && hasSchemaSource(item) {
			state = "needs-build"
			reason = "schema.ts exists but schema.js is missing; run vanblog pack build"
		} else if freshness == "stale" || freshness == "unknown" || freshness == "invalid" {
			state = "needs-rebuild"
			reason = "schema artifact freshness is " + freshness
		}
		backupRequired := len(migrations) > 0
		backupStrategy, backupScope := "none", ""
		if backupRequired {
			backupStrategy = BackupStrategyPocketBase
			backupScope = BackupScopePocketBase
		}
		plans = append(plans, Plan{
			Name: item.Name, Version: item.Version, Source: item.Source,
			SourceHash: hash, Freshness: freshness, Artifact: artifactState(item),
			MigrationFiles: migrations, MigrationIDs: migrationIDs, MigrationTarget: migrationTarget,
			BackupRequired: backupRequired, BackupStrategy: backupStrategy, BackupScope: backupScope,
			State: state, Reason: reason,
		})
	}
	return plans, nil
}

func artifactState(p Pack) string {
	if HasSchemaArtifact(p) {
		return "schema.js"
	}
	return "none"
}

func hasSchemaSource(p Pack) bool {
	_, err := fs.Stat(p.FS, "schema.ts")
	return err == nil
}

func migrationFiles(filesystem fs.FS) ([]string, []string, string, error) {
	var files []string
	err := fs.WalkDir(filesystem, ".", func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() || path == "." {
			return nil
		}
		if strings.HasPrefix(path, "migrations/") || strings.HasPrefix(path, "migration/") {
			files = append(files, path)
		}
		return nil
	})
	if err != nil {
		return nil, nil, "", err
	}
	sort.Strings(files)
	ids := make([]string, 0, len(files))
	seen := make(map[string]struct{}, len(files))
	for _, path := range files {
		match := migrationIDPattern.FindStringSubmatch(path)
		if len(match) == 0 {
			return nil, nil, "", fmt.Errorf("migration file %q has no numeric id", path)
		}
		id := match[2]
		if _, exists := seen[id]; exists {
			return nil, nil, "", fmt.Errorf("duplicate migration id %s", id)
		}
		seen[id] = struct{}{}
		ids = append(ids, id)
	}
	target := ""
	if len(ids) > 0 {
		target = ids[len(ids)-1]
	}
	return files, ids, target, nil
}

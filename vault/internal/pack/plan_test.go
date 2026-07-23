package pack

import (
	"testing"
	"testing/fstest"
)

func TestPlansDescribeBuildAndMigrationState(t *testing.T) {
	plans, err := Plans([]Pack{{Name: "demo", Version: "1.0.0", Source: Local, FS: fstest.MapFS{
		"pack.json":         {Data: []byte(`{"name":"demo","version":"1.0.0"}`)},
		"schema.ts":         {Data: []byte("export const models = {}")},
		"migrations/001.js": {Data: []byte("export default {}")},
	}}})
	if err != nil {
		t.Fatal(err)
	}
	if len(plans) != 1 || plans[0].State != "needs-build" || len(plans[0].MigrationFiles) != 1 || plans[0].MigrationTarget != "001" || !plans[0].BackupRequired || plans[0].BackupStrategy != BackupStrategyPocketBase || plans[0].BackupScope != BackupScopePocketBase {
		t.Fatalf("unexpected plan: %+v", plans)
	}
}

func TestPlansDoNotRequireRuntimeLoadability(t *testing.T) {
	plans, err := Plans([]Pack{{Name: "plain", Version: "1.0.0", Source: Local, FS: fstest.MapFS{
		"pack.json": {Data: []byte(`{"name":"plain","version":"1.0.0"}`)},
	}}})
	if err != nil {
		t.Fatal(err)
	}
	if len(plans) != 1 || plans[0].State != "ready" || plans[0].BackupRequired || plans[0].BackupStrategy != "none" || plans[0].BackupScope != "" {
		t.Fatalf("unexpected plan: %+v", plans)
	}
}

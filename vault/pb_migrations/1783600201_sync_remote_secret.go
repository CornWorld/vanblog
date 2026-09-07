package migrations

import (
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(db core.App) error {
		// syncRemote (a git remote URL) can carry embedded credentials
		// (https://user:token@host/repo), so it belongs in the admin-only
		// site_secrets row next to syncConfig — not on the publicly
		// readable site row. Adds the column, moves any existing value,
		// nulls the site field. MoveSecretsFromRecord/HealSecrets
		// (internal/site) keep it off the public row from now on.
		sec, err := db.FindCollectionByNameOrId("site_secrets")
		if err != nil {
			return err // 1783600100 guarantees the collection exists
		}
		if sec.Fields.GetByName("syncRemote") == nil {
			sec.Fields.Add(&core.TextField{Name: "syncRemote"})
			if err := db.Save(sec); err != nil {
				return err
			}
		}
		siteRec, err := db.FindFirstRecordByFilter("site", "")
		if err != nil || siteRec == nil {
			return nil // no site row yet (fresh install before setup)
		}
		v := siteRec.GetString("syncRemote")
		if v == "" {
			return nil
		}
		secrets, serr := db.FindFirstRecordByFilter("site_secrets", "key={:k}", dbx.Params{"k": "main"})
		if serr != nil || secrets == nil {
			secrets = core.NewRecord(sec)
			secrets.Set("key", "main")
		}
		secrets.Set("syncRemote", v)
		if err := db.Save(secrets); err != nil {
			return err
		}
		siteRec.Set("syncRemote", "")
		return db.Save(siteRec)
	}, func(db core.App) error {
		// Forward-only. To revert, write a new migration restoring prior rules.
		return nil
	})
}

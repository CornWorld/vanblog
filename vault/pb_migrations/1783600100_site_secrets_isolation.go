package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(db core.App) error {
		// --- 1. site_secrets: admin-only storage for credential-bearing config ---
		//
		// Root cause fix for "site collection publicly readable while holding
		// s3Config (AK/SK) and syncConfig (sshKey)". `site` must stay public
		// (themes render nav/links/about from it), so secret material moves
		// into its own collection with admin-only rules. The site migration
		// below nulls the old fields; media hooks (see vault/internal/media)
		// strip any payload that tries to write them back.
		_, err := db.FindCollectionByNameOrId("site_secrets")
		if err != nil {
			secretsCol := core.NewCollection(core.CollectionTypeBase, "site_secrets")
			secretsCol.Fields.Add(&core.TextField{Name: "key", Required: true})
			secretsCol.Fields.Add(&core.JSONField{Name: "s3Config"})
			secretsCol.Fields.Add(&core.JSONField{Name: "syncConfig"})
			secretsCol.Fields.Add(&core.JSONField{Name: "outputConfig"})
			secretsCol.Fields.Add(&core.AutodateField{Name: "created", OnCreate: true})
			secretsCol.Fields.Add(&core.AutodateField{Name: "updated", OnUpdate: true})
			adminOnly := `@request.auth.role = "admin"`
			secretsCol.ListRule = new(adminOnly)
			secretsCol.ViewRule = new(adminOnly)
			secretsCol.CreateRule = new(adminOnly)
			secretsCol.UpdateRule = new(adminOnly)
			secretsCol.DeleteRule = new(adminOnly)
			if err := db.Save(secretsCol); err != nil {
				return err
			}
		}

		// --- 2. Move any leftover secret values out of the public site row ---
		// Forward-only copy: read site.s3Config/syncConfig/outputConfig and
		// write them under key "main" in site_secrets, then null the site
		// fields. Idempotent: if the site row is already clean this is a
		// no-op. A runtime self-heal hook (internal/media/s3_sync.go) closes
		// the gap for restores of old backups.
		site, err := db.FindFirstRecordByFilter("site", "")
		if err == nil && site != nil {
			_, serr := db.FindFirstRecordByFilter("site_secrets", "key={:k}", map[string]any{"k": "main"})
			if serr != nil {
				secretsCol, cerr := db.FindCollectionByNameOrId("site_secrets")
				if cerr != nil {
					return cerr
				}
				newRec := core.NewRecord(secretsCol)
				newRec.Set("key", "main")
				for _, f := range []string{"s3Config", "syncConfig", "outputConfig"} {
					raw := site.GetString(f)
					if raw != "" && raw != "null" {
						newRec.Set(f, raw)
					}
				}
				if err := db.Save(newRec); err != nil {
					return err
				}
			}
			changed := false
			for _, f := range []string{"s3Config", "syncConfig", "outputConfig"} {
				if site.GetString(f) != "" && site.GetString(f) != "null" {
					site.Set(f, nil)
					changed = true
				}
			}
			if changed {
				if err := db.Save(site); err != nil {
					return err
				}
			}
		}

		// --- 3. visits: block anonymous creation (was CreateRule = nil = public) ---
		// Public page counters go through POST /api/vanblog/visits/record (a
		// Go handler with its own abuse checks); the generic REST create was
		// an unbounded write + viewCount pump.
		visitsCol, err := db.FindCollectionByNameOrId("visits")
		if err != nil {
			return err
		}
		visitsCol.CreateRule = new(`@request.auth.role = "admin"`)
		if err := db.Save(visitsCol); err != nil {
			return err
		}

		// --- 4. site.copyrightAggreement → copyrightAgreement (typo fix) ---
		// The frontend (admin site form + base layout + SDK model) all use the
		// single-g spelling; the collection field had a double "g". Rename the
		// field so data and code line up — the reason admin-saved copyright
		// text never made it to the footer.
		siteCol, err := db.FindCollectionByNameOrId("site")
		if err != nil {
			return err
		}
		if f := siteCol.Fields.GetByName("copyrightAggreement"); f != nil {
			f.SetName("copyrightAgreement")
			if err := db.Save(siteCol); err != nil {
				return err
			}
		}

		return nil
	}, func(db core.App) error {
		// Forward-only. To revert, write a new migration restoring prior rules.
		return nil
	})
}

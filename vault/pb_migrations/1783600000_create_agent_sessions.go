package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(db core.App) error {
		users, err := db.FindCollectionByNameOrId("users")
		if err != nil {
			return err
		}

		col := core.NewCollection(core.CollectionTypeBase, "agent_sessions")
		col.Fields.Add(&core.RelationField{Name: "owner", CollectionId: users.Id, MaxSelect: 1, Required: true})
		col.Fields.Add(&core.SelectField{Name: "status", Values: []string{"active", "idle", "error", "expired"}})
		col.Fields.Add(&core.TextField{Name: "sessionDir", Required: true})
		col.Fields.Add(&core.NumberField{Name: "processId"})
		col.Fields.Add(&core.DateField{Name: "lastActivityAt"})
		col.Fields.Add(&core.DateField{Name: "expiresAt"})
		col.Fields.Add(&core.AutodateField{Name: "created", OnCreate: true})
		col.Fields.Add(&core.AutodateField{Name: "updated", OnUpdate: true})
		return db.Save(col)
	}, func(db core.App) error {
		col, err := db.FindCollectionByNameOrId("agent_sessions")
		if err != nil {
			return err
		}
		return db.Delete(col)
	})
}

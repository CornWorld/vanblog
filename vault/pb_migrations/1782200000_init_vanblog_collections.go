package migrations

import (
	"encoding/json"
	"log"

	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(db core.App) error {
		if err := createTags(db); err != nil {
			return err
		}
		if err := createCategories(db); err != nil {
			return err
		}
		if err := createUsers(db); err != nil {
			return err
		}
		if err := createPosts(db); err != nil {
			return err
		}
		if err := createRevisions(db); err != nil {
			return err
		}
		if err := createMedia(db); err != nil {
			return err
		}
		if err := createSite(db); err != nil {
			return err
		}
		if err := createVisits(db); err != nil {
			return err
		}
		if err := createAudits(db); err != nil {
			return err
		}
		if err := createTokens(db); err != nil {
			return err
		}
		return insertDefaultSite(db)
	}, func(db core.App) error {
		names := []string{"tokens", "audits", "visits", "site", "media",
			"revisions", "posts", "users", "categories", "tags"}
		for _, name := range names {
			col, err := db.FindCollectionByNameOrId(name)
			if err != nil {
				continue
			}
			if err := db.Delete(col); err != nil {
				log.Printf("failed to delete collection %s: %v", name, err)
			}
		}
		return nil
	})
}

func strPtr(s string) *string { return &s }

func createTags(db core.App) error {
	col := core.NewCollection(core.CollectionTypeBase, "tags")
	col.Fields.Add(&core.TextField{Name: "name", Required: true})
	col.Fields.Add(&core.TextField{Name: "slug"})
	col.Fields.Add(&core.TextField{Name: "description"})
	col.Fields.Add(&core.TextField{Name: "oldName"})
	col.ListRule = strPtr("")
	col.ViewRule = strPtr("")
	return db.Save(col)
}

func createCategories(db core.App) error {
	col := core.NewCollection(core.CollectionTypeBase, "categories")
	col.Fields.Add(&core.TextField{Name: "name", Required: true})
	col.Fields.Add(&core.SelectField{Name: "type", Values: []string{"category", "column"}})
	col.Fields.Add(&core.BoolField{Name: "private"})
	col.Fields.Add(&core.TextField{Name: "password"})
	col.Fields.Add(&core.JSONField{Name: "meta"})
	col.Fields.Add(&core.NumberField{Name: "oldId"})
	col.ListRule = strPtr("")
	col.ViewRule = strPtr("")
	return db.Save(col)
}

func createUsers(db core.App) error {
	// pb 0.39 creates a default empty 'users' collection on bootstrap.
	// We need to update it in place rather than create a new one.
	col, err := db.FindCollectionByNameOrId("users")
	if err != nil {
		// If it doesn't exist for some reason, create it
		col = core.NewCollection(core.CollectionTypeAuth, "users")
	}
	col.Fields.Add(&core.TextField{Name: "username", Required: true})
	col.Fields.Add(&core.TextField{Name: "nickname"})
	col.Fields.Add(&core.SelectField{Name: "role", Values: []string{"admin", "collaborator"}})
	col.Fields.Add(&core.SelectField{
		Name:      "permissions",
		MaxSelect: 9,
		Values: []string{
			"article:create", "article:delete", "article:update",
			"draft:publish", "draft:create", "draft:delete", "draft:update",
			"img:delete", "all",
		},
	})
	col.Fields.Add(&core.NumberField{Name: "oldId"})
	col.Indexes = []string{
		"CREATE UNIQUE INDEX `idx_users_username` ON `users` (`username`)",
	}
	col.PasswordAuth.IdentityFields = []string{"email", "username"}
	col.ListRule = strPtr(`@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.id = id)`)
	col.ViewRule = strPtr(`@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.id = id)`)
	col.CreateRule = strPtr(`@request.auth.role = "admin"`)
	col.UpdateRule = strPtr(`@request.auth.role = "admin"`)
	col.DeleteRule = strPtr(`@request.auth.role = "admin"`)
	return db.Save(col)
}

func createPosts(db core.App) error {
	tagsCol, err := db.FindCollectionByNameOrId("tags")
	if err != nil {
		return err
	}
	catsCol, err := db.FindCollectionByNameOrId("categories")
	if err != nil {
		return err
	}
	usersCol, err := db.FindCollectionByNameOrId("users")
	if err != nil {
		return err
	}
	col := core.NewCollection(core.CollectionTypeBase, "posts")
	col.Fields.Add(&core.TextField{Name: "title", Required: true})
	col.Fields.Add(&core.TextField{Name: "content"})
	col.Fields.Add(&core.SelectField{Name: "status", Values: []string{"draft", "published", "hidden"}})
	col.Fields.Add(&core.NumberField{Name: "oldId"})
	col.Fields.Add(&core.RelationField{Name: "tags", CollectionId: tagsCol.Id, MaxSelect: 100})
	col.Fields.Add(&core.RelationField{Name: "category", CollectionId: catsCol.Id, MaxSelect: 1})
	col.Fields.Add(&core.RelationField{Name: "author", CollectionId: usersCol.Id, MaxSelect: 1})
	col.Fields.Add(&core.TextField{Name: "pathname"})
	col.Fields.Add(&core.NumberField{Name: "top"})
	col.Fields.Add(&core.BoolField{Name: "private"})
	col.Fields.Add(&core.TextField{Name: "password"})
	col.Fields.Add(&core.TextField{Name: "copyright"})
	col.Fields.Add(&core.NumberField{Name: "viewCount"})
	col.Fields.Add(&core.NumberField{Name: "visitedCount"})
	col.Fields.Add(&core.DateField{Name: "lastVisitedAt"})
	col.Fields.Add(&core.BoolField{Name: "deleted"})
	col.ListRule = strPtr(`status = "published" && private = false || @request.auth.id != ""`)
	col.ViewRule = strPtr(`status = "published" && private = false || @request.auth.id != ""`)
	col.CreateRule = strPtr(`@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.permissions ?~ "article:")`)
	col.UpdateRule = strPtr(`@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.permissions ?~ "article:")`)
	col.DeleteRule = strPtr(`@request.auth.id != "" && (@request.auth.role = "admin" || @request.auth.permissions ?~ "article:")`)
	return db.Save(col)
}

func createRevisions(db core.App) error {
	postsCol, err := db.FindCollectionByNameOrId("posts")
	if err != nil {
		return err
	}
	usersCol, err := db.FindCollectionByNameOrId("users")
	if err != nil {
		return err
	}
	col := core.NewCollection(core.CollectionTypeBase, "revisions")
	col.Fields.Add(&core.RelationField{Name: "target", CollectionId: postsCol.Id, MaxSelect: 1, Required: true})
	col.Fields.Add(&core.JSONField{Name: "snapshot"})
	col.Fields.Add(&core.TextField{Name: "diff"})
	col.Fields.Add(&core.RelationField{Name: "authoredBy", CollectionId: usersCol.Id, MaxSelect: 1})
	col.Fields.Add(&core.TextField{Name: "reason"})
	col.ListRule = strPtr(`@request.auth.id != ""`)
	col.ViewRule = strPtr(`@request.auth.id != ""`)
	col.DeleteRule = strPtr(`@request.auth.role = "admin"`)
	return db.Save(col)
}

func createMedia(db core.App) error {
	col := core.NewCollection(core.CollectionTypeBase, "media")
	col.Fields.Add(&core.FileField{Name: "file", MaxSelect: 1})
	col.Fields.Add(&core.SelectField{Name: "staticType", Values: []string{"img", "favicon", "attachment"}})
	col.Fields.Add(&core.SelectField{Name: "storageType", Values: []string{"local", "s3"}})
	col.Fields.Add(&core.TextField{Name: "fileType"})
	col.Fields.Add(&core.TextField{Name: "sign"})
	col.Fields.Add(&core.JSONField{Name: "meta"})
	col.Fields.Add(&core.TextField{Name: "externalUrl"})
	col.Fields.Add(&core.TextField{Name: "oldId"})
	col.ListRule = strPtr(`staticType = "img" || @request.auth.id != ""`)
	col.ViewRule = strPtr(`staticType = "img" || @request.auth.id != ""`)
	col.CreateRule = strPtr(`@request.auth.id != ""`)
	col.UpdateRule = strPtr(`@request.auth.id != ""`)
	col.DeleteRule = strPtr(`@request.auth.id != ""`)
	return db.Save(col)
}

func createSite(db core.App) error {
	col := core.NewCollection(core.CollectionTypeBase, "site")
	col.Fields.Add(&core.JSONField{Name: "info"})
	col.Fields.Add(&core.SelectField{Name: "theme", Values: []string{"default", "minimal", "magazine", "custom"}})
	col.Fields.Add(&core.SelectField{Name: "commentsProvider", Values: []string{"disabled", "waline", "giscus", "artalk", "external"}})
	col.Fields.Add(&core.JSONField{Name: "commentsConfig"})
	col.Fields.Add(&core.TextField{Name: "analyticsScript"})
	col.Fields.Add(&core.JSONField{Name: "nav"})
	col.Fields.Add(&core.JSONField{Name: "links"})
	col.Fields.Add(&core.JSONField{Name: "socials"})
	col.Fields.Add(&core.JSONField{Name: "rewards"})
	col.Fields.Add(&core.JSONField{Name: "about"})
	col.Fields.Add(&core.JSONField{Name: "customize"})
	col.Fields.Add(&core.JSONField{Name: "imageConfig"})
	col.Fields.Add(&core.JSONField{Name: "routing"})
	col.Fields.Add(&core.JSONField{Name: "allowedDomains"})
	col.Fields.Add(&core.JSONField{Name: "revisions"})
	col.Fields.Add(&core.JSONField{Name: "output"})
	col.Fields.Add(&core.JSONField{Name: "sync"})
	col.ListRule = strPtr("")
	col.ViewRule = strPtr("")
	col.CreateRule = strPtr(`@request.auth.id != ""`)
	col.UpdateRule = strPtr(`@request.auth.id != ""`)
	col.DeleteRule = strPtr(`@request.auth.role = "admin"`)
	return db.Save(col)
}

func createVisits(db core.App) error {
	postsCol, err := db.FindCollectionByNameOrId("posts")
	if err != nil {
		return err
	}
	col := core.NewCollection(core.CollectionTypeBase, "visits")
	col.Fields.Add(&core.TextField{Name: "date", Required: true})
	col.Fields.Add(&core.TextField{Name: "path"})
	col.Fields.Add(&core.NumberField{Name: "views"})
	col.Fields.Add(&core.NumberField{Name: "uniques"})
	col.Fields.Add(&core.RelationField{Name: "post", CollectionId: postsCol.Id, MaxSelect: 1})
	col.Fields.Add(&core.DateField{Name: "lastVisitedAt"})
	col.ListRule = strPtr(`@request.auth.id != ""`)
	col.ViewRule = strPtr(`@request.auth.id != ""`)
	col.UpdateRule = strPtr(`@request.auth.id != ""`)
	col.DeleteRule = strPtr(`@request.auth.role = "admin"`)
	return db.Save(col)
}

func createAudits(db core.App) error {
	usersCol, err := db.FindCollectionByNameOrId("users")
	if err != nil {
		return err
	}
	col := core.NewCollection(core.CollectionTypeBase, "audits")
	col.Fields.Add(&core.RelationField{Name: "actor", CollectionId: usersCol.Id, MaxSelect: 1})
	col.Fields.Add(&core.TextField{Name: "action"})
	col.Fields.Add(&core.TextField{Name: "target"})
	col.Fields.Add(&core.SelectField{Name: "result", Values: []string{"success", "failure"}})
	col.Fields.Add(&core.JSONField{Name: "detail"})
	col.Fields.Add(&core.TextField{Name: "ip"})
	col.Fields.Add(&core.TextField{Name: "userAgent"})
	col.ListRule = strPtr(`@request.auth.role = "admin"`)
	col.ViewRule = strPtr(`@request.auth.role = "admin"`)
	col.DeleteRule = strPtr(`@request.auth.role = "admin"`)
	return db.Save(col)
}

func createTokens(db core.App) error {
	usersCol, err := db.FindCollectionByNameOrId("users")
	if err != nil {
		return err
	}
	col := core.NewCollection(core.CollectionTypeBase, "tokens")
	col.Fields.Add(&core.TextField{Name: "name"})
	col.Fields.Add(&core.TextField{Name: "tokenHash", Required: true})
	col.Fields.Add(&core.RelationField{Name: "user", CollectionId: usersCol.Id, MaxSelect: 1, Required: true})
	col.Fields.Add(&core.DateField{Name: "expiresAt"})
	col.Fields.Add(&core.BoolField{Name: "disabled"})
	col.ListRule = strPtr(`@request.auth.role = "admin"`)
	col.ViewRule = strPtr(`@request.auth.role = "admin"`)
	col.CreateRule = strPtr(`@request.auth.role = "admin"`)
	col.UpdateRule = strPtr(`@request.auth.role = "admin"`)
	col.DeleteRule = strPtr(`@request.auth.role = "admin"`)
	return db.Save(col)
}

func insertDefaultSite(db core.App) error {
	col, err := db.FindCollectionByNameOrId("site")
	if err != nil {
		return err
	}
	record := core.NewRecord(col)
	record.Set("theme", "default")
	record.Set("commentsProvider", "disabled")
	record.Set("analyticsScript", "")
	record.Set("info", json.RawMessage(`{}`))
	record.Set("nav", json.RawMessage(`[]`))
	record.Set("links", json.RawMessage(`[]`))
	record.Set("socials", json.RawMessage(`[]`))
	record.Set("rewards", json.RawMessage(`[]`))
	record.Set("about", json.RawMessage(`{"content":"","updatedAt":""}`))
	record.Set("customize", json.RawMessage(`{"head":"","css":"","html":"","script":""}`))
	record.Set("imageConfig", json.RawMessage(`{"enableWatermark":false,"waterMarkText":"","enableWebp":true}`))
	record.Set("routing", json.RawMessage(`[]`))
	record.Set("allowedDomains", json.RawMessage(`[]`))
	record.Set("revisions", json.RawMessage(`{"enabled":true,"retention":50}`))
	record.Set("output", json.RawMessage(`{"enabled":false}`))
	record.Set("sync", json.RawMessage(`{"enabled":false}`))
	return db.Save(record)
}

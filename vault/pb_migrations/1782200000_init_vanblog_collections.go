package migrations

import (
	"encoding/json"

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
		return insertDefaultSite(db)
	}, func(db core.App) error {
		// Init migration is not rolled back. If the schema needs to change,
		// add a new migration on top — never rewrite history.
		return nil
	})
}

func strPtr(s string) *string { return &s }

// --- Collections ---

func createTags(db core.App) error {
	col := core.NewCollection(core.CollectionTypeBase, "tags")
	col.Fields.Add(&core.TextField{Name: "name", Required: true})
	col.Fields.Add(&core.TextField{Name: "slug"})
	col.Fields.Add(&core.TextField{Name: "description"})
	col.Fields.Add(&core.TextField{Name: "oldName"})
	col.Fields.Add(&core.AutodateField{Name: "created", OnCreate: true})
	col.Fields.Add(&core.AutodateField{Name: "updated", OnUpdate: true})
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
	col.Fields.Add(&core.AutodateField{Name: "created", OnCreate: true})
	col.Fields.Add(&core.AutodateField{Name: "updated", OnUpdate: true})
	col.ListRule = strPtr("")
	col.ViewRule = strPtr("")
	return db.Save(col)
}

func createUsers(db core.App) error {
	// pb 0.39 creates a default empty 'users' collection on bootstrap.
	col, err := db.FindCollectionByNameOrId("users")
	if err != nil {
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
	col.Fields.Add(&core.AutodateField{Name: "created", OnCreate: true})
	col.Fields.Add(&core.AutodateField{Name: "updated", OnUpdate: true})
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
	col.Fields.Add(&core.AutodateField{Name: "created", OnCreate: true})
	col.Fields.Add(&core.AutodateField{Name: "updated", OnUpdate: true})
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
	// snapshot holds the full pre-update state (title/content/status JSON).
	// No diff field: the Astro diff renderer can derive deltas on demand
	// from adjacent snapshots, so storing both was redundant.
	col.Fields.Add(&core.JSONField{Name: "snapshot"})
	col.Fields.Add(&core.RelationField{Name: "authoredBy", CollectionId: usersCol.Id, MaxSelect: 1})
	col.Fields.Add(&core.TextField{Name: "reason"})
	col.Fields.Add(&core.AutodateField{Name: "created", OnCreate: true})
	col.Fields.Add(&core.AutodateField{Name: "updated", OnUpdate: true})
	col.ListRule = strPtr(`@request.auth.id != ""`)
	col.ViewRule = strPtr(`@request.auth.id != ""`)
	col.DeleteRule = strPtr(`@request.auth.role = "admin"`)
	return db.Save(col)
}

func createMedia(db core.App) error {
	col := core.NewCollection(core.CollectionTypeBase, "media")
	col.Fields.Add(&core.FileField{
		Name:      "file",
		MaxSelect: 1,
		MaxSize:   50 << 20, // 50MB
		MimeTypes: []string{
			"image/jpeg",
			"image/png",
			"image/gif",
			"image/webp",
			"image/svg+xml",
			"image/bmp",
			"image/tiff",
			"image/x-icon",
			"image/avif",
			// Non-image types (favicon/attachment use same field)
			"application/octet-stream",
		},
		Thumbs: []string{
			"300x0",  // thumbnail width=300 (height auto)
			"800x0",  // medium width=800
			"1200x0", // large width=1200
		},
		Required: false, // externalUrl images don't have local files
	})
	col.Fields.Add(&core.SelectField{Name: "staticType", Values: []string{"img", "favicon", "attachment"}})
	col.Fields.Add(&core.SelectField{Name: "storageType", Values: []string{"local", "s3", "external"}})
	col.Fields.Add(&core.TextField{Name: "fileType"})
	col.Fields.Add(&core.TextField{Name: "sign"})
	col.Fields.Add(&core.JSONField{Name: "meta"})
	col.Fields.Add(&core.TextField{Name: "externalUrl"})
	col.Fields.Add(&core.NumberField{Name: "oldId"})
	col.Fields.Add(&core.AutodateField{Name: "created", OnCreate: true})
	col.Fields.Add(&core.AutodateField{Name: "updated", OnUpdate: true})
	col.ListRule = strPtr(`staticType = "img" || @request.auth.id != ""`)
	col.ViewRule = strPtr(`staticType = "img" || @request.auth.id != ""`)
	col.CreateRule = strPtr(`@request.auth.id != ""`)
	col.UpdateRule = strPtr(`@request.auth.id != ""`)
	col.DeleteRule = strPtr(`@request.auth.id != ""`)
	return db.Save(col)
}

func createSite(db core.App) error {
	col := core.NewCollection(core.CollectionTypeBase, "site")

	// --- 标量配置（原 info JSON 拆为独立列，Admin UI 可直接编辑）---

	// 站点基本信息
	col.Fields.Add(&core.TextField{Name: "siteName"})
	col.Fields.Add(&core.TextField{Name: "siteDesc"})
	col.Fields.Add(&core.TextField{Name: "author"})
	col.Fields.Add(&core.TextField{Name: "authDesc"})
	col.Fields.Add(&core.TextField{Name: "authorLogo"})
	col.Fields.Add(&core.TextField{Name: "authorLogoDark"})
	col.Fields.Add(&core.TextField{Name: "siteLogo"})
	col.Fields.Add(&core.TextField{Name: "siteLogoDark"})
	col.Fields.Add(&core.TextField{Name: "favicon"})
	col.Fields.Add(&core.TextField{Name: "gaAnalysisId"})
	col.Fields.Add(&core.TextField{Name: "baiduAnalysisId"})
	col.Fields.Add(&core.TextField{Name: "baseUrl"})
	col.Fields.Add(&core.DateField{Name: "since"})
	col.Fields.Add(&core.TextField{Name: "copyrightAggreement"})

	// 备案
	col.Fields.Add(&core.TextField{Name: "beianNumber"})
	col.Fields.Add(&core.TextField{Name: "beianUrl"})
	col.Fields.Add(&core.TextField{Name: "gaBeianNumber"})
	col.Fields.Add(&core.TextField{Name: "gaBeianUrl"})
	col.Fields.Add(&core.TextField{Name: "gaBeianLogoUrl"})

	// 支付
	col.Fields.Add(&core.TextField{Name: "payAliPay"})
	col.Fields.Add(&core.TextField{Name: "payWechat"})
	col.Fields.Add(&core.TextField{Name: "payAliPayDark"})
	col.Fields.Add(&core.TextField{Name: "payWechatDark"})

	// 主题
	col.Fields.Add(&core.SelectField{Name: "theme", Values: []string{"default", "minimal", "magazine", "custom"}})
	col.Fields.Add(&core.SelectField{Name: "defaultTheme", Values: []string{"auto", "light", "dark"}})

	// 评论
	col.Fields.Add(&core.SelectField{Name: "commentsProvider", Values: []string{"disabled", "waline", "giscus", "artalk", "external"}})
	col.Fields.Add(&core.JSONField{Name: "commentsConfig"}) // provider 特有配置(giscus repo/waline url 等)

	// 统计
	col.Fields.Add(&core.TextField{Name: "analyticsScript"})

	// 关于页面(原 about JSON 拆开)
	col.Fields.Add(&core.TextField{Name: "aboutContent"})
	col.Fields.Add(&core.DateField{Name: "aboutUpdatedAt"})

	// 自定义注入(原 customize JSON 拆开)
	col.Fields.Add(&core.TextField{Name: "customHead"})
	col.Fields.Add(&core.TextField{Name: "customCss"})
	col.Fields.Add(&core.TextField{Name: "customHtml"})
	col.Fields.Add(&core.TextField{Name: "customScript"})

	// 图片处理(原 imageConfig JSON 拆开)
	col.Fields.Add(&core.BoolField{Name: "enableWaterMark"})
	col.Fields.Add(&core.TextField{Name: "watermarkText"})
	// mediaConfig (JSON) 取代了原 enableWebp 单 bool —— 控制客户端
	// 图片归一化（targetFormat/quality）。ApplyS3BackendToSettings 等下游
	// 都从 mediaConfig 读，不再看 enableWebp。
	col.Fields.Add(&core.JSONField{Name: "mediaConfig"})

	// Caddy / HTTPS
	col.Fields.Add(&core.JSONField{Name: "routing"})        // 动态路由规则数组
	col.Fields.Add(&core.JSONField{Name: "allowedDomains"}) // on-demand TLS 白名单
	col.Fields.Add(&core.BoolField{Name: "httpsRedirect"})
	col.Fields.Add(&core.TextField{Name: "caddyLogLevel"})
	// caddyLastError 由 caddy.Service.pushConfigToAdminAPI 写入，
	// admin UI 通过 TLSStatus.BootstrapError 显示，方便排查"为什么卡在 503 维护页"。
	col.Fields.Add(&core.TextField{Name: "caddyLastError"})

	// 版本控制设置(原 revisions JSON 拆开)
	col.Fields.Add(&core.BoolField{Name: "revisionsEnabled"})
	col.Fields.Add(&core.NumberField{Name: "revisionsRetention"})

	// 显示开关合并为 JSON(site 单行表,拆列无索引收益)
	col.Fields.Add(&core.JSONField{Name: "displayOptions"})

	// --- JSON 数组配置（动态条目，JSON 比独立表更好用）---

	col.Fields.Add(&core.JSONField{Name: "nav"})     // 导航菜单 [{name, value, level}]
	col.Fields.Add(&core.JSONField{Name: "links"})   // 友链 [{name, url, desc, logo}]
	col.Fields.Add(&core.JSONField{Name: "socials"}) // 社交 [{type, value}]
	col.Fields.Add(&core.JSONField{Name: "rewards"}) // 打赏 [{name, value}]

	// --- md_output / git sync（配置对象，JSON 合理）---

	col.Fields.Add(&core.BoolField{Name: "outputEnabled"})
	col.Fields.Add(&core.TextField{Name: "outputDest"})
	col.Fields.Add(&core.JSONField{Name: "outputConfig"}) // format/naming/include/trigger

	col.Fields.Add(&core.BoolField{Name: "syncEnabled"})
	col.Fields.Add(&core.TextField{Name: "syncRemote"})
	col.Fields.Add(&core.JSONField{Name: "syncConfig"}) // branch/schedule/sshKey

	// --- S3 后端配置（ApplyS3BackendToSettings 消费此 blob 推到 pb settings）---
	// Secret 明文存 SQLite；需要 at-rest 加密的用户应加密 pb_data 卷。
	col.Fields.Add(&core.JSONField{Name: "s3Config"})

	// Rule: public read, auth write
	col.Fields.Add(&core.AutodateField{Name: "created", OnCreate: true})
	col.Fields.Add(&core.AutodateField{Name: "updated", OnUpdate: true})
	col.ListRule = strPtr("")
	col.ViewRule = strPtr("")
	col.CreateRule = strPtr(`@request.auth.role = "admin"`)
	col.UpdateRule = strPtr(`@request.auth.role = "admin"`)
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
	col.Fields.Add(&core.AutodateField{Name: "created", OnCreate: true})
	col.Fields.Add(&core.AutodateField{Name: "updated", OnUpdate: true})
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
	col.Fields.Add(&core.AutodateField{Name: "created", OnCreate: true})
	col.Fields.Add(&core.AutodateField{Name: "updated", OnUpdate: true})
	col.ListRule = strPtr(`@request.auth.role = "admin"`)
	col.ViewRule = strPtr(`@request.auth.role = "admin"`)
	col.DeleteRule = strPtr(`@request.auth.role = "admin"`)
	return db.Save(col)
}

func insertDefaultSite(db core.App) error {
	col, err := db.FindCollectionByNameOrId("site")
	if err != nil {
		return err
	}
	record := core.NewRecord(col)

	// 标量字段默认值
	record.Set("siteName", "")
	record.Set("theme", "default")
	record.Set("defaultTheme", "auto")
	record.Set("commentsProvider", "disabled")
	record.Set("enableWaterMark", false)
	record.Set("httpsRedirect", true)
	record.Set("caddyLogLevel", "warn")
	record.Set("revisionsEnabled", true)
	record.Set("revisionsRetention", 50)
	record.Set("displayOptions", json.RawMessage(`{"showAdminButton":true,"showSubMenu":false,"subMenuOffset":0,"headerLeftContent":"siteLogo","showDonateInfo":false,"showFriends":true,"showCopyRight":true,"showDonateButton":false,"showDonateInAbout":false,"allowOpenHiddenPostByUrl":false,"showRSS":true,"openArticleLinksInNewWindow":false,"showExpirationReminder":true,"showEditButton":false}`))
	record.Set("outputEnabled", false)
	record.Set("outputDest", "/var/lib/md_output")
	record.Set("syncEnabled", false)

	// JSON 字段默认值
	record.Set("nav", json.RawMessage(`[]`))
	record.Set("links", json.RawMessage(`[]`))
	record.Set("socials", json.RawMessage(`[]`))
	record.Set("rewards", json.RawMessage(`[]`))
	record.Set("routing", json.RawMessage(`[]`))
	record.Set("allowedDomains", json.RawMessage(`[]`))
	record.Set("outputConfig", json.RawMessage(`{"format":"markdown","trigger":"onUpdate"}`))
	record.Set("syncConfig", json.RawMessage(`{"branch":"main","schedule":"0 */6 * * *"}`))
	record.Set("commentsConfig", json.RawMessage(`{}`))
	// mediaConfig: 客户端 WebP 归一化默认开启（quality 84，原 enableWebp=true 的等价）
	record.Set("mediaConfig", json.RawMessage(`{"enabled":true,"targetFormat":"webp","quality":84}`))
	// s3Config: 默认禁用（启用后 ApplyS3BackendToSettings 才会推到 pb settings）
	record.Set("s3Config", json.RawMessage(`{"enabled":false}`))

	return db.Save(record)
}

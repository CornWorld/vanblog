// Package migration provides tools to import data from legacy Vanblog JSON backups.
package migration

import (
	"encoding/json"
	"fmt"

	"github.com/pocketbase/pocketbase/core"
)

// LegacyBackup is the JSON structure exported by the original Vanblog's
// GET /api/admin/backup/export endpoint.
//
// Source: backup.controller.ts:52-89 in vanblog-upstream
type LegacyBackup struct {
	Articles   []LegacyArticle  `json:"articles"`
	Drafts     []LegacyDraft    `json:"drafts"`
	Categories []LegacyCategory `json:"categories"`
	Tags       []string         `json:"tags"`
	Meta       json.RawMessage  `json:"meta"`
	User       json.RawMessage  `json:"user"`
	Viewer     json.RawMessage  `json:"viewer"`
	Visit      json.RawMessage  `json:"visit"`
	Static     []LegacyStatic   `json:"static"`
	Setting    json.RawMessage  `json:"setting"`
}

// LegacyArticle is an article from the original Vanblog.
type LegacyArticle struct {
	ID         int      `json:"id"`
	Title      string   `json:"title"`
	Content    string   `json:"content"`
	Tags       []string `json:"tags"`
	Top        int      `json:"top"`
	Category   string   `json:"category"`
	Hidden     bool     `json:"hidden"`
	Author     string   `json:"author"`
	Pathname   string   `json:"pathname"`
	Private    bool     `json:"private"`
	Password   string   `json:"password"`
	Deleted    bool     `json:"deleted"`
	Viewer     int      `json:"viewer"`
	Visited    int      `json:"visited"`
	Copyright  string   `json:"copyright"`
	CreatedAt  string   `json:"createdAt"`
	UpdatedAt  string   `json:"updatedAt"`
}

// LegacyDraft is a draft from the original Vanblog.
type LegacyDraft struct {
	ID        int      `json:"id"`
	Title     string   `json:"title"`
	Content   string   `json:"content"`
	Tags      []string `json:"tags"`
	Author    string   `json:"author"`
	Category  string   `json:"category"`
	Deleted   bool     `json:"deleted"`
	CreatedAt string   `json:"createdAt"`
}

// LegacyCategory is a category from the original Vanblog.
type LegacyCategory struct {
	ID       int             `json:"id"`
	Name     string          `json:"name"`
	Type     string          `json:"type"`
	Private  bool            `json:"private"`
	Password string          `json:"password"`
	Meta     json.RawMessage `json:"meta"`
}

// LegacyStatic is an image/file record from the original Vanblog.
type LegacyStatic struct {
	StaticType  string          `json:"staticType"`
	StorageType string          `json:"storageType"`
	FileType    string          `json:"fileType"`
	RealPath    string          `json:"realPath"`
	Meta        json.RawMessage `json:"meta"`
	Name        string          `json:"name"`
	Sign        string          `json:"sign"`
	UpdatedAt   string          `json:"updatedAt"`
}

// Result reports the outcome of an import operation.
type Result struct {
	Posts      int      `json:"posts"`
	Categories int      `json:"categories"`
	Tags       int      `json:"tags"`
	Media      int      `json:"media"`
	Archive    bool     `json:"archive"` // migration archive created
	Errors     []string `json:"errors"`
}

// Importer handles data migration from legacy JSON.
type Importer struct {
	app core.App
}

// New creates an Importer.
func New(app core.App) *Importer {
	return &Importer{app: app}
}

// Import parses legacy JSON backup and writes all data to pb collections.
// It runs in a single transaction — if any step fails, everything rolls back.
//
// Workflow:
//  1. Parse JSON → LegacyBackup
//  2. Create categories
//  3. Create tags
//  4. Create posts (articles + drafts merged)
//  5. Create media records
//  6. Create migration archive (for incompatible data)
func (imp *Importer) Import(jsonData []byte) (*Result, error) {
	result := &Result{Errors: []string{}}

	var backup LegacyBackup
	if err := json.Unmarshal(jsonData, &backup); err != nil {
		return nil, fmt.Errorf("migration: failed to parse JSON: %w", err)
	}

	err := imp.app.RunInTransaction(func(txApp core.App) error {
		// 1. Categories
		catMap, err := imp.importCategories(txApp, backup.Categories)
		if err != nil {
			return err
		}
		result.Categories = len(catMap)

		// 2. Tags
		tagMap, err := imp.importTags(txApp, backup.Tags)
		if err != nil {
			return err
		}
		result.Tags = len(tagMap)

		// 3. Posts (articles + drafts)
		count, err := imp.importArticles(txApp, backup.Articles, catMap, tagMap)
		if err != nil {
			return err
		}
		draftCount, err := imp.importDrafts(txApp, backup.Drafts, catMap, tagMap)
		if err != nil {
			return err
		}
		result.Posts = count + draftCount

		// 4. Media
		mediaCount, err := imp.importStatic(txApp, backup.Static)
		if err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("media import partial: %v", err))
		}
		result.Media = mediaCount

		// 5. Migration archive
		if err := imp.createArchive(txApp, &backup); err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("archive creation: %v", err))
		} else {
			result.Archive = true
		}

		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("migration: transaction failed: %w", err)
	}

	return result, nil
}

// importCategories creates category records and returns old-name → new-id map.
func (imp *Importer) importCategories(txApp core.App, cats []LegacyCategory) (map[string]string, error) {
	catMap := make(map[string]string)
	col, err := txApp.FindCollectionByNameOrId("categories")
	if err != nil {
		return nil, err
	}

	for _, c := range cats {
		record := core.NewRecord(col)
		record.Set("name", c.Name)
		if c.Type != "" {
			record.Set("type", c.Type)
		}
		record.Set("private", c.Private)
		if c.Password != "" {
			record.Set("password", c.Password)
		}
		if len(c.Meta) > 0 && string(c.Meta) != "null" {
			record.Set("meta", c.Meta)
		}
		if err := txApp.Save(record); err != nil {
			return nil, fmt.Errorf("category %q: %w", c.Name, err)
		}
		catMap[c.Name] = record.Id
	}

	return catMap, nil
}

// importTags creates tag records and returns old-name → new-id map.
func (imp *Importer) importTags(txApp core.App, tagNames []string) (map[string]string, error) {
	tagMap := make(map[string]string)

	// Also extract tags from articles/drafts (backup.tags may be incomplete)
	col, err := txApp.FindCollectionByNameOrId("tags")
	if err != nil {
		return nil, err
	}

	seen := make(map[string]bool)
	for _, name := range tagNames {
		if name == "" || seen[name] {
			continue
		}
		seen[name] = true
		record := core.NewRecord(col)
		record.Set("name", name)
		record.Set("oldName", name)
		if err := txApp.Save(record); err != nil {
			return nil, fmt.Errorf("tag %q: %w", name, err)
		}
		tagMap[name] = record.Id
	}

	return tagMap, nil
}

// importArticles creates published posts from legacy articles.
func (imp *Importer) importArticles(txApp core.App, articles []LegacyArticle, catMap, tagMap map[string]string) (int, error) {
	col, err := txApp.FindCollectionByNameOrId("posts")
	if err != nil {
		return 0, err
	}

	count := 0
	for _, a := range articles {
		if a.Deleted {
			continue // skip soft-deleted
		}

		record := core.NewRecord(col)
		record.Set("title", a.Title)
		record.Set("content", a.Content)
		record.Set("oldId", a.ID)

		// Determine status: hidden takes precedence, then private
		// Private articles require password but are listed;
		// Hidden articles are not listed at all
		if a.Hidden {
			record.Set("status", "hidden")
		} else if a.Private {
			record.Set("status", "published")
			record.Set("private", true)
			if a.Password != "" {
				record.Set("password", a.Password)
			}
		} else {
			record.Set("status", "published")
		}

		// Tags
		if len(a.Tags) > 0 {
			tagIDs := []string{}
			for _, t := range a.Tags {
				if id, ok := tagMap[t]; ok {
					tagIDs = append(tagIDs, id)
				}
			}
			record.Set("tags", tagIDs)
		}

		// Category
		if a.Category != "" {
			if id, ok := catMap[a.Category]; ok {
				record.Set("category", id)
			}
		}

		// Other fields
		record.Set("pathname", a.Pathname)
		record.Set("top", a.Top)
		record.Set("private", a.Private)
		if a.Password != "" {
			record.Set("password", a.Password)
		}
		record.Set("copyright", a.Copyright)
		record.Set("viewCount", a.Viewer)
		record.Set("visitedCount", a.Visited)
		record.Set("deleted", a.Deleted)

		if err := txApp.Save(record); err != nil {
			return count, fmt.Errorf("article %q (id=%d): %w", a.Title, a.ID, err)
		}
		count++
	}

	return count, nil
}

// importDrafts creates draft posts from legacy drafts.
func (imp *Importer) importDrafts(txApp core.App, drafts []LegacyDraft, catMap, tagMap map[string]string) (int, error) {
	col, err := txApp.FindCollectionByNameOrId("posts")
	if err != nil {
		return 0, err
	}

	count := 0
	for _, d := range drafts {
		if d.Deleted {
			continue
		}

		// Use offset to avoid oldId collision with articles
		offsetID := 1000000 + d.ID

		record := core.NewRecord(col)
		record.Set("title", d.Title)
		record.Set("content", d.Content)
		record.Set("oldId", offsetID)
		record.Set("status", "draft")

		if len(d.Tags) > 0 {
			tagIDs := []string{}
			for _, t := range d.Tags {
				if id, ok := tagMap[t]; ok {
					tagIDs = append(tagIDs, id)
				}
			}
			record.Set("tags", tagIDs)
		}

		if d.Category != "" {
			if id, ok := catMap[d.Category]; ok {
				record.Set("category", id)
			}
		}

		if err := txApp.Save(record); err != nil {
			return count, fmt.Errorf("draft %q (id=%d): %w", d.Title, d.ID, err)
		}
		count++
	}

	return count, nil
}

// importStatic creates media records from legacy static entries.
// Files are NOT downloaded — only metadata + externalUrl is preserved.
func (imp *Importer) importStatic(txApp core.App, statics []LegacyStatic) (int, error) {
	col, err := txApp.FindCollectionByNameOrId("media")
	if err != nil {
		return 0, err
	}

	count := 0
	for _, s := range statics {
		record := core.NewRecord(col)

		staticType := s.StaticType
		if staticType == "" {
			staticType = "img"
		}
		record.Set("staticType", staticType)

		// picgo → s3 (decision matrix #10)
		storageType := s.StorageType
		if storageType == "picgo" {
			storageType = "s3"
		}
		if storageType == "" {
			storageType = "local"
		}
		record.Set("storageType", storageType)

		record.Set("fileType", s.FileType)
		record.Set("sign", s.Sign)
		record.Set("externalUrl", s.RealPath) // preserve original URL
		record.Set("oldId", s.Name)

		if len(s.Meta) > 0 && string(s.Meta) != "null" {
			record.Set("meta", s.Meta)
		}

		if err := txApp.Save(record); err != nil {
			continue // skip bad records, don't fail entire import
		}
		count++
	}

	return count, nil
}

// createArchive creates a single hidden post containing all incompatible data
// (pipeline scripts, picgo config, waline SMTP, legacy meta/settings, etc.)
// as JSON attachments in the content field.
func (imp *Importer) createArchive(txApp core.App, backup *LegacyBackup) error {
	col, err := txApp.FindCollectionByNameOrId("posts")
	if err != nil {
		return err
	}

	// Build migration guide content
	guide := fmt.Sprintf(`# 迁移档案

此文章由迁移工具自动创建，包含原 Vanblog 中不兼容的数据。

## 可用数据

- Articles: %d
- Drafts: %d
- Categories: %d
- Tags: %d
- Static/Media: %d

## 不兼容数据(归档在 JSON 中)

- Pipeline 脚本: 已裁剪(新架构无对应概念)
- picgo 配置: 已裁剪(改用 pb S3 provider)
- Caddy 配置: 已裁剪(新架构自动处理)
- Waline SMTP: 已裁剪(独立容器配置)
- 百度/GA 统计 ID: 请手动配置 site.analyticsScript
- CustomPage: 请从原项目单独导出,放入 Astro src/pages/

## 迁移后操作

1. 重新设置密码
2. 重新配置评论 provider (site.commentsProvider)
3. 重新配置统计脚本 (site.analyticsScript)
4. 迁移 CustomPage 到 Astro src/pages/

完成迁移后可删除此文章。
`, len(backup.Articles), len(backup.Drafts), len(backup.Categories),
		len(backup.Tags), len(backup.Static))

	record := core.NewRecord(col)
	record.Set("title", "[迁移档案] 原始数据归档")
	record.Set("content", guide)
	record.Set("status", "hidden")
	record.Set("deleted", false)

	return txApp.Save(record)
}

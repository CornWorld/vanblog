//go:build ignore

package main

import (
	"fmt"
	"os"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

func main() {
	tmpDir, _ := os.MkdirTemp("", "pb-rel-verify")
	defer os.RemoveAll(tmpDir)

	app := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: tmpDir})
	app.Bootstrap()

	// Create tags collection
	tagsCol := core.NewCollection("base", "tags")
	tagsCol.Fields.Add(&core.TextField{Name: "name", Required: true})
	tagsCol.ListRule = ptr("")
	app.Save(tagsCol)

	// Create posts collection with relation
	postsCol := core.NewCollection("base", "posts")
	postsCol.Fields.Add(&core.TextField{Name: "title"})
	postsCol.Fields.Add(&core.RelationField{Name: "tags", CollectionId: tagsCol.Id, MaxSelect: 100})
	postsCol.ListRule = ptr("")
	app.Save(postsCol)

	// Create data
	tagGo := core.NewRecord(tagsCol)
	tagGo.Set("name", "Go")
	app.Save(tagGo)

	tagRust := core.NewRecord(tagsCol)
	tagRust.Set("name", "Rust")
	app.Save(tagRust)

	post1 := core.NewRecord(postsCol)
	post1.Set("title", "Multi-tag post")
	post1.Set("tags", []string{tagGo.Id, tagRust.Id})
	app.Save(post1)

	post2 := core.NewRecord(postsCol)
	post2.Set("title", "Single-tag post")
	post2.Set("tags", []string{tagGo.Id})
	app.Save(post2)

	post3 := core.NewRecord(postsCol)
	post3.Set("title", "No-tag post")
	app.Save(post3)

	fmt.Println("=== Relation filter operator verification ===")
	fmt.Printf("tagGo=%s tagRust=%s\n\n", tagGo.Id, tagRust.Id)

	tests := []struct {
		desc   string
		filter string
	}{
		{"exact match (=, entire array)", fmt.Sprintf("tags = '%s'", tagGo.Id)},
		{"like/contains (~)", fmt.Sprintf("tags ~ '%s'", tagGo.Id)},
		{"any-equal (?=)", fmt.Sprintf("tags ?= '%s'", tagGo.Id)},
		{"any-like (?~)", fmt.Sprintf("tags ?~ '%s'", tagGo.Id)},
		{"any-not-equal (?!=)", fmt.Sprintf("tags ?!= '%s'", tagGo.Id)},
		{"not-like (!~)", fmt.Sprintf("tags !~ '%s'", tagGo.Id)},
		{"array length > 0", "tags:length > 0"},
		{"array length = 2", "tags:length = 2"},
		{"array length = 0", "tags:length = 0"},
		{"any-equal multi (Go OR Rust)", fmt.Sprintf("tags ?= '%s' || tags ?= '%s'", tagGo.Id, tagRust.Id)},
	}

	for _, tc := range tests {
		records, err := app.FindRecordsByFilter("posts", tc.filter, "", 0, 0)
		if err != nil {
			fmt.Printf("  [ERROR] %-35s → %v\n", tc.desc, err)
			continue
		}
		titles := make([]string, len(records))
		for i, r := range records {
			titles[i] = r.GetString("title")
		}
		fmt.Printf("  [OK]   %-35s → %d results: %v\n", tc.desc, len(records), titles)
	}

	fmt.Println("\n=== Back-relation note ===")
	fmt.Println("  To find posts by tag: query 'posts' collection with 'tags ?= TAG_ID'")
	fmt.Println("  Back-relations (posts_via_tags) are for expand, not direct filter on tags collection")
}

func ptr(s string) *string { return &s }

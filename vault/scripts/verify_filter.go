//go:build ignore
package main

import (
	"fmt"
	"os"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

func main() {
	tmpDir, _ := os.MkdirTemp("", "pb-filter-test")
	defer os.RemoveAll(tmpDir)

	app := pocketbase.NewWithConfig(pocketbase.Config{DefaultDataDir: tmpDir})
	app.Bootstrap()

	// Create tags
	tagsCol := core.NewCollection("base", "tags")
	tagsCol.Fields.Add(&core.TextField{Name: "name", Required: true})
	tagsCol.ListRule = ptr("")
	app.Save(tagsCol)

	// Create posts with relation
	postsCol := core.NewCollection("base", "posts")
	postsCol.Fields.Add(&core.TextField{Name: "title"})
	postsCol.Fields.Add(&core.RelationField{Name: "tags", CollectionId: tagsCol.Id, MaxSelect: 100})
	postsCol.ListRule = ptr("")
	app.Save(postsCol)

	// Create data
	tagR := core.NewRecord(tagsCol)
	tagR.Set("name", "Go")
	app.Save(tagR)

	post := core.NewRecord(postsCol)
	post.Set("title", "Test")
	post.Set("tags", []string{tagR.Id})
	app.Save(post)

	// Try different filter operators
	filters := []string{
		fmt.Sprintf("tags = '%s'", tagR.Id),       // exact match
		fmt.Sprintf("tags ~ '%s'", tagR.Id),        // LIKE match
		fmt.Sprintf("'%s' in tags", tagR.Id),       // IN operator
		fmt.Sprintf("tags:length > 0"),              // array length
	}

	for _, f := range filters {
		records, err := app.FindRecordsByFilter("posts", f, "", 0, 0)
		if err != nil {
			fmt.Printf("  filter [%s] -> ERROR: %v\n", f, err)
		} else {
			fmt.Printf("  filter [%s] -> %d results\n", f, len(records))
		}
	}
}

func ptr(s string) *string { return &s }

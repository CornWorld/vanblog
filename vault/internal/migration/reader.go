package migration

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// ReadFromMongo connects to a MongoDB instance and reads all VanBlog data.
func ReadFromMongo(ctx context.Context, uri, dbName string) (*LegacyBackup, error) {
	client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri).SetConnectTimeout(10*time.Second))
	if err != nil {
		return nil, fmt.Errorf("mongo connect: %w", err)
	}
	defer func() { _ = client.Disconnect(ctx) }()

	db := client.Database(dbName)

	backup := &LegacyBackup{}

	// Read articles
	articles, err := readArticles(ctx, db)
	if err != nil {
		return nil, fmt.Errorf("read articles: %w", err)
	}
	backup.Articles = articles

	// Read drafts
	drafts, err := readDrafts(ctx, db)
	if err != nil {
		return nil, fmt.Errorf("read drafts: %w", err)
	}
	backup.Drafts = drafts

	// Read categories
	categories, err := readCategories(ctx, db)
	if err != nil {
		return nil, fmt.Errorf("read categories: %w", err)
	}
	backup.Categories = categories

	// Gather all unique tag names from articles and drafts
	tagSet := make(map[string]bool)
	for _, a := range articles {
		for _, t := range a.Tags {
			if t != "" {
				tagSet[t] = true
			}
		}
	}
	for _, d := range drafts {
		for _, t := range d.Tags {
			if t != "" {
				tagSet[t] = true
			}
		}
	}
	backup.Tags = make([]string, 0, len(tagSet))
	for t := range tagSet {
		backup.Tags = append(backup.Tags, t)
	}

	// Read statics
	statics, err := readStatics(ctx, db)
	if err != nil {
		return nil, fmt.Errorf("read statics: %w", err)
	}
	backup.Static = statics

	// Read meta (single doc)
	meta, err := readSingleDocJSON(ctx, db, "metas")
	if err != nil {
		return nil, fmt.Errorf("read meta: %w", err)
	}
	backup.Meta = meta

	// Read user (single doc)
	user, err := readSingleDocJSON(ctx, db, "users")
	if err != nil {
		return nil, fmt.Errorf("read user: %w", err)
	}
	backup.User = user

	// Read viewers (array)
	viewer, err := readAllDocsJSON(ctx, db, "viewers")
	if err != nil {
		return nil, fmt.Errorf("read viewers: %w", err)
	}
	backup.Viewer = viewer

	// Read visits (array)
	visit, err := readAllDocsJSON(ctx, db, "visits")
	if err != nil {
		return nil, fmt.Errorf("read visits: %w", err)
	}
	backup.Visit = visit

	// Read static setting (type=static, wrapped as {static: value})
	setting, err := readStaticSetting(ctx, db)
	if err != nil {
		return nil, fmt.Errorf("read setting: %w", err)
	}
	backup.Setting = setting

	return backup, nil
}

func readArticles(ctx context.Context, db *mongo.Database) ([]LegacyArticle, error) {
	cursor, err := db.Collection("articles").Find(ctx, bson.M{})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var articles []LegacyArticle
	for cursor.Next(ctx) {
		var doc bson.M
		if err := cursor.Decode(&doc); err != nil {
			return nil, err
		}

		a := convertToArticle(doc)
		articles = append(articles, a)
	}
	return articles, cursor.Err()
}

func readDrafts(ctx context.Context, db *mongo.Database) ([]LegacyDraft, error) {
	cursor, err := db.Collection("drafts").Find(ctx, bson.M{})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var drafts []LegacyDraft
	for cursor.Next(ctx) {
		var doc bson.M
		if err := cursor.Decode(&doc); err != nil {
			return nil, err
		}

		d := convertToDraft(doc)
		drafts = append(drafts, d)
	}
	return drafts, cursor.Err()
}

func readCategories(ctx context.Context, db *mongo.Database) ([]LegacyCategory, error) {
	cursor, err := db.Collection("categories").Find(ctx, bson.M{})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var categories []LegacyCategory
	for cursor.Next(ctx) {
		var doc bson.M
		if err := cursor.Decode(&doc); err != nil {
			return nil, err
		}

		c := convertToCategory(doc)
		categories = append(categories, c)
	}
	return categories, cursor.Err()
}

func readStatics(ctx context.Context, db *mongo.Database) ([]LegacyStatic, error) {
	cursor, err := db.Collection("statics").Find(ctx, bson.M{})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var statics []LegacyStatic
	for cursor.Next(ctx) {
		var doc bson.M
		if err := cursor.Decode(&doc); err != nil {
			return nil, err
		}

		s := convertToStatic(doc)
		statics = append(statics, s)
	}
	return statics, cursor.Err()
}

// convertToArticle converts a bson.M document to a LegacyArticle.
func convertToArticle(doc bson.M) LegacyArticle {
	a := LegacyArticle{
		ID:        getInt(doc, "id"),
		Title:     getString(doc, "title"),
		Content:   getString(doc, "content"),
		Tags:      getStringSlice(doc, "tags"),
		Top:       getInt(doc, "top"),
		Category:  getString(doc, "category"),
		Hidden:    getBool(doc, "hidden"),
		Author:    getString(doc, "author"),
		Pathname:  getString(doc, "pathname"),
		Private:   getBool(doc, "private"),
		Password:  getString(doc, "password"),
		Deleted:   getBool(doc, "deleted"),
		Viewer:    getInt(doc, "viewer"),
		Visited:   getInt(doc, "visited"),
		Copyright: getString(doc, "copyright"),
		CreatedAt: getDate(doc, "createdAt"),
		UpdatedAt: getDate(doc, "updatedAt"),
	}
	return a
}

// convertToDraft converts a bson.M document to a LegacyDraft.
func convertToDraft(doc bson.M) LegacyDraft {
	d := LegacyDraft{
		ID:        getInt(doc, "id"),
		Title:     getString(doc, "title"),
		Content:   getString(doc, "content"),
		Tags:      getStringSlice(doc, "tags"),
		Author:    getString(doc, "author"),
		Category:  getString(doc, "category"),
		Deleted:   getBool(doc, "deleted"),
		CreatedAt: getDate(doc, "createdAt"),
	}
	return d
}

// convertToCategory converts a bson.M document to a LegacyCategory.
func convertToCategory(doc bson.M) LegacyCategory {
	c := LegacyCategory{
		ID:       getInt(doc, "id"),
		Name:     getString(doc, "name"),
		Type:     getString(doc, "type"),
		Private:  getBool(doc, "private"),
		Password: getString(doc, "password"),
	}
	return c
}

// convertToStatic converts a bson.M document to a LegacyStatic.
func convertToStatic(doc bson.M) LegacyStatic {
	s := LegacyStatic{
		StaticType:  getString(doc, "staticType"),
		StorageType: getString(doc, "storageType"),
		FileType:    getString(doc, "fileType"),
		RealPath:    getString(doc, "realPath"),
		Name:        getString(doc, "name"),
		Sign:        getString(doc, "sign"),
		UpdatedAt:   getDate(doc, "updatedAt"),
	}
	return s
}

// Helper functions for safe bson.M field extraction.

func getString(doc bson.M, key string) string {
	v, ok := doc[key]
	if !ok || v == nil {
		return ""
	}
	switch val := v.(type) {
	case string:
		return val
	default:
		return fmt.Sprintf("%v", val)
	}
}

func getInt(doc bson.M, key string) int {
	v, ok := doc[key]
	if !ok || v == nil {
		return 0
	}
	switch val := v.(type) {
	case int:
		return val
	case int32:
		return int(val)
	case int64:
		return int(val)
	case float64:
		return int(val)
	default:
		return 0
	}
}

func getBool(doc bson.M, key string) bool {
	v, ok := doc[key]
	if !ok || v == nil {
		return false
	}
	switch val := v.(type) {
	case bool:
		return val
	default:
		return false
	}
}

func getStringSlice(doc bson.M, key string) []string {
	v, ok := doc[key]
	if !ok || v == nil {
		return nil
	}
	switch val := v.(type) {
	case primitive.A:
		result := make([]string, 0, len(val))
		for _, item := range val {
			result = append(result, fmt.Sprintf("%v", item))
		}
		return result
	case []any:
		result := make([]string, 0, len(val))
		for _, item := range val {
			result = append(result, fmt.Sprintf("%v", item))
		}
		return result
	case []string:
		return val
	default:
		return nil
	}
}

// getDate converts a MongoDB date field to ISO 8601 string.
func getDate(doc bson.M, key string) string {
	v, ok := doc[key]
	if !ok || v == nil {
		return ""
	}
	switch val := v.(type) {
	case primitive.DateTime:
		return val.Time().UTC().Format("2006-01-02T15:04:05.000Z")
	case time.Time:
		return val.UTC().Format("2006-01-02T15:04:05.000Z")
	default:
		return ""
	}
}

// readSingleDocJSON reads a single document from a collection as relaxed
// extended JSON. Returns nil when the collection/document does not exist, so
// a missing optional collection never fails the whole migration.
func readSingleDocJSON(ctx context.Context, db *mongo.Database, coll string) (json.RawMessage, error) {
	var doc bson.M
	err := db.Collection(coll).FindOne(ctx, bson.M{}).Decode(&doc)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil
		}
		return nil, err
	}
	return marshalBSON(doc)
}

// readAllDocsJSON reads all documents from a collection as a JSON array.
// Returns nil when the collection is empty.
func readAllDocsJSON(ctx context.Context, db *mongo.Database, coll string) (json.RawMessage, error) {
	cursor, err := db.Collection(coll).Find(ctx, bson.M{})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var docs []bson.M
	if err := cursor.All(ctx, &docs); err != nil {
		return nil, err
	}
	if len(docs) == 0 {
		return nil, nil
	}
	return marshalBSON(docs)
}

// readStaticSetting reads the static setting document (type=static) and wraps
// its value as {"static": value}, matching the upstream export shape.
func readStaticSetting(ctx context.Context, db *mongo.Database) (json.RawMessage, error) {
	var doc bson.M
	err := db.Collection("settings").FindOne(ctx, bson.M{"type": "static"}).Decode(&doc)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil
		}
		return nil, err
	}
	value, ok := doc["value"]
	if !ok || value == nil {
		return nil, nil
	}
	return marshalBSON(bson.M{"static": value})
}

// marshalBSON converts a BSON value to relaxed extended JSON bytes, which is
// stable and human-readable enough for the migration archive.
func marshalBSON(v any) (json.RawMessage, error) {
	data, err := bson.MarshalExtJSON(v, false, false)
	if err != nil {
		return nil, err
	}
	return json.RawMessage(data), nil
}

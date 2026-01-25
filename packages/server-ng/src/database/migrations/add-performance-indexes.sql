-- Add performance optimization indexes to articles table
-- This migration adds indexes to improve query performance

-- Single column indexes
CREATE INDEX IF NOT EXISTS updated_at_idx ON articles(updated_at);
CREATE INDEX IF NOT EXISTS author_idx ON articles(author);
CREATE INDEX IF NOT EXISTS hidden_idx ON articles(hidden);
CREATE INDEX IF NOT EXISTS private_idx ON articles(private);
CREATE INDEX IF NOT EXISTS top_idx ON articles(top);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS category_hidden_idx ON articles(category, hidden);
CREATE INDEX IF NOT EXISTS author_created_at_idx ON articles(author, created_at);
CREATE INDEX IF NOT EXISTS hidden_created_at_idx ON articles(hidden, created_at);

-- Add index for tags column to improve tag-based searches
-- Note: SQLite doesn't support functional indexes on JSON, but we can still index the column
CREATE INDEX IF NOT EXISTS tags_idx ON articles(tags);

-- Add indexes for categories table
CREATE INDEX IF NOT EXISTS categories_name_idx ON categories(name);
CREATE INDEX IF NOT EXISTS categories_private_idx ON categories(private);

-- Add indexes for tags table
CREATE INDEX IF NOT EXISTS tags_name_idx ON tags(name);
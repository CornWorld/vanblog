import { createSelectSchema, createInsertSchema } from 'drizzle-zod';

import { codeSnippets } from '../../../database/schema';

import type { z } from 'zod';

// Drizzle schemas
export const selectCodeSnippetSchema = createSelectSchema(codeSnippets);
export const insertCodeSnippetSchema = createInsertSchema(codeSnippets);

// TypeScript types
export type CodeSnippet = z.infer<typeof selectCodeSnippetSchema>;
export type NewCodeSnippet = z.infer<typeof insertCodeSnippetSchema>;

// Export the table for use in queries
export { codeSnippets };

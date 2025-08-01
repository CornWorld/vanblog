// Re-export from main schema to maintain consistency
import { pipelines } from '../../../database/schema';

export { pipelines };
export type Pipeline = typeof pipelines.$inferSelect;
export type NewPipeline = typeof pipelines.$inferInsert;

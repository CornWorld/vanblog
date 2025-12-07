import { dayjs, toIsoTzString } from '@vanblog/shared';
import { sql } from 'drizzle-orm';

import type { Database } from '../../database';

const normalizeValue = (val: unknown): string => {
  if (typeof val === 'string' && val.trim() !== '') {
    const parsed = dayjs(val);
    if (parsed.isValid()) return toIsoTzString(parsed);
  }
  const now = dayjs();
  return toIsoTzString(now);
};

const isIsoTz = (val: unknown): boolean => {
  if (typeof val !== 'string') return false;
  const s = val.trim();
  if (s.length < 20) return false;
  return /\d{4}-\d{2}-\d{2}T[0-9:.+-Z]+/.test(s) && /([+-]\d{2}:\d{2}|Z)$/.test(s);
};

const tables: { name: string; columns: string[] }[] = [
  { name: 'users', columns: ['created_at', 'updated_at'] },
  { name: 'articles', columns: ['created_at', 'updated_at'] },
  { name: 'categories', columns: ['created_at', 'updated_at'] },
  { name: 'tags', columns: ['created_at'] },
  { name: 'drafts', columns: ['created_at', 'updated_at'] },
  { name: 'draft_versions', columns: ['created_at'] },
  { name: 'static_files', columns: ['created_at'] },
  { name: 'site_meta', columns: ['created_at', 'updated_at'] },
  { name: 'login_logs', columns: ['created_at'] },
  { name: 'custom_pages', columns: ['created_at', 'updated_at'] },
  { name: 'analytics', columns: ['created_at'] },
  { name: 'permission_nodes', columns: ['created_at', 'updated_at'] },
  { name: 'permission_groups', columns: ['created_at', 'updated_at'] },
  { name: 'plugin_data', columns: ['created_at', 'updated_at'] },
  { name: 'webhooks', columns: ['created_at', 'updated_at'] },
  { name: 'webhook_logs', columns: ['created_at'] },
];

export default {
  id: '004_normalize_timestamps',
  name: 'Normalize timestamps to ISO with timezone',
  version: '1.3.0',
  up: async (db: Database): Promise<void> => {
    await Promise.resolve();
    for (const t of tables) {
      for (const col of t.columns) {
        const rows = (await db.all(
          sql`SELECT rowid as id, ${sql.raw(col)} as v FROM ${sql.raw(t.name)}`,
        )) as { id: number; v: unknown }[] | null;
        if (!Array.isArray(rows)) continue;
        for (const r of rows) {
          if (!isIsoTz(r.v)) {
            const nv = normalizeValue(r.v);
            await db.run(
              sql`UPDATE ${sql.raw(t.name)} SET ${sql.raw(col)} = ${nv} WHERE rowid = ${r.id}`,
            );
          }
        }
      }
    }
  },
  down: async (_db: Database): Promise<void> => {
    await Promise.resolve();
  },
} as const;

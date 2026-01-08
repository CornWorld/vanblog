import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';

const client = createClient({ url: ':memory:' });
const db = drizzle(client, {});

console.log('db keys:', Object.keys(db));
console.log('db type:', typeof db);
console.log('db constructor:', db.constructor.name);

// Check all properties
for (const key in db) {
  console.log(`db.${key}:`, typeof db[key]);
}

// Check if client is accessible
console.log('Has client?', 'client' in db);
console.log('db._ ?', db._ ? Object.keys(db._) : 'no _');
console.log('db._.client?', db._?.client);

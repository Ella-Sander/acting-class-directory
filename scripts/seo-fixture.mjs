import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
export function seoFixture({ sharedCache = false } = {}) {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys=ON');
  const migrations = new URL('../migrations/', import.meta.url);
  for (const file of readdirSync(migrations).filter(file => file.endsWith('.sql')).sort()) db.exec(readFileSync(new URL(file, migrations), 'utf8'));
  function prepare(sql, values = []) {
    return { sql, values, bind(...bound) { return prepare(sql, bound); }, async all() { return { results: db.prepare(sql).all(...values) }; }, async first() { return db.prepare(sql).get(...values) || null; } };
  }
  const env = { CANONICAL_ORIGIN: 'https://example.com', DIRECTORY_DB: { prepare, async batch(statements) { db.exec('BEGIN'); try { const results = statements.map(statement => /^\s*(SELECT|WITH|PRAGMA)\b/i.test(statement.sql) ? { results: db.prepare(statement.sql).all(...statement.values) } : db.prepare(statement.sql).run(...statement.values)); db.exec('COMMIT'); return results; } catch (error) { db.exec('ROLLBACK'); throw error; } } }, ASSETS: { async fetch(request) { return new Response(readFileSync(new URL('../index.html', import.meta.url), 'utf8'), { headers: { 'Content-Type': 'text/html' } }); } } };
  if (sharedCache) Object.assign(env, memoryPublicCache());
  return { db, env };
}

export function memoryPublicCache() {
  const values = new Map(); const responses = new Map();
  return {
    PUBLIC_CACHE_STORE: {
      values,
      async get(key, options) { const value = values.get(key); return value == null ? null : options?.type === 'json' ? JSON.parse(value) : value; },
      async put(key, value) { values.set(key, value); },
    },
    PUBLIC_RESPONSE_CACHE: {
      responses,
      async match(request) { const entry = responses.get(request.url); return entry && entry.expires > Date.now() ? entry.response.clone() : undefined; },
      async put(request, response) { const seconds = Number(response.headers.get('Cache-Control')?.match(/max-age=(\d+)/)?.[1] || 0); responses.set(request.url, { response: response.clone(), expires: Date.now() + seconds * 1000 }); },
    },
  };
}

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { queryDirectory } from '../src/directory-data.js';
const db = new DatabaseSync(':memory:');
try {
  db.exec(readFileSync('.wrangler/d1-before-read-indexes-2026-11-15.sql', 'utf8'));
  const prepare = (sql, values = []) => ({ bind(...bound) { return prepare(sql, bound); }, async all() { return { results: db.prepare(sql).all(...values) }; } });
  const env = { DIRECTORY_DB: { prepare } };
  const before = await queryDirectory(env, undefined, JSON.parse(readFileSync('docs/d1-baseline-sql.json', 'utf8')));
  db.exec(readFileSync('migrations/0013_directory_read_indexes.sql', 'utf8'));
  const after = await queryDirectory(env);
  const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  const canonical = value => Array.isArray(value) ? value.map(canonical).sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
  const report = { exactOutputEqual: hash(before) === hash(after), allFieldAndRelationshipValuesEqual: hash(canonical(before)) === hash(canonical(after)), beforeRecords: Object.fromEntries(Object.entries(before).map(([key, values]) => [key, values.length])), afterRecords: Object.fromEntries(Object.entries(after).map(([key, values]) => [key, values.length])) };
  report.differences = [];
  for (const collection of Object.keys(before)) for (const old of before[collection]) {
    const next = after[collection].find(item => item.id === old.id);
    for (const key of Object.keys(old)) if (hash(canonical(old[key])) !== hash(canonical(next[key]))) report.differences.push({ collection, name: old.name, field: key, before: old[key], after: next[key] });
  }
  writeFileSync('docs/d1-data-parity.json', JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report));
  if (!report.allFieldAndRelationshipValuesEqual) process.exitCode = 1;
} finally { db.close(); }

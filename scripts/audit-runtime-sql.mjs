import { readFileSync, writeFileSync } from 'node:fs';
import { seoFixture } from './seo-fixture.mjs';
import { DIRECTORY_QUERIES, listingQuery } from '../src/directory-data.js';
const { db } = seoFixture();
const source = ['worker.js','provider-identity.js','provider-merges.js','provider-merge-rollback.js','provider-preview.js'].map(file=>readFileSync(`src/${file}`,'utf8')).join('\n');
const queries = [...source.matchAll(/\.prepare\(`([^`]+)`\)/g)].map(match => match[1]);
queries.push(...Object.values(DIRECTORY_QUERIES), ...Object.keys(DIRECTORY_QUERIES).map(listingQuery));
const report = { measuredAt: new Date().toISOString(), environment: 'local SQLite full migrations; EXPLAIN only, no mutations; billing rows unavailable', queries: [] };
try {
  for (const sql of new Set(queries)) {
    if (sql.includes('${')) { report.queries.push({ sql, dynamic: true, note: 'Server-side table/column allowlists construct approval/merge/rollback statements; all user values are bound parameters.' }); continue; }
    try {
      const plan = db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...Array((sql.match(/\?/g) || []).length).fill(null));
      report.queries.push({ sql, plan, scans: plan.filter(row => /\bSCAN\b/.test(row.detail)) });
    } catch (error) { report.queries.push({ sql, error: error.message }); process.exitCode = 1; }
  }
} finally { db.close(); }
writeFileSync('docs/d1-runtime-query-plans.json', JSON.stringify(report, null, 2) + '\n');
console.log(`Explained ${report.queries.length} runtime SQL shapes. See docs/d1-runtime-query-plans.json.`);

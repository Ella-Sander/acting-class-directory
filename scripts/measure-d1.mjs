import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { seoFixture } from './seo-fixture.mjs';
const stage = process.argv.includes('--after') ? 'after' : 'before';
const remote = process.argv.includes('--remote');
const source = readFileSync(existsSync('src/directory-data.js') ? 'src/directory-data.js' : 'src/worker.js', 'utf8');
const queries = Object.fromEntries(['PROVIDERS', 'OFFERINGS', 'TEACHERS'].map(name => [name.toLowerCase(), runInNewContext(source.match(new RegExp(`(?:export )?const ${name}_SQL = (\x60[\\s\\S]*?\x60);`))[1])]));
const { db } = seoFixture();
if (stage === 'before' && !existsSync('docs/d1-baseline-sql.json')) writeFileSync('docs/d1-baseline-sql.json', JSON.stringify(queries, null, 2) + '\n');
if (process.argv.includes('--baseline-sql')) Object.assign(queries, JSON.parse(readFileSync('docs/d1-baseline-sql.json', 'utf8')));
const report = { stage, environment: remote ? 'production D1 API' : 'local node:sqlite (plans/duration only; no billing row counts)', measuredAt: new Date().toISOString(), queries: {}, indexes: [] };
let execute;
if (remote) {
  const credentials = readFileSync(join(process.env.APPDATA, 'xdg.config', '.wrangler', 'config', 'default.toml'), 'utf8');
  const token = process.env.CLOUDFLARE_API_TOKEN || credentials.match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];
  execute = async (sql, params = []) => {
    const response = await fetch('https://api.cloudflare.com/client/v4/accounts/735c5b7e1a6013843699cc6e6fb4b5f6/d1/database/05ca97de-b898-45ab-8740-6f8f1456ef6d/query', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ sql, params }) });
    const data = await response.json();
    if (!data.success) throw new Error(JSON.stringify(data.errors));
    return data.result[0];
  };
} else execute = async (sql, params = []) => { const start = performance.now(); const results = db.prepare(sql).all(...params); return { results, meta: { duration: performance.now() - start, rows_read: null } }; };
try {
  report.indexes = (await execute("SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index' ORDER BY tbl_name,name")).results;
  for (const [name, sql] of Object.entries(queries)) {
    try {
      const plan = (await execute(`EXPLAIN QUERY PLAN ${sql}`)).results;
      const result = await execute(sql);
      report.queries[name] = { records: result.results.length, meta: result.meta, plan };
      if (stage === 'after' && process.argv.includes('--profiles')) {
        const { listingQuery } = await import('../src/directory-data.js');
        const profileSql = listingQuery(name); const slug = result.results[0].slug;
        const profile = await execute(profileSql, [slug]);
        report.profiles ||= {};
        report.profiles[name] = { slug, records: profile.results.length, meta: profile.meta, plan: (await execute(`EXPLAIN QUERY PLAN ${profileSql}`, [slug])).results };
      }
      console.log(JSON.stringify({ stage, environment: report.environment, query: name, records: result.results.length, meta: result.meta }));
    } catch (error) { report.queries[name] = { error: error.message }; console.log(`${name}: ${error.message}`); }
  }
} finally {
  db.close(); writeFileSync(`docs/d1-${stage}-${remote ? 'production' : 'local'}.json`, JSON.stringify(report, null, 2) + '\n');
}

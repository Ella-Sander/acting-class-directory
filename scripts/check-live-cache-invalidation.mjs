import { readFileSync, writeFileSync } from 'node:fs';
const raw = readFileSync('.dev.vars', 'utf8').match(/^ADMIN_REVIEW_KEY\s*=\s*(.+)$/m)?.[1].trim();
if (!raw) throw new Error('Review credential unavailable.');
const response = await fetch('https://vocalcatalog.com/api/admin/cache/invalidate', { method: 'POST', headers: { Authorization: `Bearer ${raw.replace(/^['"]|['"]$/g, '')}` } });
const report = { checkedAt: new Date().toISOString(), invalidationStatus: response.status, invalidation: await response.json(), requests: [] };
if (!response.ok) throw new Error('Cache invalidation failed.');
for (let i = 0; i < 2; i++) {
  const response = await fetch('https://vocalcatalog.com/api/directory'); const data = await response.json();
  report.requests.push({ status: response.status, cache: response.headers.get('X-Public-Cache'), queries: response.headers.get('X-D1-Queries'), rowsRead: response.headers.get('X-D1-Rows-Read'), teachers: data.teachers.length, offerings: data.offerings.length, providers: data.providers.length });
}
writeFileSync('docs/d1-live-invalidation.json', JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report));
if (report.requests.at(-1).queries !== '0') process.exitCode = 1;

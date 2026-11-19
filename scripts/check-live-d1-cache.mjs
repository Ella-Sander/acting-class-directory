import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const origin = 'https://vocalcatalog.com';
const report = { measuredAt: new Date().toISOString(), environment: 'production HTTP requests; D1 headers come from actual binding metadata', requests: [], failures: [] };
async function get(path) {
  const start = performance.now();
  const response = await fetch(origin + path, { signal: AbortSignal.timeout(30000) }); const text = await response.text();
  report.requests.push({ path, status: response.status, cache: response.headers.get('X-Public-Cache'), queries: response.headers.get('X-D1-Queries'), rowsRead: response.headers.get('X-D1-Rows-Read'), elapsedMs: performance.now() - start });
  if (response.status !== 200) report.failures.push(`${path}: ${response.status}`);
  return { text, response };
}
try {
  const directory = await get('/api/directory');
  const data = JSON.parse(directory.text);
  report.records = { providers: data.providers.length, offerings: data.offerings.length, teachers: data.teachers.length };
  report.publicPayloadHash = createHash('sha256').update(directory.text).digest('hex');
  await get('/api/directory');
  for (const path of ['/', `/api/teachers/${data.teachers[0].slug}`, `/teachers/${data.teachers[0].slug}/`, `/api/providers/${data.providers[0].slug}`, `/providers/${data.providers[0].slug}/`, `/api/offerings/${data.offerings[0].slug}`, `/classes/${data.offerings[0].slug}/`, '/sitemap.xml', '/sitemap-coaches.xml', '/?category=dialects&q=Julie', '/?sort=institute']) {
    await get(path); await get(path);
    const second = report.requests.at(-1);
    if (second.queries !== '0' || second.rowsRead !== '0') report.failures.push(`${path}: repeated request queried D1`);
  }
  console.log(JSON.stringify(report, null, 2));
} finally { writeFileSync('docs/d1-live-cache.json', JSON.stringify(report, null, 2) + '\n'); }
if (report.failures.length) process.exitCode = 1;

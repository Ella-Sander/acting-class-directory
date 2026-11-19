import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const origin = 'https://vocalcatalog.com';
const report = { checkedAt: new Date().toISOString(), failures: [], checked: 0, d1Queries: 0, d1RowsRead: 0 };
const get = async (path, expected = 200, options = {}) => {
  const response = await fetch(new URL(path, origin), { redirect: 'manual', signal: AbortSignal.timeout(20000), ...options });
  report.checked++;
  assert.equal(response.status, expected, `${path}: HTTP ${response.status}`);
  const queries = response.headers.get('X-D1-Queries');
  const rows = response.headers.get('X-D1-Rows-Read');
  assert.equal(queries, '0', `${path}: D1 queries ${queries}`);
  assert.equal(rows, '0', `${path}: D1 rows ${rows}`);
  return response;
};
try {
  const directoryText = await (await get('/api/directory')).text();
  const directory = JSON.parse(directoryText);
  const before = JSON.parse(readFileSync('docs/d1-deploy-before.json', 'utf8'));
  report.hash = createHash('sha256').update(directoryText).digest('hex');
  assert.equal(report.hash, before.publicPayloadHash, 'Directory payload changed');
  report.records = Object.fromEntries(Object.entries(directory).map(([key, items]) => [key, items.length]));
  const paths = [];
  for (const [collection, items] of Object.entries(directory)) for (const item of items) {
    paths.push(`/api/${collection}/${item.slug}`);
    paths.push(`/${collection === 'offerings' ? 'classes' : collection}/${item.slug}/`);
  }
  let cursor = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (cursor < paths.length) {
      const path = paths[cursor++];
      try { await (await get(path)).arrayBuffer(); }
      catch (error) { report.failures.push(error.message); }
    }
  }));
  report.profileUrls = paths.length;
  for (const path of ['/api/providers/deployment-nonexistent', '/teachers/deployment-nonexistent/', '/?page=99999']) await get(path, 404);
  const first = await (await get('/')).text();
  const second = await (await get('/?page=2')).text();
  assert.notEqual(first, second, 'Pagination cache collision');
  assert.match(second, /Page 2/);
  assert.match(second, /rel="canonical" href="https:\/\/vocalcatalog.com\/\?page=2"/);
  for (const path of ['/api/admin/submissions', '/api/admin/cache/invalidate']) {
    const response = await get(path, 401, path.endsWith('invalidate') ? { method: 'POST' } : {});
    assert.match(response.headers.get('Cache-Control'), /no-store/);
    assert.notEqual(response.headers.get('X-Public-Cache'), 'HIT');
  }
  for (const path of ['/?q=Julie&category=dialects', '/?sort=institute', '/admin/review/']) {
    const response = await get(path);
    assert.match(response.headers.get('Cache-Control'), /no-store/);
    assert.match(response.headers.get('X-Robots-Tag'), /noindex/);
  }
  const sitemap = await (await get('/sitemap.xml')).text();
  for (const match of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) await (await get(match[1])).text();
} catch (error) { report.failures.push(error.message); }
writeFileSync('docs/d1-deployment-verification.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
if (report.failures.length) process.exitCode = 1;

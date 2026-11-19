import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PUBLIC_ORIGIN, LEGACY_HOST, HOME_TITLE, HOME_H1, HOME_DESCRIPTION } from '../src/brand.js';
const baseline = process.argv.includes('--baseline');
const origin = baseline ? `https://${LEGACY_HOST}` : PUBLIC_ORIGIN;
const report = { origin, checkedAt: new Date().toISOString(), failures: [] };
const requireCheck = (condition, message) => { if (!condition) report.failures.push(message); };
const get = (url, options = {}) => fetch(new URL(url, origin), { signal: AbortSignal.timeout(20000), ...options });
const decode = value => value.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>');
const locations = xml => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => decode(match[1]));
async function parallel(items, task, concurrency = 6) {
  let index = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => { while (index < items.length) { const item = items[index++]; try { await task(item); } catch (error) { report.failures.push(`${item}: ${error.message}`); } } }));
}
try {
  const api = await get('/api/directory'); requireCheck(api.status === 200, 'Directory API status');
  const directory = await api.json();
  report.data = { teachers: directory.teachers.length, classes: directory.offerings.length, providers: directory.providers.length, sha256: createHash('sha256').update(JSON.stringify(directory)).digest('hex') };
  if (baseline) { console.log(JSON.stringify(report)); }
  else {
    const previous = JSON.parse(readFileSync('docs/launch-baseline.json', 'utf8'));
    requireCheck(report.data.sha256 === previous.data.sha256, 'Public directory data changed during deployment');
    const health = await (await get('/api/health')).json(); requireCheck(health.ok && health.databaseConfigured, 'D1 health'); report.health = health;
    const robots = await get('/robots.txt'); const text = await robots.text(); requireCheck(robots.status === 200 && text.includes(`Sitemap: ${PUBLIC_ORIGIN}/sitemap.xml`) && !text.includes('Disallow: /'), 'Robots sitemap and permissions');
    const sitemap = await get('/sitemap.xml'); const xml = await sitemap.text(); requireCheck(sitemap.status === 200 && /application\/xml/.test(sitemap.headers.get('content-type')), 'Sitemap XML content type/status');
    const urls = [];
    report.sitemaps = [];
    for (const child of locations(xml)) { const response = await get(child); const xml = await response.text(); requireCheck(response.status === 200 && xml.includes('<urlset '), `Sitemap ${child}`); const entries = locations(xml); requireCheck(entries.length > 0, `Empty sitemap ${child}`); report.sitemaps.push({ url: child, urls: entries.length }); urls.push(...entries); }
    requireCheck(new Set(urls).size === urls.length, 'Duplicate sitemap URLs');
    const titleSet = new Set(); const descriptionSet = new Set(); const linkGraph = new Map(); const validPaths = new Set(urls.map(value => { const url = new URL(value); return url.pathname + url.search; }));
    report.metadataExamples = [];
    await parallel(urls, async url => {
      requireCheck(url.startsWith(PUBLIC_ORIGIN + '/'), `Wrong sitemap origin ${url}`);
      const response = await get(url, { redirect: 'manual' }); const html = await response.text();
      requireCheck(response.status === 200, `Non-200 sitemap URL ${url}: ${response.status}`);
      const title = decode(html.match(/<title>([^<]+)<\/title>/)?.[1] || '');
      const description = decode(html.match(/name="description" content="([^"]+)"/)?.[1] || '');
      const canonical = decode(html.match(/rel="canonical" href="([^"]+)"/)?.[1] || '');
      requireCheck(canonical === url, `Canonical mismatch ${url}`);
      requireCheck(title.endsWith(' | Vocal Catalog') && !titleSet.has(title), `Missing/duplicate title ${url}`); titleSet.add(title);
      requireCheck(description.length > 30 && !descriptionSet.has(description), `Missing/duplicate description ${url}`); descriptionSet.add(description);
      requireCheck(!/voxline/i.test(html), `Obsolete public branding ${url}`);
      requireCheck(/name="robots" content="index, follow/.test(html), `Unexpected noindex ${url}`);
      const body = html.split('<div id="root">')[1]?.split('<script type="module"')[0] || '';
      requireCheck([...body.matchAll(/<h1[ >]/g)].length === 1, `Server H1 count ${url}`);
      const graph = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1] || '{}');
      requireCheck(graph['@context'] === 'https://schema.org' && graph['@graph']?.some(node => node['@type'] === 'BreadcrumbList'), `Schema missing ${url}`);
      const targets = [...body.matchAll(/href="(\/[^"#]*)(?:#[^"]*)?"/g)].map(match => decode(match[1]));
      for (const path of targets) requireCheck(validPaths.has(path) || path === '/', `Broken internal target ${path}`);
      const parsed = new URL(url); linkGraph.set(parsed.pathname + parsed.search, targets);
      if (report.metadataExamples.length < 3) report.metadataExamples.push({ url, title, description, canonical });
      if (url === PUBLIC_ORIGIN + '/') { requireCheck(title === HOME_TITLE && description === HOME_DESCRIPTION && body.includes(`<h1>${HOME_H1}</h1>`), 'Exact homepage copy'); report.analytics = { googleAnalytics: /googletagmanager|google-analytics|gtag\(/.test(html), searchConsoleMeta: /google-site-verification/.test(html), cloudflareBeacon: /cloudflareinsights|beacon\.min\.js/.test(html) }; }
    });
    const reached = new Set(); const pending = ['/']; while (pending.length) { const path = pending.shift(); if (reached.has(path)) continue; reached.add(path); pending.push(...(linkGraph.get(path) || [])); }
    requireCheck([...validPaths].every(path => reached.has(path)), 'Sitemap contains orphaned URLs');
    report.canonicalUrlsChecked = urls.length;
    report.indexableProfiles = directory.teachers.length + directory.providers.length + directory.offerings.length;
    const logos = [...new Set([...directory.teachers, ...directory.providers, ...directory.offerings].map(item => item.logo?.url).filter(Boolean))];
    await parallel(logos, async path => { const response = await get(path); requireCheck(response.status === 200 && response.headers.get('content-type')?.startsWith('image/'), `Broken logo ${path}`); await response.arrayBuffer(); }); report.logosChecked = logos.length;
    for (const path of ['/favicon.svg', '/social-card.png', '/site.webmanifest']) { const response = await get(path); requireCheck(response.status === 200, `Missing brand asset ${path}`); }
    const legacyPath = `/teachers/${directory.teachers[0].slug}/?ref=launch`;
    report.redirects = [];
    for (const source of [`http://vocalcatalog.com${legacyPath}`, `http://www.vocalcatalog.com${legacyPath}`, `https://www.vocalcatalog.com${legacyPath}`, `https://${LEGACY_HOST}${legacyPath}`]) {
      const response = await get(source, { redirect: 'manual' }); const destination = response.headers.get('location');
      requireCheck([301, 308].includes(response.status) && destination === PUBLIC_ORIGIN + legacyPath, `Redirect mismatch ${source}: ${response.status} ${destination}`);
      report.redirects.push({ source, status: response.status, destination });
    }
    for (const path of ['/teachers/nonexistent-launch-check/', '/?page=99999']) requireCheck((await get(path, { redirect: 'manual' })).status === 404, `Missing route did not return 404: ${path}`);
    for (const path of ['/?q=Julie&category=dialects', '/?sort=name', '/admin/review/']) { const response = await get(path); requireCheck(response.status === 200 && response.headers.get('x-robots-tag')?.includes('noindex'), `Noindex guard ${path}`); }
    const oldProfile = await get(`/?listing=${directory.teachers[0].slug}`, { redirect: 'manual' }); requireCheck(oldProfile.status === 308 && oldProfile.headers.get('location') === `${PUBLIC_ORIGIN}/teachers/${directory.teachers[0].slug}/`, 'Legacy query profile redirect');
    console.log(JSON.stringify({ ...report, metadataExamples: undefined }, null, 2));
  }
} finally {
  writeFileSync(`docs/launch-${baseline ? 'baseline' : 'live-checks'}.json`, JSON.stringify(report, null, 2) + '\n');
}
if (report.failures.length) process.exitCode = 1;

import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { getDirectory, invalidateDirectory } from '../src/worker.js';
import { buildCatalog, sitemapGroups, listingPath, safeJson, CONTENT_UPDATED } from '../src/seo.js';
import { seoFixture } from '../scripts/seo-fixture.mjs';
import { verifiedAffiliations } from '../src/teacher-facts.js';

const request = path => new Request(`https://example.com${path}`);
const decode = text => text.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>');
const locations = xml => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => decode(match[1]));
test('every sitemap URL is unique, canonical, indexable and rendered with valid metadata, links and schema', async () => {
  const { db, env } = seoFixture({ sharedCache: true });
  try {
    const catalog = buildCatalog(await getDirectory(env));
    assert.equal(catalog.listings.length, 22, 'Only primary providers appear as directory results');
    assert.equal(catalog.profiles.filter(item => item.kind === 'teacher').length, 216);
    const response = await worker.fetch(request('/sitemap.xml'), env);
    const xml = await response.text();
    assert.match(xml, /<sitemapindex xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9">/);
    const all = [];
    for (const child of locations(xml)) {
      const response = await worker.fetch(new Request(child), env);
      assert.equal(response.status, 200, child);
      const xml = await response.text();
      assert.match(xml, /<urlset /);
      assert.ok(locations(xml).length);
      assert.equal([...xml.matchAll(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/g)].length, locations(xml).length);
      all.push(...locations(xml));
    }
    assert.equal(new Set(all).size, all.length, 'No duplicated sitemap URLs');
    const validPaths = new Set(all.map(url => { const u = new URL(url); return u.pathname + u.search; }));
    const titles = new Set();
    const descriptions = new Set();
    const links = new Map();
    for (const url of all) {
      const response = await worker.fetch(new Request(url), env);
      assert.equal(response.status, 200, url);
      const html = await response.text();
      const root = html.split('<div id="root">')[1].split('<script type="module"')[0];
      assert.equal([...root.matchAll(/<h1[ >]/g)].length, 1, url);
      assert.match(html, /name="robots" content="index, follow/);
      assert.ok(html.includes(`rel="canonical" href="${url.replaceAll('&', '&amp;')}"`), url);
      const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
      assert.ok(title && !titles.has(title), `Unique title: ${title}`); titles.add(title);
      assert.match(html, /name="description" content="[^"]{30,}"/);
      const description = html.match(/name="description" content="([^"]+)"/)[1];
      assert.ok(!descriptions.has(description), `Unique description on ${url}`); descriptions.add(description);
      assert.match(html, /property="og:image"/);
      assert.match(html, /name="twitter:card"/);
      const schema = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
      assert.equal(schema['@context'], 'https://schema.org');
      assert.ok(schema['@graph'].some(node => node['@type'] === 'BreadcrumbList'));
      assert.ok(!JSON.stringify(schema).includes('aggregateRating'));
      const targets = [];
      for (const match of root.matchAll(/href="(\/[^"#]*)(?:#[^"]*)?"/g)) {
        const path = decode(match[1]);
        assert.ok(validPaths.has(path) || path === '/', `Broken/orphaned internal target ${path} on ${url}`);
        targets.push(path);
      }
      const parsed = new URL(url); links.set(parsed.pathname + parsed.search, targets);
    }
    const reached = new Set(); const pending = ['/'];
    while (pending.length) { const path = pending.shift(); if (reached.has(path)) continue; reached.add(path); pending.push(...(links.get(path) || [])); }
    assert.deepEqual([...validPaths].filter(path => !reached.has(path)), [], 'Every sitemap URL is reachable through ordinary HTML links from the homepage');
  } finally { db.close(); }
});

test('canonical aliases, parameters, pagination, missing pages, administrative robots and HTTPS behave correctly', async () => {
  const { db, env } = seoFixture();
  try {
    const catalog = buildCatalog(await getDirectory(env));
    const item = catalog.profiles[0];
    for (const [path, destination] of [[`/?listing=${item.slug}`, listingPath(item)], [listingPath(item).slice(0,-1), listingPath(item)], ['/?utm_source=test', '/'], ['/?page=1', '/']]) {
      const response = await worker.fetch(request(path), env);
      assert.equal(response.status, 308); assert.equal(new URL(response.headers.get('location')).pathname + new URL(response.headers.get('location')).search, destination);
    }
    assert.equal((await worker.fetch(new Request('http://example.com/'), env)).status, 308);
    for (const path of ['/not-a-page/', '/teachers/missing/', '/?listing=missing', '/?page=999', '/?page=0', '/?page=NaN', '/missing.html/']) assert.equal((await worker.fetch(request(path), env)).status, 404, path);
    for (const path of ['/?q=singing', '/?sort=name', '/admin/review/']) {
      const response = await worker.fetch(request(path), env); assert.equal(response.status, 200); assert.match(response.headers.get('X-Robots-Tag'), /noindex/);
    }
    const page2 = await (await worker.fetch(request('/?page=2'), env)).text();
    assert.match(page2, /Page 2/); assert.match(page2, /rel="prev" href="\/"/); assert.doesNotMatch(page2, /rel="next"/);
    assert.match(await (await worker.fetch(request('/robots.txt'), env)).text(), /Sitemap: https:\/\/example.com\/sitemap.xml/);
    const head = await worker.fetch(new Request('https://example.com/', { method: 'HEAD' }), env); assert.equal(await head.text(), '');
  } finally { db.close(); }
});

test('publication changes update sitemap and profiles; pending and archived records never leak', async () => {
  const { db, env } = seoFixture();
  try {
    const first = (await getDirectory(env)).teachers.find(item => verifiedAffiliations(item).length);
    db.prepare("UPDATE instructors SET profile_status='archived' WHERE id=?").run(first.id);
    await invalidateDirectory(env);
    assert.equal((await worker.fetch(request(`/teachers/${first.slug}/`), env)).status, 404);
    assert.ok(!(await (await worker.fetch(request('/sitemap-coaches.xml'), env)).text()).includes(`/teachers/${first.slug}/`));
    db.prepare("UPDATE instructors SET profile_status='published' WHERE id=?").run(first.id);
    await invalidateDirectory(env);
    assert.equal((await worker.fetch(request(`/teachers/${first.slug}/`), env)).status, 200);
    assert.ok((await (await worker.fetch(request('/sitemap-coaches.xml'), env)).text()).includes(`/teachers/${first.slug}/`));
    assert.ok(!(await getDirectory(env)).teachers.some(item => 'terms_json' in item));
    assert.deepEqual(sitemapGroups(buildCatalog({ teachers: [], providers: [], offerings: [] })), { pages: [{ path: '/', lastmod: CONTENT_UPDATED }] });
    assert.ok(!safeJson({ name: '</script><script>alert(1)</script>' }).includes('<'));
  } finally { db.close(); }
});

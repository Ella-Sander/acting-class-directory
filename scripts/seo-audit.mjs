import { writeFileSync } from 'node:fs';
import { seoFixture } from './seo-fixture.mjs';
import { getDirectory } from '../src/worker.js';
import { buildCatalog, sitemapGroups, resolvePage, listingPath } from '../src/seo.js';
const { db, env } = seoFixture();
try {
  const catalog = buildCatalog(await getDirectory(env));
  const origin = 'https://vocalcatalog.com';
  const examples = ['/', listingPath(catalog.profiles[0]), catalog.pages[0].path].map(path => {
    const page = resolvePage(new URL(path, origin), catalog, origin);
    return { path, title: page.title, description: page.description, canonical: page.canonical, schema: page.schema };
  });
  const groups = sitemapGroups(catalog);
  const report = { source: 'Local full migration catalog; not a remote database or Search Console audit', origin, listings: catalog.listings.length, profiles: { teachers: catalog.profiles.filter(x => x.kind === 'teacher').length, classes: catalog.profiles.filter(x => x.kind === 'offering').length, schoolsAndStudios: catalog.profiles.filter(x => x.kind === 'provider').length }, landingPages: catalog.pages.length, sitemapUrls: Object.fromEntries(Object.entries(groups).map(([key, entries]) => [key, entries.length])), totalCanonicalUrls: Object.values(groups).flat().length, pages: catalog.pages.map(page => ({ path: page.path, count: page.items.length })), omitted: catalog.omitted, examples };
  writeFileSync('docs/seo-report.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ ...report, pages: undefined, examples: undefined, omitted: undefined }, null, 2));
} finally { db.close(); }

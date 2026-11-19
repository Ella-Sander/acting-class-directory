import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSavedListings, readSavedListings, writeSavedListings, toggleSavedListing, SAVED_LISTINGS_KEY } from '../src/saved-listings.js';
import worker from '../src/worker.js';
import { seoFixture } from '../scripts/seo-fixture.mjs';

test('saved choices persist as typed listing IDs and toggle without changing listing data', () => {
  const values = new Map(); const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  let saved = toggleSavedListing([], 'teacher:voice-teacher'); saved = toggleSavedListing(saved, 'offering:group-class');
  assert.equal(writeSavedListings(storage, saved), true); assert.deepEqual(readSavedListings(storage), saved);
  assert.deepEqual(toggleSavedListing(saved, 'teacher:voice-teacher'), ['offering:group-class']);
  assert.deepEqual(JSON.parse(values.get(SAVED_LISTINGS_KEY)), saved);
  assert.deepEqual(toggleSavedListing(saved, 'javascript:alert(1)'), saved);
});

test('invalid, duplicated, blocked and corrupt storage is handled safely', () => {
  assert.deepEqual(normalizeSavedListings(['teacher:a', 'teacher:a', 'https://other.example/', { name: 'not a path' }, '/admin/review/', 'provider:school']), ['teacher:a', 'provider:school']);
  assert.deepEqual(readSavedListings({ getItem() { return '{broken'; } }), []);
  assert.deepEqual(readSavedListings({ getItem() { throw new Error('Disabled'); } }), []);
  assert.equal(writeSavedListings({ setItem() { throw new Error('Quota'); } }, ['teacher:a']), false);
  assert.equal(writeSavedListings(undefined, []), false);
});

test('saved view remains browser-private, no-store, noindex and supports private pagination', async () => {
  const { db, env } = seoFixture({ sharedCache: true });
  try {
    const response = await worker.fetch(new Request('https://example.com/?saved=1&page=14'), env);
    assert.equal(response.status, 200); assert.match(response.headers.get('Cache-Control'), /no-store/);
    const html = await response.text(); assert.match(html, /name="robots" content="noindex, follow"/);
    assert.match(html, /rel="canonical" href="https:\/\/example.com\/"/);
    const sitemap = await (await worker.fetch(new Request('https://example.com/sitemap-pages.xml'), env)).text(); assert.ok(!sitemap.includes('saved='));
  } finally { db.close(); }
});

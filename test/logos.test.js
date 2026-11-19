import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import catalog from '../data/listing-logos.json' with { type: 'json' };
import review from '../data/logo-review.json' with { type: 'json' };
import { resolveListingLogo } from '../src/listing-logos.js';

test('every verified logo has provenance and an intact local image', async () => {
  for (const brand of Object.values(catalog.brands)) {
    assert.equal(brand.status, 'verified');
    assert.match(brand.sourceUrl, /^https:\/\//);
    assert.match(brand.assetUrl, /^https:\/\//);
    assert.match(brand.url, /^\/logos\/[a-z0-9-]+\.(png|jpg|webp|svg)$/);
    const bytes = await fs.readFile(new URL(`../public${brand.url}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), brand.sha256);
  }
  assert.equal(review.listings.length, 200);
  assert.equal(new Set(review.listings.map(x => x.id)).size, 200);
  for (const listing of review.listings) {
    if (listing.status === 'verified') assert.ok(Object.values(catalog.brands).some(x => x.url === listing.logoUrl));
    else { assert.equal(listing.logoUrl, null); assert.ok(listing.notes); }
  }
});

test('organization logos require a recorded affiliation or class provider', () => {
  const provider = 'catalog-provider-bkcm';
  assert.equal(resolveListingLogo({ id: 'unknown', source_url: 'https://bkcm.org/' }, 'teacher'), null);
  assert.equal(resolveListingLogo({ id: 'unknown', affiliations: [{ id: provider, name: 'BKCM' }] }, 'teacher').relationship, 'affiliation');
  assert.equal(resolveListingLogo({ id: 'unknown', provider_id: provider }, 'offering').relationship, 'provider');
  assert.equal(resolveListingLogo({ id: 'unknown', provider_id: 'unknown' }, 'offering'), null);
  assert.equal(resolveListingLogo({ id: 'vocal-dawn-winiarz', affiliations: [{ id: provider }] }, 'teacher').relationship, 'own');
});

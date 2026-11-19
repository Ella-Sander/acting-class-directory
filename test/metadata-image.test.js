import test from 'node:test';
import assert from 'node:assert/strict';
import { safeMetadataImageUrl } from '../src/metadata-image.js';
import { resolveListingImage } from '../src/listing-logos.js';

test('metadata image URLs must be HTTPS and must not target local or credentialed hosts', () => {
  assert.equal(safeMetadataImageUrl('https://cdn.example.com/hero.jpg#crop'), 'https://cdn.example.com/hero.jpg');
  for (const url of [
    'http://cdn.example.com/hero.jpg',
    'javascript:alert(1)',
    'https://user:password@cdn.example.com/hero.jpg',
    'https://localhost/hero.jpg',
    'https://service.local/hero.jpg',
    'https://127.0.0.1/hero.jpg',
    'https://[::1]/hero.jpg',
    'https://cdn.example.com:8443/hero.jpg',
    '//cdn.example.com/hero.jpg',
  ]) assert.equal(safeMetadataImageUrl(url), '', url);
});

test('verified curated logos keep priority over provider metadata images', () => {
  const image = resolveListingImage({
    id: 'provider-new-york-vocal-coaching',
    name: 'New York Vocal Coaching',
    metadata_image_url: 'https://cdn.example.com/hero.jpg',
  }, 'provider');
  assert.equal(image.type, 'logo');
  assert.equal(image.url, '/logos/provider-new-york-vocal-coaching.svg');
});

test('provider website metadata is used only when a curated logo is unavailable', () => {
  const item = { id: 'unknown-provider', name: 'Example Studio', kind: 'provider', metadata_image_url: 'https://cdn.example.com/hero.jpg' };
  assert.deepEqual(resolveListingImage(item), {
    type: 'metadata', url: 'https://cdn.example.com/hero.jpg', alt: 'Example Studio website image', logo: null,
  });
  assert.equal(resolveListingImage({ ...item, metadata_image_url: 'http://cdn.example.com/hero.jpg' }), null);
  assert.equal(resolveListingImage({ ...item, metadata_image_url: null }), null);
});

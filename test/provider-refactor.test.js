import test from 'node:test';
import assert from 'node:assert/strict';
import { seoFixture } from '../scripts/seo-fixture.mjs';
import { queryDirectory } from '../src/directory-data.js';
import { mergeListings } from '../src/directory-utils.js';
import { providerClassification, verifiedLessonFormats } from '../src/teacher-facts.js';

test('primary results are providers; classes and faculty stay attached through verified relationships', async () => {
  const { db, env } = seoFixture();
  try {
    const directory = await queryDirectory(env);
    assert.equal(mergeListings(directory).length, directory.providers.length);
    assert.ok(directory.providers.every(provider => providerClassification({ ...provider, kind: 'provider' }).value));
    assert.ok(directory.providers.every(provider => provider.offerings.every(offering => offering.provider_id === provider.id)));
    assert.ok(directory.providers.some(provider => provider.instructors.length > 0));
    assert.ok(directory.offerings.every(offering => offering.provider_slug || !offering.provider_name));
    const unverifiedMode = directory.offerings.find(item => !item.instructionModeVerified && !item.workshopVerified);
    assert.ok(unverifiedMode);
    assert.equal(verifiedLessonFormats({ ...unverifiedMode, kind: 'offering' }).length, 0);
  } finally { db.close(); }
});

test('duplicate import guards distinguish exact identity from a shared domain', () => {
  const { db } = seoFixture();
  const insert = (id, slug, name, website) => db.prepare(`INSERT INTO providers(id,slug,listing_type,name,website_url,listing_status) VALUES(?,?,'studio',?,?,'published')`).run(id, slug, name, website);
  try {
    insert('shared-a', 'shared-a', 'Shared Domain Studio A', 'https://shared.example/studio-a');
    assert.doesNotThrow(() => insert('shared-b', 'shared-b', 'Shared Domain Studio B', 'https://shared.example/studio-b'));
    assert.throws(() => insert('shared-a-duplicate', 'shared-a-duplicate', 'Shared Domain Studio A', 'https://shared.example/studio-a'), /duplicate_provider_identity/);
  } finally { db.close(); }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker, { getDirectory } from '../src/worker.js';
import { seoFixture } from '../scripts/seo-fixture.mjs';
import { BRAND, PUBLIC_ORIGIN, LEGACY_HOST, HOME_H1, HOME_TITLE, HOME_DESCRIPTION } from '../src/brand.js';

test('production brand, canonical host redirects, and isolated preview behavior', async () => {
  const { db, env } = seoFixture(); env.CANONICAL_ORIGIN = PUBLIC_ORIGIN;
  try {
    const response = await worker.fetch(new Request(PUBLIC_ORIGIN), env);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.ok(html.includes(`<h1>${HOME_H1}</h1>`));
    assert.ok(html.includes(`<title>${HOME_TITLE.replace('&', '&amp;')}</title>`));
    assert.ok(html.includes(`name="description" content="${HOME_DESCRIPTION}"`));
    assert.ok(!/voxline/i.test(html));
    assert.ok(html.includes(`rel="canonical" href="${PUBLIC_ORIGIN}/"`));
    assert.ok(html.includes(`name="${BRAND}"`) || html.includes(`"name":"${BRAND}"`));
    for (const origin of ['http://vocalcatalog.com', 'http://www.vocalcatalog.com', 'https://www.vocalcatalog.com', `https://${LEGACY_HOST}`]) {
      const response = await worker.fetch(new Request(`${origin}/teachers/example/?q=voice&page=2`), env);
      assert.equal(response.status, 308);
      assert.equal(response.headers.get('location'), `${PUBLIC_ORIGIN}/teachers/example/?q=voice&page=2`);
    }
    for (const origin of ['https://preview-example.workers.dev', 'https://version.acting-class-directory.ellasanderella.workers.dev', 'http://127.0.0.1:5173']) {
      const response = await worker.fetch(new Request(origin), env);
      assert.equal(response.status, 200, origin);
      assert.ok(!response.headers.get('location'));
      if (!origin.includes('127.0.0.1')) { assert.match(response.headers.get('X-Robots-Tag'), /noindex/); assert.ok((await response.text()).includes(`rel="canonical" href="${PUBLIC_ORIGIN}/"`)); }
    }
    const config = JSON.parse(readFileSync('wrangler.production.jsonc', 'utf8'));
    assert.equal(config.vars.CANONICAL_ORIGIN, PUBLIC_ORIGIN);
    assert.equal(config.d1_databases[0].database_id, '05ca97de-b898-45ab-8740-6f8f1456ef6d');
    assert.ok(config.routes.some(route => route.pattern === 'www.vocalcatalog.com' && route.custom_domain));
  } finally { db.close(); }
});

test('submission and approval SQL bindings work safely against the full schema', async () => {
  const { db, env } = seoFixture(); env.ADMIN_REVIEW_KEY = 'isolated-test-key';
  const call = async (path, body, admin = false) => worker.fetch(new Request(`https://example.com${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(admin ? { Authorization: `Bearer ${env.ADMIN_REVIEW_KEY}` } : {}) }, body: JSON.stringify(body) }), env);
  try {
    const before = await getDirectory(env);
    for (const submission of [
      { type: 'teacher', name: 'Launch test teacher', biography: 'Documented biography', teaching_experience: 'Teaching history', borough: 'Manhattan', training_types: ['voice-lessons'] },
      { type: 'provider', name: 'Launch test studio', listing_type: 'studio', borough: 'Brooklyn', teaching_approach: 'Singing instruction', training_types: ['voice-lessons'] },
      { type: 'offering', name: 'Launch test class', provider_id: before.providers[0].id, registration_url: 'https://example.org/enroll', price_min: 100, price_max: 150, price_basis: 'full_course', format: 'in_person', borough: 'Manhattan', training_types: ['group-singing-classes'] },
    ]) {
      const response = await call('/api/submissions', { description: 'Official source description for a test submission.', contact_email: 'test@example.org', website_url: 'https://example.org/', ...submission });
      assert.equal(response.status, 201, JSON.stringify(await response.clone().json()));
      const { submissionId } = await response.json();
      assert.equal(db.prepare('SELECT status FROM submissions WHERE id=?').get(submissionId).status, 'pending');
      const queue = await worker.fetch(new Request('https://example.com/api/admin/submissions', { headers: { Authorization: `Bearer ${env.ADMIN_REVIEW_KEY}` } }), env);
      assert.equal((await queue.json()).find(item => item.id === submissionId).submission_type, submission.type);
      const approved = await call('/api/admin/decision', { id: submissionId, action: 'approved', ownership_verified: true, verification_note: 'Verified through the official institutional email contact.' }, true);
      assert.equal(approved.status, 200, JSON.stringify(await approved.clone().json()));
    }
    for (const item of [before.teachers[0], { ...before.offerings[0], kind: 'offering' }]) {
      const response = await call('/api/submissions', { type: 'profile_update', target_kind: item.kind, target_id: item.id, description: 'Correction submitted without a replacement name.', contact_name: 'Test editor', contact_email: 'correction@example.org' });
      assert.equal(response.status, 201, JSON.stringify(await response.clone().json()));
      const { submissionId } = await response.json();
      assert.equal((await call('/api/admin/decision', { id: submissionId, action: 'approved', ownership_verified: true, verification_note: 'Verified through the official published contact email.' }, true)).status, 200);
    }
    const teacher = before.teachers.find(item => item.claim_status === 'unclaimed');
    for (const type of ['profile_update', 'claim']) {
      const response = await call('/api/submissions', { type, name: teacher.name, target_kind: 'teacher', target_id: teacher.id, description: 'A sourced correction.', contact_name: 'Test owner', contact_email: 'test@example.org', website_url: 'https://example.org/', verification_information: 'Evidence for editor review.' });
      assert.equal(response.status, 201, JSON.stringify(await response.clone().json()));
      const { submissionId } = await response.json();
      const approved = await call('/api/admin/decision', { id: submissionId, action: 'approved', ownership_verified: true, verification_note: 'Verified through the official published contact email.' }, true);
      assert.equal(approved.status, 200, JSON.stringify(await approved.clone().json()));
    }
    const after = await getDirectory(env);
    assert.equal(after.teachers.length, before.teachers.length + 1);
    assert.equal(after.offerings.length, before.offerings.length + 1);
    assert.equal(after.providers.length, before.providers.length + 1);
    assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0);
    assert.equal((await call('/api/admin/decision', { id: 'invalid', action: 'approved' })).status, 401);
  } finally { db.close(); }
});

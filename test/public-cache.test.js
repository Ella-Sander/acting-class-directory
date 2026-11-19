import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { getDirectory, invalidateDirectory } from '../src/worker.js';
import { seoFixture, memoryPublicCache } from '../scripts/seo-fixture.mjs';
import { SNAPSHOT_SCHEMA, FRESH_MS, STALE_MS } from '../src/public-cache.js';
import { queryDirectory } from '../src/directory-data.js';
import { readFileSync } from 'node:fs';
const request = path => new Request(`https://example.com${path}`);
function fixture() {
  const result = seoFixture({ sharedCache: true });
  const original = result.env.DIRECTORY_DB;
  const calls = []; const state = { fail: false };
  const wrap = statement => ({ ...statement, bind(...values) { return wrap(statement.bind(...values)); }, async all() { calls.push(statement.sql); if (state.fail) throw new Error('Simulated database unavailable'); return statement.all(); }, async first() { calls.push(statement.sql); if (state.fail) throw new Error('Simulated database unavailable'); return statement.first(); } });
  result.env.DIRECTORY_DB = { prepare(sql) { return wrap(original.prepare(sql)); }, batch: original.batch };
  return { ...result, calls, state };
}

test('edge HTML keys preserve pagination and snapshot profile parity', async () => {
  const { db, env, calls } = fixture();
  try {
    const directory = await getDirectory(env);
    const first = await (await worker.fetch(request('/'), env)).text();
    const second = await (await worker.fetch(request('/?page=2'), env)).text();
    assert.notEqual(first, second);
    assert.match(second, /Page 2/);
    for (const [collection, items] of Object.entries(directory)) {
      const item = items[0];
      const response = await worker.fetch(request(`/api/${collection}/${item.slug}`), env);
      assert.equal(response.headers.get('X-D1-Queries'), '0');
      assert.deepEqual(await response.json(), item);
    }
    assert.equal(calls.length, 3);
  } finally { db.close(); }
});

test('rollout reuses the existing v8 durable snapshot with D1 unavailable', async () => {
  const { db, env, calls, state } = fixture();
  try {
    const data = await queryDirectory(env);
    calls.length = 0;
    await env.PUBLIC_CACHE_STORE.put('directory-v8:generation', 'predeployment');
    await env.PUBLIC_CACHE_STORE.put('directory-v8:predeployment:data:directory', JSON.stringify({ savedAt: Date.now(), value: data }));
    state.fail = true;
    for (const path of ['/api/directory', `/api/providers/${data.providers[0].slug}`, `/classes/${data.offerings[0].slug}/`]) {
      const response = await worker.fetch(request(path), env);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('X-D1-Queries'), '0');
      assert.equal(response.headers.get('X-Directory-Version'), 'predeployment');
    }
    assert.equal(calls.length, 0);
  } finally { db.close(); }
});

test('shared response cache and KV snapshot prevent D1 reads across requests and cold colos', async () => {
  const { db, env, calls } = fixture();
  try {
    const first = await worker.fetch(request('/api/directory'), env); assert.equal(first.status, 200); assert.equal(calls.length, 3);
    const content = await first.text();
    const second = await worker.fetch(request('/api/directory'), env); assert.equal(second.headers.get('X-Public-Cache'), 'HIT'); assert.equal(second.headers.get('X-D1-Queries'), '0'); assert.equal(await second.text(), content); assert.equal(calls.length, 3);
    // A separate colo/isolate has an empty Cache API but shares the global KV.
    const elsewhere = { ...env, PUBLIC_RESPONSE_CACHE: memoryPublicCache().PUBLIC_RESPONSE_CACHE };
    const third = await worker.fetch(request('/api/directory'), elsewhere); assert.equal(third.status, 200); assert.equal(third.headers.get('X-D1-Queries'), '0'); assert.equal(calls.length, 3);
    for (const path of ['/', '/sitemap.xml', '/sitemap-coaches.xml', '/new-york/voice-studios/']) {
      const first = await worker.fetch(request(path), env); assert.equal(first.status, 200);
      const hit = await worker.fetch(request(path), env); assert.equal(hit.headers.get('X-Public-Cache'), 'HIT');
    }
    assert.equal(calls.length, 3);
  } finally { db.close(); }
});

test('all profile URLs and missing slugs share one directory snapshot', async () => {
  const { db, env, calls } = fixture();
  try {
    const slug = db.prepare("SELECT slug FROM instructors WHERE profile_status='published' ORDER BY name LIMIT 1").get().slug;
    let response = await worker.fetch(request(`/api/teachers/${slug}`), env); assert.equal(response.status, 200);
    assert.equal(response.headers.get('X-D1-Queries'), '3');
    assert.equal(calls.length, 3);
    const teacher = await response.json(); assert.ok(teacher.terms.length); assert.ok(teacher.locations.length);
    const hit = await worker.fetch(request(`/api/teachers/${slug}`), env); assert.equal(hit.headers.get('X-Public-Cache'), 'HIT'); assert.equal(hit.headers.get('X-D1-Queries'), '0'); assert.equal(calls.length, 3);
    await getDirectory(env); const reads = calls.length;
    response = await worker.fetch(request(`/teachers/${slug}/`), env); assert.equal(response.status, 200); assert.equal(calls.length, reads);
    const html = await response.text(); assert.ok(html.includes(teacher.name)); assert.ok(html.includes('Related listings'));
    await worker.fetch(request(`/teachers/${slug}/`), env); assert.equal(calls.length, reads);
    assert.equal((await worker.fetch(request('/teachers/not-found/'), env)).status, 404);
    assert.equal(calls.length, reads);
    const elsewhere = { ...env, DIRECTORY_DB: { ...env.DIRECTORY_DB }, PUBLIC_RESPONSE_CACHE: memoryPublicCache().PUBLIC_RESPONSE_CACHE };
    assert.equal((await worker.fetch(request('/api/teachers/not-found'), elsewhere)).status, 404);
    assert.equal(calls.length, reads);
  } finally { db.close(); }
});

test('invalidation versions response, profile, directory and sitemap caches without changing existing rows', async () => {
  const { db, env, calls } = fixture();
  try {
    const initial = await (await worker.fetch(request('/api/directory'), env)).json(); const teacher = initial.teachers[0];
    await worker.fetch(request(`/teachers/${teacher.slug}/`), env); await worker.fetch(request('/sitemap-coaches.xml'), env);
    db.prepare("UPDATE instructors SET profile_status='archived' WHERE id=?").run(teacher.id);
    await invalidateDirectory(env);
    assert.equal((await worker.fetch(request(`/teachers/${teacher.slug}/`), env)).status, 404);
    assert.ok(!(await (await worker.fetch(request('/sitemap-coaches.xml'), env)).text()).includes(`/teachers/${teacher.slug}/`));
    assert.equal((await (await worker.fetch(request('/api/directory'), env)).json()).teachers.length, initial.teachers.length - 1);
    assert.ok(calls.length > 3);
  } finally { db.close(); }
});

test('private and parameterized responses stay uncached; public snapshot still supports filters and sorting', async () => {
  const { db, env } = fixture();
  try {
    for (const path of ['/?q=Julie&category=dialects', '/?sort=institute', '/admin/review/', '/api/admin/submissions']) {
      const response = await worker.fetch(request(path), env); assert.match(response.headers.get('Cache-Control'), /no-store/); assert.notEqual(response.headers.get('X-Public-Cache'), 'HIT');
    }
    const submission = await worker.fetch(new Request('https://example.com/api/submissions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'teacher', name: 'Private cache test', contact_email: 'private-address@example.org', website_url: 'https://private-cache.example.org', description: 'Submitted for review.', offering_name: 'Private voice lessons', format: 'online', instruction_mode: 'private' }) }), env);
    assert.equal(submission.status, 201); assert.equal(submission.headers.get('Cache-Control'), 'no-store');
    assert.ok(![...env.PUBLIC_CACHE_STORE.values.values()].join('').includes('private-address@example.org'));
    for (const entry of env.PUBLIC_RESPONSE_CACHE.responses.values()) assert.ok(!(await entry.response.clone().text()).includes('private-address@example.org'));
  } finally { db.close(); }
});

test('stale successes survive temporary D1 failures without resetting freshness; no cached success means 503', async () => {
  const { db, env, state } = fixture(); const realNow = Date.now; let clock = realNow(); Date.now = () => clock;
  try {
    const first = await worker.fetch(request('/api/directory'), env); const content = await first.text();
    clock += FRESH_MS + 1; state.fail = true;
    let response = await worker.fetch(request('/api/directory'), env); assert.equal(response.status, 200); assert.equal(response.headers.get('X-Public-Cache'), 'STALE'); assert.equal(await response.text(), content);
    const oldEntries = [...env.PUBLIC_CACHE_STORE.values.values()].filter(value => value.includes('savedAt')).map(value => JSON.parse(value));
    assert.ok(oldEntries.every(entry => entry.savedAt < clock - FRESH_MS));
    clock += STALE_MS + 1;
    response = await worker.fetch(request('/api/directory'), env); assert.equal(response.status, 503); assert.ok(!(await response.text()).includes('"teachers":[]'));
    const other = { ...env, ...memoryPublicCache() };
    assert.equal((await worker.fetch(request('/api/directory'), other)).status, 503);
    assert.equal(other.PUBLIC_RESPONSE_CACHE.responses.size, 0);
  } finally { Date.now = realNow; db.close(); }
});

test('same-isolate cold requests share an in-flight directory load', async () => {
  const { db, env, calls } = fixture();
  try {
    const responses = await Promise.all(Array.from({ length: 8 }, () => worker.fetch(request('/api/directory'), env)));
    assert.ok(responses.every(response => response.status === 200)); assert.equal(calls.length, 3);
  } finally { db.close(); }
});

test('index optimization preserves every public field, relationship order, logo and listing order', async () => {
  const { db, env } = seoFixture();
  try {
    for (const name of ['idx_provider_instructors_instructor', 'idx_offering_instructors_instructor', 'idx_field_evidence_verified_entity_date', 'idx_instructors_public_name', 'idx_providers_public_name', 'idx_offerings_public_name']) db.exec(`DROP INDEX ${name}`);
    const before = await queryDirectory(env, undefined, JSON.parse(readFileSync('docs/d1-baseline-sql.json', 'utf8')));
    db.exec(readFileSync('migrations/0013_directory_read_indexes.sql', 'utf8'));
    // Compare every original field/order; new sourced facts have dedicated regression coverage.
    const project = (actual, reference) => Array.isArray(reference) ? actual.map((value,index)=>project(value,reference[index])) : reference && typeof reference === 'object' ? Object.fromEntries(Object.keys(reference).filter(key=>!['workshopVerified','workshop_verified','instructionModeVerified','fact_evidence','fact_evidence_json','instruction_mode_verified','terms','offerings','instructors','affiliations','logo'].includes(key)).map(key=>[key,project(actual[key],reference[key])])) : actual;
    assert.deepEqual(project(await queryDirectory(env), before), project(before, before));
  } finally { db.close(); }
});

test('a real approval invalidates shared public data and leaves private responses uncached', async () => {
  const { db, env } = fixture(); env.ADMIN_REVIEW_KEY = 'isolated-cache-test';
  const post = (path, body) => worker.fetch(new Request(`https://example.com${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.ADMIN_REVIEW_KEY}` }, body: JSON.stringify(body) }), env);
  try {
    const before = await (await worker.fetch(request('/api/directory'), env)).json();
    const response = await post('/api/submissions', { type: 'teacher', name: 'Cache approval teacher', description: 'A sourced voice profile.', contact_email: 'editor@example.org', website_url: 'https://approval-cache.example.org', offering_name: 'Private voice lessons', format: 'online', instruction_mode: 'private' });
    const { submissionId } = await response.json(); assert.equal(response.status, 201);
    const decision = await post('/api/admin/decision', { id: submissionId, action: 'approved', details_verified: true, provider_classification: 'independent_teacher' });
    assert.equal(decision.status, 200); assert.equal((await decision.json()).cacheInvalidated, true); assert.equal(decision.headers.get('Cache-Control'), 'no-store');
    const directory = await (await worker.fetch(request('/api/directory'), env)).json();
    assert.equal(directory.teachers.length, before.teachers.length + 1);
    const added = directory.teachers.find(item => item.name === 'Cache approval teacher');
    assert.ok(!(await (await worker.fetch(request('/sitemap-coaches.xml'), env)).text()).includes(`/teachers/${added.slug}/`), 'Unlinked instructors stay available at their direct profile URL but are not indexed as primary listings');
  } finally { db.close(); }
});

test('rejected profile submissions do not invalidate or reload public directory data', async () => {
  const { db, env, calls } = fixture(); env.ADMIN_REVIEW_KEY = 'isolated-cache-test';
  const post = (path, body) => worker.fetch(new Request(`https://example.com${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.ADMIN_REVIEW_KEY}` }, body: JSON.stringify(body) }), env);
  try {
    await worker.fetch(request('/api/directory'), env);
    const generation = env.PUBLIC_CACHE_STORE.values.get(`${SNAPSHOT_SCHEMA}:generation`);
    const submission = await post('/api/submissions', { type: 'teacher', name: 'Rejected cache test', description: 'A sourced voice profile.', contact_email: 'reject@example.org', website_url: 'https://reject-cache.example.org', offering_name: 'Private voice lessons', format: 'online', instruction_mode: 'private' });
    const { submissionId } = await submission.json(); assert.equal(submission.status, 201);
    const readsBeforeDecision = calls.length;
    const decision = await post('/api/admin/decision', { id: submissionId, action: 'rejected' });
    assert.equal(decision.status, 200); assert.equal((await decision.json()).cacheInvalidated, false);
    assert.equal(env.PUBLIC_CACHE_STORE.values.get(`${SNAPSHOT_SCHEMA}:generation`), generation);
    assert.equal(calls.length, readsBeforeDecision + 1);
  } finally { db.close(); }
});

test('new deployments cannot serve old cached HTML but reuse the global public snapshot', async () => {
  const { db, env, calls } = fixture(); env.WORKER_VERSION = { id: 'build-one' };
  try {
    assert.equal((await worker.fetch(request('/'), env)).status, 200); assert.equal(calls.length, 3);
    const original = env.ASSETS.fetch;
    env.ASSETS.fetch = async request => new Response((await (await original(request)).text()).replace('</body>', '<!-- build two -->\n</body>'));
    env.WORKER_VERSION = { id: 'build-two' };
    const response = await worker.fetch(request('/'), env);
    assert.equal(response.headers.get('X-Public-Cache'), 'MISS'); assert.ok((await response.text()).includes('<!-- build two -->')); assert.equal(calls.length, 3);
  } finally { db.close(); }
});

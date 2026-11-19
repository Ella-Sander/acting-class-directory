import test from 'node:test';
import assert from 'node:assert/strict';
import { BROWSER_FRESH_MS, BROWSER_STALE_MS, DIRECTORY_STORAGE_KEY, createDirectoryLoader, readBrowserDirectory } from '../src/browser-directory-cache.js';
const data = { providers: [], offerings: [], teachers: [{ id: 'teacher', slug: 'teacher', name: 'Voice Teacher', profile_status: 'published' }] };
const storage = () => { const values = new Map(); return { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }; };
const response = (value = data, extra = {}) => new Response(JSON.stringify(value), { headers: { 'X-Directory-Version': 'revision-one', ...extra } });

test('a repeat visit displays public listings immediately and skips the API within five minutes', async () => {
  const store = storage(); let calls = 0; const fetcher = async () => { calls++; return response(); };
  const first = createDirectoryLoader({ storage: store, version: 'revision-one', now: () => 1000, fetcher });
  assert.equal(first.snapshot().status, 'loading'); await first.load(); assert.equal(calls, 1);
  const repeat = createDirectoryLoader({ storage: store, version: 'revision-one', now: () => 1001, fetcher });
  assert.equal(repeat.snapshot().status, 'ready'); assert.deepEqual(repeat.snapshot().teachers, data.teachers);
  await repeat.load(); assert.equal(calls, 1);
});

test('expired snapshots refresh; publication revision changes bypass old browser data immediately', async () => {
  const store = storage(); let clock = 1000; let calls = 0;
  const loader = createDirectoryLoader({ storage: store, version: 'revision-one', now: () => clock, fetcher: async () => { calls++; return response(); } });
  await loader.load(); clock += BROWSER_FRESH_MS + 1; await loader.load(); assert.equal(calls, 2);
  const revised = createDirectoryLoader({ storage: store, version: 'revision-two', now: () => clock, fetcher: async () => { calls++; return response(); } });
  assert.equal(revised.snapshot().status, 'loading'); await revised.load(); assert.equal(calls, 3);
});

test('failed refreshes retain bounded public data with an explicit notice, never an empty success', async () => {
  const store = storage(); let clock = 1000; let fail = false;
  const loader = createDirectoryLoader({ storage: store, version: 'revision-one', now: () => clock, fetcher: async () => { if (fail) throw new Error('Offline'); return response(); } });
  await loader.load(); clock += BROWSER_FRESH_MS + 1; fail = true;
  let state = await loader.load(); assert.equal(state.status, 'ready'); assert.ok(state.cacheNotice.includes('temporarily unavailable')); assert.deepEqual(state.teachers, data.teachers);
  clock += BROWSER_STALE_MS; state = await loader.load(); assert.equal(state.status, 'error');
  assert.equal(readBrowserDirectory(store, 'revision-one', clock), null);
});

test('server stale fallback does not reset browser cache age or persist failed/private payloads', async () => {
  const store = storage(); let clock = 1000; let stale = false;
  const loader = createDirectoryLoader({ storage: store, version: 'revision-one', now: () => clock, fetcher: async () => response({ ...data, contact_email: 'private@example.org', submissions: [{ contact_email: 'private@example.org' }] }, stale ? { 'X-Public-Cache': 'STALE' } : {}) });
  await loader.load(); assert.ok(!store.getItem(DIRECTORY_STORAGE_KEY).includes('private@example.org'));
  const savedAt = JSON.parse(store.getItem(DIRECTORY_STORAGE_KEY)).savedAt;
  clock += BROWSER_FRESH_MS + 1; stale = true; await loader.load();
  assert.equal(JSON.parse(store.getItem(DIRECTORY_STORAGE_KEY)).savedAt, savedAt);
  const failure = createDirectoryLoader({ storage: storage(), fetcher: async () => new Response(JSON.stringify({ error: 'Unavailable' }), { status: 503 }) });
  assert.equal((await failure.load()).status, 'error');
});

test('corrupt or disabled localStorage cannot prevent a network-loaded directory', async () => {
  const corrupt = storage(); corrupt.setItem(DIRECTORY_STORAGE_KEY, 'broken json');
  assert.equal(readBrowserDirectory(corrupt, 'revision-one'), null);
  const blocked = { getItem() { throw new Error('Disabled'); }, setItem() { throw new Error('Full'); } };
  const loader = createDirectoryLoader({ storage: blocked, fetcher: async () => response() });
  assert.equal((await loader.load()).status, 'ready');
});

test('simultaneous refreshes share one request and retry after connectivity returns', async () => {
  let calls = 0;
  const loader = createDirectoryLoader({ fetcher: async () => { calls++; return response(); } });
  await Promise.all([loader.load(), loader.load()]); assert.equal(calls, 1);
  await loader.load(true); assert.equal(calls, 2);
});

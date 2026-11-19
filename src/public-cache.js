export const CACHE_SCHEMA = 'directory-v9';
// Rendered HTML changed; the published-data format did not. Reuse the durable
// snapshot across this rollout, including when D1's daily quota is exhausted.
export const SNAPSHOT_SCHEMA = 'directory-v8';
// Public data changes only through reviewed writes, which bump the generation.
// Keep the shared snapshot for a day so idle colos do not reload D1 every ten
// minutes. The longer stale window lets browsing survive a temporary D1 outage.
export const FRESH_MS = 24 * 60 * 60 * 1000;
export const STALE_MS = 7 * 24 * 60 * 60 * 1000;
export const RESPONSE_FRESH_MS = 60 * 60 * 1000;
const revisions = new WeakMap();
const flightsByDatabase = new WeakMap();
const memoryByDatabase = new WeakMap();
const MEMORY_MS = 60_000;

const storeFor = env => env.PUBLIC_CACHE_STORE;
const responseCache = env => env.PUBLIC_RESPONSE_CACHE || globalThis.caches?.default;
const cacheOrigin = env => env.CANONICAL_ORIGIN || 'https://vocalcatalog.com';
const keyUrl = (env, key) => new Request(`${cacheOrigin(env)}/__public-cache/${CACHE_SCHEMA}/${env.WORKER_VERSION?.id || 'local'}/${encodeURIComponent(key)}`);

export async function publicContext(env) {
  const store = storeFor(env);
  let generation = revisions.get(env.PUBLIC_CACHE_IDENTITY || env.DIRECTORY_DB || env) || 'base';
  if (store) {
    try {
      generation = await store.get(`${SNAPSHOT_SCHEMA}:generation`, { cacheTtl: 60 }) || 'base';
      revisions.set(store, generation);
    } catch {
      generation = revisions.get(store) || 'unavailable';
      console.error('Public cache generation read failed');
    }
  }
  return { generation, rowsRead: 0, queries: 0, stale: false };
}

export async function invalidatePublicCache(env) {
  const store = storeFor(env);
  const generation = crypto.randomUUID();
  if (store) {
    await store.put(`${SNAPSHOT_SCHEMA}:generation`, generation);
    revisions.set(store, generation);
  }
  revisions.set(env.PUBLIC_CACHE_IDENTITY || env.DIRECTORY_DB || env, generation);
  return generation;
}

// KV provides a global durable public-data snapshot; Cache API shares it and
// rendered responses between isolates at a colo. No admin/submission data enters
// either cache. A cold colo can obtain directory data without any D1 query.
export async function readPublicData(env, key, load, context = null) {
  const ctx = context || await publicContext(env);
  const binding = env.PUBLIC_CACHE_IDENTITY || env.DIRECTORY_DB || env;
  if (!flightsByDatabase.has(binding)) flightsByDatabase.set(binding, new Map());
  const flights = flightsByDatabase.get(binding);
  const store = storeFor(env);
  const cache = responseCache(env);
  const dataKey = `${SNAPSHOT_SCHEMA}:${ctx.generation}:data:${key}`;
  const request = keyUrl(env, dataKey);
  if (!memoryByDatabase.has(binding)) memoryByDatabase.set(binding, new Map());
  const memory = memoryByDatabase.get(binding);
  const remembered = memory.get(dataKey);
  if (remembered && Date.now() - remembered.loadedAt < MEMORY_MS && Date.now() - remembered.entry.savedAt < FRESH_MS) return remembered.entry.value;
  const remember = entry => {
    // Bound both age and size; arbitrary profile slugs never enter this map.
    for (const [key, value] of memory) if (Date.now() - value.loadedAt >= MEMORY_MS) memory.delete(key);
    if (memory.size >= 4) memory.delete(memory.keys().next().value);
    memory.set(dataKey, { loadedAt: Date.now(), entry });
    return entry.value;
  };
  let previous;
  try {
    const response = await cache?.match(request);
    if (response) previous = await response.json();
  } catch { console.error('Public data cache read failed'); }
  if ((!previous || Date.now() - previous.savedAt >= FRESH_MS) && store) {
    try {
      const shared = await store.get(dataKey, { type: 'json', cacheTtl: 60 });
      if (shared && (!previous || shared.savedAt > previous.savedAt)) previous = shared;
    } catch { console.error('Shared public snapshot read failed'); }
  }
  if (previous && Date.now() - previous.savedAt < FRESH_MS) return remember(previous);
  const flightKey = `${cacheOrigin(env)}:${dataKey}`;
  if (flights.has(flightKey)) {
    const result = await flights.get(flightKey); ctx.stale ||= result.stale; return result.value;
  }
  const promise = (async () => {
    try {
      const value = await load(ctx);
      const entry = { savedAt: Date.now(), value };
      remember(entry);
      try {
        if (store) await store.put(dataKey, JSON.stringify(entry), { expirationTtl: STALE_MS / 1000 });
      } catch { console.error('Public data cache write failed'); }
      try {
        if (cache) await cache.put(request, new Response(JSON.stringify(entry), { headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${STALE_MS / 1000}` } }));
      } catch { console.error('Colo public data cache write failed'); }
      return { value, stale: false };
    } catch (error) {
      if (previous && Date.now() - previous.savedAt < STALE_MS) {
        ctx.stale = true;
        console.warn('Serving previously successful public data after database failure');
        return { value: previous.value, stale: true };
      }
      throw error;
    } finally { flights.delete(flightKey); }
  })();
  flights.set(flightKey, promise);
  const result = await promise; ctx.stale ||= result.stale; return result.value;
}

function annotate(response, ctx, state) {
  const headers = new Headers(response.headers);
  headers.set('X-Public-Cache', state);
  headers.set('X-Directory-Version', ctx.generation);
  headers.set('X-D1-Queries', String(ctx.queries || 0));
  headers.set('X-D1-Rows-Read', String(ctx.rowsRead || 0));
  if (state === 'STALE') { headers.set('Warning', '110 - "Response is stale; database temporarily unavailable"'); headers.set('Cache-Control', 'no-store'); }
  else if (state === 'BYPASS') headers.set('Cache-Control', 'no-store');
  else if (response.status === 200) headers.set('Cache-Control', `public, max-age=0, s-maxage=${RESPONSE_FRESH_MS / 1000}`);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export function cacheableRequest(request) {
  if (request.method !== 'GET' || request.headers.has('Authorization')) return false;
  const url = new URL(request.url);
  if ([...url.searchParams.keys()].some(key => key !== 'page')) return false;
  return url.pathname === '/api/directory' || /^\/api\/(?:providers|offerings|teachers)\/[a-z0-9-]+$/.test(url.pathname)
    || url.pathname === '/' || /^\/(?:teachers|classes|providers)\/[a-z0-9-]+\/$/.test(url.pathname)
    || /^\/(?:new-york|online)\/.+\/$/.test(url.pathname) || /^\/sitemap(?:-[a-z]+)?\.xml$/.test(url.pathname);
}

export async function withPublicCache(request, env, load) {
  const ctx = await publicContext(env);
  if (!cacheableRequest(request)) {
    const response = await load(ctx);
    return annotate(response, ctx, ctx.stale ? 'STALE' : 'BYPASS');
  }
  const cache = responseCache(env);
  const url = new URL(request.url);
  // Pagination changes server-rendered HTML and must remain in its cache key.
  // Only the unfiltered API payload ignores page.
  if (url.pathname === '/api/directory') url.searchParams.delete('page');
  const cachePath = `${url.origin}${url.pathname}${url.search}`;
  const key = keyUrl(env, `${ctx.generation}:response:${cachePath}`);
  const staleKey = keyUrl(env, `${ctx.generation}:stale:${cachePath}`);
  if (cache) {
    try {
      const hit = await cache.match(key);
      if (hit) return annotate(hit, ctx, 'HIT');
    } catch { console.error('Public response cache lookup failed'); }
  }
  let response;
  try { response = await load(ctx); }
  catch (error) {
    const stale = await cache?.match(staleKey).catch(() => null);
    if (stale) return annotate(stale, ctx, 'STALE');
    throw error;
  }
  if (response.status >= 500 && cache) {
    const stale = await cache.match(staleKey).catch(() => null);
    if (stale) return annotate(stale, ctx, 'STALE');
  }
  if (response.status === 200 && !ctx.stale && !response.headers.has('Set-Cookie')) {
    if (cache) {
      try {
        for (const [target, seconds] of [[key, RESPONSE_FRESH_MS / 1000], [staleKey, STALE_MS / 1000]]) {
          const copy = response.clone(); const headers = new Headers(copy.headers);
          headers.set('Cache-Control', `public, max-age=${seconds}`);
          await cache.put(target, new Response(copy.body, { status: 200, headers }));
        }
      } catch { console.error('Public response cache write failed'); }
    }
  }
  return annotate(response, ctx, ctx.stale ? 'STALE' : 'MISS');
}

export const DIRECTORY_STORAGE_KEY = 'vocal-catalog:public-directory:v5';
export const BROWSER_FRESH_MS = 5 * 60 * 1000;
export const BROWSER_STALE_MS = 24 * 60 * 60 * 1000;

const empty = () => ({ providers: [], offerings: [], teachers: [] });
export function isPublicDirectory(data) {
  return data && ['providers', 'offerings', 'teachers'].every(collection => Array.isArray(data[collection]) && data[collection].every(item =>
    item && typeof item.id === 'string' && typeof item.slug === 'string' && typeof item.name === 'string' &&
    (collection === 'teachers' ? item.profile_status : item.listing_status) === 'published'));
}
export function readBrowserDirectory(storage, version, now = Date.now()) {
  try {
    const entry = JSON.parse(storage?.getItem(DIRECTORY_STORAGE_KEY) || 'null');
    if (entry && entry.version === version && Number.isFinite(entry.savedAt) && entry.savedAt <= now && now - entry.savedAt < BROWSER_STALE_MS && isPublicDirectory(entry.data)) return entry;
    storage?.removeItem(DIRECTORY_STORAGE_KEY);
  } catch { /* Disabled, full or corrupt storage must never break browsing. */ }
  return null;
}

export function createDirectoryLoader({ storage, version = 'base', fetcher = globalThis.fetch, now = Date.now }) {
  let entry = readBrowserDirectory(storage, version, now());
  let state = entry ? { ...entry.data, status: 'ready', cacheNotice: now() - entry.savedAt >= BROWSER_FRESH_MS ? 'Updating saved listings…' : '' } : { ...empty(), status: 'loading', cacheNotice: '' };
  let inFlight;
  let lastFailure = -Infinity;
  return {
    snapshot: () => state,
    load(force = false) {
      if (inFlight) return inFlight;
      if (!force && entry && now() - entry.savedAt < BROWSER_FRESH_MS) return Promise.resolve(state);
      if (!force && now() - lastFailure < 60_000) return Promise.resolve(state);
      inFlight = (async () => {
        try {
          const response = await fetcher('/api/directory', { cache: 'no-store' });
          if (!response.ok) throw new Error('Directory request failed');
          const result = await response.json();
          if (!isPublicDirectory(result)) throw new Error('Invalid directory response');
          const data = { providers: result.providers, offerings: result.offerings, teachers: result.teachers };
          if (response.headers.get('X-Public-Cache') === 'STALE') {
            // A successful fallback must not receive a new freshness timestamp.
            lastFailure = now();
            state = { ...data, status: 'ready', cacheNotice: 'Showing saved listings. Updates are temporarily unavailable.' };
          } else {
            entry = { version: response.headers.get('X-Directory-Version') || version, savedAt: now(), data };
            version = entry.version;
            try { storage?.setItem(DIRECTORY_STORAGE_KEY, JSON.stringify(entry)); } catch { /* Browsing still works without persistence. */ }
            lastFailure = -Infinity;
            state = { ...data, status: 'ready', cacheNotice: '' };
          }
        } catch {
          lastFailure = now();
          if (entry && now() - entry.savedAt < BROWSER_STALE_MS) state = { ...entry.data, status: 'ready', cacheNotice: 'Showing saved listings. Updates are temporarily unavailable.' };
          else state = { ...empty(), status: 'error', cacheNotice: '' };
        }
        return state;
      })().finally(() => { inFlight = null; });
      return inFlight;
    },
  };
}

export const SAVED_LISTINGS_KEY = 'vocal-catalog:saved-listings:v2';
export const savedListingId = item => `${item.kind}:${item.id}`;
const validPath = value => typeof value === 'string' && /^(teacher|provider|offering):[a-zA-Z0-9_-]{1,160}$/.test(value);
export const normalizeSavedListings = values => Array.isArray(values) ? [...new Set(values.filter(validPath))].slice(0, 1000) : [];
export function readSavedListings(storage) {
  try { return normalizeSavedListings(JSON.parse(storage?.getItem(SAVED_LISTINGS_KEY) || '[]')); }
  catch { return []; }
}
export function writeSavedListings(storage, values) {
  try { if (!storage) return false; storage.setItem(SAVED_LISTINGS_KEY, JSON.stringify(normalizeSavedListings(values))); return true; }
  catch { return false; }
}
export function toggleSavedListing(values, path) {
  const keys = normalizeSavedListings(values);
  if (!validPath(path)) return keys;
  return keys.includes(path) ? keys.filter(key => key !== path) : normalizeSavedListings([...keys, path]);
}

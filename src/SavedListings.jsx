import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { listingPath } from './seo.js';
import { savedListingId, SAVED_LISTINGS_KEY, readSavedListings, writeSavedListings, toggleSavedListing } from './saved-listings.js';
const SavedContext = createContext({ keys: [], has: () => false, toggle: () => {}, clear: () => {}, storageAvailable: true });
export const useSavedListings = () => useContext(SavedContext);
const identities = item => [savedListingId(item), ...(item.kind==='provider' || !item.kind && item.listing_status ? item.aliases || [] : []).map(alias=>savedListingId({...item,id:alias.id,kind:'provider'}))];
export function SavedListingsProvider({ children }) {
  const [storage] = useState(() => { try { return window.localStorage; } catch { return undefined; } });
  const [keys, setKeys] = useState(() => readSavedListings(storage));
  const [storageAvailable, setStorageAvailable] = useState(true);
  useEffect(() => { setStorageAvailable(writeSavedListings(storage, keys)); }, [keys, storage]);
  useEffect(() => {
    const sync = event => { if (event.key === SAVED_LISTINGS_KEY || event.key === null) setKeys(readSavedListings(storage)); };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [storage]);
  const value = useMemo(() => ({ keys, storageAvailable, has: item => identities(item).some(id=>keys.includes(id)), toggle: item => setKeys(previous => identities(item).some(id=>previous.includes(id)) ? previous.filter(id=>!identities(item).includes(id)) : toggleSavedListing(previous, savedListingId(item))), clear: () => setKeys([]) }), [keys, storageAvailable]);
  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}
export function BookmarkIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13" /><ellipse cx="6" cy="18" rx="3" ry="2.2" fill="currentColor" stroke="none" /><ellipse cx="18" cy="16" rx="3" ry="2.2" fill="currentColor" stroke="none" /><path d="M9 9l12-2" /></svg>;
}
export function SaveListingButton({ item, compact = false }) {
  const saved = useSavedListings(); const selected = saved.has(item);
  return <button type="button" className={compact ? 'save-listing-button card-save-button' : 'save-listing-button button button-outline'} aria-pressed={selected} aria-label={`${selected ? 'Remove' : 'Save'} ${item.name}${selected ? ' from saved listings' : ' to saved listings'}`} title={selected && !saved.storageAvailable ? 'Saved for this visit only' : selected ? 'Remove saved listing' : 'Save listing on this browser'} onClick={event => { event.stopPropagation(); saved.toggle(item); }}><BookmarkIcon />{!compact && <span>{selected ? 'Saved' : 'Save listing'}</span>}</button>;
}

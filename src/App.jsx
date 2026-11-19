import { approvalEmailNotice } from './ApprovalEmailOutbox.jsx';
import ProviderMergeReview from './ProviderMergeReview.jsx';
import { PROVIDER_TYPES, verifiedAffiliations, LESSON_FORMATS, providerClassification, teacherClassification, teacherAvailability, officialWebsite, verifiedBookingUrl, verifiedLessonFormats } from './teacher-facts.js';
import { BRAND, HOME_SUBTITLE, DIRECTORY_SCOPE, DISCOVERY_DISCLAIMER, homeMetadata, SUPPORT_EMAIL } from './brand.js';
import { lazy, Suspense } from 'react';
import { createDirectoryLoader } from './browser-directory-cache.js';
import { SavedListingsProvider, SaveListingButton, BookmarkIcon, useSavedListings } from './SavedListings.jsx';
import { listingPath, entitySchema } from './seo.js';
import { resolveListingImage } from './listing-logos.js';
const NeighborhoodMap = lazy(() => import('./NeighborhoodMap.jsx'));
const seoPage = (() => { try { return JSON.parse(document.getElementById('seo-page-data')?.textContent || 'null'); } catch { return null; } })();
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DIRECTORY_CATEGORIES, LOCATIONS, TECHNIQUES, TRAINING_TYPES, VOICE_STYLES,
  buildFilterChoices, cheapestVerifiedOffering, filterListings, formatLabel, mergeAllRecords, mergeListings, NO_NYC_LOCATION, priceLabel, verifiedFormats,
} from './directory-utils.js';


function setMeta(title, description, canonicalPath = window.location.pathname, noIndex = false) {
  document.title = title.endsWith(` | ${BRAND}`) ? title : `${title} | ${BRAND}`;
  const updateMeta = (selector, attribute, value) => {
    let node = document.querySelector(selector);
    if (!node) { node = document.createElement('meta'); node.setAttribute(attribute, selector.includes('property') ? selector.match(/"([^"]+)"/)[1] : selector.match(/"([^"]+)"/)[1]); document.head.append(node); }
    node.content = value;
  };
  updateMeta('meta[name="description"]', 'name', description);
  updateMeta('meta[name="robots"]', 'name', noIndex || seoPage?.preview ? 'noindex, follow' : 'index, follow');
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.append(canonical); }
  canonical.href = new URL(canonicalPath, seoPage?.canonical || window.location.origin).href;
  for (const [key, value] of [['title', document.title], ['description', description], ['url', canonical.href]]) updateMeta(`meta[property="og:${key}"]`, 'property', value);
  updateMeta('meta[name="twitter:title"]', 'name', document.title);
  updateMeta('meta[name="twitter:description"]', 'name', description);
}

function setSchema(schema) {
  let node = document.querySelector('script[type="application/ld+json"]');
  if (!node) { node = document.createElement('script'); node.type = 'application/ld+json'; document.head.append(node); }
  node.textContent = JSON.stringify(schema).replace(/</g, '\\u003c');
}

function setDirectoryMeta(listings, filters) {
  const url = new URL(window.location.href);
  if (url.searchParams.get('saved') === '1') {
    setMeta('Saved listings', 'Your saved voice training listings on this browser.', '/', true);
    if (seoPage?.schema) setSchema({ '@context': 'https://schema.org', '@graph': seoPage.schema['@graph'].filter(node => ['Organization', 'WebSite'].includes(node['@type'])) });
    return;
  }
  const page = Math.max(1, Number(url.searchParams.get('page') || 1));
  const filtered = [...url.searchParams.keys()].some(key => key !== 'page');
  const metadata = homeMetadata(page);
  const path = !filtered && page > 1 ? `/?page=${page}` : '/';
  setMeta(metadata.title, metadata.description, path, filtered);
  if (!seoPage?.schema) return;
  const canonical = new URL(path, seoPage.canonical).href;
  const visible = filterListings(listings, filters).slice((page - 1) * 20, page * 20);
  const graph = seoPage.schema['@graph'].filter(node => ['Organization', 'WebSite', 'BreadcrumbList'].includes(node['@type']));
  setSchema({ '@context': 'https://schema.org', '@graph': [...graph, { '@type': 'WebPage', '@id': canonical, url: canonical, name: metadata.title, description: metadata.description }, { '@type': 'ItemList', itemListElement: visible.map((item, index) => ({ '@type': 'ListItem', position: (page - 1) * 20 + index + 1, url: new URL(listingPath(item), canonical).href, name: item.name })) }] });
}

function currentListingSlug() {
  const params = new URLSearchParams(window.location.search);
  return params.get('listing') || window.location.pathname.match(/^\/(?:providers|classes|teachers)\/([^/]+)\/?$/)?.[1] || '';
}

function initialFilters() {
  const params = new URLSearchParams(window.location.search);
  return {
    category: DIRECTORY_CATEGORIES.some(([key]) => key === params.get('category')) ? params.get('category') : 'all',
    q: params.get('q') || '', location: params.get('location') || '',
    training: params.get('training') || '', technique: params.get('technique') || '',
    providerType: params.get('providerType') || ({ independent: 'independent_teacher', institutional: 'institution' })[params.get('teacherType')] || params.get('teacherType') || '',
    lessonFormat: params.get('lesson') || '', style: params.get('style') || '', format: params.get('format') || '',
    budget: params.get('budget') || '', priceBasis: params.get('basis') || '', minPrice: params.get('min') || '', maxPrice: params.get('max') || '', sort: params.get('sort') || 'name',
  };
}

function useDirectory() {
  const [loader] = useState(() => {
    if (window.location.pathname.startsWith('/admin')) return null;
    let storage;
    try { storage = window.localStorage; } catch { /* Private browsing can disable storage. */ }
    return createDirectoryLoader({ storage, version: seoPage?.directoryCacheVersion || 'base' });
  });
  const [state, setState] = useState(() => loader?.snapshot() || { providers: [], offerings: [], teachers: [], status: 'loading' });
  useEffect(() => {
    if (!loader) return;
    let active = true;
    const refresh = force => loader.load(force).then(result => { if (active) setState(result); });
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(false); };
    const onOnline = () => refresh(false);
    refresh(false);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => { active = false; document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('online', onOnline); };
  }, [loader]);
  return state;
}

function ScoreNotation({ compact = false, position = 0 }) {
  const pitches = [54, 44, 34, 44, 49, 39, 29, 34];
  return <svg className={compact ? 'measure-notation' : 'score-notation'} viewBox={compact ? '0 0 112 88' : '0 0 720 88'} aria-hidden="true" focusable="false">
    <g className="notation-lines">{[24, 34, 44, 54, 64].map(y => <path key={y} d={`M0 ${y}H${compact ? 112 : 720}`} />)}</g>
    {!compact && <><text className="notation-clef" x="8" y="72">𝄞</text><text className="notation-time" x="58" y="40">4</text><text className="notation-time" x="58" y="61">4</text><path className="notation-bar" d="M0 24v40M382 24v40M710 24v40M716 24v40" /></>}
    {(compact ? [0] : pitches.slice(0, 7)).map((pitch, index) => {
      const y = compact ? pitches[position % pitches.length] : pitch;
      const x = compact ? 76 : 112 + index * 78;
      const stemDown = y <= 44;
      return <g className="notation-note" key={index}><rect className="note-hit-area" x={x - 18} y="5" width="36" height="77" /><path className="note-staff-accent" d={`M${x - 28} ${Math.round((y - 24) / 10) * 10 + 24}h56`} /><g className="note-glyph"><ellipse cx={x} cy={y} rx="6.2" ry="4.2" transform={`rotate(-24 ${x} ${y})`} /><path d={`M${x + (stemDown ? -5.4 : 5.4)} ${y}v${stemDown ? 30 : -30}`} /></g></g>;
    })}
    {!compact && <><text className="notation-rest" x="650" y="61">𝄽</text><path className="notation-phrase" d="M108 73Q225 88 346 73" /><text className="notation-dynamic" x="410" y="84">mp</text></>}
  </svg>;
}

function AnimatedCount({ value, ready }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (!ready) return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame;
    const finish = () => { if (preference.matches) { cancelAnimationFrame(frame); setDisplay(value); } };
    preference.addEventListener('change', finish);
    if (preference.matches) setDisplay(value);
    else {
      const start = performance.now();
      const tick = now => {
        const progress = Math.min(1, (now - start) / 1100);
        setDisplay(Math.round(value * (1 - Math.pow(1 - progress, 3))));
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }
    return () => { cancelAnimationFrame(frame); preference.removeEventListener('change', finish); };
  }, [value, ready]);
  return <><span aria-hidden="true">{ready ? display : '—'}</span><span className="sr-only">{ready ? value : 'Loading'}</span></>;
}

function OpeningNotes() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const stop = () => { if (preference.matches) setVisible(false); };
    stop();
    preference.addEventListener('change', stop);
    const timer = window.setTimeout(() => setVisible(false), 2800);
    return () => { window.clearTimeout(timer); preference.removeEventListener('change', stop); };
  }, []);
  if (!visible) return null;
  return <div className="opening-notes" aria-hidden="true"><svg viewBox="0 0 500 180" focusable="false"><g className="opening-staff">{[70, 82, 94, 106, 118].map(y => <path key={y} d={`M15 ${y} Q240 ${y - 35} 485 ${y}`} />)}</g>{[0, 1, 2, 3, 4, 5].map((note) => <g key={note} className="opening-note" style={{ '--note-delay': `${note * 140}ms`, '--note-turn': `${note % 2 ? 12 : -12}deg` }}><g transform={`translate(${65 + note * 70} ${92 - (note % 3) * 16})`}><ellipse rx="7" ry="5" transform="rotate(-22)" /><path d="M6 0v-32" />{note % 2 === 0 && <path className="opening-note-flag" d="M6 -32q18 8 7 20" />}</g></g>)}</svg></div>;
}

function Brand() {
  return <a className="brand" href="/" aria-label="Vocal Catalog home"><span className="brand-symbol" aria-hidden="true"><i /><i /><i /></span><span className="brand-wordmark">Vocal Catalog<span className="brand-city">NYC</span></span></a>;
}

function HeaderBrand() {
  return <a className="header-brand-lockup" href="/" aria-label="Vocal Catalog, NYC Plus — home"><span className="header-brand-block"><span className="brand-wordmark">Vocal Catalog</span><span className="header-brand-caption">THE VOICE DIRECTORY</span></span><span className="header-city-mark" aria-hidden="true"><span className="brand-symbol"><i /><i /><i /></span><strong>NYC<span className="city-plus">+</span></strong></span></a>;
}

function Header({ onSubmit }) {
  const saved = useSavedListings();
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState(() => window.location.pathname.startsWith('/admin') ? '' : window.location.hash === '#how-it-works' ? 'approach' : 'directory');
  useEffect(() => {
    const sync = () => setActiveSection(window.location.hash === '#how-it-works' ? 'approach' : 'directory');
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  return <header className="site-header" onKeyDown={event => { if (event.key === 'Escape' && menuOpen) { setMenuOpen(false); event.currentTarget.querySelector('.menu-toggle')?.focus(); } }}><a href="#directory" className="skip-link">Skip to directory</a><div className="header-inner"><HeaderBrand />
    <nav id="main-navigation" className={`main-nav ${menuOpen ? 'main-nav-open' : ''}`} aria-label="Main navigation">
      <a href="/#directory" aria-current={activeSection === 'directory' ? 'location' : undefined} onClick={() => { setActiveSection('directory'); setMenuOpen(false); }}>Explore directory</a><a href="/#how-it-works" aria-current={activeSection === 'approach' ? 'location' : undefined} onClick={() => { setActiveSection('approach'); setMenuOpen(false); }}>How it works</a>
      <a href="/?saved=1#directory" className="saved-navigation" onClick={() => setMenuOpen(false)}><BookmarkIcon />Saved{saved.keys.length > 0 && <span>{saved.keys.length}</span>}</a>
      <button className="mobile-nav-submit" onClick={() => { setMenuOpen(false); onSubmit(); }}>Get listed</button>
    </nav>
    <button className="button header-cta" onClick={() => { setMenuOpen(false); onSubmit(); }}>Get listed <span aria-hidden="true">↗</span></button>
    <button className={`menu-toggle${menuOpen ? ' is-open' : ''}`} aria-controls="main-navigation" aria-expanded={menuOpen} aria-label={menuOpen ? 'Close menu' : 'Open menu'} onClick={() => setMenuOpen(!menuOpen)}><span /><span /></button>
  </div></header>;
}

function Footer({ onSubmit }) {
  return <footer className="site-footer"><div className="footer-inner"><Brand /><span>A considered guide to voice education in New York.</span><button className="footer-submit" onClick={onSubmit}>Suggest a coach or class ↗</button><a href={`mailto:${SUPPORT_EMAIL}?subject=Business%20inquiry%20%E2%80%94%20Vocal%20Catalog`}>Business inquiries ↗</a><a href="/admin/review">Editorial review</a><small>© 2026 Vocal Catalog</small></div></footer>;
}

function PlaceLabel({ locations = [] }) {
  const labels = [...new Set(locations.map(location => {
    const value = location.is_online ? 'Online' : location.neighborhood || location.borough || location.city;
    return value && location.verified ? value : '';
  }).filter(Boolean))];
  return labels.length ? <span>{labels.slice(0, 2).join(' · ')}</span> : null;
}

function itemType(item) {
  if (item.kind === 'teacher') return item.professional_title || 'Voice professional';
  return item.kind === 'provider' ? providerClassification(item).value ? providerClassification(item).label : 'Voice provider' : (verifiedLessonFormats(item).includes('private') ? verifiedLessonFormats(item).includes('group') ? 'Voice lessons and classes' : 'Private voice lesson' : verifiedLessonFormats(item).includes('group') ? 'Group voice class' : 'Voice class or program');
}

function Photo({ item, className = '', showFallback = true }) {
  const [failed, setFailed] = useState(false);
  const imageUrl = item.image_url || item.featured_image_url;
  const hasApprovedImage = item.image_permission_status === 'approved' && imageUrl && !failed;
  return <span className={`listing-photo ${className}`}>
    {hasApprovedImage ? <img src={imageUrl} alt={item.image_alt || `${item.name}, vocal coach`} loading="lazy" decoding="async" onError={() => setFailed(true)} /> :
      showFallback && <span className="portrait-pending" aria-label={`${item.name}: portrait not supplied`}><span>{item.name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase()}</span></span>}
    <span className="photo-type">{itemType(item)}</span>
  </span>;
}

function ListingLogo({ item, prominent = false }) {
  const [failed, setFailed] = useState(false);
  const image = resolveListingImage(item);
  const logo = image?.logo;
  useEffect(() => setFailed(false), [image?.url]);
  const available = Boolean(image) && !failed;
  const metadataImage = available && image.type === 'metadata';
  const label = available
    ? metadataImage ? image.alt : `${logo.name} logo${logo.relationship === 'affiliation' ? ' — affiliated school or studio' : logo.relationship === 'provider' ? ' — class provider' : ''}`
    : `No verified logo or website image available for ${item.name}`;
  return <span className={`listing-logo-space ${available ? `has-logo${metadataImage ? ' metadata-image' : ` logo-surface-${logo.surface}`}` : 'logo-unavailable'}`} title={label}>
    {available ? <img src={image.url} alt={image.alt} loading="lazy" decoding="async" onError={() => setFailed(true)} /> : <span role="img" aria-label={label}>{prominent ? <><span className="logo-monogram">{item.name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase()}</span><span className="logo-fallback-label">Portrait / logo pending</span></> : <>LOGO<br />UNAVAILABLE</>}</span>}
    {available && !metadataImage && logo.relationship === 'affiliation' && <span className="logo-affiliation-label">STUDIO / SCHOOL</span>}
  </span>;
}

function ListingCard({ item, onOpen, index = 0 }) {
  const allTerms = (item.terms || []).filter(term => term.verification_status === 'verified');
  const genres = allTerms.filter(term => term.taxonomy === 'genre');
  const specialties = allTerms.filter(term => term.taxonomy !== 'genre').slice(0, 1);
  const terms = [...genres.slice(0, 2), ...specialties].slice(0, 3);
  const hasPrice = item.kind === 'offering' ? item.priceVerified && item.price_min != null : Boolean(cheapestVerifiedOffering(item));
  const price = hasPrice ? priceLabel(item, { prefix: true }) : '';
  const blackKeys = [1, 3, 6, 8, 10];
  const tone = blackKeys.includes(index % 12) ? 'black' : 'white';
  const formats = [...new Set(verifiedFormats(item))].map(formatLabel);
  const lessonFormats = verifiedLessonFormats(item);
  return <article
    className={`listing-card measure-${tone} score-listing-${item.kind}`}
    onClick={event => { if (event.target.closest('.card-official-link')) return; if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onOpen(item, event.currentTarget.querySelector('.card-profile-link')); } }}
  >
    <span className="card-media"><ListingLogo item={item} prominent /></span>
    <span className="measure-rail"><span className="measure-number">{String(index + 1).padStart(2, '0')}</span><ScoreNotation compact position={index} /></span>
    <span className="card-identity">{item.image_permission_status === 'approved' && (item.image_url || item.featured_image_url) && <Photo item={item} />}<span className="card-name-block"><span className="card-type">{itemType(item)}</span><span className="card-title">{item.name}</span>{item.kind === 'teacher' && <span className="teacher-card-facts"><span>{teacherClassification(item).label}</span>{verifiedAffiliations(item).length > 0 && <strong className="card-institutions">{verifiedAffiliations(item).map(provider => provider.name).join(' | ')}</strong>}<span>{teacherAvailability(item).label}</span></span>}</span></span>
    {terms.length > 0 && <span className="card-tags">{terms.map(term => <span key={term.id || term.slug}>{term.term}</span>)}</span>}
    {lessonFormats.length > 0 && <span className="card-offering-formats"><span>Documented lesson format</span>{lessonFormats.map(value => LESSON_FORMATS.find(([key]) => key === value)?.[1]).filter(Boolean).join(' · ')}</span>}
    <span className="card-details"><span className="card-facts">{item.locations?.some(location => location.verified) && <span className="card-location"><span aria-hidden="true">⌖</span><PlaceLabel locations={item.locations} /></span>}{formats.length > 0 && <span>{formats.join(' / ')}</span>}</span></span>
    <span className="card-bottom"><span className="card-price">{price}</span><span className="card-link-cue">Details <span aria-hidden="true">↗</span></span></span>
    <a className="card-profile-link" href={listingPath(item)} aria-haspopup="dialog" aria-label={`Measure ${index + 1}: view details for ${item.name}`} />
    {officialWebsite(item).url && <a className="card-official-link" href={officialWebsite(item).url} target="_blank" rel="noopener noreferrer" aria-label={`${officialWebsite(item).label}: ${item.name}`}>{officialWebsite(item).label}<span aria-hidden="true"> &#8599;</span></a>}{item.kind === 'provider' && item.offerings?.length > 0 && <a className="card-official-link" href={listingPath(item) + '#offerings'}>View Classes</a>}{item.kind === 'teacher' && item.offerings?.length > 0 && <a className="card-official-link" href={listingPath(item) + '#offerings'}>Explore Classes</a>}<SaveListingButton item={item} compact />
  </article>;
}

function SearchBox({ value, onChange, onSubmit, id = 'directory-search', className = '' }) {
  return <form className={`search-box ${className}`} role="search" onSubmit={event => { event.preventDefault(); onSubmit?.(); }}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></svg>
    <label className="sr-only" htmlFor={id}>Search voice training, people, programs or locations</label>
    <input id={id} value={value} onChange={event => onChange(event.target.value)} placeholder="A teacher, a neighborhood, a style…" autoComplete="off" />
    {value && <button className="search-clear" type="button" onClick={() => onChange('')} aria-label="Clear search">×</button>}
    <button className="search-submit" type="submit">Find your voice <span aria-hidden="true">↗</span></button>
  </form>;
}

function FilterField({ label, value, onChange, options }) {
  return <label className={`filter-field${value ? ' is-selected' : ''}`}><span>{label}{value && <span className="filter-selected-dot" aria-hidden="true" />}</span><select value={value} onChange={event => onChange(event.target.value)}><option value="">Any {label.toLowerCase()}</option>{options.map(([optionValue, text]) => <option key={optionValue} value={optionValue}>{text}</option>)}</select></label>;
}

function FilterChips({ label, value, options, onChange }) {
  return <fieldset className="filter-chips"><legend>{label}</legend><div>{options.map(([key, text]) => <button key={key} type="button" aria-pressed={value === key} onClick={() => onChange(value === key ? '' : key)}>{text}</button>)}</div></fieldset>;
}

function FilterControls({ filters, update, reset, choices }) {
  const activeCount = ['providerType', 'lessonFormat', 'location', 'training', 'technique', 'style', 'format', 'budget', 'priceBasis', 'minPrice', 'maxPrice'].filter(key => filters[key] !== '').length + (filters.category && filters.category !== 'all' ? 1 : 0);
  const soundCount = ['training', 'technique', 'style'].filter(key => filters[key]).length;
  const invalidRange = filters.minPrice !== '' && filters.maxPrice !== '' && Number(filters.minPrice) > Number(filters.maxPrice);
  return <div className="filter-controls">
    <div className="filter-live-bar"><span role="status"><span className="filter-live-dot" aria-hidden="true" />{activeCount ? `${activeCount} active ${activeCount === 1 ? 'filter' : 'filters'}` : 'Make it your own'}</span><button type="button" onClick={reset} disabled={!activeCount && !filters.q}>Reset</button></div>
    <FilterChips label="Provider Type" value={filters.providerType} onChange={value => update('providerType', value)} options={PROVIDER_TYPES} /><FilterChips label="Lesson Format" value={filters.lessonFormat} onChange={value => update('lessonFormat', value)} options={LESSON_FORMATS} /><fieldset className="price-filter price-filter-primary"><legend>Price range <span>USD</span></legend>
      <div className="price-range">{[['minPrice', 'Min'], ['maxPrice', 'Max']].map(([key, label]) => <label className={filters[key] !== '' ? 'is-selected' : ''} key={key}><span>{label} ($)</span><input type="number" min="0" step="0.01" inputMode="decimal" placeholder="Any" aria-invalid={invalidRange || undefined} value={filters[key]} onChange={event => update(key, event.target.value)} /></label>)}</div>
      <label className="filter-field price-basis-field"><span>Priced per</span><select value={filters.priceBasis} onChange={event => update('priceBasis', event.target.value)}><option value="">Any basis</option>{choices.priceBases.map(([value, label]) => <option key={value} value={value}>{value === 'hourly' ? 'Hour' : value === 'full_course' ? 'Course' : value === 'per_session' ? 'Session' : label}</option>)}</select></label>
      {filters.minPrice !== '' && filters.maxPrice !== '' && Number(filters.minPrice) > Number(filters.maxPrice) && <p className="price-error" role="status">Minimum must be no higher than maximum.</p>}
    </fieldset>
    <FilterField label="Neighborhood" value={filters.location.startsWith('neighborhood:') ? filters.location : ''} onChange={value => update('location', value || (filters.location.startsWith('neighborhood:') ? filters.location.split(':')[1] : filters.location))} options={choices.neighborhoods.filter(([key]) => !filters.location || filters.location === 'NYC' || filters.location === 'Online' || key.startsWith('neighborhood:' + (filters.location.startsWith('neighborhood:') ? filters.location.split(':')[1] : filters.location) + ':'))} />
    <FilterChips label="Attendance" value={filters.format} onChange={value => update('format', value)} options={choices.formats} />
    <details className="filter-group" open><summary>Your sound <span className="sound-count">{soundCount || 'Explore'}</span><span className="filter-expand-icon" aria-hidden="true">+</span></summary>
    <FilterField label="Lesson focus" value={filters.training} onChange={value => update('training', value)} options={choices.training} />
    <FilterField label="Voice technique" value={filters.technique} onChange={value => update('technique', value)} options={choices.techniques} />
    <FilterField label="Voice style" value={filters.style} onChange={value => update('style', value)} options={choices.styles} />
    </details>
    <p className="filter-auto-note"><span aria-hidden="true">↳</span> Results update as you refine.</p>
  </div>;
}

function MobileFilterDialog({ filters, update, reset, resultCount, onClose, choices }) {
  const dialog = useRef(null);
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (!node.open) node.showModal();
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = oldOverflow; };
  }, []);
  return <dialog className="filter-backdrop" ref={dialog} aria-labelledby="filter-drawer-title" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === dialog.current) onClose(); }}>
    <section className="filter-drawer"><div className="drawer-heading"><div><span className="section-kicker">REFINE YOUR SEARCH</span><h2 id="filter-drawer-title">Refine results</h2></div><button className="icon-button" onClick={onClose} aria-label="Close filters">×</button></div><FilterControls filters={filters} update={update} reset={reset} choices={choices} /><button className="button button-violet drawer-done" onClick={onClose}>Show {resultCount} results</button></section>
  </dialog>;
}

function ResultsDirectory({ directory, filters, update, reset, onOpen }) {
  const saved = useSavedListings();
  const [savedOnly, setSavedOnly] = useState(() => new URLSearchParams(window.location.search).get('saved') === '1');
  const [display, setDisplay] = useState('directory');
  const [keysPerPage, setKeysPerPage] = useState(6);
  const resultsRef = useRef(null);
  const pianoRef = useRef(null);
  const pageSize = display === 'piano' ? keysPerPage : 20;
  useEffect(() => {
    const node = resultsRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setKeysPerPage(Math.max(2, Math.min(6, Math.floor(entry.contentRect.width / 130)))));
    observer.observe(node);
    return () => observer.disconnect();
  }, [directory.status]);
  const [pageIndex, setPageIndex] = useState(() => Math.max(0, Number(new URLSearchParams(window.location.search).get('page') || 1) - 1));
  const previousPageFilters = useRef(filters);
  const pageHref = page => { const url = new URL(window.location.href); url.pathname = '/'; url.searchParams.delete('listing'); if (page > 0) url.searchParams.set('page', page + 1); else url.searchParams.delete('page'); return url.pathname + url.search + '#directory'; };
  const [mobileFilters, setMobileFilters] = useState(false);
  const providerListings = useMemo(() => mergeListings(directory), [directory]);
  const allRecords = useMemo(() => mergeAllRecords(directory), [directory]);
  const browsableListings = useMemo(() => savedOnly ? allRecords.filter(item => saved.has(item)) : providerListings, [allRecords, providerListings, saved, savedOnly]);
  const choices = useMemo(() => buildFilterChoices(providerListings), [providerListings]);
  const allListings = useMemo(() => filterListings(browsableListings, filters), [browsableListings, filters]);
  const pageCount = Math.max(1, Math.ceil(allListings.length / pageSize));
  const visibleListings = allListings.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
  const setCollection = value => {
    setSavedOnly(value); setPageIndex(0); pianoRef.current?.scrollTo({ left: 0, behavior: 'instant' });
    const url = new URL(window.location.href); url.pathname = '/'; url.searchParams.delete('page');
    if (value) url.searchParams.set('saved', '1'); else url.searchParams.delete('saved');
    window.history.replaceState({ directory: true }, '', url);
    setDirectoryMeta(providerListings, filters);
  };
  useEffect(() => {
    const sync = () => setSavedOnly(new URLSearchParams(window.location.search).get('saved') === '1');
    window.addEventListener('popstate', sync); return () => window.removeEventListener('popstate', sync);
  }, []);
  useEffect(() => { if (directory.status === 'ready' && pageIndex >= pageCount) { const next = pageCount - 1; setPageIndex(next); window.history.replaceState({ directory: true }, '', pageHref(next)); } }, [pageCount, pageIndex, directory.status]);
  const activeFilters = [
    ['location', filters.location], ['training', filters.training], ['technique', filters.technique], ['style', filters.style],
    ['providerType', filters.providerType], ['lessonFormat', filters.lessonFormat], ['format', filters.format], ['budget', filters.budget], ['priceBasis', filters.priceBasis], ['minPrice', filters.minPrice], ['maxPrice', filters.maxPrice],
  ].filter(([, value]) => value);
  const removeFilter = key => update(key, '');
  useEffect(() => {
    if (JSON.stringify(previousPageFilters.current) !== JSON.stringify(filters)) setPageIndex(0);
    previousPageFilters.current = filters;
    pianoRef.current?.scrollTo({ left: 0, behavior: 'instant' });
  }, [filters, display, pageSize]);
  const changePage = direction => {
    if (display === 'piano' && pianoRef.current) {
      const next = Math.max(0, Math.min(pageCount - 1, pageIndex + (direction === 'next' ? 1 : -1)));
      pianoRef.current.scrollTo({ left: next * pianoRef.current.clientWidth, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
      return;
    }
    const next = Math.max(0, Math.min(pageCount - 1, pageIndex + (direction === 'next' ? 1 : -1)));
    setPageIndex(next);
    window.history.replaceState({ directory: true }, '', pageHref(next));
    setDirectoryMeta(providerListings, filters);
    requestAnimationFrame(() => document.querySelector('#directory')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }));
  };

  if (directory.status === 'loading') return <div className="loading-state"><span className="loading-spinner" />Gathering the directory…</div>;
  if (directory.status === 'error') return <div className="error-state" role="alert"><strong>We couldn’t load the directory.</strong><span>Try refreshing in a moment.</span></div>;
  return <section className="directory-section" id="directory">
    {directory.cacheNotice && <p className="form-note" role="status">{directory.cacheNotice}</p>}
    <div className="directory-heading directory-heading-brief"><p>New York voices. A shared love of the craft.<br />Find the people and places that bring out yours.</p></div>
    <div className="directory-toolbar"><div className="category-browser"><span className="category-label">Explore by specialty</span><div className="directory-categories" role="group" aria-label="Provider specialties">{DIRECTORY_CATEGORIES.map(([value, label]) => <button key={value} type="button" aria-pressed={filters.category === value} onClick={() => update('category', value)}><span>{label}</span><small>{filterListings(browsableListings, { ...filters, category: value }).length}</small></button>)}</div></div><button className="mobile-filter-button" onClick={() => setMobileFilters(true)} aria-haspopup="dialog"><span aria-hidden="true">≡</span> All filters{activeFilters.length ? ` (${activeFilters.length})` : ''}</button></div>
    <div className="local-filter-bar"><div className="local-filter-intro"><span className="section-kicker">FIVE BOROUGHS. YOUR VOICE.</span><strong>Find your corner of NYC.</strong></div>
      <div className="location-filter-group"><span className="location-group-label">Location coverage</span><div className="borough-options" role="group" aria-label="Filter by NYC location coverage">
        {[['', 'Everywhere'], ['NYC', 'In-person in NYC'], [NO_NYC_LOCATION, 'NYC location unconfirmed']].map(([location, label]) => { const selected = filters.location === location; const count = filterListings(providerListings, { ...filters, location }).length; return <button key={location || 'everywhere'} type="button" aria-pressed={Boolean(selected)} onClick={() => update('location', location)}><span className="borough-dot" aria-hidden="true" /><span>{label}</span><small>{count}</small></button>; })}
      </div></div>
      <div className="location-filter-group"><span className="location-group-label">Boroughs and online</span><div className="borough-options" role="group" aria-label="Refine by borough or verified online lessons">
        {['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island', 'Online'].map(location => { const count = filterListings(providerListings, { ...filters, location }).length; if (!count) return null; const selected = filters.location === location || filters.location.startsWith('neighborhood:' + location + ':'); return <button key={location} type="button" aria-pressed={Boolean(selected)} onClick={() => update('location', location)}><span className="borough-dot" aria-hidden="true" /><span>{location === 'Online' ? 'Online lessons' : location}</span><small>{count}</small></button>; })}
      </div></div>
    </div>
    <div className="directory-layout">
      <aside className="directory-sidebar" aria-labelledby="sidebar-title">
        <h3 id="sidebar-title">Refine your search</h3><p className="sidebar-caption">A little closer to your sound.</p>
        <FilterControls filters={filters} update={update} reset={reset} choices={choices} />
      </aside>
      <div className="directory-results" ref={resultsRef}>
        <div className="mobile-lesson-format"><FilterChips label="Provider Type" value={filters.providerType} onChange={value => update('providerType', value)} options={PROVIDER_TYPES} /><FilterChips label="Lesson Format" value={filters.lessonFormat} onChange={value => update('lessonFormat', value)} options={LESSON_FORMATS} /></div><p className="discovery-disclaimer">{DISCOVERY_DISCLAIMER}</p><div className="directory-collection-tabs" role="group" aria-label="Listing collection"><button type="button" aria-pressed={!savedOnly} onClick={() => setCollection(false)}>All providers</button><button type="button" aria-pressed={savedOnly} onClick={() => setCollection(true)}><BookmarkIcon />Saved listings <span>{saved.keys.length}</span></button><small>{savedOnly ? saved.storageAvailable ? 'Saved on this browser' : 'Browser storage is unavailable; saved for this visit only' : 'Keep your favorites close'}</small>{savedOnly && saved.keys.length > 0 && <button type="button" className="clear-saved-list" onClick={saved.clear}>Clear saved</button>}</div>
        <SearchBox value={filters.q} onChange={value => update('q', value)} className="directory-inline-search" />
        <div className="results-head"><div className="results-count" aria-live="polite"><strong>{allListings.length}</strong> {allListings.length === 1 ? 'provider' : savedOnly ? 'saved records' : 'providers'}{filters.q && <span> matching “{filters.q}”</span>}</div><label className="sort-field"><span>Sort:</span><select value={filters.sort} onChange={event => update('sort', event.target.value)}><option value="name">Name A–Z</option><option value="institute">Institute / shared logo</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select></label></div>
        <div className="display-options"><div role="group" aria-label="Directory display">{[['directory', 'Directory'], ['piano', 'Piano']].map(([value, label]) => <button type="button" key={value} aria-pressed={display === value} onClick={() => { setDisplay(value); setPageIndex(0); }}>{value === 'piano' && <span className="piano-icon" aria-hidden="true" />}{label}</button>)}</div><span>{pageSize} listings per page</span></div>
          {activeFilters.length > 0 && <div className="active-filters" aria-label="Active filters">{activeFilters.map(([key, value]) => { const label = key === 'providerType' ? PROVIDER_TYPES.find(([option]) => option === value)?.[1] : key === 'lessonFormat' ? LESSON_FORMATS.find(([option]) => option === value)?.[1] : key === 'location' && value === NO_NYC_LOCATION ? 'NYC location unconfirmed' : key === 'location' && value.startsWith('neighborhood:') ? choices.neighborhoods.find(([slug]) => slug === value)?.[1] : key === 'minPrice' ? `Min USD ${value}` : key === 'maxPrice' ? `Max USD ${value}` : key === 'budget' ? choices.budgets.find(([slug]) => slug === value)?.[1] : key === 'priceBasis' ? choices.priceBases.find(([slug]) => slug === value)?.[1] : key === 'style' ? choices.styles.find(([slug]) => slug === value)?.[1] : key === 'training' ? choices.training.find(([slug]) => slug === value)?.[1] : value; return <button key={key} onClick={() => removeFilter(key)} aria-label={`Remove ${label || value} filter`}><span aria-hidden="true">♩</span>{label || value}<span aria-hidden="true">×</span></button>; })}<button className="clear-filter-chip" onClick={reset}>Clear all</button></div>}
        {visibleListings.length ? <>
          <div className="score-system-heading"><span><span className="system-clef" aria-hidden="true">𝄞</span> THE VOICES</span><span>Each measure, a new possibility.</span><span>NYC + ONLINE</span></div>
          {display === 'piano' ? <div className="piano-viewport" ref={pianoRef} role="region" aria-label="Piano listings. Swipe horizontally or use Previous and Next." onScroll={event => {
            const node = event.currentTarget;
            setPageIndex(Math.min(pageCount - 1, Math.max(0, Math.round(node.scrollLeft / node.clientWidth))));
          }}>
            {Array.from({ length: pageCount }, (_, page) => <div className="listing-grid piano-grid" key={page} style={{ '--key-count': pageSize }} inert={page !== pageIndex} aria-label={'Page ' + (page + 1)}>
              {allListings.slice(page * pageSize, (page + 1) * pageSize).map((item, index) => <ListingCard key={item.kind + '-' + item.id} item={item} index={page * pageSize + index} onOpen={onOpen} />)}
            </div>)}
          </div> : <div className="listing-grid" role="region" aria-label="Voice training directory listings">
            {visibleListings.map((item, index) => <ListingCard key={item.kind + '-' + item.id} item={item} index={pageIndex * pageSize + index} onOpen={onOpen} />)}
          </div>}
        </> : <div className="empty-state"><span className="empty-icon" aria-hidden="true">⌕</span><h3>{savedOnly ? saved.keys.length ? 'No saved matches' : 'No saved listings yet' : 'No matches yet'}</h3><p>{savedOnly ? 'Use the music note on a listing to keep it here. Your saved list stays in this browser; unavailable listings are not shown.' : 'Try a broader search or clear filters to see every listing.'}</p><button className="button button-outline" onClick={reset}>Clear filters</button>{savedOnly && <button className="button button-outline" onClick={() => { setCollection(false); reset(); }}>Explore all listings</button>}</div>}
        <nav className="score-pagination" aria-label="Directory pages">
          <a href={pageHref(Math.max(0, pageIndex - 1))} className="button button-outline score-page-button" onClick={event => { if (!event.metaKey && !event.ctrlKey) { event.preventDefault(); if (pageIndex > 0) changePage('previous'); } }} aria-disabled={pageIndex === 0} aria-label="Previous page"><span aria-hidden="true">←</span> Previous</a>
          <span className="score-page-count" aria-live="polite">SECTION {String(pageIndex + 1).padStart(2, '0')} / {String(pageCount).padStart(2, '0')}<span> · </span>{allListings.length ? `${pageIndex * pageSize + 1}–${Math.min((pageIndex + 1) * pageSize, allListings.length)}` : '0'} of {allListings.length} providers</span>
          <a href={pageHref(Math.min(pageCount - 1, pageIndex + 1))} className="button button-outline score-page-button" onClick={event => { if (!event.metaKey && !event.ctrlKey) { event.preventDefault(); if (pageIndex < pageCount - 1) changePage('next'); } }} aria-disabled={pageIndex >= pageCount - 1}>Next <span aria-hidden="true">→</span></a>
        </nav>
      </div>
    </div>
    {mobileFilters && <MobileFilterDialog filters={filters} update={update} reset={reset} resultCount={allListings.length} onClose={() => setMobileFilters(false)} choices={choices} />}
  </section>;
}

function BrandPill({ children }) { return <span className="detail-pill">{children}</span>; }

function ListingDialog({ item, directory, onClose, onOpenRelated, onSuggestUpdate }) {
  const dialog = useRef(null);
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (!node.open) node.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);
  if (!item) return null;
  const related = ['provider', 'teacher'].includes(item.kind) ? item.offerings || [] : [];
  const locationRows = (item.locations || []).filter(location => location.verified);
  const terms = (item.terms || []).filter(term => term.verification_status === 'verified');
  const format = [...new Set(verifiedFormats(item))].map(formatLabel).join(' · ');
  const hasPrice = item.kind === 'offering' ? item.priceVerified && item.price_min != null : Boolean(cheapestVerifiedOffering(item));
  const price = hasPrice ? priceLabel(item) : '';
  const classification = item.kind === 'provider' ? providerClassification(item) : teacherClassification(item);
  const availability = item.kind === 'teacher' ? teacherAvailability(item) : null;
  const experience = [item.teaching_experience, item.experience_years && `${item.experience_years} years of experience`, item.credentials].filter(Boolean);
  return <dialog className="listing-dialog" ref={dialog} aria-labelledby="listing-modal-title" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === dialog.current) onClose(); }}>
    <div className="listing-modal-shell"><button className="modal-close" onClick={onClose} aria-label="Close listing details">×</button>
      <div className="modal-hero"><Photo item={item} className="modal-photo" /><div className="modal-title-block"><span className="section-kicker">THE VOICE / {itemType(item)}</span><h2 id="listing-modal-title">{item.name}</h2><div className="modal-location"><span aria-hidden="true">⌖</span><PlaceLabel locations={item.locations} />{format && <><span className="modal-meta-divider" aria-hidden="true">·</span><span>{format}</span></>}</div></div></div>
      <div className="modal-body"><main className="modal-main"><section className="modal-section"><span className="section-kicker">ABOUT</span>{item.description && <p>{item.description}</p>}{item.teaching_approach && <p>{item.teaching_approach}</p>}{item.biography && <p>{item.biography}</p>}{!item.description && !item.teaching_approach && !item.biography && <p>Visit the official profile for current teaching information.</p>}</section>
        {terms.length > 0 && <section className="modal-section"><span className="section-kicker">TECHNIQUES & SPECIALTIES</span><div className="modal-specialties">{terms.map(term => <BrandPill key={term.id}>{term.term}</BrandPill>)}</div></section>}
        {experience.length > 0 && <section className="modal-section"><span className="section-kicker">EXPERIENCE & CREDENTIALS</span>{experience.map((detail, index) => <p key={index}>{detail}</p>)}</section>}
        {related.length > 0 && <section className="modal-section" id="offerings"><span className="section-kicker">{item.kind === 'provider' ? 'PUBLISHED COURSES & SERVICES' : 'PUBLISHED CLASSES & COACHING'}</span><div className="related-offerings">{related.map(offering => <article key={offering.id}><strong>{offering.name}</strong>{offering.description && <p>{offering.description}</p>}<div className="offering-facts">{offering.skill_level && <span>{offering.skill_level}</span>}{offering.instructionModeVerified && offering.instruction_mode && <span>{offering.instruction_mode === 'private' ? 'Private / One-on-One' : offering.instruction_mode === 'group' ? 'Group Classes' : offering.instruction_mode === 'both' ? 'Private and group' : offering.instruction_mode}</span>}{offering.workshopVerified && <span>Workshop</span>}{offering.formatVerified && offering.format && <span>{formatLabel(offering.format)}</span>}{offering.schedule_text && <span>{offering.schedule_text}</span>}{offering.priceVerified && offering.price_min != null && <span>{priceLabel({ ...offering, kind: 'offering', priceVerified: true })}</span>}</div>{(offering.registration_url || offering.enrollment_url || offering.source_url) && <a href={offering.registration_url || offering.enrollment_url || offering.source_url} target="_blank" rel="noopener noreferrer">Official class information ↗</a>}</article>)}</div></section>}
        {item.kind === 'provider' && item.instructors?.length > 0 && <section className="modal-section" id="faculty"><span className="section-kicker">VERIFIED INSTRUCTORS & FACULTY</span><div className="related-offerings">{item.instructors.map(instructor => <article key={instructor.id}><strong>{instructor.name}</strong>{instructor.professional_title && <p>{instructor.professional_title}</p>}{instructor.description && <p>{instructor.description}</p>}{instructor.slug && <a href={`/teachers/${instructor.slug}/`}>View Faculty Profile ↗</a>}</article>)}</div></section>}
        {verifiedAffiliations(item).length > 0 && <section className="modal-section"><span className="section-kicker">VERIFIED INSTITUTIONAL AFFILIATIONS</span><div className="related-offerings">{verifiedAffiliations(item).map(provider => <a className="related-provider" key={provider.id} href={provider.website_url || provider.source_url} target="_blank" rel="noopener noreferrer">{provider.name}<span>Official website ↗</span></a>)}</div></section>}
      </main><aside className="modal-aside"><div className="detail-panel"><span className="section-kicker">AT A GLANCE</span>
        {item.logo && <div className="profile-logo"><ListingLogo item={item} /><div><strong>{item.logo.name}</strong><p>{item.logo.relationship === 'affiliation' ? `Affiliated school / studio: ${item.logo.affiliationName}` : item.logo.relationship === 'provider' ? `Class provider: ${item.logo.affiliationName}` : 'Coach / studio logo'}</p><a href={item.logo.sourceUrl} target="_blank" rel="noopener noreferrer">Official logo source ↗</a></div></div>}
        {hasPrice && <div className="detail-row"><span>Pricing</span><strong>{price}</strong></div>}
        {format && <div className="detail-row"><span>Format</span><strong>{format}</strong></div>}
        {locationRows.length > 0 && <div className="detail-row"><span>Location</span><strong>{locationRows.map(location => location.postal_address || location.label).join(' · ')}</strong></div>}
        {terms.length > 0 && <div className="detail-row detail-tags"><span>Specialties</span><div>{terms.map(term => <BrandPill key={term.id}>{term.term}</BrandPill>)}</div></div>}
        {item.kind === 'provider' && classification.value && <dl className="teacher-facts"><dt>Provider type</dt><dd>{classification.label}</dd>{verifiedLessonFormats(item).length > 0 && <><dt>Documented lesson formats</dt><dd>{verifiedLessonFormats(item).map(value => LESSON_FORMATS.find(([key]) => key === value)?.[1]).filter(Boolean).join(' · ')}</dd></>}</dl>}{item.kind === 'teacher' && <dl className="teacher-facts">{classification.value && <><dt>Teacher type</dt><dd>{classification.label}</dd></>}{verifiedAffiliations(item).length > 0 && <><dt>Institutions</dt><dd>{verifiedAffiliations(item).map(provider => provider.name).join(' | ')}</dd></>}{availability.value && <><dt>Availability</dt><dd>{availability.label}</dd></>}{verifiedLessonFormats(item).length > 0 && <><dt>Documented offerings</dt><dd>{verifiedLessonFormats(item).map(value => LESSON_FORMATS.find(([key]) => key === value)?.[1]).filter(Boolean).join(' · ')}</dd></>}</dl>}<p className="discovery-disclaimer">{DISCOVERY_DISCLAIMER}</p><div className="detail-actions"><SaveListingButton item={item} />{officialWebsite(item).url && <a className="button button-violet" href={officialWebsite(item).url} target="_blank" rel="noopener noreferrer">{officialWebsite(item).label}</a>}{verifiedBookingUrl(item) && <a className="button button-outline" href={verifiedBookingUrl(item)} target="_blank" rel="noopener noreferrer">Book a lesson</a>}{item.instagram_url && <a className="detail-social" href={item.instagram_url} target="_blank" rel="noopener noreferrer">Instagram ↗</a>}</div>
        {(item.source_url || item.website_url) && <a className="source-note" href={item.source_url || item.website_url} target="_blank" rel="noopener noreferrer">{item.website_url ? 'View official profile' : 'View source listing'} ↗</a>}
        {!item.website_url && item.source_url && <p className="verification-note">This teacher is listed for discovery. Confirm teaching formats and enrollment details with the official source.</p>}
        {item.last_verified_at && <p className="verification-note">Profile facts reviewed {new Date(`${item.last_verified_at}T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.</p>}
      </div>{['teacher', 'provider'].includes(item.kind) && <button className="suggest-update" onClick={() => onSuggestUpdate(item, 'claim')}>Claim or Remove Listing</button>}<button className="suggest-update" onClick={() => onSuggestUpdate(item, 'profile_update')}>Suggest a profile correction</button></aside></div>
    </div>
  </dialog>;
}

function IntroSections({ onSubmit }) {
  return <><section className="how-section" id="how-it-works"><div><span className="section-kicker">A CLEARER WAY TO FIND YOUR GUIDE</span><h2>Find a voice teacher<br />who fits your goals.</h2></div><div className="how-points"><article><span>01</span><strong>Choose with clarity</strong><p>Published prices stay tied to their lesson format. Missing details stay unknown.</p></article><article><span>02</span><strong>Find your focus</strong><p>Filter by voice style, lesson focus, NYC location and verified format.</p></article><article><span>03</span><strong>Connect directly</strong><p>Read the teacher, institution or class source, then confirm details through its official contact channel.</p></article></div></section>
    <section className="provider-cta" id="for-providers"><div><span className="section-kicker">FOR TEACHERS, SCHOOLS & STUDIOS</span><h2>Your voice work belongs<br />in the conversation.</h2></div><div><p>Suggest a teacher, school or class. Editors check the source and keep unverified details out of the filters.</p><button className="button button-white" onClick={onSubmit}>Suggest a listing <span aria-hidden="true">↗</span></button></div></section></>;
}

function UnifiedDirectory({ directory }) {
  const [filters, setFilters] = useState(initialFilters);
  const [openSlug, setOpenSlug] = useState(currentListingSlug);
  const [submittedType, setSubmittedType] = useState(null);
  const [submissionProvider, setSubmissionProvider] = useState(null);
  const lastTrigger = useRef(null);
  const listings = useMemo(() => mergeListings(directory), [directory]);
  const selectedItem = listings.find(item => item.slug === openSlug) || directory.providers.filter(item => item.slug === openSlug).map(item => ({ ...item, kind: 'provider' }))[0] || null;

  useEffect(() => {
    const onPop = () => {
      setOpenSlug(currentListingSlug()); setFilters(initialFilters());
      if (!currentListingSlug()) requestAnimationFrame(() => lastTrigger.current?.focus());
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  useEffect(() => {
    if (!openSlug) {
      if (seoPage && window.location.pathname === '/' && window.location.search === new URL(seoPage.canonical).search) {
        setMeta(seoPage.title.replace(/ \| Vocal Catalog$/, ''), seoPage.description, seoPage.canonical, seoPage.noindex);
        setSchema(seoPage.schema);
        return;
      }
      setDirectoryMeta(listings, filters);
      return;
    }
    if (selectedItem) {
      setMeta(selectedItem.name, selectedItem.description || `Explore ${selectedItem.name} on Vocal Catalog.`, listingPath(selectedItem));
      setSchema({ '@context': 'https://schema.org', '@graph': [entitySchema(selectedItem, new URL(seoPage?.canonical || window.location.href).origin)] });
    }
  }, [openSlug, selectedItem, directory.status, filters]);
  const update = (key, value) => {
    const next = { ...filters, [key]: value };
    setFilters(next);
    const url = new URL(window.location.href);
    url.pathname = '/';
    url.searchParams.delete('page');
    const names = { providerType: 'providerType', lessonFormat: 'lesson', priceBasis: 'basis', minPrice: 'min', maxPrice: 'max' };
    for (const name of ['type','category','q','location','training','technique','style','format','providerType','teacherType','lesson','budget','priceBasis','minPrice','maxPrice','sort']) url.searchParams.delete(names[name] || name);
    for (const [name, entry] of Object.entries(next)) if (entry && !(name === 'category' && entry === 'all') && !(name === 'sort' && entry === 'relevance')) url.searchParams.set(names[name] || name, entry);
    window.history.replaceState({ ...window.history.state, directory: true }, '', url);
  };
  const reset = () => { const next = { category: 'all', q: '', location: '', training: '', technique: '', style: '', format: '', providerType: '', lessonFormat: '', budget: '', priceBasis: '', minPrice: '', maxPrice: '', sort: 'name' }; setFilters(next); const url = new URL(window.location.href); url.pathname = '/'; for (const key of ['type','category','q','location','training','technique','style','format','providerType','teacherType','lesson','budget','basis','min','max','sort','page']) url.searchParams.delete(key); window.history.replaceState({ ...window.history.state, directory: true }, '', url); };
  const openListing = (item, trigger) => {
    if (trigger) lastTrigger.current = trigger;
    setOpenSlug(item.slug);
    const url = new URL(window.location.href); url.pathname = listingPath(item); url.search = '';
    window.history.pushState({ listingModal: true, slug: item.slug }, '', url);
  };
  const closeListing = () => {
    if (window.history.state?.listingModal) { window.history.back(); return; }
    const url = new URL(window.location.href); url.pathname = '/'; url.searchParams.delete('listing');
    window.history.replaceState({ directory: true }, '', url); setOpenSlug('');
    lastTrigger.current?.focus();
  };
  const requestSubmission = (item, type = null) => { setSubmissionProvider(item || null); setSubmittedType(type || (item?.kind === 'offering' ? 'offering' : 'teacher')); };

  return <><Header onSubmit={() => requestSubmission(null, 'provider')} />
    <main>
      <section className="hero-section hero-reference-layout" aria-labelledby="hero-title">
        <div className="hero-overline"><span>VOCAL CATALOG · THE LOCAL VOICE DIRECTORY</span><span>MADE FOR NEW YORK'S MANY VOICES</span></div>
        <div className="hero-inner"><div className="hero-copy"><OpeningNotes /><span className="hero-eyebrow"><span className="nyc-edition-mark">NYC</span> FIVE BOROUGHS. YOUR NEXT CHAPTER.</span><h1 id="hero-title">Find Your <br /><em>Voice Coach in NYC</em></h1><p className="hero-description">{HOME_SUBTITLE}<span className="hero-scope">{DIRECTORY_SCOPE}</span></p><a className="hero-directory-link" href="#directory">Explore New York's voices <span aria-hidden="true">↗</span></a></div><Suspense fallback={<div className="map-loading" aria-label="Loading neighborhood map" />}><NeighborhoodMap directory={directory} filters={filters} update={update} onOpen={openListing} /></Suspense></div>
        <div className="hero-search-row hero-summary"><div className="hero-stats hero-directory-numbers">{[[directory.providers.length, 'primary providers'], [directory.teachers.length, 'instructors'], [directory.offerings.length, 'classes & programs'], [filterListings(listings, { category: 'dialects' }).length, 'dialect coaches']].map(([count, label]) => <span key={label}><strong><AnimatedCount value={count} ready={directory.status === 'ready'} /></strong>{label}</span>)}</div><span className="hero-stat-source">From the current directory · explore NYC and online options</span></div>
        <div className="hero-score restored-hero-score"><span className="score-direction">Andante.<small>At your own pace.</small></span><ScoreNotation /><span className="score-opus">YOUR VOICE, YOUR TEMPO.<br /><span>FIND YOUR NEXT NOTE.</span></span></div>
      </section>
      <ResultsDirectory directory={directory} filters={filters} update={update} reset={reset} onOpen={openListing} />
      <IntroSections onSubmit={() => requestSubmission(null, 'provider')} />
    </main>
    {seoPage?.explore && <div className="seo-explore-wrapper" dangerouslySetInnerHTML={{ __html: seoPage.explore }} />}<Footer onSubmit={() => requestSubmission(null, 'provider')} />
    {selectedItem && <ListingDialog key={selectedItem.id} item={selectedItem} directory={directory} onClose={closeListing} onOpenRelated={item => openListing(item)} onSuggestUpdate={requestSubmission} />}
    {submittedType && <SubmissionModal initialType={submittedType} provider={submissionProvider} providers={directory.providers} onClose={() => { setSubmittedType(null); setSubmissionProvider(null); }} />}
  </>;
}

function Eyebrow({ children }) { return <span className="section-kicker">{children}</span>; }

function TermChoices({ label, name, terms }) {
  return <fieldset className="term-choices"><legend>{label}</legend><div>{terms.map(([slug, term]) => <label key={slug}><input type="checkbox" name={name} value={slug} /><span>{term}</span></label>)}</div></fieldset>;
}

function SubmittedOfferingFields({ includeName = true }) {
  return <section className="submitted-offering-fields" aria-label="Documented service offering">
    <Eyebrow>DOCUMENTED OFFERING</Eyebrow>
    {includeName && <label className="form-field"><span>Lesson or service name *</span><input name="offering_name" required maxLength="160" placeholder="For example, private voice lessons" /></label>}
    {includeName && <label className="form-field"><span>Offering details (optional)</span><textarea name="offering_description" rows="2" maxLength="3000" placeholder="Describe what is explicitly offered." /></label>}
    <div className="form-grid">
      <label className="form-field"><span>Lesson format *</span><select name="instruction_mode" required defaultValue=""><option value="" disabled>Choose a documented format</option><option value="private">Private / one-on-one</option><option value="group">Group</option><option value="both">Private and group</option><option value="workshop">Workshop</option></select></label>
      <label className="form-field"><span>Attendance format *</span><select name="format" required defaultValue=""><option value="" disabled>Choose a documented format</option><option value="in_person">In person</option><option value="online">Online</option><option value="hybrid">Hybrid</option></select></label>
    </div>
    <div className="form-grid">
      <label className="form-field"><span>Published price (optional)</span><input name="price_min" type="number" min="0" step="1" placeholder="Leave blank if not published" /></label>
      <label className="form-field"><span>Price covers</span><select name="price_basis"><option value="">Not published / unspecified</option><option value="per_session">Per session</option><option value="hourly">Per hour</option><option value="full_course">Full course</option><option value="workshop">Workshop</option><option value="other">Other</option></select></label>
    </div>
    <label className="form-field"><span>Maximum price (optional)</span><input name="price_max" type="number" min="0" step="1" placeholder="Leave blank for a single price" /></label>
    <label className="form-field"><span>Schedule or duration (optional)</span><input name="schedule_text" maxLength="300" placeholder="For example, weekly 60-minute lessons" /></label>
  </section>;
}

function SubmissionModal({ initialType = 'provider', provider, providers = [], onClose }) {
  const dialog = useRef(null);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [selectedType, setSelectedType] = useState(initialType);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const onSubmitForm = async event => {
    event.preventDefault(); setSending(true); setMessage('');
    const formNode = event.currentTarget; const form = new FormData(formNode); const type = selectedType;
    const payload = Object.fromEntries(form.entries());
    payload.type = type; payload.provider_id = provider?.kind === 'provider' ? provider.id : payload.provider_id || ''; if (['teacher', 'offering'].includes(provider?.kind)) { payload.target_kind = provider.kind; payload.target_id = provider.id; } else if (provider?.kind === 'provider' && ['removal', 'claim'].includes(type)) { payload.target_kind = 'provider'; payload.target_id = provider.id; }
    if (['claim', 'removal', 'profile_update'].includes(type) && provider) payload.name = provider.name;
    payload.training_types = form.getAll('training_types'); payload.techniques = form.getAll('techniques'); payload.genres = form.getAll('genres');
    try {
      const response = await fetch('/api/submissions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'The submission could not be saved.');
      setMessage(result.mergeProposed ? 'This website already has a provider. Your complementary details have been sent for a merge review and will remain private until approved.' : 'Thank you. Your submission is saved for editorial review. It will remain private until approved.'); setSent(true); formNode.reset();
    } catch (error) { setMessage(error.message || 'The submission could not be saved.'); }
    finally { setSending(false); }
  };
  return <dialog className="submission-dialog" aria-label="Directory submission" ref={dialog} onClose={onClose} onClick={event => { if (event.target === dialog.current) dialog.current.close(); }}>
    <div className="dialog-heading"><div><Eyebrow>CONTRIBUTE TO THE DIRECTORY</Eyebrow><h2>{selectedType === 'removal' ? 'Request listing removal' : selectedType === 'claim' ? 'Claim or Remove Listing' : selectedType === 'profile_update' ? 'Suggest a profile update' : selectedType === 'teacher' ? 'Suggest a teacher' : 'Share a listing'}</h2></div><button className="icon-button" aria-label="Close dialog" onClick={() => dialog.current?.close()}>×</button></div>
    {sent ? <div className="submission-success"><span className="success-mark">✓</span><p>{message}</p><button className="button button-violet" onClick={() => dialog.current?.close()}>Done</button></div> : <form className="submission-form" onSubmit={onSubmitForm}>{message && <p className="form-intro" role="alert">{message}</p>}
      {initialType === 'provider' && <label className="form-field"><span>Listing type</span><select value={selectedType} onChange={event => setSelectedType(event.target.value)}><option value="teacher">Individual instructor profile</option><option value="provider">Voice provider or independent practice</option><option value="offering">Singing class or workshop</option></select></label>}
      {(selectedType === 'teacher' || selectedType === 'provider' || selectedType === 'coach' || selectedType === 'offering') && <>
        <label className="form-field"><span>{selectedType === 'offering' ? 'Class or workshop name' : selectedType === 'teacher' ? 'Professional name' : selectedType === 'coach' ? 'Coach name' : 'Studio or school name'} *</span><input name="name" required maxLength="160" /></label>
        {selectedType === 'coach' && <input type="hidden" name="listing_type" value="coach" />}
        {selectedType === 'teacher' && <label className="form-field"><span>Teaching role (optional)</span><select name="professional_title" defaultValue=""><option value="">Do not list a title</option><option>Voice teacher</option><option>Vocal coach</option><option>Singing teacher</option><option>Vocal pedagogue</option><option>Speech and voice coach</option><option>Other voice teacher</option></select></label>}
        {selectedType === 'provider' && <label className="form-field"><span>Provider category</span><select name="listing_type"><option value="coach">Independent teacher practice</option><option value="studio">Studio or voice business</option><option value="school">Institution or conservatory</option></select></label>}
        <label className="form-field"><span>Description *</span><textarea name="description" required rows="3" maxLength="3000" placeholder={selectedType === 'offering' ? 'What singers will work on and who the class is for.' : 'What kind of voice or singing instruction is offered?'} /></label>
        {selectedType === 'teacher' && <label className="form-field"><span>Biography (optional)</span><textarea name="biography" rows="4" maxLength="5000" placeholder="A short professional biography." /></label>}
        {selectedType === 'teacher' && <label className="form-field"><span>Teaching background (optional)</span><textarea name="teaching_experience" rows="3" maxLength="3000" placeholder="Teaching experience or professional background." /></label>}
        {selectedType === 'teacher' && <label className="form-field"><span>Instagram (optional)</span><input name="instagram_url" type="url" placeholder="https://instagram.com/" /></label>}
        {selectedType === 'teacher' && <label className="form-field"><span>Booking link (optional)</span><input name="booking_url" type="url" placeholder="https://" /></label>}
        {selectedType === 'provider' && <label className="form-field"><span>Teaching approach (optional)</span><textarea name="teaching_approach" rows="2" /></label>}
        <div className="form-grid"><label className="form-field"><span>Official website{selectedType === 'provider' ? ' *' : ''}</span><input name="website_url" type="url" placeholder="https://" required={selectedType === 'provider' || selectedType === 'teacher'} /></label>{selectedType === 'offering' && <label className="form-field"><span>Registration link (optional)</span><input name="registration_url" type="url" placeholder="https://" /></label>}</div>
        {(selectedType === 'teacher' || selectedType === 'provider' || selectedType === 'coach' || selectedType === 'offering') && <><label className="form-field"><span>In-person NYC location (optional; choose only if published)</span><select name="borough" defaultValue=""><option value="">No in-person location to list</option>{LOCATIONS.filter(item => !['Online', 'NYC'].includes(item)).map(location => <option key={location} value={location}>{location}</option>)}</select></label><label className="form-field"><span>Neighborhood (optional)</span><input name="neighborhood" maxLength="120" placeholder="For example, Astoria or Upper West Side" /></label></>}
        <TermChoices label="Lesson focus (optional)" name="training_types" terms={TRAINING_TYPES} /><TermChoices label="Voice technique (optional)" name="techniques" terms={TECHNIQUES} /><TermChoices label="Voice styles (optional)" name="genres" terms={VOICE_STYLES} />
        <p className="form-intro">Selected specialties become listing tags and filters only after an editor verifies them on the official source.</p>
        {['teacher', 'provider', 'coach'].includes(selectedType) && <SubmittedOfferingFields />}
        {selectedType === 'teacher' && <label className="form-field"><span>Studio affiliation (optional)</span><select name="affiliation_provider_id"><option value="">Not listed / unconfirmed</option>{providers.filter(item => item.listing_type !== 'coach').map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>}
        {selectedType === 'offering' && <><label className="form-field"><span>Provider *</span><select name="provider_id" required defaultValue=""><option value="" disabled>Select the organization or business</option>{providers.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select><small>Submit a provider first if it is not in this list.</small></label><SubmittedOfferingFields includeName={false} /></>}
        <div className="form-grid"><label className="form-field"><span>Contact name *</span><input name="contact_name" required maxLength="160" /></label><label className="form-field"><span>Contact email *</span><input name="contact_email" type="email" required maxLength="254" /></label></div>
      </>}
      {['claim', 'removal'].includes(selectedType) && <><label className="form-field"><span>Request type</span><select value={selectedType} onChange={event => setSelectedType(event.target.value)}><option value="claim">Claim listing</option><option value="removal">Request removal</option><option value="profile_update">Request a correction</option></select></label>{selectedType === 'removal' && <label className="form-field"><span>Reason for removal *</span><textarea name="description" required minLength={10} maxLength={3000} rows="3" /></label>}<p className="form-intro">A claim request does not grant editing access. We review each request and verify the connection before changing a profile.</p><label className="form-field"><span>Contact person *</span><input name="contact_name" required maxLength="160" /></label><label className="form-field"><span>Contact email *</span><input name="contact_email" type="email" required maxLength="254" /></label><label className="form-field"><span>Website</span><input name="website_url" type="url" placeholder="https://" /></label><label className="form-field"><span>Instagram</span><input name="instagram_url" placeholder="https://instagram.com/" /></label><label className="form-field"><span>How can we verify your connection? *</span><textarea name="verification_information" required minLength={20} rows="3" maxLength="2000" placeholder="Describe your role or provide a relevant verification detail." /></label></>}
      {selectedType === 'profile_update' && <><p className="form-intro">Our editors will check the correction against its supporting source.</p><label className="form-field"><span>Contact name *</span><input name="contact_name" required maxLength="160" /></label><label className="form-field"><span>Contact email *</span><input name="contact_email" type="email" required maxLength="254" /></label><label className="form-field"><span>What should be updated? *</span><textarea name="description" required rows="4" maxLength="3000" placeholder="Describe the correction or new information." /></label><label className="form-field"><span>Supporting website (optional)</span><input name="website_url" type="url" placeholder="https://" /></label>{provider?.kind === 'teacher' && <><input type="hidden" name="target_kind" value="teacher" /><input type="hidden" name="target_id" value={provider.id} /></>}</>}
      <p className="form-note">Submissions stay private until reviewed. No website account is required. Requests never grant editing access automatically.</p><button className="button button-violet form-submit" type="submit" disabled={sending}>{sending ? 'Saving…' : 'Send for review'} <span aria-hidden="true">↗</span></button>
    </form>}
  </dialog>;
}

function AdminReviewPage() {
  const [ownership, setOwnership] = useState({});
  const [verifiedFacts, setVerifiedFacts] = useState({});
  const [key, setKey] = useState(''); const [submissions, setSubmissions] = useState([]); const [message, setMessage] = useState(''); const [loading, setLoading] = useState(false);
  useEffect(() => setMeta('Review queue', 'Review vocal teacher and singing class submissions, claims and profile updates.', window.location.pathname, true), []);
  const load = async event => {
    event?.preventDefault(); setLoading(true); setMessage('');
    try { const response = await fetch('/api/admin/submissions', { headers: { Authorization: `Bearer ${key}` } }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Could not load review queue.'); setSubmissions(data); setMessage(data.length ? '' : 'There are no pending submissions.'); }
    catch (error) { setMessage(error.message || 'Could not load review queue.'); } finally { setLoading(false); }
  };
  const decide = async (id, action) => {
    setLoading(true); setMessage('');
    try { const response = await fetch('/api/admin/decision', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify({ id, action, details_verified: Boolean(verifiedFacts[id]), ...ownership[id] }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Decision failed.'); setSubmissions(items => items.filter(item => item.id !== id)); setVerifiedFacts(previous => { const next = { ...previous }; delete next[id]; return next; }); setMessage(`Submission ${action}. ${approvalEmailNotice(data.approvalEmail)}`); }
    catch (error) { setMessage(error.message || 'Decision failed.'); } finally { setLoading(false); }
  };
  return <div className="admin-shell"><Header onSubmit={() => {}} /><main className="admin-page"><span className="section-kicker">VOCAL CATALOG · EDITOR TOOLS</span><h1>Review queue</h1><p>Approve or reject submissions. Verify submitted details against official sources before publishing.</p><form className="admin-key-form" onSubmit={load}><label className="form-field"><span>Review key</span><input type="password" value={key} onChange={event => setKey(event.target.value)} autoComplete="current-password" required /></label><button className="button button-violet" type="submit" disabled={loading}>{loading ? 'Loading…' : 'Load pending'}</button></form>{message && <p className="admin-message" role="status">{message}</p>}<div className="admin-list">{submissions.map(submission => <article className="admin-submission" key={submission.id}><div className="card-overline"><span>{submission.submission_type.replace('_', ' ').toUpperCase()}</span><span>{new Date(`${submission.submitted_at.replace(' ', 'T')}Z`).toLocaleString()}</span></div><h2>{submission.payload.name || submission.payload.provider_name || 'Profile request'}</h2><p>{submission.payload.description || submission.payload.verification_information || 'No description provided.'}</p><p className="admin-contact">{submission.contact_name} · {submission.contact_email} · {submission.website_url}</p><details><summary>Full submission details</summary><pre>{JSON.stringify(submission.payload, null, 2)}</pre></details>{(['provider','teacher'].includes(submission.submission_type) || submission.payload.type === 'domain_merge') && <ProviderMergeReview submission={submission} reviewKey={key} onComplete={(id, notice) => { setSubmissions(items => items.filter(item => item.id !== id)); setMessage(notice); }} />}{['provider', 'teacher'].includes(submission.submission_type) && <label className="form-field"><span>Verify profile type against official website</span><select value={ownership[submission.id]?.provider_classification || 'unconfirmed'} onChange={event => setOwnership(previous => ({ ...previous, [submission.id]: { ...previous[submission.id], provider_classification: event.target.value } }))}><option value="unconfirmed">Unconfirmed — cannot publish yet</option><option value="independent_teacher">Independent</option><option value="institution">Institution</option>{submission.submission_type === 'provider' && <option value="studio_business">Studio / Business</option>}</select></label>}{submission.submission_type === 'teacher' && <p className="form-note">Independent creates a primary directory listing. Institutional teachers remain teacher profiles and are not added as standalone providers.</p>}{['claim', 'removal'].includes(submission.submission_type) && <fieldset className="ownership-review"><legend>Ownership verification</legend><label><input type="checkbox" checked={ownership[submission.id]?.ownership_verified || false} onChange={event => setOwnership(previous => ({ ...previous, [submission.id]: { ...previous[submission.id], ownership_verified: event.target.checked } }))} /> Verified through an official contact channel</label><label className="form-field"><span>Verification record (at least 20 characters)</span><textarea value={ownership[submission.id]?.verification_note || ''} onChange={event => setOwnership(previous => ({ ...previous, [submission.id]: { ...previous[submission.id], verification_note: event.target.value } }))} /></label></fieldset>}{['provider', 'teacher', 'offering'].includes(submission.submission_type) && <label className="submission-verification-check"><input type="checkbox" checked={Boolean(verifiedFacts[submission.id])} onChange={event => setVerifiedFacts(previous => ({ ...previous, [submission.id]: event.target.checked }))} /><span>I verified the submitted profile, location, offering, price, and selected tags against the official source above. Only confirmed details will appear.</span></label>}<div className="admin-actions"><button className="button button-violet" disabled={loading || submission.payload.type === 'domain_merge' || Boolean(submission.payload.merge_target_id) || (['provider', 'teacher', 'offering'].includes(submission.submission_type) && !verifiedFacts[submission.id]) || (submission.submission_type === 'provider' && !['independent_teacher', 'institution', 'studio_business'].includes(ownership[submission.id]?.provider_classification)) || (submission.submission_type === 'teacher' && !['independent_teacher', 'institution'].includes(ownership[submission.id]?.provider_classification)) || (['claim', 'removal'].includes(submission.submission_type) && (!ownership[submission.id]?.ownership_verified || (ownership[submission.id]?.verification_note || '').trim().length < 20))} onClick={() => decide(submission.id, 'approved')}>{submission.payload.type === 'domain_merge' || submission.payload.merge_target_id ? 'Use merge review above' : 'Approve'}</button><button className="button button-outline" disabled={loading} onClick={() => decide(submission.id, 'rejected')}>Reject</button></div></article>)}</div><a className="text-link" href="/">Return to directory ↗</a></main></div>;
}

function SeoDocument({ directory }) {
  const [type, setType] = useState(() => window.location.hash === '#claim-remove' ? 'claim' : null);
  useEffect(() => { const open = () => { if (window.location.hash === '#claim-remove') setType('claim'); }; window.addEventListener('hashchange', open); return () => window.removeEventListener('hashchange', open); }, []);
  const profile = seoPage.profile && [...directory.providers.map(item => ({ ...item, kind: 'provider' })), ...(directory.teachers || []), ...directory.offerings.map(item => ({ ...item, kind: 'offering' }))].find(item => item.kind === seoPage.profile.kind && item.id === seoPage.profile.id);
  return <><Header onSubmit={() => setType('provider')} /><main dangerouslySetInnerHTML={{ __html: seoPage.body }} />{profile && <div className="seo-explore-wrapper"><SaveListingButton item={profile} /><a className="saved-profile-link" href="/?saved=1#directory">View saved listings</a><button className="suggest-update" onClick={() => setType('profile_update')}>Suggest a profile correction</button>{['teacher', 'provider'].includes(profile.kind) && <button className="suggest-update" onClick={() => setType('claim')}>Claim or Remove Listing</button>}</div>}<Footer onSubmit={() => setType('provider')} />{type && <SubmissionModal initialType={type} provider={['claim', 'removal', 'profile_update'].includes(type) ? profile : null} providers={directory.providers} onClose={() => setType(null)} />}</>;
}

export default function App() {
  const directory = useDirectory();
  if (window.location.pathname.replace(/\/$/, '') === '/admin/review') return <AdminReviewPage />;
  return <SavedListingsProvider>{seoPage && (!seoPage.home || seoPage.status !== 200) ? <SeoDocument directory={directory} /> : <UnifiedDirectory directory={directory} />}</SavedListingsProvider>;
}

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BUDGETS, FORMATS, LOCATIONS, PRICE_BASES, TECHNIQUES, TRAINING_TYPES, VOICE_STYLES,
  filterListings, getCollectionType, mergeListings, priceLabel,
} from './directory-utils.js';


function setMeta(title, description, canonicalPath = window.location.pathname, noIndex = false) {
  document.title = `${title} | Voxline NYC`;
  const updateMeta = (selector, attribute, value) => {
    let node = document.querySelector(selector);
    if (!node) { node = document.createElement('meta'); node.setAttribute(attribute, selector.includes('property') ? selector.match(/"([^"]+)"/)[1] : selector.match(/"([^"]+)"/)[1]); document.head.append(node); }
    node.content = value;
  };
  updateMeta('meta[name="description"]', 'name', description);
  updateMeta('meta[name="robots"]', 'name', noIndex ? 'noindex, nofollow' : 'index, follow');
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.append(canonical); }
  canonical.href = new URL(canonicalPath, window.location.origin).href;
}

function currentListingSlug() {
  const params = new URLSearchParams(window.location.search);
  return params.get('listing') || window.location.pathname.match(/^\/(?:providers|classes|teachers)\/([^/]+)\/?$/)?.[1] || '';
}

function initialFilters() {
  const params = new URLSearchParams(window.location.search);
  return {
    type: ['coaches', 'classes', 'studios'].includes(params.get('type')) ? params.get('type') : 'all',
    q: params.get('q') || '', location: params.get('location') || '',
    training: params.get('training') || '', technique: params.get('technique') || '',
    style: params.get('style') || '', format: params.get('format') || '',
    budget: params.get('budget') || '', priceBasis: params.get('basis') || '', minPrice: params.get('min') || '', maxPrice: params.get('max') || '', sort: params.get('sort') || 'name',
  };
}

function useDirectory() {
  const [data, setData] = useState({ providers: [], offerings: [] });
  const [status, setStatus] = useState('loading');
  useEffect(() => {
    let active = true;
    fetch('/api/directory').then(async response => {
      if (!response.ok) throw new Error('The directory could not be loaded.');
      return response.json();
    }).then(result => { if (active) { setData(result); setStatus('ready'); } })
      .catch(() => { if (active) setStatus('error'); });
    return () => { active = false; };
  }, []);
  return { ...data, status };
}

function Brand() {
  return <a className="brand" href="/" aria-label="Voxline NYC home"><span className="brand-name"><strong className="brand-wordmark">VOXLINE<span className="brand-city">NYC</span><span className="wordmark-note" aria-hidden="true">♪</span></strong><span>VOICE COACHES · CLASSES</span></span></a>;
}

function Header({ onSubmit }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return <header className="site-header"><div className="header-inner"><Brand />
    <nav className={`main-nav ${menuOpen ? 'main-nav-open' : ''}`} aria-label="Main navigation">
      <a href="#directory" onClick={() => setMenuOpen(false)}>Explore</a><a href="/coaches" onClick={() => setMenuOpen(false)}>Coaches</a><a href="/classes" onClick={() => setMenuOpen(false)}>Classes</a><a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a>
    </nav>
    <button className="button button-violet header-cta" onClick={onSubmit}>Suggest a coach or class <span aria-hidden="true">↗</span></button>
    <button className="menu-toggle" aria-expanded={menuOpen} aria-label={menuOpen ? 'Close menu' : 'Open menu'} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? 'Close' : 'Menu'}</button>
  </div></header>;
}

function Footer({ onSubmit }) {
  return <footer className="site-footer"><div className="footer-inner"><Brand /><span>A considered guide to singing lessons in New York.</span><button className="footer-submit" onClick={onSubmit}>Suggest a coach or class ↗</button><a href="/admin/review">Editorial review</a><small>© 2026 Voxline NYC</small></div></footer>;
}

function PlaceLabel({ locations = [] }) {
  const labels = [...new Set(locations.map(location => {
    const value = location.is_online ? 'Online' : location.neighborhood || location.borough || location.city;
    return value && location.verified ? value : '';
  }).filter(Boolean))];
  return <span>{labels.slice(0, 2).join(' · ') || 'Location not listed'}</span>;
}

function itemType(item) {
  if (item.kind === 'teacher') return item.professional_title || 'Voice teacher';
  const type = getCollectionType(item);
  return item.kind === 'provider' ? (item.listing_type === 'school' ? 'Voice school' : type === 'coach' ? 'Vocal coach' : 'Voice studio') : (type === 'coach' ? 'Private voice lesson' : 'Group voice class');
}

function Photo({ item, className = '', showFallback = true }) {
  const [failed, setFailed] = useState(false);
  const imageUrl = item.image_url || item.featured_image_url;
  const hasApprovedImage = item.image_permission_status === 'approved' && imageUrl && !failed;
  return <div className={`listing-photo ${className}`}>
    {hasApprovedImage ? <img src={imageUrl} alt={item.image_alt || `${item.name}, vocal coach`} loading="lazy" decoding="async" onError={() => setFailed(true)} /> :
      showFallback && <div className="portrait-pending" aria-label="Coach portrait not yet provided"><span>{item.name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase()}</span><small>PORTRAIT TO COME</small></div>}
    <span className="photo-type">{itemType(item)}</span>
  </div>;
}

function ListingCard({ item, onOpen, index = 0 }) {
  const terms = (item.terms || []).filter(term => term.verification_status === 'verified').slice(0, 2);
  const price = priceLabel(item, { prefix: true });
  const blackKeys = [1, 3, 6, 8, 10];
  const tone = blackKeys.includes(index % 12) ? 'black' : 'white';
  const note = '♩';
  return <button
    className={`listing-card piano-key piano-key-${tone} score-listing-${item.kind}`}
    onClick={event => onOpen(item, event.currentTarget)}
    aria-haspopup="dialog"
    aria-label={`Tile ${index + 1}: view details for ${item.name}`}
    style={{ '--key-index': index }}
  >
    <span className="key-score" aria-hidden="true"><span>{String(index + 1).padStart(2, '0')}</span><span className="key-note">{note}</span></span>
    <span className="score-notehead" aria-hidden="true">{note}</span>
    <span className="card-content">
      <span className="card-meta">
        <span className="card-type"><span aria-hidden="true">{item.kind === 'offering' ? '♫' : '♪'}</span>{itemType(item)}</span>
        <span className="card-location"><span aria-hidden="true">⌖</span><PlaceLabel locations={item.locations} /></span>
      </span>
      <span className="card-main">
        <span className="card-title-row">
          <span className="card-title">{item.name}</span>
          <span className="card-note-mark" aria-hidden="true">{note}</span>
        </span>
        {item.provider_name && <span className="provider-byline">with {item.provider_name}</span>}
        <span className="card-description">{item.description || item.biography || 'Individual teaching profile. Follow the official link for current details.'}</span>
        <span className="card-tags">{terms.map(term => <span key={term.id}>{term.term}</span>)}</span>
      </span>
      <span className="card-bottom">
        <span className={(item.kind === 'teacher' ? item.offerings?.some(offering => offering.priceVerified && offering.price_min != null) : item.priceVerified) ? 'card-price' : 'card-price card-price-muted'}>{price}</span>
        <span className="card-link-cue">View profile <span className="card-open" aria-hidden="true">↗</span></span>
      </span>
    </span>
  </button>;
}

function SearchBox({ value, onChange, onSubmit, id = 'directory-search', className = '' }) {
  return <form className={`search-box ${className}`} role="search" onSubmit={event => { event.preventDefault(); onSubmit?.(); }}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></svg>
    <label className="sr-only" htmlFor={id}>Search vocal coaches, voice styles, lesson focus or locations</label>
    <input id={id} value={value} onChange={event => onChange(event.target.value)} placeholder="Try “musical theatre in Manhattan”" autoComplete="off" />
    {value && <button className="search-clear" type="button" onClick={() => onChange('')} aria-label="Clear search">×</button>}
    <button className="search-submit" type="submit">Search</button>
  </form>;
}

function FilterField({ label, value, onChange, options }) {
  return <label className="filter-field"><span>{label}</span><select value={value} onChange={event => onChange(event.target.value)}><option value="">Any {label.toLowerCase()}</option>{options.map(([optionValue, text]) => <option key={optionValue} value={optionValue}>{text}</option>)}</select></label>;
}

function FilterControls({ filters, update, reset, choices }) {
  return <div className="filter-controls">
    <FilterField label="Location" value={filters.location} onChange={value => update('location', value)} options={choices.locations} />
    <FilterField label="Lesson focus" value={filters.training} onChange={value => update('training', value)} options={choices.training} />
    <FilterField label="Voice technique" value={filters.technique} onChange={value => update('technique', value)} options={choices.techniques} />
    <FilterField label="Voice style" value={filters.style} onChange={value => update('style', value)} options={choices.styles} />
    <FilterField label="Format" value={filters.format} onChange={value => update('format', value)} options={choices.formats} />
    <FilterField label="Budget" value={filters.budget} onChange={value => update('budget', value)} options={choices.budgets} />
    <FilterField label="Price basis" value={filters.priceBasis} onChange={value => update('priceBasis', value)} options={choices.priceBases} />
    <button className="clear-filters" onClick={reset} type="button">Clear all</button>
  </div>;
}

function MobileFilterDialog({ filters, update, reset, resultCount, onClose, choices }) {
  const dialog = useRef(null);
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    node.showModal();
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = oldOverflow; };
  }, []);
  return <dialog className="filter-backdrop" ref={dialog} aria-labelledby="filter-drawer-title" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === dialog.current) onClose(); }}>
    <section className="filter-drawer"><div className="drawer-heading"><div><span className="section-kicker">REFINE YOUR SEARCH</span><h2 id="filter-drawer-title">Refine results</h2></div><button className="icon-button" onClick={onClose} aria-label="Close filters">×</button></div><FilterControls filters={filters} update={update} reset={reset} choices={choices} /><button className="button button-violet drawer-done" onClick={onClose}>Show {resultCount} results</button></section>
  </dialog>;
}

function ResultsDirectory({ directory, filters, update, reset, onOpen }) {
  const pageSize = 12;
  const [pageIndex, setPageIndex] = useState(0);
  const [mobileFilters, setMobileFilters] = useState(false);
  const teacherListings = useMemo(() => mergeListings(directory), [directory]);
  const choices = useMemo(() => {
    const terms = taxonomy => {
      const map = new Map();
      for (const item of teacherListings) for (const term of item.terms || []) {
        if (term.taxonomy === taxonomy && term.verification_status === 'verified') map.set(term.slug, [term.slug, term.term]);
      }
      return [...map.values()];
    };
    const locations = [...new Set(teacherListings.flatMap(item => (item.locations || []).filter(location => location.verified)
      .map(location => location.is_online ? 'Online' : location.borough || 'NYC').filter(Boolean)))].map(value => [value, value]);
    const verifiedOffers = teacherListings.flatMap(item => item.offerings || []);
    const formats = FORMATS.filter(([value]) => teacherListings.some(item =>
      (item.formats || []).some(format => format.verification_status === 'verified' && format.format === value)) ||
      verifiedOffers.some(offering => offering.formatVerified && offering.format === value));
    const budgets = BUDGETS.filter(([, , min, max]) => teacherListings.some(item => {
      const amount = item.offerings?.filter(offering => offering.priceVerified && offering.price_min != null).map(offering => Number(offering.price_min)) || [];
      return amount.some(price => price >= min && price <= max);
    })).map(([slug, label]) => [slug, label]);
    const priceBases = PRICE_BASES.filter(([value]) => verifiedOffers.some(offering => offering.priceVerified && offering.price_min != null && offering.price_basis === value));
    return {
      locations,
      training: [...new Map([...terms('training_type'), ...terms('specialty')].map(term => [term[0], term])).values()],
      techniques: terms('technique'),
      styles: terms('genre'),
      formats,
      budgets,
      priceBases,
    };
  }, [teacherListings]);
  const allListings = useMemo(() => filterListings(teacherListings, filters), [teacherListings, filters]);
  const pageCount = Math.max(1, Math.ceil(allListings.length / pageSize));
  const visibleListings = allListings.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
  const activeFilters = [
    ['location', filters.location], ['training', filters.training], ['technique', filters.technique], ['style', filters.style],
    ['format', filters.format], ['budget', filters.budget], ['priceBasis', filters.priceBasis],
  ].filter(([, value]) => value);
  const removeFilter = key => update(key, '');
  useEffect(() => { setPageIndex(0); }, [filters]);
  const changePage = direction => {
    setPageIndex(page => Math.max(0, Math.min(pageCount - 1, page + (direction === 'next' ? 1 : -1))));
  };

  if (directory.status === 'loading') return <div className="loading-state"><span className="loading-spinner" />Gathering vocal coach profiles…</div>;
  if (directory.status === 'error') return <div className="error-state" role="alert"><strong>We couldn’t load the directory.</strong><span>Try refreshing in a moment.</span></div>;
  return <section className="directory-section" id="directory">
    <div className="directory-heading"><h2 className="sr-only">New York vocal coaches and singing classes</h2></div>
    <div className="directory-toolbar"><SearchBox value={filters.q} onChange={value => update('q', value)} id="results-search" className="results-search" />
      <button className="mobile-filter-button" onClick={() => setMobileFilters(true)} aria-haspopup="dialog"><span aria-hidden="true">☷</span> Filters{activeFilters.length ? ` · ${activeFilters.length}` : ''}</button>
    </div>
    <div className="directory-layout">
      <aside className="directory-sidebar" aria-label="Directory filters">
        <div className="sidebar-heading"><strong>Filters</strong><button type="button" onClick={reset}>Clear all</button></div>
        <div className="listing-type-tabs" role="group" aria-label="Listing type">
          {[['all', 'All lessons'], ['coaches', 'Vocal coaches'], ['classes', 'Classes']].map(([value, label]) =>
            <button key={value} type="button" className={filters.type === value ? 'listing-type-tab active' : 'listing-type-tab'} aria-pressed={filters.type === value} onClick={() => update('type', value)}>{label}</button>)}
        </div>
        <div className="sidebar-filter-group"><strong>Lesson focus</strong><div className="category-tabs" role="group" aria-label="Quick specialty filters">{choices.training.slice(0, 6).map(([value, label]) => <button key={value} type="button" className={filters.training === value ? 'category-tab active' : 'category-tab'} aria-pressed={filters.training === value} onClick={() => update('training', filters.training === value ? '' : value)}>{label}</button>)}</div></div>
        <details className="filter-panel"><summary><span className="filter-summary-icon" aria-hidden="true">♩</span> More filters {activeFilters.length > 0 && <span className="filter-count">{activeFilters.length}</span>}<span className="summary-chevron" aria-hidden="true">⌄</span></summary><FilterControls filters={filters} update={update} reset={reset} choices={choices} /></details>
        {activeFilters.length > 0 && <div className="active-filters" aria-label="Active filters">{activeFilters.map(([key, value]) => {
          const label = key === 'training' ? choices.training.find(([slug]) => slug === value)?.[1]
            : key === 'technique' ? choices.techniques.find(([slug]) => slug === value)?.[1]
            : key === 'style' ? choices.styles.find(([slug]) => slug === value)?.[1] : value;
          return <button key={key} onClick={() => removeFilter(key)}>{label || value}<span aria-hidden="true">×</span></button>;
        })}</div>}
      </aside>
      <div className="directory-results">
        <div className="results-head"><div className="results-count" aria-live="polite"><strong>{allListings.length}</strong> {filters.type === 'classes' ? (allListings.length === 1 ? 'class' : 'classes') : filters.type === 'coaches' ? (allListings.length === 1 ? 'coaching option' : 'coaching options') : (allListings.length === 1 ? 'result' : 'results')}{filters.q && <span> matching “{filters.q}”</span>}</div><label className="sort-field"><span>Sort:</span><select value={filters.sort} onChange={event => update('sort', event.target.value)}><option value="name">Name A–Z</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select></label></div>
        {visibleListings.length ? <>
          <div className="keyboard-instruction"><span aria-hidden="true">𝄞</span> A growing circle of vocal teachers and classes <span aria-hidden="true">♪</span></div>
          <div className="listing-grid" role="region" aria-label="Vocal coaches and classes arranged on a musical score" tabIndex="0">
            {visibleListings.map((item, index) => <ListingCard key={`${item.kind}-${item.id}`} item={item} index={pageIndex * pageSize + index} onOpen={onOpen} />)}
          </div>
        </> : <div className="empty-state"><span className="empty-icon" aria-hidden="true">⌕</span><h3>No matches yet</h3><p>Try a broader search or clear filters to see every listing.</p><button className="button button-outline" onClick={reset}>Clear filters</button></div>}
        {pageCount > 1 && <nav className="score-pagination" aria-label="Directory pages">
          <button type="button" className="button button-outline score-page-button" onClick={() => changePage('previous')} disabled={pageIndex === 0} aria-label="Previous page"><span aria-hidden="true">←</span> Previous</button>
          <span className="score-page-count" aria-live="polite">Page {pageIndex + 1} of {pageCount}<span> · </span>Showing {pageIndex * pageSize + 1}–{Math.min((pageIndex + 1) * pageSize, allListings.length)} of {allListings.length}</span>
          <button type="button" className="button button-outline score-page-button" onClick={() => changePage('next')} disabled={pageIndex >= pageCount - 1}>Next <span aria-hidden="true">→</span></button>
        </nav>}
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
  const related = item.kind === 'teacher' ? item.offerings || [] : [];
  const locationRows = (item.locations || []).filter(location => location.verified);
  const terms = (item.terms || []).filter(term => term.verification_status === 'verified');
  const verifiedFormat = related.find(offering => offering.formatVerified)?.format;
  const formatNames = ({ in_person: 'In person', online: 'Online', hybrid: 'Hybrid' });
  const formats = item.kind === 'teacher'
    ? (item.formats || []).filter(entry => entry.verification_status === 'verified').map(entry => formatNames[entry.format]).filter(Boolean)
    : item.format && item.formatVerified ? [formatNames[item.format]] : verifiedFormat ? [formatNames[verifiedFormat]] : [];
  const format = [...new Set(formats)].join(' · ');
  const price = priceLabel(item);
  const hasApprovedPhoto = item.image_permission_status === 'approved' && (item.image_url || item.featured_image_url);
  const experience = [item.teaching_experience, item.experience_years && `${item.experience_years} years of experience`, item.credentials].filter(Boolean);
  return <dialog className="listing-dialog" ref={dialog} aria-labelledby="listing-modal-title" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === dialog.current) onClose(); }}>
    <div className="listing-modal-shell"><button className="modal-close" onClick={onClose} aria-label="Close listing details">×</button>
      <div className={`modal-hero${hasApprovedPhoto ? ' has-photo' : ''}`}>{hasApprovedPhoto ? <Photo item={item} className="modal-photo" showFallback={false} /> : <div className="modal-score-mark" aria-hidden="true">𝄞</div>}<div className="modal-title-block"><span className="section-kicker">{itemType(item)}</span><h2 id="listing-modal-title">{item.name}</h2><div className="modal-location"><span aria-hidden="true">⌖</span><PlaceLabel locations={item.locations} />{format && <><span className="modal-meta-divider" aria-hidden="true">·</span><span>{format}</span></>}</div></div></div>
      <div className="modal-body"><main className="modal-main"><section className="modal-section"><span className="section-kicker">ABOUT</span>{item.description && <p>{item.description}</p>}{item.biography && <p>{item.biography}</p>}{!item.description && !item.biography && <p>Teaching details are available from the provider. Visit the official profile for more information.</p>}</section>
        {terms.length > 0 && <section className="modal-section"><span className="section-kicker">TECHNIQUES & SPECIALTIES</span><div className="modal-specialties">{terms.map(term => <BrandPill key={term.id}>{term.term}</BrandPill>)}</div></section>}
        {experience.length > 0 && <section className="modal-section"><span className="section-kicker">EXPERIENCE & CREDENTIALS</span>{experience.map((detail, index) => <p key={index}>{detail}</p>)}</section>}
        {related.length > 0 && <section className="modal-section"><span className="section-kicker">PUBLISHED CLASSES & COACHING</span><div className="related-offerings">{related.map(offering => <article key={offering.id}><strong>{offering.name}</strong>{offering.description && <p>{offering.description}</p>}<div className="offering-facts">{offering.skill_level && <span>{offering.skill_level}</span>}{offering.instruction_mode && <span>{offering.instruction_mode}</span>}{offering.formatVerified && offering.format && <span>{({ in_person: 'In person', online: 'Online', hybrid: 'Hybrid' })[offering.format]}</span>}{offering.schedule_text && <span>{offering.schedule_text}</span>}{offering.priceVerified && offering.price_min != null && <span>{priceLabel({ ...offering, kind: 'offering', priceVerified: true })}</span>}</div>{(offering.registration_url || offering.enrollment_url || offering.source_url) && <a href={offering.registration_url || offering.enrollment_url || offering.source_url} target="_blank" rel="noopener noreferrer">Official class information ↗</a>}</article>)}</div></section>}
        {item.affiliations?.length > 0 && <section className="modal-section"><span className="section-kicker">STUDIO AFFILIATIONS</span><div className="related-offerings">{item.affiliations.map(provider => <a className="related-provider" key={provider.id} href={provider.website_url || provider.source_url} target="_blank" rel="noopener noreferrer">{provider.name}<span>Official website ↗</span></a>)}</div></section>}
      </main><aside className="modal-aside"><div className="detail-panel"><span className="section-kicker">AT A GLANCE</span>
        <div className="detail-row"><span>Pricing</span><strong>{price}</strong></div>
        {format && <div className="detail-row"><span>Format</span><strong>{format}</strong></div>}
        {locationRows.length > 0 && <div className="detail-row"><span>Location</span><strong>{locationRows.map(location => location.postal_address || location.label).join(' · ')}</strong></div>}
        {terms.length > 0 && <div className="detail-row detail-tags"><span>Specialties</span><div>{terms.map(term => <BrandPill key={term.id}>{term.term}</BrandPill>)}</div></div>}
        <div className="detail-actions">{(item.booking_url || item.website_url) && <a className="button button-violet" href={item.booking_url || item.website_url} target="_blank" rel="noopener noreferrer">Contact / booking ↗</a>}{item.website_url && <a className="button button-outline" href={item.website_url} target="_blank" rel="noopener noreferrer">Professional website ↗</a>}{item.instagram_url && <a className="detail-social" href={item.instagram_url} target="_blank" rel="noopener noreferrer">Instagram ↗</a>}</div>
        {(item.source_url || item.website_url) && <a className="source-note" href={item.source_url || item.website_url} target="_blank" rel="noopener noreferrer">{item.website_url ? 'View official profile' : 'View source listing'} ↗</a>}
        {!item.website_url && item.source_url && <p className="verification-note">This coach is listed in a professional voice-teacher directory. Confirm current availability and booking details with the source.</p>}
        {item.last_verified_at && <p className="verification-note">Profile facts reviewed {new Date(`${item.last_verified_at}T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.</p>}
      </div>{item.kind === 'teacher' && item.claim_status === 'unclaimed' && <button className="suggest-update" onClick={() => onSuggestUpdate(item, 'claim')}>Claim this profile</button>}<button className="suggest-update" onClick={() => onSuggestUpdate(item, 'profile_update')}>Suggest a profile correction</button></aside></div>
    </div>
  </dialog>;
}

function IntroSections({ onSubmit }) {
  return <><section className="how-section" id="how-it-works"><div><span className="section-kicker">A CLEARER WAY TO FIND YOUR GUIDE</span><h2>Find a voice teacher<br />who fits your goals.</h2></div><div className="how-points"><article><span>01</span><strong>Choose with clarity</strong><p>Published prices stay tied to their lesson format. Missing details stay unknown.</p></article><article><span>02</span><strong>Find your focus</strong><p>Filter by voice style, lesson focus, NYC location and verified format.</p></article><article><span>03</span><strong>Connect directly</strong><p>Read the coach or class source, then contact the teacher through their own channel.</p></article></div></section>
    <section className="provider-cta" id="for-providers"><div><span className="section-kicker">FOR VOICE TEACHERS & COACHES</span><h2>Your voice work belongs<br />in the conversation.</h2></div><div><p>Suggest a coach or singing class. Editors check the source and keep unverified details out of the filters.</p><button className="button button-white" onClick={onSubmit}>Suggest a coach <span aria-hidden="true">↗</span></button></div></section></>;
}

function UnifiedDirectory({ directory }) {
  const [filters, setFilters] = useState(initialFilters);
  const [openSlug, setOpenSlug] = useState(currentListingSlug);
  const [submittedType, setSubmittedType] = useState(null);
  const [submissionProvider, setSubmissionProvider] = useState(null);
  const lastTrigger = useRef(null);
  const listings = useMemo(() => mergeListings(directory), [directory]);
  const coaches = listings.filter(item => item.kind === 'teacher');
  const classCount = listings.filter(item => item.kind === 'offering').length;
  const verifiedFormatCount = new Set([
    ...coaches.flatMap(item => (item.formats || []).filter(format => format.verification_status === 'verified').map(format => format.format)),
    ...listings.flatMap(item => item.offerings || []).filter(offering => offering.formatVerified && offering.format).map(offering => offering.format),
  ]).size;
  const publishedRateCount = listings.filter(item => (item.offerings || []).some(offering => offering.priceVerified && offering.price_min != null)).length;
  const selectedItem = listings.find(item => item.slug === openSlug) || null;

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
      setMeta('Find vocal coaches and singing classes in NYC', 'Explore vocal coaches and singing classes across New York City. Search verified lesson focus, voice styles, locations, formats and published pricing.');
      return;
    }
    if (!directory.status || !selectedItem) return;
    const url = new URL(window.location.href);
    if (url.pathname !== '/') { url.pathname = '/'; url.searchParams.set('listing', openSlug); window.history.replaceState(null, '', url); }
    setMeta(selectedItem.name, selectedItem.description || `Explore ${selectedItem.name} on Voxline NYC.`, `/?listing=${encodeURIComponent(selectedItem.slug)}`);
  }, [openSlug, selectedItem, directory.status]);
  const update = (key, value) => {
    const next = { ...filters, [key]: value };
    setFilters(next);
    const url = new URL(window.location.href);
    url.pathname = '/';
    const names = { priceBasis: 'basis', minPrice: 'min', maxPrice: 'max' };
    for (const name of ['type','q','location','training','technique','style','format','budget','priceBasis','minPrice','maxPrice','sort']) url.searchParams.delete(names[name] || name);
    for (const [name, entry] of Object.entries(next)) if (entry && !(name === 'type' && entry === 'all') && !(name === 'sort' && entry === 'relevance')) url.searchParams.set(names[name] || name, entry);
    window.history.replaceState({ ...window.history.state, directory: true }, '', url);
  };
  const reset = () => { const next = { ...initialFilters(), type: filters.type }; setFilters(next); const url = new URL(window.location.href); url.pathname = '/'; for (const key of ['q','location','training','technique','style','format','budget','basis','min','max','sort']) url.searchParams.delete(key); if (next.type !== 'all') url.searchParams.set('type', next.type); window.history.replaceState({ ...window.history.state, directory: true }, '', url); };
  const openListing = (item, trigger) => {
    if (trigger) lastTrigger.current = trigger;
    setOpenSlug(item.slug);
    const url = new URL(window.location.href); url.pathname = '/'; url.searchParams.set('listing', item.slug);
    window.history.pushState({ listingModal: true, slug: item.slug }, '', url);
  };
  const closeListing = () => {
    if (window.history.state?.listingModal) { window.history.back(); return; }
    const url = new URL(window.location.href); url.pathname = '/'; url.searchParams.delete('listing');
    window.history.replaceState({ directory: true }, '', url); setOpenSlug('');
    lastTrigger.current?.focus();
  };
  const requestSubmission = (item, type = null) => { setSubmissionProvider(item || null); setSubmittedType(type || (item?.kind === 'offering' ? 'offering' : 'teacher')); };
  const openSearch = query => { if (query !== filters.q) update('q', query); document.querySelector('#directory')?.scrollIntoView({ behavior: 'smooth' }); };

  return <><Header onSubmit={() => requestSubmission(null, 'provider')} />
    <main>
      <section className="hero-section">
        <svg className="hero-score-art" viewBox="0 0 1440 300" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <g className="staff-lines"><path d="M-30 72 C260 35 420 150 710 105 S1160 40 1470 88" /><path d="M-30 91 C260 54 420 169 710 124 S1160 59 1470 107" /><path d="M-30 110 C260 73 420 188 710 143 S1160 78 1470 126" /><path d="M-30 129 C260 92 420 207 710 162 S1160 97 1470 145" /><path d="M-30 148 C260 111 420 226 710 181 S1160 116 1470 164" /></g>
          <g className="score-clefs"><text x="84" y="146">𝄞</text><text x="1268" y="132">𝄞</text></g>
          <g className="score-notes"><ellipse cx="314" cy="105" rx="9" ry="5" transform="rotate(-22 314 105)" /><path d="M322 105V46" /><ellipse cx="524" cy="159" rx="9" ry="5" transform="rotate(-22 524 159)" /><path d="M532 159V93" /><ellipse cx="1002" cy="104" rx="9" ry="5" transform="rotate(-22 1002 104)" /><path d="M1010 104V40" /><ellipse cx="1164" cy="77" rx="9" ry="5" transform="rotate(-22 1164 77)" /><path d="M1172 77V18" /></g>
        </svg>
        <div className="hero-inner"><div className="hero-copy"><span className="hero-note" aria-hidden="true">♩</span><span className="hero-eyebrow"><span className="hero-eyebrow-dot" /> NEW YORK CITY · VOICE & SINGING</span><h1>Vocal Coach <span>Directory</span></h1><p>Discover voice teachers, vocal coaches and singing classes in New York City.</p>
        <SearchBox value={filters.q} onChange={value => update('q', value)} onSubmit={() => openSearch(filters.q)} id="hero-search" className="hero-search" />
        <div className="hero-shortcuts" aria-label="Quick lesson focus filters">{TRAINING_TYPES.filter(([specialty]) => listings.some(item => (item.terms || []).some(term => term.slug === specialty && term.verification_status === 'verified'))).slice(0, 5).map(([specialty, label]) => <button key={specialty} onClick={() => { update("training", specialty); document.querySelector("#directory")?.scrollIntoView({ behavior: "smooth" }); }}>{label}<span aria-hidden="true">↗</span></button>)}</div>
        <div className="hero-location"><span className="location-pin" aria-hidden="true">⌖</span><span>New York City</span><span className="hero-location-divider" /><span>{coaches.length} vocal coaches · {classCount} {classCount === 1 ? 'class' : 'classes'}</span></div>
      </div><div className="hero-visual">{listings[0] ? <><div className="spotlight-heading"><span>IN THE DIRECTORY</span><span>01 <i>/</i> {String(listings.length).padStart(2, '0')}</span></div><button className="hero-spotlight" onClick={() => openListing(listings[0])} aria-haspopup="dialog" aria-label={`Explore ${listings[0].name}`}><Photo item={listings[0]} className="hero-spotlight-photo"/><span className="spotlight-copy"><span className="spotlight-type">{itemType(listings[0])} · NEW YORK CITY</span><strong>{listings[0].name}</strong><span className="spotlight-description">{listings[0].description || 'Read a coach profile and follow its source.'}</span><span className="spotlight-link">Explore profile <span aria-hidden="true">↗</span></span></span></button><div className="hero-stats"><div><strong>{coaches.length}</strong><span>vocal coaches</span></div><div><strong>{verifiedFormatCount}</strong><span>verified formats</span></div><div><strong>{publishedRateCount}</strong><span>with published rates</span></div></div></> : <div className="hero-spotlight-loading">A source-led guide to vocal coaches and classes in New York.</div>}</div></div>
      </section>
      <div className="keyboard-divider" aria-hidden="true" />
      <ResultsDirectory directory={directory} filters={filters} update={update} reset={reset} onOpen={openListing} />
      <IntroSections onSubmit={() => requestSubmission(null, 'provider')} />
    </main>
    <Footer onSubmit={() => requestSubmission(null, 'provider')} />
    {selectedItem && <ListingDialog key={selectedItem.id} item={selectedItem} directory={directory} onClose={closeListing} onOpenRelated={item => openListing(item)} onSuggestUpdate={requestSubmission} />}
    {submittedType && <SubmissionModal initialType={submittedType} provider={submissionProvider} providers={directory.providers} onClose={() => { setSubmittedType(null); setSubmissionProvider(null); }} />}
  </>;
}

function Eyebrow({ children }) { return <span className="section-kicker">{children}</span>; }

function TermChoices({ label, name, terms }) {
  return <fieldset className="term-choices"><legend>{label}</legend><div>{terms.map(([slug, term]) => <label key={slug}><input type="checkbox" name={name} value={slug} /><span>{term}</span></label>)}</div></fieldset>;
}

function SubmissionModal({ initialType = 'provider', provider, providers = [], onClose }) {
  const dialog = useRef(null);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedType, setSelectedType] = useState(initialType);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const onSubmitForm = async event => {
    event.preventDefault(); setSending(true); setMessage('');
    const formNode = event.currentTarget; const form = new FormData(formNode); const type = selectedType;
    const payload = Object.fromEntries(form.entries());
    payload.type = type; payload.provider_id = provider?.kind === 'provider' ? provider.id : payload.provider_id || ''; if (provider?.kind === 'teacher') { payload.target_kind = 'teacher'; payload.target_id = provider.id; }
    payload.training_types = form.getAll('training_types'); payload.techniques = form.getAll('techniques'); payload.genres = form.getAll('genres');
    try {
      const response = await fetch('/api/submissions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'The submission could not be saved.');
      setMessage('Thank you. Your submission is saved for editorial review. It will remain private until approved.'); formNode.reset();
    } catch (error) { setMessage(error.message || 'The submission could not be saved.'); }
    finally { setSending(false); }
  };
  return <dialog className="submission-dialog" ref={dialog} onClose={onClose} onClick={event => { if (event.target === dialog.current) dialog.current.close(); }}>
    <div className="dialog-heading"><div><Eyebrow>CONTRIBUTE TO THE DIRECTORY</Eyebrow><h2>{selectedType === 'claim' ? 'Claim this profile' : selectedType === 'profile_update' ? 'Suggest a profile update' : selectedType === 'teacher' ? 'Suggest a teacher' : 'Share a listing'}</h2></div><button className="icon-button" aria-label="Close dialog" onClick={() => dialog.current?.close()}>×</button></div>
    {message ? <div className="submission-success"><span className="success-mark">✓</span><p>{message}</p><button className="button button-violet" onClick={() => dialog.current?.close()}>Done</button></div> : <form className="submission-form" onSubmit={onSubmitForm}>
      {initialType === 'provider' && <label className="form-field"><span>Listing type</span><select value={selectedType} onChange={event => setSelectedType(event.target.value)}><option value="teacher">Individual voice teacher or vocal coach</option><option value="provider">Voice studio or school</option><option value="offering">Singing class or workshop</option></select></label>}
      {(selectedType === 'teacher' || selectedType === 'provider' || selectedType === 'coach' || selectedType === 'offering') && <>
        <label className="form-field"><span>{selectedType === 'offering' ? 'Class or workshop name' : selectedType === 'teacher' ? 'Professional name' : selectedType === 'coach' ? 'Coach name' : 'Studio or school name'} *</span><input name="name" required maxLength="160" /></label>
        {selectedType === 'coach' && <input type="hidden" name="listing_type" value="coach" />}
        {selectedType === 'teacher' && <label className="form-field"><span>Teaching role (optional)</span><select name="professional_title"><option>Voice teacher</option><option>Vocal coach</option><option>Singing teacher</option><option>Vocal pedagogue</option><option>Speech and voice coach</option><option>Other voice teacher</option></select></label>}
        {selectedType === 'provider' && <label className="form-field"><span>Organization type</span><select name="listing_type"><option value="studio">Voice studio</option><option value="school">Voice school or conservatory</option></select></label>}
        <label className="form-field"><span>Description *</span><textarea name="description" required rows="3" maxLength="3000" placeholder={selectedType === 'offering' ? 'What singers will work on and who the class is for.' : 'What kind of voice or singing instruction is offered?'} /></label>
        {selectedType === 'teacher' && <label className="form-field"><span>Biography (optional)</span><textarea name="biography" rows="4" maxLength="5000" placeholder="A short professional biography." /></label>}
        {selectedType === 'teacher' && <label className="form-field"><span>Teaching background (optional)</span><textarea name="teaching_experience" rows="3" maxLength="3000" placeholder="Teaching experience or professional background." /></label>}
        {selectedType === 'teacher' && <label className="form-field"><span>Instagram (optional)</span><input name="instagram_url" type="url" placeholder="https://instagram.com/" /></label>}
        {selectedType === 'teacher' && <label className="form-field"><span>Booking link (optional)</span><input name="booking_url" type="url" placeholder="https://" /></label>}
        {selectedType === 'provider' && <label className="form-field"><span>Teaching approach (optional)</span><textarea name="teaching_approach" rows="2" /></label>}
        <div className="form-grid"><label className="form-field"><span>Official website{selectedType === 'provider' ? ' *' : ''}</span><input name="website_url" type="url" placeholder="https://" required={selectedType === 'provider' || selectedType === 'teacher'} /></label>{selectedType === 'offering' && <label className="form-field"><span>Registration link (optional)</span><input name="registration_url" type="url" placeholder="https://" /></label>}</div>
        {(selectedType === 'teacher' || selectedType === 'provider' || selectedType === 'coach') && <label className="form-field"><span>Location (optional)</span><select name="borough"><option value="">New York City / not specified</option>{LOCATIONS.filter(item => item !== 'Online').map(location => <option key={location} value={location}>{location}</option>)}</select></label>}
        <TermChoices label="Lesson focus (optional)" name="training_types" terms={TRAINING_TYPES} /><TermChoices label="Voice technique (optional)" name="techniques" terms={TECHNIQUES} /><TermChoices label="Voice styles (optional)" name="genres" terms={VOICE_STYLES} />
        {selectedType === 'teacher' && <label className="form-field"><span>Studio affiliation (optional)</span><select name="affiliation_provider_id"><option value="">Independent / not listed</option>{providers.filter(item => item.listing_type !== 'coach').map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>}
        {selectedType === 'offering' && <><label className="form-field"><span>Provider (optional)</span><select name="provider_id"><option value="">Independent / not listed</option>{providers.filter(item => item.listing_type !== 'coach').map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><div className="form-grid"><label className="form-field"><span>Price (optional)</span><input name="price_min" type="number" min="0" step="1" placeholder="Not listed" /></label><label className="form-field"><span>Price basis</span><select name="price_basis"><option value="">Not specified</option><option value="per_session">Per session</option><option value="hourly">Hourly</option><option value="full_course">Full course</option><option value="workshop">Workshop</option><option value="other">Other</option></select></label></div><div className="form-grid"><label className="form-field"><span>Format</span><select name="format"><option value="">Not specified</option><option value="in_person">In person</option><option value="online">Online</option><option value="hybrid">Hybrid</option></select></label><label className="form-field"><span>Instruction</span><select name="instruction_mode"><option value="group">Group</option><option value="private">Private</option><option value="both">Both</option></select></label></div><label className="form-field"><span>Schedule or duration (optional)</span><input name="schedule_text" maxLength="300" placeholder="For example, 8 weeks · Tuesday evenings" /></label></>}
        <div className="form-grid"><label className="form-field"><span>Contact name *</span><input name="contact_name" required maxLength="160" /></label><label className="form-field"><span>Contact email *</span><input name="contact_email" type="email" required maxLength="254" /></label></div>
      </>}
      {selectedType === 'claim' && <><p className="form-intro">A claim request does not grant editing access. We review each request and verify the connection before changing a profile.</p><label className="form-field"><span>Contact person *</span><input name="contact_name" required maxLength="160" /></label><label className="form-field"><span>Business email *</span><input name="contact_email" type="email" required maxLength="254" /></label><label className="form-field"><span>Website</span><input name="website_url" type="url" placeholder="https://" /></label><label className="form-field"><span>Instagram</span><input name="instagram_url" placeholder="https://instagram.com/" /></label><label className="form-field"><span>How can we verify your connection? *</span><textarea name="verification_information" required rows="3" maxLength="2000" placeholder="Describe your role or provide a relevant verification detail." /></label></>}
      {selectedType === 'profile_update' && <><p className="form-intro">Our editors will check the correction against its supporting source.</p><label className="form-field"><span>Contact name *</span><input name="contact_name" required maxLength="160" /></label><label className="form-field"><span>Contact email *</span><input name="contact_email" type="email" required maxLength="254" /></label><label className="form-field"><span>What should be updated? *</span><textarea name="description" required rows="4" maxLength="3000" placeholder="Describe the correction or new information." /></label><label className="form-field"><span>Supporting website (optional)</span><input name="website_url" type="url" placeholder="https://" /></label>{provider?.kind === 'teacher' && <><input type="hidden" name="target_kind" value="teacher" /><input type="hidden" name="target_id" value={provider.id} /></>}</>}
      <p className="form-note">Submissions stay private until reviewed. No email account is required.</p><button className="button button-violet form-submit" type="submit" disabled={sending}>{sending ? 'Saving…' : 'Send for review'} <span aria-hidden="true">↗</span></button>
    </form>}
  </dialog>;
}

function AdminReviewPage() {
  const [key, setKey] = useState(''); const [submissions, setSubmissions] = useState([]); const [message, setMessage] = useState(''); const [loading, setLoading] = useState(false);
  useEffect(() => setMeta('Review queue', 'Review vocal teacher and singing class submissions, claims and profile updates.', window.location.pathname, true), []);
  const load = async event => {
    event?.preventDefault(); setLoading(true); setMessage('');
    try { const response = await fetch('/api/admin/submissions', { headers: { Authorization: `Bearer ${key}` } }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Could not load review queue.'); setSubmissions(data); setMessage(data.length ? '' : 'There are no pending submissions.'); }
    catch (error) { setMessage(error.message || 'Could not load review queue.'); } finally { setLoading(false); }
  };
  const decide = async (id, action) => {
    setLoading(true); setMessage('');
    try { const response = await fetch('/api/admin/decision', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify({ id, action }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Decision failed.'); setSubmissions(items => items.filter(item => item.id !== id)); setMessage(`Submission ${action}.`); }
    catch (error) { setMessage(error.message || 'Decision failed.'); } finally { setLoading(false); }
  };
  return <div className="admin-shell"><Header onSubmit={() => {}} /><main className="admin-page"><span className="section-kicker">ACTING DIRECTORY · EDITOR TOOLS</span><h1>Review queue</h1><p>Approve or reject submissions. Verify submitted details against official sources before publishing.</p><form className="admin-key-form" onSubmit={load}><label className="form-field"><span>Review key</span><input type="password" value={key} onChange={event => setKey(event.target.value)} autoComplete="current-password" required /></label><button className="button button-violet" type="submit" disabled={loading}>{loading ? 'Loading…' : 'Load pending'}</button></form>{message && <p className="admin-message" role="status">{message}</p>}<div className="admin-list">{submissions.map(submission => <article className="admin-submission" key={submission.id}><div className="card-overline"><span>{submission.submission_type.replace('_', ' ').toUpperCase()}</span><span>{new Date(`${submission.submitted_at.replace(' ', 'T')}Z`).toLocaleString()}</span></div><h2>{submission.payload.name || submission.payload.provider_name || 'Profile request'}</h2><p>{submission.payload.description || submission.payload.verification_information || 'No description provided.'}</p><p className="admin-contact">{submission.contact_name} · {submission.contact_email} · {submission.website_url}</p><details><summary>Full submission details</summary><pre>{JSON.stringify(submission.payload, null, 2)}</pre></details><div className="admin-actions"><button className="button button-violet" disabled={loading} onClick={() => decide(submission.id, 'approved')}>Approve</button><button className="button button-outline" disabled={loading} onClick={() => decide(submission.id, 'rejected')}>Reject</button></div></article>)}</div><a className="text-link" href="/">Return to directory ↗</a></main></div>;
}

export default function App() {
  const directory = useDirectory();
  if (window.location.pathname.replace(/\/$/, '') === '/admin/review') return <AdminReviewPage />;
  return <UnifiedDirectory directory={directory} />;
}

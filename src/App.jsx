import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BUDGETS, FORMATS, LOCATIONS, PRICE_BASES, TECHNIQUES, TRAINING_TYPES,
  filterListings, getCollectionType, mergeListings, priceLabel,
} from './directory-utils.js';

const PAGE_COPY = {
  '/directory': ['Acting training in New York', 'Explore studios, classes, workshops and coaches from one considered guide.'],
  '/studios': ['Studios & schools', 'Find a training home, compare approaches, and follow the classes that fit your practice.'],
  '/classes': ['Classes & workshops', 'Browse individual classes and intensives with published prices and practical details.'],
  '/coaches': ['Private acting coaches', 'Find one-to-one and small-group guidance for the work in front of you.'],
};

function setMeta(title, description, canonicalPath = window.location.pathname, noIndex = false) {
  document.title = `${title} | Acting Class Directory`;
  let meta = document.querySelector('meta[name="description"]');
  if (!meta) { meta = document.createElement('meta'); meta.name = 'description'; document.head.append(meta); }
  meta.content = description;
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.append(canonical); }
  canonical.href = new URL(canonicalPath, window.location.origin).href;
  const robots = document.querySelector('meta[name="robots"]');
  if (robots) robots.content = noIndex ? 'noindex, nofollow' : 'index, follow';
}

function useDirectory() {
  const [data, setData] = useState({ providers: [], offerings: [] });
  const [status, setStatus] = useState('loading');
  useEffect(() => {
    let active = true;
    fetch('/api/directory').then(async response => {
      if (!response.ok) throw new Error('The directory could not be loaded.');
      return response.json();
    }).then(result => {
      if (active) { setData(result); setStatus('ready'); }
    }).catch(() => { if (active) setStatus('error'); });
    return () => { active = false; };
  }, []);
  return { ...data, status };
}

function Brand({ onNavigate }) {
  return <a className="wordmark" href="/" onClick={onNavigate} aria-label="Acting Class Directory home">
    <span className="wordmark-mark" aria-hidden="true">AC</span>
    <span className="wordmark-text">ACTING CLASS<br />DIRECTORY</span>
  </a>;
}

function Header({ onSubmit }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return <header className="site-header">
    <Brand />
    <nav className={`main-nav ${menuOpen ? 'main-nav-open' : ''}`} aria-label="Main navigation">
      <a href="/directory">Explore</a><a href="/studios">Studios</a><a href="/classes">Classes</a><a href="/coaches">Coaches</a>
    </nav>
    <button className="button button-dark header-submit" onClick={onSubmit}>List a class <span aria-hidden="true">↗</span></button>
    <button className="menu-toggle" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? 'Close' : 'Menu'}</button>
  </header>;
}

function Footer({ onSubmit }) {
  return <footer className="site-footer">
    <div className="footer-top"><Brand /><p>A clearer way to find your next room, teacher, and way into the work.</p><button className="text-link" onClick={onSubmit}>Suggest a listing <span aria-hidden="true">↗</span></button></div>
    <div className="footer-bottom"><span>© 2026 Acting Class Directory</span><span>Independent. Actor-first. New York.</span><a href="/admin/review">Local editor</a></div>
  </footer>;
}

function Shell({ children, onSubmit }) {
  return <><div className="page-frame"><Header onSubmit={onSubmit} />{children}<Footer onSubmit={onSubmit} /></div></>;
}

function Eyebrow({ children }) { return <p className="eyebrow">{children}</p>; }

function Loading({ error = false }) {
  return <div className={`state-card ${error ? 'state-error' : ''}`} role={error ? 'alert' : 'status'}>{error ? 'The directory is temporarily unavailable. Check that the local Worker and D1 database are running.' : 'Gathering the listings…'}</div>;
}

function PlaceLabel({ locations = [] }) {
  if (!locations.length) return <span>New York City</span>;
  const names = [...new Set(locations.map(location => {
    const label = location.is_online ? 'Online' : location.neighborhood || location.borough || location.city;
    return label && !location.verified ? `${label} · unverified` : label;
  }).filter(Boolean))];
  return <span>{names.slice(0, 2).join(' · ') || 'New York City'}</span>;
}

function KindLabel({ item }) {
  if (item.kind === 'offering') return <span>{item.instruction_mode === 'private' ? 'PRIVATE COACHING' : 'CLASS / WORKSHOP'}</span>;
  return <span>{item.listing_type === 'coach' ? 'PRIVATE COACH' : item.listing_type === 'school' ? 'SCHOOL' : 'STUDIO'}</span>;
}

function ImagePanel({ item, size = 'card' }) {
  const initials = item.name.split(/\s+/).filter(word => !['the', 'of', 'and'].includes(word.toLowerCase())).slice(0, 2).map(word => word[0]).join('');
  return <div className={`image-panel image-panel-${size}`} aria-label={`${item.name} image placeholder`}>
    {item.featured_image_url ? <img src={item.featured_image_url} alt={item.name} loading="lazy" /> : <>
      <span className="image-index">NYC · TRAINING DIRECTORY</span>
      <span className="image-initials" aria-hidden="true">{initials || 'AC'}</span>
      <span className="image-caption">{item.locations?.[0]?.borough || 'NEW YORK'}</span>
    </>}
  </div>;
}

function displayPrice(item) {
  if (item.kind === 'provider') return priceLabel(item, { prefix: true });
  return priceLabel(item);
}

function ListingCard({ item, featured = false }) {
  const href = item.kind === 'offering' ? `/classes/${item.slug}` : `/providers/${item.slug}`;
  const termNames = (item.terms || []).filter(term => term.verification_status === 'verified').map(term => term.term).slice(0, 2);
  const location = <PlaceLabel locations={item.locations} />;
  return <article className={`listing-card ${featured ? 'listing-card-featured' : ''}`}>
    <a className="card-link" href={href} aria-label={`View ${item.name}`}>
      <ImagePanel item={item} />
      <div className="card-content">
        <div className="card-overline"><KindLabel item={item} /><span className="card-location">{location}</span></div>
        <h3>{item.name}</h3>
        {item.provider_name && <p className="provider-byline">with {item.provider_name}</p>}
        <p className="card-description">{item.description}</p>
        <div className="card-tags">{termNames.map(term => <span key={term}>{term}</span>)}</div>
        <div className="card-bottom"><span>{displayPrice(item)}</span><span className="card-arrow" aria-hidden="true">↗</span></div>
      </div>
    </a>
  </article>;
}

function SearchForm({ initialQuery = '', onSearch, compact = false }) {
  const [query, setQuery] = useState(initialQuery);
  return <form className={`hero-search ${compact ? 'hero-search-compact' : ''}`} onSubmit={event => { event.preventDefault(); onSearch(query); }}>
    <label className="sr-only" htmlFor={compact ? 'directory-query' : 'home-query'}>Search studios, classes, coaches or techniques</label>
    <span className="search-icon" aria-hidden="true">⌕</span>
    <input id={compact ? 'directory-query' : 'home-query'} value={query} onChange={event => setQuery(event.target.value)} placeholder="Studio, class, coach or technique" />
    <button className="button button-dark" type="submit">Search <span aria-hidden="true">↗</span></button>
  </form>;
}

function Homepage({ directory, onSubmit }) {
  const providers = directory.providers;
  const offerings = directory.offerings.filter(item => item.instruction_mode !== 'private');
  const coaches = providers.filter(item => item.listing_type === 'coach');
  useEffect(() => setMeta('Find acting training in New York', 'Explore NYC acting studios, classes, workshops and private coaches. Compare verified techniques, locations, formats and published prices.'), []);
  const goSearch = query => { const params = new URLSearchParams(); if (query.trim()) params.set('q', query.trim()); window.location.href = `/directory${params.size ? `?${params}` : ''}`; };
  return <Shell onSubmit={onSubmit}>
    <main>
      <section className="home-hero">
        <div className="hero-copy"><Eyebrow>NYC ACTING TRAINING · A FIELD GUIDE</Eyebrow><h1>Find the room<br />where you <em>grow.</em></h1>
          <p>A considered guide to acting studios, classes and coaches across New York. Find the training that fits your practice, your schedule and your budget.</p>
          <SearchForm onSearch={goSearch} />
          <div className="hero-footnote"><span>Independent listings</span><span>Published prices, clearly labeled</span><span>Direct links to providers</span></div>
        </div>
        <div className="hero-art" aria-hidden="true"><div className="hero-art-frame"><span className="frame-top">THE ACTOR’S NOTEBOOK</span><span className="hero-art-number">01</span><span className="frame-bottom">NEW YORK · EST. 2026</span></div><span className="art-caption">A directory for the work in progress.</span></div>
      </section>

      <section className="browse-strip"><div><Eyebrow>Start with your practice</Eyebrow><h2>What are you<br /><em>looking for?</em></h2></div>
        <div className="browse-links"><a href="/studios"><span>01</span><strong>Studios & schools</strong><span className="browse-arrow">↗</span></a><a href="/classes"><span>02</span><strong>Classes & workshops</strong><span className="browse-arrow">↗</span></a><a href="/coaches"><span>03</span><strong>Private coaches</strong><span className="browse-arrow">↗</span></a></div>
      </section>

      {directory.status === 'loading' ? <Loading /> : directory.status === 'error' ? <Loading error /> : <>
        <ListingSection title="A place to begin" eyebrow="STUDIOS & SCHOOLS" href="/studios" listings={providers.filter(item => item.listing_type !== 'coach').slice(0, 3)} />
        <ListingSection title="Make room for the work" eyebrow="CLASSES & WORKSHOPS" href="/classes" listings={offerings.slice(0, 3)} />
        <ListingSection title="One-to-one attention" eyebrow="PRIVATE COACHES" href="/coaches" listings={coaches.slice(0, 3)} />
      </>}

      <section className="how-section"><div className="how-title"><Eyebrow>OUR POINT OF VIEW</Eyebrow><h2>More clarity.<br /><em>Less digging.</em></h2></div><div className="how-copy"><p>Acting training can be hard to compare. We gather public details in one place, keep prices tied to their actual format, and link every listing back to its source.</p><div className="how-points"><div><span>01</span><strong>Start with what matters</strong><p>Location, listing type, training, technique, format and budget.</p></div><div><span>02</span><strong>See the full picture</strong><p>Schedules, levels and requirements stay on profiles even when they are not filters.</p></div><div><span>03</span><strong>Go straight to the source</strong><p>Confirm details and register directly with the provider.</p></div></div></div></section>
      <section className="provider-cta"><div><Eyebrow>FOR STUDIOS, TEACHERS & COACHES</Eyebrow><h2>Your work belongs<br />in the <em>conversation.</em></h2></div><div><p>Share a listing or claim a profile. Every change is reviewed before it appears in the directory.</p><button className="button button-paper" onClick={onSubmit}>Suggest a listing <span aria-hidden="true">↗</span></button></div></section>
    </main>
  </Shell>;
}

function ListingSection({ title, eyebrow, href, listings }) {
  if (!listings.length) return null;
  return <section className="listing-section"><div className="section-heading"><div><Eyebrow>{eyebrow}</Eyebrow><h2>{title}</h2></div><a className="text-link" href={href}>Explore all <span aria-hidden="true">↗</span></a></div><div className="listing-grid">{listings.map(item => <ListingCard key={`${item.kind}-${item.id}`} item={item} featured />)}</div></section>;
}

function readFilters() {
  const params = new URLSearchParams(window.location.search);
  const routeType = window.location.pathname === '/studios' ? 'studios' : window.location.pathname === '/classes' ? 'classes' : window.location.pathname === '/coaches' ? 'coaches' : 'all';
  return {
    type: params.get('type') || routeType, q: params.get('q') || '', location: params.get('location') || '',
    training: params.get('training') || '', technique: params.get('technique') || '', format: params.get('format') || '',
    budget: params.get('budget') || '', priceBasis: params.get('basis') || '', minPrice: params.get('min') || '', maxPrice: params.get('max') || '', sort: params.get('sort') || 'relevance',
  };
}

function DirectoryPage({ directory, onSubmit }) {
  const [filters, setFilters] = useState(readFilters);
  const [mobileFilters, setMobileFilters] = useState(false);
  const type = filters.type;
  const copy = PAGE_COPY[window.location.pathname] || PAGE_COPY['/directory'];
  const listings = useMemo(() => filterListings(mergeListings(directory), filters), [directory, filters]);
  useEffect(() => setMeta(copy[0], copy[1]), [copy[0], copy[1]]);
  const update = (key, value) => {
    const next = { ...filters, [key]: value };
    setFilters(next);
    const params = new URLSearchParams();
    const urlNames = { priceBasis: 'basis', minPrice: 'min', maxPrice: 'max' };
    for (const [name, entry] of Object.entries(next)) if (entry && !(['type', 'sort'].includes(name) && entry === (name === 'type' ? 'all' : 'relevance'))) params.set(urlNames[name] || name, entry);
    const path = type === 'studios' ? '/studios' : type === 'classes' ? '/classes' : type === 'coaches' ? '/coaches' : '/directory';
    window.history.replaceState(null, '', `${path}${params.size ? `?${params}` : ''}`);
  };
  const reset = () => { const next = { type, q: '', location: '', training: '', technique: '', format: '', budget: '', priceBasis: '', minPrice: '', maxPrice: '', sort: 'relevance' }; setFilters(next); window.history.replaceState(null, '', type === 'all' ? '/directory' : `/${type}`); };
  const activeCount = ['location', 'training', 'technique', 'format', 'budget', 'priceBasis', 'minPrice', 'maxPrice'].filter(key => filters[key]).length;
  const filterContent = <FilterControls filters={filters} onChange={update} onReset={reset} activeCount={activeCount} />;

  if (directory.status === 'loading') return <Shell onSubmit={onSubmit}><main className="directory-page"><Loading /></main></Shell>;
  if (directory.status === 'error') return <Shell onSubmit={onSubmit}><main className="directory-page"><Loading error /></main></Shell>;
  return <Shell onSubmit={onSubmit}><main className="directory-page">
    <section className="directory-intro"><Eyebrow>THE NYC TRAINING DIRECTORY</Eyebrow><h1>{copy[0]}</h1><p>{copy[1]}</p><SearchForm compact initialQuery={filters.q} onSearch={query => update('q', query)} /></section>
    <nav className="type-tabs" aria-label="Filter by listing type">{[['all','Everything','/directory'],['studios','Studios & schools','/studios'],['classes','Classes & workshops','/classes'],['coaches','Private coaches','/coaches']].map(([value,label,href]) => <a key={value} className={type === value ? 'active' : ''} href={`${href}${filters.q ? `?q=${encodeURIComponent(filters.q)}` : ''}`}>{label}</a>)}</nav>
    <div className="directory-layout"><aside className="filter-sidebar">{filterContent}</aside><section className="results-area" aria-live="polite">
      <div className="results-toolbar"><div><Eyebrow>THE LISTINGS</Eyebrow><p><strong>{listings.length}</strong> {listings.length === 1 ? 'result' : 'results'}{filters.q ? ` for “${filters.q}”` : ''}</p></div><div className="toolbar-controls"><button className="filter-open button button-outline" onClick={() => setMobileFilters(true)}>Filters{activeCount ? ` · ${activeCount}` : ''}</button><label className="sort-control">Sort <select value={filters.sort} onChange={event => update('sort', event.target.value)}><option value="relevance">Relevance</option><option value="price-low">Lowest price</option><option value="price-high">Highest price</option><option value="name">Alphabetical</option></select></label></div></div>
      {listings.length ? <div className="listing-grid results-grid">{listings.map(item => <ListingCard key={`${item.kind}-${item.id}`} item={item} />)}</div> : <div className="empty-state"><span className="empty-mark">AC</span><h2>No listings match those filters.</h2><p>Try widening your search, or clear the filters to see all New York training.</p><button className="button button-dark" onClick={reset}>Clear filters</button></div>}
    </section></div>
    {mobileFilters && <div className="filter-backdrop" role="presentation" onClick={event => { if (event.target === event.currentTarget) setMobileFilters(false); }}><section className="filter-drawer" role="dialog" aria-modal="true" aria-label="Directory filters"><div className="drawer-heading"><div><Eyebrow>REFINE THE LIST</Eyebrow><h2>Filters{activeCount ? ` · ${activeCount}` : ''}</h2></div><button className="icon-button" onClick={() => setMobileFilters(false)} aria-label="Close filters">×</button></div>{filterContent}<button className="button button-dark drawer-done" onClick={() => setMobileFilters(false)}>Show {listings.length} results</button></section></div>}
  </main></Shell>;
}

function FilterControls({ filters, onChange, onReset, activeCount }) {
  return <div className="filters-content"><div className="filter-heading"><div><Eyebrow>REFINE</Eyebrow><h2>Find your fit</h2></div>{activeCount > 0 && <button className="text-link" onClick={onReset}>Reset</button>}</div>
    <FilterSelect label="Location" value={filters.location} onChange={value => onChange('location', value)} options={LOCATIONS.map(value => [value, value])} />
    <FilterSelect label="Training type" value={filters.training} onChange={value => onChange('training', value)} options={TRAINING_TYPES} />
    <FilterSelect label="Technique" value={filters.technique} onChange={value => onChange('technique', value)} options={TECHNIQUES} />
    <FilterSelect label="Format" value={filters.format} onChange={value => onChange('format', value)} options={FORMATS} />
    <FilterSelect label="Published budget" value={filters.budget} onChange={value => onChange('budget', value)} options={BUDGETS.map(([slug,label]) => [slug,label])} />
    <FilterSelect label="Price basis" value={filters.priceBasis} onChange={value => onChange('priceBasis', value)} options={PRICE_BASES} />
    <div className="filter-price-range"><span>Custom price range</span><div><label><span className="sr-only">Minimum price in dollars</span><input aria-label="Minimum price in dollars" type="number" min="0" inputMode="numeric" placeholder="Min $" value={filters.minPrice} onChange={event => onChange('minPrice', event.target.value)} /></label><label><span className="sr-only">Maximum price in dollars</span><input aria-label="Maximum price in dollars" type="number" min="0" inputMode="numeric" placeholder="Max $" value={filters.maxPrice} onChange={event => onChange('maxPrice', event.target.value)} /></label></div></div>
    <p className="filter-note">Only published prices and verified details power filters. Unlisted prices? Contact the provider.</p>
  </div>;
}

function FilterSelect({ label, value, onChange, options }) {
  return <label className="filter-field"><span>{label}</span><select value={value} onChange={event => onChange(event.target.value)}><option value="">Any {label.toLowerCase()}</option>{options.map(([optionValue, text]) => <option key={optionValue} value={optionValue}>{text}</option>)}</select></label>;
}

function ProfilePage({ directory, onSubmit }) {
  const path = window.location.pathname;
  const providerSlug = path.match(/^\/providers\/([^/]+)/)?.[1];
  const offeringSlug = path.match(/^\/classes\/([^/]+)/)?.[1];
  const provider = directory.providers.find(item => item.slug === providerSlug);
  const offering = directory.offerings.find(item => item.slug === offeringSlug);
  const [modal, setModal] = useState(null);
  const item = provider || offering;
  useEffect(() => { if (item) setMeta(item.name, item.description || `Explore ${item.name} in the New York acting education directory.`); }, [item?.name, item?.description]);
  if (directory.status === 'loading') return <Shell onSubmit={onSubmit}><main className="profile-page"><Loading /></main></Shell>;
  if (directory.status === 'error') return <Shell onSubmit={onSubmit}><main className="profile-page"><Loading error /></main></Shell>;
  if (!provider && !offering) return <Shell onSubmit={onSubmit}><main className="profile-page"><div className="empty-state"><Eyebrow>NOT IN THE DIRECTORY</Eyebrow><h1>We couldn’t find that listing.</h1><p>Browse the directory to find acting training across New York.</p><a className="button button-dark" href="/directory">Explore listings</a></div></main></Shell>;

  if (provider) {
    const relatedOfferings = directory.offerings.filter(entry => entry.provider_id === provider.id);
    const relatedProviders = directory.providers.filter(entry => entry.id !== provider.id && (entry.terms || []).some(term => term.verification_status === 'verified' && provider.terms?.some(pTerm => pTerm.id === term.id))).slice(0, 3);
    return <Shell onSubmit={onSubmit}><main className="profile-page">
      <nav className="breadcrumb"><a href="/directory">Directory</a><span>/</span><span>{provider.name}</span></nav>
      <section className="profile-hero"><div className="profile-visual"><ImagePanel item={provider} size="profile" /><span className="source-note">Public details · see provider source</span></div><div className="profile-summary"><Eyebrow><KindLabel item={provider} /> · NEW YORK CITY</Eyebrow><h1>{provider.name}</h1><p className="profile-description">{provider.description}</p><div className="profile-actions">{provider.website_url && <a className="button button-dark" href={provider.website_url} target="_blank" rel="noopener noreferrer">Visit website <span aria-hidden="true">↗</span></a>}{provider.instagram_url && <a className="button button-outline" href={provider.instagram_url} target="_blank" rel="noopener noreferrer">Instagram ↗</a>}<button className="text-link" onClick={() => setModal({ type: 'claim', provider })}>Claim this profile</button></div><div className="profile-location"><span className="detail-icon">⌖</span><PlaceLabel locations={provider.locations} /></div></div></section>
      <div className="profile-columns"><div className="profile-main-column">
        <section className="profile-block"><Eyebrow>THE APPROACH</Eyebrow><h2>About the training</h2><p>{provider.description}</p>{provider.teaching_approach && <p>{provider.teaching_approach}</p>}</section>
        {relatedOfferings.length > 0 && <ListingSection title="Classes & coaching" eyebrow="AVAILABLE THROUGH THIS PROVIDER" href="/classes" listings={relatedOfferings} />}
        {provider.instructors?.length > 0 && <section className="profile-block"><Eyebrow>THE PEOPLE</Eyebrow><h2>Instructors</h2><div className="instructor-list">{provider.instructors.map(person => <div key={person.id}><span className="instructor-initial">{person.name.split(' ').map(part => part[0]).slice(0,2).join('')}</span><div><strong>{person.name}</strong><p>{person.description}</p></div></div>)}</div></section>}
        {relatedProviders.length > 0 && <ListingSection title="Related training" eyebrow="KEEP EXPLORING" href="/directory" listings={relatedProviders} />}
      </div><aside className="profile-facts"><Eyebrow>LISTING DETAILS</Eyebrow><Fact label="Location"><PlaceLabel locations={provider.locations} /></Fact><Fact label="Training">{provider.terms?.filter(term => term.taxonomy === 'training_type').map(term => <span className={`fact-tag ${term.verification_status !== 'verified' ? 'fact-unverified' : ''}`} key={term.id}>{term.term}</span>)}</Fact><Fact label="Techniques">{provider.terms?.filter(term => term.taxonomy === 'technique').map(term => <span className={`fact-tag ${term.verification_status !== 'verified' ? 'fact-unverified' : ''}`} key={term.id}>{term.term}</span>)}</Fact><Fact label="Pricing">{relatedOfferings.length ? 'See individual classes and coaching for published rates.' : 'Contact provider for pricing.'}</Fact><a className="source-link" href={provider.source_url || provider.website_url} target="_blank" rel="noopener noreferrer">View official source ↗</a><button className="text-link update-link" onClick={() => setModal({ type: 'profile_update', provider })}>Suggest a profile update</button></aside></div>
      {modal && <SubmissionModal initialType={modal.type} provider={provider} onClose={() => setModal(null)} />}
    </main></Shell>;
  }

  const parentProvider = directory.providers.find(entry => entry.id === offering.provider_id);
  const locationNames = (offering.locations || []).map(location => location.is_online ? 'Online' : location.label).filter(Boolean);
  const instructorText = (offering.instructors || []).map(person => person.name).join(', ');
  const termNames = (offering.terms || []).map(term => term.term);
  return <Shell onSubmit={onSubmit}><main className="profile-page">
    <nav className="breadcrumb"><a href="/directory?type=classes">Classes & workshops</a><span>/</span><span>{offering.name}</span></nav>
    <section className="profile-hero"><div className="profile-visual"><ImagePanel item={offering} size="profile" /><span className="source-note">Public details · see provider source</span></div><div className="profile-summary"><Eyebrow>CLASS / WORKSHOP · NEW YORK CITY</Eyebrow><h1>{offering.name}</h1><p className="profile-description">{offering.description}</p><div className="profile-actions">{offering.registration_url && <a className="button button-dark" href={offering.registration_url} target="_blank" rel="noopener noreferrer">Register with provider <span aria-hidden="true">↗</span></a>}{parentProvider && <a className="button button-outline" href={`/providers/${parentProvider.slug}`}>About the provider</a>}</div><div className="profile-location"><span className="detail-icon">⌖</span><span>{locationNames.join(' · ') || 'New York City'}</span></div></div></section>
    <div className="profile-columns"><div className="profile-main-column"><section className="profile-block"><Eyebrow>CLASS DETAILS</Eyebrow><h2>Make space for the work.</h2><p>{offering.description}</p>{offering.schedule_text && <p><strong>Schedule:</strong> {offering.schedule_text}</p>}{instructorText && <p><strong>Instructor:</strong> {instructorText}</p>}{offering.skill_level && <p><strong>Experience:</strong> {offering.skill_level}</p>}</section>{parentProvider && <section className="provider-inline"><Eyebrow>OFFERED BY</Eyebrow><h2>{parentProvider.name}</h2><p>{parentProvider.description}</p><a className="text-link" href={`/providers/${parentProvider.slug}`}>View provider profile ↗</a></section>}</div><aside className="profile-facts"><Eyebrow>AT A GLANCE</Eyebrow><Fact label="Price">{offering.price_min != null ? priceLabel(offering) : 'Contact provider for pricing.'}</Fact><Fact label="Format">{offering.format ? <span className={!offering.formatVerified ? 'fact-unverified' : ''}>{({ in_person: 'In person', online: 'Online', hybrid: 'Hybrid' })[offering.format]}{offering.formatVerified ? '' : ' · unverified'}</span> : 'Ask provider'}</Fact><Fact label="Duration">{offering.duration_minutes ? `${offering.duration_minutes} minutes` : offering.session_count ? `${offering.session_count} sessions` : 'See provider details'}</Fact><Fact label="Training">{(offering.terms || []).filter(term => term.taxonomy === 'training_type').map(term => <span className={`fact-tag ${term.verification_status !== 'verified' ? 'fact-unverified' : ''}`} key={term.id}>{term.term}</span>)}</Fact><Fact label="Technique">{(offering.terms || []).filter(term => term.taxonomy === 'technique').map(term => <span className={`fact-tag ${term.verification_status !== 'verified' ? 'fact-unverified' : ''}`} key={term.id}>{term.term}</span>)}</Fact>{offering.audition_required != null && <Fact label="Audition">{offering.audition_required ? 'Required' : 'Not required'}</Fact>}{offering.interview_required != null && <Fact label="Interview">{offering.interview_required ? 'Required' : 'Not required'}</Fact>}<a className="source-link" href={offering.source_url || offering.registration_url} target="_blank" rel="noopener noreferrer">View official source ↗</a></aside></div>
  </main></Shell>;
}

function Fact({ label, children }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return <div className="fact-row"><span>{label}</span><div>{hasChildren ? children : <span className="fact-muted">Not provided</span>}</div></div>;
}

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
    event.preventDefault();
    setSending(true); setMessage('');
    const formNode = event.currentTarget;
    const form = new FormData(formNode);
    const type = selectedType;
    const payload = Object.fromEntries(form.entries());
    payload.type = type === 'coach' ? 'provider' : type;
    payload.provider_id = provider?.id || payload.provider_id || '';
    payload.training_types = form.getAll('training_types');
    payload.techniques = form.getAll('techniques');
    try {
      const response = await fetch('/api/submissions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'The submission could not be saved.');
      setMessage('Thank you. Your submission is saved for editorial review. It will remain private until approved.');
      formNode.reset();
    } catch (error) { setMessage(error.message || 'The submission could not be saved.'); }
    finally { setSending(false); }
  };
  return <dialog className="submission-dialog" ref={dialog} onClose={onClose}>
    <div className="dialog-heading"><div><Eyebrow>CONTRIBUTE TO THE DIRECTORY</Eyebrow><h2>{selectedType === 'claim' ? 'Claim this profile' : selectedType === 'profile_update' ? 'Suggest a profile update' : 'Share a listing'}</h2></div><button className="icon-button" aria-label="Close dialog" onClick={() => dialog.current?.close()}>×</button></div>
    {message ? <div className="submission-success"><span className="success-mark">✓</span><p>{message}</p><button className="button button-dark" onClick={() => dialog.current?.close()}>Done</button></div> : <form className="submission-form" onSubmit={onSubmitForm}>
      {initialType === 'provider' && <label className="form-field"><span>Listing type</span><select value={selectedType} onChange={event => setSelectedType(event.target.value)}><option value="provider">Studio or school</option><option value="coach">Private coach</option><option value="offering">Class or workshop</option></select></label>}
      {(selectedType === 'provider' || selectedType === 'coach' || selectedType === 'offering') && <>
        <label className="form-field"><span>{selectedType === 'offering' ? 'Class or workshop name' : selectedType === 'coach' ? 'Coach name' : 'Studio or school name'} *</span><input name="name" required maxLength="160" /></label>
        {selectedType === 'coach' && <input type="hidden" name="listing_type" value="coach" />}
        {selectedType === 'provider' && <label className="form-field"><span>Organization type</span><select name="listing_type"><option value="studio">Acting studio</option><option value="school">School or conservatory</option></select></label>}
        <label className="form-field"><span>Description *</span><textarea name="description" required rows="3" maxLength="3000" placeholder="What kind of acting training is offered?" /></label>
        {selectedType === 'provider' && <label className="form-field"><span>Teaching approach (optional)</span><textarea name="teaching_approach" rows="2" /></label>}
        <div className="form-grid"><label className="form-field"><span>Official website{selectedType === 'provider' ? ' *' : ''}</span><input name="website_url" type="url" placeholder="https://" required={selectedType === 'provider'} /></label>{selectedType === 'offering' && <label className="form-field"><span>Registration link (optional)</span><input name="registration_url" type="url" placeholder="https://" /></label>}</div>
        {(selectedType === 'provider' || selectedType === 'coach') && <label className="form-field"><span>Location (optional)</span><select name="borough"><option value="">New York City / not specified</option>{LOCATIONS.filter(item => item !== 'Online').map(location => <option key={location} value={location}>{location}</option>)}</select></label>}
        <TermChoices label="Training type (optional)" name="training_types" terms={TRAINING_TYPES} />
        <TermChoices label="Technique (optional)" name="techniques" terms={TECHNIQUES} />
        {selectedType === 'offering' && <><label className="form-field"><span>Provider (optional)</span><select name="provider_id"><option value="">Independent / not listed</option>{providers.filter(item => item.listing_type !== 'coach').map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><div className="form-grid"><label className="form-field"><span>Price (optional)</span><input name="price_min" type="number" min="0" step="1" placeholder="Not listed" /></label><label className="form-field"><span>Price basis</span><select name="price_basis"><option value="">Not specified</option><option value="per_session">Per session</option><option value="hourly">Hourly</option><option value="full_course">Full course</option><option value="workshop">Workshop</option><option value="other">Other</option></select></label></div><div className="form-grid"><label className="form-field"><span>Format</span><select name="format"><option value="">Not specified</option><option value="in_person">In person</option><option value="online">Online</option><option value="hybrid">Hybrid</option></select></label><label className="form-field"><span>Instruction</span><select name="instruction_mode"><option value="group">Group</option><option value="private">Private</option><option value="both">Both</option></select></label></div><label className="form-field"><span>Schedule or duration (optional)</span><input name="schedule_text" maxLength="300" placeholder="For example, 8 weeks · Tuesday evenings" /></label></>}
        <div className="form-grid"><label className="form-field"><span>Contact name *</span><input name="contact_name" required maxLength="160" /></label><label className="form-field"><span>Contact email *</span><input name="contact_email" type="email" required maxLength="254" /></label></div>
      </>}
      {selectedType === 'claim' && <><p className="form-intro">A claim request does not grant editing access. We review each request and verify the connection before changing a profile.</p><label className="form-field"><span>Contact person *</span><input name="contact_name" required maxLength="160" /></label><label className="form-field"><span>Business email *</span><input name="contact_email" type="email" required maxLength="254" /></label><label className="form-field"><span>Website</span><input name="website_url" type="url" placeholder="https://" /></label><label className="form-field"><span>Instagram</span><input name="instagram_url" placeholder="https://instagram.com/" /></label><label className="form-field"><span>How can we verify your connection? *</span><textarea name="verification_information" required rows="3" maxLength="2000" placeholder="Describe your role or provide a relevant verification detail." /></label></>}
      {selectedType === 'profile_update' && <><p className="form-intro">Approved information stays visible while we review your suggested changes.</p><label className="form-field"><span>Contact name *</span><input name="contact_name" required maxLength="160" /></label><label className="form-field"><span>Contact email *</span><input name="contact_email" type="email" required maxLength="254" /></label><label className="form-field"><span>What should be updated? *</span><textarea name="description" required rows="4" maxLength="3000" placeholder="Describe the correction or new information." /></label><label className="form-field"><span>Supporting website (optional)</span><input name="website_url" type="url" placeholder="https://" /></label></>}
      <p className="form-note">Your submission is saved as pending. No email or external account is required in this local version.</p>
      <button className="button button-dark form-submit" type="submit" disabled={sending}>{sending ? 'Saving…' : 'Send for review'} <span aria-hidden="true">↗</span></button>
    </form>}
  </dialog>;
}

function AdminReviewPage() {
  const [key, setKey] = useState('');
  const [submissions, setSubmissions] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => setMeta('Local review queue', 'Review pending provider listings, profile claims and updates in the local directory.', window.location.pathname, true), []);
  const load = async event => {
    event?.preventDefault(); setLoading(true); setMessage('');
    try {
      const response = await fetch('/api/admin/submissions', { headers: { Authorization: `Bearer ${key}` } });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Could not load review queue.');
      setSubmissions(result); setMessage(result.length ? '' : 'There are no pending submissions.');
    } catch (error) { setMessage(error.message || 'Could not load review queue.'); }
    finally { setLoading(false); }
  };
  const decide = async (id, action) => {
    setLoading(true); setMessage('');
    try {
      const response = await fetch('/api/admin/decision', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify({ id, action }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Decision failed.');
      setSubmissions(items => items.filter(item => item.id !== id)); setMessage(`Submission ${action}.`);
    } catch (error) { setMessage(error.message || 'Decision failed.'); }
    finally { setLoading(false); }
  };
  return <div className="page-frame"><Header onSubmit={() => {}} /><main className="admin-page"><Eyebrow>LOCAL EDITOR TOOLS</Eyebrow><h1>Review queue</h1><p>Approve or reject submissions. Approved new listings are published locally; submitted attributes remain unverified until checked against a source.</p><form className="admin-key-form" onSubmit={load}><label className="form-field"><span>Local review key</span><input type="password" value={key} onChange={event => setKey(event.target.value)} autoComplete="current-password" required /></label><button className="button button-dark" type="submit" disabled={loading}>{loading ? 'Loading…' : 'Load pending'}</button></form>{message && <p className="admin-message" role="status">{message}</p>}<div className="admin-list">{submissions.map(submission => <article className="admin-submission" key={submission.id}><div className="card-overline"><span>{submission.submission_type.replace('_', ' ').toUpperCase()}</span><span>{new Date(`${submission.submitted_at.replace(' ', 'T')}Z`).toLocaleString()}</span></div><h2>{submission.payload.name || submission.payload.provider_name || 'Profile request'}</h2><p>{submission.payload.description || submission.payload.verification_information || 'No description provided.'}</p><p className="admin-contact">{submission.contact_name} · {submission.contact_email} · {submission.website_url}</p><details><summary>Full submission details</summary><pre>{JSON.stringify(submission.payload, null, 2)}</pre></details><div className="admin-actions"><button className="button button-dark" disabled={loading} onClick={() => decide(submission.id, 'approved')}>Approve</button><button className="button button-outline" disabled={loading} onClick={() => decide(submission.id, 'rejected')}>Reject</button></div></article>)}</div><a className="text-link" href="/directory">Return to the directory ↗</a></main><Footer onSubmit={() => {}} /></div>;
}

export default function App() {
  const directory = useDirectory();
  const [submission, setSubmission] = useState(false);
  const pathname = window.location.pathname.replace(/\/$/, '') || '/';
  const isProfile = pathname.startsWith('/providers/') || (pathname.startsWith('/classes/') && pathname !== '/classes');
  let page;
  if (pathname === '/admin/review') page = <AdminReviewPage />;
  else if (isProfile) page = <ProfilePage directory={directory} onSubmit={() => setSubmission(true)} />;
  else if (PAGE_COPY[pathname] || pathname === '/directory') page = <DirectoryPage directory={directory} onSubmit={() => setSubmission(true)} />;
  else page = <Homepage directory={directory} onSubmit={() => setSubmission(true)} />;
  return <>{page}{submission && <SubmissionModal providers={directory.providers} onClose={() => setSubmission(false)} />}</>;
}

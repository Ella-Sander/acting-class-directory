import { verifiedAffiliations, teacherClassification, teacherAvailability, providerClassification, officialWebsite, verifiedBookingUrl } from './teacher-facts.js';
import { cheapestVerifiedOffering, mergeListings, filterListings, matchesCategory, verifiedFormats, priceLabel } from './directory-utils.js';
import { BRAND, HOME_H1, HOME_SUBTITLE, DIRECTORY_SCOPE, DISCOVERY_DISCLAIMER, homeMetadata, siteContext } from './brand.js';

export const PAGE_SIZE = 20;
export const CONTENT_UPDATED = '2026-11-14';
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const e = escapeHtml;
export const safeJson = value => JSON.stringify(value).replace(/</g, '\\u003c');
const slug = text => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const verifiedTerms = item => (item.terms || []).filter(term => term.verification_status === 'verified');
export const listingPath = item => `/${item.kind === 'teacher' ? 'teachers' : item.kind === 'offering' ? 'classes' : 'providers'}/${item.slug}/`;
const absolute = (path, origin) => new URL(path, origin).href;
const publicUrl = value => { try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; } catch { return null; } };
const excerpt = (value, max = 155) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length <= max ? text : `${text.slice(0, max - 1).replace(/\s+\S*$/, '')}…`;
};
const modified = items => [...items.flatMap(item => [item.updated_at, item.last_verified]), CONTENT_UPDATED].filter(Boolean).map(date => String(date).slice(0, 10)).filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort().at(-1);

// City-scoped paths keep future cities separate. Each candidate must have real,
// verified matches and a distinct result set before it becomes indexable.
export function buildCatalog(directory) {
  const listings = filterListings(mergeListings(directory), { sort: 'name' });
  const profiles = [...(directory.teachers || []).map(x => ({ ...x, kind: 'teacher' })), ...(directory.offerings || []).map(x => ({ ...x, kind: 'offering' })), ...(directory.providers || []).map(x => ({ ...x, kind: 'provider' }))];
  const pages = [];
  const omitted = [];
  const signatures = new Set();
  function add(path, title, intro, items, group = 'pages') {
    const signature = items.map(item => `${item.kind}:${item.id}`).sort().join('|');
    if (items.length < 3 || signatures.has(signature)) { omitted.push({ path, reason: items.length < 3 ? 'Fewer than three verified matching listings' : 'Same results as an existing landing page', count: items.length }); return; }
    signatures.add(signature);
    pages.push({ path, title, intro, items, group, lastmod: modified(items) });
  }
  const singing = listings.filter(item => matchesCategory(item, 'singing'));
  add('/new-york/voice-studios/', 'Voice schools, studios and coaching providers in NYC', 'Explore the published organizations and coaching providers behind NYC voice training. Review their associated programs and official websites for enrollment information; individual faculty affiliations do not imply private studio availability.', profiles.filter(item => item.kind === 'provider'));
  add('/new-york/vocal-coaches/', 'Independent vocal teachers in New York City', 'Explore independently operated voice-teaching providers with verified websites and specialties. Confirm lesson format, pricing and current availability with each provider.', listings.filter(item => item.provider_classification === 'independent_teacher' && matchesCategory(item, 'singing')));
  add('/new-york/singing-lessons/', 'Singing lessons and classes in NYC', 'Explore providers with verified singing courses and group programs. Review associated course details and check the official registration page for dates, prerequisites and current availability.', singing);
  add('/online/vocal-coaches/', 'Online vocal instruction', 'Find providers with a verified online or hybrid delivery format. Confirm time zones and current enrollment options with the provider.', listings.filter(item => verifiedFormats(item).some(format => ['online', 'hybrid'].includes(format))));
  add('/new-york/voice-and-speech/', 'Voice and speech training in NYC', 'Explore providers with documented spoken voice and speech training for performers. These offerings concern speaking and acting voice; use the singing directory for musical voice lessons.', listings.filter(item => matchesCategory(item, 'voice-speech')));
  add('/new-york/accent-dialect-coaches/', 'Accent and dialect coaching in NYC', 'Find providers with documented dialect coaching work. Review their associated instructors and offerings, and ask about your target accent, project and session format.', listings.filter(item => matchesCategory(item, 'dialects')));
  const locations = new Map();
  for (const item of singing) for (const location of item.locations || []) if (location.verified && !location.is_online && location.city === 'New York') {
    for (const name of [location.borough, location.neighborhood].filter(Boolean)) {
      if (!locations.has(name)) locations.set(name, new Map());
      locations.get(name).set(`${item.kind}:${item.id}`, item);
    }
  }
  for (const [name, values] of [...locations].sort(([a], [b]) => a.localeCompare(b))) add(`/new-york/locations/${slug(name)}/`, `Voice providers in ${name}`, `Explore providers with verified ${name} locations and associated voice instruction. A listed school address identifies the organization or teaching venue; confirm arrangements directly.`, [...values.values()], 'locations');
  const terms = new Map();
  for (const item of singing) for (const term of verifiedTerms(item)) if (['genre', 'technique', 'training_type'].includes(term.taxonomy)) {
    if (!terms.has(term.slug)) terms.set(term.slug, { term, items: [] });
    terms.get(term.slug).items.push(item);
  }
  for (const [key, { term, items }] of [...terms].sort(([a], [b]) => a.localeCompare(b))) add(`/new-york/specialties/${key}/`, `${term.term} in NYC`, `Compare NYC teachers and programs with verified ${term.term.toLowerCase()} information. Review each profile's documented approach and course details; confirm the fit for your repertoire, experience and goals before enrolling.`, [...new Map(items.map(item => [`${item.kind}:${item.id}`, item])).values()], 'specialties');
  return { listings, profiles, pages, omitted };
}

export function sitemapGroups(catalog) {
  const groups = { coaches: [], studios: [], classes: [], locations: [], specialties: [], pages: [{ path: '/', lastmod: modified(catalog.listings) }] };
  for (let page = 2; page <= Math.ceil(catalog.listings.length / PAGE_SIZE); page++) groups.pages.push({ path: `/?page=${page}`, lastmod: modified(catalog.listings) });
  for (const item of catalog.profiles) {
    if (item.kind === 'teacher' && !verifiedAffiliations(item).length) continue;
    if (item.kind === 'offering' && !item.provider_slug) continue;
    groups[item.kind === 'teacher' ? 'coaches' : item.kind === 'offering' ? 'classes' : 'studios'].push({ path: listingPath(item), lastmod: modified([item]) });
  }
  for (const page of catalog.pages) for (let number = 1; number <= Math.ceil(page.items.length / PAGE_SIZE); number++) groups[page.group].push({ path: page.path + (number > 1 ? `?page=${number}` : ''), lastmod: page.lastmod });
  return Object.fromEntries(Object.entries(groups).filter(([, values]) => values.length));
}

export function exploreLinks(catalog) {
  return `<nav class="seo-explore" aria-label="Explore voice training"><h2>Explore NYC voice training</h2><div>${catalog.pages.map(page => `<a href="${e(page.path)}">${e(page.title)} <span>(${page.items.length})</span></a>`).join('')}</div></nav>`;
}
function cards(items) {
  return `<div class="seo-listings">${items.map(item => {
    const formats = verifiedFormats(item).map(value => ({ in_person: 'In person', online: 'Online', hybrid: 'Hybrid' })[value] || value);
    const classLabel = item.kind === 'provider' ? providerClassification(item).value ? providerClassification(item).label : '' : item.kind === 'teacher' && teacherClassification(item).value ? teacherClassification(item).label : '';
    const priceAvailable = item.kind === 'offering' ? item.priceVerified && item.price_min != null : Boolean(cheapestVerifiedOffering(item));
    const tags = verifiedTerms(item).slice(0, 3).map(term => term.term).join(' · ');
    return `<article>${item.logo?.status === 'verified' && item.logo.url ? `<img src="${e(item.logo.url)}" alt="${e(item.logo.name || 'Organization logo')}" width="64" height="64" loading="lazy" decoding="async">` : ''}<h2><a href="${e(listingPath(item))}">${e(item.name)}</a></h2>${item.description ? `<p>${e(excerpt(item.description, 240))}</p>` : ''}${classLabel ? `<p>${e(classLabel)}</p>` : ''}${formats.length ? `<p>${e(formats.join(' · '))}</p>` : ''}${priceAvailable ? `<p>${e(priceLabel(item))}</p>` : ''}${item.kind === 'teacher' && verifiedAffiliations(item).length ? `<p>${e(verifiedAffiliations(item).map(provider => provider.name).join(' | '))}</p>` : ''}${item.kind === 'teacher' && teacherAvailability(item).value ? `<p>${e(teacherAvailability(item).label)}</p>` : ''}${officialWebsite(item).url ? `<p><a href="${e(officialWebsite(item).url)}" target="_blank" rel="noopener noreferrer">${e(officialWebsite(item).label)}</a></p>` : ''}${tags ? `<p>${e(tags)}</p>` : ''}</article>`;
  }).join('')}</div>`;
}
function pagination(path, number, count) {
  const link = n => `${path}${n > 1 ? `?page=${n}` : ''}`;
  return count > 1 ? `<nav class="seo-pagination" aria-label="Directory pages">${number > 1 ? `<a rel="prev" href="${e(link(number - 1))}">Previous</a>` : ''}<span>Page ${number} of ${count}</span>${number < count ? `<a rel="next" href="${e(link(number + 1))}">Next</a>` : ''}</nav>` : '';
}
function profileBody(item, catalog) {
  const locations = (item.locations || []).filter(location => location.verified);
  const source = officialWebsite(item).url;
  const terms = verifiedTerms(item);
  const formats = verifiedFormats(item).map(value => ({ in_person: 'In person', online: 'Online', hybrid: 'Hybrid' })[value] || value);
  const priceAvailable = item.kind === 'offering' ? item.priceVerified && item.price_min != null : Boolean(cheapestVerifiedOffering(item));
  const relatedPages = catalog.pages.filter(page => page.items.some(match => match.kind === item.kind && match.id === item.id));
  const related = catalog.listings.filter(other => listingPath(other) !== listingPath(item) && verifiedTerms(other).some(term => terms.some(own => own.slug === term.slug))).slice(0, 4);
  const providerType = item.kind === 'provider' && providerClassification(item).value ? `<dl class="teacher-facts"><dt>Provider type</dt><dd>${e(providerClassification(item).label)}</dd></dl>` : '';
  const teacherType = item.kind === 'teacher' ? `${teacherClassification(item).value ? `<dl class="teacher-facts"><dt>Teacher type</dt><dd>${e(teacherClassification(item).label)}</dd></dl>` : ''}${verifiedAffiliations(item).length ? `<p>Institutions: ${e(verifiedAffiliations(item).map(provider => provider.name).join(' | '))}</p>` : ''}${teacherAvailability(item).value ? `<p>${e(teacherAvailability(item).label)}</p>` : ''}` : '';
  const offeringDetails = (item.offerings || []).length ? `<h2 id="offerings">Documented offerings</h2><ul>${item.offerings.map(offering => `<li><strong>${e(offering.name)}</strong>${offering.description ? ` — ${e(offering.description)}` : ''}${offering.priceVerified && offering.price_min != null ? ` · ${e(priceLabel({ ...offering, kind: 'offering' }))}` : ''}${offering.instructionModeVerified && offering.instruction_mode ? ` · ${e(offering.instruction_mode)}` : ''}${offering.workshopVerified ? ' · Workshop' : ''}${offering.formatVerified && offering.format ? ` · ${e(offering.format)}` : ''}</li>`).join('')}</ul>` : '';
  const detailLines = [formats.length ? `<p>Lesson format: ${e(formats.join(' · '))}</p>` : '', priceAvailable ? `<p>Pricing: ${e(priceLabel(item))}</p>` : ''].join('');
  return `<p>${e(DISCOVERY_DISCLAIMER)}</p>${item.description ? `<p>${e(item.description)}</p>` : ''}${item.teaching_approach ? `<h2>Teaching approach</h2><p>${e(item.teaching_approach)}</p>` : ''}${item.biography ? `<h2>Background</h2><p>${e(item.biography)}</p>` : ''}${item.teaching_experience ? `<h2>Teaching experience</h2><p>${e(item.teaching_experience)}</p>` : ''}${terms.length ? `<h2>Documented specialties</h2><p>${e(terms.map(term => term.term).join(' · '))}</p>` : ''}${locations.length ? `<h2>Locations</h2><ul>${locations.map(location => `<li>${e(location.is_online ? 'Online' : [location.postal_address || location.label, location.neighborhood, location.borough].filter(Boolean).join(', '))}</li>`).join('')}</ul>` : ''}${providerType}${teacherType}${item.kind === 'offering' && item.provider_slug ? `<p>Offered by <a href="/providers/${e(item.provider_slug)}/">${e(item.provider_name)}</a></p>` : ''}${detailLines}${offeringDetails}${source ? `<p><a class="button button-primary" href="${e(source)}" target="_blank" rel="noopener noreferrer">${e(officialWebsite(item).label)}</a></p>` : ''}${verifiedBookingUrl(item) ? `<p><a href="${e(verifiedBookingUrl(item))}" target="_blank" rel="noopener noreferrer">Book a lesson</a></p>` : ''}${item.kind === 'provider' && (item.instructors || []).length ? `<h2>Associated faculty and teachers</h2><ul>${item.instructors.map(instructor => `<li><a href="/teachers/${e(instructor.slug)}/">${e(instructor.name)}</a>${instructor.professional_title ? ` · ${e(instructor.professional_title)}` : ''}</li>`).join('')}</ul>` : ''}${['teacher', 'provider'].includes(item.kind) ? `<p><a href="#claim-remove">Claim or Remove Listing</a></p>` : ''}${relatedPages.length ? `<h2>Explore related training</h2><ul>${relatedPages.slice(0, 6).map(page => `<li><a href="${e(page.path)}">${e(page.title)}</a></li>`).join('')}</ul>` : ''}${related.length ? `<h2>Related listings</h2>${cards(related)}` : ''}`;
}

export function entitySchema(item, origin) {
  const url = absolute(listingPath(item), origin);
  const entity = { '@type': item.kind === 'teacher' || providerClassification(item).value === 'independent_teacher' ? 'Person' : item.kind === 'offering' ? 'Course' : 'EducationalOrganization', '@id': `${url}#entity`, name: item.name, description: item.description, url };
  const source = publicUrl(item.website_url || item.source_url);
  if (source) entity.sameAs = [source];
  if (item.kind === 'offering' && item.provider_name) entity.provider = { '@type': 'Organization', name: item.provider_name };
  if (item.kind === 'offering' && item.priceVerified && item.price_min != null && item.currency) entity.offers = { '@type': 'Offer', url: publicUrl(item.registration_url || item.enrollment_url) || url, priceCurrency: item.currency, price: item.price_min, description: `Published price basis: ${item.price_basis || 'contact provider'}` };
  if (entity['@type'] === 'Person') entity.knowsAbout = verifiedTerms(item).map(term => term.term);
  const address = (item.locations || []).find(location => location.verified && !location.is_online && location.postal_address);
  if (item.kind === 'provider' && item.listing_type !== 'coach' && address) {
    entity['@type'] = ['EducationalOrganization', 'LocalBusiness'];
    entity.address = { '@type': 'PostalAddress', streetAddress: address.postal_address, addressLocality: address.city, addressRegion: address.region };
  }
  return entity;
}

export function resolvePage(url, catalog, origin) {
  const profile = catalog.profiles.find(item => listingPath(item) === url.pathname);
  const landing = catalog.pages.find(page => page.path === url.pathname);
  const home = url.pathname === '/';
  const savedView = home && url.searchParams.get('saved') === '1';
  const admin = url.pathname === '/admin/review' || url.pathname === '/admin/review/';
  const rawPage = url.searchParams.get('page') || '1';
  const number = Number(rawPage);
  const filtered = [...url.searchParams.keys()].some(key => key !== 'page');
  let items = home ? catalog.listings : landing?.items || [];
  if (home && filtered) items = filterListings(catalog.listings, Object.fromEntries([...url.searchParams].map(([key, value]) => [({ teacherType: 'teacherType', lesson: 'lessonFormat', min: 'minPrice', max: 'maxPrice', basis: 'priceBasis' })[key] || key, value])));
  const count = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const missing = (!home && !profile && !landing && !admin) || url.searchParams.has('listing') || !/^[1-9]\d*$/.test(rawPage) || (savedView ? number > 1000 : number > count) || (profile && number !== 1);
  const titleBase = missing ? 'Page not found' : admin ? 'Directory administration' : profile ? profile.name : savedView ? 'Saved listings' : home ? HOME_H1 : landing.title;
  const title = home && !missing && !savedView ? homeMetadata(number).title : `${titleBase}${number > 1 && !missing ? ` — Page ${number}` : ''} | ${BRAND}`;
  const description = missing ? 'This page is unavailable. Explore the NYC voice training directory.' : admin ? 'Private directory administration.' : profile ? excerpt(`${profile.name}: ${profile.description || 'Explore documented teaching information, locations and official enrollment sources.'}`) : savedView ? 'Your saved voice training listings are stored privately in this browser.' : home ? homeMetadata(number).description : `${excerpt(landing.intro, 125)}${number > 1 ? ` Page ${number}.` : ''}`;
  const canonicalPath = missing || admin ? url.pathname : profile ? listingPath(profile) : `${url.pathname}${!filtered && number > 1 ? `?page=${number}` : ''}`;
  const canonical = absolute(canonicalPath, origin);
  const visible = items.slice((number - 1) * PAGE_SIZE, number * PAGE_SIZE);
  const crumbs = [{ name: 'Home', path: '/' }, ...(!home ? [{ name: titleBase, path: url.pathname }] : [])];
  const breadcrumb = `<nav class="seo-breadcrumb" aria-label="Breadcrumb">${crumbs.map((crumb, index) => index < crumbs.length - 1 ? `<a href="${e(crumb.path)}">${e(crumb.name)}</a> / ` : `<span>${e(crumb.name)}</span>`).join('')}</nav>`;
  const body = `<div class="seo-document">${breadcrumb}<h1>${e(titleBase)}</h1>${missing ? '<p>This listing or page is no longer available.</p><a href="/">Explore the directory</a>' : admin ? '<p>Sign in to review submissions.</p>' : profile ? profileBody(profile, catalog) : savedView ? '<p>Your saved listings are stored in this browser. Enable JavaScript to view them, or <a href="/#directory">explore the directory</a>.</p>' : `<p>${e(home ? HOME_SUBTITLE + ' ' + DIRECTORY_SCOPE : landing.intro)}</p><p>${e(DISCOVERY_DISCLAIMER)}</p><p>${items.length} published matching listings${number > 1 ? ` · Page ${number}` : ''}</p><p><a href="/#directory">Refine your search in the interactive directory</a></p>${cards(visible)}${pagination(url.pathname, number, count)}`}${!missing && !admin ? exploreLinks(catalog) : ''}</div>`;
  const graph = [{ '@type': 'Organization', '@id': `${origin}/#organization`, name: 'Vocal Catalog', url: `${origin}/`, logo: `${origin}/favicon.svg` }, { '@type': 'WebSite', '@id': `${origin}/#website`, name: 'Vocal Catalog', url: `${origin}/`, publisher: { '@id': `${origin}/#organization` } }, { '@type': 'WebPage', '@id': canonical, name: title, description, url: canonical, isPartOf: { '@id': `${origin}/#website` } }, { '@type': 'BreadcrumbList', itemListElement: crumbs.map((crumb, index) => ({ '@type': 'ListItem', position: index + 1, name: crumb.name, item: absolute(crumb.path, origin) })) }];
  if (profile) {
    const entity = entitySchema(profile, origin);
    graph.push(entity);
    graph[2].mainEntity = { '@id': entity['@id'] };
    if (profile.kind === 'offering' && profile.provider_name) graph.push({ '@type': 'Service', '@id': `${canonical}#service`, name: profile.name, description: profile.description, url: canonical, serviceType: verifiedTerms(profile).map(term => term.term), provider: { '@type': 'Organization', name: profile.provider_name } });
  }
  else if (!missing && !admin && !savedView) graph.push({ '@type': 'ItemList', numberOfItems: items.length, itemListElement: visible.map((item, index) => ({ '@type': 'ListItem', position: (number - 1) * PAGE_SIZE + index + 1, url: absolute(listingPath(item), origin), name: item.name })) });
  return { title, description, canonical, body, home, profile: profile ? { kind: profile.kind, id: profile.id } : null, noindex: Boolean(missing || admin || filtered || profile?.kind === 'teacher' && !verifiedAffiliations(profile).length || profile?.kind === 'offering' && !profile.provider_slug), status: missing ? 404 : 200, schema: { '@context': 'https://schema.org', '@graph': graph }, explore: exploreLinks(catalog) };
}

export async function serveSeo(request, env, getDirectory, services = {}) {
  const url = new URL(request.url);
  const { origin, preview, redirect } = siteContext(url, env);
  if (redirect) return Response.redirect(redirect, 308);
  if (url.pathname === '/robots.txt') return new Response(`User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=300', ...(preview ? { 'X-Robots-Tag': 'noindex, follow' } : {}) } });
  // Real static assets never need a catalog read. Unknown application paths do.
  if (/^\/(?:assets\/|logos\/)/.test(url.pathname) || ['/favicon.svg', '/social-card.svg', '/social-card.png', '/site.webmanifest'].includes(url.pathname)) return env.ASSETS.fetch(request);
  if (url.pathname !== '/' && !url.pathname.endsWith('/') && !/^\/sitemap(?:-[a-z]+)?\.xml$/.test(url.pathname)) {
    const target = new URL(url); target.pathname += '/'; return Response.redirect(target, 308);
  }
  try {
    // Modal aliases and profile APIs never hydrate the full directory from D1.
    // The shared catalog supplies the unchanged related links and landing counts.
    const alias = url.pathname === '/' && url.searchParams.get('listing');
    if (alias && services.getListing) {
      for (const collection of ['teachers', 'offerings', 'providers']) {
        const item = await services.getListing(env, collection, alias);
        if (item) return Response.redirect(new URL(listingPath(item), origin), 308);
      }
    }
    const match = url.pathname.match(/^\/(teachers|classes|providers)\/([a-z0-9-]+)\/$/);
    const collection = match?.[1] === 'classes' ? 'offerings' : match?.[1];
    const profile = match && services.getListing ? await services.getListing(env, collection, match[2]) : null;
    if (profile?.redirectSlug) return Response.redirect(new URL(`/providers/${profile.redirectSlug}/`,origin),308);
    const needsCatalog = url.pathname === '/' || /^\/(?:new-york|online)\//.test(url.pathname) || /^\/sitemap(?:-[a-z]+)?\.xml$/.test(url.pathname) || profile;
    const catalog = needsCatalog && !(alias && services.getListing) ? buildCatalog(await getDirectory(env)) : { profiles: [], listings: [], pages: [] };
    if (profile) {
      const index = catalog.profiles.findIndex(item => item.kind === profile.kind && item.slug === profile.slug);
      if (index >= 0) catalog.profiles[index] = profile;
      else catalog.profiles.push(profile);
    }
    const groups = sitemapGroups(catalog);
    if (/^\/sitemap(?:-[a-z]+)?\.xml$/.test(url.pathname)) {
      const group = url.pathname.match(/^\/sitemap-([a-z]+)\.xml$/)?.[1];
      if (group && !groups[group]) return new Response('Sitemap not found', { status: 404 });
      const index = !group;
      const entries = index ? Object.entries(groups).map(([name, entries]) => ({ path: `/sitemap-${name}.xml`, lastmod: entries.map(x => x.lastmod).sort().at(-1) })) : groups[group];
      const tag = index ? 'sitemap' : 'url';
      const xml = `<?xml version="1.0" encoding="UTF-8"?><${index ? 'sitemapindex' : 'urlset'} xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.map(entry => `<${tag}><loc>${e(absolute(entry.path, origin))}</loc><lastmod>${entry.lastmod}</lastmod></${tag}>`).join('')}</${index ? 'sitemapindex' : 'urlset'}>`;
      return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=30' } });
    }
    const target = new URL(url);
    for (const key of [...target.searchParams.keys()]) if (/^(utm_|gclid$|fbclid$)/i.test(key)) target.searchParams.delete(key);
    if (target.searchParams.get('page') === '1') target.searchParams.delete('page');
    const oldSlug = target.searchParams.get('listing');
    if (oldSlug) {
      const item = catalog.profiles.find(item => item.slug === oldSlug);
      if (item) { target.pathname = listingPath(item); target.search = ''; }
    }
    if (target.pathname !== '/' && !target.pathname.endsWith('/')) target.pathname += '/';
    if (target.href !== url.href) return Response.redirect(target, 308);
    const page = resolvePage(url, catalog, origin);
    page.directoryCacheVersion = services.cacheVersion || 'base';
    page.noindex ||= preview;
    if (page.noindex) page.preview = preview;
    const asset = await env.ASSETS.fetch(new Request(new URL('/', request.url)));
    if (!asset.ok) return asset;
    let html = await asset.text();
    html = html.replace(/<title>[\s\S]*?<\/title>/i, '').replace(/<meta\s+(?:name="(?:description|robots|twitter:[^"]+)"|property="og:[^"]+")[^>]*>/gi, '').replace(/<link\s+rel="canonical"[^>]*>/gi, '').replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/gi, '');
    const image = `${origin}/social-card.png`;
    const head = `<title>${e(page.title)}</title><meta name="description" content="${e(page.description)}"><meta name="robots" content="${page.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large'}"><link rel="canonical" href="${e(page.canonical)}"><meta property="og:type" content="website"><meta property="og:site_name" content="Vocal Catalog"><meta property="og:title" content="${e(page.title)}"><meta property="og:description" content="${e(page.description)}"><meta property="og:url" content="${e(page.canonical)}"><meta property="og:image" content="${image}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${e(page.title)}"><meta name="twitter:description" content="${e(page.description)}"><meta name="twitter:image" content="${image}"><script type="application/ld+json">${safeJson(page.schema)}</script>`;
    html = html.replace('</head>', () => `${head}</head>`).replace(/<div id="root">[\s\S]*?<\/div>/, () => `<div id="root">${page.body}</div>`).replace('</body>', () => `<script type="application/json" id="seo-page-data">${safeJson(page)}</script></body>`);
    return new Response(request.method === 'HEAD' ? null : html, { status: page.status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': page.noindex ? 'no-store' : 'public, max-age=0, s-maxage=30', 'X-Robots-Tag': page.noindex ? 'noindex, follow' : 'index, follow' } });
  } catch (error) {
    console.error('SEO response failed:', error?.message);
    return new Response('The directory is temporarily unavailable. Please try again shortly.', { status: 503, headers: { 'Retry-After': '60', 'X-Robots-Tag': 'noindex', 'Cache-Control': 'no-store' } });
  }
}

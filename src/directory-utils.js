export const LOCATIONS = ['NYC', 'Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island', 'Online'];
export const TRAINING_TYPES = [
  ['voice-lessons', 'Voice lessons'], ['vocal-coaching', 'Vocal coaching'],
  ['audition-repertoire-coaching', 'Audition & repertoire'], ['acting-coaching', 'Acting through song'],
  ['group-singing-classes', 'Group singing classes'], ['voice-teacher-training', 'Voice pedagogy'],
];
export const TECHNIQUES = [
  ['vocal-technique', 'Vocal technique'], ['classical-vocal-technique', 'Classical technique'],
  ['contemporary-voice-technique', 'Contemporary voice technique'], ['mix-and-belt', 'Mix & belt'],
  ['repertoire-coaching', 'Repertoire coaching'], ['acting-through-song', 'Acting through song'],
];
export const VOICE_STYLES = [
  ['musical-theatre', 'Musical theatre'], ['classical-opera', 'Classical / opera'],
  ['pop', 'Pop'], ['rock', 'Rock'], ['r-and-b-soul', 'R&B / soul'],
  ['jazz-cabaret', 'Jazz / cabaret'], ['gospel', 'Gospel'],
  ['country-folk-world', 'Country / folk / world'], ['latin', 'Latin'],
];
export const FORMATS = [['in_person', 'In person'], ['online', 'Online'], ['hybrid', 'Hybrid']];
export const PRICE_BASES = [['per_session', 'Per session'], ['hourly', 'Hourly'], ['full_course', 'Full course'], ['workshop', 'Workshop / intensive'], ['other', 'Other']];
export const BUDGETS = [
  ['under-100', 'Under $100', 0, 99.99], ['100-250', '$100–250', 100, 250], ['250-500', '$250–500', 250, 500],
  ['500-1000', '$500–1,000', 500, 1000], ['over-1000', '$1,000+', 1000, Infinity],
];

export function cleanText(value = '') {
  return String(value).toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim();
}

export function searchBlob(item) {
  return cleanText([
    item.name, item.description, item.biography, item.teaching_experience, item.providerName, item.provider_name, item.locationLabel,
    item.professional_title, item.source_label,
    ...(item.terms || []).map(term => term.term), ...(item.instructors || []).map(person => person.name),
    ...(item.affiliations || []).map(provider => provider.name),
    ...(item.offerings || []).flatMap(offering => [offering.name, offering.description, offering.provider_name]),
  ].join(' '));
}

export function getCollectionType(item) {
  if (item.kind === 'teacher') return 'coach';
  if (item.kind === 'provider') return item.listing_type === 'coach' ? 'coach' : 'studio';
  return item.instruction_mode === 'private' ? 'coach' : 'class';
}

export function mergeListings(data) {
  if (Array.isArray(data?.teachers)) return [
    ...data.teachers.map(teacher => ({ ...teacher, kind: 'teacher' })),
    ...(data.offerings || []).map(offering => ({ ...offering, kind: 'offering' })),
  ];
  const providers = (data?.providers || []).map(provider => ({ ...provider, kind: 'provider' }));
  const offerings = (data?.offerings || []).map(offering => ({ ...offering, kind: 'offering' }));
  return [...providers, ...offerings];
}

export function budgetFor(item) {
  if (item.kind === 'offering') return item.priceVerified && item.price_min != null ? item.price_min : null;
  const linked = (item.offerings || [])
    .filter(offering => offering.priceVerified && offering.price_min != null)
    .map(offering => offering.price_min);
  return linked.length ? Math.min(...linked) : null;
}

function verifiedPrices(item) {
  if (item.kind === 'offering') return item.priceVerified && item.price_min != null ? [item] : [];
  return (item.offerings || []).filter(offering => offering.priceVerified && offering.price_min != null);
}

function priceMatches(item, { minPrice, maxPrice, priceBasis, budget }) {
  let minimum = minPrice === '' || minPrice == null ? null : Number(minPrice);
  let maximum = maxPrice === '' || maxPrice == null ? null : Number(maxPrice);
  if (budget) {
    const range = BUDGETS.find(([slug]) => slug === budget);
    if (!range) return false;
    minimum = Math.max(minimum ?? 0, range[2]);
    maximum = Math.min(maximum ?? Infinity, range[3]);
  }
  if (minimum != null && maximum != null && minimum > maximum) return false;
  if (minimum == null && maximum == null && !priceBasis) return true;
  return verifiedPrices(item).some(price => {
    const low = Number(price.price_min);
    const high = Number(price.price_max ?? price.price_min);
    return (!priceBasis || price.price_basis === priceBasis) &&
      (minimum == null || high >= minimum) && (maximum == null || low <= maximum);
  });
}

export function filterListings(listings, filters) {
  let results = listings.filter(item => {
    const collectionType = getCollectionType(item);
    if (filters.type === 'studios' && !(item.kind === 'provider' && collectionType === 'studio')) return false;
    if (filters.type === 'classes' && !(item.kind === 'offering' && collectionType === 'class')) return false;
    if (filters.type === 'coaches' && !(collectionType === 'coach' && ['teacher', 'provider', 'offering'].includes(item.kind))) return false;

    if (filters.q && !searchBlob(item).includes(cleanText(filters.q))) return false;
    if (filters.location) {
      const locations = item.locations || [];
      const online = locations.some(location => Boolean(location.is_online) && location.verified);
      const borough = locations.some(location => location.borough === filters.location && location.verified);
      const nyc = locations.some(location => location.city === 'New York' && location.verified);
      if (filters.location === 'Online' ? !online : filters.location === 'NYC' ? !nyc : !borough) return false;
    }
    if (filters.training && !(item.terms || []).some(term => ['training_type', 'specialty'].includes(term.taxonomy) && term.slug === filters.training && term.verification_status === 'verified')) return false;
    if (filters.technique && !(item.terms || []).some(term => term.taxonomy === 'technique' && term.slug === filters.technique && term.verification_status === 'verified')) return false;
    if (filters.style && !(item.terms || []).some(term => term.taxonomy === 'genre' && term.slug === filters.style && term.verification_status === 'verified')) return false;
    if (filters.format) {
      const formats = item.kind === 'teacher'
        ? (item.formats || []).some(format => format.verification_status === 'verified' && format.format === filters.format)
        : item.kind === 'provider'
        ? (item.offerings || []).some(offering => offering.formatVerified && offering.format === filters.format)
        : item.formatVerified && item.format === filters.format;
      if (!formats) return false;
    }
    if ((filters.budget || filters.priceBasis || filters.minPrice !== '' && filters.minPrice != null || filters.maxPrice !== '' && filters.maxPrice != null) && !priceMatches(item, filters)) return false;
    return true;
  });

  if (filters.sort === 'price-low') results.sort((a, b) => (budgetFor(a) ?? Infinity) - (budgetFor(b) ?? Infinity));
  else if (filters.sort === 'price-high') results.sort((a, b) => (budgetFor(b) ?? -Infinity) - (budgetFor(a) ?? -Infinity));
  else if (filters.sort === 'name') results.sort((a, b) => a.name.localeCompare(b.name));
  else if (filters.sort === 'relevance' && filters.q) {
    const query = cleanText(filters.q);
    results.sort((a, b) => Number(searchBlob(b).startsWith(query)) - Number(searchBlob(a).startsWith(query)));
  }
  return results;
}

export function priceLabel(item, { prefix = false } = {}) {
  if (item.kind === 'teacher') {
    const values = (item.offerings || []).filter(offering => offering.priceVerified && offering.price_min != null);
    if (!values.length) return 'Ask for pricing';
    const cheapest = values.reduce((a, b) => a.price_min <= b.price_min ? a : b);
    return `${prefix ? 'From ' : ''}${formatPrice(cheapest.price_min, cheapest.currency)} ${basisLabel(cheapest.price_basis)}`.trim();
  }
  if (item.kind !== 'offering') {
    const values = (item.offerings || []).filter(o => o.price_min != null);
    if (!values.length) return 'Contact for pricing';
    const cheapest = values.reduce((a, b) => a.price_min <= b.price_min ? a : b);
    const verification = cheapest.priceVerified ? '' : ' · unverified';
    return `${prefix ? 'From ' : ''}${formatPrice(cheapest.price_min, cheapest.currency)} ${basisLabel(cheapest.price_basis)}${verification}`.trim();
  }
  if (item.price_min == null) return 'Contact for pricing';
  const amount = item.price_max != null && item.price_max !== item.price_min
    ? `${formatPrice(item.price_min, item.currency)}–${formatPrice(item.price_max, item.currency)}`
    : formatPrice(item.price_min, item.currency);
  return `${amount} ${basisLabel(item.price_basis)}${item.priceVerified ? '' : ' · unverified'}`.trim();
}

export function formatPrice(amount, currency = 'USD') {
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount); }
  catch { return `$${Number(amount).toLocaleString('en-US')}`; }
}

export function basisLabel(basis) {
  return ({ per_session: '/ session', hourly: '/ hour', full_course: '/ course', workshop: '/ workshop', other: '' })[basis] || '';
}

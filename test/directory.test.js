import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFilterChoices, budgetFor, filterListings, mergeAllRecords, mergeListings, NO_NYC_LOCATION, priceLabel } from '../src/directory-utils.js';
import { validateSubmission } from '../src/worker.js';

const verifiedTerm = (taxonomy, slug, term = slug) => ({ taxonomy, slug, term, verification_status: 'verified' });

const sample = {
  providers: [
    { id: 'studio-1', slug: 'studio-one', name: 'Studio One', listing_type: 'studio', provider_classification: 'studio_business', description: 'Singing classes', locations: [{ city: 'New York', borough: 'Manhattan', verified: true }], terms: [verifiedTerm('technique', 'vocal-technique', 'Vocal technique')], offerings: [{ id: 'class-1', price_min: 400, price_basis: 'full_course', currency: 'USD', priceVerified: true, format: 'in_person', formatVerified: true, instruction_mode: 'group', instructionModeVerified: true }] },
    { id: 'coach-1', slug: 'coach-one', name: 'Coach One', listing_type: 'coach', provider_classification: 'independent_teacher', description: 'Private singing lessons', locations: [{ city: 'New York', is_online: true, verified: true }], terms: [verifiedTerm('training_type', 'voice-lessons', 'Voice lessons')], offerings: [{ price_min: 90, price_basis: 'hourly', currency: 'USD', priceVerified: true, format: 'online', formatVerified: true }] },
  ],
  offerings: [
    { id: 'class-1', slug: 'intro-class', name: 'Intro to Singing', description: 'Beginner class', instruction_mode: 'group', locations: [{ city: 'New York', borough: 'Manhattan', verified: true }], terms: [verifiedTerm('genre', 'musical-theatre', 'Musical theatre')], format: 'in_person', formatVerified: true, price_min: 700, price_max: 700, currency: 'USD', price_basis: 'full_course', priceVerified: true },
    { id: 'class-2', slug: 'unknown-price', name: 'Unpriced class', description: 'A private session', instruction_mode: 'private', locations: [{ city: 'New York', borough: 'Brooklyn', verified: false }], terms: [{ ...verifiedTerm('genre', 'musical-theatre'), verification_status: 'unverified' }], format: 'online', formatVerified: false, price_min: 80, price_basis: 'hourly', priceVerified: false },
  ],
};

test('primary directory contains one result per provider and keeps associated classes nested', () => {
  const listings = mergeListings(sample);
  assert.deepEqual(listings.map(item => item.id), ['studio-1', 'coach-1']);
  assert.deepEqual(filterListings(listings, { providerType: 'studio_business' }).map(item => item.id), ['studio-1']);
  assert.deepEqual(filterListings(listings, { lessonFormat: 'group' }).map(item => item.id), ['studio-1']);
  assert.deepEqual(filterListings(listings, { lessonFormat: 'private' }), []);
  assert.deepEqual(mergeAllRecords(sample).filter(item => item.kind === 'offering').map(item => item.id), ['class-1', 'class-2']);
});

test('NYC, borough, online and voice-style filters require verified data', () => {
  const listings = mergeListings(sample);
  assert.deepEqual(filterListings(listings, { location: 'NYC' }).map(item => item.id), ['studio-1']);
  assert.deepEqual(filterListings(listings, { location: NO_NYC_LOCATION }).map(item => item.id), ['coach-1']);
  assert.deepEqual(filterListings(listings, { location: 'Manhattan', technique: 'vocal-technique' }).map(item => item.id), ['studio-1']);
  assert.deepEqual(filterListings(listings, { location: 'Brooklyn' }), []);
  assert.deepEqual(filterListings(listings, { format: 'online' }).map(item => item.id), ['coach-1']);
  assert.deepEqual(filterListings(listings, { style: 'musical-theatre' }), []);
});

test('lesson-focus, vocal-technique and verified price filters work together', () => {
  const listings = mergeListings(sample);
  const matching = filterListings(listings, { providerType: 'independent_teacher', training: 'voice-lessons', location: 'Online', format: 'online', priceBasis: 'hourly', minPrice: 50, maxPrice: 100 });
  assert.deepEqual(matching.map(item => item.id), ['coach-1']);
  assert.deepEqual(filterListings(listings, { providerType: 'studio_business', technique: 'vocal-technique', budget: '250-500' }).map(item => item.id), ['studio-1']);
  assert.deepEqual(filterListings(listings, { budget: 'under-100' }).map(item => item.id), ['coach-1']);
});

test('individual teacher views include sourced classes while excluding archived acting records', () => {
  const teacher = {
    id: 'teacher-1', slug: 'teacher-one', name: 'Voice Teacher', kind: 'teacher',
    description: 'Musical theatre vocal coaching.',
    affiliations: [{ name: 'Voice Studio' }],
    terms: [verifiedTerm('training_type', 'voice-lessons', 'Voice lessons'), verifiedTerm('genre', 'musical-theatre', 'Musical theatre')],
    locations: [{ city: 'New York', borough: 'Manhattan', verified: true }],
    formats: [{ format: 'in_person', verification_status: 'verified' }],
    offerings: [{ id: 'group-class', kind: 'offering', name: 'Group class', price_min: null }],
  };
  const listings = mergeListings({ teachers: [teacher], ...sample });
  assert.deepEqual(listings.map(item => item.id), ['studio-1', 'coach-1']);
  assert.ok(mergeAllRecords({ teachers: [teacher], ...sample }).some(item => item.id === 'teacher-1'));
  assert.deepEqual(filterListings(listings, { providerType: 'independent_teacher', location: 'NYC', training: 'voice-lessons', format: 'online' }).map(item => item.name), ['Coach One']);
  assert.equal(priceLabel(teacher), 'Ask for pricing');
});

test('teacher style, format and budget filters ignore unverified details', () => {
  const teacher = {
    id: 'teacher-2', kind: 'teacher', name: 'Teacher Two',
    terms: [verifiedTerm('specialty', 'music-theory', 'Music theory'), { ...verifiedTerm('genre', 'pop'), verification_status: 'unverified' }],
    formats: [{ format: 'online', verification_status: 'unverified' }],
    offerings: [{ price_min: 50, price_basis: 'hourly', priceVerified: false, format: 'online', formatVerified: false }],
  };
  assert.equal(priceLabel(teacher), 'Ask for pricing');
  assert.deepEqual(filterListings([teacher], { type: 'all', training: 'music-theory' }).map(item => item.id), ['teacher-2']);
  assert.deepEqual(filterListings([teacher], { type: 'all', style: 'pop' }), []);
  assert.deepEqual(filterListings([teacher], { type: 'all', format: 'online' }), []);
  assert.deepEqual(filterListings([teacher], { type: 'all', budget: 'under-100' }), []);
});

test('price labels preserve the published basis and identify unverified submissions', () => {
  assert.equal(priceLabel({ kind: 'offering', price_min: 95, price_max: 95, currency: 'USD', price_basis: 'hourly', priceVerified: true }), '$95 / hour');
  assert.equal(priceLabel({ kind: 'offering', price_min: 80, currency: 'USD', price_basis: 'hourly', priceVerified: false }), '$80 / hour · unverified');
  assert.equal(priceLabel({ kind: 'offering', price_min: null }), 'Contact for pricing');
});

test('submission validation requires vocal listing sources, contact and clear price basis', () => {
  assert.match(validateSubmission({ type: 'provider', name: 'Voice Studio', listing_type: 'studio', description: 'Singing lessons', website_url: 'https://studio.example', contact_email: 'bad' }), /valid contact email/i);
  assert.match(validateSubmission({ type: 'provider', name: 'Voice Studio', listing_type: 'studio', description: 'Singing lessons', contact_email: 'singer@example.com' }), /official website/i);
  assert.match(validateSubmission({ type: 'offering', name: 'Group class', description: 'Group singing class', registration_url: 'https://studio.example/register', contact_email: 'singer@example.com', price_min: 100 }), /choose the provider/i);
  assert.match(validateSubmission({ type: 'offering', name: 'Group class', description: 'Group singing class', provider_id: 'provider-1', registration_url: 'https://studio.example/register', contact_email: 'singer@example.com', price_min: 100 }), /what the published price covers/i);
  assert.equal(validateSubmission({ type: 'claim', provider_id: 'provider-1', contact_name: 'Coach', contact_email: 'coach@example.com', verification_information: 'I manage this studio.' }), null);
  assert.equal(validateSubmission({ type: 'claim', target_kind: 'teacher', target_id: 'teacher-1', contact_name: 'Teacher', contact_email: 'teacher@example.com', verification_information: 'This is my profile.' }), null);
  assert.match(validateSubmission({ type: 'claim', target_kind: 'teacher', contact_name: 'Teacher', contact_email: 'teacher@example.com', verification_information: 'This is my profile.' }), /profile to claim/i);
  assert.equal(validateSubmission({ type: 'teacher', name: 'Vocal Coach', professional_title: 'Vocal coach', description: 'Private voice lessons.', website_url: 'https://teacher.example', contact_email: 'coach@example.com' }), null);
  assert.match(validateSubmission({ type: 'teacher', name: 'Vocal Coach', description: 'Private voice lessons.', contact_email: 'coach@example.com' }), /official professional|teaching profile/i);
});

test('neighborhood choices and matches use verified physical locations and retain borough context', () => {
  const entries = [
    { id: 'local', kind: 'teacher', name: 'Local', locations: [{ city: 'New York', borough: 'Manhattan', neighborhood: 'Chelsea', verified: true }] },
    { id: 'unverified', kind: 'teacher', name: 'Unverified', locations: [{ city: 'New York', borough: 'Manhattan', neighborhood: 'Chelsea', verified: false }] },
    { id: 'online', kind: 'teacher', name: 'Online', locations: [{ borough: 'Manhattan', neighborhood: 'Chelsea', is_online: true, verified: true }] },
    { id: 'brooklyn', kind: 'teacher', name: 'Brooklyn', locations: [{ city: 'New York', borough: 'Brooklyn', neighborhood: 'Park Slope', verified: true }] },
  ];
  assert.deepEqual(buildFilterChoices(entries).neighborhoods, [['neighborhood:Manhattan:Chelsea', 'Chelsea, Manhattan'], ['neighborhood:Brooklyn:Park Slope', 'Park Slope, Brooklyn']]);
  assert.deepEqual(filterListings(entries, { location: 'neighborhood:Manhattan:Chelsea' }).map(item => item.id), ['local']);
  assert.deepEqual(filterListings(entries, { location: 'Manhattan' }).map(item => item.id), ['local']);
  assert.deepEqual(filterListings(entries, { location: 'Online' }).map(item => item.id), ['online']);
  assert.deepEqual(filterListings(entries, { location: 'neighborhood:Brooklyn:Chelsea' }), []);
});

test('institute sorting keeps the same verified logo together with stable alphabetical names', () => {
  const entries = [
    { id:'a', name:'Zed', logo:{ status:'verified', name:'Institute A', url:'/a.svg' } },
    { id:'b', name:'Bee', logo:{ status:'verified', name:'Institute B', url:'/b.svg' } },
    { id:'c', name:'Amy', logo:{ status:'verified', name:'Institute A alternate', url:'/a.svg' } },
    { id:'d', name:'Independent', logo:null },
    { id:'e', name:'Unverified', logo:{ status:'unverified', name:'Institute A', url:'/a.svg' } },
  ];
  assert.deepEqual(filterListings(entries, {sort:'institute'}).map(item=>item.id), ['c','a','b','d','e']);
  assert.deepEqual(entries.map(item=>item.id), ['a','b','c','d','e']);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { budgetFor, filterListings, mergeListings, priceLabel } from '../src/directory-utils.js';
import { validateSubmission } from '../src/worker.js';

const verifiedTerm = (taxonomy, slug, term = slug) => ({ taxonomy, slug, term, verification_status: 'verified' });

const sample = {
  providers: [
    { id: 'studio-1', slug: 'studio-one', name: 'Studio One', listing_type: 'studio', description: 'Singing classes', locations: [{ city: 'New York', borough: 'Manhattan', verified: true }], terms: [verifiedTerm('technique', 'vocal-technique', 'Vocal technique')], offerings: [{ price_min: 400, price_basis: 'full_course', currency: 'USD', priceVerified: true, format: 'in_person', formatVerified: true }] },
    { id: 'coach-1', slug: 'coach-one', name: 'Coach One', listing_type: 'coach', description: 'Private singing lessons', locations: [{ city: 'New York', is_online: true, verified: true }], terms: [verifiedTerm('training_type', 'voice-lessons', 'Voice lessons')], offerings: [{ price_min: 90, price_basis: 'hourly', currency: 'USD', priceVerified: true, format: 'online', formatVerified: true }] },
  ],
  offerings: [
    { id: 'class-1', slug: 'intro-class', name: 'Intro to Singing', description: 'Beginner class', instruction_mode: 'group', locations: [{ city: 'New York', borough: 'Manhattan', verified: true }], terms: [verifiedTerm('genre', 'musical-theatre', 'Musical theatre')], format: 'in_person', formatVerified: true, price_min: 700, price_max: 700, currency: 'USD', price_basis: 'full_course', priceVerified: true },
    { id: 'class-2', slug: 'unknown-price', name: 'Unpriced class', description: 'A private session', instruction_mode: 'private', locations: [{ city: 'New York', borough: 'Brooklyn', verified: false }], terms: [{ ...verifiedTerm('genre', 'musical-theatre'), verification_status: 'unverified' }], format: 'online', formatVerified: false, price_min: 80, price_basis: 'hourly', priceVerified: false },
  ],
};

test('listing type views keep offerings, studios and private coaches distinct', () => {
  const listings = mergeListings(sample);
  assert.deepEqual(filterListings(listings, { type: 'classes' }).map(item => item.id), ['class-1']);
  assert.deepEqual(filterListings(listings, { type: 'studios' }).map(item => item.id), ['studio-1']);
  assert.deepEqual(filterListings(listings, { type: 'coaches' }).map(item => item.id), ['coach-1', 'class-2']);
});

test('NYC, borough, online and voice-style filters require verified data', () => {
  const listings = mergeListings(sample);
  assert.deepEqual(filterListings(listings, { type: 'classes', location: 'NYC' }).map(item => item.id), ['class-1']);
  assert.deepEqual(filterListings(listings, { type: 'classes', location: 'Manhattan', style: 'musical-theatre' }).map(item => item.id), ['class-1']);
  assert.deepEqual(filterListings(listings, { type: 'classes', location: 'Brooklyn' }), []);
  assert.deepEqual(filterListings(listings, { type: 'classes', format: 'online' }), []);
  assert.deepEqual(filterListings(listings, { type: 'classes', style: 'musical-theatre' }).map(item => item.id), ['class-1']);
});

test('lesson-focus, vocal-technique and verified price filters work together', () => {
  const listings = mergeListings(sample);
  const matching = filterListings(listings, { type: 'coaches', training: 'voice-lessons', location: 'Online', format: 'online', priceBasis: 'hourly', minPrice: 50, maxPrice: 100 });
  assert.deepEqual(matching.map(item => item.id), ['coach-1']);
  assert.deepEqual(filterListings(listings, { type: 'studios', technique: 'vocal-technique', budget: '250-500' }).map(item => item.id), ['studio-1']);
  assert.deepEqual(filterListings(listings, { type: 'classes', budget: 'under-100' }), []);
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
  assert.deepEqual(listings.map(item => item.id), ['teacher-1', 'class-1', 'class-2']);
  assert.deepEqual(filterListings(listings, { type: 'all', location: 'NYC', training: 'voice-lessons', style: 'musical-theatre', format: 'in_person' }).map(item => item.name), ['Voice Teacher']);
  assert.deepEqual(filterListings(listings, { type: 'classes' }).map(item => item.id), ['class-1']);
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
  assert.match(validateSubmission({ type: 'offering', name: 'Group class', description: 'Group singing class', registration_url: 'https://studio.example/register', contact_email: 'singer@example.com', price_min: 100 }), /what the published price covers/i);
  assert.equal(validateSubmission({ type: 'claim', provider_id: 'provider-1', contact_name: 'Coach', contact_email: 'coach@example.com', verification_information: 'I manage this studio.' }), null);
  assert.equal(validateSubmission({ type: 'claim', target_kind: 'teacher', target_id: 'teacher-1', contact_name: 'Teacher', contact_email: 'teacher@example.com', verification_information: 'This is my profile.' }), null);
  assert.match(validateSubmission({ type: 'claim', target_kind: 'teacher', contact_name: 'Teacher', contact_email: 'teacher@example.com', verification_information: 'This is my profile.' }), /profile to claim/i);
  assert.equal(validateSubmission({ type: 'teacher', name: 'Vocal Coach', professional_title: 'Vocal coach', description: 'Private voice lessons.', website_url: 'https://teacher.example', contact_email: 'coach@example.com' }), null);
  assert.match(validateSubmission({ type: 'teacher', name: 'Vocal Coach', description: 'Private voice lessons.', contact_email: 'coach@example.com' }), /official professional|teaching profile/i);
});

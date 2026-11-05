import test from 'node:test';
import assert from 'node:assert/strict';
import { budgetFor, filterListings, mergeListings, priceLabel } from '../src/directory-utils.js';
import { validateSubmission } from '../src/worker.js';

const verifiedTerm = (taxonomy, slug, term = slug) => ({ taxonomy, slug, term, verification_status: 'verified' });

const sample = {
  providers: [
    { id: 'studio-1', slug: 'studio-one', name: 'Studio One', listing_type: 'studio', description: 'Meisner classes', locations: [{ borough: 'Manhattan', verified: true }], terms: [verifiedTerm('technique', 'meisner', 'Meisner')], offerings: [{ price_min: 400, price_basis: 'full_course', currency: 'USD', priceVerified: true, format: 'in_person', formatVerified: true }] },
    { id: 'coach-1', slug: 'coach-one', name: 'Coach One', listing_type: 'coach', description: 'Private audition coaching', locations: [{ is_online: true, verified: true }], terms: [verifiedTerm('training_type', 'audition-technique', 'Audition technique')], offerings: [{ price_min: 90, price_basis: 'hourly', currency: 'USD', priceVerified: true, format: 'online', formatVerified: true }] },
  ],
  offerings: [
    { id: 'class-1', slug: 'intro-class', name: 'Intro to Meisner', description: 'Beginner class', instruction_mode: 'group', locations: [{ borough: 'Manhattan', verified: true }], terms: [verifiedTerm('technique', 'meisner', 'Meisner')], format: 'in_person', formatVerified: true, price_min: 700, price_max: 700, currency: 'USD', price_basis: 'full_course', priceVerified: true },
    { id: 'class-2', slug: 'unknown-price', name: 'Unpriced class', description: 'A private session', instruction_mode: 'private', locations: [{ borough: 'Brooklyn', verified: false }], terms: [{ ...verifiedTerm('technique', 'meisner'), verification_status: 'unverified' }], format: 'online', formatVerified: false, price_min: 80, price_basis: 'hourly', priceVerified: false },
  ],
};

test('listing type views keep offerings, studios and private coaches distinct', () => {
  const listings = mergeListings(sample);
  assert.deepEqual(filterListings(listings, { type: 'classes' }).map(item => item.id), ['class-1']);
  assert.deepEqual(filterListings(listings, { type: 'studios' }).map(item => item.id), ['studio-1']);
  assert.deepEqual(filterListings(listings, { type: 'coaches' }).map(item => item.id), ['coach-1']);
});

test('combined filters only use verified structured information', () => {
  const listings = mergeListings(sample);
  const matching = filterListings(listings, { type: 'classes', location: 'Manhattan', technique: 'meisner', format: 'in_person', budget: '500-1000' });
  assert.deepEqual(matching.map(item => item.id), ['class-1']);
  assert.deepEqual(filterListings(listings, { type: 'classes', location: 'Brooklyn' }), []);
  assert.deepEqual(filterListings(listings, { type: 'classes', format: 'online' }), []);
});

test('provider budget reflects its lowest verified related offering', () => {
  const listings = mergeListings(sample);
  const studio = listings.find(item => item.id === 'studio-1');
  assert.equal(budgetFor(studio), 400);
  assert.deepEqual(filterListings(listings, { type: 'studios', budget: '250-500' }).map(item => item.id), ['studio-1']);
});

test('price labels preserve the published price basis and identify unverified submissions', () => {
  assert.equal(priceLabel({ kind: 'offering', price_min: 95, price_max: 95, currency: 'USD', price_basis: 'hourly', priceVerified: true }), '$95 / hour');
  assert.equal(priceLabel({ kind: 'offering', price_min: 80, currency: 'USD', price_basis: 'hourly', priceVerified: false }), '$80 / hour · unverified');
  assert.equal(priceLabel({ kind: 'offering', price_min: null }), 'Contact for pricing');
});

test('submission validation requires contact details, provider sources and clear price basis', () => {
  assert.match(validateSubmission({ type: 'provider', name: 'Studio', listing_type: 'studio', description: 'Acting classes', website_url: 'https://studio.example', contact_email: 'bad' }), /valid contact email/i);
  assert.match(validateSubmission({ type: 'provider', name: 'Studio', listing_type: 'studio', description: 'Acting classes', contact_email: 'actor@example.com' }), /official website/i);
  assert.match(validateSubmission({ type: 'offering', name: 'Class', description: 'Group class', registration_url: 'https://studio.example/register', contact_email: 'actor@example.com', price_min: 100 }), /what the published price covers/i);
  assert.equal(validateSubmission({ type: 'claim', provider_id: 'provider-1', contact_name: 'Actor', contact_email: 'actor@example.com', verification_information: 'I manage this studio.' }), null);
  assert.equal(validateSubmission({ type: 'claim', target_kind: 'teacher', target_id: 'teacher-1', contact_name: 'Teacher', contact_email: 'teacher@example.com', verification_information: 'This is my profile.' }), null);
  assert.match(validateSubmission({ type: 'claim', target_kind: 'teacher', contact_name: 'Teacher', contact_email: 'teacher@example.com', verification_information: 'This is my profile.' }), /profile to claim/i);
});


test('individual teachers become the browseable records while affiliations and offerings remain contextual', () => {
  const profile = { id: 'teacher-1', slug: 'teacher-one', name: 'Teacher One', kind: 'teacher', description: 'On-camera acting and self-tape coaching.',
    affiliations: [{ name: 'Studio One' }], terms: [verifiedTerm('training_type', 'on-camera-acting', 'On-camera acting')],
    locations: [{ borough: 'Manhattan', verified: true }], offerings: [{ name: 'Self-tape coaching', price_min: 100, price_basis: 'hourly', currency: 'USD', priceVerified: true, format: 'online', formatVerified: true }] };
  const listings = mergeListings({ teachers: [profile], ...sample });
  assert.deepEqual(listings.map(item => item.id), ['teacher-1']);
  assert.deepEqual(filterListings(listings, { type: 'all', training: 'on-camera-acting', location: 'Manhattan', format: 'online', budget: '100-250' }).map(item => item.name), ['Teacher One']);
  assert.deepEqual(filterListings(listings, { type: 'all', training: 'meisner' }), []);
  assert.equal(priceLabel(profile), '$100 / hour');
});

test('teacher specialty, format and budget filters ignore unverified details', () => {
  const teacher = { id: 'teacher-2', kind: 'teacher', name: 'Teacher Two', terms: [verifiedTerm('specialty', 'dialect-coaching', 'Dialect coaching')],
    offerings: [{ price_min: 50, price_basis: 'hourly', priceVerified: false, format: 'online', formatVerified: false }] };
  assert.equal(priceLabel(teacher), 'Ask for pricing');
  assert.deepEqual(filterListings([teacher], { type: 'all', training: 'dialect-coaching' }).map(item => item.id), ['teacher-2']);
  assert.deepEqual(filterListings([teacher], { type: 'all', format: 'online' }), []);
  assert.deepEqual(filterListings([teacher], { type: 'all', budget: 'under-100' }), []);
});

test('teacher submissions require an official profile source and contact email', () => {
  assert.equal(validateSubmission({ type: 'teacher', name: 'An Actor Teacher', professional_title: 'Acting teacher', description: 'Teaches private scene study.', website_url: 'https://teacher.example', contact_email: 'actor@example.com' }), null);
  assert.match(validateSubmission({ type: 'teacher', name: 'An Actor Teacher', description: 'Teaches acting.', contact_email: 'actor@example.com' }), /official professional|teaching profile/i);
});

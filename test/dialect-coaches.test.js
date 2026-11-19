import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import catalog from '../data/dialect-coaches.json' with { type:'json' };
import verification from '../data/dialect-coach-verification.json' with { type:'json' };
import { buildDialectSql } from '../scripts/generate-dialect-coaches.mjs';
import { filterListings, buildFilterChoices } from '../src/directory-utils.js';
import { resolveListingLogo } from '../src/listing-logos.js';

test('dialect expansion adds 20 unique source-backed coaches without changing prior records', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('PRAGMA foreign_keys=ON');
    const path = new URL('../migrations/',import.meta.url);
    const files = readdirSync(path).filter(name => name.endsWith('.sql')).sort();
    for (const file of files.filter(name => name < '0011')) db.exec(readFileSync(new URL(file,path),'utf8'));
    const previous = db.prepare('SELECT * FROM instructors ORDER BY id').all();
    const offerings = db.prepare('SELECT * FROM offerings ORDER BY id').all();
    for (const file of files.filter(name => name >= '0011' && name <= '0011_verified_dialect_coaches.sql')) db.exec(readFileSync(new URL(file,path),'utf8'));
    for (const coach of previous) assert.deepEqual(db.prepare('SELECT * FROM instructors WHERE id=?').get(coach.id),coach);
    assert.deepEqual(db.prepare('SELECT * FROM offerings ORDER BY id').all(),offerings);
    assert.equal(db.prepare("SELECT count(*) AS n FROM instructors WHERE profile_status='published'").get().n,206);
    assert.equal(db.prepare("SELECT count(*) AS n FROM offerings WHERE listing_status='published'").get().n,22);
    assert.deepEqual(db.prepare("SELECT lower(name) FROM instructors WHERE profile_status='published' GROUP BY lower(name) HAVING count(*)>1").all(),[]);
    assert.equal(catalog.coaches.length,20);
    const checks = new Map(verification.checks.map(check => [check.url,check]));
    const listings = catalog.coaches.map(coach => {
      const row = db.prepare('SELECT * FROM instructors WHERE slug=?').get(coach.slug);
      assert.equal(row.professional_title,'Dialect coach');
      assert.equal(row.last_verified_at,catalog.reviewedAt);
      for (const url of [coach.source,coach.locationSource,coach.formatSource,coach.serviceSource,coach.booking,coach.affiliation?.source].filter(Boolean)) {
        assert.equal(checks.get(url)?.httpStatus,200,`${coach.name}: unverified link ${url}`);
        assert.match(checks.get(url).sha256,/^[a-f0-9]{64}$/);
      }
      assert.ok(db.prepare("SELECT 1 FROM field_evidence WHERE entity_id=? AND field_name='profile' AND verification_status='verified'").get(row.id));
      const terms = db.prepare('SELECT t.*,it.verification_status FROM instructor_terms it JOIN taxonomy_terms t ON t.id=it.term_id WHERE it.instructor_id=?').all(row.id);
      const formats = db.prepare('SELECT * FROM instructor_formats WHERE instructor_id=?').all(row.id);
      assert.deepEqual(formats.map(f=>f.format).sort(),[...coach.formats].sort());
      const locations = db.prepare("SELECT l.*,EXISTS(SELECT 1 FROM field_evidence e WHERE e.entity_type='location' AND e.entity_id=l.id AND e.verification_status='verified') AS verified FROM locations l JOIN instructor_locations il ON il.location_id=l.id WHERE il.instructor_id=?").all(row.id);
      assert.equal(locations.some(location => !location.is_online),Boolean(coach.location));
      const affiliations = db.prepare('SELECT p.id,p.name FROM providers p JOIN provider_instructors pi ON pi.provider_id=p.id WHERE pi.instructor_id=?').all(row.id);
      return {...row,kind:'teacher',terms,formats,locations,affiliations};
    });
    assert.equal(filterListings(listings,{type:'coaches',training:'dialect-coaching'}).length,20);
    assert.equal(filterListings(listings,{training:'group-singing-classes'}).length,0);
    assert.equal(filterListings(listings,{format:'online'}).length,catalog.coaches.filter(c=>c.formats.includes('online')).length);
    assert.equal(filterListings(listings,{location:'NYC'}).length,catalog.coaches.filter(c=>c.location).length);
    assert.ok(buildFilterChoices(listings).training.some(([slug])=>slug==='dialect-coaching'));
    assert.equal(listings.filter(listing=>resolveListingLogo(listing,'teacher')?.status==='verified').length,8);
    assert.match(listings.find(listing=>listing.name==='Erik Singer').description,/unavailable for private coaching/);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
    assert.equal(buildDialectSql(catalog),readFileSync(new URL('../migrations/0011_verified_dialect_coaches.sql',import.meta.url),'utf8'));
  } finally { db.close(); }
});

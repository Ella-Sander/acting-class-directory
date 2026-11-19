import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import catalog from '../data/acting-school-voice.json' with { type:'json' };
import { buildActingVoiceSql } from '../scripts/generate-acting-school-voice.mjs';
import { resolveListingLogo } from '../src/listing-logos.js';
import { filterListings } from '../src/directory-utils.js';

test('acting-school expansion preserves existing data, qualifies prices and resolves official logos', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('PRAGMA foreign_keys=ON');
    const path = new URL('../migrations/',import.meta.url);
    const files = readdirSync(path).filter(name => name.endsWith('.sql')).sort();
    for (const file of files.filter(name => name < '0010')) db.exec(readFileSync(new URL(file,path),'utf8'));
    const before = db.prepare('SELECT * FROM offerings ORDER BY id').all();
    for (const file of files.filter(name => name >= '0010' && name <= '0010_acting_school_voice.sql')) db.exec(readFileSync(new URL(file,path),'utf8'));
    assert.equal(catalog.courses.length,6);
    assert.equal(db.prepare("SELECT count(*) AS n FROM offerings WHERE listing_status='published'").get().n,22);
    assert.equal(db.prepare("SELECT count(*) AS n FROM instructors WHERE profile_status='published'").get().n,186);
    for (const original of before) assert.deepEqual(db.prepare('SELECT * FROM offerings WHERE id=?').get(original.id),original);
    assert.equal(db.prepare("SELECT listing_status FROM providers WHERE id='provider-stella-adler'").get().listing_status,'archived');
    for (const course of catalog.courses) {
      const row = db.prepare('SELECT * FROM offerings WHERE id=?').get(course.id);
      assert.equal(resolveListingLogo(row,'offering')?.status,'verified');
      assert.equal(row.price_min,course.price ?? null);
      assert.equal(row.price_basis,course.price == null ? null : 'full_course');
      assert.equal(row.format,course.format ?? null);
      assert.ok(db.prepare("SELECT 1 FROM field_evidence WHERE entity_id=? AND field_name='description'").get(course.id));
      const price = db.prepare("SELECT 1 FROM field_evidence WHERE entity_id=? AND field_name='price'").get(course.id);
      assert.equal(Boolean(price),course.price != null);
      const locations = db.prepare("SELECT l.*,1 AS verified FROM locations l JOIN offering_locations ol ON ol.location_id=l.id WHERE ol.offering_id=?").all(course.id);
      const terms = db.prepare('SELECT t.*,ot.verification_status FROM taxonomy_terms t JOIN offering_terms ot ON ot.term_id=t.id WHERE ot.offering_id=?').all(course.id);
      const listing = {...row,kind:'offering',locations,terms,priceVerified:Boolean(price)};
      assert.equal(filterListings([listing],{type:'classes',location:'Manhattan'}).length,1);
      assert.equal(filterListings([listing],{minPrice:'500',maxPrice:'650',priceBasis:'full_course'}).length,course.price == null ? 0 : 1);
      if (course.terms.includes('training-voice-speech')) {
        assert.equal(filterListings([listing],{training:'voice-speech-for-actors'}).length,1);
        assert.equal(filterListings([listing],{training:'group-singing-classes'}).length,0);
      }
    }
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
    assert.equal(buildActingVoiceSql(catalog),readFileSync(new URL('../migrations/0010_acting_school_voice.sql',import.meta.url),'utf8'));
  } finally { db.close(); }
});

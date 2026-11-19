import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { resolveListingLogo } from '../src/listing-logos.js';

test('92NY courses preserve existing listings and include verified tuition, locations and logos', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('PRAGMA foreign_keys=ON');
    const path = new URL('../migrations/', import.meta.url);
    for (const file of readdirSync(path).filter(name => name.endsWith('.sql') && name <= '0009_add_92ny_voice_courses.sql').sort()) db.exec(readFileSync(new URL(file, path), 'utf8'));
    const courses = db.prepare("SELECT * FROM offerings WHERE provider_id='catalog-provider-92ny' AND listing_status='published'").all();
    assert.equal(courses.length, 3);
    assert.equal(courses.filter(course => course.slug === '92ny-everybody-can-sing').length, 1);
    assert.equal(db.prepare("SELECT count(*) AS n FROM offerings WHERE listing_status='published'").get().n, 16);
    for (const course of courses) {
      assert.equal(course.price_basis, 'full_course');
      assert.ok(course.price_min > 0);
      assert.match(course.source_url, /^https:\/\/www\.92ny\.org\/class\//);
      assert.equal(resolveListingLogo(course, 'offering').status, 'verified');
      assert.ok(db.prepare("SELECT 1 FROM field_evidence WHERE entity_id=? AND field_name='price' AND verification_status='verified'").get(course.id));
      assert.equal(db.prepare('SELECT count(*) AS n FROM offering_locations WHERE offering_id=?').get(course.id).n, 1);
    }
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  } finally { db.close(); }
});

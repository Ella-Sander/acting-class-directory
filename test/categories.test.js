import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readdirSync,readFileSync } from 'node:fs';
import { filterListings,matchesCategory } from '../src/directory-utils.js';
import worker from '../src/worker.js';

test('categories include people and programs by verified subject rather than listing type', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('PRAGMA foreign_keys=ON');
    const path = new URL('../migrations/',import.meta.url);
    for (const file of readdirSync(path).filter(x=>x.endsWith('.sql')).sort()) db.exec(readFileSync(new URL(file,path),'utf8'));
    const people = db.prepare("SELECT *, 'teacher' AS kind FROM instructors WHERE profile_status='published'").all();
    const programs = db.prepare("SELECT *, 'offering' AS kind FROM offerings WHERE listing_status='published'").all();
    const listings = [...people,...programs].map(item=>({...item,terms:db.prepare(`SELECT t.*,r.verification_status FROM ${item.kind==='teacher'?'instructor_terms':'offering_terms'} r JOIN taxonomy_terms t ON t.id=r.term_id WHERE r.${item.kind==='teacher'?'instructor_id':'offering_id'}=?`).all(item.id)}));
    assert.equal(filterListings(listings,{category:'all'}).length,245);
    assert.equal(filterListings(listings,{category:'dialects'}).length,20);
    const speech = filterListings(listings,{category:'voice-speech'});
    assert.ok(speech.length>=20);
    assert.ok(speech.some(item=>item.id==='acting-voice-adler-monologue'));
    const singing = filterListings(listings,{category:'singing'});
    assert.ok(singing.some(item=>item.kind==='teacher'));
    assert.ok(singing.some(item=>item.kind==='offering'));
    assert.ok(singing.some(item=>item.id==='acting-voice-hb-singing-1'));
    assert.ok(!singing.some(item=>item.id.startsWith('dialect-')));
    assert.equal(filterListings(listings,{category:'dialects',training:'dialect-coaching',q:'Julie'}).length,1);
    assert.equal(filterListings(listings,{category:'dialects',training:'group-singing-classes'}).length,0);
  } finally { db.close(); }
});

test('older coach and class URLs open the unified directory and preserve subject refinements', async () => {
  for (const path of ['/directory','/coaches','/classes','/studios']) {
    const response = await worker.fetch(new Request(`https://example.com${path}?type=classes&category=dialects&q=Julie`),{});
    assert.equal(response.status,302);
    const destination = new URL(response.headers.get('location'));
    assert.equal(destination.pathname,'/');
    assert.equal(destination.searchParams.get('type'),null);
    assert.equal(destination.searchParams.get('category'),'dialects');
    assert.equal(destination.searchParams.get('q'),'Julie');
  }
});

test('unverified terms and mentions do not assign categories, and subjects may overlap', () => {
  const dialect = {taxonomy:'specialty',slug:'dialect-coaching',verification_status:'verified'};
  const speech = {taxonomy:'training_type',slug:'voice-speech-for-actors',verification_status:'verified'};
  assert.equal(matchesCategory({description:'singing voice speech dialect-coaching',terms:[]},'dialects'),false);
  assert.equal(matchesCategory({terms:[{...dialect,verification_status:'unverified'}]},'dialects'),false);
  assert.equal(matchesCategory({terms:[dialect,speech]},'dialects'),true);
  assert.equal(matchesCategory({terms:[dialect,speech]},'voice-speech'),true);
  assert.equal(matchesCategory({},'all'),true);
  assert.equal(matchesCategory({},'unknown'),false);
});

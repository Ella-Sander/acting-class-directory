import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import catalog from '../data/voice-speech-expansion.js';
import verification from '../data/voice-speech-verification.json' with {type:'json'};
import { buildVoiceSpeechSql } from '../scripts/generate-voice-speech.mjs';
import { matchesCategory } from '../src/directory-utils.js';
import { resolveListingLogo } from '../src/listing-logos.js';

test('voice and speech expansion adds 17 sourced, logo-backed listings and reaches at least 20', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('PRAGMA foreign_keys=ON');
    const path = new URL('../migrations/',import.meta.url);
    const files = readdirSync(path).filter(x=>x.endsWith('.sql')).sort();
    for(const file of files.filter(x=>x<'0012')) db.exec(readFileSync(new URL(file,path),'utf8'));
    const oldPeople = db.prepare('SELECT * FROM instructors ORDER BY id').all();
    const oldClasses = db.prepare('SELECT * FROM offerings ORDER BY id').all();
    for(const file of files.filter(x=>x>='0012')) db.exec(readFileSync(new URL(file,path),'utf8'));
    for(const row of oldPeople) {
      const current = db.prepare('SELECT * FROM instructors WHERE id=?').get(row.id);
      for (const [key, value] of Object.entries(row)) assert.deepEqual(current[key], value);
    }
    for(const row of oldClasses) assert.deepEqual(db.prepare('SELECT * FROM offerings WHERE id=?').get(row.id),row);
    const checks = new Map(verification.checks.map(x=>[x.url,x]));
    assert.equal(catalog.coaches.length+catalog.courses.length,17);
    for(const person of catalog.coaches) {
      assert.equal(checks.get(person.source)?.httpStatus,200);
      assert.ok(checks.get(person.source).headings.some(x=>x.replace(/\s+/g,' ')===person.name),`Roster missing ${person.name}`);
      assert.equal(resolveListingLogo({id:person.id,affiliations:[{id:person.provider}]},'teacher')?.status,'verified');
    }
    for(const course of catalog.courses) {
      const row = db.prepare('SELECT * FROM offerings WHERE id=?').get(course.id);
      assert.equal(checks.get(course.source)?.httpStatus,200);
      assert.equal(resolveListingLogo(row,'offering')?.status,'verified');
      assert.equal(row.price_min,course.price??null);
      assert.equal(row.price_basis,course.price==null?null:'full_course');
      assert.equal(row.format,course.format??null);
    }
    let count = 0;
    for(const [table,relation,key,status] of [['instructors','instructor_terms','instructor_id','profile_status'],['offerings','offering_terms','offering_id','listing_status']]) {
      for(const row of db.prepare(`SELECT * FROM ${table} WHERE ${status}='published'`).all()) {
        const terms=db.prepare(`SELECT t.*,r.verification_status FROM ${relation} r JOIN taxonomy_terms t ON t.id=r.term_id WHERE r.${key}=?`).all(row.id);
        if(matchesCategory({terms},'voice-speech')) count++;
      }
    }
    assert.ok(count>=20,`Only ${count} Voice & speech listings`);
    assert.equal(db.prepare("SELECT count(*) AS n FROM instructors WHERE profile_status='published'").get().n,216);
    assert.equal(db.prepare("SELECT count(*) AS n FROM offerings WHERE listing_status='published'").get().n,29);
    assert.deepEqual(db.prepare("SELECT lower(name) FROM instructors WHERE profile_status='published' GROUP BY lower(name) HAVING count(*)>1").all(),[]);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
    assert.equal(buildVoiceSpeechSql(catalog),readFileSync(new URL('../migrations/0012_voice_speech_expansion.sql',import.meta.url),'utf8'));
  } finally {db.close();}
});

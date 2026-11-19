import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { readdirSync } from 'node:fs';
import catalog from '../data/nyc-catalog-expansion-200.json' with { type:'json' };
import baseline from '../data/catalog-100-baseline.json' with { type:'json' };
import verification from '../data/catalog-200-verification.json' with { type:'json' };
import { buildExpansionSql } from '../scripts/generate-nyc-expansion.mjs';
import { resolveListingLogo } from '../src/listing-logos.js';

test('second expansion adds 100 distinct instructors with official websites and verified logos', () => {
  assert.equal(catalog.teachers.length,100);
  assert.equal(catalog.previousTotal+catalog.teachers.length,200);
  const all=[...baseline,...catalog.teachers];
  for(const field of ['id','slug','name']){
    const normalized=all.map(x=>x[field].normalize('NFKD').replace(/[\u0300-\u036f’'\s.-]/g,'').toLowerCase());
    assert.equal(new Set(normalized).size,200,`Duplicate ${field}`);
  }
  for(const person of catalog.teachers){
    assert.equal(new URL(person.website).protocol,'https:');
    assert.equal(person.sourceType,'official_website');
    const provider=catalog.providers.find(x=>x.key===person.provider);
    assert.ok(provider);
    const logo=resolveListingLogo({...person,affiliations:[{id:provider.id,name:provider.name}]},'teacher');
    assert.equal(logo?.status,'verified');
    assert.equal(logo.relationship,'affiliation');
    const check=verification.listings.find(x=>x.id===person.id);
    assert.equal(check?.httpStatus,200);
    assert.equal(check.profileUrl,person.website);
    assert.ok(check.rosterSource);
    if(['nyu','msm','mannes'].includes(person.provider))assert.match(person.description,/admission|enrollment/i);
  }
});

test('all migrations produce 200 published listings without duplicates or broken relationships', () => {
  const db=new DatabaseSync(':memory:');
  try{
    db.exec('PRAGMA foreign_keys=ON');
    const path=new URL('../migrations/',import.meta.url);
    const files=readdirSync(path).filter(x=>x.endsWith('.sql') && x <= '0008_expand_voice_directory_to_200.sql').sort();
    assert.ok(files.includes('0008_expand_voice_directory_to_200.sql'));
    for(const file of files)db.exec(readFileSync(new URL(file,path),'utf8'));
    assert.equal(db.prepare("SELECT count(*) AS n FROM instructors WHERE profile_status='published'").get().n,186);
    assert.equal(db.prepare("SELECT count(*) AS n FROM offerings WHERE listing_status='published'").get().n,14);
    assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
    assert.equal(db.prepare("SELECT name FROM instructors WHERE profile_status='published' GROUP BY lower(name) HAVING count(*)>1").all().length,0);
    for(const original of baseline){
      const person=db.prepare('SELECT name,slug FROM instructors WHERE id=?').get(original.id)||db.prepare('SELECT name,slug FROM offerings WHERE id=?').get(original.id);
      assert.equal(person?.name,original.name);
      assert.equal(person.slug,original.slug);
    }
    // Affiliated people remain one listing even when multiple schools teach them.
    assert.equal(db.prepare("SELECT count(*) AS n FROM provider_instructors WHERE instructor_id='catalog2-teacher-derek-fawcett'").get().n,2);
  }finally{db.close();}
});

test('reviewed second expansion matches its additive migration', () => {
  const sql=buildExpansionSql(catalog);
  assert.equal(sql,readFileSync(new URL('../migrations/0008_expand_voice_directory_to_200.sql',import.meta.url),'utf8'));
  assert.doesNotMatch(sql,/^\s*(?:DELETE|UPDATE|DROP|ALTER)\b/im);
  for(const statement of sql.split(';'))assert.ok(Buffer.byteLength(statement)<100000,'D1 statement size');
});

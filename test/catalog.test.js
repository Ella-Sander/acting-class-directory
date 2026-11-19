import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { expansion } from '../data/nyc-catalog-expansion.js';
import { buildExpansionSql } from '../scripts/generate-nyc-expansion.mjs';

test('NYC expansion adds 79 distinct professional listings, reaching 100 total', () => {
  assert.equal(expansion.teachers.length, 66);
  assert.equal(expansion.classes.length, 13);
  const entries = [...expansion.teachers, ...expansion.classes];
  assert.equal(expansion.previousTotal + entries.length, 100);
  for (const field of ['id','slug','name']) {
    const normalized = entries.map(entry => entry[field].normalize('NFKD').replace(/[\u0300-\u036f’'\s-]/g,'').toLowerCase());
    assert.equal(new Set(normalized).size, entries.length, `Duplicate ${field}`);
  }
  for (const entry of entries) {
    assert.equal(new URL(entry.source).protocol, 'https:');
    assert.ok(entry.description.length >= 30);
    assert.ok(expansion.locations.some(location => location.key === entry.location && location.city === 'New York'));
  }
});

test('catalog imports preserve unknown facts and qualify every published price', () => {
  for (const course of expansion.classes) {
    if (course.price !== null) {
      assert.ok(course.price > 0);
      assert.equal(course.priceBasis, 'full_course');
    }
  }
  for (const teacher of expansion.teachers) {
    assert.equal(teacher.image_url, undefined);
    assert.ok(Array.isArray(teacher.formats));
    if (teacher.sourceType === 'other') assert.equal(teacher.website, null);
  }
});

test('reviewed catalog matches the additive migration and does not overwrite existing data', () => {
  const generated = buildExpansionSql(expansion);
  const committed = readFileSync(new URL('../migrations/0007_expand_nyc_voice_directory.sql', import.meta.url), 'utf8');
  assert.equal(committed, generated);
  assert.doesNotMatch(generated, /^\s*(?:DELETE|UPDATE|DROP|ALTER)\b/im);
  assert.match(generated, /INSERT INTO research_sources/);
  assert.match(generated, /INSERT INTO field_evidence/);
});

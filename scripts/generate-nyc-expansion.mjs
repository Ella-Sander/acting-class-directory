import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expansion } from '../data/nyc-catalog-expansion.js';

export function buildExpansionSql(catalog) {
  const { providers, locations, teachers, classes, reviewedAt } = catalog;
  assert.equal(teachers.length + classes.length + catalog.previousTotal, catalog.expectedTotal);
  const items = [...teachers, ...classes];
  for (const field of ['id', 'slug']) assert.equal(new Set(items.map(item => item[field])).size, items.length, `Duplicate ${field}`);
  const providerMap = new Map(providers.map(p => [p.key, p]));
  const locationMap = new Map(locations.map(l => [l.key, l]));
  const teacherMap = new Map(teachers.map(t => [t.name, t]));
  const tables = new Map();
  const researchKeys = new Set();
  const q = value => value == null ? 'NULL' : typeof value === 'number' ? String(value) : `'${String(value).replaceAll("'", "''")}'`;
  function add(table, columns, values) {
    if (!tables.has(table)) tables.set(table, { columns, rows: [] });
    assert.deepEqual(tables.get(table).columns, columns);
    tables.get(table).rows.push(values);
  }
  function source(type, id, url, note, sourceType = 'official_website') {
    assert.equal(new URL(url).protocol, 'https:', `Non-HTTPS source for ${id}`);
    const key = JSON.stringify([type, id, url]);
    if (researchKeys.has(key)) return;
    researchKeys.add(key);
    add('research_sources', ['entity_type','entity_id','source_url','source_type','verification_status','checked_at','note'], [type,id,url,sourceType,'verified',reviewedAt,note]);
  }
  function proof(type, id, field, url, note) {
    add('field_evidence', ['entity_type','entity_id','field_name','verification_status','source_url','verified_at','note'], [type,id,field,'verified',url,reviewedAt,note]);
  }
  function linkLocation(table, ownerColumn, ownerId, key) {
    assert.ok(locationMap.has(key), `Unknown location ${key}`);
    add(table, [ownerColumn,'location_id'], [ownerId,locationMap.get(key).id]);
  }
  for (const location of locations) {
    add('locations', ['id','label','city','region','borough','neighborhood','postal_address','is_online'], [location.id,location.label,location.city,location.region,location.borough,location.neighborhood,location.address,Number(Boolean(location.online))]);
    proof('location',location.id,'location',location.source,'NYC school, professional studio or online delivery location. School addresses do not establish a teacher’s independent private studio.');
    source('location',location.id,location.source,'Public location source reviewed.');
  }
  for (const provider of providers) {
    add('providers', ['id','slug','listing_type','name','description','website_url','source_url','listing_status','origin','last_verified_at'], [provider.id,provider.slug,provider.type,provider.name,provider.description,provider.source,provider.source,'published','seeded',reviewedAt]);
    add('provider_locations', ['provider_id','location_id','is_primary'], [provider.id,locationMap.get(provider.location).id,1]);
    proof('provider',provider.id,'profile',provider.source,'Official school or studio voice program reviewed.');
    source('provider',provider.id,provider.source,'Official faculty roster or vocal program.');
  }
  for (const teacher of teachers) {
    add('instructors', ['id','slug','name','description','website_url','source_url','professional_title','profile_status','last_verified_at'], [teacher.id,teacher.slug,teacher.name,teacher.description,teacher.website,teacher.source,teacher.title,'published',reviewedAt]);
    if (teacher.provider) {
      assert.ok(providerMap.has(teacher.provider));
      add('provider_instructors', ['provider_id','instructor_id'], [providerMap.get(teacher.provider).id,teacher.id]);
    }
    linkLocation('instructor_locations','instructor_id',teacher.id,teacher.location);
    if (teacher.formats.includes('online')) linkLocation('instructor_locations','instructor_id',teacher.id,'online');
    for (const format of teacher.formats) {
      assert.ok(['online','in_person','hybrid'].includes(format));
      add('instructor_formats', ['instructor_id','format','verification_status','source_url','verified_at'], [teacher.id,format,'verified',teacher.formatSource || teacher.source,reviewedAt]);
    }
    for (const term of teacher.terms) add('instructor_terms', ['instructor_id','term_id','verification_status','source_url','verified_at'], [teacher.id,term,'verified',teacher.source,reviewedAt]);
    const note = teacher.sourceType === 'other'
      ? 'Professional association listing; personal website, current fees and availability are not independently confirmed.'
      : teacher.provider ? 'Official voice-faculty or studio roster. The listing describes school/studio instruction; private availability and unstated specialties or formats are not asserted.' : 'Official professional teaching page reviewed; unstated availability and fees remain unknown.';
    proof('instructor',teacher.id,'profile',teacher.source,note);
    proof('instructor',teacher.id,'location',teacher.locationSource || teacher.source,teacher.provider ? 'NYC school or studio affiliation; confirm the selected lesson venue with the organization.' : 'NYC teaching connection stated by the professional source.');
    source('instructor',teacher.id,teacher.source,note,teacher.sourceType);
    if (teacher.rosterSource) {
      source('instructor',teacher.id,teacher.rosterSource,'Current official departmental roster confirms the teaching role and institution.');
      proof('instructor',teacher.id,'affiliation',teacher.rosterSource,'Current official voice faculty or studio team; institutional study is not a claim of independently bookable lessons.');
    }
    if (teacher.locationSource) source('instructor',teacher.id,teacher.locationSource,'Additional NYC teaching-location evidence.');
    if (teacher.formatSource) source('instructor',teacher.id,teacher.formatSource,'Explicit teaching-format evidence.');
  }
  // One teacher, two documented affiliations: no second public coach listing.
  if (catalog.additionalAffiliations) {
    for (const affiliation of catalog.additionalAffiliations) {
      const provider = providerMap.get(affiliation.provider);
      assert.ok(provider, `Unknown affiliation provider ${affiliation.provider}`);
      add('provider_instructors', ['provider_id','instructor_id'], [provider.id,affiliation.teacherId]);
      source('instructor',affiliation.teacherId,affiliation.source,'Additional documented teaching affiliation; one person retains one public listing.');
      proof('instructor',affiliation.teacherId,`affiliation_${affiliation.provider}`,affiliation.source,'Additional current official school or studio voice-faculty affiliation.');
    }
  } else {
    add('provider_instructors', ['provider_id','instructor_id'], [providerMap.get('third').id,teacherMap.get('Konstantina Siokis').id]);
    source('instructor',teacherMap.get('Konstantina Siokis').id,providerMap.get('third').source,'Additional official Third Street voice-faculty affiliation.');
  }
  for (const course of classes) {
    assert.ok(providerMap.has(course.provider));
    assert.ok(course.price == null || course.priceBasis, `Unqualified price for ${course.id}`);
    add('offerings', ['id','slug','provider_id','name','description','registration_url','format','price_min','price_max','currency','price_basis','duration_minutes','session_count','schedule_text','audition_required','instruction_mode','source_url','listing_status','origin','last_verified_at'], [course.id,course.slug,providerMap.get(course.provider).id,course.name,course.description,course.source,course.format,course.price,course.price,course.price == null ? null : 'USD',course.priceBasis,course.minutes,course.sessions,course.schedule,course.audition == null ? null : Number(course.audition),'group',course.source,'published','seeded',reviewedAt]);
    linkLocation('offering_locations','offering_id',course.id,course.location);
    for (const term of course.terms) add('offering_terms', ['offering_id','term_id','verification_status','source_url','verified_at'], [course.id,term,'verified',course.source,reviewedAt]);
    for (const name of course.instructors) {
      assert.ok(teacherMap.has(name), `Unknown course teacher ${name}`);
      add('offering_instructors', ['offering_id','instructor_id'], [course.id,teacherMap.get(name).id]);
    }
    for (const id of course.existingInstructors || []) add('offering_instructors', ['offering_id','instructor_id'], [course.id,id]);
    proof('offering',course.id,'description',course.source,'Official class or ensemble catalog. Listing does not guarantee open seats; dates, placement, fees and current enrollment must be confirmed.');
    if (course.price != null) proof('offering',course.id,'price',course.source,'Published standard course/semester tuition. Not a private-lesson or hourly rate; registration/materials fees and discounts may differ.');
    if (course.format) proof('offering',course.id,'format',course.source,'Official program identifies an NYC in-person location. Other sections may have different delivery formats.');
    source('offering',course.id,course.source,'Official class details, published tuition basis and prerequisites reviewed.');
  }
  // Parents precede relationship/evidence tables even when rows were collected
  // together, so the migration remains valid with foreign-key checks enabled.
  const order = ['locations','providers','instructors','offerings','provider_locations','provider_instructors','instructor_locations','instructor_formats','instructor_terms','offering_locations','offering_instructors','offering_terms','field_evidence','research_sources'];
  const statements = [catalog.sqlHeader || `-- 79 additional source-backed NYC listings: 66 coaches and 13 group classes.\n-- Reviewed ${reviewedAt}; preserves all existing records.\n-- Generated from data/nyc-catalog-expansion.js. Do not rewrite after applying.\n`];
  for (const table of order) {
    if (!tables.has(table)) continue;
    const { columns, rows } = tables.get(table);
    for (let i = 0; i < rows.length; i += 60) {
      statements.push(`INSERT INTO ${table} (${columns.join(', ')}) VALUES\n${rows.slice(i,i+60).map(row => `  (${row.map(q).join(', ')})`).join(',\n')};`);
    }
  }
  return statements.join('\n\n') + '\n';
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = fileURLToPath(new URL('../migrations/0007_expand_nyc_voice_directory.sql', import.meta.url));
  writeFileSync(target, buildExpansionSql(expansion));
  console.log(`Generated 0007: ${expansion.teachers.length} coaches + ${expansion.classes.length} classes; expected directory total ${expansion.expectedTotal}.`);
}

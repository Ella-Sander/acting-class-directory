import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export function buildDialectSql(catalog) {
  assert.equal(new Set(catalog.coaches.map(coach => coach.slug)).size,catalog.coaches.length);
  const sql = [`-- ${catalog.coaches.length} source-backed dialect coaches, reviewed ${catalog.reviewedAt}.\n-- Additive expansion: existing profiles, courses and archived acting records remain unchanged.`];
  const q = value => value == null ? 'NULL' : typeof value === 'number' ? String(value) : `'${String(value).replaceAll("'", "''")}'`;
  const add = (table,row) => sql.push(`INSERT INTO ${table} (${Object.keys(row).join(',')}) VALUES (${Object.values(row).map(q).join(',')});`);
  const evidence = (type,id,field,url,note) => add('field_evidence',{entity_type:type,entity_id:id,field_name:field,verification_status:'verified',source_url:url,verified_at:catalog.reviewedAt,note});
  const research = (id,url,note) => add('research_sources',{entity_type:'instructor',entity_id:id,source_url:url,source_type:'official_website',verification_status:'verified',checked_at:catalog.reviewedAt,note});
  for (const coach of catalog.coaches) {
    assert.equal(new URL(coach.source).protocol,'https:');
    const id = `dialect-${coach.slug.replace(/-dialect-coach$/,'')}`;
    add('instructors',{id,slug:coach.slug,name:coach.name,description:coach.description,website_url:coach.source,source_url:coach.source,booking_url:coach.booking || coach.source,professional_title:'Dialect coach',profile_status:'published',last_verified_at:catalog.reviewedAt});
    evidence('instructor',id,'profile',coach.source,'Official professional coaching page reviewed. Verified means source-backed identity and services; no independent endorsement, availability guarantee or credential audit is implied.');
    research(id,coach.source,'Official coaching page confirms dialect/accent work. Contact the professional to confirm current availability and fees.');
    add('instructor_terms',{instructor_id:id,term_id:'specialty-dialect',verification_status:'verified',source_url:coach.serviceSource || coach.source,verified_at:catalog.reviewedAt});
    const otherSources = new Set([coach.locationSource,coach.formatSource,coach.serviceSource,coach.booking,coach.affiliation?.source].filter(url => url && url !== coach.source));
    for (const url of otherSources) research(id,url,'Additional official location, service, booking, delivery or faculty-affiliation evidence.');
    const location = (suffix,label,borough,isOnline,source) => {
      const locationId = `${id}-${suffix}`;
      add('locations',{id:locationId,label,city:isOnline ? null : 'New York',region:isOnline ? null : 'NY',country_code:isOnline ? '' : 'US',borough,is_online:isOnline ? 1 : 0});
      evidence('location',locationId,'location',source,isOnline ? 'Explicit remote coaching. Does not establish a physical NYC studio.' : 'Official NYC professional base or teaching connection. Exact lesson venue and in-person availability are not inferred.');
      add('instructor_locations',{instructor_id:id,location_id:locationId});
    };
    if (coach.location) location('nyc',coach.location === 'Manhattan' ? 'Manhattan, New York' : 'New York City',coach.location === 'Manhattan' ? 'Manhattan' : null,false,coach.locationSource || coach.source);
    if (coach.formats.includes('online')) location('online','Online',null,true,coach.formatSource || coach.source);
    for (const format of coach.formats) {
      assert.ok(['online','in_person'].includes(format));
      add('instructor_formats',{instructor_id:id,format,verification_status:'verified',source_url:coach.formatSource || coach.source,verified_at:catalog.reviewedAt});
    }
    if (coach.affiliation) {
      add('provider_instructors',{provider_id:coach.affiliation.id,instructor_id:id});
      evidence('instructor',id,'affiliation',coach.affiliation.source,'Official current faculty page. Affiliated school logo identifies the teaching relationship, not ownership of the coach.');
    }
  }
  return sql.join('\n')+'\n';
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const catalog = JSON.parse(readFileSync(new URL('../data/dialect-coaches.json',import.meta.url),'utf8'));
  writeFileSync(new URL('../migrations/0011_verified_dialect_coaches.sql',import.meta.url),buildDialectSql(catalog));
}

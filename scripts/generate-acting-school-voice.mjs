import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export function buildActingVoiceSql(catalog) {
  const sql = ['-- Acting-school vocal offerings reviewed 2026-11-13. Existing records are retained.'];
  const q = value => value == null ? 'NULL' : typeof value === 'number' ? String(value) : `'${String(value).replaceAll("'", "''")}'`;
  const add = (table, row) => sql.push(`INSERT INTO ${table} (${Object.keys(row).join(',')}) VALUES (${Object.values(row).map(q).join(',')});`);
  const date = catalog.reviewedAt;
  const evidence = (type, id, field, source, note) => add('field_evidence', {entity_type:type, entity_id:id, field_name:field, verification_status:'verified', source_url:source, verified_at:date, note});
  const research = (type, id, source, note) => add('research_sources', {entity_type:type, entity_id:id, source_url:source, source_type:'official_website', verification_status:'verified', checked_at:date, note});
  add('taxonomy_terms', {id:'training-voice-speech', taxonomy:'training_type', term:'Voice & speech for actors', slug:'voice-speech-for-actors'});
  for (const school of catalog.schools) {
    const locationId = `${school.id}-vocal-location`;
    const source = school.location.source || school.source;
    add('locations', {id:locationId,label:`${school.name}, Manhattan`,city:'New York',region:'NY',borough:'Manhattan',neighborhood:school.location.neighborhood,postal_address:school.location.address,is_online:0});
    evidence('location', locationId, 'location', source, 'Official school address; does not establish the delivery format of every section.');
    research('location', locationId, source, 'Official school address reviewed.');
    if (!school.existing) {
      add('providers', {id:school.id,slug:school.slug,listing_type:'school',name:school.name,description:school.description,website_url:school.source,source_url:school.source,listing_status:'published',origin:'seeded',last_verified_at:date});
      add('provider_locations', {provider_id:school.id,location_id:locationId,is_primary:1});
      evidence('provider',school.id,'profile',school.source,'Official vocal-training program reviewed.');
      research('provider',school.id,school.source,'Official school voice program.');
    }
  }
  for (const course of catalog.courses) {
    add('offerings', {id:course.id,slug:course.id,provider_id:course.provider,name:course.name,description:course.description,registration_url:course.source,source_url:course.source,format:course.format,price_min:course.price,price_max:course.price,currency:course.price == null ? null : 'USD',price_basis:course.price == null ? null : 'full_course',duration_minutes:course.minutes,session_count:course.sessions,interview_required:course.interview ? 1 : null,instruction_mode:'group',listing_status:'published',origin:'seeded',last_verified_at:date});
    add('offering_locations',{offering_id:course.id,location_id:`${course.provider}-vocal-location`});
    for (const term of course.terms) add('offering_terms',{offering_id:course.id,term_id:term,verification_status:'verified',source_url:course.source,verified_at:date});
    evidence('offering',course.id,'description',course.source,'Official vocal curriculum. Enrollment and future sections must be confirmed; conservatory study is not separately bookable.');
    if (course.price != null) evidence('offering',course.id,'price',course.source,'Published tuition for the referenced full course, not an hourly rate. Sections, additional fees and availability may change.');
    if (course.format) evidence('offering',course.id,'format',course.source,'Official listed section identifies in-person NYC instruction.');
    research('offering',course.id,course.source,'Official course details; unknown prices and formats are left blank.');
  }
  return sql.join('\n') + '\n';
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const catalog = JSON.parse(readFileSync(new URL('../data/acting-school-voice.json',import.meta.url),'utf8'));
  writeFileSync(new URL('../migrations/0010_acting_school_voice.sql',import.meta.url),buildActingVoiceSql(catalog));
}

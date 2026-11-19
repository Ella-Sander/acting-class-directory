import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import catalog from '../data/voice-speech-expansion.js';

export function buildVoiceSpeechSql(data) {
  const sql = [`-- 10 speech coaches and 7 spoken-voice classes. Reviewed ${data.reviewedAt}. Additive migration.`];
  const q = x => x == null ? 'NULL' : typeof x === 'number' ? String(x) : `'${String(x).replaceAll("'","''")}'`;
  const add = (table,row) => sql.push(`INSERT INTO ${table} (${Object.keys(row).join(',')}) VALUES (${Object.values(row).map(q).join(',')});`);
  const evidence = (type,id,field,url,note) => add('field_evidence',{entity_type:type,entity_id:id,field_name:field,verification_status:'verified',source_url:url,verified_at:data.reviewedAt,note});
  const source = (type,id,url) => add('research_sources',{entity_type:type,entity_id:id,source_url:url,source_type:'official_website',verification_status:'verified',checked_at:data.reviewedAt,note:'Official professional roster or course page reviewed; current scheduling and fees must be confirmed.'});
  for (const school of data.schools) {
    add('providers',{id:school.id,slug:school.slug,name:school.name,listing_type:'school',description:school.description,website_url:school.source,source_url:school.source,listing_status:'published',origin:'seeded',last_verified_at:data.reviewedAt});
    add('locations',{id:`${school.id}-location`,label:school.location,city:'New York',region:'NY',borough:school.borough,postal_address:school.address,is_online:0});
    add('provider_locations',{provider_id:school.id,location_id:`${school.id}-location`,is_primary:1});
    evidence('location',`${school.id}-location`,'location',school.source,'Official school location, not a private coach studio or guarantee of section format.');
    evidence('provider',school.id,'profile',school.source,'Official speech training organization.'); source('provider',school.id,school.source);
  }
  for (const coach of data.coaches) {
    add('instructors',{id:coach.id,slug:coach.slug,name:coach.name,description:coach.description,professional_title:'Speech coach',website_url:coach.source,source_url:coach.source,booking_url:coach.source,profile_status:'published',last_verified_at:data.reviewedAt});
    add('provider_instructors',{provider_id:coach.provider,instructor_id:coach.id});
    add('instructor_terms',{instructor_id:coach.id,term_id:'training-voice-speech',verification_status:'verified',source_url:coach.source,verified_at:data.reviewedAt});
    if (coach.online) {
      const id = `${coach.id}-online`;
      add('locations',{id,label:'Online',is_online:1});
      evidence('location',id,'location',coach.source,'Organization offers online sessions. No physical NYC studio is asserted for this individual.');
      add('instructor_locations',{instructor_id:coach.id,location_id:id});
      add('instructor_formats',{instructor_id:coach.id,format:'online',verification_status:'verified',source_url:coach.source,verified_at:data.reviewedAt});
    }
    evidence('instructor',coach.id,'profile',coach.source,'Named speech instructor on the current official team roster.');
    evidence('instructor',coach.id,'affiliation',coach.source,'Official New York Speech Coaching team; organization logo indicates affiliation.'); source('instructor',coach.id,coach.source);
  }
  for (const course of data.courses) {
    add('offerings',{id:course.id,slug:course.id,name:course.name,provider_id:course.provider,description:course.description,source_url:course.source,registration_url:course.source,format:course.format,price_min:course.price,price_max:course.price,currency:course.price == null ? null : 'USD',price_basis:course.price == null ? null : 'full_course',duration_minutes:course.minutes,session_count:course.sessions,instruction_mode:'group',listing_status:'published',origin:'seeded',last_verified_at:data.reviewedAt});
    add('offering_locations',{offering_id:course.id,location_id:course.provider==='voice-school-hb'?'voice-school-hb-vocal-location':`${course.provider}-location`});
    add('offering_terms',{offering_id:course.id,term_id:'training-voice-speech',verification_status:'verified',source_url:course.source,verified_at:data.reviewedAt});
    evidence('offering',course.id,'description',course.source,'Official spoken-voice course; prerequisites and enrollment restrictions retained in description.');
    if(course.price!=null) evidence('offering',course.id,'price',course.source,'Published full-course tuition, not an hourly rate; confirm section fees and availability.');
    if(course.format) evidence('offering',course.id,'format',course.source,'Official section lists in-person instruction at HB Studio.');
    source('offering',course.id,course.source);
  }
  return sql.join('\n')+'\n';
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) writeFileSync(new URL('../migrations/0012_voice_speech_expansion.sql',import.meta.url),buildVoiceSpeechSql(catalog));

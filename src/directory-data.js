import { withListingLogo } from './listing-logos.js';
const parseArray = value => {
  try { const parsed = JSON.parse(value || '[]'); return Array.isArray(parsed) ? parsed : []; }
  catch { return []; }
};

export const PROVIDERS_SQL = `SELECT p.*,
  (SELECT d.provider_id FROM provider_domains d WHERE d.domain=p.registrable_domain) AS domain_provider_id,
  (SELECT json_group_array(json_object('id',m.source_provider_id,'slug',m.source_slug)) FROM provider_merge_links m WHERE m.target_provider_id=p.id) AS aliases_json,
  EXISTS(SELECT 1 FROM field_evidence fe WHERE fe.entity_type='provider' AND fe.entity_id=p.id AND fe.field_name='description' AND fe.verification_status='verified' AND fe.source_url IS NOT NULL AND julianday(fe.verified_at) IS NOT NULL) AS description_verified,
  EXISTS(SELECT 1 FROM field_evidence fe WHERE fe.entity_type='provider' AND fe.entity_id=p.id AND fe.field_name='teaching_approach' AND fe.verification_status='verified' AND fe.source_url IS NOT NULL AND julianday(fe.verified_at) IS NOT NULL) AS teaching_approach_verified,
  EXISTS(SELECT 1 FROM field_evidence fe WHERE fe.entity_type='provider' AND fe.entity_id=p.id AND fe.field_name='official_website' AND fe.verification_status='verified' AND fe.source_url IS NOT NULL AND julianday(fe.verified_at) IS NOT NULL) AS official_website_verified,
  EXISTS(SELECT 1 FROM field_evidence fe WHERE fe.entity_type='provider' AND fe.entity_id=p.id AND fe.field_name='instagram_url' AND fe.verification_status='verified' AND fe.source_url IS NOT NULL AND julianday(fe.verified_at) IS NOT NULL) AS instagram_verified,
  (SELECT MAX(fe.verified_at) FROM field_evidence fe WHERE fe.entity_type = 'provider' AND fe.entity_id = p.id AND fe.verification_status = 'verified') AS last_verified,
  (SELECT json_group_array(json_object('label',v.label,'city',v.city,'region',v.region,'borough',v.borough,'neighborhood',v.neighborhood,'postal_address',v.postal_address,'is_online',v.is_online,'verified',v.verified))
    FROM (SELECT l.label,l.city,l.region,l.borough,l.neighborhood,l.postal_address,l.is_online,
            EXISTS(SELECT 1 FROM field_evidence fe WHERE fe.entity_type='location' AND fe.entity_id=l.id AND fe.verification_status='verified') AS verified
          FROM provider_locations pl JOIN locations l ON l.id=pl.location_id WHERE pl.provider_id=p.id
          UNION
          SELECT l.label,l.city,l.region,l.borough,l.neighborhood,l.postal_address,l.is_online,
            EXISTS(SELECT 1 FROM field_evidence fe WHERE fe.entity_type='location' AND fe.entity_id=l.id AND fe.verification_status='verified') AS verified
          FROM offerings o JOIN offering_locations ol ON ol.offering_id=o.id JOIN locations l ON l.id=ol.location_id
          WHERE o.provider_id=p.id AND o.listing_status='published') v) AS locations_json,
  (SELECT json_group_array(json_object('id',t.id,'taxonomy',t.taxonomy,'term',t.term,'slug',t.slug,'verification_status',t.verification_status,'source_url',t.source_url,'verified_at',t.verified_at))
    FROM (
      SELECT tt.id,tt.taxonomy,tt.term,tt.slug,pt.verification_status,pt.source_url,pt.verified_at
        FROM provider_terms pt JOIN taxonomy_terms tt ON tt.id=pt.term_id WHERE pt.provider_id=p.id
      UNION
      SELECT tt.id,tt.taxonomy,tt.term,tt.slug,it.verification_status,it.source_url,it.verified_at
        FROM provider_instructors pi JOIN instructor_terms it ON it.instructor_id=pi.instructor_id JOIN taxonomy_terms tt ON tt.id=it.term_id
        WHERE pi.provider_id=p.id
      UNION
      SELECT tt.id,tt.taxonomy,tt.term,tt.slug,ot.verification_status,ot.source_url,ot.verified_at
        FROM offerings o JOIN offering_terms ot ON ot.offering_id=o.id JOIN taxonomy_terms tt ON tt.id=ot.term_id
        WHERE o.provider_id=p.id AND o.listing_status='published'
    ) t) AS terms_json,
  (SELECT json_group_array(json_object('id',i.id,'slug',i.slug,'name',i.name,'professional_title',CASE WHEN EXISTS(SELECT 1 FROM field_evidence fe WHERE fe.entity_type='instructor' AND fe.entity_id=i.id AND fe.field_name='professional_title' AND fe.verification_status='verified' AND fe.source_url IS NOT NULL AND julianday(fe.verified_at) IS NOT NULL) THEN i.professional_title ELSE NULL END,'description',CASE WHEN EXISTS(SELECT 1 FROM field_evidence fe WHERE fe.entity_type='instructor' AND fe.entity_id=i.id AND fe.field_name='description' AND fe.verification_status='verified' AND fe.source_url IS NOT NULL AND julianday(fe.verified_at) IS NOT NULL) THEN i.description ELSE NULL END,'website_url',i.website_url))
    FROM provider_instructors pi JOIN instructors i ON i.id = pi.instructor_id WHERE pi.provider_id = p.id AND i.profile_status = 'published'
      AND EXISTS (SELECT 1 FROM field_evidence fe WHERE fe.entity_type='instructor' AND fe.entity_id=i.id AND fe.verification_status='verified'
        AND fe.source_url IS NOT NULL AND julianday(fe.verified_at) IS NOT NULL
        AND (fe.field_name LIKE 'affiliation%' OR (fe.field_name='profile' AND fe.note LIKE 'Official voice-faculty or studio roster.%'))
        AND lower(replace(substr(fe.source_url,instr(fe.source_url,'://')+3,instr(substr(fe.source_url,instr(fe.source_url,'://')+3)||'/', '/')-1),'www.',''))
          = lower(replace(substr(p.website_url,instr(p.website_url,'://')+3,instr(substr(p.website_url,instr(p.website_url,'://')+3)||'/', '/')-1),'www.','')))) AS instructors_json,
  (SELECT json_group_array(json_object('id',o.id,'slug',o.slug,'name',o.name,'description',o.description,'descriptionVerified',EXISTS(SELECT 1 FROM field_evidence fe WHERE fe.entity_type='offering' AND fe.entity_id=o.id AND fe.field_name='description' AND fe.verification_status='verified' AND fe.source_url IS NOT NULL AND julianday(fe.verified_at) IS NOT NULL),'origin',o.origin,'genre_specialty',o.genre_specialty,'provider_id',o.provider_id,'price_min',o.price_min,'price_max',o.price_max,'currency',o.currency,'price_basis',o.price_basis,'format',o.format,'instruction_mode',o.instruction_mode,'registration_url',o.registration_url,'registrationVerified',EXISTS(SELECT 1 FROM field_evidence fe WHERE fe.entity_type='offering' AND fe.entity_id=o.id AND fe.field_name='registration_url' AND fe.verification_status='verified' AND fe.source_url IS NOT NULL AND julianday(fe.verified_at) IS NOT NULL),'enrollment_url',o.enrollment_url,'source_url',o.source_url,'officialWebsiteVerified',EXISTS(SELECT 1 FROM field_evidence fe WHERE fe.entity_type='offering' AND fe.entity_id=o.id AND fe.field_name='official_website' AND fe.verification_status='verified' AND fe.source_url IS NOT NULL AND julianday(fe.verified_at) IS NOT NULL),'schedule_text',o.schedule_text,'scheduleVerified',EXISTS(SELECT 1 FROM field_evidence fe WHERE fe.entity_type='offering' AND fe.entity_id=o.id AND fe.field_name='schedule_text' AND fe.verification_status='verified' AND fe.source_url IS NOT NULL AND julianday(fe.verified_at) IS NOT NULL),'skill_level',o.skill_level,'terms', (SELECT json_group_array(json_object('id',tt.id,'taxonomy',tt.taxonomy,'term',tt.term,'slug',tt.slug,'verification_status',ot.verification_status,'source_url',ot.source_url,'verified_at',ot.verified_at)) FROM offering_terms ot JOIN taxonomy_terms tt ON tt.id=ot.term_id WHERE ot.offering_id=o.id),'workshopVerified',(EXISTS(SELECT 1 FROM field_evidence fe WHERE fe.entity_type='offering' AND fe.entity_id=o.id AND fe.field_name='lesson_format_workshop' AND fe.verification_status='verified' AND fe.source_url IS NOT NULL AND julianday(fe.verified_at) IS NOT NULL) OR EXISTS(SELECT 1 FROM offering_terms ot JOIN taxonomy_terms tt ON tt.id=ot.term_id WHERE ot.offering_id=o.id AND tt.slug='workshops-and-intensives' AND ot.verification_status='verified' AND ot.source_url IS NOT NULL AND julianday(ot.verified_at) IS NOT NULL)),'instructionModeVerified',EXISTS(SELECT 1 FROM field_evidence fe WHERE fe.entity_type = \'offering\' AND fe.entity_id = o.id AND fe.field_name = \'instruction_mode\' AND fe.verification_status = \'verified\' AND fe.source_url IS NOT NULL AND julianday(fe.verified_at) IS NOT NULL),'formatVerified',EXISTS(SELECT 1 FROM field_evidence fe WHERE fe.entity_type = \'offering\' AND fe.entity_id = o.id AND fe.field_name = \'format\' AND fe.verification_status = \'verified\'),'priceVerified',EXISTS(SELECT 1 FROM field_evidence fe WHERE fe.entity_type = \'offering\' AND fe.entity_id = o.id AND fe.field_name = \'price\' AND fe.verification_status = \'verified\')))
    FROM offerings o WHERE o.provider_id = p.id AND o.listing_status = 'published') AS offerings_json
  FROM providers p WHERE p.listing_status = 'published' ORDER BY p.name COLLATE NOCASE`;

export const OFFERINGS_SQL = `SELECT o.*, p.name AS provider_name, p.slug AS provider_slug, p.listing_type AS provider_listing_type,
  (SELECT MAX(fe.verified_at) FROM field_evidence fe WHERE fe.entity_type = 'offering' AND fe.entity_id = o.id AND fe.verification_status = 'verified') AS last_verified,
  EXISTS(SELECT 1 FROM field_evidence fe WHERE fe.entity_type='offering' AND fe.entity_id=o.id AND fe.field_name='description' AND fe.verification_status='verified' AND fe.source_url IS NOT NULL AND julianday(fe.verified_at) IS NOT NULL) AS description_verified,
  EXISTS(SELECT 1 FROM field_evidence fe WHERE fe.entity_type='offering' AND fe.entity_id=o.id AND fe.field_name='registration_url' AND fe.verification_status='verified' AND fe.source_url IS NOT NULL AND julianday(fe.verified_at) IS NOT NULL) AS registration_verified,
  EXISTS(SELECT 1 FROM field_evidence fe WHERE fe.entity_type='offering' AND fe.entity_id=o.id AND fe.field_name='schedule_text' AND fe.verification_status='verified' AND fe.source_url IS NOT NULL AND julianday(fe.verified_at) IS NOT NULL) AS schedule_verified,
  EXISTS(SELECT 1 FROM field_evidence fe WHERE fe.entity_type='offering' AND fe.entity_id=o.id AND fe.field_name='official_website' AND fe.verification_status='verified' AND fe.source_url IS NOT NULL AND julianday(fe.verified_at) IS NOT NULL) AS official_website_verified,
  (SELECT json_group_array(json_object('label',l.label,'city',l.city,'region',l.region,'borough',l.borough,'neighborhood',l.neighborhood,'postal_address',l.postal_address,'is_online',l.is_online,'verified',EXISTS(SELECT 1 FROM field_evidence fe WHERE fe.entity_type = \'location\' AND fe.entity_id = l.id AND fe.verification_status = \'verified\')))
    FROM offering_locations ol JOIN locations l ON l.id = ol.location_id WHERE ol.offering_id = o.id) AS locations_json,
  (SELECT json_group_array(json_object('id',tt.id,'taxonomy',tt.taxonomy,'term',tt.term,'slug',tt.slug,'verification_status',ot.verification_status,'source_url',ot.source_url,'verified_at',ot.verified_at))
    FROM offering_terms ot JOIN taxonomy_terms tt ON tt.id = ot.term_id WHERE ot.offering_id = o.id) AS terms_json,
  (SELECT json_group_array(json_object('id',i.id,'name',i.name,'description',CASE WHEN EXISTS(SELECT 1 FROM field_evidence fe WHERE fe.entity_type='instructor' AND fe.entity_id=i.id AND fe.field_name='description' AND fe.verification_status='verified' AND fe.source_url IS NOT NULL AND julianday(fe.verified_at) IS NOT NULL) THEN i.description ELSE NULL END,'website_url',i.website_url))
    FROM offering_instructors oi JOIN instructors i ON i.id = oi.instructor_id WHERE oi.offering_id = o.id AND i.profile_status = 'published') AS instructors_json,
  (EXISTS(SELECT 1 FROM field_evidence fe WHERE fe.entity_type='offering' AND fe.entity_id=o.id AND fe.field_name='lesson_format_workshop' AND fe.verification_status='verified' AND fe.source_url IS NOT NULL AND julianday(fe.verified_at) IS NOT NULL) OR EXISTS(SELECT 1 FROM offering_terms ot JOIN taxonomy_terms tt ON tt.id=ot.term_id WHERE ot.offering_id=o.id AND tt.slug='workshops-and-intensives' AND ot.verification_status='verified' AND ot.source_url IS NOT NULL AND julianday(ot.verified_at) IS NOT NULL)) AS workshop_verified,
  EXISTS(SELECT 1 FROM field_evidence fe WHERE fe.entity_type = 'offering' AND fe.entity_id = o.id AND fe.field_name = 'instruction_mode' AND fe.verification_status = 'verified' AND fe.source_url IS NOT NULL AND julianday(fe.verified_at) IS NOT NULL) AS instruction_mode_verified,
  EXISTS(SELECT 1 FROM field_evidence fe WHERE fe.entity_type = 'offering' AND fe.entity_id = o.id AND fe.field_name = 'price' AND fe.verification_status = 'verified') AS price_verified,
  EXISTS(SELECT 1 FROM field_evidence fe WHERE fe.entity_type = 'offering' AND fe.entity_id = o.id AND fe.field_name = 'format' AND fe.verification_status = 'verified') AS format_verified
  FROM offerings o LEFT JOIN providers p ON p.id = o.provider_id AND p.listing_status='published'
  WHERE o.listing_status = 'published' ORDER BY o.name COLLATE NOCASE`;

export const TEACHERS_SQL = `SELECT i.*,
  (SELECT json_group_array(json_object('field_name',fe.field_name,'is_affiliation_roster',CASE WHEN fe.field_name='profile' AND fe.note LIKE 'Official voice-faculty or studio roster.%' THEN 1 ELSE 0 END,'verification_status',fe.verification_status,'source_url',fe.source_url,'verified_at',fe.verified_at)) FROM field_evidence fe WHERE fe.entity_type='instructor' AND fe.entity_id=i.id AND fe.verification_status='verified' AND (fe.field_name IN ('profile','teacher_type','availability_status','instruction_mode','booking_url','description','biography','teaching_experience','professional_title','official_website','instagram_url') OR fe.field_name LIKE 'affiliation%' OR fe.field_name LIKE 'lesson_format_%')) AS fact_evidence_json,
  (SELECT MAX(fe.verified_at) FROM field_evidence fe WHERE fe.entity_type = 'instructor' AND fe.entity_id = i.id AND fe.verification_status = 'verified') AS last_verified,
  (SELECT json_group_array(json_object('id',p.id,'name',p.name,'website_url',p.website_url,'source_url',p.source_url) ORDER BY p.listing_type, p.rowid)
    FROM provider_instructors pi JOIN providers p ON p.id = pi.provider_id
    WHERE pi.instructor_id = i.id AND p.listing_status = 'published' AND p.listing_type != 'coach') AS affiliations_json,
  (SELECT json_group_array(json_object('id',o.id,'slug',o.slug,'name',o.name,'description',o.description,'descriptionVerified',EXISTS(SELECT 1 FROM field_evidence fe WHERE fe.entity_type='offering' AND fe.entity_id=o.id AND fe.field_name='description' AND fe.verification_status='verified' AND fe.source_url IS NOT NULL AND julianday(fe.verified_at) IS NOT NULL),'origin',o.origin,
      'provider_id',o.provider_id,'provider_name',p.name,'registration_url',o.registration_url,'registrationVerified',EXISTS(SELECT 1 FROM field_evidence fe WHERE fe.entity_type='offering' AND fe.entity_id=o.id AND fe.field_name='registration_url' AND fe.verification_status='verified' AND fe.source_url IS NOT NULL AND julianday(fe.verified_at) IS NOT NULL),'enrollment_url',o.enrollment_url,
      'source_url',o.source_url,'format',o.format,'price_min',o.price_min,'price_max',o.price_max,'currency',o.currency,
      'price_basis',o.price_basis,'schedule_text',o.schedule_text,'scheduleVerified',EXISTS(SELECT 1 FROM field_evidence fe WHERE fe.entity_type='offering' AND fe.entity_id=o.id AND fe.field_name='schedule_text' AND fe.verification_status='verified' AND fe.source_url IS NOT NULL AND julianday(fe.verified_at) IS NOT NULL),'skill_level',o.skill_level,'instruction_mode',o.instruction_mode,
      'duration_minutes',o.duration_minutes,'session_count',o.session_count,
      'workshopVerified',(EXISTS(SELECT 1 FROM field_evidence fe WHERE fe.entity_type='offering' AND fe.entity_id=o.id AND fe.field_name='lesson_format_workshop' AND fe.verification_status='verified' AND fe.source_url IS NOT NULL AND julianday(fe.verified_at) IS NOT NULL) OR EXISTS(SELECT 1 FROM offering_terms ot JOIN taxonomy_terms tt ON tt.id=ot.term_id WHERE ot.offering_id=o.id AND tt.slug='workshops-and-intensives' AND ot.verification_status='verified' AND ot.source_url IS NOT NULL AND julianday(ot.verified_at) IS NOT NULL)),'instructionModeVerified',EXISTS(SELECT 1 FROM field_evidence fe WHERE fe.entity_type='offering' AND fe.entity_id=o.id AND fe.field_name='instruction_mode' AND fe.verification_status='verified' AND fe.source_url IS NOT NULL AND julianday(fe.verified_at) IS NOT NULL),
      'priceVerified',EXISTS(SELECT 1 FROM field_evidence fe WHERE fe.entity_type='offering' AND fe.entity_id=o.id AND fe.field_name='price' AND fe.verification_status='verified'),
      'formatVerified',EXISTS(SELECT 1 FROM field_evidence fe WHERE fe.entity_type='offering' AND fe.entity_id=o.id AND fe.field_name='format' AND fe.verification_status='verified')) ORDER BY o.provider_id, o.rowid)
    FROM offering_instructors oi JOIN offerings o ON o.id = oi.offering_id
    LEFT JOIN providers p ON p.id = o.provider_id AND p.listing_status='published'
    WHERE oi.instructor_id = i.id AND o.listing_status = 'published') AS offerings_json,
  (SELECT json_group_array(json_object('id',tt.id,'taxonomy',tt.taxonomy,'term',tt.term,'slug',tt.slug,
      'verification_status',it.verification_status,'source_url',it.source_url,'verified_at',it.verified_at))
    FROM instructor_terms it JOIN taxonomy_terms tt ON tt.id = it.term_id WHERE it.instructor_id = i.id) AS terms_json,
  (SELECT json_group_array(json_object('format',ifm.format,'verification_status',ifm.verification_status,'source_url',ifm.source_url,'verified_at',ifm.verified_at))
    FROM instructor_formats ifm WHERE ifm.instructor_id = i.id) AS formats_json,
  (SELECT json_group_array(json_object('label',l.label,'city',l.city,'region',l.region,'borough',l.borough,'neighborhood',l.neighborhood,
      'postal_address',l.postal_address,'is_online',l.is_online,
      'verified',EXISTS(SELECT 1 FROM field_evidence fe WHERE fe.entity_type='location' AND fe.entity_id=l.id AND fe.verification_status='verified')))
    FROM instructor_locations il JOIN locations l ON l.id = il.location_id WHERE il.instructor_id = i.id) AS locations_json,
  EXISTS(SELECT 1 FROM field_evidence fe WHERE fe.entity_type='instructor' AND fe.entity_id=i.id AND fe.field_name='submission_origin') AS submitted_profile
  FROM instructors i WHERE i.profile_status='published' ORDER BY i.name COLLATE NOCASE`;

function normalizeProvider(row) {
  const instructors = parseArray(row.instructors_json);
  const offerings = parseArray(row.offerings_json).map(offering => ({ ...offering, terms: parseArray(offering.terms) }));
  const termsByKey = new Map();
  for (const term of [...parseArray(row.terms_json), ...offerings.flatMap(offering => offering.terms)]) {
    const key = `${term.taxonomy}:${term.slug}`;
    const prior = termsByKey.get(key);
    if (!prior || term.verification_status === 'verified') termsByKey.set(key, term);
  }
  const submitted = row.origin === 'submitted';
  return {
    ...Object.fromEntries(Object.entries(row).filter(([key]) => !key.endsWith('_json'))),
    aliases: parseArray(row.aliases_json),
    description: submitted && !row.description_verified ? null : row.description,
    teaching_approach: submitted && !row.teaching_approach_verified ? null : row.teaching_approach,
    website_url: submitted && !row.official_website_verified ? null : row.website_url,
    source_url: submitted && !row.official_website_verified ? null : row.source_url,
    instagram_url: submitted && !row.instagram_verified ? null : row.instagram_url,
    locations: parseArray(row.locations_json), terms: [...termsByKey.values()],
    instructors, offerings: offerings.map(offering => ({
      ...offering,
      description: offering.origin === 'submitted' && !offering.descriptionVerified ? null : offering.description,
      registration_url: offering.origin === 'submitted' && !offering.registrationVerified ? null : offering.registration_url,
      schedule_text: offering.origin === 'submitted' && !offering.scheduleVerified ? null : offering.schedule_text,
      source_url: offering.origin === 'submitted' && !offering.officialWebsiteVerified ? null : offering.source_url,
    })),
  };
}

function normalizeOffering(row) {
  const submitted = row.origin === 'submitted';
  return {
    ...Object.fromEntries(Object.entries(row).filter(([key]) => !key.endsWith('_json'))),
    description: submitted && !row.description_verified ? null : row.description,
    registration_url: submitted && !row.registration_verified ? null : row.registration_url,
    schedule_text: submitted && !row.schedule_verified ? null : row.schedule_text,
    source_url: submitted && !row.official_website_verified ? null : row.source_url,
    workshopVerified: Boolean(row.workshop_verified), instructionModeVerified: Boolean(row.instruction_mode_verified), priceVerified: Boolean(row.price_verified), formatVerified: Boolean(row.format_verified),
    locations: parseArray(row.locations_json), terms: parseArray(row.terms_json), instructors: parseArray(row.instructors_json),
  };
}

function normalizeTeacher(row) {
  const factEvidence = parseArray(row.fact_evidence_json);
  const hasVerifiedFact = field => factEvidence.some(evidence => evidence.field_name === field && evidence.verification_status === 'verified' && evidence.source_url && Number.isFinite(Date.parse(evidence.verified_at)));
  const submitted = Boolean(row.submitted_profile);
  return {
    ...Object.fromEntries(Object.entries(row).filter(([key]) => !key.endsWith('_json') && key !== 'submitted_profile')), kind: 'teacher',
    description: submitted && !hasVerifiedFact('description') ? null : row.description,
    biography: submitted && !hasVerifiedFact('biography') ? null : row.biography,
    teaching_experience: submitted && !hasVerifiedFact('teaching_experience') ? null : row.teaching_experience,
    professional_title: submitted && !hasVerifiedFact('professional_title') ? null : row.professional_title,
    instagram_url: submitted && !hasVerifiedFact('instagram_url') ? null : row.instagram_url,
    booking_url: submitted && !hasVerifiedFact('booking_url') ? null : row.booking_url,
    website_url: submitted && !hasVerifiedFact('official_website') ? null : row.website_url,
    source_url: submitted && !hasVerifiedFact('official_website') ? null : row.source_url,
    fact_evidence: factEvidence, affiliations: parseArray(row.affiliations_json), offerings: parseArray(row.offerings_json).map(offering => ({
      ...offering,
      description: offering.origin === 'submitted' && !offering.descriptionVerified ? null : offering.description,
      registration_url: offering.origin === 'submitted' && !offering.registrationVerified ? null : offering.registration_url,
      schedule_text: offering.origin === 'submitted' && !offering.scheduleVerified ? null : offering.schedule_text,
      source_url: offering.origin === 'submitted' && !offering.officialWebsiteVerified ? null : offering.source_url,
    })),
    terms: parseArray(row.terms_json), formats: parseArray(row.formats_json), locations: parseArray(row.locations_json),
  };
}


export const DIRECTORY_QUERIES = { providers: PROVIDERS_SQL, offerings: OFFERINGS_SQL, teachers: TEACHERS_SQL };

const collections = {
  providers: { alias: 'p', status: 'listing_status', kind: 'provider', normalize: normalizeProvider },
  offerings: { alias: 'o', status: 'listing_status', kind: 'offering', normalize: normalizeOffering },
  teachers: { alias: 'i', status: 'profile_status', kind: 'teacher', normalize: normalizeTeacher },
};

export function listingQuery(collection) {
  const spec = collections[collection];
  if (!spec) throw new Error('Unknown public collection.');
  return DIRECTORY_QUERIES[collection].replace(`${spec.alias}.${spec.status}='published' ORDER BY`, `${spec.alias}.${spec.status}='published' AND ${spec.alias}.slug = ? ORDER BY`)
    .replace(`${spec.alias}.${spec.status} = 'published' ORDER BY`, `${spec.alias}.${spec.status} = 'published' AND ${spec.alias}.slug = ? ORDER BY`);
}

async function measured(env, name, sql, params, stats) {
  const start = performance.now();
  if (stats) stats.queries = (stats.queries || 0) + 1;
  let result;
  try { result = await env.DIRECTORY_DB.prepare(sql).bind(...params).all(); }
  catch (error) {
    console.error('d1-query', JSON.stringify({ query: name, rows_read: null, duration_ms: null, elapsed_ms: performance.now() - start, error: String(error?.message || error).slice(0, 500) }));
    throw error;
  }
  if (result.success === false) throw new Error('D1 query did not succeed.');
  const metric = { query: name, rows_read: result.meta?.rows_read ?? null, duration_ms: result.meta?.duration ?? null, elapsed_ms: performance.now() - start };
  if (stats) stats.rowsRead = (stats.rowsRead || 0) + (metric.rows_read || 0);
  if (metric.rows_read !== null) console.info('d1-query', JSON.stringify(metric));
  return result.results || [];
}

export async function queryDirectory(env, stats, queries = DIRECTORY_QUERIES) {
  if (!env.DIRECTORY_DB) throw new Error('Directory database binding is missing.');
  const pairs = await Promise.all(Object.entries(queries).map(async ([name, sql]) => {
    const spec = collections[name];
    const rows = await measured(env, name, sql, [], stats);
    return [name, rows.map(spec.normalize).map(item => withListingLogo(item, spec.kind))];
  }));
  return publicProviderIdentities(Object.fromEntries(pairs));
}

// Public grouping is a reversible projection, not a destructive data merge.
// Conflicting approved text stays in D1 for explicit editorial resolution;
// complementary public relationships are available on the canonical listing.
export function publicProviderIdentities(directory) {
  const byId=new Map(directory.providers.map(provider=>[provider.id,provider]));
  const firstByDomain=new Map();for(const provider of directory.providers)if(provider.registrable_domain&&!firstByDomain.has(provider.registrable_domain))firstByDomain.set(provider.registrable_domain,provider);
  const canonical=new Map();
  for(const provider of directory.providers) {
    const target=byId.get(provider.domain_provider_id) || firstByDomain.get(provider.registrable_domain);
    canonical.set(provider.id,target && target.registrable_domain===provider.registrable_domain ? target.id : provider.id);
  }
  const groups=new Map();
  const unique=(items,key)=>[...new Map(items.map(item=>[key(item),item])).values()];
  for(const provider of directory.providers) {
    const targetId=canonical.get(provider.id);
    if(!groups.has(targetId))groups.set(targetId,[]);
    groups.get(targetId).push(provider);
  }
  const remapOffering=offering=>{
    const target=byId.get(canonical.get(offering.provider_id));
    return target?{...offering,provider_id:target.id,...('provider_name' in offering?{provider_name:target.name,provider_slug:target.slug,provider_listing_type:target.listing_type}:{} )}:offering;
  };
  const providers=[...groups].map(([id,members])=>{
    const target=byId.get(id);
    if(members.length===1)return target;
    const ordered=[...members.filter(member=>member.id!==id),target];
    return {...target,
      logo:target.logo || members.map(member=>member.logo).find(Boolean) || null,
      aliases:unique([...members.flatMap(member=>member.aliases || []),...members.filter(member=>member.id!==id).map(member=>({id:member.id,slug:member.slug}))],item=>item.id),
      terms:unique(ordered.flatMap(member=>member.terms),item=>`${item.taxonomy}:${item.slug}:${item.verification_status}`),
      locations:unique(ordered.flatMap(member=>member.locations),item=>JSON.stringify(item)),
      instructors:unique(ordered.flatMap(member=>member.instructors),item=>item.id),
      offerings:unique(ordered.flatMap(member=>member.offerings).map(remapOffering),item=>item.id),
    };
  });
  return {...directory,providers,offerings:directory.offerings.map(remapOffering),teachers:directory.teachers.map(teacher=>({...teacher,
    affiliations:unique(teacher.affiliations.map(affiliation=>{const target=byId.get(canonical.get(affiliation.id));return target?{...affiliation,id:target.id,name:target.name,website_url:target.website_url,source_url:target.source_url}:affiliation;}),item=>item.id),
    offerings:teacher.offerings.map(remapOffering),
  }))};
}

export async function queryListing(env, collection, slug, stats) {
  const spec = collections[collection];
  const rows = await measured(env, `${collection}.profile`, listingQuery(collection), [slug], stats);
  return rows[0] ? { ...withListingLogo(spec.normalize(rows[0]), spec.kind), kind: spec.kind } : null;
}


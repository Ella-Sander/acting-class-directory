import { MERGE_FIELDS, mergeFields, providerDomain, findDomainProvider, registerDomain } from './provider-identity.js';

export const relatedTables = {
  offerings: 'provider_id', provider_locations: 'provider_id', provider_instructors: 'provider_id',
  provider_terms: 'provider_id', provider_site_urls: 'provider_id', claims: 'provider_id',
  provider_update_suggestions: 'provider_id', submissions: 'duplicate_of_provider_id',
};
export const SERVICE_FIELDS=['description','registration_url','format','price_min','price_max','currency','price_basis','schedule_text','instruction_mode','source_url'];
const version = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)))),byte=>byte.toString(16).padStart(2,'0')).join('');
export async function mergeProposal(env, submissionId, targetId = '') {
  const submission = await env.DIRECTORY_DB.prepare(`SELECT * FROM submissions WHERE id=? AND status='pending'`).bind(submissionId).first();
  if (!submission) throw new Error('Pending submission not found.');
  const payload = JSON.parse(submission.payload_json);
  if (!['provider','teacher','domain_merge'].includes(payload.type || submission.submission_type)) throw new Error('This submission cannot merge a provider.');
  const source = payload.type === 'domain_merge' ? await env.DIRECTORY_DB.prepare(`SELECT * FROM providers WHERE id=? AND listing_status='published'`).bind(payload.source_provider_id).first() : null;
  if (payload.type === 'domain_merge' && !source) throw new Error('Source is no longer published. Reload the queue.');
  const incoming = source || { ...payload, ...(payload.type === 'teacher' ? { listing_type: 'coach', description: [payload.professional_title,payload.description,payload.biography,payload.teaching_experience].filter(Boolean).join('\n\n') } : {}) };
  // Public submissions cannot grant ownership or image permissions through a
  // provider merge. Those protected values only come from approved records.
  if(!source)for(const field of ['claim_status','image_permission_status','image_permission_url','image_attribution','featured_image_url','image_source_url','image_alt'])delete incoming[field];
  const canonical = await findDomainProvider(env, incoming.website_url);
  const target = targetId ? await env.DIRECTORY_DB.prepare(`SELECT * FROM providers WHERE id=? AND listing_status='published'`).bind(targetId).first() : canonical;
  if (!target || target.id === source?.id) throw new Error('Choose an existing provider on this domain.');
  const domain = providerDomain(incoming.website_url);
  if (!domain || domain !== providerDomain(target.website_url) || (canonical && canonical.id !== target.id)) throw new Error('The merge target must be the canonical provider for this registrable domain.');
  if (source && await env.DIRECTORY_DB.prepare(`SELECT 1 FROM provider_merge_links WHERE target_provider_id=? LIMIT 1`).bind(source.id).first()) throw new Error('Merge this provider into its canonical target before merging another group.');
  const { fields, conflicts } = mergeFields(target, incoming);
  let service=null;
  if(!source && payload.offering_name) {
    const existing=await env.DIRECTORY_DB.prepare(`SELECT * FROM offerings WHERE provider_id=? AND lower(trim(name))=lower(trim(?)) AND listing_status='published' ORDER BY id LIMIT 1`).bind(target.id,payload.offering_name).first();
    if(existing) {
      const serviceIncoming={description:payload.offering_description,registration_url:payload.booking_url||payload.registration_url,format:payload.format,instruction_mode:payload.instruction_mode,schedule_text:payload.schedule_text,price_min:payload.price_min==null||payload.price_min===''?null:Number(payload.price_min),price_max:payload.price_max==null||payload.price_max===''?null:Number(payload.price_max),currency:payload.price_min==null||payload.price_min===''?null:'USD',price_basis:payload.price_basis,source_url:payload.website_url};
      service={existing,incoming:serviceIncoming,...mergeFields(existing,serviceIncoming,{},SERVICE_FIELDS),version:await version(existing)};
    }
  }
  let existingInstructor=null;
  if(!source && payload.type==='teacher') {
    const candidates=(await env.DIRECTORY_DB.prepare(`SELECT * FROM instructors WHERE lower(name)=lower(?) AND profile_status='published'`).bind(payload.name).all()).results;
    existingInstructor=candidates.find(instructor=>providerDomain(instructor.website_url)===domain) || null;
  }
  return { submission, payload, target, source, incoming, domain, fields, conflicts, service, existingInstructor, expected_revision: target.merge_revision, source_revision: source?.merge_revision ?? null };
}

export async function buildMerge(env, proposal, body) {
  const { target, source, incoming, domain, submission } = proposal;
  if (body.expected_revision !== target.merge_revision || (source && body.source_revision !== source.merge_revision)) throw new Error('The listing changed. Reload and review the latest values.');
  const { fields, conflicts } = mergeFields(target, incoming, body.resolutions || {});
  if (conflicts.length) throw new Error(`Choose a resolution for: ${conflicts.join(', ')}`);
  if (!fields.name || !['studio','school','coach'].includes(fields.listing_type) || !['independent_teacher','institution','studio_business','unconfirmed'].includes(fields.provider_classification) || !['unclaimed','pending','claimed'].includes(fields.claim_status)) throw new Error('Invalid provider classification, type, name or claim status.');
  for (const field of ['website_url','instagram_url','featured_image_url','image_source_url','source_url','image_permission_url']) {
    if (fields[field]) { const url = new URL(fields[field]); if (!['https:','http:'].includes(url.protocol) || url.username || url.password) throw new Error(`Invalid ${field}.`); }
  }
  if (providerDomain(fields.website_url) !== domain) throw new Error('The selected website must remain on the merged domain.');
  const before = { target, source, service:proposal.service?.existing || null, existingInstructor:proposal.existingInstructor || null, relations: {} };
  if(proposal.service) {
    before.serviceEvidence=(await env.DIRECTORY_DB.prepare(`SELECT * FROM field_evidence WHERE entity_type='offering' AND entity_id=?`).bind(proposal.service.existing.id).all()).results;
    before.serviceInstructors=(await env.DIRECTORY_DB.prepare(`SELECT * FROM offering_instructors WHERE offering_id=?`).bind(proposal.service.existing.id).all()).results;
  }
  if(source) {
    before.redirect=await env.DIRECTORY_DB.prepare(`SELECT * FROM provider_url_redirects WHERE source_path=?`).bind(`/providers/${source.slug}/`).first();
    before.domains=(await env.DIRECTORY_DB.prepare(`SELECT * FROM provider_domains WHERE provider_id IN (?,?)`).bind(target.id,source.id).all()).results;
  }
  {
    const tables = Object.entries(relatedTables);
    const results = await env.DIRECTORY_DB.batch(tables.map(([table, column]) => env.DIRECTORY_DB.prepare(`SELECT * FROM ${table} WHERE ${column} IN (?,?)`).bind(target.id, source?.id || target.id)));
    tables.forEach(([table], index) => { before.relations[table] = results[index].results || []; });
    for (const table of ['field_evidence','research_sources']) before.relations[table] = (await env.DIRECTORY_DB.prepare(`SELECT * FROM ${table} WHERE entity_type='provider' AND entity_id IN (?,?)`).bind(target.id, source?.id || target.id).all()).results;
  }
  const eventId = crypto.randomUUID(); const guardId = crypto.randomUUID();
  const statements = [env.DIRECTORY_DB.prepare(`INSERT INTO provider_merge_guards(id,valid) SELECT ?,CASE WHEN EXISTS(SELECT 1 FROM submissions WHERE id=? AND status='pending') AND EXISTS(SELECT 1 FROM providers WHERE id=? AND merge_revision=? AND listing_status='published') THEN 1 ELSE 0 END`).bind(guardId, submission.id, target.id, body.expected_revision)];
  if (source) statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO provider_merge_guards(id,valid) SELECT ?,CASE WHEN EXISTS(SELECT 1 FROM providers WHERE id=? AND merge_revision=? AND listing_status='published') THEN 1 ELSE 0 END`).bind(crypto.randomUUID(), source.id, body.source_revision));
  statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO provider_merge_events(id,submission_id,target_provider_id,source_provider_id,domain,before_json,incoming_json,resolution_json) VALUES (?,?,?,?,?,?,?,?)`).bind(eventId, submission.id, target.id, source?.id || null, domain, JSON.stringify(before), JSON.stringify(incoming), JSON.stringify({ resolutions: body.resolutions || {}, fields })));
  if(proposal.service) {
    if(body.service_version!==proposal.service.version)throw new Error('Service changed. Reload the proposal.');
    const service=mergeFields(proposal.service.existing,proposal.service.incoming,body.service_resolutions || {},SERVICE_FIELDS);
    if(service.conflicts.length)throw new Error(`Resolve service fields: ${service.conflicts.join(', ')}`);
    const values=service.fields;
    for(const field of ['price_min','price_max'])if(values[field]!=null){values[field]=Number(values[field]);if(!Number.isFinite(values[field])||values[field]<0)throw new Error('Invalid service price.');}
    if(values.price_max!=null&&(values.price_min==null||values.price_max<values.price_min))throw new Error('Invalid price range.');
    if(values.format&&!['in_person','online','hybrid','unknown'].includes(values.format))throw new Error('Invalid service format.');
    if(values.instruction_mode&&!['private','group','both','workshop'].includes(values.instruction_mode))throw new Error('Invalid lesson format.');
    if(values.price_basis&&!['per_session','hourly','full_course','workshop','other'].includes(values.price_basis))throw new Error('Invalid price basis.');
    for(const field of ['source_url','registration_url'])if(values[field]){const url=new URL(values[field]);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw new Error('Invalid service URL.');}
    // Compare the full row inside the atomic batch; timestamps alone are too coarse.
    const existing=proposal.service.existing;
    const columns=Object.keys(existing);
    statements.unshift(env.DIRECTORY_DB.prepare(`INSERT INTO provider_merge_guards(id,valid) SELECT ?,CASE WHEN EXISTS(SELECT 1 FROM offerings WHERE ${columns.map(column=>`${column} IS ?`).join(' AND ')}) THEN 1 ELSE 0 END`).bind(crypto.randomUUID(),...columns.map(column=>existing[column])));
    statements.push(env.DIRECTORY_DB.prepare(`UPDATE offerings SET ${SERVICE_FIELDS.map(field=>`${field}=?`).join(',')},updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(...SERVICE_FIELDS.map(field=>values[field]),existing.id));
    for(const field of ['description','format','price','instruction_mode','schedule_text','registration_url'])statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO field_evidence(entity_type,entity_id,field_name,verification_status,source_url,verified_at,note) VALUES ('offering',?,?,'verified',?,date('now'),'Service resolved in provider merge review') ON CONFLICT(entity_type,entity_id,field_name) DO UPDATE SET verification_status='verified',source_url=excluded.source_url,verified_at=excluded.verified_at,note=excluded.note`).bind(existing.id,field,fields.website_url));
  }
  if (source) {
    statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO provider_merge_links(source_provider_id,target_provider_id,source_slug,event_id) VALUES (?,?,?,?)`).bind(source.id, target.id, source.slug, eventId));
    for (const [table, columns] of [
      ['provider_locations','location_id,is_primary'], ['provider_instructors','instructor_id'],
      ['provider_terms','term_id,verification_status,source_url,verified_at'],
    ]) statements.push(env.DIRECTORY_DB.prepare(`INSERT OR IGNORE INTO ${table}(provider_id,${columns}) SELECT ?,${columns} FROM ${table} WHERE provider_id=?`).bind(target.id, source.id));
    statements.push(env.DIRECTORY_DB.prepare(`INSERT OR IGNORE INTO provider_site_urls(id,provider_id,url,normalized_url,url_role,is_primary,verification_status,source_url,verified_at) SELECT lower(hex(randomblob(16))),?,url,normalized_url,url_role,0,verification_status,source_url,verified_at FROM provider_site_urls WHERE provider_id=?`).bind(target.id, source.id));
    statements.push(env.DIRECTORY_DB.prepare(`INSERT OR IGNORE INTO field_evidence(entity_type,entity_id,field_name,verification_status,source_url,verified_at,note) SELECT 'provider',?,field_name,verification_status,source_url,verified_at,note FROM field_evidence WHERE entity_type='provider' AND entity_id=?`).bind(target.id, source.id));
    statements.push(env.DIRECTORY_DB.prepare(`INSERT OR IGNORE INTO research_sources(entity_type,entity_id,source_url,source_type,verification_status,checked_at,note) SELECT 'provider',?,source_url,source_type,verification_status,checked_at,note FROM research_sources WHERE entity_type='provider' AND entity_id=?`).bind(target.id, source.id));
    for (const [table,column] of Object.entries(relatedTables).filter(([table]) => ['offerings','claims','provider_update_suggestions','submissions'].includes(table))) statements.push(env.DIRECTORY_DB.prepare(`UPDATE ${table} SET ${column}=? WHERE ${column}=?`).bind(target.id, source.id));
    statements.push(env.DIRECTORY_DB.prepare(`UPDATE provider_domains SET provider_id=? WHERE provider_id=?`).bind(target.id, source.id));
    statements.push(env.DIRECTORY_DB.prepare(`UPDATE providers SET listing_status='archived',merge_revision=merge_revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(source.id));
    statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO provider_url_redirects(source_path,target_path,target_provider_id,reason,approved_by) VALUES (?,?,?,'Reviewed domain merge','admin') ON CONFLICT(source_path) DO UPDATE SET target_path=excluded.target_path,target_provider_id=excluded.target_provider_id,reason=excluded.reason`).bind(`/providers/${source.slug}/`, `/providers/${target.slug}/`, target.id));
  }
  statements.push(env.DIRECTORY_DB.prepare(`UPDATE providers SET ${MERGE_FIELDS.map(field => `${field}=?`).join(',')},merge_revision=merge_revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(...MERGE_FIELDS.map(field => fields[field]), target.id));
  registerDomain(statements, env, target.id, fields.website_url);
  for(const website of new Set([target.website_url,incoming.website_url,fields.website_url].filter(Boolean))) {
    const url=new URL(website);url.hostname=url.hostname.toLowerCase().replace(/^www\./,'');url.hash='';
    const normalized=`${url.protocol}//${url.host}${url.pathname==='/'?'':url.pathname.replace(/\/+$/,'')}${url.search}`;
    statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO provider_site_urls(id,provider_id,url,normalized_url,url_role,is_primary,verification_status,source_url,verified_at) VALUES (?,?,?,?, 'official',0,'verified',?,date('now')) ON CONFLICT(provider_id,normalized_url) DO NOTHING`).bind(crypto.randomUUID(),target.id,website,normalized,website));
  }
  // Full original source remains archived; all losing values remain in the
  // private journal, including conflicting verification evidence and metadata.
  for (const field of ['name','description','teaching_approach','instagram_url']) if (fields[field] && fields[field] !== target[field]) statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO field_evidence(entity_type,entity_id,field_name,verification_status,source_url,verified_at,note) VALUES ('provider',?,?,'verified',?,date('now'),'Explicitly resolved during domain merge review') ON CONFLICT(entity_type,entity_id,field_name) DO UPDATE SET verification_status='verified',source_url=excluded.source_url,verified_at=excluded.verified_at,note=excluded.note`).bind(target.id, field, fields.website_url));
  statements.push(env.DIRECTORY_DB.prepare(`UPDATE submissions SET status='approved',reviewed_at=CURRENT_TIMESTAMP,duplicate_of_provider_id=? WHERE id=?`).bind(target.id, submission.id));
  statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO approval_events(submission_id,action,actor,note) VALUES (?,'approved','admin',?)`).bind(submission.id, `Merged into ${target.id}; rollback journal ${eventId}`));
  statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO provider_preview_jobs(provider_id,website_url) VALUES (?,?) ON CONFLICT(provider_id) DO UPDATE SET website_url=excluded.website_url,requested_at=CURRENT_TIMESTAMP,status='pending',attempts=0,error=NULL`).bind(target.id, fields.website_url));
  return { statements, targetId: target.id, website: fields.website_url, eventId };
}

import { readPublicData, invalidatePublicCache, withPublicCache, cacheableRequest, publicContext } from './public-cache.js';
import { serveSeo } from './seo.js';
import { siteContext } from './brand.js';
import { queryDirectory } from './directory-data.js';
import { notifySubmission, sendSupportEmail } from './submission-email.js';
import { instrumentDatabase } from './d1-metrics.js';
import { providerDomain, findDomainProvider, registerDomain } from './provider-identity.js';
import { mergeProposal, buildMerge } from './provider-merges.js';
import { refreshProviderPreview } from './provider-preview.js';
import { rollbackMerge } from './provider-merge-rollback.js';
import { enqueueApprovalEmail, attemptApprovalEmail } from './approval-email.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
});

const parseObject = value => {
  try { const parsed = JSON.parse(value || '{}'); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}; }
  catch { return {}; }
};

const clean = (value, max = 2000) => typeof value === 'string'
  ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max)
  : '';
const slugify = value => clean(value, 180).normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100);
const siteHost = value => { try { return new URL(value).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; } };
const NYC_BOROUGHS = new Set(['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island']);
const normalizedSiteUrl = value => { try { const url = new URL(value); if (!['https:', 'http:'].includes(url.protocol)) return ''; url.hostname = url.hostname.toLowerCase().replace(/^www\./, ''); url.pathname = url.pathname.replace(/\/+$/, '') || '/'; return `${url.protocol}//${url.host}${url.pathname === '/' ? '' : url.pathname}${url.search}${url.hash}`; } catch { return ''; } };

export async function invalidateDirectory(env) {
  const generation = await invalidatePublicCache(env);
  // Rebuild after the committed write, rather than charging the next visitor.
  // Use the returned generation: a KV read can still observe the old pointer.
  await getDirectory(env, { generation: generation || 'base', rowsRead: 0, queries: 0, stale: false });
}
export async function getDirectory(env, context) {
  return readPublicData(env, 'directory', stats => queryDirectory(env, stats), context);
}
export async function getListing(env, collection, slug, context) {
  const ctx = context || await publicContext(env);
  if (!['providers', 'offerings', 'teachers'].includes(collection)) return null;
  const directory = await getDirectory(env, ctx);
  const item = directory[collection].find(item => item.slug === slug);
  if (!item && collection === 'providers') {
    const canonical = directory.providers.find(provider => provider.aliases?.some(alias => alias.slug === slug));
    if (canonical) return { ...canonical, kind: 'provider', redirectSlug: canonical.slug };
  }
  return item ? { ...item, kind: { providers: 'provider', offerings: 'offering', teachers: 'teacher' }[collection] } : null;
}
async function getPublicListing(request, env, context) {
  try {
    const match = new URL(request.url).pathname.match(/^\/api\/(providers|offerings|teachers)\/([a-z0-9-]+)$/i);
    if (match) {
      const listing = await getListing(env, match[1], match[2], context);
      if (listing?.redirectSlug) return Response.redirect(new URL(`/api/providers/${listing.redirectSlug}`,request.url),308);
      if (listing) { const { kind, ...item } = listing; return json(match[1] === 'teachers' ? listing : item); }
      return json(null, 404);
    }
    if (new URL(request.url).pathname !== '/api/directory') return json({ error: 'Not found.' }, 404);
    return json(await getDirectory(env, context));
  } catch (error) {
    console.error('Directory read failed:', error?.message || error);
    return json({ error: 'The directory is temporarily unavailable.' }, 503);
  }
}

export function validateSubmission(body) {
  const type = clean(body?.type, 30);
  const allowed = ['provider', 'offering', 'teacher', 'claim', 'profile_update', 'removal'];
  if (!allowed.includes(type)) return 'Choose a valid submission type.';
  const contactEmail = clean(body.contact_email, 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) return 'Enter a valid contact email.';
  const name = clean(body.name, 160);
  if (['provider', 'offering', 'teacher'].includes(type) && !name) return 'Enter a name.';
  if (['provider', 'offering', 'teacher', 'profile_update'].includes(type) && !clean(body.description, 3000)) return 'Add a short description or update note.';
  if (type === 'claim' && (!clean(body.contact_name, 160) || !clean(body.verification_information, 2000))) return 'Add your contact name and a verification detail.';
  if (type === 'removal' && !((body.target_kind === 'teacher' || body.target_kind === 'provider') && clean(body.target_id, 120))) return 'Choose the listing to remove.';
  if (type === 'removal' && (clean(body.contact_name, 160).length < 2 || clean(body.verification_information, 2000).length < 20 || clean(body.description, 3000).length < 10)) return 'Add your name, the removal reason, and a brief ownership verification detail.';
  if (type === 'provider' && !['studio', 'school', 'coach'].includes(body.listing_type)) return 'Choose a listing type.';
  if (type === 'offering' && !clean(body.provider_id, 120)) return 'Choose the provider that offers this class or workshop.';
  if (type === 'offering' && !clean(body.registration_url, 500) && !clean(body.website_url, 500)) return 'Add an official website or registration link.';
  if (type === 'provider' && !clean(body.website_url, 500)) return 'Add the provider’s official website.';
  if (type === 'teacher' && !clean(body.website_url, 500)) return 'Add an official professional website or teaching profile.';
  if (['provider', 'teacher'].includes(type) && !clean(body.offering_name, 160)) return 'Add one documented lesson or service offering.';
  if (['provider', 'teacher', 'offering'].includes(type) && !['in_person', 'online', 'hybrid'].includes(body.format)) return 'Choose the documented attendance format.';
  if (['provider', 'teacher', 'offering'].includes(type) && !['private', 'group', 'both', 'workshop'].includes(body.instruction_mode)) return 'Choose the documented lesson format.';
  if (['provider', 'teacher', 'offering'].includes(type) && body.format === 'in_person' && !clean(body.borough, 80)) return 'Choose the borough for in-person lessons, or select an online or hybrid format.';
  if (['provider', 'teacher', 'offering'].includes(type) && body.format === 'online' && clean(body.borough, 80)) return 'Online-only services should not include an in-person borough.';
  if (['provider', 'teacher', 'offering'].includes(type) && clean(body.neighborhood, 120) && !clean(body.borough, 80)) return 'Choose a borough for the neighborhood.';
  if (['provider', 'teacher', 'offering'].includes(type) && clean(body.borough, 80) && !NYC_BOROUGHS.has(clean(body.borough, 80))) return 'Choose one of the five NYC boroughs.';
  if (type === 'claim' && !clean(body.provider_id, 120) && !(body.target_kind === 'teacher' && clean(body.target_id, 120))) return 'Choose a profile to claim.';
  if (type === 'profile_update' && !clean(body.provider_id, 120) && !(['teacher', 'offering'].includes(body.target_kind) && clean(body.target_id, 120))) return 'Choose the profile to update.';
  if (type === 'offering' && body.price_min != null && body.price_min !== '' && !['per_session', 'hourly', 'full_course', 'workshop', 'other'].includes(body.price_basis)) return 'Choose what the published price covers.';
  if (['provider', 'teacher', 'offering'].includes(type) && body.price_max != null && body.price_max !== '' && body.price_min != null && body.price_min !== '' && Number(body.price_max) < Number(body.price_min)) return 'The maximum price cannot be less than the minimum.';
  if (body.website_url && !siteHost(body.website_url)) return 'Enter a valid website URL.';
  if (body.registration_url && !siteHost(body.registration_url)) return 'Enter a valid registration URL.';
  if (body.booking_url && !siteHost(body.booking_url)) return 'Enter a valid booking URL.';
  if (body.instagram_url && !siteHost(body.instagram_url)) return 'Enter a valid Instagram URL.';
  if (['provider', 'teacher', 'offering'].includes(type) && body.price_min !== '' && body.price_min != null && (!Number.isFinite(Number(body.price_min)) || Number(body.price_min) < 0)) return 'Enter a valid price.';
  if (['provider', 'teacher', 'offering'].includes(type) && body.price_max !== '' && body.price_max != null && (!Number.isFinite(Number(body.price_max)) || Number(body.price_max) < 0)) return 'Enter a valid maximum price.';
  if (['provider', 'teacher', 'offering'].includes(type) && body.price_max !== '' && body.price_max != null && (body.price_min === '' || body.price_min == null)) return 'Enter the minimum price as well as the maximum price.';
  if (['provider', 'teacher', 'offering'].includes(type) && ((body.price_min !== '' && body.price_min != null) !== Boolean(body.price_basis))) return 'Enter both a price and its basis, or leave both blank.';
  return null;
}

async function submit(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (!env.DIRECTORY_DB) return json({ error: 'Local directory database is unavailable.' }, 503);
  let body;
  try {
    const raw = await request.text();
    if (raw.length > 24_000) return json({ error: 'Submission is too large.' }, 413);
    body = JSON.parse(raw);
  } catch { return json({ error: 'Enter a valid submission.' }, 400); }
  const validationError = validateSubmission(body);
  if (validationError) return json({ error: validationError }, 400);

  const type = clean(body.type, 30);
  const email = clean(body.contact_email, 254).toLowerCase();
  const website = clean(body.website_url, 500) || clean(body.registration_url, 500);
  const name = clean(body.name, 160);
  const id = crypto.randomUUID();
  const data = { ...body, name, contact_email: email, website_url: clean(body.website_url, 500), registration_url: clean(body.registration_url, 500) };
  // Client-supplied merge IDs are never trusted; recompute from the official URL.
  delete data.merge_target_id; delete data.source_provider_id; delete data.domain;
  let domainMatch = null;
  if (['provider','teacher'].includes(type)) {
    data.domain = providerDomain(website);
    if (!data.domain) return json({ error: 'Enter an official HTTP(S) website with a valid registrable domain.' }, 400);
    domainMatch = await findDomainProvider(env, website);
    if (domainMatch) data.merge_target_id = domainMatch.id;
  }

  let claimProvider = null;
  let claimTeacher = null;
  if (type === 'removal') {
    const target = body.target_kind === 'provider'
      ? await env.DIRECTORY_DB.prepare(`SELECT id,name FROM providers WHERE id=? AND listing_status='published'`).bind(clean(body.target_id, 120)).first()
      : await env.DIRECTORY_DB.prepare(`SELECT id,name FROM instructors WHERE id=? AND profile_status='published'`).bind(clean(body.target_id, 120)).first();
    if (!target) return json({ error: 'That published profile could not be found.' }, 404);
    data.name = target.name;
  }
  if (type === 'offering') {
    const parent = await env.DIRECTORY_DB.prepare(`SELECT id FROM providers WHERE id=? AND listing_status='published'`).bind(clean(body.provider_id, 120)).first();
    if (!parent) return json({ error: 'Choose a published provider for this class or workshop.' }, 400);
  }
  if (type === 'claim') {
    if (body.target_kind === 'teacher') {
      claimTeacher = await env.DIRECTORY_DB.prepare(`SELECT id, name, claim_status FROM instructors WHERE id = ? AND profile_status = 'published'`).bind(clean(body.target_id, 120)).first();
      if (!claimTeacher) return json({ error: 'That published profile could not be found.' }, 404);
      if (claimTeacher.claim_status !== 'unclaimed') return json({ error: 'This profile already has an active or approved claim.' }, 409);
    } else {
      claimProvider = await env.DIRECTORY_DB.prepare(`SELECT id, name, claim_status FROM providers WHERE id = ? AND listing_status = 'published'`).bind(clean(body.provider_id, 120)).first();
      if (!claimProvider) return json({ error: 'That published profile could not be found.' }, 404);
      if (claimProvider.claim_status !== 'unclaimed') return json({ error: 'This profile already has an active or approved claim.' }, 409);
    }
  }

  if (['provider', 'offering', 'teacher'].includes(type) && website && !domainMatch) {
    const normalizedUrl = normalizedSiteUrl(website);
    const existing = type === 'provider'
      ? await env.DIRECTORY_DB.prepare(`SELECT p.id FROM provider_site_urls ps JOIN providers p ON p.id=ps.provider_id WHERE ps.normalized_url = ? AND lower(p.name)=lower(?) AND p.listing_status='published' LIMIT 1`).bind(normalizedUrl, name).first()
      : type === 'teacher'
        ? await env.DIRECTORY_DB.prepare(`SELECT id FROM instructors WHERE lower(name)=lower(?) AND website_url = ? UNION ALL SELECT p.id FROM provider_site_urls ps JOIN providers p ON p.id=ps.provider_id WHERE ps.normalized_url=? AND lower(p.name)=lower(?) AND p.listing_status='published' LIMIT 1`).bind(name, website, normalizedUrl, name).first()
        : await env.DIRECTORY_DB.prepare(`SELECT id FROM offerings WHERE provider_id=? AND lower(name) = lower(?) AND (registration_url = ? OR source_url = ?) LIMIT 1`).bind(clean(body.provider_id, 120), name, website, website).first();
    if (existing && !domainMatch) return json({ error: 'A matching listing already exists. Use the profile claim or update option instead.' }, 409);
  }
  const duplicate = await env.DIRECTORY_DB.prepare(`SELECT id FROM submissions WHERE status = 'pending' AND COALESCE(json_extract(payload_json,'$.type'),submission_type)=? AND lower(contact_email) = ? AND (
      (lower(json_extract(payload_json, '$.name')) = ? AND ? <> '') OR
      (json_extract(payload_json, '$.provider_id') = ? AND ? <> '') OR
      (json_extract(payload_json, '$.target_id') = ? AND ? <> '')) LIMIT 1`)
    .bind(type, email, name.toLowerCase(), name, clean(body.provider_id, 120), clean(body.provider_id, 120), clean(body.target_id, 120), clean(body.target_id, 120)).first();
  if (duplicate) return json({ error: 'A matching submission is already awaiting review.' }, 409);

  try {
    // The original D1 queue enum predates teacher profiles. Retain its provider
    // category and resolve the validated teacher type from the stored payload.
    const statements = [env.DIRECTORY_DB.prepare(`INSERT INTO submissions (id, submission_type, status, contact_name, contact_email, website_url, payload_json)
      VALUES (?, ?, 'pending', ?, ?, ?, ?)`).bind(id, type === 'teacher' ? 'provider' : type === 'removal' ? 'profile_update' : type, clean(body.contact_name || body.name, 160), email, website || null, JSON.stringify(data))];
    if (type === 'claim') {
      if (claimTeacher) {
        statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO instructor_claims (id, instructor_id, submission_id, instructor_name, contact_name, business_email, website_url, instagram_url, verification_information)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), claimTeacher.id, id, claimTeacher.name, clean(body.contact_name, 160), email,
            clean(body.website_url, 500) || null, clean(body.instagram_url, 300) || null, clean(body.verification_information, 2000) || null));
        statements.push(env.DIRECTORY_DB.prepare(`UPDATE instructors SET claim_status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND claim_status = 'unclaimed'`).bind(claimTeacher.id));
      } else {
        statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO claims (id, provider_id, submission_id, provider_name, contact_name, business_email, website_url, instagram_url, verification_information)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), claimProvider.id, id, claimProvider.name, clean(body.contact_name, 160), email,
          clean(body.website_url, 500) || null, clean(body.instagram_url, 300) || null, clean(body.verification_information, 2000) || null));
        statements.push(env.DIRECTORY_DB.prepare(`UPDATE providers SET claim_status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND claim_status = 'unclaimed'`).bind(claimProvider.id));
      }
    }
    if (type === 'profile_update') {
      if (body.target_kind === 'teacher') {
        const teacher = await env.DIRECTORY_DB.prepare(`SELECT id FROM instructors WHERE id = ? AND profile_status = 'published'`).bind(clean(body.target_id, 120)).first();
        if (!teacher) return json({ error: 'That published profile could not be found.' }, 404);
      } else if (body.target_kind === 'offering') {
        const offering = await env.DIRECTORY_DB.prepare(`SELECT id FROM offerings WHERE id = ? AND listing_status = 'published'`).bind(clean(body.target_id, 120)).first();
        if (!offering) return json({ error: 'That published class could not be found.' }, 404);
      } else {
        const provider = await env.DIRECTORY_DB.prepare(`SELECT id FROM providers WHERE id = ? AND listing_status = 'published'`).bind(clean(body.provider_id, 120)).first();
        if (!provider) return json({ error: 'That published profile could not be found.' }, 404);
        statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO provider_update_suggestions (id, provider_id, submission_id, suggested_payload_json)
          VALUES (?, ?, ?, ?)`).bind(crypto.randomUUID(), provider.id, id, JSON.stringify(data)));
      }
    }
    await env.DIRECTORY_DB.batch(statements);
    if (type === 'claim') {
      try { await invalidateDirectory(env); } catch { console.error('Public cache invalidation failed after saved claim'); }
    }
    const emailNotification = await notifySubmission(env, id, data);
    return json({ ok: true, status: 'pending', submissionId: id, emailNotification, mergeProposed: Boolean(domainMatch) }, 201);
  } catch (error) {
    console.error('Submission save failed:', error?.message || error);
    return json({ error: 'We could not save your submission. Please try again.' }, 503);
  }
}

function adminAuthorized(request, env) {
  const supplied = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  return Boolean(env.ADMIN_REVIEW_KEY && supplied.length > 0 && supplied === env.ADMIN_REVIEW_KEY);
}

function addVerifiedEvidence(statements, env, entityType, entityId, sourceUrl, fields, note) {
  for (const [fieldName, value] of fields) {
    if (value == null || String(value).trim() === '') continue;
    statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO field_evidence
      (entity_type,entity_id,field_name,verification_status,source_url,verified_at,note)
      VALUES (?,?,?,'verified',?,date('now'),?)`).bind(entityType, entityId, fieldName, sourceUrl, note));
  }
}

function addSubmittedLocations(statements, env, payload, sourceUrl, { providerId = null, instructorId = null, offeringId = null } = {}) {
  const borough = clean(payload.borough, 80);
  const neighborhood = clean(payload.neighborhood, 120);
  const locations = [];
  if (borough && payload.format !== 'online') locations.push({ label: [neighborhood, borough, 'New York'].filter(Boolean).join(', '), borough, neighborhood, online: false });
  if (['online', 'hybrid'].includes(payload.format)) locations.push({ label: 'Online', borough: null, neighborhood: null, online: true });
  for (const location of locations) {
    const locationId = crypto.randomUUID();
    statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO locations (id,label,city,region,borough,neighborhood,is_online) VALUES (?,?, 'New York','NY',?,?,?)`)
      .bind(locationId, location.label, location.borough, location.neighborhood, location.online ? 1 : 0));
    if (providerId) statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO provider_locations (provider_id,location_id,is_primary) VALUES (?,?,?)`).bind(providerId, locationId, locations.length === 1 ? 1 : 0));
    if (instructorId) statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO instructor_locations (instructor_id,location_id) VALUES (?,?)`).bind(instructorId, locationId));
    if (offeringId) statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO offering_locations (offering_id,location_id) VALUES (?,?)`).bind(offeringId, locationId));
    statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO field_evidence (entity_type,entity_id,field_name,verification_status,source_url,verified_at,note)
      VALUES ('location',?,'location','verified',?,date('now'),'Location checked against the official source during editorial approval.')`)
      .bind(locationId, sourceUrl || null));
  }
}

function addVerifiedTerms(statements, env, table, idField, entityId, payload, sourceUrl) {
  const groups = [
    ['training_types', 'training_type'],
    ['techniques', 'technique'],
    ['genres', 'genre'],
  ];
  for (const [payloadField, taxonomy] of groups) for (const slug of [...new Set(payload[payloadField] || [])]) {
    statements.push(env.DIRECTORY_DB.prepare(`INSERT OR IGNORE INTO ${table} (${idField},term_id,verification_status,source_url,verified_at)
      SELECT ?,id,'verified',?,date('now') FROM taxonomy_terms WHERE taxonomy=? AND slug=?`)
      .bind(entityId, sourceUrl || null, taxonomy, clean(slug, 100)));
  }
}

function addSubmittedOffering(statements, env, payload, { providerId = null, instructorId = null } = {}) {
  const id = crypto.randomUUID();
  const name = clean(payload.offering_name || payload.name, 160);
  const sourceUrl = clean(payload.website_url, 500) || clean(payload.registration_url, 500);
  const priceMin = payload.price_min === '' || payload.price_min == null ? null : Number(payload.price_min);
  const priceMax = payload.price_max === '' || payload.price_max == null ? null : Number(payload.price_max);
  const instructionMode = ['private', 'group', 'both'].includes(payload.instruction_mode) ? payload.instruction_mode : null;
  statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO offerings
    (id,slug,provider_id,name,description,registration_url,format,price_min,price_max,currency,price_basis,schedule_text,instruction_mode,source_url,listing_status,origin)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'published','submitted')`)
    .bind(id, `${slugify(name)}-${id.slice(0, 6)}`, providerId, name, clean(payload.offering_description, 3000) || null,
      clean(payload.booking_url, 500) || clean(payload.registration_url, 500) || null, payload.format,
      priceMin, priceMax, priceMin == null ? null : 'USD', priceMin == null ? null : payload.price_basis,
      clean(payload.schedule_text, 300) || null, instructionMode, sourceUrl || null));
  if (instructorId) statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO offering_instructors (offering_id,instructor_id) VALUES (?,?)`).bind(id, instructorId));
  addVerifiedTerms(statements, env, 'offering_terms', 'offering_id', id, payload, sourceUrl);
  const evidence = [['format', payload.format], ['price', priceMin], ['instruction_mode', instructionMode], ['description', payload.offering_description], ['schedule_text', payload.schedule_text]];
  evidence.push(['name', name], ['registration_url', payload.booking_url || payload.registration_url], ['official_website', payload.website_url || payload.registration_url]);
  addVerifiedEvidence(statements, env, 'offering', id, sourceUrl, evidence, 'Profile offering checked against the official source during editorial approval.');
  if (payload.instruction_mode === 'workshop') addVerifiedEvidence(statements, env, 'offering', id, sourceUrl, [['lesson_format_workshop', 'workshop']], 'Workshop format checked against the official source during editorial approval.');

  addSubmittedLocations(statements, env, payload, sourceUrl, { offeringId: id });
  return id;
}

function queuePreview(statements, env, providerId, website) {
  statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO provider_preview_jobs(provider_id,website_url) VALUES (?,?) ON CONFLICT(provider_id) DO UPDATE SET website_url=excluded.website_url,requested_at=CURRENT_TIMESTAMP,status='pending',attempts=0,error=NULL`).bind(providerId,website));
  (statements.previewTasks ||= []).push({ providerId, website });
}
function schedulePreviews(tasks, env, executionContext) {
  if (!executionContext?.waitUntil) return;
  for (const { providerId, website } of tasks || []) executionContext.waitUntil(refreshProviderPreview(env,providerId,website,invalidateDirectory).catch(() => console.error('Preview job remains queued for retry.')));
}

async function reviewDomainMerge(request, env, executionContext) {
  if (!adminAuthorized(request,env)) return json({error:'Enter the review key.'},401);
  if (request.method==='GET') {
    try {
      const params = new URL(request.url).searchParams;
      const proposal = await mergeProposal(env,clean(params.get('submission_id'),80),clean(params.get('target_id'),120));
      return json(proposal);
    } catch(error) { return json({error:error.message},409); }
  }
  if (request.method!=='POST') return json({error:'Method not allowed.'},405);
  try {
    const raw = await request.text(); if(raw.length>80_000)return json({error:'Review is too large.'},413);
    const body=JSON.parse(raw);
    if(body.details_verified!==true)return json({error:'Verify the merged details against official sources first.'},400);
    const proposal=await mergeProposal(env,clean(body.submission_id,80),clean(body.target_id,120));
    const merge=await buildMerge(env,proposal,body);
    if (!proposal.source) {
      const payload=proposal.payload;
      if(payload.type==='teacher' && !proposal.existingInstructor) merge.statements.push(...buildTeacherStatements(env,payload,'institution',{existingProviderId:merge.targetId,existingOfferingId:proposal.service?.existing.id}));
      else {
        addVerifiedTerms(merge.statements,env,'provider_terms','provider_id',merge.targetId,payload,merge.website);
        addSubmittedLocations(merge.statements,env,payload,merge.website,{providerId:merge.targetId});
        if(proposal.existingInstructor) {
          merge.statements.push(env.DIRECTORY_DB.prepare(`INSERT OR IGNORE INTO provider_instructors(provider_id,instructor_id) VALUES (?,?)`).bind(merge.targetId,proposal.existingInstructor.id));
          if(proposal.service)merge.statements.push(env.DIRECTORY_DB.prepare(`INSERT OR IGNORE INTO offering_instructors(offering_id,instructor_id) VALUES (?,?)`).bind(proposal.service.existing.id,proposal.existingInstructor.id));
        }
        if(payload.offering_name && !proposal.service) {
          addSubmittedOffering(merge.statements,env,payload,{providerId:merge.targetId,instructorId:proposal.existingInstructor?.id || null});
        }
      }
    }
    const notify=enqueueApprovalEmail(merge.statements,env,proposal.submission,proposal.payload,`/providers/${proposal.target.slug}/`,true);
    merge.statements.push(env.DIRECTORY_DB.prepare(`UPDATE provider_merge_events SET after_json=json_object('target_revision',(SELECT merge_revision FROM providers WHERE id=?),'source_revision',(SELECT merge_revision FROM providers WHERE id=?)) WHERE id=?`).bind(merge.targetId,proposal.source?.id || null,merge.eventId));
    await env.DIRECTORY_DB.batch(merge.statements);
    let cacheInvalidated=false;
    try {await invalidateDirectory(env);cacheInvalidated=true;}catch{console.error('Merge saved; public cache refresh needs retry.');}
    schedulePreviews([{providerId:merge.targetId,website:merge.website}],env,executionContext);
    const approvalEmail=notify?await attemptApprovalEmail(env,proposal.submission.id):'not_applicable';
    return json({ok:true,targetProviderId:merge.targetId,mergeEventId:merge.eventId,cacheInvalidated,approvalEmail});
  } catch(error) { console.error('Provider merge refused:',String(error.message).slice(0,200));return json({error:error.message},409); }
}

async function adminSubmissions(request, env) {
  if (!adminAuthorized(request, env)) return json({ error: 'Enter the local review key.' }, 401);
  try {
    const result = await env.DIRECTORY_DB.prepare(`SELECT id, submission_type, contact_name, contact_email, website_url, payload_json, submitted_at
      FROM submissions WHERE status = 'pending' ORDER BY submitted_at ASC`).all();
    return json((result.results || []).map(row => {
      const payload = parseObject(row.payload_json);
      return { ...row, submission_type: row.submission_type === 'provider' && payload.type === 'teacher' ? 'teacher' : row.submission_type === 'profile_update' && payload.type === 'removal' ? 'removal' : row.submission_type, payload };
    }));
  } catch (error) {
    console.error('Admin submissions failed:', error?.message || error);
    return json({ error: 'The pending submissions could not be loaded.' }, 503);
  }
}

function buildTeacherStatements(env, payload, reviewedClassification, { existingProviderId = null, existingOfferingId = null } = {}) {
  const statements = [];
  const teacherId = crypto.randomUUID();
  const providerId = !existingProviderId && reviewedClassification === 'independent_teacher' ? crypto.randomUUID() : null;
  const slug = slugify(payload.name);
  statements.publicPath=providerId?`/providers/${slug}-${providerId.slice(0,6)}/`:`/teachers/${slug}-${teacherId.slice(0,6)}/`;
  const title = ['Voice teacher', 'Vocal coach', 'Singing teacher', 'Vocal pedagogue', 'Speech and voice coach', 'Other voice teacher'].includes(payload.professional_title)
    ? payload.professional_title : null;
  statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO instructors
    (id, slug, name, description, biography, teaching_experience, website_url, source_url, instagram_url, booking_url, professional_title, profile_status, last_verified_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', date('now'))`)
    .bind(teacherId, `${slug}-${teacherId.slice(0, 6)}`, clean(payload.name, 160), clean(payload.description, 3000),
      clean(payload.biography, 5000) || null, clean(payload.teaching_experience, 3000) || null,
      clean(payload.website_url, 500), clean(payload.website_url, 500), clean(payload.instagram_url, 300) || null, clean(payload.booking_url, 500) || null, title));
  if (providerId) {
    const officialUrl = clean(payload.website_url, 500);
    const normalizedUrl = normalizedSiteUrl(officialUrl);
    const providerDescription = [title, payload.description, payload.biography, payload.teaching_experience].map(value => clean(value, 5000)).filter(Boolean).join('\n\n');
    statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO providers (id,slug,listing_type,provider_classification,name,description,website_url,instagram_url,source_url,listing_status,origin)
      VALUES (?,?, 'coach','independent_teacher',?,?,?,?,?,'published','submitted')`)
      .bind(providerId, `${slug}-${providerId.slice(0, 6)}`, clean(payload.name, 160), providerDescription, officialUrl,
        clean(payload.instagram_url, 300) || null, officialUrl));
    registerDomain(statements, env, providerId, officialUrl);
    queuePreview(statements, env, providerId, officialUrl);
    statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO provider_site_urls (id,provider_id,url,normalized_url,url_role,is_primary,verification_status,source_url,verified_at)
      VALUES (?,?,?,?, 'official',1,'verified',?,date('now'))`).bind(crypto.randomUUID(), providerId, officialUrl, normalizedUrl, officialUrl));
    statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO research_sources (entity_type,entity_id,source_url,source_type,verification_status,checked_at,note)
      VALUES ('provider',?,?,'official_website','verified',date('now'),'Independent teacher practice checked against the official source during editorial approval.')`).bind(providerId, officialUrl));
    addVerifiedEvidence(statements, env, 'provider', providerId, officialUrl, [['name', payload.name], ['description', providerDescription], ['official_website', officialUrl], ['provider_classification', 'independent_teacher'], ['instagram_url', payload.instagram_url]], 'Independent teacher practice checked against the official source during editorial approval.');
  }
  if (existingProviderId) statements.push(env.DIRECTORY_DB.prepare(`INSERT OR IGNORE INTO provider_instructors(provider_id,instructor_id) VALUES (?,?)`).bind(existingProviderId,teacherId));
  const affiliationId = clean(payload.affiliation_provider_id, 120);
  if (affiliationId) statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO provider_instructors (provider_id, instructor_id)
    SELECT id, ? FROM providers WHERE id = ? AND listing_status = 'published' AND listing_type != 'coach'`).bind(teacherId, affiliationId));
  const sourceUrl = clean(payload.website_url, 500);
  addVerifiedTerms(statements, env, 'instructor_terms', 'instructor_id', teacherId, payload, sourceUrl);
  if (providerId) addVerifiedTerms(statements, env, 'provider_terms', 'provider_id', providerId, payload, sourceUrl);
  addVerifiedEvidence(statements, env, 'instructor', teacherId, sourceUrl, [
    ['profile', payload.description], ['name', payload.name], ['description', payload.description], ['biography', payload.biography],
    ['teaching_experience', payload.teaching_experience], ['professional_title', title], ['official_website', sourceUrl],
    ['instagram_url', payload.instagram_url], ['booking_url', payload.booking_url],
  ], 'Submitted teacher profile checked against the official source during editorial approval.');
  addSubmittedLocations(statements, env, payload, sourceUrl, { providerId, instructorId: teacherId });
  if(existingOfferingId) statements.push(env.DIRECTORY_DB.prepare(`INSERT OR IGNORE INTO offering_instructors(offering_id,instructor_id) VALUES (?,?)`).bind(existingOfferingId,teacherId));
  else addSubmittedOffering(statements, env, payload, { providerId: existingProviderId || providerId, instructorId: teacherId });
  statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO research_sources (entity_type, entity_id, source_url, source_type, verification_status, checked_at, note)
    VALUES ('instructor', ?, ?, 'official_website', 'verified', date('now'), 'Official professional or teaching profile reviewed by directory editor.')`)
    .bind(teacherId, sourceUrl));
  statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO field_evidence (entity_type,entity_id,field_name,verification_status,source_url,note)
    VALUES ('instructor',?,'submission_origin','unverified',?,'Created from an approved profile submission.')`).bind(teacherId, sourceUrl));
  return statements;
}

function buildProviderStatements(env, payload, reviewedClassification = null) {
  const statements = [];
  const providerId = crypto.randomUUID();
  const slug = slugify(payload.name);
  statements.publicPath=`/providers/${slug}-${providerId.slice(0,6)}/`;
  const suggested = { coach: 'independent_teacher', school: 'institution', studio: 'studio_business' }[payload.listing_type] || 'unconfirmed';
  const classification = ['independent_teacher', 'institution', 'studio_business', 'unconfirmed'].includes(reviewedClassification) ? reviewedClassification : suggested;
  if (classification === 'unconfirmed') throw new Error('Choose a verified provider classification before approving this listing.');
  const officialUrl = clean(payload.website_url, 500);
  const normalizedUrl = normalizedSiteUrl(officialUrl);
  statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO providers (id, slug, listing_type, provider_classification, name, description, teaching_approach, website_url, instagram_url, source_url, listing_status, origin)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', 'submitted')`).bind(providerId, `${slug}-${providerId.slice(0, 6)}`,
      payload.listing_type, classification, clean(payload.name, 160), clean(payload.description, 3000) || null, clean(payload.teaching_approach, 2000) || null,
      officialUrl || null, clean(payload.instagram_url, 300) || null, officialUrl || null));
  registerDomain(statements, env, providerId, officialUrl);
  queuePreview(statements, env, providerId, officialUrl);
  if (officialUrl && normalizedUrl) {
    statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO provider_site_urls (id,provider_id,url,normalized_url,url_role,is_primary,verification_status,source_url,verified_at) VALUES (?,?,?,?, 'official',1,'verified',?,date('now'))`)
      .bind(crypto.randomUUID(), providerId, officialUrl, normalizedUrl, officialUrl));
    statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO research_sources (entity_type,entity_id,source_url,source_type,verification_status,checked_at,note) VALUES ('provider',?,?,'official_website','verified',date('now'),'Official provider website reviewed during approval.')`)
      .bind(providerId, officialUrl));
    statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO field_evidence (entity_type,entity_id,field_name,verification_status,source_url,verified_at,note) VALUES ('provider',?,'official_website','verified',?,date('now'),'Official website reviewed by directory editor.')`)
      .bind(providerId, officialUrl));
    if (classification !== 'unconfirmed') statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO field_evidence (entity_type,entity_id,field_name,verification_status,source_url,verified_at,note) VALUES ('provider',?,'provider_classification','verified',?,date('now'),'Provider classification reviewed by directory editor.')`)
      .bind(providerId, officialUrl));
  }
  addVerifiedTerms(statements, env, 'provider_terms', 'provider_id', providerId, payload, officialUrl);
  addSubmittedLocations(statements, env, payload, officialUrl, { providerId });
  addSubmittedOffering(statements, env, payload, { providerId });
  addVerifiedEvidence(statements, env, 'provider', providerId, officialUrl, [
    ['name', payload.name], ['description', payload.description], ['teaching_approach', payload.teaching_approach], ['instagram_url', payload.instagram_url],
  ], 'Submitted provider profile checked against the official source during editorial approval.');
  statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO field_evidence (entity_type, entity_id, field_name, verification_status, source_url)
    VALUES ('provider', ?, 'submission', 'unverified', ?)`).bind(providerId, payload.website_url || null));
  return statements;
}

async function buildOfferingStatements(env, payload) {
  const statements = [];
  const offeringId = crypto.randomUUID();
  const slug = slugify(payload.name);
  statements.publicPath=`/classes/${slug}-${offeringId.slice(0,6)}/`;
  const provider = payload.provider_id
    ? await env.DIRECTORY_DB.prepare(`SELECT id FROM providers WHERE id = ? AND listing_status = 'published'`).bind(clean(payload.provider_id, 120)).first()
    : null;
  if (!provider) throw new Error('Choose a published provider for this offering.');
  statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO offerings (id, slug, provider_id, name, description, registration_url, format, price_min, price_max, currency, price_basis, duration_minutes, session_count, schedule_text, skill_level, genre_specialty, audition_required, interview_required, instruction_mode, source_url, listing_status, origin)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', 'submitted')`)
    .bind(offeringId, `${slug}-${offeringId.slice(0, 6)}`, provider?.id || null, clean(payload.name, 160), clean(payload.description, 3000) || null,
      clean(payload.registration_url, 500) || clean(payload.website_url, 500) || null,
      ['in_person', 'online', 'hybrid'].includes(payload.format) ? payload.format : null,
      payload.price_min === '' || payload.price_min == null ? null : Number(payload.price_min),
      payload.price_max === '' || payload.price_max == null ? null : Number(payload.price_max),
      payload.price_min === '' || payload.price_min == null ? null : 'USD',
      ['per_session', 'hourly', 'full_course', 'workshop', 'other'].includes(payload.price_basis) ? payload.price_basis : null,
      Number(payload.duration_minutes) || null, Number(payload.session_count) || null, clean(payload.schedule_text, 300) || null,
      clean(payload.skill_level, 80) || null, clean(payload.genre_specialty, 240) || null,
      payload.audition_required === '' || payload.audition_required == null ? null : Number(Boolean(payload.audition_required)),
      payload.interview_required === '' || payload.interview_required == null ? null : Number(Boolean(payload.interview_required)),
      ['group', 'private', 'both'].includes(payload.instruction_mode) ? payload.instruction_mode : null,
      clean(payload.registration_url, 500) || clean(payload.website_url, 500) || null));
  const sourceUrl = clean(payload.website_url, 500) || clean(payload.registration_url, 500);
  addVerifiedTerms(statements, env, 'offering_terms', 'offering_id', offeringId, payload, sourceUrl);
  const instructionMode = ['group', 'private', 'both'].includes(payload.instruction_mode) ? payload.instruction_mode : null;
  addVerifiedEvidence(statements, env, 'offering', offeringId, sourceUrl, [
    ['name', payload.name], ['description', payload.description], ['registration_url', payload.registration_url], ['official_website', payload.website_url || payload.registration_url], ['format', payload.format], ['instruction_mode', instructionMode],
    ['price', payload.price_min], ['schedule_text', payload.schedule_text],
  ], 'Submitted offering checked against the official source during editorial approval.');
  if (payload.instruction_mode === 'workshop') addVerifiedEvidence(statements, env, 'offering', offeringId, sourceUrl, [['lesson_format_workshop', 'workshop']], 'Workshop format checked against the official source during editorial approval.');
  addSubmittedLocations(statements, env, payload, sourceUrl, { offeringId });
  return statements;
}

function buildClaimStatements(env, payload, id, action) {
  const statements = [];
  const isTeacher = payload.target_kind === 'teacher';
  if (action === 'approved') {
    if (isTeacher) {
      statements.push(env.DIRECTORY_DB.prepare(`UPDATE instructor_claims SET status = 'approved', reviewed_at = CURRENT_TIMESTAMP WHERE submission_id = ?`).bind(id));
      statements.push(env.DIRECTORY_DB.prepare(`UPDATE instructors SET claim_status = 'claimed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(payload.target_id));
    } else {
      statements.push(env.DIRECTORY_DB.prepare(`UPDATE claims SET status = 'approved', reviewed_at = CURRENT_TIMESTAMP WHERE submission_id = ?`).bind(id));
      statements.push(env.DIRECTORY_DB.prepare(`UPDATE providers SET claim_status = 'claimed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(payload.provider_id));
    }
  } else if (action === 'rejected') {
    if (isTeacher) {
      statements.push(env.DIRECTORY_DB.prepare(`UPDATE instructor_claims SET status = 'rejected', reviewed_at = CURRENT_TIMESTAMP WHERE submission_id = ?`).bind(id));
      statements.push(env.DIRECTORY_DB.prepare(`UPDATE instructors SET claim_status = 'unclaimed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(payload.target_id));
    } else {
      statements.push(env.DIRECTORY_DB.prepare(`UPDATE claims SET status = 'rejected', reviewed_at = CURRENT_TIMESTAMP WHERE submission_id = ?`).bind(id));
      statements.push(env.DIRECTORY_DB.prepare(`UPDATE providers SET claim_status = 'unclaimed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(payload.provider_id));
    }
  }
  return statements;
}

async function decideSubmission(request, env, executionContext) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (!adminAuthorized(request, env)) return json({ error: 'Enter the local review key.' }, 401);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid review decision.' }, 400); }
  const id = clean(body?.id, 80);
  const action = clean(body?.action, 20);
  if (!id || !['approved', 'rejected'].includes(action)) return json({ error: 'Choose approve or reject.' }, 400);
  let submission;
  try {
    submission = await env.DIRECTORY_DB.prepare(`SELECT * FROM submissions WHERE id = ? AND status = 'pending'`).bind(id).first();
  } catch (error) {
    console.error('Review submission lookup failed:', error?.message || error);
    return json({ error: 'The review decision could not be saved.' }, 503);
  }
  if (!submission) return json({ error: 'Pending submission not found.' }, 404);
  const payload = parseObject(submission.payload_json);
  if(action==='approved' && payload.type==='domain_merge')return json({error:'Use Merge with Existing Provider to resolve this review.'},409);
  const submissionType = submission.submission_type === 'provider' && payload.type === 'teacher' ? 'teacher' : submission.submission_type === 'profile_update' && payload.type === 'removal' ? 'removal' : submission.submission_type;
  if (action === 'approved' && ['provider', 'teacher', 'offering'].includes(submissionType) && body.details_verified !== true) return json({ error: 'Confirm that the submitted details were checked against the official source before approving.' }, 400);
  if (action === 'approved' && submissionType === 'provider' && !['independent_teacher', 'institution', 'studio_business'].includes(body.provider_classification)) return json({ error: 'Choose a verified provider classification before approving.' }, 400);
  if (action === 'approved' && submissionType === 'teacher' && !['independent_teacher', 'institution'].includes(body.provider_classification)) return json({ error: 'Choose Independent or Institution after reviewing the official source.' }, 400);
  const statements = [];
  if(action==='approved' && (submissionType==='provider' || (submissionType==='teacher' && body.provider_classification==='independent_teacher'))) {
    const match=await findDomainProvider(env,payload.website_url);
    if(match)return json({error:'This website already belongs to a provider. Use Merge with Existing Provider.',mergeTargetId:match.id},409);
  }
  statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO provider_merge_guards(id,valid) SELECT ?,CASE WHEN EXISTS(SELECT 1 FROM submissions WHERE id=? AND status='pending') THEN 1 ELSE 0 END`).bind(crypto.randomUUID(),id));
  if (action === 'approved' && ['claim', 'removal'].includes(submissionType)) {
    if (body.ownership_verified !== true || clean(body.verification_note, 1000).length < 20) return json({ error: 'Verify ownership through the official contact channel and record how it was verified before approving.' }, 400);
    const target = payload.target_kind === 'teacher'
      ? await env.DIRECTORY_DB.prepare(`SELECT id FROM instructors WHERE id=? AND profile_status='published'`).bind(clean(payload.target_id, 120)).first()
      : payload.target_kind === 'provider'
        ? await env.DIRECTORY_DB.prepare(`SELECT id FROM providers WHERE id=? AND listing_status='published'`).bind(clean(payload.target_id, 120)).first()
        : await env.DIRECTORY_DB.prepare(`SELECT id FROM providers WHERE id=? AND listing_status='published'`).bind(clean(payload.provider_id, 120)).first();
    if (!target) return json({ error: 'This profile is no longer published; review the request again.' }, 409);
  }

  const previewTasks=[];let publicPath='/';
  if (action === 'approved' && submissionType === 'teacher') { const built=buildTeacherStatements(env,payload,body.provider_classification);statements.push(...built);previewTasks.push(...built.previewTasks || []);publicPath=built.publicPath; }
  if (action === 'approved' && submissionType === 'provider') { const built=buildProviderStatements(env,payload,body.provider_classification);statements.push(...built);previewTasks.push(...built.previewTasks || []);publicPath=built.publicPath; }
  if (action === 'approved' && submissionType === 'offering') {const built=await buildOfferingStatements(env,payload);statements.push(...built);publicPath=built.publicPath;}
  if (submissionType === 'claim') statements.push(...buildClaimStatements(env, payload, id, action));
  if (submissionType === 'removal' && action === 'approved') {
    if (payload.target_kind === 'provider') {
      statements.push(env.DIRECTORY_DB.prepare(`UPDATE providers SET listing_status='archived',updated_at=CURRENT_TIMESTAMP WHERE listing_status='published' AND (id=? OR (registrable_domain IS NOT NULL AND registrable_domain=(SELECT registrable_domain FROM providers WHERE id=?)))`).bind(clean(payload.target_id, 120),clean(payload.target_id, 120)));
      statements.push(env.DIRECTORY_DB.prepare(`UPDATE offerings SET listing_status='archived',updated_at=CURRENT_TIMESTAMP WHERE listing_status='published' AND provider_id IN (SELECT id FROM providers WHERE id=? OR (registrable_domain IS NOT NULL AND registrable_domain=(SELECT registrable_domain FROM providers WHERE id=?)))`).bind(clean(payload.target_id,120),clean(payload.target_id,120)));
    }
    else statements.push(env.DIRECTORY_DB.prepare(`UPDATE instructors SET profile_status='archived',updated_at=CURRENT_TIMESTAMP WHERE id=? AND profile_status='published'`).bind(clean(payload.target_id, 120)));
  }

  if (action === 'approved' && submissionType === 'profile_update') {
    if (payload.target_kind === 'teacher' && clean(payload.target_id, 120)) {
      statements.push(env.DIRECTORY_DB.prepare(`UPDATE instructors SET description = COALESCE(NULLIF(?,''),description),
        website_url = COALESCE(NULLIF(?,''),website_url), updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .bind(clean(payload.description, 3000), clean(payload.website_url, 500), clean(payload.target_id, 120)));
    } else if (payload.target_kind === 'offering' && clean(payload.target_id, 120)) {
      statements.push(env.DIRECTORY_DB.prepare(`UPDATE offerings SET description = COALESCE(NULLIF(?,''),description), updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .bind(clean(payload.description, 3000), clean(payload.target_id, 120)));
    } else {
      if(payload.website_url) {
        const match=await findDomainProvider(env,payload.website_url);
        if(match && match.id!==payload.provider_id)return json({error:'That website belongs to another provider; submit it for an explicit domain merge.'},409);
        registerDomain(statements,env,payload.provider_id,payload.website_url);
        queuePreview(statements,env,payload.provider_id,payload.website_url);
        previewTasks.push(...statements.previewTasks || []);
      }
      const fields = ['name', 'description', 'teaching_approach', 'website_url', 'instagram_url'];
      const values = fields.map(field => clean(payload[field], field === 'description' || field === 'teaching_approach' ? 3000 : 500));
      statements.push(env.DIRECTORY_DB.prepare(`UPDATE providers SET name = COALESCE(NULLIF(?,''),name), description = COALESCE(NULLIF(?,''),description),
        teaching_approach = COALESCE(NULLIF(?,''),teaching_approach), website_url = COALESCE(NULLIF(?,''),website_url), instagram_url = COALESCE(NULLIF(?,''),instagram_url), updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .bind(...values, payload.provider_id));
    }
    statements.push(env.DIRECTORY_DB.prepare(`UPDATE provider_update_suggestions SET status = 'approved', reviewed_at = CURRENT_TIMESTAMP WHERE submission_id = ?`).bind(id));
  }
  if (submissionType === 'profile_update' && action === 'rejected') {
    statements.push(env.DIRECTORY_DB.prepare(`UPDATE provider_update_suggestions SET status = 'rejected', reviewed_at = CURRENT_TIMESTAMP WHERE submission_id = ?`).bind(id));
  }
  if(action==='approved' && ['profile_update','claim'].includes(submissionType)) {
    const collection=payload.target_kind==='teacher'?'teachers':payload.target_kind==='offering'?'classes':'providers';
    const table=collection==='teachers'?'instructors':collection==='classes'?'offerings':'providers';
    const target=await env.DIRECTORY_DB.prepare(`SELECT slug FROM ${table} WHERE id=?`).bind(clean(payload.target_id || payload.provider_id,120)).first();
    if(target)publicPath=`/${collection}/${target.slug}/`;
  }
  const notify=action==='approved' && enqueueApprovalEmail(statements,env,submission,payload,publicPath);

  statements.push(env.DIRECTORY_DB.prepare(`UPDATE submissions SET status = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'`).bind(action, id));
  statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO approval_events (submission_id, action, actor, note) VALUES (?, ?, 'local-admin', ?)`)
    .bind(id, action, ['claim', 'removal'].includes(submissionType) && action === 'approved' ? `Ownership verified: ${clean(body.verification_note, 1000)}${body.note ? '; ' + clean(body.note, 500) : ''}` : clean(body.note, 500) || null));
  try {
    await env.DIRECTORY_DB.batch(statements);
    schedulePreviews(previewTasks,env,executionContext);
    let cacheInvalidated = false;
    // Rejections do not change any public listing. Claims do change public
    // claim state on both approval and rejection, so they still invalidate.
    if (action === 'approved' || submissionType === 'claim') {
      try { await invalidateDirectory(env); cacheInvalidated = true; } catch { console.error('Public cache invalidation failed after saved review decision'); }
    }
    const approvalEmail=notify?await attemptApprovalEmail(env,id):'not_applicable';
    return json({ ok: true, id, status: action, cacheInvalidated,approvalEmail });
  } catch (error) {
    console.error('Review decision failed:', error?.message || error);
    return json({ error: 'The review decision could not be saved.' }, 503);
  }
}

const handler = {
  async fetch(request, env, executionContext) {
    const url = new URL(request.url);
    const { redirect, local } = siteContext(url, env);
    if (redirect) return Response.redirect(redirect, 308);
    if (local && /^\/(?:src\/|node_modules\/|@vite\/|@id\/|@fs\/|@react-refresh)/.test(url.pathname)) return env.ASSETS.fetch(request);
    if (url.pathname === '/api/health') return json({ ok: true, service: 'acting-class-directory', databaseConfigured: Boolean(env.DIRECTORY_DB) });
    const legacyDirectoryPaths = ['/directory', '/studios', '/classes', '/coaches'];
    if (legacyDirectoryPaths.includes(url.pathname) && request.method === 'GET') {
      const target = new URL('/', url);
      for (const [key, value] of url.searchParams) target.searchParams.set(key, value);
      target.searchParams.delete('type');
      return Response.redirect(target, 302);
    }
    if (url.pathname === '/api/directory' && request.method === 'GET') return withPublicCache(request, env, context => getPublicListing(request, env, context));
    if (url.pathname.startsWith('/api/providers/') || url.pathname.startsWith('/api/offerings/') || url.pathname.startsWith('/api/teachers/')) return withPublicCache(request, env, context => getPublicListing(request, env, context));
    if (url.pathname === '/api/submissions') return submit(request, env);
    if (url.pathname === '/api/admin/submissions' && request.method === 'GET') return adminSubmissions(request, env);
    if (url.pathname === '/api/admin/decision') return decideSubmission(request, env, executionContext);
    if (url.pathname === '/api/admin/provider-merge') return reviewDomainMerge(request,env,executionContext);
    if (url.pathname === '/api/admin/approval-emails' && request.method==='GET') {
      if(!adminAuthorized(request,env))return json({error:'Enter the review key.'},401);
      const rows=await env.DIRECTORY_DB.prepare(`SELECT submission_id,status,attempts,last_error,created_at,sent_at FROM submission_approval_emails ORDER BY created_at DESC LIMIT 50`).all();return json(rows.results);
    }
    if (url.pathname === '/api/admin/approval-emails/retry' && request.method==='POST') {
      if(!adminAuthorized(request,env))return json({error:'Enter the review key.'},401);
      if(env.APPROVAL_EMAIL_ENABLED!=='true')return json({error:'Approval emails are disabled.'},409);
      const rows=await env.DIRECTORY_DB.prepare(`SELECT e.submission_id FROM submission_approval_emails e JOIN submissions s ON s.id=e.submission_id WHERE e.status IN ('pending','failed','blocked') AND e.attempts<5 AND s.status='approved' ORDER BY e.created_at LIMIT 5`).all();
      const results=[];for(const row of rows.results)results.push({submissionId:row.submission_id,status:await attemptApprovalEmail(env,row.submission_id)});return json({ok:true,results});
    }
    if (url.pathname === '/api/admin/approval-email-test' && request.method==='POST') {
      if(!adminAuthorized(request,env))return json({error:'Enter the review key.'},401);
      if(env.APPROVAL_EMAIL_ENABLED!=='true')return json({error:'Approval emails are disabled.'},409);
      try {const {SUPPORT_EMAIL,NOTIFICATION_SENDER}=await import('./submission-email.js');const result=await env.SUBMISSION_EMAIL.send({from:{email:NOTIFICATION_SENDER,name:'Vocal Catalog'},to:SUPPORT_EMAIL,replyTo:SUPPORT_EMAIL,subject:'Vocal Catalog approval email connection test',text:'This is a one-time test of submission approval confirmations. No listing was submitted or approved. The recipient of a real confirmation will be the email address saved with the submission.'});return json({ok:Boolean(result?.messageId),providerMessageId:result?.messageId || null,scope:'verified support destination only'});}
      catch(error){return json({ok:false,code:clean(error.code || 'EMAIL_API_UNAVAILABLE',100)},502);}
    }
    if (url.pathname === '/api/admin/provider-merge/rollback' && request.method==='POST') {
      if(!adminAuthorized(request,env))return json({error:'Enter the review key.'},401);
      try { const body=await request.json();const result=await rollbackMerge(env,clean(body.event_id,80));await invalidateDirectory(env);return json(result); }
      catch(error){return json({error:error.message},409);}
    }
    if (url.pathname === '/api/admin/preview-retry' && request.method==='POST') {
      if(!adminAuthorized(request,env))return json({error:'Enter the review key.'},401);
      const jobs=await env.DIRECTORY_DB.prepare(`SELECT provider_id,website_url FROM provider_preview_jobs WHERE status IN ('pending','failed') AND attempts<3 ORDER BY requested_at LIMIT 3`).all();
      schedulePreviews(jobs.results.map(job=>({providerId:job.provider_id,website:job.website_url})),env,executionContext);
      return json({ok:true,queued:jobs.results.length});
    }
    if(/^\/api\/provider-previews\/[a-zA-Z0-9-]+\.jpg$/.test(url.pathname) && request.method==='GET') {
      const providerId=url.pathname.split('/').pop().slice(0,-4);
      const image=await env.PUBLIC_CACHE_STORE?.get(`provider-preview:image:${providerId}`);
      if(!image)return json({error:'Preview unavailable.'},404);
      return new Response(Uint8Array.from(atob(image),char=>char.charCodeAt(0)),{headers:{'Content-Type':'image/jpeg','Cache-Control':'public, max-age=3600','X-Content-Type-Options':'nosniff'}});
    }
    if (url.pathname === '/api/admin/cache/invalidate' && request.method === 'POST') {
      if (!adminAuthorized(request, env)) return json({ error: 'Enter the review key.' }, 401);
      try { await invalidateDirectory(env); return json({ ok: true }); }
      catch { return json({ error: 'Cache invalidation is temporarily unavailable.' }, 503); }
    }
    if (url.pathname === '/api/admin/email-test' && request.method === 'POST') {
      if (!adminAuthorized(request, env)) return json({ error: 'Enter the review key.' }, 401);
      const status = await sendSupportEmail(env, { subject: 'Vocal Catalog: notification connection test', text: 'This is a one-time test from Vocal Catalog. Submission notifications and business inquiries are configured for this inbox. No test listing was created.\n\nhttps://vocalcatalog.com' });
      return json({ ok: status === 'sent', emailNotification: status }, status === 'sent' ? 200 : 502);
    }
    if (url.pathname.startsWith('/api/')) return json({ error: 'Not found.' }, 404);
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    if (!cacheableRequest(request) && url.pathname !== '/') return serveSeo(request, env, getDirectory, { getListing });
    return withPublicCache(request, env, context => serveSeo(request, env, target => getDirectory(target, context), { cacheVersion: context.generation, getListing: (target, collection, slug) => getListing(target, collection, slug, context) }));
  },
};

export default {
  async fetch(request, env, executionContext) {
    const stats = { queries: 0, rowsRead: 0, unknown: 0 };
    const measuredEnv = env.DIRECTORY_DB ? { ...env, DIRECTORY_DB: instrumentDatabase(env.DIRECTORY_DB, stats) } : env;
    // Keep the stable binding as cache identity across requests.
    measuredEnv.PUBLIC_CACHE_IDENTITY = env.DIRECTORY_DB;
    const response = await handler.fetch(request, measuredEnv, executionContext);
    const path = new URL(request.url).pathname;
    const endpoint = path.startsWith('/api/admin/') ? 'admin' : path === '/api/submissions' ? 'submission' : path.startsWith('/api/') ? 'public-api' : 'public-page';
    console.info('d1-endpoint', JSON.stringify({ endpoint, method: request.method, status: response.status, ...stats }));
    const headers = new Headers(response.headers);
    headers.set('X-D1-Queries', String(stats.queries));
    headers.set('X-D1-Rows-Read', stats.unknown ? 'unknown' : String(stats.rowsRead));
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
};

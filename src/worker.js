const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

const parseArray = value => {
  try { const parsed = JSON.parse(value || '[]'); return Array.isArray(parsed) ? parsed : []; }
  catch { return []; }
};

const clean = (value, max = 2000) => typeof value === 'string'
  ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max)
  : '';
const slugify = value => clean(value, 180).normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100);
const siteHost = value => { try { return new URL(value).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; } };

const PROVIDERS_SQL = `SELECT p.*,
  (SELECT MAX(fe.verified_at) FROM field_evidence fe WHERE fe.entity_type = 'provider' AND fe.entity_id = p.id AND fe.verification_status = 'verified') AS last_verified,
  (SELECT json_group_array(json_object('label',l.label,'city',l.city,'region',l.region,'borough',l.borough,'neighborhood',l.neighborhood,'postal_address',l.postal_address,'is_online',l.is_online,'verified',EXISTS(SELECT 1 FROM field_evidence fe WHERE fe.entity_type = \'location\' AND fe.entity_id = l.id AND fe.verification_status = \'verified\')))
    FROM provider_locations pl JOIN locations l ON l.id = pl.location_id WHERE pl.provider_id = p.id) AS locations_json,
  (SELECT json_group_array(json_object('id',tt.id,'taxonomy',tt.taxonomy,'term',tt.term,'slug',tt.slug,'verification_status',pt.verification_status,'source_url',pt.source_url,'verified_at',pt.verified_at))
    FROM provider_terms pt JOIN taxonomy_terms tt ON tt.id = pt.term_id WHERE pt.provider_id = p.id) AS terms_json,
  (SELECT json_group_array(json_object('id',i.id,'name',i.name,'description',i.description,'website_url',i.website_url))
    FROM provider_instructors pi JOIN instructors i ON i.id = pi.instructor_id WHERE pi.provider_id = p.id) AS instructors_json,
  (SELECT json_group_array(json_object('id',o.id,'slug',o.slug,'name',o.name,'price_min',o.price_min,'price_max',o.price_max,'currency',o.currency,'price_basis',o.price_basis,'format',o.format,'formatVerified',EXISTS(SELECT 1 FROM field_evidence fe WHERE fe.entity_type = \'offering\' AND fe.entity_id = o.id AND fe.field_name = \'format\' AND fe.verification_status = \'verified\'),'priceVerified',EXISTS(SELECT 1 FROM field_evidence fe WHERE fe.entity_type = \'offering\' AND fe.entity_id = o.id AND fe.field_name = \'price\' AND fe.verification_status = \'verified\')))
    FROM offerings o WHERE o.provider_id = p.id AND o.listing_status = 'published') AS offerings_json
  FROM providers p WHERE p.listing_status = 'published' ORDER BY p.name COLLATE NOCASE`;

const OFFERINGS_SQL = `SELECT o.*, p.name AS provider_name, p.slug AS provider_slug, p.listing_type AS provider_listing_type,
  (SELECT MAX(fe.verified_at) FROM field_evidence fe WHERE fe.entity_type = 'offering' AND fe.entity_id = o.id AND fe.verification_status = 'verified') AS last_verified,
  (SELECT json_group_array(json_object('label',l.label,'city',l.city,'region',l.region,'borough',l.borough,'neighborhood',l.neighborhood,'postal_address',l.postal_address,'is_online',l.is_online,'verified',EXISTS(SELECT 1 FROM field_evidence fe WHERE fe.entity_type = \'location\' AND fe.entity_id = l.id AND fe.verification_status = \'verified\')))
    FROM offering_locations ol JOIN locations l ON l.id = ol.location_id WHERE ol.offering_id = o.id) AS locations_json,
  (SELECT json_group_array(json_object('id',tt.id,'taxonomy',tt.taxonomy,'term',tt.term,'slug',tt.slug,'verification_status',ot.verification_status,'source_url',ot.source_url,'verified_at',ot.verified_at))
    FROM offering_terms ot JOIN taxonomy_terms tt ON tt.id = ot.term_id WHERE ot.offering_id = o.id) AS terms_json,
  (SELECT json_group_array(json_object('id',i.id,'name',i.name,'description',i.description,'website_url',i.website_url))
    FROM offering_instructors oi JOIN instructors i ON i.id = oi.instructor_id WHERE oi.offering_id = o.id) AS instructors_json,
  EXISTS(SELECT 1 FROM field_evidence fe WHERE fe.entity_type = 'offering' AND fe.entity_id = o.id AND fe.field_name = 'price' AND fe.verification_status = 'verified') AS price_verified,
  EXISTS(SELECT 1 FROM field_evidence fe WHERE fe.entity_type = 'offering' AND fe.entity_id = o.id AND fe.field_name = 'format' AND fe.verification_status = 'verified') AS format_verified
  FROM offerings o LEFT JOIN providers p ON p.id = o.provider_id
  WHERE o.listing_status = 'published' ORDER BY o.name COLLATE NOCASE`;

const TEACHERS_SQL = `SELECT i.*,
  (SELECT MAX(fe.verified_at) FROM field_evidence fe WHERE fe.entity_type = 'instructor' AND fe.entity_id = i.id AND fe.verification_status = 'verified') AS last_verified,
  (SELECT json_group_array(json_object('id',p.id,'name',p.name,'website_url',p.website_url,'source_url',p.source_url))
    FROM provider_instructors pi JOIN providers p ON p.id = pi.provider_id
    WHERE pi.instructor_id = i.id AND p.listing_status = 'published' AND p.listing_type != 'coach') AS affiliations_json,
  (SELECT json_group_array(json_object('id',o.id,'slug',o.slug,'name',o.name,'description',o.description,
      'provider_id',o.provider_id,'provider_name',p.name,'registration_url',o.registration_url,'enrollment_url',o.enrollment_url,
      'source_url',o.source_url,'format',o.format,'price_min',o.price_min,'price_max',o.price_max,'currency',o.currency,
      'price_basis',o.price_basis,'schedule_text',o.schedule_text,'skill_level',o.skill_level,'instruction_mode',o.instruction_mode,
      'duration_minutes',o.duration_minutes,'session_count',o.session_count,
      'priceVerified',EXISTS(SELECT 1 FROM field_evidence fe WHERE fe.entity_type='offering' AND fe.entity_id=o.id AND fe.field_name='price' AND fe.verification_status='verified'),
      'formatVerified',EXISTS(SELECT 1 FROM field_evidence fe WHERE fe.entity_type='offering' AND fe.entity_id=o.id AND fe.field_name='format' AND fe.verification_status='verified')))
    FROM offering_instructors oi JOIN offerings o ON o.id = oi.offering_id
    LEFT JOIN providers p ON p.id = o.provider_id
    WHERE oi.instructor_id = i.id AND o.listing_status = 'published') AS offerings_json,
  (SELECT json_group_array(json_object('id',tt.id,'taxonomy',tt.taxonomy,'term',tt.term,'slug',tt.slug,
      'verification_status',it.verification_status,'source_url',it.source_url,'verified_at',it.verified_at))
    FROM instructor_terms it JOIN taxonomy_terms tt ON tt.id = it.term_id WHERE it.instructor_id = i.id) AS terms_json,
  (SELECT json_group_array(json_object('format',ifm.format,'verification_status',ifm.verification_status,'source_url',ifm.source_url,'verified_at',ifm.verified_at))
    FROM instructor_formats ifm WHERE ifm.instructor_id = i.id) AS formats_json,
  (SELECT json_group_array(json_object('label',l.label,'city',l.city,'region',l.region,'borough',l.borough,'neighborhood',l.neighborhood,
      'postal_address',l.postal_address,'is_online',l.is_online,
      'verified',EXISTS(SELECT 1 FROM field_evidence fe WHERE fe.entity_type='location' AND fe.entity_id=l.id AND fe.verification_status='verified')))
    FROM instructor_locations il JOIN locations l ON l.id = il.location_id WHERE il.instructor_id = i.id) AS locations_json
  FROM instructors i WHERE i.profile_status='published' ORDER BY i.name COLLATE NOCASE`;

function normalizeProvider(row) {
  return {
    ...row,
    locations: parseArray(row.locations_json), terms: parseArray(row.terms_json),
    instructors: parseArray(row.instructors_json), offerings: parseArray(row.offerings_json),
  };
}

function normalizeOffering(row) {
  return {
    ...row,
    priceVerified: Boolean(row.price_verified), formatVerified: Boolean(row.format_verified),
    locations: parseArray(row.locations_json), terms: parseArray(row.terms_json), instructors: parseArray(row.instructors_json),
  };
}

function normalizeTeacher(row) {
  return {
    ...row, kind: 'teacher',
    affiliations: parseArray(row.affiliations_json), offerings: parseArray(row.offerings_json),
    terms: parseArray(row.terms_json), formats: parseArray(row.formats_json), locations: parseArray(row.locations_json),
  };
}

async function getDirectory(env) {
  if (!env.DIRECTORY_DB) throw new Error('The local directory database binding is missing.');
  const [providers, offerings, teachers] = await Promise.all([
    env.DIRECTORY_DB.prepare(PROVIDERS_SQL).all(),
    env.DIRECTORY_DB.prepare(OFFERINGS_SQL).all(),
    env.DIRECTORY_DB.prepare(TEACHERS_SQL).all(),
  ]);
  return {
    providers: (providers.results || []).map(normalizeProvider),
    offerings: (offerings.results || []).map(normalizeOffering),
    teachers: (teachers.results || []).map(normalizeTeacher),
  };
}

function safeJson(data) { return JSON.stringify(data).replace(/</g, '\\u003c'); }

function addProfileMetadata(html, url, listing, isOffering, kind = 'provider') {
  const title = `${listing.name} | Voxline NYC`;
  const description = clean(listing.description || `Explore ${listing.name} on Voxline NYC.`, 180);
  const canonical = kind === 'teacher'
    ? new URL(`/?listing=${encodeURIComponent(listing.slug)}`, url.origin).href
    : new URL(url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`, url.origin).href;
  const schema = isOffering
    ? { '@context': 'https://schema.org', '@type': 'Course', name: listing.name, description, url: canonical, provider: listing.provider_name ? { '@type': 'Organization', name: listing.provider_name } : undefined, offers: listing.priceVerified && listing.price_min != null ? { '@type': 'Offer', price: listing.price_min, priceCurrency: listing.currency || 'USD', url: listing.enrollment_url || listing.registration_url } : undefined }
    : { '@context': 'https://schema.org', '@type': kind === 'teacher' || listing.listing_type === 'coach' ? 'Person' : 'EducationalOrganization', name: listing.name, description, url: canonical, sameAs: [listing.website_url, listing.instagram_url].filter(Boolean) };
  html = html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*("\s*\/?>)/i, `$1${escapeHtml(description)}$2`)
    .replace(/<meta name="robots" content="[^"]*"\s*\/?>/i, '<meta name="robots" content="index, follow" />')
    .replace('</head>', `<link rel="canonical" href="${escapeHtml(canonical)}" />\n<meta property="og:type" content="${isOffering ? 'course' : 'website'}" />\n<meta property="og:title" content="${escapeHtml(title)}" />\n<meta property="og:description" content="${escapeHtml(description)}" />\n<meta property="og:url" content="${escapeHtml(canonical)}" />\n<script type="application/ld+json">${safeJson(schema)}</script>\n</head>`);
  return html;
}

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

async function seoProfile(request, env, slug, kind) {
  const directory = await getDirectory(env);
  const teacher = kind === 'teacher' ? directory.teachers.find(item => item.slug === slug) : null;
  const offering = kind === 'offering' ? directory.offerings.find(item => item.slug === slug) : null;
  const provider = kind === 'provider' ? directory.providers.find(item => item.slug === slug) : null;
  const listing = teacher || offering || provider;
  if (!listing) {
    const missing = await env.ASSETS.fetch(new Request(new URL('/', request.url), { method: 'GET' }));
    const html = (await missing.text()).replace(/<title>[^<]*<\/title>/i, '<title>Teacher not found | Voxline NYC</title>')
      .replace(/<meta name="robots" content="[^"]*"\s*\/?>/i, '<meta name="robots" content="noindex, nofollow" />');
    return new Response(html, { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
  const response = await env.ASSETS.fetch(new Request(new URL('/', request.url), { method: 'GET' }));
  if (!response.ok) return response;
  return new Response(addProfileMetadata(await response.text(), new URL(request.url), listing, Boolean(offering), kind), {
    status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=120' },
  });
}

async function seoQueryProfile(request, env, slug) {
  const directory = await getDirectory(env);
  const teacher = directory.teachers.find(item => item.slug === slug);
  const offering = directory.offerings.find(item => item.slug === slug);
  const provider = directory.providers.find(item => item.slug === slug);
  const listing = teacher || offering || provider;
  if (!listing) {
    const response = await env.ASSETS.fetch(new Request(new URL('/', request.url), { method: 'GET' }));
    const html = (await response.text()).replace(/<title>[^<]*<\/title>/i, '<title>Teacher not found | Voxline NYC</title>')
      .replace(/<meta name="robots" content="[^"]*"\s*\/?>/i, '<meta name="robots" content="noindex, nofollow" />');
    return new Response(html, { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
  const response = await env.ASSETS.fetch(new Request(new URL('/', request.url), { method: 'GET' }));
  if (!response.ok) return response;
  return new Response(addProfileMetadata(await response.text(), new URL(request.url), listing, Boolean(offering), teacher ? 'teacher' : offering ? 'offering' : 'provider'), {
    status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=120' },
  });
}

async function getPublicListing(request, env) {
  try {
    const directory = await getDirectory(env);
    const { pathname } = new URL(request.url);
    const providerMatch = pathname.match(/^\/api\/providers\/([a-z0-9-]+)$/i);
    const offeringMatch = pathname.match(/^\/api\/offerings\/([a-z0-9-]+)$/i);
    const teacherMatch = pathname.match(/^\/api\/teachers\/([a-z0-9-]+)$/i);
    if (teacherMatch) return json(directory.teachers.find(item => item.slug === teacherMatch[1]) || null, directory.teachers.some(item => item.slug === teacherMatch[1]) ? 200 : 404);
    if (providerMatch) return json(directory.providers.find(item => item.slug === providerMatch[1]) || null, directory.providers.some(item => item.slug === providerMatch[1]) ? 200 : 404);
    if (offeringMatch) return json(directory.offerings.find(item => item.slug === offeringMatch[1]) || null, directory.offerings.some(item => item.slug === offeringMatch[1]) ? 200 : 404);
    return json(directory);
  } catch (error) {
    console.error('Directory read failed:', error?.message || error);
    return json({ error: 'The directory is temporarily unavailable.' }, 503);
  }
}

async function sitemap(request, env) {
  try {
    const directory = await getDirectory(env);
    const origin = new URL(request.url).origin;
    const paths = ['/', ...directory.teachers.map(item => `/?listing=${encodeURIComponent(item.slug)}`)];
    const urls = paths.map(path => `  <url><loc>${escapeHtml(`${origin}${path}`)}</loc></url>`).join('\n');
    return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`, {
      headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
    });
  } catch { return new Response('Sitemap unavailable', { status: 503 }); }
}

function robots(request) {
  const origin = new URL(request.url).origin;
  return new Response(`User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
  });
}

export function validateSubmission(body) {
  const type = clean(body?.type, 30);
  const allowed = ['provider', 'offering', 'teacher', 'claim', 'profile_update'];
  if (!allowed.includes(type)) return 'Choose a valid submission type.';
  const contactEmail = clean(body.contact_email, 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) return 'Enter a valid contact email.';
  const name = clean(body.name, 160);
  if (type !== 'claim' && !name) return 'Enter a name.';
  if (['provider', 'offering', 'teacher', 'profile_update'].includes(type) && !clean(body.description, 3000)) return 'Add a short description or update note.';
  if (type === 'claim' && (!clean(body.contact_name, 160) || !clean(body.verification_information, 2000))) return 'Add your contact name and a verification detail.';
  if (type === 'provider' && !['studio', 'school', 'coach'].includes(body.listing_type)) return 'Choose a listing type.';
  if (type === 'offering' && !clean(body.registration_url, 500) && !clean(body.website_url, 500)) return 'Add an official website or registration link.';
  if (type === 'provider' && !clean(body.website_url, 500)) return 'Add the provider’s official website.';
  if (type === 'teacher' && !clean(body.website_url, 500)) return 'Add an official professional website or teaching profile.';
  if (type === 'claim' && !clean(body.provider_id, 120) && !(body.target_kind === 'teacher' && clean(body.target_id, 120))) return 'Choose a profile to claim.';
  if (type === 'profile_update' && !clean(body.provider_id, 120) && !(body.target_kind === 'teacher' && clean(body.target_id, 120))) return 'Choose the profile to update.';
  if (type === 'offering' && body.price_min != null && body.price_min !== '' && !['per_session', 'hourly', 'full_course', 'workshop', 'other'].includes(body.price_basis)) return 'Choose what the published price covers.';
  if (type === 'offering' && body.price_max != null && body.price_max !== '' && Number(body.price_max) < Number(body.price_min)) return 'The maximum price cannot be less than the minimum.';
  if (body.website_url && !siteHost(body.website_url)) return 'Enter a valid website URL.';
  if (body.registration_url && !siteHost(body.registration_url)) return 'Enter a valid registration URL.';
  if (type === 'offering' && body.price_min !== '' && body.price_min != null && (!Number.isFinite(Number(body.price_min)) || Number(body.price_min) < 0)) return 'Enter a valid price.';
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

  let claimProvider = null;
  let claimTeacher = null;
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

  if (['provider', 'offering', 'teacher'].includes(type) && website) {
    const websiteHost = siteHost(website);
    const existing = type === 'provider'
      ? await env.DIRECTORY_DB.prepare(`SELECT id FROM providers WHERE lower(replace(replace(website_url,'https://',''),'http://','')) LIKE ? LIMIT 1`).bind(`%${websiteHost}%`).first()
      : type === 'teacher'
        ? await env.DIRECTORY_DB.prepare(`SELECT id FROM instructors WHERE lower(name)=lower(?) OR lower(replace(replace(website_url,'https://',''),'http://','')) LIKE ? LIMIT 1`).bind(name, `%${websiteHost}%`).first()
        : await env.DIRECTORY_DB.prepare(`SELECT id FROM offerings WHERE lower(name) = lower(?) AND (registration_url = ? OR source_url = ?) LIMIT 1`).bind(name, website, website).first();
    if (existing) return json({ error: 'A matching listing already exists. Use the profile claim or update option instead.' }, 409);
  }
  const duplicate = await env.DIRECTORY_DB.prepare(`SELECT id FROM submissions WHERE status = 'pending' AND lower(contact_email) = ? AND (
      (lower(json_extract(payload_json, '$.name')) = ? AND ? <> '') OR
      (json_extract(payload_json, '$.provider_id') = ? AND ? <> '')) LIMIT 1`)
    .bind(email, name.toLowerCase(), name, clean(body.provider_id, 120), clean(body.provider_id, 120)).first();
  if (duplicate) return json({ error: 'A matching submission is already awaiting review.' }, 409);

  try {
    const statements = [env.DIRECTORY_DB.prepare(`INSERT INTO submissions (id, submission_type, status, contact_name, contact_email, website_url, payload_json)
      VALUES (?, ?, 'pending', ?, ?, ?, ?)`).bind(id, type, clean(body.contact_name || body.name, 160), email, website || null, JSON.stringify(data))];
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
      const provider = await env.DIRECTORY_DB.prepare(`SELECT id FROM providers WHERE id = ? AND listing_status = 'published'`).bind(clean(body.provider_id, 120)).first();
      if (!provider) return json({ error: 'That published profile could not be found.' }, 404);
      statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO provider_update_suggestions (id, provider_id, submission_id, suggested_payload_json)
        VALUES (?, ?, ?, ?)`).bind(crypto.randomUUID(), provider.id, id, JSON.stringify(data)));
    }
    await env.DIRECTORY_DB.batch(statements);
    return json({ ok: true, status: 'pending', submissionId: id }, 201);
  } catch (error) {
    console.error('Submission save failed:', error?.message || error);
    return json({ error: 'We could not save your submission. Please try again.' }, 503);
  }
}

function adminAuthorized(request, env) {
  const supplied = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  return Boolean(env.ADMIN_REVIEW_KEY && supplied.length > 0 && supplied === env.ADMIN_REVIEW_KEY);
}

async function adminSubmissions(request, env) {
  if (!adminAuthorized(request, env)) return json({ error: 'Enter the local review key.' }, 401);
  const result = await env.DIRECTORY_DB.prepare(`SELECT id, submission_type, contact_name, contact_email, website_url, payload_json, submitted_at
    FROM submissions WHERE status = 'pending' ORDER BY submitted_at ASC`).all();
  return json((result.results || []).map(row => ({ ...row, payload: JSON.parse(row.payload_json || '{}') })));
}

async function decideSubmission(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (!adminAuthorized(request, env)) return json({ error: 'Enter the local review key.' }, 401);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid review decision.' }, 400); }
  const id = clean(body?.id, 80);
  const action = clean(body?.action, 20);
  if (!id || !['approved', 'rejected'].includes(action)) return json({ error: 'Choose approve or reject.' }, 400);
  const submission = await env.DIRECTORY_DB.prepare(`SELECT * FROM submissions WHERE id = ? AND status = 'pending'`).bind(id).first();
  if (!submission) return json({ error: 'Pending submission not found.' }, 404);
  const payload = JSON.parse(submission.payload_json || '{}');
  const statements = [];

  if (action === 'approved' && submission.submission_type === 'teacher') {
    const teacherId = crypto.randomUUID();
    const slug = slugify(payload.name);
    const title = ['Voice teacher', 'Vocal coach', 'Singing teacher', 'Vocal pedagogue', 'Speech and voice coach', 'Other voice teacher'].includes(payload.professional_title)
      ? payload.professional_title : 'Voice teacher';
    statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO instructors
      (id, slug, name, description, biography, teaching_experience, website_url, source_url, instagram_url, booking_url, professional_title, profile_status, last_verified_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', date('now'))`)
      .bind(teacherId, `${slug}-${teacherId.slice(0, 6)}`, clean(payload.name, 160), clean(payload.description, 3000),
        clean(payload.biography, 5000) || null, clean(payload.teaching_experience, 3000) || null,
        clean(payload.website_url, 500), clean(payload.website_url, 500), clean(payload.instagram_url, 300) || null, clean(payload.booking_url, 500) || null, title));
    const affiliationId = clean(payload.affiliation_provider_id, 120);
    if (affiliationId) statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO provider_instructors (provider_id, instructor_id)
      SELECT id, ? FROM providers WHERE id = ? AND listing_status = 'published' AND listing_type != 'coach'`).bind(teacherId, affiliationId));
    for (const slugTerm of [...(payload.training_types || []), ...(payload.techniques || []), ...(payload.genres || [])]) {
      statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO instructor_terms (instructor_id, term_id, verification_status, source_url)
        SELECT ?, id, 'unverified', ? FROM taxonomy_terms WHERE slug = ?`).bind(teacherId, clean(payload.website_url, 500), slugTerm));
    }
    const borough = clean(payload.borough, 80);
    if (borough) {
      const locationId = crypto.randomUUID();
      statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO locations (id, label, city, region, borough) VALUES (?, ?, 'New York', 'NY', ?)`)
        .bind(locationId, `${borough}, New York`, borough));
      statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO instructor_locations (instructor_id, location_id) VALUES (?, ?)`)
        .bind(teacherId, locationId));
      statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO field_evidence (entity_type, entity_id, field_name, verification_status, source_url)
        VALUES ('location', ?, 'borough', 'unverified', ?)`).bind(locationId, clean(payload.website_url, 500)));
    }
    statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO field_evidence (entity_type, entity_id, field_name, verification_status, source_url)
      VALUES ('instructor', ?, 'profile', 'verified', ?)`)
      .bind(teacherId, clean(payload.website_url, 500)));
    statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO research_sources (entity_type, entity_id, source_url, source_type, verification_status, checked_at, note)
      VALUES ('instructor', ?, ?, 'official_website', 'verified', date('now'), 'Official professional or teaching profile reviewed by directory editor.')`)
      .bind(teacherId, clean(payload.website_url, 500)));
  }

  if (action === 'approved' && submission.submission_type === 'provider') {
    const providerId = crypto.randomUUID();
    const slug = slugify(payload.name);
    statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO providers (id, slug, listing_type, name, description, teaching_approach, website_url, instagram_url, source_url, listing_status, origin)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', 'submitted')`).bind(providerId, `${slug}-${providerId.slice(0, 6)}`,
        payload.listing_type, clean(payload.name, 160), clean(payload.description, 3000) || null, clean(payload.teaching_approach, 2000) || null,
        clean(payload.website_url, 500) || null, clean(payload.instagram_url, 300) || null, clean(payload.website_url, 500) || null));
    const location = clean(payload.borough, 80);
    if (location || payload.format === 'online') {
      const locationId = crypto.randomUUID();
      statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO locations (id, label, city, region, borough, is_online) VALUES (?, ?, 'New York', 'NY', ?, ?)`)
        .bind(locationId, payload.format === 'online' ? 'Online' : `${location}, New York`, location || null, payload.format === 'online' ? 1 : 0));
      statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO provider_locations (provider_id, location_id, is_primary) VALUES (?, ?, 1)`).bind(providerId, locationId));
    }
    for (const slugTerm of payload.training_types || []) {
      statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO provider_terms (provider_id, term_id, verification_status, source_url)
        SELECT ?, id, 'unverified', ? FROM taxonomy_terms WHERE taxonomy = 'training_type' AND slug = ?`).bind(providerId, payload.website_url || null, slugTerm));
    }
    for (const slugTerm of payload.techniques || []) {
      statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO provider_terms (provider_id, term_id, verification_status, source_url)
        SELECT ?, id, 'unverified', ? FROM taxonomy_terms WHERE taxonomy = 'technique' AND slug = ?`).bind(providerId, payload.website_url || null, slugTerm));
    }
    for (const slugTerm of payload.genres || []) {
      statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO provider_terms (provider_id, term_id, verification_status, source_url)
        SELECT ?, id, 'unverified', ? FROM taxonomy_terms WHERE taxonomy = 'genre' AND slug = ?`).bind(providerId, payload.website_url || null, slugTerm));
    }
    statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO field_evidence (entity_type, entity_id, field_name, verification_status, source_url)
      VALUES ('provider', ?, 'submission', 'unverified', ?)`).bind(providerId, payload.website_url || null));
  }

  if (action === 'approved' && submission.submission_type === 'offering') {
    const offeringId = crypto.randomUUID();
    const slug = slugify(payload.name);
    const provider = payload.provider_id
      ? await env.DIRECTORY_DB.prepare(`SELECT id FROM providers WHERE id = ? AND listing_status = 'published'`).bind(clean(payload.provider_id, 120)).first()
      : null;
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
    for (const slugTerm of [...(payload.training_types || []), ...(payload.techniques || [])]) {
      statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO offering_terms (offering_id, term_id, verification_status, source_url)
        SELECT ?, id, 'unverified', ? FROM taxonomy_terms WHERE slug = ?`).bind(offeringId, payload.website_url || payload.registration_url || null, slugTerm));
    }
    for (const slugTerm of payload.genres || []) {
      statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO offering_terms (offering_id, term_id, verification_status, source_url)
        SELECT ?, id, 'unverified', ? FROM taxonomy_terms WHERE taxonomy = 'genre' AND slug = ?`).bind(offeringId, payload.website_url || payload.registration_url || null, slugTerm));
    }
    statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO field_evidence (entity_type, entity_id, field_name, verification_status, source_url)
      VALUES ('offering', ?, 'submission', 'unverified', ?)`).bind(offeringId, payload.website_url || payload.registration_url || null));
  }

  if (action === 'approved' && submission.submission_type === 'claim') {
    if (payload.target_kind === 'teacher') {
      statements.push(env.DIRECTORY_DB.prepare(`UPDATE instructor_claims SET status = 'approved', reviewed_at = CURRENT_TIMESTAMP WHERE submission_id = ?`).bind(id));
      statements.push(env.DIRECTORY_DB.prepare(`UPDATE instructors SET claim_status = 'claimed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(payload.target_id));
    } else {
      statements.push(env.DIRECTORY_DB.prepare(`UPDATE claims SET status = 'approved', reviewed_at = CURRENT_TIMESTAMP WHERE submission_id = ?`).bind(id));
      statements.push(env.DIRECTORY_DB.prepare(`UPDATE providers SET claim_status = 'claimed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(payload.provider_id));
    }
  }
  if (submission.submission_type === 'claim' && action === 'rejected') {
    if (payload.target_kind === 'teacher') {
      statements.push(env.DIRECTORY_DB.prepare(`UPDATE instructor_claims SET status = 'rejected', reviewed_at = CURRENT_TIMESTAMP WHERE submission_id = ?`).bind(id));
      statements.push(env.DIRECTORY_DB.prepare(`UPDATE instructors SET claim_status = 'unclaimed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(payload.target_id));
    } else {
      statements.push(env.DIRECTORY_DB.prepare(`UPDATE claims SET status = 'rejected', reviewed_at = CURRENT_TIMESTAMP WHERE submission_id = ?`).bind(id));
      statements.push(env.DIRECTORY_DB.prepare(`UPDATE providers SET claim_status = 'unclaimed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(payload.provider_id));
    }
  }

  if (action === 'approved' && submission.submission_type === 'profile_update') {
    if (payload.target_kind === 'teacher' && clean(payload.target_id, 120)) {
      statements.push(env.DIRECTORY_DB.prepare(`UPDATE instructors SET description = COALESCE(NULLIF(?,''),description),
        website_url = COALESCE(NULLIF(?,''),website_url), updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .bind(clean(payload.description, 3000), clean(payload.website_url, 500), clean(payload.target_id, 120)));
    } else {
      const fields = ['name', 'description', 'teaching_approach', 'website_url', 'instagram_url'];
      const values = fields.map(field => clean(payload[field], field === 'description' || field === 'teaching_approach' ? 3000 : 500));
      statements.push(env.DIRECTORY_DB.prepare(`UPDATE providers SET name = COALESCE(NULLIF(?,''),name), description = COALESCE(NULLIF(?,''),description),
        teaching_approach = COALESCE(NULLIF(?,''),teaching_approach), website_url = COALESCE(NULLIF(?,''),website_url), instagram_url = COALESCE(NULLIF(?,''),instagram_url), updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .bind(...values, payload.provider_id));
    }
    statements.push(env.DIRECTORY_DB.prepare(`UPDATE provider_update_suggestions SET status = 'approved', reviewed_at = CURRENT_TIMESTAMP WHERE submission_id = ?`).bind(id));
  }
  if (submission.submission_type === 'profile_update' && action === 'rejected') {
    statements.push(env.DIRECTORY_DB.prepare(`UPDATE provider_update_suggestions SET status = 'rejected', reviewed_at = CURRENT_TIMESTAMP WHERE submission_id = ?`).bind(id));
  }

  statements.push(env.DIRECTORY_DB.prepare(`UPDATE submissions SET status = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'`).bind(action, id));
  statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO approval_events (submission_id, action, actor, note) VALUES (?, ?, 'local-admin', ?)`)
    .bind(id, action, clean(body.note, 500) || null));
  try {
    await env.DIRECTORY_DB.batch(statements);
    return json({ ok: true, id, status: action });
  } catch (error) {
    console.error('Review decision failed:', error?.message || error);
    return json({ error: 'The review decision could not be saved.' }, 503);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/health') return json({ ok: true, service: 'acting-class-directory', databaseConfigured: Boolean(env.DIRECTORY_DB) });
    const legacyTypes = { '/directory': 'all', '/studios': 'studios', '/classes': 'classes', '/coaches': 'coaches' };
    if (legacyTypes[url.pathname] && request.method === 'GET') {
      const target = new URL('/', url);
      for (const [key, value] of url.searchParams) target.searchParams.set(key, value);
      if (legacyTypes[url.pathname] === 'all') target.searchParams.delete('type');
      else target.searchParams.set('type', legacyTypes[url.pathname]);
      return Response.redirect(target, 302);
    }
    if (url.pathname === '/api/directory' && request.method === 'GET') return getPublicListing(request, env);
    if (url.pathname.startsWith('/api/providers/') || url.pathname.startsWith('/api/offerings/') || url.pathname.startsWith('/api/teachers/')) return getPublicListing(request, env);
    if (url.pathname === '/api/submissions') return submit(request, env);
    if (url.pathname === '/api/admin/submissions' && request.method === 'GET') return adminSubmissions(request, env);
    if (url.pathname === '/api/admin/decision') return decideSubmission(request, env);
    if (url.pathname === '/sitemap.xml' && request.method === 'GET') return sitemap(request, env);
    if (url.pathname === '/robots.txt' && request.method === 'GET') return robots(request);
    if (url.pathname === '/' && url.searchParams.has('listing')) return seoQueryProfile(request, env, clean(url.searchParams.get('listing'), 160));
    const providerMatch = url.pathname.match(/^\/providers\/([a-z0-9-]+)\/?$/i);
    if (providerMatch && request.method === 'GET') return seoProfile(request, env, providerMatch[1], 'provider');
    const offeringMatch = url.pathname.match(/^\/classes\/([a-z0-9-]+)\/?$/i);
    if (offeringMatch && request.method === 'GET') return seoProfile(request, env, offeringMatch[1], 'offering');
    const teacherMatch = url.pathname.match(/^\/teachers\/([a-z0-9-]+)\/?$/i);
    if (teacherMatch && request.method === 'GET') return seoProfile(request, env, teacherMatch[1], 'teacher');
    return env.ASSETS.fetch(request);
  },
};

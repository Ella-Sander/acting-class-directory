import { readFile, writeFile } from 'node:fs/promises';

const manifest = JSON.parse(await readFile(new URL('../data/verified-nyc-accent-dialect-expansion.json', import.meta.url), 'utf8'));
const quote = value => value == null ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`;
const slug = value => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const normalizeUrl = value => value.toLowerCase().replace(/^https?:\/\/(?:www\.)?/, '').replace(/\/$/, '');
const seenNames = new Set();
const seenUrls = new Set();
for (const provider of manifest.records) {
  const normalizedName = provider.name.trim().toLowerCase();
  const normalizedUrl = normalizeUrl(provider.url);
  if (seenNames.has(normalizedName)) throw new Error(`Duplicate provider name: ${provider.name}`);
  if (seenUrls.has(normalizedUrl)) throw new Error(`Duplicate official URL: ${provider.url}`);
  seenNames.add(normalizedName);
  seenUrls.add(normalizedUrl);
}

const lines = [
  '-- Add only reviewed NYC-area accent and dialect providers with official-site evidence.',
  `-- Reviewed ${manifest.reviewedAt}. Source of record: data/verified-nyc-accent-dialect-expansion.json.`,
  '-- Additive only. Each record is one independently operated provider and one primary official website.',
  '-- Private format and delivery mode are populated only from explicit official-site statements.',
  '',
];

for (const p of manifest.records) {
  const id = p.id;
  const slugBase = `${slug(p.name)}-${slug(id)}`;
  const siteId = `site-${id}`;
  const locationId = `location-${id}`;
  const offeringId = `${p.format === 'Private' ? 'private' : 'service'}-${id}`;
  const normalizedUrl = normalizeUrl(p.url);
  const delivery = ({ hybrid: 'hybrid', in_person: 'in_person', online: 'online' })[p.delivery] ?? null;
  const priceMin = p.price?.min ?? null;
  const priceMax = p.price?.max ?? null;
  const priceBasis = p.price?.basis ?? null;
  const priceSource = p.url;
  lines.push(
    'INSERT INTO providers (id,slug,listing_type,name,description,website_url,source_url,listing_status,claim_status,origin,provider_classification)',
    `SELECT ${quote(id)},${quote(slugBase)},'coach',${quote(p.name)},${quote([p.description, p.credentials].filter(Boolean).join(' '))},${quote(p.url)},${quote(p.url)},'published','unclaimed','seeded',${quote(p.classification)}`,
    `WHERE NOT EXISTS (SELECT 1 FROM providers WHERE lower(rtrim(replace(replace(replace(trim(website_url),'www.',''),'https://',''),'http://',''),'/'))=lower(rtrim(replace(replace(replace(trim(${quote(p.url)}),'www.',''),'https://',''),'http://',''),'/')));`,
    'INSERT OR IGNORE INTO provider_site_urls (id,provider_id,url,normalized_url,url_role,is_primary,verification_status,source_url,verified_at)',
    `SELECT ${quote(siteId)},${quote(id)},${quote(p.url)},${quote(normalizedUrl)},'official',1,'verified',${quote(p.url)},${quote(manifest.reviewedAt)} WHERE EXISTS (SELECT 1 FROM providers WHERE id=${quote(id)});`,
    'INSERT OR IGNORE INTO field_evidence (entity_type,entity_id,field_name,verification_status,source_url,verified_at,note)',
    `SELECT 'provider',${quote(id)},'official_website','verified',${quote(p.url)},${quote(manifest.reviewedAt)},'Official provider website reviewed; it advertises the listed independent accent, dialect, or speech service.' WHERE EXISTS (SELECT 1 FROM providers WHERE id=${quote(id)});`,
    'INSERT OR IGNORE INTO field_evidence (entity_type,entity_id,field_name,verification_status,source_url,verified_at,note)',
    `SELECT 'provider',${quote(id)},'provider_classification','verified',${quote(p.url)},${quote(manifest.reviewedAt)},'Official site identifies an independently operated professional or private practice.' WHERE EXISTS (SELECT 1 FROM providers WHERE id=${quote(id)});`,
    'INSERT OR IGNORE INTO locations (id,label,city,region,country_code,borough,neighborhood,is_online)',
    `SELECT ${quote(locationId)},${quote(p.location)},'New York','NY','US',NULL,NULL,0 WHERE EXISTS (SELECT 1 FROM providers WHERE id=${quote(id)});`,
    `INSERT OR IGNORE INTO provider_locations (provider_id,location_id,is_primary) SELECT ${quote(id)},${quote(locationId)},1 WHERE EXISTS (SELECT 1 FROM providers WHERE id=${quote(id)});`,
    `INSERT INTO offerings (id,slug,provider_id,name,description,genre_specialty,instruction_mode,format,price_min,price_max,currency,price_basis,source_url,listing_status,origin)`,
    `SELECT ${quote(offeringId)},${quote(`${slug(p.name)}-${p.format === 'Private' ? 'private-lessons' : 'accent-services'}`)},${quote(id)},${quote(`${p.format === 'Private' ? 'Private ' : ''}${p.specialty}`)},${quote(p.description)},${quote(p.specialty)},${p.format === 'Private' ? "'private'" : 'NULL'},${quote(delivery)},${priceMin},${priceMax},${p.price ? "'USD'" : 'NULL'},${quote(priceBasis)},${quote(p.serviceSource ?? p.url)},'published','seeded' WHERE EXISTS (SELECT 1 FROM providers WHERE id=${quote(id)}) AND NOT EXISTS (SELECT 1 FROM offerings WHERE id=${quote(offeringId)});`,
    'INSERT OR IGNORE INTO field_evidence (entity_type,entity_id,field_name,verification_status,source_url,verified_at,note)',
    `SELECT 'offering',${quote(offeringId)},'instruction_mode',${quote(p.format === 'Private' ? 'verified' : 'not_provided')},${quote(p.serviceSource ?? p.url)},${quote(manifest.reviewedAt)},${quote(p.format === 'Private' ? 'Official service page explicitly describes individual, one-on-one, or private instruction.' : 'Official site advertises the accent or dialect service but does not explicitly state the lesson format; left unconfirmed.') } WHERE EXISTS (SELECT 1 FROM offerings WHERE id=${quote(offeringId)});`,
  );
  if (delivery) {
    lines.push(
      'INSERT OR IGNORE INTO field_evidence (entity_type,entity_id,field_name,verification_status,source_url,verified_at,note)',
      `SELECT 'offering',${quote(offeringId)},'format','verified',${quote(p.serviceSource ?? p.url)},${quote(manifest.reviewedAt)},'The official site explicitly describes the delivery mode recorded for this service.' WHERE EXISTS (SELECT 1 FROM offerings WHERE id=${quote(offeringId)});`,
    );
  }
  if (p.price) {
    lines.push(
      'INSERT OR IGNORE INTO field_evidence (entity_type,entity_id,field_name,verification_status,source_url,verified_at,note)',
      `SELECT 'offering',${quote(offeringId)},'price','verified',${quote(priceSource)},${quote(manifest.reviewedAt)},'Published price transcribed from the official provider page.' WHERE EXISTS (SELECT 1 FROM offerings WHERE id=${quote(offeringId)});`,
    );
  }
  lines.push('');
}

await writeFile(new URL('../migrations/0029_verified_nyc_accent_dialect_providers.sql', import.meta.url), lines.join('\n'), 'utf8');
console.log(`Generated migration 0029 for ${manifest.records.length} reviewed providers.`);

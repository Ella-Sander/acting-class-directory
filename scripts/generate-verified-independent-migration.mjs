import { readFile, writeFile } from 'node:fs/promises';

const manifest = JSON.parse(await readFile(new URL('../data/verified-independent-provider-expansion.json', import.meta.url), 'utf8'));
const quote = (value) => value == null ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`;
const slug = (value) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const normalizeUrl = (value) => value.toLowerCase().replace('https://www.', 'https://').replace('http://www.', 'http://').replace(/\/$/, '');
const batches = Map.groupBy(manifest.records, (provider) => provider.migration ?? '0019');
for (const [migration, records] of batches) {
  const lines = [
    '-- Add only reviewed independent New York City providers with official-site evidence.',
    `-- Reviewed ${manifest.reviewedAt}. Source of record: data/verified-independent-provider-expansion.json.`,
    '-- Additive only; existing records are retained. Private format is sourced to the provider official site.',
    '',
  ];

for (const provider of records) {
  const { id, name, url, classification, specialty, location, description, credentials } = provider;
  const descriptionWithCredentials = [description, credentials].filter(Boolean).join(' ');
  const exists = `EXISTS (SELECT 1 FROM providers WHERE id=${quote(id)})`;
  const privateId = `private-${id}`;
  lines.push(
    'INSERT INTO providers (id,slug,listing_type,name,description,website_url,source_url,listing_status,claim_status,origin,provider_classification)',
    `SELECT ${quote(id)},${quote(`${slug(name)}-${slug(id)}`)},'coach',${quote(name)},${quote(descriptionWithCredentials)},${quote(url)},${quote(url)},'published','unclaimed','seeded',${quote(classification)}`,
    `WHERE NOT EXISTS (SELECT 1 FROM providers WHERE lower(trim(name))=lower(trim(${quote(name)})) AND lower(trim(website_url))=lower(trim(${quote(url)})));`,
    'INSERT OR IGNORE INTO provider_site_urls (id,provider_id,url,normalized_url,url_role,is_primary,verification_status,source_url,verified_at)',
    `SELECT ${quote(`site-${id}`)},${quote(id)},${quote(url)},${quote(normalizeUrl(url))},'official',1,'verified',${quote(url)},${quote(manifest.reviewedAt)} WHERE ${exists};`,
    'INSERT OR IGNORE INTO field_evidence (entity_type,entity_id,field_name,verification_status,source_url,verified_at,note)',
    `SELECT 'provider',${quote(id)},'official_website','verified',${quote(url)},${quote(manifest.reviewedAt)},'Official website reviewed; it advertises the listed independent private service.' WHERE ${exists};`,
    'INSERT OR IGNORE INTO field_evidence (entity_type,entity_id,field_name,verification_status,source_url,verified_at,note)',
    `SELECT 'provider',${quote(id)},'provider_classification','verified',${quote(url)},${quote(manifest.reviewedAt)},'Reviewed official site identifies an independent teacher or independently operated studio/business.' WHERE ${exists};`,
    'INSERT OR IGNORE INTO locations (id,label,city,region,country_code,borough,neighborhood,is_online)',
    `SELECT ${quote(`location-${id}`)},${quote(location)},'New York','NY','US',NULL,NULL,0 WHERE ${exists};`,
    `INSERT OR IGNORE INTO provider_locations (provider_id,location_id,is_primary) SELECT ${quote(id)},${quote(`location-${id}`)},1 WHERE ${exists};`,
    'INSERT INTO offerings (id,slug,provider_id,name,description,genre_specialty,instruction_mode,source_url,listing_status,origin)',
    `SELECT ${quote(privateId)},${quote(`${slug(name)}-private-lessons`)},${quote(id)},${quote(`Private ${specialty}`)},${quote(description)},${quote(specialty)},'private',${quote(url)},'published','seeded' WHERE ${exists} AND NOT EXISTS (SELECT 1 FROM offerings WHERE id=${quote(privateId)});`,
    'INSERT OR IGNORE INTO field_evidence (entity_type,entity_id,field_name,verification_status,source_url,verified_at,note)',
    `SELECT 'offering',${quote(privateId)},'instruction_mode','verified',${quote(url)},${quote(manifest.reviewedAt)},'Official provider page explicitly offers private, one-to-one, or private-studio instruction.' WHERE EXISTS (SELECT 1 FROM offerings WHERE id=${quote(privateId)});`,
    '',
  );
}

await writeFile(new URL(`../migrations/${migration}_verified_independent_providers.sql`, import.meta.url), lines.join('\n'), 'utf8');
console.log(`Generated migration ${migration} for ${records.length} reviewed providers.`);
}

import { parse } from 'tldts';
import { MERGE_FIELDS, TEXT_FIELDS } from './provider-merge-fields.js';
export { MERGE_FIELDS, TEXT_FIELDS } from './provider-merge-fields.js';

export function providerDomain(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    const result = parse(host, { allowPrivateDomains: false });
    // Identity follows the ICANN registrable domain, including all subdomains.
    return result.isIcann && !result.isIp && result.domain ? result.domain : '';
  } catch { return ''; }
}

const present = value => value !== null && value !== undefined && String(value).trim() !== '';
export function mergeFields(existing, incoming, resolutions = {}, fieldNames = MERGE_FIELDS) {
  const fields = {}; const conflicts = [];
  for (const field of fieldNames) {
    const current = existing[field] ?? null;
    const next = incoming[field] ?? null;
    const conflict = present(current) && present(next) && current !== next;
    const resolution = resolutions[field];
    let value = present(current) ? current : next;
    if (conflict) {
      if (!resolution || !['existing', 'incoming', 'combine', 'edit'].includes(resolution.choice)) conflicts.push(field);
      else if (resolution.choice === 'incoming') value = next;
      else if (resolution.choice === 'combine') {
        if (!TEXT_FIELDS.includes(field)) conflicts.push(field);
        else value = [current, next].join('\n\n');
      } else if (resolution.choice === 'edit') {
        if (typeof resolution.value !== 'string' || !resolution.value.trim() || resolution.value.length > 12000) conflicts.push(field);
        else value = resolution.value.trim();
      }
    } else if (resolution?.choice === 'edit') {
      if (typeof resolution.value !== 'string' || !resolution.value.trim() || resolution.value.length > 12000) conflicts.push(field);
      else value = resolution.value.trim();
    }
    fields[field] = value;
  }
  return { fields, conflicts };
}

export async function findDomainProvider(env, website) {
  const domain = providerDomain(website);
  if (!domain) return null;
  return env.DIRECTORY_DB.prepare(`SELECT p.* FROM provider_domains d JOIN providers p ON p.id=d.provider_id WHERE d.domain=? AND p.listing_status='published'`).bind(domain).first();
}

export function registerDomain(statements, env, providerId, website) {
  const domain = providerDomain(website);
  if (!domain) throw new Error('An official website with a registrable domain is required.');
  statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO provider_domains(domain,provider_id) VALUES (?,?) ON CONFLICT(domain) DO UPDATE SET provider_id=excluded.provider_id WHERE provider_domains.provider_id=excluded.provider_id`).bind(domain, providerId));
  statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO provider_merge_guards(id,valid) SELECT ?,CASE WHEN EXISTS(SELECT 1 FROM provider_domains WHERE domain=? AND provider_id=?) THEN 1 ELSE 0 END`).bind(crypto.randomUUID(), domain, providerId));
  statements.push(env.DIRECTORY_DB.prepare(`UPDATE providers SET registrable_domain=? WHERE id=?`).bind(domain, providerId));
}

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const config = JSON.parse(readFileSync('wrangler.production.jsonc', 'utf8'));
const account = '735c5b7e1a6013843699cc6e6fb4b5f6';
const credentials = readFileSync(join(process.env.APPDATA, 'xdg.config', '.wrangler', 'config', 'default.toml'), 'utf8');
const token = process.env.CLOUDFLARE_API_TOKEN || credentials.match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];
if (!token) throw new Error('No current Cloudflare credential is available.');
async function api(path) {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json();
  if (!response.ok || !data.success) return { unavailable: true, status: response.status, errors: data.errors?.map(error => ({ code: error.code, message: error.message })) };
  return data.result;
}
const [zones, domains, settings] = await Promise.all([
  api('/zones?name=vocalcatalog.com'),
  api(`/accounts/${account}/workers/domains`),
  api(`/accounts/${account}/workers/scripts/${config.name}/settings`),
]);
const zone = Array.isArray(zones) ? zones.find(zone => zone.name === 'vocalcatalog.com') : null;
const details = zone ? await Promise.all([api(`/zones/${zone.id}/dns_records?name=vocalcatalog.com`), api(`/zones/${zone.id}/dns_records?name=www.vocalcatalog.com`), api(`/zones/${zone.id}/ssl/certificate_packs?status=all`)]) : [];
const audit = {
  zone: zone ? { id: zone.id, name: zone.name, status: zone.status, name_servers: zone.name_servers } : zones,
  workerDomains: Array.isArray(domains) ? domains.filter(domain => domain.service === config.name || /(^|\.)vocalcatalog\.com$/.test(domain.hostname)) : domains,
  bindings: settings.bindings?.map(binding => ({ name: binding.name, type: binding.type, ...(binding.type === 'd1' ? { id: binding.id } : {}) })) || settings,
  dns: details.slice(0, 2).map(records => Array.isArray(records) ? records.map(record => ({ type: record.type, name: record.name, content: record.content, proxied: record.proxied })) : records),
  certificates: Array.isArray(details[2]) ? details[2].map(pack => ({ status: pack.status, hosts: pack.hosts, type: pack.type })) : details[2],
};
writeFileSync('docs/cloudflare-launch-audit.json', JSON.stringify(audit, null, 2) + '\n');
console.log(JSON.stringify(audit, null, 2));

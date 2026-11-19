import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const credentials = readFileSync(join(process.env.APPDATA, 'xdg.config', '.wrangler', 'config', 'default.toml'), 'utf8');
const token = process.env.CLOUDFLARE_API_TOKEN || credentials.match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];
for (const path of ['/accounts/735c5b7e1a6013843699cc6e6fb4b5f6/email/routing/addresses', '/zones/60459b5a267a0a158b536e37eea35690/email/routing', '/zones/60459b5a267a0a158b536e37eea35690/email/routing/dns']) {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json();
  const result = Array.isArray(data.result) && path.endsWith('/addresses') ? data.result.filter(item => item.email === 'headshotscout.support@gmail.com').map(item => ({ email: item.email, verified: item.verified })) : data.result;
  console.log(JSON.stringify({ path, status: response.status, success: data.success, result, errors: data.errors }));
}

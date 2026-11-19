import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const credentials = readFileSync(join(process.env.APPDATA, 'xdg.config', '.wrangler', 'config', 'default.toml'), 'utf8');
const token = process.env.CLOUDFLARE_API_TOKEN || credentials.match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];
const endpoint = 'https://api.cloudflare.com/client/v4/accounts/735c5b7e1a6013843699cc6e6fb4b5f6/email/routing/addresses';
const email = 'headshotscout.support@gmail.com';
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const current = await (await fetch(endpoint, { headers })).json();
if (!current.success) throw new Error('Cannot inspect email destination addresses.');
let address = current.result.find(item => item.email === email);
if (!address) {
  const result = await (await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ email }) })).json();
  if (!result.success) throw new Error(JSON.stringify(result.errors));
  address = result.result;
}
console.log(JSON.stringify({ email, verified: address.verified || false, verificationRequired: !address.verified }));

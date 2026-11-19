import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const credentials = readFileSync(join(process.env.APPDATA, 'xdg.config', '.wrangler', 'config', 'default.toml'), 'utf8');
const token = process.env.CLOUDFLARE_API_TOKEN || credentials.match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const endpoint = 'https://api.cloudflare.com/client/v4/accounts/735c5b7e1a6013843699cc6e6fb4b5f6/storage/kv/namespaces';
const title = 'vocal-catalog-public-cache';
let result = await (await fetch(endpoint + '?per_page=100', { headers })).json();
if (!result.success) throw new Error(JSON.stringify(result.errors));
let namespace = result.result.find(item => item.title === title);
if (!namespace) { result = await (await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ title }) })).json(); if (!result.success) throw new Error(JSON.stringify(result.errors)); namespace = result.result; }
const config = JSON.parse(readFileSync('wrangler.production.jsonc', 'utf8'));
config.kv_namespaces = [...(config.kv_namespaces || []).filter(binding => binding.binding !== 'PUBLIC_CACHE_STORE'), { binding: 'PUBLIC_CACHE_STORE', id: namespace.id }];
writeFileSync('wrangler.production.jsonc', JSON.stringify(config, null, 2) + '\n');
console.log(JSON.stringify({ namespace: namespace.title, binding: 'PUBLIC_CACHE_STORE', id: namespace.id }));

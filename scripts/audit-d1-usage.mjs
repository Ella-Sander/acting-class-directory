import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const credentials = readFileSync(join(process.env.APPDATA, 'xdg.config', '.wrangler', 'config', 'default.toml'), 'utf8');
const token = process.env.CLOUDFLARE_API_TOKEN || credentials.match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];
const query = `query { viewer { accounts(filter:{accountTag:"735c5b7e1a6013843699cc6e6fb4b5f6"}) { d1AnalyticsAdaptiveGroups(limit:10,filter:{date_geq:"2026-11-13",date_leq:"2026-11-15",databaseId:"05ca97de-b898-45ab-8740-6f8f1456ef6d"},orderBy:[date_ASC]) { sum { readQueries writeQueries rowsRead rowsWritten } dimensions {date databaseId} } } } }`;
const response = await fetch('https://api.cloudflare.com/client/v4/graphql', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
const report = { status: response.status, result: await response.json(), note: 'Successful SQL execution statistics alone do not prove the cause of historical failed requests.' };
writeFileSync('docs/d1-usage-audit.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));

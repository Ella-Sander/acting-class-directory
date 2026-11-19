import { readFileSync } from 'node:fs';
const text = readFileSync('.dev.vars', 'utf8');
const raw = text.match(/^ADMIN_REVIEW_KEY\s*=\s*(.+)$/m)?.[1].trim();
if (!raw) throw new Error('The local review credential is unavailable; no test email was attempted.');
const key = raw.replace(/^['"]|['"]$/g, '');
const response = await fetch('https://vocalcatalog.com/api/admin/email-test', { method: 'POST', headers: { Authorization: `Bearer ${key}` } });
console.log(JSON.stringify({ status: response.status, result: await response.json() }));
if (!response.ok) process.exitCode = 1;

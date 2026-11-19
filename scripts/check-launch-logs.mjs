import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { PUBLIC_ORIGIN } from '../src/brand.js';
const child = spawn(process.execPath, ['node_modules/wrangler/wrangler-dist/cli.js', 'tail', '--config', 'wrangler.production.jsonc', '--format', 'json'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let output = ''; let errors = '';
child.stdout.on('data', chunk => { if (output.length < 500000) output += chunk.toString(); });
child.stderr.on('data', chunk => { if (errors.length < 50000) errors += chunk.toString(); });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  await pause(6000);
  for (let i = 0; i < 5; i++) { await fetch(`${PUBLIC_ORIGIN}${i % 2 ? '/' : '/api/health'}`, { signal: AbortSignal.timeout(10000) }); await pause(1000); }
  await pause(3000);
} finally {
  child.kill();
  // Do not persist raw tail events: request headers can contain private data.
  const outcomes = [...output.matchAll(/"outcome"\s*:\s*"([^"]+)"/g)].map(match => match[1]);
  const report = { checkedAt: new Date().toISOString(), events: outcomes.length, outcomes, exceptions: /"exceptions"\s*:\s*\[\s*\{/.test(output), errorLogs: /"level"\s*:\s*"error"/.test(output), connectionError: /\bERROR\b|Authentication error|Unauthorized/.test(errors), rawEventsSaved: false };
  writeFileSync('docs/launch-log-check.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
  if (!outcomes.length || report.exceptions || report.errorLogs || report.connectionError || outcomes.some(outcome => outcome !== 'ok')) process.exitCode = 1;
}

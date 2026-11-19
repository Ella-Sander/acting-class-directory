import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { request as httpsRequest } from 'node:https';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import catalog from '../data/listing-logos.json' with { type: 'json' };
import { safeMetadataImageUrl } from '../src/metadata-image.js';

const execFileAsync = promisify(execFile);
const root = process.cwd();
const progressPath = resolve(root, 'data/provider-og-image-progress.json');
const outputPath = resolve(root, 'data/provider-og-images.json');
const sqlPath = resolve(root, 'migrations/0031_provider_metadata_images.sql');
const RATE_LIMIT_MS = 1000;
const MAX_HTML_BYTES = 2_000_000;
const MAX_IMAGE_BYTES = 6_000_000;
const DNS_TIMEOUT_MS = 5_000;
const HTTP_TIMEOUT_MS = 5_000;
let lastRequestAt = 0;

function quote(value) {
  return value == null ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`;
}

function isPublicAddress(address) {
  const version = isIP(address);
  if (version === 4) {
    const [a, b, c] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 192 && b === 0 && (c === 0 || c === 2)) ||
      (a === 198 && (b === 18 || b === 19 || b === 51 && c === 100)) ||
      (a === 203 && b === 0 && c === 113));
  }
  if (version === 6) {
    const normalized = address.toLowerCase().split('%')[0];
    return !(normalized === '::' || normalized === '::1' || normalized.startsWith('fc') ||
      normalized.startsWith('fd') || /^fe[89ab]/.test(normalized) || normalized.startsWith('ff') ||
      normalized.startsWith('2001:db8:') || normalized.startsWith('::ffff:'));
  }
  return false;
}

async function validatePublicUrl(value) {
  const canonical = safeMetadataImageUrl(value);
  if (!canonical) throw new Error('URL is not an allowed HTTPS image/page URL');
  const url = new URL(canonical);
  let dnsTimer;
  const records = await Promise.race([
    lookup(url.hostname, { all: true, verbatim: true }),
    new Promise((_, reject) => { dnsTimer = setTimeout(() => reject(new Error('DNS lookup timed out')), DNS_TIMEOUT_MS); }),
  ]).finally(() => clearTimeout(dnsTimer));
  if (!records.length || records.some(record => !isPublicAddress(record.address))) throw new Error('Host did not resolve exclusively to public addresses');
  return { url, records };
}

async function throttledRequest(url, headers, limit) {
  const validated = await validatePublicUrl(url.href);
  const wait = RATE_LIMIT_MS - (Date.now() - lastRequestAt);
  if (wait > 0) await new Promise(resolveTimer => setTimeout(resolveTimer, wait));
  lastRequestAt = Date.now();

  return new Promise((resolveResponse, reject) => {
    const host = validated.url.hostname;
    const request = httpsRequest(validated.url, {
      method: 'GET',
      headers,
      timeout: HTTP_TIMEOUT_MS,
      lookup: (_hostname, options, callback) => {
        if (options?.all) callback(null, validated.records);
        else callback(null, validated.records[0].address, validated.records[0].family);
      },
      servername: host,
    }, response => {
      const status = response.statusCode || 0;
      const location = response.headers.location;
      if (status >= 300 && status < 400 && location) {
        response.resume();
        resolveResponse({ status, location, headers: response.headers, body: Buffer.alloc(0), url: validated.url });
        return;
      }
      const declared = Number(response.headers['content-length'] || 0);
      if (declared > limit) {
        request.destroy(new Error('Response exceeded size limit'));
        return;
      }
      const chunks = [];
      let size = 0;
      response.on('data', chunk => {
        size += chunk.length;
        if (size > limit) request.destroy(new Error('Response exceeded size limit'));
        else chunks.push(chunk);
      });
      response.on('end', () => resolveResponse({ status, location: null, headers: response.headers, body: Buffer.concat(chunks), url: validated.url }));
      response.on('error', reject);
    });
    request.on('timeout', () => request.destroy(new Error('Request timed out')));
    request.on('error', reject);
    request.end();
  });
}

async function requestFollowingRedirects(startUrl, headers, limit, maxRedirects = 4) {
  let current = new URL(startUrl);
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const response = await throttledRequest(current, headers, limit);
    if (!response.location) return response;
    if (hop === maxRedirects) throw new Error('Too many redirects');
    current = new URL(response.location, response.url);
    if (!safeMetadataImageUrl(current.href)) throw new Error('Redirect target is not an allowed HTTPS URL');
  }
  throw new Error('Redirect handling failed');
}

function decodeHtml(value) {
  const decodeCodePoint = code => {
    const point = Number.parseInt(code.replace(/^x/i, ''), code[0].toLowerCase() === 'x' ? 16 : 10);
    if (!Number.isInteger(point) || point < 0 || point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff)) return '\uFFFD';
    return String.fromCodePoint(point);
  };
  return value.replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(x[\da-f]+|\d+);/gi, (_match, code) => decodeCodePoint(code));
}

function attributes(tag) {
  const result = {};
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    result[match[1].toLowerCase()] = decodeHtml(match[2] ?? match[3] ?? match[4] ?? '');
  }
  return result;
}

function imageCandidates(html) {
  const openGraph = [];
  const twitter = [];
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const meta = attributes(tag);
    const key = (meta.property || meta.name || '').toLowerCase();
    if (key === 'og:image' || key === 'og:image:url') openGraph.push(meta.content);
    if (key === 'twitter:image' || key === 'twitter:image:src') twitter.push(meta.content);
  }
  return { openGraph: openGraph.filter(Boolean), twitter: twitter.filter(Boolean) };
}

function rasterImageType(contentType, body) {
  const type = contentType?.split(';')[0].trim().toLowerCase();
  if (type === 'image/png' && body.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return type;
  if (type === 'image/jpeg' && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff) return type;
  if (type === 'image/gif' && ['GIF87a','GIF89a'].includes(body.subarray(0, 6).toString())) return type;
  if (type === 'image/webp' && body.subarray(0, 4).toString() === 'RIFF' && body.subarray(8, 12).toString() === 'WEBP') return type;
  if (type === 'image/avif' && body.subarray(4, 12).toString().includes('ftyp') && /avif|avis/.test(body.subarray(8, 16).toString())) return type;
  return '';
}

async function validatedImage(candidate, pageUrl) {
  let imageUrl;
  try { imageUrl = new URL(candidate, pageUrl); }
  catch { return null; }
  if (!safeMetadataImageUrl(imageUrl.href)) return null;
  try {
    const response = await requestFollowingRedirects(imageUrl.href, { accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.8,*/*;q=0.1', 'user-agent': 'VocalCatalogMetadataAudit/1.0' }, MAX_IMAGE_BYTES);
    if (response.status !== 200 || !rasterImageType(response.headers['content-type'], response.body)) return null;
    return response.url.href;
  } catch {
    return null;
  }
}

async function queryProviders() {
  const query = "SELECT id,name,website_url,metadata_image_checked_at FROM providers WHERE listing_status='published' ORDER BY id";
  const wrangler = resolve(root, 'node_modules/wrangler/bin/wrangler.js');
  const { stdout } = await execFileAsync(process.execPath, [wrangler, 'd1', 'execute', 'acting-class-directory', '--remote', '--json', '--config', 'wrangler.production.jsonc', '--command', query], { cwd: root, maxBuffer: 2_000_000 });
  const output = JSON.parse(stdout);
  const queries = Array.isArray(output) ? output : [output];
  return queries.flatMap(queryResult => queryResult.results || []);
}

async function finalizeBatch(completed, totalProviders) {
  for (const record of completed) {
    if (record.imageUrl && (!safeMetadataImageUrl(record.imageUrl) || !['og:image', 'twitter:image'].includes(record.type))) {
      throw new Error(`Invalid checkpoint image for ${record.id}`);
    }
  }
  const manifest = { reviewedAt: new Date().toISOString(), providers: completed };
  await writeFile(outputPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  const sql = [];
  if (completed.length) {
    const fields = [
      ['metadata_image_url', record => record.imageUrl],
      ['metadata_image_source_url', record => record.sourceUrl],
      ['metadata_image_type', record => record.type],
      ['metadata_image_checked_at', record => record.checkedAt],
    ];
    const assignments = fields.map(([field, getter]) => `${field}=CASE id ${completed.map(record => `WHEN ${quote(record.id)} THEN ${quote(getter(record))}`).join(' ')} END`);
    sql.push(`UPDATE providers SET\n  ${assignments.join(',\n  ')}\nWHERE id IN (${completed.map(record => quote(record.id)).join(',')}) AND metadata_image_checked_at IS NULL;`);
  }
  await writeFile(sqlPath, `-- Batch-validated Open Graph/Twitter image metadata; no runtime URL discovery.\n${sql.join('\n')}\n`, 'utf8');
  await rm(progressPath, { force: true });
  const found = completed.filter(record => record.imageUrl).length;
  console.log(`Batch finalized: ${totalProviders} providers, ${completed.length} checked, ${found} validated images, ${completed.length - found} placeholders retained.`);
  console.log(`Wrote ${outputPath} and ${sqlPath}; existing curated logos were excluded from the batch.`);
}

async function main() {
  let completed = [];
  try { completed = JSON.parse(await readFile(progressPath, 'utf8')).records || []; } catch { /* First batch run. */ }
  if (process.argv.includes('--finalize-checkpoint')) {
    await finalizeBatch(completed, 122);
    return;
  }

  const providers = await queryProviders();
  const logoIds = new Set(Object.entries(catalog.brands).filter(([, brand]) => brand.status === 'verified').map(([id]) => id));
  const finishedIds = new Set(completed.map(record => record.id));
  const candidates = providers.filter(provider => !logoIds.has(provider.id) && !provider.metadata_image_checked_at && !finishedIds.has(provider.id));
  console.log(`Checking metadata for ${candidates.length} published providers without a curated logo; network requests are limited to one per second.`);

  for (const provider of candidates) {
    const result = {
      id: provider.id,
      name: provider.name,
      sourceUrl: null,
      imageUrl: null,
      type: 'none',
      checkedAt: new Date().toISOString(),
    };
    const site = safeMetadataImageUrl(provider.website_url);
    if (site) {
      result.sourceUrl = site;
      try {
        const page = await requestFollowingRedirects(site, { accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1', 'user-agent': 'VocalCatalogMetadataAudit/1.0' }, MAX_HTML_BYTES);
        if (page.status === 200 && /(?:text\/html|application\/xhtml\+xml)/i.test(page.headers['content-type'] || '')) {
          const candidatesFromPage = imageCandidates(page.body.toString('utf8'));
          for (const candidate of candidatesFromPage.openGraph) {
            result.imageUrl = await validatedImage(candidate, page.url);
            if (result.imageUrl) { result.type = 'og:image'; break; }
          }
          if (!result.imageUrl) {
            for (const candidate of candidatesFromPage.twitter) {
              result.imageUrl = await validatedImage(candidate, page.url);
              if (result.imageUrl) { result.type = 'twitter:image'; break; }
            }
          }
          result.sourceUrl = page.url.href;
        }
      } catch (error) {
        result.error = error.message;
      }
    }
    completed.push(result);
    await writeFile(progressPath, JSON.stringify({ startedAt: completed[0]?.checkedAt, records: completed }, null, 2) + '\n', 'utf8');
    console.log(`${completed.length}/${candidates.length}: ${provider.name} — ${result.type}`);
  }

  await finalizeBatch(completed, providers.length);
}

await main();

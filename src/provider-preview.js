import puppeteer from '@cloudflare/puppeteer';
import { safeMetadataImageUrl } from './metadata-image.js';
const WEEK = 7 * 24 * 60 * 60;
export function publicAddress(address) {
  if (address.includes(':')) return !/^(?:0*:|::|f[cd]|fe[89ab]|ff|2001:db8|::ffff)/i.test(address) && /^[0-9a-f:]+$/i.test(address);
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a,b,c] = parts;
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0)) || (a === 198 && (b === 18 || b === 19 || b === 51 && c === 100)) || (a === 203 && b === 0 && c === 113));
}
async function publicUrl(value, fetcher) {
  const safe = safeMetadataImageUrl(value);
  if (!safe) throw new Error('Preview URL is not public HTTPS.');
  const hostname = new URL(safe).hostname;
  const answers = await Promise.all(['A','AAAA'].map(async type => {
    const response = await fetcher(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=${type}`, { headers: { Accept: 'application/dns-json' }, signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error('DNS validation failed.');
    const result = await response.json();
    return (result.Answer || []).filter(answer => [1,28].includes(answer.type)).map(answer => answer.data);
  }));
  const addresses = answers.flat();
  if (!addresses.length || addresses.some(address => !publicAddress(address))) throw new Error('Preview host is not public.');
  return safe;
}
async function boundedText(response, limit) {
  if (!response.body) return '';
  const reader = response.body.getReader(); const chunks = []; let size = 0;
  try {
    while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > limit) throw new Error('Preview page is too large.'); chunks.push(value); }
  } finally { await reader.cancel().catch(() => {}); }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder().decode(bytes);
}
export function openGraphImage(html, base) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const attributes = Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)].map(match => [match[1].toLowerCase(), (match[2] ?? match[3] ?? match[4]).replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;/g,"'")]));
    if (['og:image','og:image:url'].includes((attributes.property || attributes.name || '').toLowerCase()) && attributes.content) {
      try { const url = safeMetadataImageUrl(new URL(attributes.content,base).href); if (url) return url; } catch { /* Try another metadata tag. */ }
    }
  }
  return '';
}
export async function refreshProviderPreview(env, providerId, website, invalidate) {
  const fetcher = env.PREVIEW_FETCH || fetch;
  try {
    const keyBytes = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(website));
    const key = `provider-preview:v1:${Array.from(new Uint8Array(keyBytes),n=>n.toString(16).padStart(2,'0')).join('')}`;
    let result = await env.PUBLIC_CACHE_STORE?.get(key, { type: 'json' });
    if (!result || Date.now() - result.savedAt >= WEEK * 1000) {
      const previewSite=new URL(website);if(previewSite.protocol==='http:')previewSite.protocol='https:';
      let url = await publicUrl(previewSite.href, fetcher); let html = '';
      for (let redirects = 0; redirects <= 4; redirects++) {
        const response = await fetcher(url, { redirect: 'manual', signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'VocalCatalog-Preview/1.0' } });
        if ([301,302,303,307,308].includes(response.status)) { await response.body?.cancel(); url = await publicUrl(new URL(response.headers.get('Location'),url).href,fetcher); continue; }
        if (!response.ok || !/text\/html/i.test(response.headers.get('Content-Type') || '')) { await response.body?.cancel();break; }
        html = await boundedText(response, 1_000_000); break;
      }
      let image = openGraphImage(html,url); let type = 'og:image';
      if (image) {
        try {
          image = await publicUrl(image, fetcher);
          const check = await fetcher(image, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(8000) });
          if (!check.ok || !/^image\/(png|jpe?g|webp|gif|avif)/i.test(check.headers.get('Content-Type') || '')) image = '';
        } catch { image = ''; }
      }
      if (!image) {
        if (!env.PROVIDER_BROWSER || !env.PUBLIC_CACHE_STORE) throw new Error('Screenshot binding unavailable; preview job can be retried.');
        const browser = await puppeteer.launch(env.PROVIDER_BROWSER);
        try {
          const page = await browser.newPage();
          await page.setJavaScriptEnabled(false);
          await page.setViewport({ width: 1200, height: 750 });
          const allowed = new Map();
          await page.setRequestInterception(true);
          page.on('request', request => {
            (async () => { const href = safeMetadataImageUrl(request.url());if(!href)throw new Error('Blocked browser request');const host=new URL(href).origin;if (!allowed.has(host)) allowed.set(host, publicUrl(href,fetcher)); await allowed.get(host); await request.continue(); })().catch(() => request.abort().catch(() => {}));
          });
          await page.goto(url,{ waitUntil:'domcontentloaded',timeout:15000 });
          const bytes = await page.screenshot({ type:'jpeg',quality:70 });
          if (bytes.length > 2_000_000) throw new Error('Screenshot exceeds cache limit.');
          let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
          await env.PUBLIC_CACHE_STORE.put(`provider-preview:image:${providerId}`,btoa(binary));
          image = `${env.CANONICAL_ORIGIN || 'https://vocalcatalog.com'}/api/provider-previews/${providerId}.jpg`; type = 'screenshot';
        } finally { await browser.close(); }
      }
      result = { image, type, savedAt: Date.now() };
      await env.PUBLIC_CACHE_STORE?.put(key,JSON.stringify(result),{expirationTtl:WEEK});
    }
    await env.DIRECTORY_DB.batch([
      env.DIRECTORY_DB.prepare(`UPDATE providers SET metadata_image_url=?,metadata_image_source_url=?,metadata_image_type=?,metadata_image_checked_at=CURRENT_TIMESTAMP WHERE id=? AND website_url=? AND listing_status='published'`).bind(result.image,website,result.type==='og:image'?'og:image':'none',providerId,website),
      env.DIRECTORY_DB.prepare(`UPDATE provider_preview_jobs SET status='complete',attempts=attempts+1,error=NULL WHERE provider_id=? AND website_url=?`).bind(providerId,website),
    ]);
    await invalidate(env);
  } catch(error) {
    console.warn('Provider preview refresh failed; retained previous approved image.');
    await env.DIRECTORY_DB.prepare(`UPDATE provider_preview_jobs SET status='failed',attempts=attempts+1,error=? WHERE provider_id=? AND website_url=?`).bind(String(error.message).slice(0,250),providerId,website).run();
  }
}

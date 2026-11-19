import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
const catalog = JSON.parse(await fs.readFile('data/dialect-coaches.json','utf8'));
const verification = JSON.parse(await fs.readFile('data/dialect-coach-verification.json','utf8'));
const logos = JSON.parse(await fs.readFile('data/listing-logos.json','utf8'));
// Only the professionals' own header/brand images: production/client and site-builder logos are excluded.
const selections = [
  ['shane-ann-younts', /saylogo\.png/, 'light'],
  ['linda-jones', /Linda-Jones-Actor-Audiobook-Narrator-Logo\.png/, 'light'],
  ['deena-kaye', /\/logo\.png/, 'light'],
  ['melanie-fox', /Logo_-SpeechFox_SVG-cropped\.svg/, 'light'],
  ['ben-furey', /Ben\+Furey-logo\.jpg/, 'light'],
  ['kristen-cerelli', /Horizontal-W-Tagline-BabyBlue/, 'dark'],
  ['leigh-dillon', /leighdillonLOGOv2/, 'light'],
];
for (const [slug,pattern,surface] of selections) {
  const coach = catalog.coaches.find(x => x.slug === `${slug}-dialect-coach`);
  const page = verification.checks.find(x => x.url === coach.source);
  const tag = page.logos.find(x => pattern.test(x));
  if (!tag) throw new Error(`Missing official brand: ${slug}`);
  const asset = tag.match(/data-src="([^"]+)"/)?.[1] || tag.match(/\bsrc="([^"]+)"/)?.[1];
  const assetUrl = new URL(asset,coach.source).href;
  const response = await fetch(assetUrl,{signal:AbortSignal.timeout(30000)});
  if (!response.ok) throw new Error(`${slug}: ${response.status}`);
  const mime = response.headers.get('content-type')?.split(';')[0];
  const extension = {'image/png':'png','image/jpeg':'jpg','image/svg+xml':'svg','image/webp':'webp'}[mime];
  if (!extension) throw new Error(`Unexpected image content type: ${mime}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 30 || bytes.length > 3000000) throw new Error(`Unexpected image size: ${slug}`);
  if (extension === 'svg' && /<script\b|<foreignObject\b|\bon\w+\s*=|(?:href|src)\s*=\s*["'](?:https?:|javascript:|\/\/)/i.test(bytes.toString())) throw new Error(`Unsafe SVG: ${slug}`);
  const id = `dialect-${slug}`;
  const url = `/logos/${id}.${extension}`;
  await fs.writeFile(`public${url}`,bytes);
  logos.brands[id] = {name:coach.name,url,sourceUrl:coach.source,assetUrl,surface,verifiedAt:catalog.reviewedAt,status:'verified',sha256:createHash('sha256').update(bytes).digest('hex')};
  console.log(`${coach.name}: ${bytes.length} bytes`);
}
logos.reviewedAt = catalog.reviewedAt;
await fs.writeFile('data/listing-logos.json',JSON.stringify(logos,null,2)+'\n');

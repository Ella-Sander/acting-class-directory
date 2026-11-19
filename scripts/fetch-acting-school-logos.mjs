import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
const catalog = JSON.parse(await fs.readFile('data/acting-school-voice.json','utf8'));
const logos = JSON.parse(await fs.readFile('data/listing-logos.json','utf8'));
for (const school of catalog.schools) {
  const { assetUrl, extension, surface, inline } = school.logo;
  const response = await fetch(assetUrl,{signal:AbortSignal.timeout(30000)});
  if (!response.ok) throw new Error(`${school.name}: HTTP ${response.status}`);
  let bytes = Buffer.from(await response.arrayBuffer());
  if (inline) {
    const match = bytes.toString().match(/class="site-logo site-header__site-logo"[^>]*>(<svg\b[\s\S]*?<\/svg>)/);
    if (!match) throw new Error('HB official header logo not found');
    bytes = Buffer.from(match[1]);
  }
  if (bytes.length < 30 || bytes.length > 3000000) throw new Error('Unexpected logo size');
  if (extension === 'svg' && (!bytes.toString().includes('<svg') || /<script\b|<foreignObject\b|\bon\w+\s*=|(?:href|src)\s*=\s*["'](?:https?:|javascript:|\/\/)/i.test(bytes.toString()))) throw new Error('Unsafe SVG');
  if (extension === 'png' && bytes.subarray(0,8).toString('hex') !== '89504e470d0a1a0a') throw new Error('Invalid PNG');
  const url = `/logos/${school.id}.${extension}`;
  await fs.writeFile(`public${url}`, bytes);
  logos.brands[school.id] = {name:school.name,url,sourceUrl:school.source,assetUrl,surface,verifiedAt:catalog.reviewedAt,status:'verified',sha256:createHash('sha256').update(bytes).digest('hex'),...(inline ? {note:'Original inline header SVG extracted unchanged from official source page.'} : {})};
  console.log(`${school.name}: ${bytes.length} bytes`);
}
logos.reviewedAt = catalog.reviewedAt;
await fs.writeFile('data/listing-logos.json', JSON.stringify(logos,null,2)+'\n');

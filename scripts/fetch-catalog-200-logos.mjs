import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

const entries = [
  ['nyu', 'NYU Steinhardt', 'https://steinhardt.nyu.edu/programs/vocal-performance/faculty-and-staff', 'https://steinhardt.nyu.edu/themes/custom/nyusteinhardt/assets/images/logo.svg'],
  ['msm', 'Manhattan School of Music', 'https://www.msmnyc.edu/', 'https://www.msmnyc.edu/wp-content/uploads/2018/05/cropped-MSM-Site-Icon-192x192.png'],
  ['mannes', 'Mannes School of Music — The New School', 'https://ww3.newschool.edu/mannes/voice-faculty/', 'https://ww3.newschool.edu/assets/img/school-logos/mannes_desktop.svg'],
  ['bms', 'Brooklyn Music School', 'https://www.brooklynmusicschool.org/faculty-and-staff', 'https://images.squarespace-cdn.com/content/v1/68eeb262291ea72f131dc57e/98c6c0e6-ff41-466b-90fe-73ac1c25d7f3/brooklyn+music+school+logo+CMYK-nobkgrnd+%285%29.png?format=300w'],
  ['academy', 'Voice Academy NYC', 'https://voiceacademynyc.com/vocal-coaches/', 'https://voiceacademynyc.com/wp-content/uploads/2025/05/nyc-logo.webp'],
  ['diller', 'The Diller-Quaile School of Music', 'https://www.diller-quaile.org/faculty', 'https://images.squarespace-cdn.com/content/v1/59cff91532601e11ca5d8f27/8f615be0-16d0-45fb-82ee-407050b68ab7/DQ-highres+logo.png?format=300w'],
];
const catalog = JSON.parse(await fs.readFile('data/listing-logos.json','utf8'));
for(const [key,name,sourceUrl,assetUrl] of entries){
  const response = await fetch(assetUrl,{signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error(`${key}: ${response.status}`);
  const mime = response.headers.get('content-type')?.split(';')[0];
  const ext = {'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/svg+xml':'svg'}[mime];
  if(!ext)throw new Error(`${key}: non-image response ${mime}`);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length<30||bytes.length>3000000)throw new Error(`${key}: invalid size`);
  if(ext==='svg'&&/<script\b|<foreignObject\b|\bon\w+\s*=|(?:href|src)\s*=\s*["'](?:https?:|javascript:|\/\/)/i.test(bytes.toString()))throw new Error(`${key}: active SVG content`);
  const id=`catalog2-provider-${key}`;
  const url=`/logos/${id}.${ext}`;
  await fs.writeFile('public'+url,bytes);
  catalog.brands[id]={name,url,sourceUrl,assetUrl,surface:key==='nyu'?'dark':'light',verifiedAt:'2026-11-10',status:'verified',sha256:createHash('sha256').update(bytes).digest('hex')};
  console.log(`${name}: ${bytes.length} bytes`);
}
await fs.writeFile('data/listing-logos.json',JSON.stringify(catalog,null,2)+'\n');

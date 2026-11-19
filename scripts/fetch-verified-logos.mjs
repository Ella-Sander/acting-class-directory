import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Curated selections from official pages, not a favicon/logo lookup service.
const selections = [
  ['catalog-provider-bkcm', 'Brooklyn Conservatory of Music', 'https://bkcm.org/voice-lessons-at-bkcm/', 'https://bkcm.org/wp-content/uploads/2025/01/BKCM-Logo-250.jpg'],
  ['catalog-provider-bloomingdale', 'Bloomingdale School of Music', 'https://www.bsmny.org/about-us/faculty-and-staff/', 'https://www.bsmny.org/wp-content/uploads/2019/01/BSM-logo-mark-white.svg', 'dark'],
  ['catalog-provider-greenwich', 'Greenwich House', 'https://greenwichhouse.org/music-school/staff-and-faculty/', 'https://greenwichhouse.org/wp-content/uploads/2025/07/Greenwich-House-Site-Icon-200x200.jpg'],
  ['catalog-provider-lucy', 'Kaufman Music Center — home of Lucy Moses School', 'https://www.kaufmanmusiccenter.org/lms/faculty-list/', 'https://www.kaufmanmusiccenter.org/ui/images/kaufman-music-center-home-02.svg'],
  ['catalog-provider-farnsworth', 'Matt Farnsworth Vocal Studio', 'https://www.mattfarnsworthvoice.com/about', 'https://cdn.prod.website-files.com/5f899ec40c9e894f3131a9eb/5f8b0b62c42740b8eb2e1c09_mattlogonofree-p-500.png'],
  ['catalog-provider-liz', 'Liz Caplan Vocal Studios', 'https://www.lizcaplan.com/team-1', 'https://images.squarespace-cdn.com/content/v1/648605c4fb42f33c24973c37/a1ec2262-ee8c-470a-b03a-5cbab923f0f4/Clean+%26+Simple+Logo+%282%29.png?format=300w'],
  ['catalog-provider-third', 'Third Street Music School', 'https://www.thirdstreet.nyc/faculty-staff-board-of-directors', 'https://irp.cdn-website.com/9d245552/dms3rep/multi/opt/Third+Street+Main+Logo+-+White-1920w.png', 'dark'],
  ['catalog-provider-nyjw', 'New York Jazz Workshop', 'https://newyorkjazzworkshop.com/nyjw-music-teachers/voice-lessons/', 'https://nyjw.wpenginepowered.com/wp-content/uploads/2025/11/logo2.png'],
  ['provider-new-york-vocal-coaching', 'New York Vocal Coaching', 'https://newyorkvocalcoaching.com/', 'https://newyorkvocalcoaching.com/content/img/shared/logos/nyvcLogoFull.svg'],
  ['catalog-teacher-david-sisco', 'David Sisco', 'https://davidsisco.com/teaching/', 'https://davidsisco.com/wp-content/themes/david-sisco/img/david-sisco-footer-logo.png'],
  ['catalog-teacher-deric-rosenblatt', 'Vocal Power LLC — Deric Rosenblatt', 'https://www.vocalpowerllc.com/', 'https://images.squarespace-cdn.com/content/v1/59933c9c6a49634687f2c4c9/1503932984154-DL6ODEE1QSF2CIWOXFRH/vp_final_logo.jpg?format=300w'],
  ['catalog-teacher-michael-forman', 'The Michael Forman Studio', 'https://formanvocalcoach.com/', 'https://formanvocalcoach.com/wp-content/uploads/2020/03/Logo-1DG.png'],
  ['catalog-teacher-mary-setrakian', 'Mary Setrakian', 'https://marysetrakian.com/newyorkclasses', 'https://images.squarespace-cdn.com/content/v1/5a1e88272278e73e3d65bb7a/1519484406465-PQOSGHOABSRXQYMP780O/MARY+FOUNDED+LOGO.png?format=300w'],
  ['vocal-charlotte-surkin', 'Charlotte Surkin', 'https://www.charlottesurkin.com/', 'https://www.charlottesurkin.com/wp-content/uploads/2020/08/logo.png'],
  ['vocal-david-sabella', 'David Sabella', 'https://www.sabellavoice.com/', 'https://davidsabella.com/wp-content/uploads/2026/07/David-Sabella-logo.png'],
  ['vocal-dawn-winiarz', 'Dawn Winiarz Voice', 'https://dawnwiniarzvoice.com/', 'https://static1.squarespace.com/static/64040247c1e9155f6db7ae65/t/6546f79d250674286dbe4826/1699149725243/DWV+Logo+Purple+Square+Large+copy.png?format=300w'],
  ['catalog-teacher-lily-librach', 'Lily Librach Music', 'https://www.lilylibrach.com/', 'https://wixmp-fe53c9ff592a4da924211f23.wixmp.com/users/85c66cb9-38c0-4d0b-87bb-3e16de74253d/design-previews/2c2ba20b-4d50-41a9-a021-8041d086b34e/1722542276913-transparentThumbnail.png'],
  ['catalog-teacher-wilma-wever', 'Performance EmPowering — Wilma Wever', 'https://www.performanceempowering.com/', 'https://assets.zyrosite.com/cdn-cgi/image/format=auto,w=768,fit=crop/9rWxrmqCq7CAfKGF/logo-design-performance-empowering-03-kAGKUZha6pGsVchj.jpeg'],
  ['catalog-teacher-aubrey-johnson', 'Aubrey Johnson', 'https://www.aubreyjohnsonmusic.com/', 'https://images.squarespace-cdn.com/content/v1/645cedbcbc3f10163deab1aa/c44aba35-1648-4e92-a33f-a6e40205c795/aubrey+logo.png?format=300w', 'dark'],
  ['catalog-teacher-sara-serpa', 'Sara Serpa', 'https://www.saraserpa.com/', 'https://www.saraserpa.com/images/Group-62.svg', 'dark'],
  ['catalog-teacher-sirintip', 'Sirintip', 'https://www.sirintipofficial.com/', 'https://images.squarespace-cdn.com/content/v1/55fdb52ce4b08422c889ffe9/2d59428f-4e9c-4930-86b2-14f4abbac339/SIRINTIP_logo+orange.png?format=300w'],
  ['independent-accentsoff', 'AccentsOff', 'https://accentsoff.com/about/', 'https://accentsoff.com/wp-content/uploads/2021/01/logo-footer.png', 'dark', '2026-11-16'],
];

await fs.mkdir('public/logos', { recursive: true });
const brands = JSON.parse(await fs.readFile('data/listing-logos.json', 'utf8').catch(() => '{"brands":{}}')).brands;
for (const [id, name, sourceUrl, assetUrl, surface = 'light', verifiedAt = '2026-11-10'] of selections) {
  const response = await fetch(assetUrl, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${id}: ${response.status}`);
  const mime = response.headers.get('content-type')?.split(';')[0];
  const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg' }[mime];
  if (!extension) throw new Error(`${id}: unexpected content type ${mime}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 3000000 || bytes.length < 30) throw new Error(`${id}: unexpected image size`);
  if (extension === 'svg' && /<script\b|<foreignObject\b|\bon\w+\s*=|(?:href|src)\s*=\s*["'](?:https?:|javascript:|\/\/)/i.test(bytes.toString())) throw new Error(`${id}: active SVG content`);
  const path = `/logos/${id}.${extension}`;
  await fs.writeFile(`public${path}`, bytes);
  brands[id] = { name, url: path, sourceUrl, assetUrl, surface, verifiedAt, status: 'verified', sha256: createHash('sha256').update(bytes).digest('hex') };
  console.log(`${id}: ${bytes.length} bytes`);
}
await fs.writeFile('data/listing-logos.json', JSON.stringify({ reviewedAt: '2026-11-16', brands }, null, 2) + '\n');

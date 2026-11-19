import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import catalog from '../data/voice-speech-expansion.js';
const urls = [...new Set([...catalog.schools,...catalog.coaches,...catalog.courses].map(x=>x.source))];
const checks = [];
for (let index=0;index<urls.length;index+=3) await Promise.all(urls.slice(index,index+3).map(async url=>{
  const r = await fetch(url,{signal:AbortSignal.timeout(30000)});
  if(!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  const html = await r.text();
  const text = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
  const headings = [...html.matchAll(/<h[1-4]\b[^>]*>([\s\S]*?)<\/h[1-4]>/gi)].map(x=>x[1].replace(/<[^>]+>/g,' ').trim());
  const logos = [...html.matchAll(/<img\b[^>]*>/gi)].map(x=>x[0]).filter(x=>/logo/i.test(x)).slice(0,5);
  checks.push({url,httpStatus:r.status,title:html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1],sha256:createHash('sha256').update(html).digest('hex'),headings,excerpts:[...text.matchAll(/.{0,60}(?:Prerequisite|twenty-four|online sessions|via online|\$\s*555|147 W).{0,180}/gi)].slice(0,5).map(x=>x[0]),logos});
  console.log(JSON.stringify({url,status:r.status,logos:logos.slice(0,2)}));
}));
await fs.writeFile('data/voice-speech-verification.json',JSON.stringify({reviewedAt:catalog.reviewedAt,checks:checks.sort((a,b)=>a.url.localeCompare(b.url))},null,2)+'\n');

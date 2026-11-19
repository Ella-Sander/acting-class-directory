import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
const catalog = JSON.parse(await fs.readFile('data/dialect-coaches.json','utf8'));
const urls = [...new Set(catalog.coaches.flatMap(coach => [coach.source,coach.locationSource,coach.formatSource,coach.serviceSource,coach.affiliation?.source,coach.booking].filter(Boolean)))];
const checks = [];
for (let start=0; start<urls.length; start+=4) {
  await Promise.all(urls.slice(start,start+4).map(async url => {
    try {
      const response = await fetch(url,{signal:AbortSignal.timeout(30000)});
      const html = await response.text();
      const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim();
      const text = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
      const excerpts = [...text.matchAll(/.{0,90}(?:dialect|coaching|Zoom|New York|Manhattan).{0,150}/gi)].slice(0,8).map(x=>x[0]);
      const logos = [...html.matchAll(/<img\b[^>]*>/gi)].map(x=>x[0]).filter(x=>/logo/i.test(x)).slice(0,3);
      checks.push({url,finalUrl:response.url,httpStatus:response.status,title,sha256:createHash('sha256').update(html).digest('hex'),excerpts,logos});
      console.log(JSON.stringify({url,status:response.status,title,excerpts:excerpts.slice(0,3),logos}));
    } catch(error) {checks.push({url,error:error.message});console.log(JSON.stringify({url,error:error.message}));}
  }));
}
await fs.writeFile('data/dialect-coach-verification.json',JSON.stringify({reviewedAt:catalog.reviewedAt,checks:checks.sort((a,b)=>a.url.localeCompare(b.url))},null,2)+'\n');

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const config=JSON.parse(readFileSync('wrangler.production.jsonc','utf8'));
const credentials=readFileSync(join(process.env.APPDATA,'xdg.config','.wrangler','config','default.toml'),'utf8');
const token=process.env.CLOUDFLARE_API_TOKEN||credentials.match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];
async function query(sql,params=[]){const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/735c5b7e1a6013843699cc6e6fb4b5f6/d1/database/${config.d1_databases[0].database_id}/query`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({sql,params}),signal:AbortSignal.timeout(25000)});const result=await response.json();if(!result.success)throw Error(JSON.stringify(result.errors));return result.result[0];}
const providerId='independent-jeff-cubeta';
if(process.argv.includes('--queue')){
  await query(`INSERT INTO provider_preview_jobs(provider_id,website_url) SELECT id,website_url FROM providers WHERE id=? AND listing_status='published' ON CONFLICT(provider_id) DO UPDATE SET status='pending',attempts=0,error=NULL,website_url=excluded.website_url,requested_at=CURRENT_TIMESTAMP`,[providerId]);
  const raw=readFileSync('.dev.vars','utf8').match(/^ADMIN_REVIEW_KEY\s*=\s*(.+)$/m)?.[1].trim();
  if(!raw)throw Error('Review credential unavailable');
  const response=await fetch('https://vocalcatalog.com/api/admin/preview-retry',{method:'POST',headers:{Authorization:`Bearer ${raw.replace(/^['"]|['"]$/g,'')}`},signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error(`Preview retry HTTP ${response.status}`);
  console.log(JSON.stringify({queued:await response.json()}));
}
const jobs=(await query(`SELECT j.provider_id,j.status,j.attempts,j.error,p.metadata_image_url,p.metadata_image_source_url,p.metadata_image_type,p.metadata_image_checked_at FROM provider_preview_jobs j JOIN providers p ON p.id=j.provider_id WHERE j.provider_id=?`,[providerId])).results;
const report={checkedAt:new Date().toISOString(),jobs};
if(jobs[0]?.status==='complete' && jobs[0].metadata_image_url?.startsWith('https://vocalcatalog.com/api/provider-previews/')) {
  const response=await fetch(jobs[0].metadata_image_url,{signal:AbortSignal.timeout(15000)});const bytes=new Uint8Array(await response.arrayBuffer());
  if(!response.ok||response.headers.get('Content-Type')!=='image/jpeg'||bytes[0]!==255||bytes[1]!==216)throw Error('Screenshot image is invalid');
  if(response.headers.get('X-D1-Queries')!=='0')throw Error('Screenshot request queried D1');
  writeFileSync('artifacts/provider-website-preview.jpg',bytes);report.image={status:response.status,bytes:bytes.length,rowsRead:response.headers.get('X-D1-Rows-Read')};
}
writeFileSync('docs/provider-preview-job-check.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));

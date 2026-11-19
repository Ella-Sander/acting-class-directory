import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { providerDomain, mergeFields } from '../src/provider-identity.js';
const apply=process.argv.includes('--apply');
const config=JSON.parse(readFileSync('wrangler.production.jsonc','utf8'));
const credentials=readFileSync(join(process.env.APPDATA,'xdg.config','.wrangler','config','default.toml'),'utf8');
const token=process.env.CLOUDFLARE_API_TOKEN||credentials.match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];
const endpoint=`https://api.cloudflare.com/client/v4/accounts/735c5b7e1a6013843699cc6e6fb4b5f6/d1/database/${config.d1_databases[0].database_id}/query`;
const metrics={queries:0,rowsRead:0,rowsWritten:0};
async function query(sql,params=[]) {
  const response=await fetch(endpoint,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({sql,params}),signal:AbortSignal.timeout(30000)});
  const result=await response.json();if(!result.success)throw Error(JSON.stringify(result.errors));const value=result.result[0];metrics.queries++;metrics.rowsRead+=value.meta?.rows_read || 0;metrics.rowsWritten+=value.meta?.rows_written || 0;return value;
}
const providers=(await query(`SELECT * FROM providers WHERE listing_status='published' ORDER BY CASE WHEN origin='seeded' THEN 0 ELSE 1 END,created_at,id`)).results;
const groups=new Map();const invalid=[];
for(const provider of providers){const domain=providerDomain(provider.website_url);if(!domain){invalid.push({id:provider.id,website:provider.website_url});continue;}if(!groups.has(domain))groups.set(domain,[]);groups.get(domain).push(provider);}
const report={auditedAt:new Date().toISOString(),mode:apply?'backfill identities and stage reviews; no approved fields overwritten':'dry run',providers:providers.length,domains:groups.size,invalid,duplicates:[],metrics};
for(const [domain,members]of groups){
  const target=members[0];
  if(apply){
    await query(`INSERT INTO provider_domains(domain,provider_id) VALUES (?,?) ON CONFLICT(domain) DO NOTHING`,[domain,target.id]);
    for(const provider of members)await query(`UPDATE providers SET registrable_domain=? WHERE id=? AND registrable_domain IS NOT ?`,[domain,provider.id,domain]);
  }
  for(const source of members.slice(1)){
    const conflicts=mergeFields(target,source).conflicts;
    const id=`domain-merge-${createHash('sha256').update(domain+'|'+source.id).digest('hex').slice(0,32)}`;
    report.duplicates.push({domain,targetId:target.id,targetName:target.name,sourceId:source.id,sourceName:source.name,conflicts,submissionId:id});
    if(apply)await query(`INSERT INTO submissions(id,submission_type,status,contact_name,contact_email,website_url,payload_json,duplicate_of_provider_id) VALUES (?,'profile_update','pending','Domain identity audit','support@vocalcatalog.com',?,?,?) ON CONFLICT(id) DO NOTHING`,[id,source.website_url,JSON.stringify({type:'domain_merge',domain,provider_id:target.id,source_provider_id:source.id,website_url:source.website_url,name:source.name,description:source.description}),target.id]);
  }
}
writeFileSync(`docs/provider-domain-audit${apply?'':'-plan'}.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));

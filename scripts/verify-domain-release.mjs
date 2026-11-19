import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { providerDomain } from '../src/provider-identity.js';
const origin='https://vocalcatalog.com';
const report={checkedAt:new Date().toISOString(),failures:[],requests:0,rowsRead:0,aliases:[],sitemaps:[]};
const raw=readFileSync('.dev.vars','utf8').match(/^ADMIN_REVIEW_KEY\s*=\s*(.+)$/m)?.[1].trim();
const key=raw?.replace(/^['"]|['"]$/g,'');
async function get(path,status=200,admin=false){
  const response=await fetch(new URL(path,origin),{redirect:'manual',headers:admin?{Authorization:`Bearer ${key}`}:{},signal:AbortSignal.timeout(25000)});report.requests++;
  assert.equal(response.status,status,`${path}: HTTP ${response.status}`);
  if(!admin){assert.equal(response.headers.get('X-D1-Queries'),'0',`${path}: unexpected D1 query`);assert.equal(response.headers.get('X-D1-Rows-Read'),'0',`${path}: unexpected D1 rows`);}
  else assert.match(response.headers.get('Cache-Control'),/no-store/);
  return response;
}
try{
  const directory=await(await get('/api/directory')).json();
  report.records=Object.fromEntries(Object.entries(directory).map(([name,items])=>[name,items.length]));
  const domains=directory.providers.map(provider=>providerDomain(provider.website_url));
  assert.ok(domains.every(Boolean));assert.equal(new Set(domains).size,domains.length,'Duplicate public provider domains');
  const paths=[];
  for(const [collection,items]of Object.entries(directory))for(const item of items){paths.push(`/api/${collection}/${item.slug}`);paths.push(`/${collection==='offerings'?'classes':collection}/${item.slug}/`);}
  let index=0;await Promise.all(Array.from({length:6},async()=>{while(index<paths.length){const path=paths[index++];try{await(await get(path)).arrayBuffer();}catch(error){report.failures.push(error.message);}}}));
  const expected=new Set(directory.providers.map(provider=>`/providers/${provider.slug}/`));
  for(const provider of directory.providers)for(const alias of provider.aliases || []){
    const source=`/providers/${alias.slug}/`;const response=await get(source,308);assert.equal(response.headers.get('Location'),origin+`/providers/${provider.slug}/`);
    const api=await get(`/api/providers/${alias.slug}`,308);assert.equal(api.headers.get('Location'),origin+`/api/providers/${provider.slug}`);
    report.aliases.push({source,target:`/providers/${provider.slug}/`});
  }
  const indexXml=await(await get('/sitemap.xml')).text();
  for(const match of indexXml.matchAll(/<loc>([^<]+)<\/loc>/g)){
    const xml=await(await get(match[1])).text();const urls=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(item=>item[1].replaceAll('&amp;','&'));
    assert.equal(new Set(urls).size,urls.length);report.sitemaps.push({url:match[1],urls:urls.length});
    if(match[1].endsWith('/sitemap-studios.xml')){
      assert.deepEqual(new Set(urls.map(url=>new URL(url).pathname)),expected);
      for(const alias of report.aliases)assert.ok(!urls.includes(origin+alias.source),'Old provider URL remains in sitemap');
    }
  }
  await get('/api/admin/submissions',401);await get('/api/admin/provider-merge?submission_id=x',401);
  if(key){
    const queue=await(await get('/api/admin/submissions',200,true)).json();
    const staged=queue.find(item=>item.payload.type==='domain_merge');
    assert.ok(staged,'Existing conflicting domain merge is missing from review queue');
    const proposal=await(await get(`/api/admin/provider-merge?submission_id=${staged.id}`,200,true)).json();
    assert.equal(proposal.domain,'jeffcubetavoiceteaching.com');
    report.adminReview={accessible:true,domain:proposal.domain,conflicts:proposal.conflicts,serviceConflict:Boolean(proposal.service)};
  }
  const first=await(await get('/')).text();const second=await(await get('/?page=2')).text();assert.notEqual(first,second);assert.match(second,/Page 2/);
}catch(error){report.failures.push(error.message);}
writeFileSync('docs/provider-domain-release-check.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
if(report.failures.length)process.exitCode=1;

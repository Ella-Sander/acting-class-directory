import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
const account='735c5b7e1a6013843699cc6e6fb4b5f6';
const domain='vocalcatalog.com';const alias='support@vocalcatalog.com';const destination='headshotscout.support@gmail.com';
const config=readFileSync(join(process.env.APPDATA,'xdg.config','.wrangler','config','default.toml'),'utf8');
const privateTokenPath=join(process.cwd(),'.cloudflare-email-token');
const token=process.env.CLOUDFLARE_API_TOKEN||(existsSync(privateTokenPath)?readFileSync(privateTokenPath,'utf8').trim():'')||config.match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];
if(!token)throw Error('Cloudflare authorization is required.');
async function api(path,method='GET',body){
  const response=await fetch(`https://api.cloudflare.com/client/v4${path}`,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(25000)});
  const result=await response.json();if(!response.ok||!result.success)throw Error(`Cloudflare ${response.status}: ${JSON.stringify(result.errors)}`);return result;
}
async function list(path){const rows=[];for(let page=1;page<=100;page++){const result=await api(`${path}${path.includes('?')?'&':'?'}per_page=100&page=${page}`);rows.push(...result.result);if(!result.result_info||page>=result.result_info.total_pages||result.result.length<100)break;}return rows;}
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const hash=value=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const zones=await list(`/zones?name=${domain}`);const zone=zones.find(row=>row.name===domain&&row.account.id===account);if(!zone)throw Error('Authorized domain not found in the existing account.');
const base=`/zones/${zone.id}`;
const dnsBefore=await list(`${base}/dns_records`);
const rulesBefore=await list(`${base}/email/routing/rules`);
const catchBefore=(await api(`${base}/email/routing/rules/catch_all`)).result;
const routing=(await api(`${base}/email/routing`)).result;
const addresses=await list(`/accounts/${account}/email/routing/addresses`);
const verified=addresses.find(row=>row.email.toLowerCase()===destination)?.verified;
const matches=rulesBefore.filter(row=>row.matchers?.some(matcher=>matcher.type==='literal'&&matcher.field==='to'&&matcher.value?.toLowerCase()===alias));
const report={checkedAt:new Date().toISOString(),domain,alias,destination,routingEnabled:routing.enabled,destinationVerified:Boolean(verified),dnsRecords:dnsBefore.length,rulesBefore:rulesBefore.length,aliasRules:matches.map(row=>({id:row.id,enabled:row.enabled,actions:row.actions,priority:row.priority})),mailDns:dnsBefore.filter(row=>['MX','TXT'].includes(row.type)||row.name.includes('_domainkey')).map(row=>({type:row.type,name:row.name,content:row.content,priority:row.priority})),changed:false};
if(process.argv.includes('--apply')){
  if(!routing.enabled)throw Error('Email Routing is not enabled; DNS changes need separate review.');
  if(!verified)throw Error('The forwarding destination needs account verification; no routing rule was changed.');
  if(matches.length>1)throw Error('Multiple existing support rules need review; none were changed.');
  if(matches.length===1){
    const match=matches[0];if(!match.enabled||match.actions?.length!==1||match.actions[0].type!=='forward'||match.actions[0].value?.length!==1||match.actions[0].value[0]!==destination)throw Error('An existing support rule differs from the requested forwarding; review required before changing it.');
  }else{
    const created=(await api(`${base}/email/routing/rules`,'POST',{name:'Vocal Catalog support inbox',enabled:true,matchers:[{type:'literal',field:'to',value:alias}],actions:[{type:'forward',value:[destination]}],priority:Math.max(0,...rulesBefore.map(row=>row.priority||0))+1})).result;
    report.changed=true;report.createdRuleId=created.id;
  }
  const dnsAfter=await list(`${base}/dns_records`);const rulesAfter=await list(`${base}/email/routing/rules`);const catchAfter=(await api(`${base}/email/routing/rules/catch_all`)).result;
  report.dnsUnchanged=hash(dnsBefore)===hash(dnsAfter);
  report.catchAllUnchanged=hash(catchBefore)===hash(catchAfter);
  report.existingRulesUnchanged=rulesBefore.every(before=>{const after=rulesAfter.find(row=>row.id===before.id);return after&&hash(before)===hash(after);});
  const rule=rulesAfter.find(row=>row.matchers?.some(matcher=>matcher.field==='to'&&matcher.value===alias));
  report.activeRule={id:rule?.id,enabled:rule?.enabled,actions:rule?.actions};
  if(!report.dnsUnchanged||!report.catchAllUnchanged||!report.existingRulesUnchanged)throw Error('Unexpected existing configuration drift; inspect the account before continuing.');
}
writeFileSync(`docs/support-alias-${process.argv.includes('--apply')?'setup':'audit'}.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const credentials=readFileSync(join(process.env.APPDATA,'xdg.config','.wrangler','config','default.toml'),'utf8');
const token=process.env.CLOUDFLARE_API_TOKEN||credentials.match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];
const report={checkedAt:new Date().toISOString(),checks:[]};
for(const path of ['/accounts/735c5b7e1a6013843699cc6e6fb4b5f6/workers/account-settings','/accounts/735c5b7e1a6013843699cc6e6fb4b5f6/subscriptions','/zones/60459b5a267a0a158b536e37eea35690/email/sending/subdomains']){
  const response=await fetch('https://api.cloudflare.com/client/v4'+path,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(20000)});const data=await response.json();
  report.checks.push({path,status:response.status,success:data.success,result:path.includes('account-settings')?{default_usage_model:data.result?.default_usage_model}:Array.isArray(data.result)?data.result.map(item=>path.endsWith('subscriptions')?{plan:item.rate_plan?.public_name || item.rate_plan?.id,status:item.state}:({name:item.name,enabled:item.enabled,tag:item.tag})):null,errors:data.errors});
}
writeFileSync('docs/approval-email-service-audit.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));

import { readFileSync } from 'node:fs';
const raw=readFileSync('.dev.vars','utf8').match(/^ADMIN_REVIEW_KEY\s*=\s*(.+)$/m)?.[1].trim();
if(!raw)throw Error('Review credential unavailable');
const response=await fetch('https://vocalcatalog.com/api/admin/submissions',{headers:{Authorization:`Bearer ${raw.replace(/^['"]|['"]$/g,'')}`},signal:AbortSignal.timeout(20000)});
if(!response.ok)throw Error(`Review queue returned ${response.status}`);
const rows=await response.json();
console.log(JSON.stringify(rows.map(row=>({id:row.id,name:row.payload.name||row.payload.provider_name||'Profile request',type:row.payload.type||row.submission_type,submittedAt:row.submitted_at,website:row.website_url,description:row.payload.description,mergeTarget:row.payload.merge_target_id||row.payload.provider_id})),null,2));
if(process.argv.includes('--verify-emails-disabled')) {
  const check=await fetch('https://vocalcatalog.com/api/admin/approval-emails/retry',{method:'POST',headers:{Authorization:`Bearer ${raw.replace(/^['"]|['"]$/g,'')}`},signal:AbortSignal.timeout(20000)});
  const result=await check.json();if(check.status!==409||result.error!=='Approval emails are disabled.')throw Error('Email disable switch was not confirmed');
  console.log(JSON.stringify({approvalEmails:'disabled',status:check.status}));
}

import { BRAND, PUBLIC_ORIGIN, SUPPORT_EMAIL } from './brand.js';
import { NOTIFICATION_SENDER } from './submission-email.js';
const emailAddress=value=>typeof value==='string' && value.length<=254 && /^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(value);
const text=value=>String(value || '').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,180);
export function approvalMessage(submission,payload,publicPath='/',merged=false) {
  if(payload.type==='domain_merge' || !emailAddress(submission.contact_email))return null;
  const type=payload.type || submission.submission_type;
  const result=type==='removal'?'Your removal request has been approved.':type==='claim'?'Your profile claim has been approved.':type==='profile_update'?'Your profile update has been approved.':merged?'Your submission has been approved and merged into the existing provider listing.':'Your submission has been approved.';
  const url=new URL(publicPath,PUBLIC_ORIGIN);
  if(url.origin!==PUBLIC_ORIGIN)throw new Error('Approval links must use the public site.');
  return {
    from:{email:NOTIFICATION_SENDER,name:BRAND},to:submission.contact_email,replyTo:SUPPORT_EMAIL,
    subject:`Your ${BRAND} submission was approved`,
    text:[`Hello${payload.contact_name ? ' '+text(payload.contact_name) : ''},`,'',result,
      payload.name?`Listing: ${text(payload.name)}`:'',
      type==='removal'?`Visit ${BRAND}: ${PUBLIC_ORIGIN}/`:`View ${merged?'the provider listing':'the approved listing or update'}: ${url.href}`,
      '',`Submission reference: ${submission.id}`,'',`Questions or corrections? Reply to this email to contact ${BRAND}.`,'',BRAND,PUBLIC_ORIGIN,
    ].filter(line=>line!==undefined).join('\n'),
  };
}
export function enqueueApprovalEmail(statements,env,submission,payload,publicPath='/',merged=false) {
  if(env.APPROVAL_EMAIL_ENABLED!=='true')return false;
  const message=approvalMessage(submission,payload,publicPath,merged);
  if(!message)return false;
  statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO submission_approval_emails(submission_id,recipient,subject,body_text) VALUES (?,?,?,?) ON CONFLICT(submission_id) DO NOTHING`).bind(submission.id,message.to,message.subject,message.text));
  return true;
}
const blockedCodes=new Set(['E_SENDER_DOMAIN_NOT_AVAILABLE','E_SENDER_DOMAIN_NOT_CONFIGURED','E_EMAIL_SENDING_NOT_READY','E_RECIPIENT_NOT_ALLOWED','E_RECIPIENT_PLAN_RESTRICTED','E_SENDER_NOT_VERIFIED']);
export async function deliverApprovalEmail(env,submissionId) {
  if(env.APPROVAL_EMAIL_ENABLED!=='true')return 'disabled';
  const token=crypto.randomUUID();
  const claimed=await env.DIRECTORY_DB.prepare(`UPDATE submission_approval_emails SET status='sending',lease_token=?,attempts=attempts+1,updated_at=CURRENT_TIMESTAMP WHERE submission_id=? AND status IN ('pending','failed','blocked') AND attempts<5 AND EXISTS(SELECT 1 FROM submissions WHERE id=? AND status='approved') RETURNING *`).bind(token,submissionId,submissionId).all();
  const job=claimed.results?.[0];
  if(!job){const previous=await env.DIRECTORY_DB.prepare(`SELECT status FROM submission_approval_emails WHERE submission_id=?`).bind(submissionId).first();return previous?.status || 'not_applicable';}
  let status='sent';let code=null;let messageId=null;
  try {
    if(!env.SUBMISSION_EMAIL)throw Object.assign(new Error('Mail binding unavailable'),{code:'EMAIL_NOT_CONFIGURED'});
    const sent=await env.SUBMISSION_EMAIL.send({from:{email:NOTIFICATION_SENDER,name:BRAND},to:job.recipient,replyTo:SUPPORT_EMAIL,subject:job.subject,text:job.body_text});
    if(!sent?.messageId)throw Object.assign(new Error('Provider did not confirm acceptance'),{code:'EMAIL_ACCEPTANCE_UNKNOWN'});
    messageId=sent.messageId;
  } catch(error) {
    // Do not log recipients, message bodies, or provider error strings that
    // might contain private addresses. Sending state requires manual review
    // on an ambiguous outcome; never automatically send a possible duplicate.
    code=text(error.code || (error instanceof TypeError?'EMAIL_API_UNAVAILABLE':'EMAIL_SEND_FAILED'));
    status=code==='EMAIL_ACCEPTANCE_UNKNOWN'?'sending':blockedCodes.has(code)||['EMAIL_NOT_CONFIGURED','EMAIL_API_UNAVAILABLE'].includes(code)?'blocked':'failed';
    console.warn('Approval email not accepted',code);
  }
  await env.DIRECTORY_DB.prepare(`UPDATE submission_approval_emails SET status=?,provider_message_id=?,last_error=?,sent_at=CASE WHEN ?='sent' THEN CURRENT_TIMESTAMP ELSE sent_at END,updated_at=CURRENT_TIMESTAMP WHERE submission_id=? AND lease_token=?`).bind(status,messageId,code,status,submissionId,token).all();
  return status;
}
export async function attemptApprovalEmail(env,submissionId) {
  try{return await deliverApprovalEmail(env,submissionId);}catch{console.error('Approval retained; confirmation remains in the email outbox.');return 'pending';}
}

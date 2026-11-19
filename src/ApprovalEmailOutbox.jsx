import { useState } from 'react';
export function approvalEmailNotice(status) {
  if(status==='sent')return 'Approval confirmation email accepted for delivery.';
  if(status==='not_applicable'||!status)return '';
  if(status==='sending')return 'Approval saved. Email delivery needs checking before retrying.';
  return 'Approval saved. Confirmation email is awaiting delivery; check Approval emails.';
}
export default function ApprovalEmailOutbox({reviewKey}) {
  const [rows,setRows]=useState(null);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
  async function load(){
    setBusy(true);setMessage('');try{const response=await fetch('/api/admin/approval-emails',{headers:{Authorization:`Bearer ${reviewKey}`},cache:'no-store'});const data=await response.json();if(!response.ok)throw Error(data.error||'Could not load email delivery status.');setRows(data);}catch(error){setMessage(error.message);}finally{setBusy(false);}
  }
  async function retry(){
    setBusy(true);try{const response=await fetch('/api/admin/approval-emails/retry',{method:'POST',headers:{Authorization:`Bearer ${reviewKey}`}});const data=await response.json();if(!response.ok)throw Error(data.error||'Could not retry confirmations.');await load();setMessage(`Checked ${data.results.length} confirmation${data.results.length===1?'':'s'}. Provider acceptance is shown below.`);}catch(error){setMessage(error.message);}finally{setBusy(false);}
  }
  return <section className="approval-email-outbox"><h2>Approval emails</h2><p>Future approvals send a confirmation to the email saved with the submission. Delivery issues never undo an approval. No historical approvals are emailed automatically.</p><div className="admin-actions"><button type="button" className="button button-outline" disabled={busy||!reviewKey} onClick={load}>{busy?'Checking…':'Check delivery status'}</button>{rows?.some(row=>['pending','failed','blocked'].includes(row.status)) && <button type="button" className="button button-outline" disabled={busy} onClick={retry}>Retry pending confirmations</button>}</div>{message && <p role="status">{message}</p>}{rows && <>{!rows.length?<p>No approval confirmations have been queued yet.</p>:<ul>{rows.map(row=><li key={row.submission_id}><strong>{row.status==='sent'?'Accepted by mail provider':row.status==='sending'?'Check delivery before retrying':row.status}</strong><span>Submission {row.submission_id} · {row.attempts} attempt{row.attempts===1?'':'s'}</span>{row.last_error && <small>{row.last_error}</small>}</li>)}</ul>}</>}</section>;
}

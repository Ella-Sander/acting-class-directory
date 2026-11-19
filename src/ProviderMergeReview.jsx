import { useState } from 'react';
import { MERGE_FIELDS, TEXT_FIELDS } from './provider-merge-fields.js';
import { approvalEmailNotice } from './ApprovalEmailOutbox.jsx';

function FieldReview({ names, existing, incoming, conflicts, resolutions, onChange }) {
  return <div className="merge-fields">{names.filter(field => existing[field] != null || incoming[field] != null).map(field => {
    const conflict=conflicts.includes(field);
    const resolution=resolutions[field] || {};
    return <fieldset className={`merge-field${conflict ? ' has-conflict' : ''}`} key={field}><legend>{field.replaceAll('_',' ')}{conflict && <span>Choose a value</span>}</legend><div className="merge-comparison"><div><strong>Approved value</strong><p>{String(existing[field] ?? 'Not provided')}</p></div><div><strong>Incoming value</strong><p>{String(incoming[field] ?? 'Not provided')}</p></div></div><label className="form-field"><span>Published value</span><select value={resolution.choice || (conflict ? '' : existing[field] != null ? 'existing' : 'incoming')} onChange={event => onChange(field,{...resolution,choice:event.target.value})}><option value="" disabled>Resolve this conflict</option><option value="existing">Keep approved value</option><option value="incoming">Use incoming value</option>{TEXT_FIELDS.includes(field) && <option value="combine">Combine both descriptions</option>}<option value="edit">Write the final value</option></select></label>{resolution.choice==='edit' && <label className="form-field"><span>Final {field.replaceAll('_',' ')}</span><textarea maxLength={12000} value={resolution.value ?? ''} onChange={event=>onChange(field,{choice:'edit',value:event.target.value})} /></label>}</fieldset>;
  })}</div>;
}
export default function ProviderMergeReview({ submission, reviewKey, onComplete }) {
  const [proposal,setProposal]=useState(null); const [resolutions,setResolutions]=useState({});
  const [services,setServices]=useState({}); const [verified,setVerified]=useState(false);
  const [busy,setBusy]=useState(false); const [message,setMessage]=useState('');
  const load=async()=>{
    setBusy(true);setMessage('');
    try {
      const response=await fetch(`/api/admin/provider-merge?submission_id=${encodeURIComponent(submission.id)}`,{headers:{Authorization:`Bearer ${reviewKey}`},cache:'no-store'});
      const data=await response.json();if(!response.ok)throw Error(data.error);
      setProposal(data);setResolutions({});setServices({});setVerified(false);
    }catch(error){setMessage(error.message);}finally{setBusy(false);}
  };
  const merge=async()=>{
    setBusy(true);setMessage('');
    try {
      const response=await fetch('/api/admin/provider-merge',{method:'POST',headers:{Authorization:`Bearer ${reviewKey}`,'Content-Type':'application/json'},body:JSON.stringify({submission_id:submission.id,target_id:proposal.target.id,expected_revision:proposal.expected_revision,source_revision:proposal.source_revision,service_version:proposal.service?.version,resolutions,service_resolutions:services,details_verified:verified})});
      const data=await response.json();if(!response.ok)throw Error(data.error);
      onComplete(submission.id,`Merged into ${proposal.target.name}.${data.cacheInvalidated?' Sitemaps refreshed.':' Saved; cache refresh needs retry.'} ${approvalEmailNotice(data.approvalEmail)} Rollback record: ${data.mergeEventId}`);
    }catch(error){setMessage(error.message);}finally{setBusy(false);}
  };
  const unresolved=proposal?.conflicts.some(field=>!resolutions[field]?.choice)||(proposal?.service?.conflicts || []).some(field=>!services[field]?.choice);
  return <section className="provider-merge-review"><h3>Provider identity &amp; merging</h3><p>Pages and subdomains of one website belong to one provider. Review the approved and incoming values before combining them.</p><button type="button" className="button button-outline" disabled={busy} onClick={load}>{busy?'Loading…':proposal?'Reload latest values':'Merge with Existing Provider'}</button>{message && <p role="alert">{message}</p>}{proposal && <><p className="merge-target"><strong>{proposal.target.name}</strong><span>{proposal.domain}</span><small>Keep provider ID: {proposal.target.id}</small></p><p>Services, specialties, locations and teaching relationships will be retained. Original records and rejected field values remain in the private merge journal.</p>{proposal.existingInstructor && <p>Existing instructor <strong>{proposal.existingInstructor.name}</strong> will keep their profile and ID. Incoming biography and teaching details appear in the description comparison below.</p>}<FieldReview names={MERGE_FIELDS} existing={proposal.target} incoming={proposal.incoming} conflicts={proposal.conflicts} resolutions={resolutions} onChange={(field,value)=>setResolutions(previous=>({...previous,[field]:value}))} />{proposal.service && <><h4>Existing service: {proposal.service.existing.name}</h4><p>This service already exists. Resolve its fields instead of creating a second copy.</p><FieldReview names={Object.keys(proposal.service.fields)} existing={proposal.service.existing} incoming={proposal.service.incoming} conflicts={proposal.service.conflicts} resolutions={services} onChange={(field,value)=>setServices(previous=>({...previous,[field]:value}))} /></>}<label className="submission-verification-check"><input type="checkbox" checked={verified} onChange={event=>setVerified(event.target.checked)} /><span>I reviewed the official sources and the final values. Approve this merge, preserving the canonical provider and its existing URL.</span></label><button type="button" className="button button-violet" disabled={busy||!verified||unresolved} onClick={merge}>{busy?'Merging…':'Approve merge'}</button></>}</section>;
}

import { MERGE_FIELDS } from './provider-identity.js';
import { relatedTables } from './provider-merges.js';
// An admin explicitly requests a rollback. Refuse it if anything on the
// affected providers or their relationships has changed since the merge.
export async function rollbackMerge(env,eventId) {
  const event=await env.DIRECTORY_DB.prepare(`SELECT * FROM provider_merge_events WHERE id=? AND rolled_back_at IS NULL`).bind(eventId).first();
  if(!event||!event.after_json)throw new Error('An active completed merge journal is required.');
  const before=JSON.parse(event.before_json);const after=JSON.parse(event.after_json);
  const {target,source}=before;
  const statements=[env.DIRECTORY_DB.prepare(`INSERT INTO provider_merge_guards(id,valid) SELECT ?,CASE WHEN EXISTS(SELECT 1 FROM providers WHERE id=? AND merge_revision=?) AND EXISTS(SELECT 1 FROM provider_merge_events WHERE id=? AND rolled_back_at IS NULL) THEN 1 ELSE 0 END`).bind(crypto.randomUUID(),target.id,after.target_revision,eventId)];
  if(source) {
    statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO provider_merge_guards(id,valid) SELECT ?,CASE WHEN EXISTS(SELECT 1 FROM providers WHERE id=? AND merge_revision=?) THEN 1 ELSE 0 END`).bind(crypto.randomUUID(),source.id,after.source_revision));
    // Removing only associations added by this merge is safe: full originals
    // are in the journal, and relationship revision triggers block later edits.
    for(const [table,column]of Object.entries(relatedTables)) {
      if(['provider_locations','provider_instructors','provider_terms','provider_site_urls'].includes(table)) {
        statements.push(env.DIRECTORY_DB.prepare(`DELETE FROM ${table} WHERE ${column} IN (?,?)`).bind(target.id,source.id));
        for(const row of before.relations[table]||[]) {
          const columns=Object.keys(row);statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO ${table}(${columns.join(',')}) VALUES (${columns.map(()=>'?').join(',')})`).bind(...columns.map(key=>row[key])));
        }
      } else {
        for(const row of before.relations[table]||[]) statements.push(env.DIRECTORY_DB.prepare(`UPDATE ${table} SET ${column}=? WHERE id=?`).bind(row[column],row.id));
      }
    }
    for(const table of ['field_evidence','research_sources']) {
      statements.push(env.DIRECTORY_DB.prepare(`DELETE FROM ${table} WHERE entity_type='provider' AND entity_id IN (?,?)`).bind(target.id,source.id));
      for(const row of before.relations[table]||[]){const columns=Object.keys(row);statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO ${table}(${columns.join(',')}) VALUES (${columns.map(()=>'?').join(',')})`).bind(...columns.map(key=>row[key])));}
    }
    if(before.redirect){const row=before.redirect;const fields=Object.keys(row).filter(field=>field!=='source_path');statements.push(env.DIRECTORY_DB.prepare(`UPDATE provider_url_redirects SET ${fields.map(field=>`${field}=?`).join(',')} WHERE source_path=?`).bind(...fields.map(field=>row[field]),row.source_path));}
    else statements.push(env.DIRECTORY_DB.prepare(`DELETE FROM provider_url_redirects WHERE source_path=? AND target_provider_id=?`).bind(`/providers/${source.slug}/`,target.id));
    for(const row of before.domains || [])statements.push(env.DIRECTORY_DB.prepare(`UPDATE provider_domains SET provider_id=? WHERE domain=?`).bind(row.provider_id,row.domain));
    statements.push(env.DIRECTORY_DB.prepare(`DELETE FROM provider_merge_links WHERE source_provider_id=? AND event_id=?`).bind(source.id,event.id));
    statements.push(env.DIRECTORY_DB.prepare(`UPDATE providers SET listing_status=?,merge_revision=merge_revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(source.listing_status,source.id));
  } else {
    const offeringIds=(before.relations.offerings || []).map(row=>row.id);
    const instructorIds=[...(before.relations.provider_instructors || []).map(row=>row.instructor_id),...(before.existingInstructor?[before.existingInstructor.id]:[])];
    // New content is archived, never deleted. Original service fields are
    // restored, including prices/schedules explicitly resolved during review.
    statements.push(env.DIRECTORY_DB.prepare(`UPDATE offerings SET listing_status='archived',updated_at=CURRENT_TIMESTAMP WHERE provider_id=? AND id NOT IN (SELECT value FROM json_each(?))`).bind(target.id,JSON.stringify(offeringIds)));
    statements.push(env.DIRECTORY_DB.prepare(`UPDATE instructors SET profile_status='archived',updated_at=CURRENT_TIMESTAMP WHERE id IN (SELECT instructor_id FROM provider_instructors WHERE provider_id=? AND instructor_id NOT IN (SELECT value FROM json_each(?)))`).bind(target.id,JSON.stringify(instructorIds)));
    if(before.service) {
      const fields=Object.keys(before.service).filter(field=>field!=='id');
      statements.push(env.DIRECTORY_DB.prepare(`UPDATE offerings SET ${fields.map(field=>`${field}=?`).join(',')} WHERE id=?`).bind(...fields.map(field=>before.service[field]),before.service.id));
      statements.push(env.DIRECTORY_DB.prepare(`DELETE FROM field_evidence WHERE entity_type='offering' AND entity_id=?`).bind(before.service.id));
      for(const row of before.serviceEvidence || []){const columns=Object.keys(row);statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO field_evidence(${columns.join(',')}) VALUES (${columns.map(()=>'?').join(',')})`).bind(...columns.map(field=>row[field])));}
      statements.push(env.DIRECTORY_DB.prepare(`DELETE FROM offering_instructors WHERE offering_id=?`).bind(before.service.id));
      for(const row of before.serviceInstructors || [])statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO offering_instructors(offering_id,instructor_id) VALUES (?,?)`).bind(row.offering_id,row.instructor_id));
    }
    for(const table of ['provider_locations','provider_instructors','provider_terms','provider_site_urls']) {
      statements.push(env.DIRECTORY_DB.prepare(`DELETE FROM ${table} WHERE provider_id=?`).bind(target.id));
      for(const row of before.relations[table]||[]){const fields=Object.keys(row);statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO ${table}(${fields.join(',')}) VALUES (${fields.map(()=>'?').join(',')})`).bind(...fields.map(field=>row[field])));}
    }
    for(const table of ['field_evidence','research_sources']) {
      statements.push(env.DIRECTORY_DB.prepare(`DELETE FROM ${table} WHERE entity_type='provider' AND entity_id=?`).bind(target.id));
      for(const row of before.relations[table]||[]){const fields=Object.keys(row);statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO ${table}(${fields.join(',')}) VALUES (${fields.map(()=>'?').join(',')})`).bind(...fields.map(field=>row[field])));}
    }
  }
  statements.push(env.DIRECTORY_DB.prepare(`UPDATE providers SET ${MERGE_FIELDS.map(field=>`${field}=?`).join(',')},metadata_image_url=?,metadata_image_source_url=?,metadata_image_type=?,metadata_image_checked_at=?,merge_revision=merge_revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(...MERGE_FIELDS.map(field=>target[field]),target.metadata_image_url,target.metadata_image_source_url,target.metadata_image_type,target.metadata_image_checked_at,target.id));
  statements.push(env.DIRECTORY_DB.prepare(`UPDATE submissions SET status='pending',reviewed_at=NULL WHERE id=?`).bind(event.submission_id));
  statements.push(env.DIRECTORY_DB.prepare(`UPDATE submission_approval_emails SET status='cancelled',updated_at=CURRENT_TIMESTAMP WHERE submission_id=? AND status IN ('pending','failed','blocked')`).bind(event.submission_id));
  statements.push(env.DIRECTORY_DB.prepare(`UPDATE provider_merge_events SET rolled_back_at=CURRENT_TIMESTAMP WHERE id=?`).bind(eventId));
  statements.push(env.DIRECTORY_DB.prepare(`INSERT INTO approval_events(submission_id,action,actor,note) VALUES (?,'reopened','admin',?)`).bind(event.submission_id,`Rolled back merge ${eventId}`));
  await env.DIRECTORY_DB.batch(statements);
  return {ok:true,targetProviderId:target.id,sourceProviderId:source?.id || null};
}

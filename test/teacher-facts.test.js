import test from 'node:test';
import assert from 'node:assert/strict';
import { teacherClassification, teacherAvailability, verifiedLessonFormats, officialWebsite, verifiedBookingUrl } from '../src/teacher-facts.js';
import { filterListings } from '../src/directory-utils.js';
import { seoFixture } from '../scripts/seo-fixture.mjs';
import worker, { getDirectory } from '../src/worker.js';
const evidence = (field, date='2026-11-15') => ({ field_name:field, verification_status:'verified', source_url:'https://school.example/faculty', verified_at:date });
test('teacher type, availability and booking need separate reliable evidence', () => {
 const item={kind:'teacher', teacher_type:'independent',availability_status:'accepting_students',website_url:'https://school.example/faculty/person',booking_url:'https://school.example/book',affiliations:[{website_url:'https://school.example/'}]};
 assert.equal(teacherClassification(item).value,null); assert.equal(teacherAvailability(item).label,'Availability unconfirmed'); assert.equal(verifiedBookingUrl(item),'');
 item.fact_evidence=[evidence('affiliation')]; assert.equal(teacherClassification(item).value,'institutional');assert.equal(officialWebsite(item).label,'View Faculty Profile');assert.equal(teacherAvailability(item).value,null);
 item.fact_evidence.push(evidence('teacher_type'),evidence('availability_status'),evidence('booking_url'));
 assert.equal(teacherClassification(item).value,'independent');assert.equal(teacherAvailability(item,Date.parse('2026-11-16')).value,'accepting_students');assert.equal(teacherAvailability(item,Date.parse('2027-01-01')).value,null);assert.equal(teacherAvailability(item,Date.parse('2026-11-14')).value,null);assert.equal(verifiedBookingUrl(item),item.booking_url);
 item.website_url='javascript:alert(1)';assert.equal(officialWebsite(item).url,'');
});
test('lesson filters include both formats only when documented and compose with search',()=>{
 const teacher={id:'both',name:'Test Teacher',kind:'teacher',instruction_mode:'both',fact_evidence:[evidence('instruction_mode')]};
 const unknown={...teacher,id:'unknown',fact_evidence:[]};
 assert.deepEqual(verifiedLessonFormats(unknown),[]);assert.deepEqual(verifiedLessonFormats(teacher),['private','group']);
 for(const lessonFormat of ['private','group'])assert.deepEqual(filterListings([teacher,unknown],{lessonFormat,q:'Test',sort:'name'}).map(x=>x.id),['both']);
 assert.deepEqual(verifiedLessonFormats({kind:'teacher',offerings:[{instruction_mode:'group',instructionModeVerified:true}]}),['group']);
});
test('removal requests are private, authenticated, verified, additive and invalidate public caches',async()=>{
 const {db,env}=seoFixture({sharedCache:true});env.ADMIN_REVIEW_KEY='isolated-owner-test';
 const call=(path,body,admin=false)=>worker.fetch(new Request('https://example.com'+path,{method:'POST',headers:{'Content-Type':'application/json',...(admin?{Authorization:'Bearer '+env.ADMIN_REVIEW_KEY}:{})},body:JSON.stringify(body)}),env);
 try {
  const directory=await getDirectory(env);const teacher=directory.teachers[0];const count=db.prepare('SELECT count(*) n FROM instructors').get().n;
  const profilePath='/teachers/'+teacher.slug+'/';assert.equal((await worker.fetch(new Request('https://example.com'+profilePath),env)).status,200);
  const payload={type:'removal',target_kind:'teacher',target_id:teacher.id,contact_name:'Teacher Owner',contact_email:'owner@example.com',description:'Please remove my public listing.',verification_information:'Please verify through my official school contact.'};
  const response=await call('/api/submissions',payload);assert.equal(response.status,201,await response.clone().text());const {submissionId:id}=await response.json();
  assert.equal(db.prepare('SELECT profile_status FROM instructors WHERE id=?').get(teacher.id).profile_status,'published');
  assert.equal((await call('/api/admin/decision',{id,action:'approved',ownership_verified:true})).status,401);
  assert.equal((await call('/api/admin/decision',{id,action:'approved'},true)).status,400);
  assert.equal((await call('/api/admin/decision',{id,action:'approved',ownership_verified:true,verification_note:'Confirmed through the verified official institutional email.'},true)).status,200);
  assert.equal(db.prepare('SELECT profile_status FROM instructors WHERE id=?').get(teacher.id).profile_status,'archived');
  assert.equal(db.prepare('SELECT count(*) n FROM instructors').get().n,count);assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
  assert.ok(!(await getDirectory(env)).teachers.some(x=>x.id===teacher.id));assert.equal((await worker.fetch(new Request('https://example.com'+profilePath),env)).status,404);
  assert.match(db.prepare('SELECT note FROM approval_events WHERE submission_id=?').get(id).note,/Ownership verified/);
  const sitemap=await(await worker.fetch(new Request('https://example.com/sitemap-coaches.xml'),env)).text();assert.ok(!sitemap.includes(profilePath));
 }finally{db.close();}
});
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
test('teacher-fact migration retains all original records and leaves unsupported facts unknown',()=>{
 const db=new DatabaseSync(':memory:');try {
  const path=new URL('../migrations/',import.meta.url);for(const file of readdirSync(path).filter(x=>x.endsWith('.sql')&&x<'0014').sort())db.exec(readFileSync(new URL(file,path),'utf8'));
  const before=db.prepare('SELECT * FROM instructors ORDER BY id').all();const offerings=db.prepare('SELECT * FROM offerings ORDER BY id').all();
  db.exec(readFileSync(new URL('0014_teacher_facts.sql',path),'utf8'));
  const after=db.prepare('SELECT * FROM instructors ORDER BY id').all();assert.equal(after.length,before.length);
  for(let i=0;i<before.length;i++){for(const key of Object.keys(before[i]))assert.deepEqual(after[i][key],before[i][key]);for(const key of ['teacher_type','availability_status','instruction_mode'])assert.equal(after[i][key],null);}
  assert.deepEqual(db.prepare('SELECT * FROM offerings ORDER BY id').all(),offerings);
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
 }finally{db.close();}
});

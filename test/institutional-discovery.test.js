import test from 'node:test';
import assert from 'node:assert/strict';
import { teacherTypes, teacherClassification, verifiedAffiliations, verifiedLessonFormats, lessonFormatLabel, officialWebsite } from '../src/teacher-facts.js';
import { filterListings } from '../src/directory-utils.js';
import { seoFixture } from '../scripts/seo-fixture.mjs';
import { queryDirectory, queryListing } from '../src/directory-data.js';
import worker from '../src/worker.js';
const fact=(field,source='https://school.example/faculty')=>({field_name:field,verification_status:'verified',source_url:source,verified_at:'2026-11-10'});
test('multiple sourced institutions and independent work coexist without implying private instruction',()=>{
 const teacher={kind:'teacher',name:'Test Faculty',teacher_type:'independent',affiliations:[{name:'First School',website_url:'https://school.example/'},{name:'Second School',website_url:'https://second.example/'},{name:'Unconfirmed School',website_url:'https://unknown.example/'}],fact_evidence:[fact('teacher_type','https://teacher.example/'),fact('affiliation_first'),fact('affiliation_second','https://second.example/faculty')]};
 assert.deepEqual(teacherTypes(teacher),['independent','institutional']);assert.equal(teacherClassification(teacher).label,'Independent + Institutional');assert.deepEqual(verifiedAffiliations(teacher).map(x=>x.name),['First School','Second School']);assert.deepEqual(verifiedLessonFormats(teacher),[]);assert.equal(lessonFormatLabel(teacher),'Format unconfirmed');
 for(const teacherType of ['independent','institutional'])assert.equal(filterListings([teacher],{teacherType,q:'faculty'}).length,1);
 assert.equal(filterListings([teacher],{teacherType:'institutional',lessonFormat:'private'}).length,0);
 assert.equal(teacherClassification({kind:'teacher',affiliations:teacher.affiliations}).label,'Affiliation unconfirmed');
});
test('workshops and multiple lesson formats require their own sources',()=>{
 const workshop={kind:'offering',instruction_mode:'private',price_basis:'workshop',name:'Workshop in biography'};
 assert.deepEqual(verifiedLessonFormats(workshop),[]);
 workshop.terms=[{slug:'workshops-and-intensives',...fact('term')}];assert.deepEqual(verifiedLessonFormats(workshop),['workshop']);assert.equal(officialWebsite({...workshop,source_url:'https://school.example/classes'}).label,'Explore Classes');
 const teacher={kind:'teacher',name:'Three Formats',instruction_mode:'both',fact_evidence:[fact('instruction_mode'),fact('lesson_format_workshop')]};
 assert.deepEqual(verifiedLessonFormats(teacher),['private','group','workshop']);
 for(const lessonFormat of ['private','group','workshop'])assert.equal(filterListings([teacher],{lessonFormat}).length,1);
 assert.deepEqual(verifiedLessonFormats({kind:'teacher',offerings:[workshop]}),['workshop']);
});
test('institutional discovery, workshop lookups, SEO and filtered pagination remain consistent',async()=>{
 const {db,env}=seoFixture({sharedCache:true});try{
  const data=await queryDirectory(env);assert.equal(data.teachers.length,216);assert.equal(data.offerings.length,29);assert.equal(data.providers.length,22);
  const teachers=data.teachers.filter(t=>teacherTypes(t).includes('institutional'));assert.equal(teachers.length,167);
  const unknownFormat=teachers.find(t=>!verifiedLessonFormats(t).length);assert.ok(unknownFormat);assert.ok(filterListings(data.teachers,{teacherType:'institutional'}).some(t=>t.id===unknownFormat.id));
  assert.equal(data.offerings.filter(o=>verifiedLessonFormats({...o,kind:'offering'}).includes('workshop')).length,0);
  db.prepare("INSERT INTO field_evidence(entity_type,entity_id,field_name,verification_status,source_url,verified_at) VALUES('offering',?,'lesson_format_workshop','verified','https://school.example/workshops','2026-11-10')").run(data.offerings[0].id);
  const updated=await queryDirectory(env);const workshops=updated.offerings.filter(o=>verifiedLessonFormats({...o,kind:'offering'}).includes('workshop'));assert.equal(workshops.length,1);
  assert.deepEqual(verifiedLessonFormats({...await queryListing(env,'offerings',workshops[0].slug),kind:'offering'}),verifiedLessonFormats({...workshops[0],kind:'offering'}));
  const url='https://example.com';const request=path=>worker.fetch(new Request(url+path),env);
  const filtered=await request('/?providerType=institution');assert.equal(filtered.status,200);const html=await filtered.text();assert.match(html,/noindex, follow/);assert.match(html,/18 published matching listings/);assert.match(html,/rel="canonical" href="https:\/\/example.com\/"/);
  const profile=await(await request('/teachers/'+unknownFormat.slug+'/')).text();assert.match(profile,/Claim or Remove Listing/);assert.match(profile,/Format unconfirmed/);assert.match(profile,/Availability unconfirmed/);assert.ok(verifiedAffiliations(unknownFormat).some(p=>profile.includes(p.name.replaceAll('&','&amp;'))));
  assert.match(await(await request('/')).text(),/Explore independent practices, studios, and institutions offering voice training\./);
 }finally{db.close();}
});

test('verified roster metadata plus an existing same-domain institution confirms affiliation; biographies alone do not',()=>{
 const teacher={kind:'teacher',affiliations:[{name:'School',website_url:'https://school.example/'}],fact_evidence:[fact('profile')]};
 assert.deepEqual(teacherTypes(teacher),[]);teacher.fact_evidence[0].is_affiliation_roster=1;assert.deepEqual(teacherTypes(teacher),['institutional']);
 teacher.fact_evidence[0].source_url='https://unrelated.example/faculty';assert.deepEqual(teacherTypes(teacher),[]);
});

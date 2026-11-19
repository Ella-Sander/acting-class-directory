import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { getDirectory, invalidateDirectory } from '../src/worker.js';
import { providerDomain, mergeFields } from '../src/provider-identity.js';
import { mergeProposal, buildMerge } from '../src/provider-merges.js';
import { rollbackMerge } from '../src/provider-merge-rollback.js';
import { publicAddress, openGraphImage, refreshProviderPreview } from '../src/provider-preview.js';
import { seoFixture } from '../scripts/seo-fixture.mjs';
const origin='https://example.com';
const fixture=()=>{const f=seoFixture({sharedCache:true});f.env.ADMIN_REVIEW_KEY='domain-test-key';return f;};
const call=(env,path,body,admin=true)=>worker.fetch(new Request(origin+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(admin?{Authorization:`Bearer ${env.ADMIN_REVIEW_KEY}`}:{})},...(body?{body:JSON.stringify(body)}:{})}),env);
function seed(db){
  db.exec(`INSERT INTO providers(id,slug,listing_type,provider_classification,name,description,website_url,source_url,listing_status) VALUES ('domain-target','domain-target','studio','studio_business','Domain Studio','Original approved description','https://example.org/','https://example.org/','published'),('domain-source','domain-source','studio','studio_business','Domain Studio','Complementary source description','https://lessons.example.org/teachers?x=1','https://lessons.example.org/teachers?x=1','published');
  INSERT INTO provider_domains(domain,provider_id) VALUES ('example.org','domain-target');
  UPDATE providers SET registrable_domain='example.org' WHERE id IN ('domain-target','domain-source');
  INSERT INTO offerings(id,slug,provider_id,name,listing_status) VALUES ('domain-service','domain-service','domain-source','Source service','published');
  INSERT INTO submissions(id,submission_type,status,contact_email,payload_json) VALUES ('domain-review','profile_update','pending','private@example.org','{"type":"domain_merge","source_provider_id":"domain-source","provider_id":"domain-target","website_url":"https://lessons.example.org/teachers?x=1"}');`);
}
test('registrable domain handles paths, queries, subdomains, www, IDNs and multi-label public suffixes',()=>{
  for(const url of ['https://example.co.uk/a?b=2','http://WWW.example.co.uk/x','https://lessons.school.example.co.uk/'])assert.equal(providerDomain(url),'example.co.uk');
  assert.equal(providerDomain('https://www.bücher.de/a'),'xn--bcher-kva.de');
  assert.equal(providerDomain('https://foo.github.io/'),'github.io');
  for(const url of ['https://co.uk','https://127.0.0.1','https://localhost','ftp://example.org','https://user:pw@example.org'])assert.equal(providerDomain(url),'');
  assert.notEqual(providerDomain('https://notexample.org'),providerDomain('https://example.org'));
});
test('scalar conflicts require review; complementary values fill gaps and descriptions combine explicitly',()=>{
  const before={name:'Studio',description:'First',website_url:'https://example.org'};const incoming={description:'Second',teaching_approach:'Bel canto'};
  assert.deepEqual(mergeFields(before,incoming).conflicts,['description']);
  const merged=mergeFields(before,incoming,{description:{choice:'combine'}});
  assert.equal(merged.fields.description,'First\n\nSecond');assert.equal(merged.fields.teaching_approach,'Bel canto');assert.equal(before.description,'First');
  assert.ok(mergeFields(before,{website_url:'https://example.org/x'},{website_url:{choice:'combine'}}).conflicts.includes('website_url'));
});
test('existing domain duplicates present one public provider without mutating conflicting approved records',async()=>{
  const {db,env}=fixture();try{
    seed(db);const directory=await getDirectory(env);
    const group=directory.providers.filter(item=>item.registrable_domain==='example.org');assert.equal(group.length,1);
    assert.equal(group[0].id,'domain-target');assert.equal(group[0].description,'Original approved description');
    assert.ok(group[0].offerings.some(item=>item.id==='domain-service'));
    assert.equal(directory.offerings.find(item=>item.id==='domain-service').provider_id,'domain-target');
    assert.ok(group[0].aliases.some(item=>item.id==='domain-source'));
    assert.equal(db.prepare("SELECT description FROM providers WHERE id='domain-source'").get().description,'Complementary source description');
    assert.equal((await call(env,'/providers/domain-source/',null,false)).status,308);
  }finally{db.close();}
});
test('provider submissions on another page propose merging and cannot approve a duplicate',async()=>{
  const {db,env}=fixture();try{
    seed(db);
    const response=await call(env,'/api/submissions',{type:'provider',name:'Another Studio Name',listing_type:'studio',description:'A complementary service description',contact_email:'private@example.net',website_url:'https://www.lessons.example.org/new/page?query=1',offering_name:'New unique service',format:'online',instruction_mode:'private'},false);
    assert.equal(response.status,201);const result=await response.json();assert.equal(result.mergeProposed,true);
    const ordinary=await call(env,'/api/admin/decision',{id:result.submissionId,action:'approved',details_verified:true,provider_classification:'studio_business'});
    assert.equal(ordinary.status,409);
    const proposalResponse=await call(env,`/api/admin/provider-merge?submission_id=${result.submissionId}`);
    assert.equal(proposalResponse.status,200);const proposal=await proposalResponse.json();assert.equal(proposal.target.id,'domain-target');
    const resolutions=Object.fromEntries(proposal.conflicts.map(field=>[field,{choice:field==='description'?'combine':'existing'}]));
    const approved=await call(env,'/api/admin/provider-merge',{submission_id:result.submissionId,details_verified:true,expected_revision:proposal.expected_revision,resolutions});
    assert.equal(approved.status,200,await approved.clone().text());
    assert.equal(db.prepare("SELECT count(*) AS n FROM providers WHERE registrable_domain='example.org' AND listing_status='published'").get().n,2,'Existing conflicting source remains until reviewed, no third provider was created');
    assert.ok(db.prepare("SELECT id FROM offerings WHERE provider_id='domain-target' AND name='New unique service'").get());
    assert.ok(db.prepare("SELECT * FROM provider_preview_jobs WHERE provider_id='domain-target'").get());
  }finally{db.close();}
});
test('existing merge preserves IDs and references, redirects old URL, refreshes sitemaps and supports guarded rollback',async()=>{
  const {db,env}=fixture();try{
    seed(db);await getDirectory(env);
    const proposal=await mergeProposal(env,'domain-review');
    const body={submission_id:'domain-review',details_verified:true,expected_revision:proposal.expected_revision,source_revision:proposal.source_revision,resolutions:Object.fromEntries(proposal.conflicts.map(field=>[field,{choice:field==='description'?'combine':'existing'}]))};
    const response=await call(env,'/api/admin/provider-merge',body);assert.equal(response.status,200,await response.clone().text());const result=await response.json();
    assert.equal(db.prepare("SELECT provider_id FROM offerings WHERE id='domain-service'").get().provider_id,'domain-target');
    assert.equal(db.prepare("SELECT listing_status FROM providers WHERE id='domain-source'").get().listing_status,'archived');
    const redirect=await call(env,'/providers/domain-source/',null,false);assert.equal(redirect.status,308);assert.equal(redirect.headers.get('Location'),origin+'/providers/domain-target/');
    const sitemap=await call(env,'/sitemap-studios.xml',null,false);assert.equal(sitemap.status,200);const xml=await sitemap.text();assert.ok(!xml.includes('/providers/domain-source/'));assert.ok(xml.includes('/providers/domain-target/'));
    assert.ok(!JSON.stringify(await getDirectory(env)).includes('private@example.org'));
    const rollback=await rollbackMerge(env,result.mergeEventId);assert.equal(rollback.ok,true);await invalidateDirectory(env);
    assert.equal(db.prepare("SELECT provider_id FROM offerings WHERE id='domain-service'").get().provider_id,'domain-source');
    assert.equal(db.prepare("SELECT description FROM providers WHERE id='domain-target'").get().description,'Original approved description');
    assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
  }finally{db.close();}
});
test('unresolved, stale, unauthorized and mismatched-domain merges cannot modify approved data',async()=>{
  const {db,env}=fixture();try{
    seed(db);const proposal=await mergeProposal(env,'domain-review');
    const body={submission_id:'domain-review',details_verified:true,expected_revision:proposal.expected_revision,source_revision:proposal.source_revision,resolutions:{}};
    assert.equal((await call(env,'/api/admin/provider-merge',body,false)).status,401);
    assert.equal((await call(env,'/api/admin/provider-merge',body)).status,409);
    db.prepare("UPDATE providers SET description='New approved change' WHERE id='domain-target'").run();
    body.resolutions=Object.fromEntries(proposal.conflicts.map(field=>[field,{choice:'existing'}]));
    assert.equal((await call(env,'/api/admin/provider-merge',body)).status,409);
    assert.equal(db.prepare("SELECT description FROM providers WHERE id='domain-target'").get().description,'New approved change');
    assert.equal(db.prepare("SELECT count(*) AS n FROM provider_merge_events").get().n,0);
    const plan=await mergeProposal(env,'domain-review');const first=await buildMerge(env,plan,{expected_revision:plan.expected_revision,source_revision:plan.source_revision,resolutions:Object.fromEntries(plan.conflicts.map(field=>[field,{choice:'existing'}]))});
    db.prepare("UPDATE providers SET description='Concurrent review' WHERE id='domain-target'").run();
    await assert.rejects(env.DIRECTORY_DB.batch(first.statements));
    assert.equal(db.prepare("SELECT count(*) AS n FROM provider_merge_events").get().n,0);
  }finally{db.close();}
});
test('preview metadata parsing prioritizes Open Graph and SSRF guards reject private addresses',()=>{
  assert.equal(openGraphImage('<meta content="/preview.jpg?a=1&amp;b=2" property="og:image">','https://example.org/page'),'https://example.org/preview.jpg?a=1&b=2');
  assert.equal(openGraphImage('<meta property="og:image" content="http://127.0.0.1/a">','https://example.org'),'');
  for(const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','192.168.1.1','::1','::ffff:127.0.0.1','fd00::1','fe80::1'])assert.equal(publicAddress(ip),false,ip);
  assert.equal(publicAddress('8.8.8.8'),true);assert.equal(publicAddress('2606:4700:4700::1111'),true);
});

test('Open Graph refresh is cached, uses the existing image columns, and never resets verified logos',async()=>{
  const {db,env}=fixture();try{
    seed(db);db.prepare("INSERT INTO provider_preview_jobs(provider_id,website_url) VALUES ('domain-target','https://example.org/')").run();
    let requests=0;let invalidations=0;
    env.PREVIEW_FETCH=async(url,options={})=>{
      requests++;
      if(String(url).startsWith('https://cloudflare-dns.com/'))return Response.json({Answer:[{type:1,data:'8.8.8.8'}]});
      if(options.method==='HEAD')return new Response(null,{headers:{'Content-Type':'image/jpeg'}});
      return new Response('<meta property="og:image" content="https://cdn.example.org/voice.jpg">',{headers:{'Content-Type':'text/html'}});
    };
    await refreshProviderPreview(env,'domain-target','https://example.org/',async()=>{invalidations++;});
    const firstRequests=requests;assert.ok(firstRequests>0);assert.equal(invalidations,1);
    assert.equal(db.prepare("SELECT metadata_image_url FROM providers WHERE id='domain-target'").get().metadata_image_url,'https://cdn.example.org/voice.jpg');
    await refreshProviderPreview(env,'domain-target','https://example.org/',async()=>{invalidations++;});
    assert.equal(requests,firstRequests,'Cached metadata avoids all external requests');
    assert.equal(invalidations,2);
  }finally{db.close();}
});

test('matching services expose conflicts, merge in place and rollback retains archived new records',async()=>{
  const {db,env}=fixture();try{
    seed(db);db.prepare("UPDATE offerings SET provider_id='domain-target',description='Old service description',format='online' WHERE id='domain-service'").run();
    const payload={type:'provider',name:'Domain Studio',listing_type:'studio',description:'Original approved description',website_url:'https://example.org/',offering_name:'Source service',offering_description:'Additional service detail',format:'hybrid',instruction_mode:'group'};
    db.prepare("INSERT INTO submissions(id,submission_type,contact_email,payload_json) VALUES ('service-review','provider','private@example.org',?)").run(JSON.stringify(payload));
    const proposal=await mergeProposal(env,'service-review');assert.ok(proposal.service.conflicts.includes('description'));assert.ok(proposal.service.conflicts.includes('format'));
    const request={submission_id:'service-review',details_verified:true,expected_revision:proposal.expected_revision,service_version:proposal.service.version,resolutions:Object.fromEntries(proposal.conflicts.map(field=>[field,{choice:'existing'}])),service_resolutions:Object.fromEntries(proposal.service.conflicts.map(field=>[field,{choice:field==='description'?'combine':'incoming'}]))};
    const response=await call(env,'/api/admin/provider-merge',request);assert.equal(response.status,200,await response.clone().text());const result=await response.json();
    const service=db.prepare("SELECT * FROM offerings WHERE id='domain-service'").get();assert.equal(service.format,'hybrid');assert.match(service.description,/Old service description\n\nAdditional service detail/);
    await rollbackMerge(env,result.mergeEventId);assert.equal(db.prepare("SELECT format FROM offerings WHERE id='domain-service'").get().format,'online');
    assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
  }finally{db.close();}
});

test('rollback rejects later relationship edits and duplicate domain reservations roll back atomically',async()=>{
  const {db,env}=fixture();try{
    seed(db);const p=await mergeProposal(env,'domain-review');const response=await call(env,'/api/admin/provider-merge',{submission_id:'domain-review',details_verified:true,expected_revision:p.expected_revision,source_revision:p.source_revision,resolutions:Object.fromEntries(p.conflicts.map(field=>[field,{choice:'existing'}]))});assert.equal(response.status,200);const result=await response.json();
    db.prepare("UPDATE offerings SET description='Later approved service change' WHERE id='domain-service'").run();
    await assert.rejects(rollbackMerge(env,result.mergeEventId));
    assert.equal(db.prepare("SELECT description FROM offerings WHERE id='domain-service'").get().description,'Later approved service change');
    const {registerDomain}=await import('../src/provider-identity.js');const statements=[];registerDomain(statements,env,'domain-source','https://other.example.org/');await assert.rejects(env.DIRECTORY_DB.batch(statements));
    assert.equal(db.prepare("SELECT provider_id FROM provider_domains WHERE domain='example.org'").get().provider_id,'domain-target');
  }finally{db.close();}
});

test('merging a resubmitted teacher reuses their existing instructor ID',async()=>{
  const {db,env}=fixture();try{
    seed(db);db.exec("INSERT INTO instructors(id,slug,name,description,website_url,profile_status) VALUES ('existing-domain-teacher','existing-domain-teacher','Existing Teacher','Original teacher bio','https://example.org/old-page','published')");
    const payload={type:'teacher',name:'Existing Teacher',description:'New teaching details',biography:'New documented biography',website_url:'https://lessons.example.org/new-page',offering_name:'New teacher service',format:'online',instruction_mode:'private'};
    db.prepare("INSERT INTO submissions(id,submission_type,contact_email,payload_json) VALUES ('teacher-review','provider','private@example.org',?)").run(JSON.stringify(payload));
    const proposal=await mergeProposal(env,'teacher-review');assert.equal(proposal.existingInstructor.id,'existing-domain-teacher');assert.match(proposal.incoming.description,/New documented biography/);
    const response=await call(env,'/api/admin/provider-merge',{submission_id:'teacher-review',details_verified:true,expected_revision:proposal.expected_revision,resolutions:Object.fromEntries(proposal.conflicts.map(field=>[field,{choice:field==='description'?'combine':'existing'}]))});assert.equal(response.status,200,await response.clone().text());
    const result=await response.json();assert.equal(db.prepare("SELECT count(*) AS n FROM instructors WHERE name='Existing Teacher'").get().n,1);
    assert.equal(db.prepare("SELECT description FROM instructors WHERE id='existing-domain-teacher'").get().description,'Original teacher bio');
    assert.ok(db.prepare("SELECT 1 FROM provider_instructors WHERE provider_id='domain-target' AND instructor_id='existing-domain-teacher'").get());
    await rollbackMerge(env,result.mergeEventId);
    assert.equal(db.prepare("SELECT profile_status FROM instructors WHERE id='existing-domain-teacher'").get().profile_status,'published');
    assert.equal(db.prepare("SELECT listing_status FROM offerings WHERE name='New teacher service'").get().listing_status,'archived');
  }finally{db.close();}
});
test('verified removal archives the whole domain identity so an unmerged alias cannot resurface',async()=>{
  const {db,env}=fixture();try{
    seed(db);
    const payload={type:'removal',target_kind:'provider',target_id:'domain-target',description:'Please remove this approved provider identity.',contact_email:'owner@example.org',contact_name:'Verified owner',verification_information:'Verified through the official business contact channel.'};
    const response=await call(env,'/api/submissions',payload,false);assert.equal(response.status,201);const {submissionId}=await response.json();
    const decision=await call(env,'/api/admin/decision',{id:submissionId,action:'approved',ownership_verified:true,verification_note:'Verified through the official business contact channel.'});assert.equal(decision.status,200);
    const directory=await getDirectory(env);assert.ok(!directory.providers.some(provider=>provider.registrable_domain==='example.org'));
    assert.ok(!directory.offerings.some(offering=>offering.id==='domain-service'));
    assert.equal(db.prepare("SELECT count(*) AS n FROM providers WHERE registrable_domain='example.org' AND listing_status='archived'").get().n,2);
  }finally{db.close();}
});

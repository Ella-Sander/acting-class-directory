// Public professional sources reviewed 2026-11-10. School faculty listings
// describe instruction through that school, not guaranteed private availability.
const slug = s => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const sources = {
  bkcm: 'https://bkcm.org/voice-lessons-at-bkcm/',
  lucy: 'https://www.kaufmanmusiccenter.org/lms/faculty-list/',
  third: 'https://www.thirdstreet.nyc/faculty-staff-board-of-directors',
  bloomingdale: 'https://www.bsmny.org/about-us/faculty-and-staff/',
  greenwich: 'https://greenwichhouse.org/music-school/staff-and-faculty/',
  farnsworth: 'https://www.mattfarnsworthvoice.com/about',
  nyja: 'https://www.nyjazzacademy.com/category/faculty/voice/',
  nyjw: 'https://newyorkjazzworkshop.com/nyjw-music-teachers/voice-lessons/',
  liz: 'https://www.lizcaplan.com/team-1',
  '92ny': 'https://www.92ny.org/class/everybody-can-sing',
  nysta: 'https://nyst.org/find-a-voice-teacher/',
};
const providers = [
  ['bkcm', 'Brooklyn Conservatory of Music', 'school', 'bkcm'],
  ['lucy', 'Lucy Moses School', 'school', 'lucy'],
  ['third', 'Third Street Music School', 'school', 'third'],
  ['bloomingdale', 'Bloomingdale School of Music', 'school', 'bloomingdale'],
  ['greenwich', 'Greenwich House Music School', 'school', 'greenwich'],
  ['farnsworth', 'Matt Farnsworth Voice Studio', 'studio', 'farnsworth'],
  ['nyja', 'New York Jazz Academy', 'school', 'nyc'],
  ['nyjw', 'New York Jazz Workshop', 'school', 'nyc'],
  ['liz', 'Liz Caplan Vocal Studios', 'studio', 'nyc'],
  ['92ny', '92NY School of Music', 'school', '92ny'],
].map(([key, name, type, location]) => ({ key, id: `catalog-provider-${key}`, slug: slug(name), name, type, location, source: sources[key], description: `${name} offers voice instruction in New York City. Confirm current enrollment with the school or studio.` }));
const byProvider = Object.fromEntries(providers.map(p => [p.key, p]));
const locations = [
  { key:'bkcm', label:'Park Slope, Brooklyn', borough:'Brooklyn', neighborhood:'Park Slope', source:sources.bkcm },
  { key:'lucy', label:'Lucy Moses School, Upper West Side', borough:'Manhattan', neighborhood:'Upper West Side', address:'129 West 67th Street, New York, NY 10023', source:'https://www.kaufmanmusiccenter.org/lms/faculty/shirley-perkins/' },
  { key:'third', label:'Third Street Music School, New York City', source:'https://www.thirdstreet.nyc/' },
  { key:'bloomingdale', label:'Bloomingdale School of Music, Upper West Side', borough:'Manhattan', neighborhood:'Upper West Side', address:'323 West 108th Street, New York, NY 10025', source:'https://www.bsmny.org/vocal-arts/' },
  { key:'greenwich', label:'Greenwich House Music School, West Village', borough:'Manhattan', neighborhood:'West Village', address:'46 Barrow Street, New York, NY 10014', source:'https://greenwichhouse.org/music-school/contact-greenwich-house-music-school/' },
  { key:'farnsworth', label:'Upper West Side, Manhattan', borough:'Manhattan', neighborhood:'Upper West Side', source:'https://www.mattfarnsworthvoice.com/contact' },
  { key:'nyc', label:'New York City', source:sources.nyjw },
  { key:'92ny', label:'92nd Street Y, Manhattan', borough:'Manhattan', source:sources['92ny'] },
  { key:'upper-west', label:'Upper West Side, Manhattan', borough:'Manhattan', neighborhood:'Upper West Side', source:'https://www.vocalpowerllc.com/contact' },
  { key:'midtown', label:'Midtown, Manhattan', borough:'Manhattan', neighborhood:'Midtown', source:'https://formanvocalcoach.com/contact/' },
  { key:'sherry', label:'Sherry Boone Studio, Brooklyn', borough:'Brooklyn', address:'92 Gates Avenue, Suite 3A, Brooklyn, NY 11238', source:'https://www.sherryboone.com/private_lesson_faq' },
  { key:'online', label:'Online', online:true, source:sources.farnsworth },
].map(l => ({ ...l, id:`catalog-location-${l.key}`, city:'New York', region:'NY' }));
const teachers = [];
function teacher(name, options) {
  const provider = byProvider[options.provider];
  const source = options.source || provider?.source;
  teachers.push({ id:`catalog-teacher-${slug(name)}`, slug:`${slug(name)}-voice-teacher`, name, title:'Voice teacher', source, sourceType:'official_website', website:source, description:provider ? `Voice faculty at ${provider.name}. Contact the school or studio for current lesson placement.` : '', location:provider?.location || 'nyc', terms:['training-voice-lessons'], formats:[], ...options });
}
for (const name of ['Alexis Hightower','Anush Avetisyan','Christine Cornell','Conrad Chu','Emma Larsson','Jasper Fearon','Julie Milgram','Kate Victor','Lucia Stavros']) teacher(name, {provider:'bkcm'});
for (const [name,page] of [['Judith Barnes','judith-barnes'],['Re’ut Ben-Ze’ev','re-ut-ben-ze-ev'],['Sun Young Chang','sun-young-chang'],['Oren Gradus','oren-gradus'],['Christopher Nazarian','christopher-nazarian'],['Shirley Perkins','shirley-perkins'],['Konstantina Siokis','konstantina-siokis'],['Laca Tines','laca-tines'],['Joan Zimmerman','joan-zimmerman']]) teacher(name, {provider:'lucy',source:`https://www.kaufmanmusiccenter.org/lms/faculty/${page}/`});
// Siokis also teaches at Third Street: preserve that affiliation without a duplicate listing.
for (const name of ['Kaitlin Stark','Audra Bowers','Valeska Cambron','Katie Seiler']) teacher(name, {provider:'third'});
for (const name of ['Christine Browning','Ian Harris','Katherine Hoffman','Nicole Haslett']) teacher(name, {provider:'bloomingdale'});
teacher('Tamuz Nissim', {provider:'bloomingdale',title:'Jazz voice teacher',terms:['training-voice-lessons','genre-jazz-cabaret']});
for (const name of ['Charlotte Detrick','John Tafone','Lucy Galliher','Mary Hurlbut']) teacher(name, {provider:'greenwich'});
for (const [name,location,description,source] of [
  ['Lily Librach','nyc','NYSTA-listed voice teacher offering technique, repertoire and acting coaching in New York.',sources.nysta],
  ['Nancy Adams','nyc','NYSTA-listed New York teacher offering vocal technique for classical singing.',sources.nysta],
  ['Wilma Wever','nyc','New York voice teacher listed by NYSTA for technique, repertoire and performance coaching.',sources.nysta],
  ['Josephine Mongiardo-Cooper','nyc','NYSTA-listed New York teacher offering vocal technique for classical and musical-theatre singers.',sources.nysta],
  ['Debra Vanderlinde','upper-west','Upper West Side voice teacher listed by NYSTA for technique and repertoire coaching.',sources.nysta],
  ['Alison Bolshoi','upper-west','NYSTA-listed teacher at The Bolshoi Music Studio in New York, offering technique and repertoire coaching.',sources.nysta+'?teacher_page=2'],
]) teacher(name, {source,website:null,sourceType:'other',location,description,formats:['online'],terms:['training-voice-lessons','technique-vocal']});
for (const name of ['Matt Farnsworth','Mike Maixner','Grace MacGregor Chermak','Jesse Kissel','EROS']) teacher(name, {provider:'farnsworth',title:'Vocal coach',formats:['in_person','online'],terms:['training-voice-lessons','training-vocal-coaching']});
for (const name of ['Thana Alexa','Yaala Ballin','Vicki Burns','Miles Griffith','Aubrey Johnson','Carolyn Leonhart','Sofia Rei','Tammy Scheffer','Sara Serpa','Sirintip','Ron Wilkins']) teacher(name, {provider:'nyja',title:'Jazz voice teacher',terms:['training-voice-lessons','genre-jazz-cabaret'],description:'Voice instructor listed by New York Jazz Academy; contact the school for placement.'});
for (const [name,page] of [['Nadia Chechet','nadia-chechet'],['Michelle Walker','michelle-walker'],['Elana Hedrych','elana-hedrych'],['Jocelyn Medina','jocelyn-medina']]) teacher(name, {provider:'nyjw',source:`https://newyorkjazzworkshop.com/faculty/${page}/`,formatSource:sources.nyjw,title:'Jazz voice teacher',formats:['in_person','online'],terms:['training-voice-lessons','genre-jazz-cabaret']});
teacher('Annie Chen', {provider:'bkcm',source:'https://bkcm.org/class-ensemble/jazz-vocal-lab/',title:'Jazz vocal instructor',terms:['training-vocal-coaching','genre-jazz-cabaret'],description:'New York vocalist and instructor of Jazz Vocal Lab at Brooklyn Conservatory of Music.'});
teacher('Liz Caplan', {provider:'liz',source:'https://www.lizcaplan.com/about-liz',title:'Vocal coach',terms:['training-vocal-coaching','technique-vocal'],description:'Vocal coach for stage and recording performers, with an individual approach to breath, alignment and expression.'});
teacher('Fernanda Douglas', {provider:'liz',title:'Vocal coach',terms:['training-vocal-coaching'],description:'New York City voice coach and music director, listed as an associate at Liz Caplan Vocal Studios.'});
teacher('Rae Covey', {provider:'liz',title:'Vocal coach',terms:['training-vocal-coaching'],description:'Voice-coaching associate at Liz Caplan Vocal Studios, supporting performers as they develop their individual voices.'});
teacher('David Sisco', {source:'https://davidsisco.com/teaching/',locationSource:'https://davidsisco.com/',terms:['training-voice-lessons','training-audition-repertoire'],description:'New York City teaching artist combining vocal technique with interpretation and storytelling in song.'});
teacher('Mary Setrakian', {source:'https://marysetrakian.com/newyorkclasses',formats:['in_person','online'],description:'Private voice instruction offered in New York City and on Zoom; contact the studio for availability.'});
teacher('Deric Rosenblatt', {source:'https://www.vocalpowerllc.com/',locationSource:'https://www.vocalpowerllc.com/contact',location:'upper-west',title:'Vocal coach',terms:['training-vocal-coaching','training-voice-lessons'],description:'Individual voice training through Vocal Power, with a studio on Manhattan’s Upper West Side.'});
teacher('Michael Forman', {source:'https://formanvocalcoach.com/',locationSource:'https://formanvocalcoach.com/contact/',location:'midtown',title:'Vocal coach',terms:['training-vocal-coaching','training-audition-repertoire'],description:'Midtown Manhattan vocal coaching for audition preparation, song interpretation, repertoire and role preparation.'});
teacher('Sherry Boone', {source:'https://www.sherryboone.com/lessons_with_sherry',locationSource:'https://www.sherryboone.com/private_lesson_faq',location:'sherry',formats:['in_person'],description:'Brooklyn voice instruction for beginning singers, focused on vocal exercises and applying technique to songs.'});

const classes=[];
function course(key,name,provider,source,description,options={}) {
  classes.push({id:`catalog-class-${key}`,slug:key,name,provider,source,description,location:byProvider[provider].location,terms:['training-group-singing','training-voice-lessons'],format:null,price:null,priceBasis:null,sessions:null,minutes:null,instructors:[],...options});
}
course('bkcm-intro-singing-adults','Intro to Singing for Adults — BKCM','bkcm','https://bkcm.org/class-ensemble/intro-to-singing-for-adults-level-1/',
  'Adult group singing with Alexis Hightower, exploring breathing, registers, pitch and expression. Published semester tuition; confirm enrollment and fees.',
  {format:'in_person',price:776,priceBasis:'full_course',minutes:90,schedule:'16-week semester; Wednesday evenings are listed. Confirm current availability with BKCM.',instructors:['Alexis Hightower']});
course('bkcm-jazz-vocal-lab','Jazz Vocal Lab — BKCM','bkcm','https://bkcm.org/class-ensemble/jazz-vocal-lab/',
  'Adult jazz singing with Annie Chen and piano accompaniment. Experience and placement requirements apply; a foundations section is also offered.',
  {format:'in_person',price:776,priceBasis:'full_course',minutes:90,audition:true,terms:['training-group-singing','genre-jazz-cabaret'],schedule:'16-week semester. Confirm section placement, dates and financial aid.',instructors:['Annie Chen']});
course('brooklyn-harmonics-vocal-program','Brooklyn Harmonics Vocal Program','bkcm','https://bkcm.org/brooklyn-harmonics/',
  'Age-specific vocal ensembles led by Christine Cornell and Jeff Klitz. Auditions, cohorts, tuition and rehearsal arrangements vary.',
  {format:'in_person',audition:true,terms:['training-group-singing','genre-pop','genre-rock'],instructors:['Christine Cornell']});
course('brooklyn-conservatory-chorale','Brooklyn Conservatory Chorale','bkcm','https://bkcm.org/class-ensemble/brooklyn-conservatory-chorale/',
  'Adult choral singing directed by Conrad Chu. Audition required. Published tuition is per semester; annual enrollment is also offered.',
  {format:'in_person',price:344,priceBasis:'full_course',audition:true,instructors:['Conrad Chu']});
course('lucy-moses-opera-workshop','Opera Workshop — Lucy Moses School','lucy','https://www.kaufmanmusiccenter.org/lms/class/c19688/',
  'Adult opera-scene workshop with Judith Barnes, developing musical interpretation, language and stagecraft. Audition required; confirm current or next-session enrollment.',
  {price:605,priceBasis:'full_course',sessions:10,minutes:120,audition:true,terms:['training-group-singing','genre-classical-opera'],schedule:'Fall 2026 catalog: September 23–December 9.',instructors:['Judith Barnes']});
course('lucy-moses-sight-singing-intermediate-one','Sight-Singing: Intermediate I — Lucy Moses School','lucy','https://www.kaufmanmusiccenter.org/lms/class/c19750/',
  'Adult sight-singing with Liz Fleischer, developing interval reading through songs and part-singing. Ask the school about placement.',
  {price:400,priceBasis:'full_course',sessions:10,minutes:60,terms:['training-group-singing','specialty-music-theory'],schedule:'Fall 2026 catalog: October 6–December 15. Confirm remaining or next-session enrollment.'});
course('lucy-moses-sight-singing-intermediate-two','Sight-Singing: Intermediate II — Lucy Moses School','lucy','https://www.kaufmanmusiccenter.org/lms/class/c19739/',
  'Adult sight-singing with Liz Fleischer, adding chromatic material. Intermediate I or equivalent preparation is a listed prerequisite.',
  {price:400,priceBasis:'full_course',sessions:10,minutes:60,terms:['training-group-singing','specialty-music-theory'],schedule:'Fall 2026 catalog: September 30–December 16. Confirm remaining or next-session enrollment.'});
course('nyja-vocal-jazz-workshops','Vocal Jazz Workshops — New York Jazz Academy','nyja','https://www.nyjazzacademy.com/programs/vocal/vocal-jazz-workshops/',
  'Small-group jazz singing, improvisation and interpretation. Manhattan and online options are advertised; confirm the selected section, placement and tuition.',
  {format:'in_person',terms:['training-group-singing','genre-jazz-cabaret'],instructors:['Tammy Scheffer','Carolyn Leonhart','Vicki Burns']});
course('92ny-everybody-can-sing','Everybody Can Sing — 92NY','92ny','https://www.92ny.org/class/everybody-can-sing',
  'Beginner singing with Elissa Weiss at 92NY, exploring breathing, pitch and group singing. See the school for upcoming sections.',
  {format:'in_person',price:165,priceBasis:'full_course',minutes:90,existingInstructors:['vocal-elissa-weiss']});
course('bloomingdale-broadway-ensemble','Broadway Ensemble — Bloomingdale','bloomingdale','https://www.bsmny.org/class/teens/broadway-ensemble/',
  'Musical-theatre ensemble for ages 13–21, including singing, character work and audition preparation. Tuition covers a 17-week semester.',
  {price:731,priceBasis:'full_course',minutes:75,terms:['training-group-singing','genre-musical-theatre'],instructors:['Christine Browning']});
course('bloomingdale-voice-pre-teens','Voice for Pre-Teens — Bloomingdale','bloomingdale','https://www.bsmny.org/class/children/voice-for-pre-teens/',
  'Group singing for ages 10–13, developing vocal foundations and ensemble skills. The current catalog leaves the instructor unspecified.',
  {price:833,priceBasis:'full_course',minutes:60,schedule:'17-week semester. Ask the school about placement and enrollment.'});
course('bloomingdale-voice-children','Voice for Children — Bloomingdale','bloomingdale','https://www.bsmny.org/class/children/voice-for-children-2/',
  'Group singing for ages 5–9, with warmups, music reading and performances. Instructor and schedule depend on the selected section.',
  {price:833,priceBasis:'full_course',minutes:60,schedule:'17-week semester. Check the official page for sections.',instructors:['Christine Browning','Ian Harris']});
course('bloomingdale-intro-singing-adults','Introduction to Singing: Adults — Bloomingdale','bloomingdale','https://www.bsmny.org/class/adults/introduction-to-singing/',
  'Adult beginner singing with Christine Browning, including vocal foundations, individual feedback and group singing. Published tuition covers a semester.',
  {price:918,priceBasis:'full_course',minutes:60,schedule:'17-week semester. Confirm current or next-session availability.',instructors:['Christine Browning']});

export const expansion={reviewedAt:'2026-11-10',previousTotal:21,expectedTotal:100,providers,locations,teachers,classes};

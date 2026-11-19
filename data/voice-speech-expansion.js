const nyscSource = 'https://newyorkspeechcoaching.com/about';
export default {
  reviewedAt: '2026-11-13',
  schools: [
    { id:'speech-school-nysc', slug:'new-york-speech-coaching', name:'New York Speech Coaching', source:nyscSource, description:'Speech coaching for communication, speaking confidence and vocal expression, with studio and online sessions.', location:'Midtown Manhattan', borough:'Manhattan' },
    { id:'speech-school-maggie', slug:'maggie-flanigan-studio-voice-speech', name:'Maggie Flanigan Studio', source:'https://www.maggieflaniganstudio.com/voice-1', description:'NYC acting conservatory with a four-level spoken-voice curriculum.', location:'Chelsea, Manhattan', borough:'Manhattan', address:'147 W 25th St, 5th Floor, New York, NY 10001' },
  ],
  coaches: [
    ['bronte-england-nelson','Brontë England-Nelson'],
    ['stephanie-machado','Stephanie Machado'],
    ['alex-pelletier','Alex Pelletier'],
    ['tyler-cruz','Tyler Cruz'],
    ['miles-jacoby','Miles Jacoby'],
    ['tricia-veldman','Tricia Veldman'],
    ['courtney-ricketts','Courtney Ricketts'],
    ['wolfe-lanier','Wolfe Lanier'],
    ['lorene-chesley','Lorene Chesley'],
    ['joti-patel','Joti Patel'],
  ].map(([key,name]) => ({id:`speech-coach-${key}`,slug:`${key}-speech-coach`,name,provider:'speech-school-nysc',source:nyscSource,description:'Speech coach on the New York Speech Coaching instructor team. Book through the organization; confirm service and availability.',online:true})),
  courses: [
    {id:'speech-hb-speech-1',name:'Speech 1 - HB Studio',provider:'voice-school-hb',source:'https://hbstudio.coursestorm.com/course/speech-17',description:'Craig Dolezel introduces speech anatomy, consonants and oral posture through Knight-Thompson Speechwork. Open to all. Published winter 2027 section; confirm current enrollment.',price:555,minutes:90,sessions:10,format:'in_person'},
    {id:'speech-hb-speaking-1',name:'Speaking Voice 1 - HB Studio',provider:'voice-school-hb',source:'https://hbstudio.coursestorm.com/course/speaking-voice-111',description:'Ilse Pfeifer teaches physical awareness, breath and vocal freedom through Fitzmaurice Voicework. Open to all. Published winter 2027 section; confirm enrollment.',price:555,minutes:120,sessions:10,format:'in_person'},
    {id:'speech-hb-speaking-2',name:'Speaking Voice 2 - HB Studio',provider:'voice-school-hb',source:'https://hbstudio.coursestorm.com/course/speaking-voice-23',description:'Continuing Fitzmaurice voice practice with Ilse Pfeifer, integrating text and movement. Speaking Voice Level 2 placement required. Published winter 2027 section; confirm enrollment.',price:555,minutes:120,sessions:10,format:'in_person'},
    ...[1,2,3,4].map(level => ({id:`speech-maggie-voice-${level}`,name:`Voice ${level} - Maggie Flanigan Studio`,provider:'speech-school-maggie',source:`https://www.maggieflaniganstudio.com/voice-${level}`,description:[
      'Foundational Linklater voice work developing breath, resonance and a personal vocal warm-up. Twelve-week, 24-class course; confirm admissions, tuition and current sections.',
      'Continuing Linklater work on range, support and expressive speech. Voice I completion required. Twelve-week, 24-class course; confirm admissions, tuition and delivery.',
      'Advanced spoken-voice training integrating Fitzmaurice work with character and text. Voice I and II required. Twelve-week, 24-class course; confirm admissions and tuition.',
      'Advanced voice and classical text, including Shakespeare. Voice I, II and III required. Twelve-week, 24-class course; confirm admissions, tuition and delivery.',
    ][level-1],sessions:24})),
  ],
};

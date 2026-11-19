const urls = [
  'https://www.hbstudio.org/classes/musical-theater-performance/',
  'https://www.barrowgroup.org/acting-school/classes/specialty-classes/voice-actor/',
  'https://classes.stellaadler.com/workshops/sound-into-action-voice-monologue/',
  'https://atlanticactingschool.org/courses/voice/',
];
await Promise.all(urls.map(async url => {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(25000) });
    const html = await response.text();
    console.log(JSON.stringify({ url, status: response.status, images: [...html.matchAll(/<img\b[^>]*>/gi)].map(x => x[0]).filter(x => /logo|brand/i.test(x)).slice(0, 12), logoUrls: [...new Set([...html.matchAll(/https?:[^\s"'<>]+(?:logo|Logo)[^\s"'<>]*/g)].map(x => x[0]))].slice(0,15) }));
  } catch (error) { console.log(url, error.message); }
}));

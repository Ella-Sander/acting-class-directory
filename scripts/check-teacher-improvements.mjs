import { writeFileSync } from 'node:fs';
const origin = process.env.SITE_ORIGIN || 'http://127.0.0.1:5174';
const target = await (await fetch('http://127.0.0.1:9223/json/new?about:blank', { method: 'PUT' })).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let id = 0; const pending = new Map(); const exceptions = [];
socket.onmessage = event => {
  const message = JSON.parse(event.data);
  if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
  const request = pending.get(message.id);
  if (request) { pending.delete(message.id); message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result); }
};
const call = (method, params = {}) => new Promise((resolve, reject) => { const key = ++id; pending.set(key, { resolve, reject }); socket.send(JSON.stringify({ id: key, method, params })); });
const evaluate = async expression => { const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text); return result.result.value; };
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const wait = async expression => { for (let i = 0; i < 80; i++) { try { if (await evaluate(`Boolean(${expression})`)) return; } catch {} await pause(250); } throw new Error(`Timeout: ${expression}`); };
const go = async path => { await call('Page.navigate', { url: new URL(path, origin).href }); await wait("document.readyState !== 'loading' && document.querySelector('h1')"); };
const assert = (value, message) => { if (!value) throw new Error(message); };
const report = { origin, exceptions };
try {
 await call('Page.enable'); await call('Runtime.enable'); await call('Network.enable'); await call('Network.setCacheDisabled',{cacheDisabled:true}); await call('Network.clearBrowserCache');
 report.layouts=[];
 for(const width of [1440,1200,768,390,320]) {
  await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<720});
  await go('/'); await wait("document.querySelectorAll('.listing-card').length===20");
  const layout=await evaluate("(()=>{const h=document.querySelector('.site-header').getBoundingClientRect(),t=document.querySelector('.site-header .brand-wordmark').getBoundingClientRect(),m=document.querySelector('.menu-toggle').getBoundingClientRect(); return {width:innerWidth,centerDifference:Math.abs(t.left+t.width/2-(h.left+h.width/2)),overflow:document.documentElement.scrollWidth>innerWidth,titleMenuOverlap:m.width>0&&m.left<t.right,mobileLessonVisible:getComputedStyle(document.querySelector('.mobile-lesson-format')).display!=='none'};})()");
  assert(layout.centerDifference<1,'Masthead not centered '+JSON.stringify(layout));assert(!layout.overflow&&!layout.titleMenuOverlap,'Layout overlaps '+JSON.stringify(layout));if(width<720)assert(layout.mobileLessonVisible,'Mobile lesson filter hidden'); report.layouts.push(layout);
 }
 await go('/?lesson=group'); await wait("document.querySelectorAll('.listing-card').length>0");
 report.groupCount=await evaluate("document.querySelectorAll('.listing-card').length");
 await go('/?lesson=private');await wait("document.querySelector('.empty-state')"); report.unverifiedPrivateExcluded=true;
 await evaluate("document.querySelector('.empty-state button').click()");await wait("document.querySelectorAll('.listing-card').length===20 && !location.search.includes('lesson=')");report.lessonReset=true;
 await evaluate("document.querySelector('.listing-card').click()");await wait("document.querySelector('.listing-dialog[open]')");
 assert(await evaluate("document.querySelector('.listing-dialog').innerText.includes('Availability unconfirmed')"),'Missing availability');
 assert(!await evaluate("[...document.querySelectorAll('.detail-actions a')].some(a=>/booking|book a lesson/i.test(a.textContent))"),'Unverified booking displayed');
 await evaluate("[...document.querySelectorAll('.listing-dialog button')].find(b=>b.textContent==='Claim or Remove Listing').click()");await wait("document.querySelector('.submission-dialog[open]')");
 await evaluate("(()=>{const s=document.querySelector('.submission-form select');s.value='removal';s.dispatchEvent(new Event('change',{bubbles:true}));})()");await wait("document.querySelector('.submission-form textarea[name=description]')");
 report.removalForm=true;report.noRegistrationRequired=await evaluate("!document.querySelector('.submission-form input[type=password]')");
 assert(exceptions.length===0,exceptions.join('; '));console.log(JSON.stringify(report));
} finally { writeFileSync('docs/teacher-improvements-browser-check.json',JSON.stringify(report,null,2)+'\n');socket.close();await fetch('http://127.0.0.1:9223/json/close/'+target.id).catch(()=>{}); }

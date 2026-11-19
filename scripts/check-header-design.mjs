import { writeFileSync } from 'node:fs';
const target = await (await fetch('http://127.0.0.1:9223/json/new?about:blank', { method: 'PUT' })).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let id = 0; const pending = new Map(); const exceptions = [];
socket.onmessage = event => {
  const data = JSON.parse(event.data);
  if (data.method === 'Runtime.exceptionThrown') exceptions.push(data.params.exceptionDetails.text);
  const promise = pending.get(data.id);
  if (promise) { pending.delete(data.id); data.error ? promise.reject(Error(data.error.message)) : promise.resolve(data.result); }
};
const call = (method, params = {}) => new Promise((resolve, reject) => { const key = ++id; pending.set(key, { resolve, reject }); socket.send(JSON.stringify({ id: key, method, params })); });
const evaluate = async expression => { const value = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (value.exceptionDetails) throw Error(value.exceptionDetails.text); return value.result.value; };
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const report = { checkedAt: new Date().toISOString(), widths: [], exceptions };
try {
  await call('Page.enable'); await call('Runtime.enable');
  await call('Page.navigate', { url: 'https://vocalcatalog.com/' });
  for (let i = 0; i < 80; i++) { if (await evaluate("!!document.querySelector('.header-brand-lockup') && !!document.querySelector('.listing-card')")) break; await pause(250); }
  for (const width of [1440, 768, 390, 320]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 720 });
    await pause(300);
    const state = await evaluate(`(() => {
      const brand=document.querySelector('.header-brand-lockup');
      if(!brand)throw Error('Brand not loaded');
      const word=brand.querySelector('.brand-wordmark').getBoundingClientRect();
      const city=brand.querySelector('.header-city-mark').getBoundingClientRect();
      return {noOverflow:document.documentElement.scrollWidth<=innerWidth,adjacent:city.left>=word.right,city:brand.querySelector('strong').textContent,menu:getComputedStyle(document.querySelector('.menu-toggle')).display!=='none'};
    })()`);
    if (!state.noOverflow || !state.adjacent || state.city !== 'NYC+') throw Error(`Layout failed at ${width}: ${JSON.stringify(state)}`);
    if (state.menu) {
      await evaluate("document.querySelector('.menu-toggle').click()");
      if (!await evaluate("document.querySelector('.menu-toggle').getAttribute('aria-expanded')==='true' && getComputedStyle(document.querySelector('.main-nav')).display!=='none'")) throw Error('Menu did not open');
      await evaluate("document.querySelector('.menu-toggle').click()");
    }
    report.widths.push({ width, ...state });
    const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    writeFileSync(`artifacts/header-normalized-${width}.png`,Buffer.from(shot.data,'base64'));
  }
  const initiallySaved = await evaluate("document.querySelector('.card-save-button').getAttribute('aria-pressed')==='true'");
  await evaluate("document.querySelector('.card-save-button').click()");
  await pause(200);
  if(await evaluate("document.querySelector('.card-save-button').getAttribute('aria-pressed')==='true'") === initiallySaved)throw Error('Save toggle failed');
  if(initiallySaved) { await evaluate("document.querySelector('.card-save-button').click()"); await pause(200); }
  await evaluate("document.querySelector('.directory-collection-tabs button:nth-child(2)').click()");
  await pause(200);
  if(!await evaluate("document.querySelectorAll('.listing-card').length>0 && location.search.includes('saved=1')"))throw Error('Saved view failed');
  report.savedView=true;
  // Restore the one listing toggled by this browser check.
  if(!initiallySaved) await evaluate("document.querySelector('.card-save-button').click()");
  if(exceptions.length)throw Error(exceptions.join('; '));
} catch(error) { report.error=error.message; process.exitCode=1; }
finally { writeFileSync('docs/header-design-check.json',JSON.stringify(report,null,2)+'\n');textOutput();socket.close();await fetch(`http://127.0.0.1:9223/json/close/${target.id}`).catch(()=>{}); }
function textOutput(){console.log(JSON.stringify(report));}

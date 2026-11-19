import { writeFile } from 'node:fs/promises';
const origin = process.env.SITE_ORIGIN || 'https://vocalcatalog.com';
const label = process.env.QA_LABEL || 'production';
const target = await (await fetch('http://127.0.0.1:9223/json/new?about:blank', { method: 'PUT' })).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let id = 0; const pending = new Map(); const exceptions = []; const resourceErrors = [];
socket.onmessage = event => {
  const message = JSON.parse(event.data);
  if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
  if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') resourceErrors.push(message.params.entry.text);
  const request = pending.get(message.id);
  if (request) { pending.delete(message.id); message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result); }
};
const call = (method, params = {}) => new Promise((resolve, reject) => { const key = ++id; pending.set(key, { resolve, reject }); socket.send(JSON.stringify({ id: key, method, params })); });
const evaluate = async expression => {
  const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
};
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const waitFor = async expression => { for (let i = 0; i < 80; i++) { try { if (await evaluate(`Boolean(${expression})`)) return; } catch (error) { if (!/context|navigat/i.test(error.message)) throw error; } await pause(250); } throw new Error(`Timed out waiting for ${expression}`); };
const navigate = async path => { await call('Page.navigate', { url: new URL(path, origin).href }); await waitFor("document.readyState==='complete' && document.querySelector('h1')"); };
const assert = (condition, description) => { if (!condition) throw new Error(description); };
const report = { origin, viewports: [], interactions: {}, exceptions, resourceErrors };
try {
  await call('Page.enable'); await call('Runtime.enable'); await call('Log.enable');
  await call('Network.enable'); await call('Network.setCacheDisabled', { cacheDisabled: true }); await call('Network.clearBrowserCache');
  for (const [name, width, height, mobile] of [['desktop', 1440, 900, false], ['laptop', 1366, 768, false], ['mobile', 390, 844, true], ['small-mobile', 320, 740, true]]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
    await navigate('/');
    await waitFor("document.querySelectorAll('.listing-card').length === 20 && document.querySelectorAll('.listing-location-pin').length > 0");
    await pause(1200);
    const result = await evaluate(`({name:${JSON.stringify(name)},h1:document.querySelector('h1').innerText.replace(/\\s+/g,' ').trim(),title:document.title,brand:document.querySelector('.brand').innerText,canonical:document.querySelector('link[rel=canonical]').href,overflow:document.documentElement.scrollWidth>innerWidth,brokenImages:[...document.images].filter(image=>image.complete&&!image.naturalWidth).map(image=>image.getAttribute('src')),pins:document.querySelectorAll('.listing-location-pin').length,boroughButtons:document.querySelectorAll('.map-boroughs button').length,statsBottom:document.querySelector('.hero-summary').getBoundingClientRect().bottom,headerOverflow:document.querySelector('.header-inner').scrollWidth>document.querySelector('.header-inner').clientWidth})`);
    if (result.overflow || result.headerOverflow) console.log(JSON.stringify({ ...result, elements: await evaluate("[...document.querySelectorAll('body *')].filter(node=>node.getBoundingClientRect().right>innerWidth+1 && getComputedStyle(node).position!=='absolute').slice(0,12).map(node=>({tag:node.tagName,class:node.className,text:node.textContent.slice(0,60),right:node.getBoundingClientRect().right}))") }));
    assert(result.h1 === 'Find Your Voice Coach in NYC', `Unexpected homepage heading: ${result.h1}`);
    assert(!result.overflow && !result.headerOverflow, `Horizontal overflow at ${name}`);
    assert(result.brokenImages.length === 0, `Broken images at ${name}`);
    assert(result.boroughButtons === 0, 'Borough shortcuts returned');
    if (width >= 1000) assert(result.statsBottom < height, 'Hero counts outside opening desktop viewport');
    report.viewports.push(result);
    const screenshot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await writeFile(`artifacts/launch-${label}-${name}.png`, Buffer.from(screenshot.data, 'base64'));
    console.log(JSON.stringify(result));
  }
  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await navigate('/'); await waitFor("document.querySelectorAll('.listing-card').length === 20");
  await evaluate("document.querySelector('.score-pagination a:last-child').click()");
  await waitFor("location.search.includes('page=2') && document.querySelector('.score-page-count').textContent.includes('21')");
  report.interactions.pagination = await evaluate("({url:location.href,title:document.title,canonical:document.querySelector('link[rel=canonical]').href})");
  const profilePath = await evaluate("document.querySelector('.card-profile-link').getAttribute('href')");
  await evaluate("document.querySelector('.listing-card').click()");
  await waitFor("document.querySelector('.listing-dialog[open]') || document.querySelector('dialog[open]')");
  report.interactions.profileModal = await evaluate("({url:location.href,canonical:document.querySelector('link[rel=canonical]').href})");
  await evaluate('history.back()'); await waitFor("!document.querySelector('dialog[open]') && location.search.includes('page=2')");
  assert((await evaluate("document.querySelector('.score-page-count').textContent")).includes('21'), 'Modal back lost directory page');
  await navigate(profilePath); await waitFor("document.querySelector('.seo-document h1')");
  report.interactions.directProfile = await evaluate("({h1:document.querySelector('h1').textContent,canonical:document.querySelector('link[rel=canonical]').href})");
  await navigate('/?q=Julie&category=dialects'); await waitFor("document.querySelectorAll('.listing-card').length === 1");
  report.interactions.search = await evaluate("({name:document.querySelector('.listing-card').textContent,robots:document.querySelector('meta[name=robots]').content})");
  assert(/Julie/.test(report.interactions.search.name), 'Search returned the wrong listing');
  await evaluate("document.querySelector('.directory-categories button:nth-child(2)').click()");
  await waitFor("location.search.includes('category=singing') && document.querySelector('.directory-categories button:nth-child(2)').getAttribute('aria-pressed')==='true'");
  report.interactions.categoryFilter = true;
  await navigate('/?q=nonexistent-launch-smoke-query');
  await waitFor("document.querySelector('.empty-state')");
  report.interactions.emptyState = true;
  await evaluate("document.querySelector('.empty-state button').click()");
  await waitFor("document.querySelectorAll('.listing-card').length === 20 && location.search === ''");
  report.interactions.reset = true;
  assert(exceptions.length === 0, `Unhandled exceptions: ${exceptions.join('; ')}`);
  console.log(JSON.stringify(report.interactions));
} catch (error) {
  report.error = error.message; console.error(error.message); throw error;
} finally {
  report.lastPage = await evaluate("({url:location.href,title:document.title,cards:document.querySelectorAll('.listing-card').length,pins:document.querySelectorAll('.listing-location-pin').length,text:document.body.innerText.slice(0,800)})").catch(() => null);
  if (!report.viewports.length) console.log(JSON.stringify({ page: report.lastPage, resourceErrors, exceptions }));
  await writeFile(`docs/launch-browser-${label}.json`, JSON.stringify(report, null, 2) + '\n');
  socket.close();
  await fetch(`http://127.0.0.1:9223/json/close/${target.id}`).catch(() => {});
}

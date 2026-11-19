import { writeFileSync } from 'node:fs';
const target = await (await fetch('http://127.0.0.1:9223/json/new?about:blank', { method: 'PUT' })).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
let id = 0; let apiRequests = 0; const pending = new Map(); const apiResponses = [];
socket.onmessage = event => {
  const message = JSON.parse(event.data);
  if (message.method === 'Network.requestWillBeSent' && new URL(message.params.request.url).pathname === '/api/directory') apiRequests++;
  if (message.method === 'Network.responseReceived' && new URL(message.params.response.url).pathname === '/api/directory') apiResponses.push({ status: message.params.response.status, cache: message.params.response.headers['x-public-cache'] || message.params.response.headers['X-Public-Cache'] });
  const entry = pending.get(message.id);
  if (entry) { pending.delete(message.id); message.error ? entry.reject(new Error(message.error.message)) : entry.resolve(message.result); }
};
const call = (method, params = {}) => new Promise((resolve, reject) => { const key = ++id; pending.set(key, { resolve, reject }); socket.send(JSON.stringify({ id: key, method, params })); });
const evaluate = async expression => { const result = await call('Runtime.evaluate', { expression, returnByValue: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text); return result.result.value; };
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const wait = async expression => { for (let i = 0; i < 80; i++) { try { if (await evaluate(`Boolean(${expression})`)) return; } catch {} await pause(250); } throw new Error(`Timeout: ${expression}`); };
const ready = async () => { await wait("document.querySelectorAll('.listing-card').length === 20"); await pause(800); };
const assert = (value, message) => { if (!value) throw new Error(message); };
const report = { apiResponses };
try {
  await call('Page.enable'); await call('Runtime.enable'); await call('Network.enable'); await call('Network.setCacheDisabled', { cacheDisabled: true });
  const clear = await call('Page.addScriptToEvaluateOnNewDocument', { source: "if (window === window.top) localStorage.removeItem('vocal-catalog:public-directory:v4');" });
  await call('Page.navigate', { url: 'https://vocalcatalog.com/' }); await ready();
  report.firstVisitRequests = apiRequests; assert(apiRequests === 1, 'First visit should fetch once');
  report.firstCache = await evaluate("({stored:!!localStorage.getItem('vocal-catalog:public-directory:v4'),version:JSON.parse(localStorage.getItem('vocal-catalog:public-directory:v4')||'null')?.version,pageVersion:JSON.parse(document.getElementById('seo-page-data').textContent).directoryCacheVersion})");
  await call('Page.removeScriptToEvaluateOnNewDocument', { identifier: clear.identifier });
  apiRequests = 0; await call('Page.reload', { ignoreCache: true }); await pause(500); await ready();
  report.repeatVisitRequests = apiRequests;
  if (apiRequests) console.log(JSON.stringify(report));
  assert(apiRequests === 0, 'Fresh repeat visit should reuse localStorage without an API request');
  report.cacheRevisionMatches = await evaluate("JSON.parse(localStorage.getItem('vocal-catalog:public-directory:v4')).version === JSON.parse(document.getElementById('seo-page-data').textContent).directoryCacheVersion");
  assert(report.cacheRevisionMatches, 'Browser cache must match the rendered publication revision');
  await evaluate("{ const key='vocal-catalog:public-directory:v4'; const entry=JSON.parse(localStorage.getItem(key)); entry.savedAt=Date.now()-300001; localStorage.setItem(key,JSON.stringify(entry)); }");
  apiRequests = 0; await call('Page.reload', { ignoreCache: true }); await pause(500); await ready();
  report.expiredVisitRequests = apiRequests; assert(apiRequests === 1, 'Expired browser cache should refresh once');
  await call('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await evaluate("window.dispatchEvent(new Event('online'))");
  await wait("document.querySelector('#directory > p.form-note[role=status]')?.textContent.includes('temporarily unavailable')");
  report.failedRefreshKeepsListings = await evaluate("document.querySelectorAll('.listing-card').length===20"); assert(report.failedRefreshKeepsListings, 'Network failure discarded saved listings');
  await call('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await evaluate("window.dispatchEvent(new Event('online'))"); await wait("!document.querySelector('#directory > p.form-note[role=status]')"); report.recovered = true;
  apiRequests = 0; await call('Page.navigate', { url: 'https://vocalcatalog.com/admin/review/' });
  await wait("document.querySelector('h1')?.textContent==='Review queue'"); await pause(800);
  report.adminDirectoryRequests = apiRequests; assert(apiRequests === 0, 'Admin page must not read/fetch the browser public directory cache');
  console.log(JSON.stringify(report));
} finally {
  report.lastState = await evaluate("({status:document.querySelector('#directory > p.form-note[role=status]')?.textContent,cards:document.querySelectorAll('.listing-card').length,online:navigator.onLine})").catch(() => null);
  await call('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }).catch(() => {});
  writeFileSync('docs/browser-directory-cache-check.json', JSON.stringify(report, null, 2) + '\n'); socket.close();
  await fetch(`http://127.0.0.1:9223/json/close/${target.id}`).catch(() => {});
}

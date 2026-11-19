import { readFileSync, writeFileSync } from 'node:fs';
const raw=readFileSync('.dev.vars','utf8').match(/^ADMIN_REVIEW_KEY\s*=\s*(.+)$/m)?.[1].trim();
const reviewKey=raw?.replace(/^['"]|['"]$/g,'');if(!reviewKey)throw Error('Review credential unavailable');
const tab=await(await fetch('http://127.0.0.1:9223/json/new?about:blank',{method:'PUT'})).json();
const socket=new WebSocket(tab.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
let sequence=0;const pending=new Map();const exceptions=[];
socket.onmessage=event=>{const data=JSON.parse(event.data);if(data.method==='Runtime.exceptionThrown')exceptions.push(data.params.exceptionDetails.text);const waiter=pending.get(data.id);if(waiter){pending.delete(data.id);data.error?waiter.reject(Error(data.error.message)):waiter.resolve(data.result);}};
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const value=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(value.exceptionDetails)throw Error('Browser evaluation failed');return value.result.value;};
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function wait(expression){for(let i=0;i<100;i++){if(await evaluate(`Boolean(${expression})`))return;await pause(200);}throw Error('Browser state did not become ready');}
const report={checkedAt:new Date().toISOString(),readOnly:true,exceptions};
try{
  await call('Page.enable');await call('Runtime.enable');await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await call('Page.navigate',{url:'https://vocalcatalog.com/admin/review/'});
  await wait("document.querySelector('.admin-key-form input')");
  await evaluate(`(()=>{const input=document.querySelector('.admin-key-form input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(reviewKey)});input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await evaluate("document.querySelector('.admin-key-form button').click()");
  await wait("[...document.querySelectorAll('.admin-submission')].some(article=>article.querySelector('h2').textContent.includes('Jeff Cubeta'))");
  await evaluate("[...document.querySelectorAll('.admin-submission')].find(article=>article.querySelector('h2').textContent.includes('Jeff Cubeta')).querySelector('.provider-merge-review button').click()");
  await wait("document.querySelector('.merge-target')");
  report.review=await evaluate(`(()=>{const section=document.querySelector('.provider-merge-review:has(.merge-target)');const fields=section.querySelectorAll('.has-conflict');const field=fields[0];const columns=field.querySelectorAll('.merge-comparison>div');return{conflicts:fields.length,sideBySide:columns[0].getBoundingClientRect().left<columns[1].getBoundingClientRect().left,approveDisabled:section.querySelector('.button-violet').disabled,domain:section.querySelector('.merge-target>span').textContent};})()`);
  if(report.review.conflicts!==3||!report.review.sideBySide||!report.review.approveDisabled)throw Error('Conflict review layout or verification guard failed');
  await evaluate("document.querySelector('.provider-merge-review:has(.merge-target)').scrollIntoView({block:'start',behavior:'instant'})");
  const crop=await evaluate("(()=>{const r=document.querySelector('.provider-merge-review:has(.merge-target)').getBoundingClientRect();return{x:Math.max(0,r.x),y:scrollY+r.y,width:r.width,height:Math.min(r.height,900),scale:1};})()");
  let screenshot=await call('Page.captureScreenshot',{format:'png',clip:crop,captureBeyondViewport:true});writeFileSync('artifacts/provider-merge-review-desktop.png',Buffer.from(screenshot.data,'base64'));
  await evaluate("(()=>{const section=document.querySelector('.provider-merge-review:has(.merge-target)');const select=[...section.querySelectorAll('.merge-field')].find(field=>field.querySelector('legend').textContent.includes('description')).querySelector('select');select.value='edit';select.dispatchEvent(new Event('change',{bubbles:true}));})()");
  await wait("document.querySelector('.provider-merge-review:has(.merge-target) textarea')");report.editable=true;
  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await pause(300);
  report.mobileNoOverflow=await evaluate('document.documentElement.scrollWidth<=innerWidth');if(!report.mobileNoOverflow)throw Error('Mobile admin overflow');
  if(exceptions.length)throw Error(exceptions.join('; '));
}catch(error){report.error=error.message;process.exitCode=1;}
finally{writeFileSync('docs/provider-merge-browser-check.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));socket.close();await fetch(`http://127.0.0.1:9223/json/close/${tab.id}`).catch(()=>{});}

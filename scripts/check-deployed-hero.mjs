import fs from 'node:fs/promises';
const target=await(await fetch('http://127.0.0.1:9223/json/new?about:blank',{method:'PUT'})).json();
const socket=new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
let id=0;const pending=new Map();
socket.onmessage=event=>{const message=JSON.parse(event.data);const request=pending.get(message.id);if(request){pending.delete(message.id);message.error?request.reject(message.error):request.resolve(message.result);}};
const call=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});socket.send(JSON.stringify({id:key,method,params}));});
await call('Page.enable');
for(const [name,width,height,mobile] of [['desktop',1440,900,false],['laptop',1366,768,false],['mobile',390,844,true]]) {
  await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});
  await call('Page.navigate',{url:'https://vocalcatalog.com/'});
  await new Promise(resolve=>setTimeout(resolve,4500));
  const result=await call('Runtime.evaluate',{expression:`JSON.stringify({counts:[...document.querySelectorAll('.hero-directory-numbers strong>span[aria-hidden]')].map(x=>x.textContent),statsBottom:document.querySelector('.hero-summary')?.getBoundingClientRect().bottom,viewport:innerHeight,width:innerWidth,pins:document.querySelectorAll('.listing-location-pin').length,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth})`,returnByValue:true});
  console.log(name,result.result.value);
  const screenshot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  await fs.writeFile(`artifacts/deployed-hero-${name}.png`,Buffer.from(screenshot.data,'base64'));
}
await call('Browser.close');
socket.close();

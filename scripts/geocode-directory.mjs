import fs from 'node:fs/promises';
const input=JSON.parse(await fs.readFile('data/map-location-input.json','utf8'));
const addresses=[...new Set(input.map(x=>x.address).filter(Boolean))];
const output={provider:'US Census Geocoder',benchmark:'Public_AR_Current',reviewedAt:'2026-11-13',addresses:{}};
for(let index=0;index<addresses.length;index+=3) await Promise.all(addresses.slice(index,index+3).map(async address=>{
  const query=address.replace(/,?\s*(?:suite\s+\w+|\d+(?:st|nd|rd|th)\s+floor|floor\s+\d+|#\w+)\s*,?/gi,',').replace(/,\s*,/g,',');
  const url=new URL('https://geocoding.geo.census.gov/geocoder/locations/onelineaddress');
  url.search=new URLSearchParams({address:query,benchmark:output.benchmark,format:'json'}).toString();
  try {
    const r=await fetch(url,{signal:AbortSignal.timeout(25000)});if(!r.ok)throw new Error(`HTTP ${r.status}`);
    const matches=(await r.json()).result?.addressMatches||[];
    const match=matches.find(x=>x.coordinates.y>40.45&&x.coordinates.y<41&&x.coordinates.x>-74.3&&x.coordinates.x<-73.65);
    output.addresses[address]=match?{coordinates:[match.coordinates.y,match.coordinates.x],matchedAddress:match.matchedAddress,sourceUrl:url.href,precision:'street-address'}:{unmatched:true};
    console.log(`${address}: ${match?'matched':'not matched'}`);
  } catch(error){output.addresses[address]={error:error.message};console.log(`${address}: ${error.message}`);}
}));
await fs.writeFile('data/map-geocodes.json',JSON.stringify(output,null,2)+'\n');

import geocodes from '../data/map-geocodes.json' with {type:'json'};

// Approximate area centers; these never represent a private studio address.
const areas = {
  'Manhattan:Upper West Side':[40.787,-73.976],
  'Manhattan:Upper East Side':[40.775,-73.951],
  'Manhattan:Midtown':[40.754,-73.984],
  'Manhattan:Midtown West':[40.759,-73.991],
  'Manhattan:Greenwich Village':[40.733,-73.998],
  'Manhattan:West Village':[40.735,-74.004],
  'Brooklyn:Park Slope':[40.672,-73.978],
  'Brooklyn:East Williamsburg':[40.708,-73.936],
};
const boroughs = {Manhattan:[40.7831,-73.9712],Bronx:[40.8448,-73.8648],Queens:[40.7282,-73.7949],Brooklyn:[40.6782,-73.9442],'Staten Island':[40.5795,-74.1502]};

export function buildLocationPins(listings) {
  const groups=new Map();
  for(const item of listings) for(const location of item.locations||[]) {
    if(!location.verified || location.is_online || location.city!=='New York') continue;
    const address=location.postal_address;
    const exact=address && geocodes.addresses[address]?.coordinates;
    const areaKey=`${location.borough}:${location.neighborhood}`;
    const area=areas[areaKey];
    const precision=exact?'address':area?'neighborhood':boroughs[location.borough]?'borough':'city';
    const coordinates=exact||area||boroughs[location.borough]||[40.735,-73.975];
    const key=`${precision}:${coordinates.map(x=>x.toFixed(6)).join(',')}`;
    if(!groups.has(key)) groups.set(key,{key,coordinates,precision,label:exact?address:area?`${location.neighborhood}, ${location.borough}`:location.borough||'New York City',items:new Map()});
    groups.get(key).items.set(`${item.kind}:${item.id}`,item);
  }
  return [...groups.values()].map(group=>({...group,items:[...group.items.values()].sort((a,b)=>a.name.localeCompare(b.name))}));
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readdirSync,readFileSync } from 'node:fs';
import { buildLocationPins } from '../src/map-locations.js';
import geocodes from '../data/map-geocodes.json' with {type:'json'};

test('all geocoded addresses have NYC coordinates and source provenance',()=>{
  assert.equal(Object.keys(geocodes.addresses).length,19);
  for(const point of Object.values(geocodes.addresses)) {
    assert.equal(point.precision,'street-address');
    assert.ok(point.coordinates[0]>40.45&&point.coordinates[0]<41);
    assert.ok(point.coordinates[1]>-74.3&&point.coordinates[1]<-73.65);
    assert.match(point.sourceUrl,/^https:\/\/geocoding\.geo\.census\.gov\//);
    assert.ok(point.matchedAddress);
  }
});

test('map covers every verified physical listing location without inventing street addresses',()=>{
  const db=new DatabaseSync(':memory:');
  try {
    for(const file of readdirSync(new URL('../migrations/',import.meta.url)).filter(x=>x.endsWith('.sql')).sort())db.exec(readFileSync(new URL(`../migrations/${file}`,import.meta.url),'utf8'));
    const listings=[];
    for(const [table,relationship,key,status,kind] of [['instructors','instructor_locations','instructor_id','profile_status','teacher'],['offerings','offering_locations','offering_id','listing_status','offering']]) {
      for(const row of db.prepare(`SELECT * FROM ${table} WHERE ${status}='published'`).all()) {
        const locations=db.prepare(`SELECT l.*,EXISTS(SELECT 1 FROM field_evidence e WHERE e.entity_type='location' AND e.entity_id=l.id AND e.verification_status='verified') AS verified FROM locations l JOIN ${relationship} r ON r.location_id=l.id WHERE r.${key}=?`).all(row.id);
        listings.push({...row,kind,locations});
      }
    }
    const pins=buildLocationPins(listings);
    assert.ok(pins.filter(pin=>pin.precision==='address').length>10);
    for(const listing of listings) {
      const mapped=pins.some(pin=>pin.items.some(item=>item.id===listing.id));
      assert.equal(mapped,listing.locations.some(location=>location.verified&&!location.is_online&&location.city==='New York'),listing.name);
    }
    assert.ok(pins.some(pin=>pin.precision==='neighborhood'));
    assert.ok(pins.some(pin=>pin.precision==='city'));
    for(const pin of pins)assert.equal(new Set(pin.items.map(x=>x.id)).size,pin.items.length);
    const fake={id:'unverified',kind:'teacher',name:'Unverified',locations:[{city:'New York',postal_address:Object.keys(geocodes.addresses)[0],verified:false}]};
    assert.deepEqual(buildLocationPins([fake]),[]);
    const online={...fake,locations:[{verified:true,city:'New York',is_online:true}]};
    assert.deepEqual(buildLocationPins([online]),[]);
    const unknown={...fake,locations:[{verified:true,city:'New York',postal_address:'Unknown address',borough:'Queens'}]};
    assert.equal(buildLocationPins([unknown])[0].precision,'borough');
  } finally {db.close();}
});

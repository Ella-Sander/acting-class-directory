import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { filterListings, mergeListings } from './directory-utils.js';
import { listingPath } from './seo.js';
import { buildLocationPins } from './map-locations.js';

const manhattanBounds = L.latLngBounds([[40.701,-74.025],[40.825,-73.935]]);

export default function NeighborhoodMap({ directory, filters, update, onOpen }) {
  const container = useRef(null);
  const mapRef = useRef(null);
  const markers = useRef([]);
  const onOpenRef = useRef(onOpen);
  const previousLocation = useRef('');
  const [tileError, setTileError] = useState(false);
  const listings = useMemo(() => mergeListings(directory), [directory]);
  const pins = useMemo(() => buildLocationPins(filterListings(listings, filters)), [listings, filters]);
  const selected = filters.location?.startsWith('neighborhood:') ? filters.location.split(':').at(-1) : filters.location;
  const counts = { [selected]: filterListings(listings, filters).length };
  useEffect(() => { onOpenRef.current = onOpen; }, [onOpen]);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const map = L.map(container.current, { scrollWheelZoom: false, minZoom: 8, maxZoom: 18, zoomAnimation: !reduced, fadeAnimation: !reduced, markerZoomAnimation: !reduced });
    mapRef.current = map;
    map.fitBounds(manhattanBounds, { padding: [15, 15], animate: false });
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    tiles.on('tileerror', () => setTileError(true));
    tiles.on('tileload', () => setTileError(false));
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    observer.observe(container.current);
    return () => { observer.disconnect(); markers.current = []; mapRef.current = null; map.remove(); };
  }, []);

  useEffect(() => {
    const map=mapRef.current;
    if(!map) return;
    for(const marker of markers.current) marker.remove();
    markers.current=pins.map(pin=>{
      const icon=L.divIcon({className:`geo-pin listing-location-pin ${pin.precision==='address'?'address-pin':'area-pin'}`,iconSize:[34,34],iconAnchor:[17,17],popupAnchor:[0,-18],html:`<span class="geo-pin-shape"><span class="geo-pin-count">${pin.items.length}</span></span>`});
      const marker=L.marker(pin.coordinates,{icon,title:`${pin.label}: ${pin.items.length} listings`,keyboard:true}).addTo(map);
      marker.bindTooltip(`${pin.label}${pin.precision==='address'?'':' (approximate area)'}`,{direction:'top',offset:[0,-18]});
      const content = document.createElement('div');
      content.className='location-pin-popup';
      const title = document.createElement('strong');
      title.textContent = pin.label;
      const detail = document.createElement('p');
      detail.textContent = pin.precision==='address'?'Geocoded published address · school affiliations may share this location.':`Approximate ${pin.precision} location · no street address supplied.`;
      content.append(title, detail);
      const links=document.createElement('div');
      links.className='location-pin-list';
      for(const item of pin.items) {
        const link=document.createElement('a');
        link.href=listingPath(item);
        link.textContent=item.name;
        link.addEventListener('click',event=>{if(onOpenRef.current&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey){event.preventDefault();onOpenRef.current(item);}});
        links.append(link);
      }
      content.append(links);
      marker.bindPopup(content);
      marker.getElement()?.setAttribute('aria-label',`${pin.label}, ${pin.precision==='address'?'published address':'approximate '+pin.precision}, ${pin.items.length} listings. Open location details.`);
      return marker;
    });
  }, [pins]);

  useEffect(() => {
    const map=mapRef.current;
    if(!map || previousLocation.current===filters.location || (filters.location && !pins.length)) return;
    previousLocation.current=filters.location;
    map.fitBounds(filters.location ? L.latLngBounds(pins.map(pin=>pin.coordinates)) : manhattanBounds,{padding:[20,20],maxZoom:14,animate:false});
  }, [filters.location,pins]);

  return <section className="neighborhood-map" aria-label="Explore voice training across New York City's five boroughs">
    <div className="map-heading"><div><span className="section-kicker">THE FIVE-BOROUGH GUIDE</span><h2>New York, in tune.</h2></div><button type="button" onClick={() => { update('location', ''); mapRef.current?.closePopup().fitBounds(manhattanBounds, { padding: [15, 15], animate: false }); }}>Reset map <span aria-hidden="true">↗</span></button></div>
    <div className="geo-map-frame"><div ref={container} className="geo-map" aria-label="Interactive NYC listing locations. Use arrow keys to pan, plus and minus to zoom, or select a location pin to browse listings." /></div>
    {tileError && <p className="map-error" role="status">Map tiles could not load. You can still explore locations using the directory filters.</p>}
    <div className="map-caption"><span aria-live="polite">{selected ? selected + ' · ' + (directory.status === 'ready' ? counts[selected] + ' matches' : 'Loading') : `${pins.length} mapped locations · select a pin to explore listings.`}</span><small>Open a pin for address or approximate-area details. Shared locations group listings; online-only listings are not pinned.</small></div>
  </section>;
}

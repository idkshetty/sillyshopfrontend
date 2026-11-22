import {MAP_CONFIG} from './map-config.js';
import {escapeHTML as e} from './commerce.js';
import {featureAddress,featureLabel,validCoordinates,validLocation} from './location-utils.js';
import {loadScript} from './browser-library.js';

export function mapPanel(location) {
  const hasPin = validLocation(location);
  const pillText = hasPin
    ? (location.formattedAddress || `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`)
    : 'Locate me or choose your delivery spot on the map';
  return `<section class="delivery-pin delivery-pin-card${hasPin ? ' is-confirmed' : ''}" aria-label="Delivery location">
    <div class="map-card-header">
      <div>
        <h2>Set Location</h2>
        <p id="map-status" class="map-status" role="status">${hasPin ? '✓ Delivery pin confirmed.' : 'Confirm your delivery pin on the map.'}</p>
      </div>
      <span class="map-summary-badge">${hasPin ? 'Pin confirmed ✓' : 'Required'}</span>
    </div>
    <div class="map-summary-pill">
      <span class="map-floating-pin-dot" aria-hidden="true"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/></svg></span>
      <span id="map-floating-address-text">${e(pillText)}</span>
    </div>
    <div class="map-actions map-primary-pills">
      <button type="button" class="button map-pill-primary" data-map="device">⌖ Locate Me</button>
      <button type="button" class="button outline map-pill-secondary" data-map="open">${hasPin ? 'Change location' : 'Choose on map'}</button>
    </div>
  </section>`;
}

export function mountDeliveryMap(root,{getAddress,onChange,onAddress,initial}) {
  let map,mapPromise=null,marker,accuracyCircle,satelliteLayer,streetLayer,activeLayer='satellite',pending=initial&&validCoordinates(initial.latitude,initial.longitude)?{...initial}:null,disposed=false,results=[],suggestion=null,version=0,controller,timer,invalidateTimer=0,lastRequest=0;
  const cache=new Map();
  document.querySelectorAll('.map-picker-dialog').forEach(node=>node.remove());
  const sheet=document.createElement('dialog');
  sheet.className='map-picker-dialog';
  sheet.setAttribute('aria-label','Set delivery location');
  sheet.innerHTML=`
    <div class="map-sheet-header">
      <div class="map-sheet-handle" aria-hidden="true"></div>
      <div class="map-sheet-toprow">
        <div>
          <h2>Set Delivery Location</h2>
          <p id="map-sheet-status" class="map-status" role="status">Tap anywhere on the map or drag the pin to your entrance.</p>
        </div>
        <div class="map-sheet-head-actions">
          <div class="map-layer-toggle" role="group" aria-label="Map view">
            <button type="button" class="map-layer-btn is-active" data-map="layer-satellite" aria-pressed="true">Satellite</button>
            <button type="button" class="map-layer-btn" data-map="layer-street" aria-pressed="false">Street</button>
          </div>
          <button type="button" class="icon-button map-sheet-close" data-map="close" aria-label="Close map"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
        </div>
      </div>
      <div class="map-sheet-searchbar">
        <input type="search" id="map-sheet-search" placeholder="Search street, area, landmark or PIN code…" autocomplete="off">
        <button type="button" class="button small" data-map="search">Search</button>
      </div>
      <div id="map-results" class="map-results" aria-label="Address matches"></div>
    </div>
    <div class="map-sheet-stage">
      <div id="delivery-map" aria-label="Delivery location map. Scroll to zoom or pinch with two fingers. Drag the pin or tap the map to mark your entrance."></div>
      <div class="map-stage-fabs">
        <button type="button" class="map-fab-btn" data-map="device" title="Use my current location">⌖ Locate Me</button>
      </div>
    </div>
    <div class="map-sheet-footer">
      <p id="pin-coordinates" class="small map-coords-note"></p>
      <div id="mapped-address" class="mapped-address" hidden>
        <span class="eyebrow">Nearby mapped address · please check</span>
        <p id="mapped-address-text"></p>
        <button type="button" class="text-link" data-map="apply-address">Use this address in the form</button>
        <p class="small muted">Check the house number and keep your apartment / landmark details.</p>
      </div>
      <div class="map-sheet-confirm-row">
        <button type="button" class="button map-confirm-cta" data-map="confirm" disabled>Confirm delivery pin ✓</button>
        <button type="button" class="button outline small" data-map="clear">Reset</button>
      </div>
    </div>`;
  document.body.append(sheet);

  const el=id=>sheet.querySelector(`#${id}`)||root.querySelector(`#${id}`);
  const status=text=>{
    if(disposed)return;
    const s1=root.querySelector('#map-status');
    const s2=sheet.querySelector('#map-sheet-status');
    if(s1)s1.textContent=text;
    if(s2)s2.textContent=text;
  };
  const syncSummaryCard=()=>{
    const isOk=validLocation(pending);
    const card=root.querySelector('.delivery-pin-card');
    if(card)card.classList.toggle('is-confirmed',isOk);
    const badge=root.querySelector('.map-summary-badge');
    if(badge)badge.textContent=isOk?'Pin confirmed ✓':pending?'Confirm pin':'Required';
    const openBtn=root.querySelector('[data-map="open"]');
    if(openBtn)openBtn.textContent=isOk?'Change location':pending?'Adjust pin':'Choose on map';
  };
  const enabled=()=>{
    const button=sheet.querySelector('[data-map="confirm"]');
    if(button){
      button.disabled=!pending||pending.confirmed;
      button.textContent=pending?.confirmed?'Delivery pin confirmed ✓':'Confirm delivery pin ✓';
      button.classList.toggle('pin-confirmed',!!pending?.confirmed);
    }
    const clearBtn=sheet.querySelector('[data-map="clear"]');
    if(clearBtn)clearBtn.disabled=!pending;
    syncSummaryCard();
  };
  function setMapLayer(nextLayer){
    if(!map||nextLayer===activeLayer)return;
    if(nextLayer==='street'){map.removeLayer(satelliteLayer);streetLayer.addTo(map);}
    else{map.removeLayer(streetLayer);satelliteLayer.addTo(map);}
    activeLayer=nextLayer;
    sheet.querySelectorAll('[data-map^="layer-"]').forEach(btn=>{
      const selected=btn.dataset.map===`layer-${nextLayer}`;
      btn.classList.toggle('is-active',selected);
      btn.setAttribute('aria-pressed',String(selected));
    });
  }
  async function ensureMap(){
    if(map){map.invalidateSize();return;}
    if(!mapPromise){
      mapPromise=(async()=>{
        await loadScript('assets/vendor/leaflet.js');
        if(disposed||map)return;
        map=window.L.map(sheet.querySelector('#delivery-map'),{scrollWheelZoom:true,touchZoom:true,doubleClickZoom:true,keyboard:true,zoomControl:true,wheelPxPerZoomLevel:60,zoomSnap:0.5}).setView(pending?[pending.latitude,pending.longitude]:[22.5,79],pending?17:5);
        const imagery=window.L.tileLayer(MAP_CONFIG.satelliteTiles,{attribution:MAP_CONFIG.satelliteAttribution,maxZoom:19,maxNativeZoom:18}).on('tileerror',()=>status('Some satellite tiles could not load. Switch to Street map or retry before confirming.'));
        const roads=window.L.tileLayer(MAP_CONFIG.roadsTiles,{maxZoom:19,maxNativeZoom:18});
        const labels=window.L.tileLayer(MAP_CONFIG.labelsTiles,{maxZoom:19,maxNativeZoom:18});
        satelliteLayer=window.L.layerGroup([imagery,roads,labels]);
        streetLayer=window.L.tileLayer(MAP_CONFIG.tiles,{attribution:MAP_CONFIG.attribution,maxZoom:19}).on('tileerror',()=>status('Some map tiles could not load. Retry your connection before confirming.'));
        satelliteLayer.addTo(map);
        map.on('click',event=>setPoint(event.latlng.lat,event.latlng.lng,'pin'));
        if(pending){placeMarker();updatePointUI();}
      })().finally(()=>{mapPromise=null;});
    }
    await mapPromise;
    if(!disposed&&map){
      map.invalidateSize();
      clearTimeout(invalidateTimer);
      invalidateTimer=setTimeout(()=>{if(!disposed&&map&&sheet.open)map.invalidateSize();},80);
    }
  }
  async function openSheet(){
    if(disposed)return;
    clearTimeout(sheet._closeTimer);
    sheet.classList.remove('is-closing','is-dragging');
    sheet.style.transform='';
    const searchInput=sheet.querySelector('#map-sheet-search');
    if(searchInput&&!searchInput.value.trim()){
      const c=getAddress?.()||{};
      const typed=[c.address,c.city,c.postalCode].filter(Boolean).join(', ');
      if(typed)searchInput.value=typed;
    }
    if(!sheet.open){
      sheet.classList.remove('is-open');
      sheet.showModal();
      requestAnimationFrame(()=>requestAnimationFrame(()=>{if(sheet.open)sheet.classList.add('is-open');}));
    }else{
      sheet.classList.add('is-open');
    }
    await ensureMap();
    if(!disposed&&map){
      if(pending)map.setView([pending.latitude,pending.longitude],Math.max(map.getZoom()||17,16));
      clearTimeout(invalidateTimer);
      invalidateTimer=setTimeout(()=>{if(!disposed&&map&&sheet.open)map.invalidateSize();},360);
    }
  }
  function closeSheet({immediate=false,fromDrag=false}={}){
    if(!sheet.open)return;
    clearTimeout(sheet._closeTimer);
    const reduced=matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if(immediate||reduced){
      sheet.classList.remove('is-open','is-closing','is-dragging');
      sheet.style.transform='';
      sheet.close();
      return;
    }
    sheet.classList.remove('is-open');
    sheet.classList.add('is-closing');
    if(fromDrag)requestAnimationFrame(()=>{sheet.style.transform='';});
    const finish=()=>{
      clearTimeout(sheet._closeTimer);
      sheet.removeEventListener('transitionend',onEnd);
      sheet.classList.remove('is-closing','is-dragging');
      sheet.style.transform='';
      if(sheet.open)sheet.close();
    };
    const onEnd=ev=>{if(ev.target===sheet&&ev.propertyName==='transform')finish();};
    sheet.addEventListener('transitionend',onEnd);
    sheet._closeTimer=setTimeout(finish,360);
  }
  function placeMarker(){
    if(!map||!pending)return;
    const at=[pending.latitude,pending.longitude];
    if(!marker){marker=window.L.marker(at,{draggable:true,title:'Drag to your delivery entrance',icon:window.L.divIcon({className:'delivery-marker',html:'<span aria-hidden="true">●</span>',iconSize:[34,44],iconAnchor:[17,44]})}).addTo(map);marker.on('dragend',()=>{const at=marker.getLatLng();setPoint(at.lat,at.lng,'pin');});}else marker.setLatLng(at);
    if(accuracyCircle){accuracyCircle.remove();accuracyCircle=null;}
    if(pending.accuracy)accuracyCircle=window.L.circle(at,{radius:pending.accuracy,color:'#ffffff',fillColor:'#d96b43',weight:2,fillOpacity:.2}).addTo(map);
  }
  function updatePointUI(){
    enabled();
    const coordsEl=sheet.querySelector('#pin-coordinates');
    if(coordsEl)coordsEl.textContent=pending?`${pending.latitude.toFixed(6)}, ${pending.longitude.toFixed(6)}${pending.accuracy?` · Device accuracy about ${Math.round(pending.accuracy)} m`:''}`:'';
    const mappedBox=sheet.querySelector('#mapped-address');
    const mappedText=sheet.querySelector('#mapped-address-text');
    if(mappedBox)mappedBox.hidden=!suggestion;
    if(mappedText)mappedText.textContent=suggestion?featureLabel(suggestion):'';
    const label=suggestion?featureLabel(suggestion):(pending?(pending.formattedAddress||`${pending.latitude.toFixed(4)}, ${pending.longitude.toFixed(4)}`):'Locate me or choose your delivery spot on the map');
    const summaryText=root.querySelector('#map-floating-address-text');
    if(summaryText)summaryText.textContent=label;
  }
  function setPoint(latitude,longitude,source,accuracy=0,feature=null){
    if(!validCoordinates(latitude,longitude))return;
    version++;controller?.abort();clearTimeout(timer);
    pending={latitude:Number(latitude.toFixed(6)),longitude:Number(longitude.toFixed(6)),source,accuracy,formattedAddress:feature?featureLabel(feature):'',confirmed:false};suggestion=feature;
    onChange({...pending});placeMarker();updatePointUI();status('Pin placed — drag to fine-tune, then tap Confirm.');
    if(!feature){const current=version;timer=setTimeout(()=>reverse(current),900);}
  }
  async function request(path,params){
    const expectedVersion=version;
    const url=new URL(MAP_CONFIG.geocoder.replace(/\/$/,'')+path);for(const [key,value] of Object.entries(params))url.searchParams.set(key,value);
    if(cache.has(url.href))return cache.get(url.href);
    const delay=Math.max(0,1200-(Date.now()-lastRequest));if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
    if(disposed||expectedVersion!==version)throw new Error('Lookup superseded');
    controller?.abort();controller=new AbortController();const active=controller;lastRequest=Date.now();
    const timeout=setTimeout(()=>active.abort(),12000);
    try{const response=await fetch(url,{signal:active.signal,credentials:'omit'});if(!response.ok)throw new Error('Lookup unavailable');const data=await response.json();const found=(data.features||[]).filter(f=>validCoordinates(f.geometry?.coordinates?.[1],f.geometry?.coordinates?.[0]));cache.set(url.href,found);return found;}finally{clearTimeout(timeout);}
  }
  async function reverse(current){
    const at=pending;if(!at)return;
    try{const found=await request('/reverse',{lat:at.latitude,lon:at.longitude,limit:1,lang:'en'});if(disposed||current!==version)return;suggestion=found[0]||null;if(pending){pending.formattedAddress=suggestion?featureLabel(suggestion):'';if(pending.confirmed)onChange({...pending});}updatePointUI();}
    catch{if(current===version)status('Nearby address lookup is unavailable. Your pin still works; tap Confirm when ready.');}
  }
  async function search(){
    await openSheet();
    const typed=sheet.querySelector('#map-sheet-search')?.value?.trim()||'';
    const c=getAddress?.()||{};
    const hasFormAddress=Boolean(c.address||c.city||c.postalCode);
    if(!typed&&!hasFormAddress){status('Type a street, area, landmark or PIN code above, or tap Locate Me.');return;}
    const current=++version;clearTimeout(timer);controller?.abort();await ensureMap();if(disposed||current!==version)return;
    status('Finding your address…');
    try{
      const query=typed
        ?(/\bindia\b/i.test(typed)?typed:`${typed}, India`)
        :[c.address,c.city,c.state,c.postalCode,'India'].filter(Boolean).join(', ');
      results=await request('/api/',{q:query,limit:5,lang:'en',bbox:'68,6,98,38'});
      if(disposed||current!==version)return;
      let approximate=false;
      if(!results.length&&(c.city||c.postalCode)){results=await request('/api/',{q:[c.city,c.postalCode,'India'].filter(Boolean).join(', '),limit:5,lang:'en',bbox:'68,6,98,38'});approximate=true;}
      if(disposed||current!==version)return;
      const resultsEl=sheet.querySelector('#map-results');
      if(resultsEl)resultsEl.innerHTML=results.map((f,i)=>`<button type="button" data-map-result="${i}">${e(featureLabel(f))}<span>Choose →</span></button>`).join('');
      if(results.length){const f=results[0];map.setView([f.geometry.coordinates[1],f.geometry.coordinates[0]],approximate?13:16);status(approximate?'Choose a nearby match, then tap or drag the pin to your entrance.':'Choose a match above, or tap anywhere on the map.');}else status('No match found. Try a nearby landmark, tap Locate Me, or tap the map directly.');
    }catch{if(current===version)status('Address search is unavailable. Tap Locate Me or point directly on the map.');}
  }
  async function locate(){
    await openSheet();
    if(!navigator.geolocation){status('This browser does not support location. Search above or tap the map directly.');return;}
    const current=++version;status('Waiting for your location permission…');
    navigator.geolocation.getCurrentPosition(async position=>{if(disposed||current!==version)return;try{await ensureMap();if(disposed||current!==version)return;const {latitude,longitude,accuracy}=position.coords;setPoint(latitude,longitude,'device',Math.min(accuracy,1000000));map.setView([latitude,longitude],17);status('Location found. Drag the pin to your exact entrance, then confirm.');}catch{status('The map could not load. Please retry to confirm your delivery pin.');}},error=>{if(disposed||current!==version)return;status(error.code===1?'Location permission was not granted. Search above or tap the map.':'Your location could not be found. Search above or point on the map.');},{enableHighAccuracy:true,timeout:15000,maximumAge:0});
  }
  async function click(event){
    const target=event.target.closest('[data-map],[data-map-result]');
    if(!target||(!root.contains(target)&&!sheet.contains(target)))return;
    if(target.disabled)return;
    const action=target.dataset.map;
    target.disabled=true;
    try{
      if(target.dataset.mapResult!==undefined){
        const f=results[Number(target.dataset.mapResult)];
        if(f){
          setPoint(f.geometry.coordinates[1],f.geometry.coordinates[0],'search',0,f);
          map.setView([pending.latitude,pending.longitude],17);
          const resultsEl=sheet.querySelector('#map-results');
          if(resultsEl)resultsEl.innerHTML='';
        }
      }
      else if(action==='open'){await openSheet();}
      else if(action==='close'){closeSheet();}
      else if(action==='layer-satellite')setMapLayer('satellite');
      else if(action==='layer-street')setMapLayer('street');
      else if(action==='search')await search();
      else if(action==='device')await locate();
      else if(action==='confirm'&&pending){
        pending.confirmed=true;
        onChange({...pending});
        updatePointUI();
        status('✓ Delivery pin confirmed.');
        closeSheet();
      }
      else if(action==='apply-address'&&suggestion){
        pending.confirmed=false;
        onChange({...pending});
        onAddress(featureAddress(suggestion));
        status('Nearby address copied to form. Tap Confirm delivery pin when ready.');
      }
      else if(action==='clear'){
        version++;clearTimeout(timer);controller?.abort();
        pending=null;suggestion=null;marker?.remove();marker=null;accuracyCircle?.remove();accuracyCircle=null;
        onChange(null);updatePointUI();
        status('Pin cleared. Tap the map or Locate Me to set your delivery pin.');
      }
    }catch(error){status(error.message);}finally{if(target.isConnected){target.disabled=false;enabled();}}
  }
  const onSheetClick=ev=>{if(ev.target===sheet)closeSheet();};
  const onCancel=ev=>{ev.preventDefault();closeSheet();};
  const onSearchKey=ev=>{if(ev.key==='Enter'){ev.preventDefault();search();}};
  const searchInput=sheet.querySelector('#map-sheet-search');
  const headerEl=sheet.querySelector('.map-sheet-header');
  let dragStartY=0,dragStartTime=0,dragDy=0,dragging=false,dragPointerId=null;
  const onHeaderPointerDown=ev=>{
    if((ev.pointerType==='mouse'&&ev.button!==0)||ev.target.closest('input,button,a,#map-results'))return;
    dragging=true;
    dragPointerId=ev.pointerId;
    dragStartY=ev.clientY;
    dragStartTime=performance.now();
    dragDy=0;
    sheet.classList.add('is-dragging');
    try{headerEl?.setPointerCapture?.(ev.pointerId);}catch{}
  };
  const onHeaderPointerMove=ev=>{
    if(!dragging||ev.pointerId!==dragPointerId)return;
    dragDy=Math.max(0,ev.clientY-dragStartY);
    sheet.style.transform=`translateY(${dragDy}px)`;
  };
  const onHeaderPointerUp=ev=>{
    if(!dragging||ev.pointerId!==dragPointerId)return;
    dragging=false;
    try{headerEl?.releasePointerCapture?.(ev.pointerId);}catch{}
    sheet.classList.remove('is-dragging');
    const vy=dragDy/Math.max(1,performance.now()-dragStartTime);
    if(dragDy>110||(dragDy>40&&vy>0.45))closeSheet({fromDrag:true});
    else sheet.style.transform='';
  };
  root.addEventListener('click',click);
  sheet.addEventListener('click',click);
  sheet.addEventListener('click',onSheetClick);
  sheet.addEventListener('cancel',onCancel);
  searchInput?.addEventListener('keydown',onSearchKey);
  headerEl?.addEventListener('pointerdown',onHeaderPointerDown);
  headerEl?.addEventListener('pointermove',onHeaderPointerMove);
  headerEl?.addEventListener('pointerup',onHeaderPointerUp);
  headerEl?.addEventListener('pointercancel',onHeaderPointerUp);
  if(pending?.confirmed)status('✓ Delivery pin confirmed. Tap Change location to adjust it.');
  else if(pending&&!pending.confirmed)status('A pin is selected. Tap Choose on map to confirm it.');
  else syncSummaryCard();
  return {
    focus(){root.scrollIntoView({block:'center',behavior:'smooth'});},
    needsConfirmation(){return !validLocation(pending);},
    setSavedLocation(point){
      if(pending||!validLocation(point))return false;
      pending={...point};
      onChange({...pending});
      if(map){map.setView([pending.latitude,pending.longitude],17);placeMarker();}
      updatePointUI();
      status('✓ Saved delivery pin confirmed. Tap Change location to adjust it.');
      return true;
    },
    invalidate(){
      if(pending){
        pending.confirmed=false;
        onChange({...pending});
        updatePointUI();
        status('Address changed. Open the map and reconfirm your pin.');
      }
    },
    destroy(){
      disposed=true;
      version++;
      controller?.abort();
      clearTimeout(timer);
      clearTimeout(invalidateTimer);
      clearTimeout(sheet._closeTimer);
      root.removeEventListener('click',click);
      sheet.removeEventListener('click',click);
      sheet.removeEventListener('click',onSheetClick);
      sheet.removeEventListener('cancel',onCancel);
      searchInput?.removeEventListener('keydown',onSearchKey);
      headerEl?.removeEventListener('pointerdown',onHeaderPointerDown);
      headerEl?.removeEventListener('pointermove',onHeaderPointerMove);
      headerEl?.removeEventListener('pointerup',onHeaderPointerUp);
      headerEl?.removeEventListener('pointercancel',onHeaderPointerUp);
      map?.remove();
      if(sheet.open)sheet.close();
      sheet.remove();
    }
  };
}

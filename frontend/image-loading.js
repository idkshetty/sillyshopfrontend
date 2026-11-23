// Reserve image space immediately; decode off the main rendering path and upgrade instant previews to full HD.
const watched=new WeakSet();
const hdLoadedUrls=new Set();
const hdInFlight=new Map();

function loadHdUrl(url){
  if(hdLoadedUrls.has(url))return Promise.resolve(true);
  if(hdInFlight.has(url))return hdInFlight.get(url);
  const p=new Promise(resolve=>{
    const loader=new Image();
    loader.decoding='async';
    const done=ok=>{hdInFlight.delete(url);if(ok)hdLoadedUrls.add(url);resolve(ok);};
    loader.onload=()=>{
      if(typeof loader.decode==='function')loader.decode().then(()=>done(true),()=>done(true));
      else done(true);
    };
    loader.onerror=()=>done(false);
    loader.src=url;
  });
  hdInFlight.set(url,p);
  return p;
}

function upgradeImageToHd(img){
  const hdSrc=img?.dataset?.hdSrc;
  if(!hdSrc||img.dataset.hdLoaded==='1')return;
  if(hdLoadedUrls.has(hdSrc)){
    img.dataset.hdLoaded='1';
    if(img.getAttribute('src')!==hdSrc)img.src=hdSrc;
    img.classList.remove('image-loading');
    return;
  }
  loadHdUrl(hdSrc).then(ok=>{
    if(!ok||!img.isConnected||img.dataset.hdSrc!==hdSrc)return;
    img.dataset.hdLoaded='1';
    img.src=hdSrc;
    img.classList.remove('image-loading');
  });
}

const hdObserver=typeof IntersectionObserver==='function'
  ?new IntersectionObserver(entries=>{
      for(const entry of entries){
        if(entry.isIntersecting){
          hdObserver.unobserve(entry.target);
          upgradeImageToHd(entry.target);
        }
      }
    },{rootMargin:'420px 0px'})
  :null;

function scheduleHdUpgrade(img){
  const hdSrc=img?.dataset?.hdSrc;
  if(!hdSrc||img.dataset.hdLoaded==='1')return;
  if(hdLoadedUrls.has(hdSrc)||img.getAttribute('fetchpriority')==='high'){
    upgradeImageToHd(img);
    return;
  }
  if(hdObserver)hdObserver.observe(img);
  else upgradeImageToHd(img);
}

function prepare(root){
  const list=root?.tagName==='IMG'?[root]:[...(root?.querySelectorAll?.('img')||[])];
  for(const img of list){
    scheduleHdUpgrade(img);
    if(watched.has(img))continue;
    watched.add(img);
    img.decoding='async';
    const done=()=>img.classList.remove('image-loading');
    const isInstantData=String(img.getAttribute('src')||'').startsWith('data:');
    if(!img.complete&&!isInstantData)img.classList.add('image-loading');
    img.addEventListener('load',done,{once:true});
    img.addEventListener('error',()=>{
      done();
      if(img.dataset.fallbackSrc&&img.getAttribute('src')!==img.dataset.fallbackSrc){
        img.src=img.dataset.fallbackSrc;
        return;
      }
      img.classList.add('image-failed');
      if(img.closest('.content-image-control,.review-editor-image'))return;
      img.src='assets/paintings.svg';
    },{once:true});
  }
}
prepare(document);
new MutationObserver(changes=>{
  for(const change of changes){
    if(change.type==='attributes'&&change.target?.tagName==='IMG'){
      scheduleHdUpgrade(change.target);
      continue;
    }
    for(const node of change.addedNodes){
      if(node.nodeType===1)prepare(node);
    }
  }
}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-hd-src','src']});

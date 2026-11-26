let activeMetaId='';
let activeGa4Id='';

export function sanitizeMetaPixelId(val=''){
  const clean=String(val||'').trim();
  return /^\d{8,20}$/.test(clean)?clean:'';
}

export function sanitizeGa4Id(val=''){
  const clean=String(val||'').trim().toUpperCase();
  return /^G-[A-Z0-9]{6,16}$/.test(clean)?clean:'';
}

function loadScriptOnce(id,src){
  if(typeof document==='undefined'||document.getElementById(id))return;
  try{
    const s=document.createElement('script');
    s.id=id;
    s.async=true;
    s.src=src;
    document.head?.appendChild(s);
  }catch{}
}

export function initMarketingPixels({metaPixelId='',ga4MeasurementId=''}={}){
  if(typeof window==='undefined')return;
  const cleanMeta=sanitizeMetaPixelId(metaPixelId);
  const cleanGa4=sanitizeGa4Id(ga4MeasurementId);

  if(cleanMeta&&cleanMeta!==activeMetaId){
    activeMetaId=cleanMeta;
    try{
      if(typeof window.fbq!=='function'){
        const fbqShim=function(...args){
          if(fbqShim.callMethod)fbqShim.callMethod.apply(fbqShim,args);
          else fbqShim.queue.push(args);
        };
        fbqShim.push=fbqShim;
        fbqShim.loaded=true;
        fbqShim.version='2.0';
        fbqShim.queue=[];
        window.fbq=fbqShim;
        if(!window._fbq)window._fbq=fbqShim;
        loadScriptOnce('hehe-meta-pixel-js','https://connect.facebook.net/en_US/fbevents.js');
      }
      window.fbq('init',cleanMeta);
      window.fbq('track','PageView');
    }catch{}
  }

  if(cleanGa4&&cleanGa4!==activeGa4Id){
    activeGa4Id=cleanGa4;
    try{
      window.dataLayer=window.dataLayer||[];
      if(typeof window.gtag!=='function'){
        window.gtag=function(){window.dataLayer.push(arguments);};
      }
      loadScriptOnce('hehe-ga4-js',`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(cleanGa4)}`);
      window.gtag('js',new Date());
      window.gtag('config',cleanGa4,{send_page_view:true});
    }catch{}
  }
}

export function trackPixelEvent(eventName,params={}){
  if(typeof window==='undefined')return;
  try{
    const name=String(eventName||'').trim();
    const currency='INR';
    const value=Number(params.value)||0;
    const itemId=params.itemId?String(params.itemId):'';
    const itemName=params.itemName?String(params.itemName):'';
    const items=Array.isArray(params.items)?params.items:(itemId?[{item_id:itemId,item_name:itemName||'Artwork',price:value,quantity:Number(params.quantity)||1}]:[]);

    if(typeof window.fbq==='function'){
      if(name==='view_item'){
        window.fbq('track','ViewContent',{content_ids:itemId?[itemId]:[],content_name:itemName,content_type:'product',value,currency});
      }else if(name==='add_to_cart'){
        window.fbq('track','AddToCart',{content_ids:itemId?[itemId]:[],content_name:itemName,content_type:'product',value,currency});
      }else if(name==='begin_checkout'){
        window.fbq('track','InitiateCheckout',{value,currency,num_items:Number(params.numItems)||items.length||1});
      }else if(name==='purchase'){
        window.fbq('track','Purchase',{value,currency,content_ids:items.map(i=>i.item_id).filter(Boolean)});
      }
    }

    if(typeof window.gtag==='function'){
      if(name==='purchase'){
        window.gtag('event','purchase',{transaction_id:String(params.transactionId||''),value,currency,items});
      }else if(['view_item','add_to_cart','begin_checkout'].includes(name)){
        window.gtag('event',name,{value,currency,items});
      }else if(name==='search'&&params.searchTerm){
        window.gtag('event','search',{search_term:String(params.searchTerm)});
      }
    }
  }catch{}
}

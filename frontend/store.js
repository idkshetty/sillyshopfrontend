import {backendURL} from './backend-config.js';
import {firebaseConfig,ADMIN_EMAILS,MASTER_ADMIN_EMAIL,APP_CHECK_SITE_KEY} from './firebase-config.js';
import {normalizeProduct,sortArtworks,validateCustomer} from './commerce.js';
import {normalizeArtists} from './artists.js';
import {normalizeSettings} from './store-settings.js';
import {normalizePromos} from './promotions.js';
import {normalizeContent,validateContent} from './store-content.js';
import {encodeImage,isInlineImage} from './image-data.js';

let sdkPromise, sdk,realtimePromise,publicConfigPromise;
const productListeners=new Set();
let adminProducts=[];
let siteTrackBackoffUntil=0,bagTrackBackoffUntil=0;
export async function backend(){
 if(!sdkPromise)sdkPromise=Promise.all([import('https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js')]).then(async([appAPI,a])=>{const app=appAPI.getApps().length?appAPI.getApp():appAPI.initializeApp(firebaseConfig);const auth=a.getAuth(app);if(a.browserLocalPersistence&&typeof a.setPersistence==='function')await a.setPersistence(auth,a.browserLocalPersistence).catch(()=>{});sdk={app,auth,a};return sdk;}).catch(error=>{sdkPromise=null;throw error;});return sdkPromise;
}
async function loadPublicConfig(){
 if(!publicConfigPromise)publicConfigPromise=(async()=>{const response=await fetch(backendURL()+'/config',{signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('The backend configuration is unavailable.');const config=await response.json();if(config.projectId!==firebaseConfig.projectId)throw new Error('Frontend and backend Firebase projects do not match.');return config;})().catch(error=>{publicConfigPromise=null;throw error;});return publicConfigPromise;
}
export async function checkoutPaymentConfig(){return loadPublicConfig();}
export async function paymentPreviewEnabled(){try{return (await checkoutPaymentConfig()).paymentPreviewEnabled===true;}catch{return false;}}
async function realtimeBackend(){
 if(!realtimePromise)realtimePromise=(async()=>{const {app}=await backend();const r=await import('https://www.gstatic.com/firebasejs/12.3.0/firebase-database.js');let url=firebaseConfig.databaseURL;
 if(!url){const config=await loadPublicConfig();url=config.databaseURL;}
 if(!url)throw new Error('Set FIREBASE_DB_URL on the backend.');return {r,db:r.getDatabase(app,url)};})().catch(error=>{realtimePromise=null;throw error;});return realtimePromise;
}
function cachedPublic(path,onData){const key='silly-public-v2:'+path;let initialValue=null,hasCached=false;try{const cache=JSON.parse(localStorage.getItem(key));if(cache&&Date.now()-cache.time<86400000){initialValue=cache.value;hasCached=true;onData(cache.value);}}catch{}const publish=value=>{try{localStorage.setItem(key,JSON.stringify({time:Date.now(),value}));}catch{}onData(value);};return {publish,initialJson:hasCached?JSON.stringify(initialValue??{}):''};}
const PUBLIC_STORE_REFRESH_MS=20000;
const publicSubscribers=new Map();
let publicStoreSnapshot=null,publicStoreLoadedAt=0,publicStorePromise=null,publicPollTimer=null,stopLiveRev=null,lastLiveRev=0,focusListenersBound=false;
function deliverPublicPath(path,value){
  const set=publicSubscribers.get(path);
  if(!set?.size)return;
  const payload=value??{};
  const serialized=JSON.stringify(payload);
  for(const sub of set){
    if(sub.lastJson===serialized)continue;
    sub.lastJson=serialized;
    sub.publish(payload);
  }
}
async function fetchPublicStore({force=false,rev=''}={}){
  if(!force&&publicStoreSnapshot&&Date.now()-publicStoreLoadedAt<PUBLIC_STORE_REFRESH_MS)return publicStoreSnapshot;
  if(!publicStorePromise){
    const endpoint=rev?`${backendURL()}/public-store?v=${encodeURIComponent(rev)}`:`${backendURL()}/public-store`;
    const fetchOpts=rev?{cache:'no-store',signal:AbortSignal.timeout(15000)}:(force?{cache:'no-cache',signal:AbortSignal.timeout(15000)}:{signal:AbortSignal.timeout(15000)});
    publicStorePromise=(async()=>{
      const response=await fetch(endpoint,fetchOpts);
      if(!response.ok)throw new Error('Could not load public store.');
      const data=await response.json();
      publicStoreSnapshot=data;
      publicStoreLoadedAt=Date.now();
      for(const path of publicSubscribers.keys())deliverPublicPath(path,data?.[path]??{});
      return data;
    })().finally(()=>{publicStorePromise=null;});
  }
  return publicStorePromise;
}
function ensureLiveRevSubscription(){
  if(stopLiveRev||typeof window==='undefined')return;
  stopLiveRev='connecting';
  void realtimeBackend().then(({r,db})=>{
    if(!publicSubscribers.size){stopLiveRev=null;return;}
    stopLiveRev=r.onValue(r.ref(db,'publicStore/_liveRev'),snap=>{
      const val=snap.val();
      const v=Number(val?.v)||0;
      if(!v)return;
      if(!lastLiveRev){
        lastLiveRev=v;
        if(publicStoreLoadedAt>0&&v>publicStoreLoadedAt){
          void fetchPublicStore({force:true,rev:String(v)}).catch(()=>{});
        }
        return;
      }
      if(v!==lastLiveRev){
        lastLiveRev=v;
        void fetchPublicStore({force:true,rev:String(v)}).catch(()=>{});
      }
    },()=>{});
  }).catch(()=>{stopLiveRev=null;});
}
function ensurePublicPolling(){
  ensureLiveRevSubscription();
  if(!focusListenersBound&&typeof window!=='undefined'&&typeof document!=='undefined'){
    focusListenersBound=true;
    const syncIfStale=()=>{
      if(document.visibilityState!=='visible'||!publicSubscribers.size)return;
      if(Date.now()-publicStoreLoadedAt>4000){
        void fetchPublicStore({force:true,rev:lastLiveRev?String(lastLiveRev):String(Date.now())}).catch(()=>{});
      }
    };
    document.addEventListener('visibilitychange',syncIfStale);
    window.addEventListener('focus',syncIfStale);
  }
  if(publicPollTimer||typeof setInterval!=='function')return;
  publicPollTimer=setInterval(()=>{
    if(!publicSubscribers.size){clearInterval(publicPollTimer);publicPollTimer=null;return;}
    if(typeof document==='undefined'||document.visibilityState==='visible')void fetchPublicStore({force:true,rev:lastLiveRev?String(lastLiveRev):''}).catch(()=>{});
  },PUBLIC_STORE_REFRESH_MS);
}
async function refreshPublicStore(){
  const rev=String(Date.now());
  try{await fetchPublicStore({force:true,rev});}catch{}
}
async function observePublic(path,onData,onError){
  const {publish,initialJson}=cachedPublic(path,onData);
  const sub={publish,onError,lastJson:initialJson};
  if(!publicSubscribers.has(path))publicSubscribers.set(path,new Set());
  publicSubscribers.get(path).add(sub);
  ensurePublicPolling();
  const hasSnapshot=publicStoreSnapshot&&Date.now()-publicStoreLoadedAt<PUBLIC_STORE_REFRESH_MS;
  if(hasSnapshot){
    deliverPublicPath(path,publicStoreSnapshot?.[path]??{});
  }else{
    void fetchPublicStore().catch(async error=>{
      if(!publicSubscribers.get(path)?.has(sub))return;
      try{
        const {r,db}=await realtimeBackend();
        const snap=await r.get(r.ref(db,'publicStore/'+path));
        const val=snap.val()||{};
        const serialized=JSON.stringify(val);
        if(sub.lastJson!==serialized){sub.lastJson=serialized;sub.publish(val);}
      }catch(fallbackError){
        if(!sub.lastJson)sub.onError?.(fallbackError||error);
      }
    });
  }
  return ()=>{
    const set=publicSubscribers.get(path);
    set?.delete(sub);
    if(set&&!set.size)publicSubscribers.delete(path);
    if(!publicSubscribers.size){
      if(publicPollTimer){clearInterval(publicPollTimer);publicPollTimer=null;}
      if(typeof stopLiveRev==='function'){stopLiveRev();}
      stopLiveRev=null;
    }
  };
}
export async function observeAuth(callback) {
  const {a,auth} = await backend();
  try {
    await a.getRedirectResult(auth);
  } catch (error) {
    if (error?.code === 'auth/credential-already-in-use' && auth.currentUser?.isAnonymous) {
      try {
        const guestToken = await auth.currentUser.getIdToken();
        const credential = a.GoogleAuthProvider.credentialFromError(error);
        if (credential) {
          await a.signInWithCredential(auth, credential);
          try { await callBackend('claimGuestRequests', { guestToken }); } catch {}
        }
      } catch {}
    }
  }
  let version=0;
  return a.onAuthStateChanged(auth, async user => {
    const current=++version;
    let admin = false, masterAdmin = false;
    if (user && !user.isAnonymous) {
      const email=(user.email||'').toLowerCase();
      try { const {claims} = await user.getIdTokenResult(); admin = claims.admin === true || (user.emailVerified && ADMIN_EMAILS.includes(email)); masterAdmin = user.emailVerified && email === MASTER_ADMIN_EMAIL; } catch {}
    }
    if(user&&!user.isAnonymous){try{const me=await callBackend('currentUser');admin=me.admin;masterAdmin=Boolean(me.masterAdmin);}catch{}}
    if(current===version&&auth.currentUser?.uid===user?.uid)callback(user,admin,masterAdmin);
  });
}
export function signIn({ redirect = false } = {}) {
  const run = ({ a, auth }) => {
    const provider = new a.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    if (redirect) {
      return auth.currentUser?.isAnonymous
        ? a.linkWithRedirect(auth.currentUser, provider)
        : a.signInWithRedirect(auth, provider);
    }
    const startedAt = Date.now();
    const attempt = auth.currentUser?.isAnonymous
      ? a.linkWithPopup(auth.currentUser, provider)
      : a.signInWithPopup(auth, provider);
    return attempt.catch(async error => {
      if (error?.code === 'auth/credential-already-in-use' && auth.currentUser?.isAnonymous) {
        const guestToken = await auth.currentUser.getIdToken();
        const credential = a.GoogleAuthProvider.credentialFromError(error);
        const result = await a.signInWithCredential(auth, credential);
        try { await callBackend('claimGuestRequests', { guestToken }); } catch { throw new Error('Signed in. Your earlier guest request is still private; the studio can help recover it after the backend is connected.'); }
        return result;
      }
      const blockedByBrowser = error?.code === 'auth/popup-blocked'
        || error?.code === 'auth/operation-not-supported-in-this-environment'
        || error?.code === 'auth/cancelled-popup-request'
        || (error?.code === 'auth/popup-closed-by-user' && Date.now() - startedAt < 1800);
      if (blockedByBrowser) {
        return auth.currentUser?.isAnonymous
          ? a.linkWithRedirect(auth.currentUser, provider)
          : a.signInWithRedirect(auth, provider);
      }
      throw error;
    });
  };
  if (sdk) return run(sdk);
  return backend().then(run);
}
export async function signOut() {
  const {a,auth} = await backend();await a.signOut(auth);
}
export async function signInWithEmail(email='',password=''){
  const cleanEmail=String(email||'').trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail))throw new Error('Please enter a valid email address.');
  if(!password)throw new Error('Please enter your password.');
  const {a,auth}=await backend();
  const guestToken=auth.currentUser?.isAnonymous?await auth.currentUser.getIdToken().catch(()=>null):null;
  const result=await a.signInWithEmailAndPassword(auth,cleanEmail,String(password));
  if(guestToken){try{await callBackend('claimGuestRequests',{guestToken});}catch{}}
  return result;
}
function verificationActionSettings(){
  if(typeof location==='undefined'||!/^https?:$/.test(location.protocol))return undefined;
  return {url:`${location.origin}${location.pathname}#account`,handleCodeInApp:false};
}
export async function signUpWithEmail({name='',email='',password=''}={}){
  const cleanName=String(name||'').trim().slice(0,80);
  const cleanEmail=String(email||'').trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail))throw new Error('Please enter a valid email address.');
  if(String(password||'').length<6)throw new Error('Password must be at least 6 characters long.');
  const {a,auth}=await backend();
  let result;
  if(auth.currentUser?.isAnonymous&&typeof a.EmailAuthProvider?.credential==='function'){
    result=await a.linkWithCredential(auth.currentUser,a.EmailAuthProvider.credential(cleanEmail,String(password)));
  }else{
    result=await a.createUserWithEmailAndPassword(auth,cleanEmail,String(password));
  }
  if(cleanName&&result?.user&&typeof a.updateProfile==='function'){
    await a.updateProfile(result.user,{displayName:cleanName}).catch(()=>{});
  }
  if(result?.user&&typeof a.sendEmailVerification==='function'){
    const settings=verificationActionSettings();
    (settings?a.sendEmailVerification(result.user,settings):a.sendEmailVerification(result.user))
      .catch(()=>settings?a.sendEmailVerification(result.user).catch(()=>{}):undefined);
  }
  return result;
}
export async function resendVerificationEmail(){
  const {a,auth}=await backend();
  await auth.authStateReady();
  const user=auth.currentUser;
  if(!user||user.isAnonymous)throw new Error('Sign in to verify your email address.');
  if(user.emailVerified)return {alreadyVerified:true};
  const settings=verificationActionSettings();
  try{
    await (settings?a.sendEmailVerification(user,settings):a.sendEmailVerification(user));
  }catch(error){
    if(settings&&/continue-uri|unauthorized/i.test(String(error?.code||''))){
      await a.sendEmailVerification(user);
    }else{
      throw error;
    }
  }
  return {sent:true};
}
export async function refreshAuthUser(){
  const {auth}=await backend();
  await auth.authStateReady();
  const user=auth.currentUser;
  if(!user||user.isAnonymous)throw new Error('Sign in to continue.');
  await user.reload();
  await user.getIdToken(true);
  return {emailVerified:Boolean(auth.currentUser?.emailVerified),user:auth.currentUser};
}
export async function resetPassword(email=''){
  const cleanEmail=String(email||'').trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail))throw new Error('Enter your email address above first, then tap Forgot password.');
  const {a,auth}=await backend();
  await a.sendPasswordResetEmail(auth,cleanEmail);
}
export async function observeSettings(onData,onError){return observePublic('settings',v=>onData(normalizeSettings(v)),onError);}
export async function saveSettings(value){const r=await callBackend('saveStoreData',{kind:'settings',value:normalizeSettings(value)});void refreshPublicStore();return r;}
export async function observeArtists(onData,onError){return observePublic('artists',v=>onData(normalizeArtists(v)),onError);}
export async function saveArtists(value){const r=await callBackend('saveStoreData',{kind:'artists',value:normalizeArtists(value)});void refreshPublicStore();return r;}
export async function observeContent(onData,onError){return observePublic('content',v=>onData(normalizeContent(v)),onError);}
export async function saveContent(value){const error=validateContent(value);if(error)throw new Error(error);const r=await callBackend('saveStoreData',{kind:'content',value:normalizeContent(value)});void refreshPublicStore();return r;}
export async function observePromos(onData,onError){return observePublic('promos',v=>onData(normalizePromos(v)),onError);}
export async function savePromos(value){const r=await callBackend('saveStoreData',{kind:'promos',value:normalizePromos(value)});void refreshPublicStore();return r;}
export async function observeProducts(admin,onData,onError){
 let publicLoaded=false,lastJson='';
 const emit=rows=>{
   const nextJson=JSON.stringify(rows);
   if(nextJson===lastJson)return;
   lastJson=nextJson;
   onData(rows);
 };
 const stopPublicPromise=observePublic('products',value=>{
   const rows=sortArtworks(Object.entries(value||{}).map(([id,p])=>normalizeProduct({...p,id})));
   publicLoaded=true;
   emit(rows);
 },err=>{if(!publicLoaded)onError(err);}).catch(err=>{if(!publicLoaded)onError(err);return ()=>{};});
 if(!admin)return stopPublicPromise;
 let active=true;
 const refresh=async()=>{
   try{
     const rows=await callBackend('listProducts');
     if(active&&Array.isArray(rows)){const sorted=sortArtworks(rows.map(normalizeProduct));adminProducts=sorted;publicLoaded=true;emit(sorted);}
   }catch(error){
     if(active&&!publicLoaded)onError(error);
   }
 };
 productListeners.add(refresh);
 void refresh();
 const timer=setInterval(()=>{if(typeof document==='undefined'||document.visibilityState==='visible')void refresh();},60000);
 return async()=>{active=false;clearInterval(timer);productListeners.delete(refresh);const stopPub=await stopPublicPromise;stopPub?.();};
}
export async function saveProduct(product,id){
  const existingUpdatedAt=id?(adminProducts.find(p=>p.id===id)?.updatedAt??product?.updatedAt??null):null;
  const result=await callBackend('saveProduct',{product,id:id||null,expectedUpdatedAt:existingUpdatedAt});
  try{localStorage.removeItem('silly-public-v2:products');}catch{}
  void refreshPublicStore();
  for(const refresh of productListeners)await refresh();
  return result.id;
}
export async function archiveProduct(id){
  await callBackend('archiveProduct',{id});
  try{localStorage.removeItem('silly-public-v2:products');}catch{}
  void refreshPublicStore();
  for(const refresh of productListeners)await refresh();
}
export async function deleteProduct(id){
  await callBackend('deleteProduct',{id});
  try{localStorage.removeItem('silly-public-v2:products');}catch{}
  void refreshPublicStore();
  for(const refresh of productListeners)await refresh();
}
export async function uploadImage(file){return encodeImage(file);}
export async function setProductImageStorage(mode){return callBackend('setProductImageStorage',{mode});}
export async function uploadProductImage(file,provider='freeimage'){
  if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>20*1024*1024||!file.size)throw new Error('Choose a JPG, PNG or WebP artwork photo under 20 MB.');
  if(provider!=='freeimage')throw new Error('Invalid artwork image storage option.');
  const {auth,app}=await backend();await auth.authStateReady();
  if(!auth.currentUser||auth.currentUser.isAnonymous)throw new Error('Sign in as an administrator to upload artwork.');
  for(let attempt=0;attempt<2;attempt++){
    const headers={'Content-Type':file.type,'X-Firebase-Project':firebaseConfig.projectId,Authorization:'Bearer '+await auth.currentUser.getIdToken(attempt===1)};
    if(APP_CHECK_SITE_KEY){const check=await import('https://www.gstatic.com/firebasejs/12.3.0/firebase-app-check.js');let instance;try{instance=check.getAppCheck(app);}catch{instance=check.initializeAppCheck(app,{provider:new check.ReCaptchaEnterpriseProvider(APP_CHECK_SITE_KEY),isTokenAutoRefreshEnabled:true});}headers['X-Firebase-AppCheck']=(await check.getToken(instance)).token;}
    const response=await fetch(`${backendURL()}/api/uploadFreeimageImage`,{method:'POST',headers,body:file,signal:AbortSignal.timeout(120000)});
    const result=await response.json();if(response.status===401&&attempt===0)continue;
    if(!response.ok){const error=new Error(result.error?.message||'Artwork image upload failed.');error.code=result.error?.code;throw error;}
    return result.data.url;
  }
}
export async function saveCheckout(id,customer,cart,displayedProducts,customizations=[],payAtCheckout=false,promoCode=''){
 const invalid=validateCustomer(customer);if(invalid)throw new Error(invalid);const {auth}=await backend();await auth.authStateReady();if(!auth.currentUser||auth.currentUser.isAnonymous)throw new Error('Sign in before checkout.');
 const extras=await prepareCustomizations(id,auth.currentUser.uid,customizations);
 return callBackend('createRequest',{requestId:id,customer,cart:cart.map(item=>{const matched=displayedProducts.find(p=>p.id===item.id);return {id:item.id,quantity:item.quantity,...(item.attachmentId?{attachmentId:item.attachmentId}:{}),unitPrice:matched?.unitPrice??matched?.price};}),customizations:extras,payAtCheckout,promoCode:String(promoCode||'').trim().toUpperCase()});
}
async function prepareCustomizations(requestId,uid,customizations) {
  const result=[];
  for(const entry of customizations){
    if(entry.files.length>3||entry.note.length>1000)throw new Error('Use up to 3 reference images and 1,000 characters per product.');
    const images=[];
    for(const item of entry.files){
      images.push(await encodeImage(item.file));
    }
    result.push({uid,productId:entry.productId,note:entry.note.trim(),images});
  }
  return result;
}
export async function loadCustomizations(id){return callBackend('loadCustomizations',{requestId:id});}
export async function referenceImageURL(value){if(!isInlineImage(value))throw new Error('This older image needs migration by the studio.');return value;}
export async function loadRequests(cursor=null,{paginated=false}={}){return callBackend('loadRequests',paginated?{paginated:true,cursor}:{});}
export async function updateRequest(id,status){return callBackend('updateOrderStatus',{requestId:id,status});}
export async function deleteOrder(id){return callBackend('deleteOrder',{requestId:id});}
export async function deleteAllOrders(confirm){return callBackend('deleteAllOrders',{confirm});}
export async function markLabelsPrinted(requestIds,reset=false){return callBackend('markLabelsPrinted',{requestIds,reset});}
export async function observeCustomerOrdersSignal(uid,onSignal,onError){
  if(!uid)return ()=>{};
  const {r,db}=await realtimeBackend();
  return r.onValue(r.ref(db,`customers/${uid}/ordersSync`),snapshot=>onSignal(snapshot.val()||null),onError);
}
export async function loadCustomerRequests(cursor=null){return callBackend('loadCustomerRequests',{cursor});}
export async function loadProfile(){return callBackend('getProfile');}
export async function saveProfile(profile){return callBackend('saveProfile',{profile});}
export async function exportMyData(){return callBackend('exportMyData',{});}
export async function deleteMySavedData(){return callBackend('deleteMySavedData',{});}
export async function deleteMyAccount(confirm){return callBackend('deleteMyAccount',{confirm});}
export async function loadLabel(){return callBackend('getLabels');}
export async function saveLabel(text){return callBackend('saveStoreData',{kind:'labels',value:text});}
export async function loadSales(){return callBackend('loadSales');}
export async function cancelRequest(id,reason){return callBackend('cancelRequest',{requestId:id,reason});}
export async function observePublicReviews(onData,onError){return observePublic('reviews',v=>onData(Array.isArray(v)?v:(v&&typeof v==='object'?Object.values(v):[])),onError);}
export async function saveOrderTracking(requestId,tracking={}){return callBackend('saveOrderTracking',{requestId,...tracking});}
export async function issueRazorpayRefund(payload){return callBackend('issueRazorpayRefund',payload);}
export async function uncancelOrder(requestId){return callBackend('uncancelOrder',{requestId});}
export async function submitCustomerReview(payload){return callBackend('submitCustomerReview',payload);}
export async function loadMyReviews(){return callBackend('loadMyReviews',{});}
export async function loadCustomerReviewsAdmin(){return callBackend('loadCustomerReviewsAdmin',{});}
export async function moderateCustomerReview(reviewId,decision){return callBackend('moderateCustomerReview',{reviewId,decision});}
export async function loadAdminAudit(){return callBackend('loadAdminAudit',{});}
export async function trackBagSnapshot(payload={}){
  if(Date.now()<bagTrackBackoffUntil)return;
  try{
    const headers={'Content-Type':'application/json'};
    if(sdk?.auth?.currentUser&&!sdk.auth.currentUser.isAnonymous){
      const tok=await sdk.auth.currentUser.getIdToken().catch(()=>'');
      if(tok)headers.Authorization='Bearer '+tok;
    }
    const res=await fetch(backendURL()+'/cart-track',{method:'POST',headers,body:JSON.stringify(payload),keepalive:true,signal:AbortSignal.timeout(8000)});
    if(res.status===429)bagTrackBackoffUntil=Date.now()+60000;
  }catch{}
}
export async function observeStockSchedule(onData,onError){
  return observePublic('stockSchedule',v=>onData(v&&typeof v==='object'?v:null),onError);
}
export async function refreshPublicStoreNow(){
  try{
    localStorage.removeItem('silly-public-v2:products');
    localStorage.removeItem('silly-public-v2:stockSchedule');
  }catch{}
  try{await fetchPublicStore({force:true});}catch{}
}
export async function triggerStockRefreshCheck(){
  try{
    const res=await fetch(backendURL()+'/stock-refresh-check',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(15000)});
    if(!res.ok)return null;
    return await res.json();
  }catch{return null;}
}
export async function trackSiteEvent(payload={}){
  if(Date.now()<siteTrackBackoffUntil)return;
  try{
    const res=await fetch(backendURL()+'/site-track',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),keepalive:true,signal:AbortSignal.timeout(6000)});
    if(res.status===429)siteTrackBackoffUntil=Date.now()+60000;
  }catch{}
}
export async function callBackend(name,data={}){
 const {auth,app}=await backend();await auth.authStateReady();if(!auth.currentUser)throw new Error('Sign in to continue.');
 const url=backendURL()+'/api/'+encodeURIComponent(name);
 for(let attempt=0;attempt<2;attempt++){
 const headers={'Content-Type':'application/json','X-Firebase-Project':firebaseConfig.projectId,Authorization:'Bearer '+await auth.currentUser.getIdToken(attempt===1)};
 if(APP_CHECK_SITE_KEY){const check=await import('https://www.gstatic.com/firebasejs/12.3.0/firebase-app-check.js');let instance;try{instance=check.getAppCheck(app);}catch{instance=check.initializeAppCheck(app,{provider:new check.ReCaptchaEnterpriseProvider(APP_CHECK_SITE_KEY),isTokenAutoRefreshEnabled:true});}headers['X-Firebase-AppCheck']=(await check.getToken(instance)).token;}
 let response;try{response=await fetch(url,{method:'POST',headers,body:JSON.stringify(data),signal:AbortSignal.timeout(name==='currentUser'?8000:60000)});}catch{throw new Error('The studio service could not be reached. Refresh your requests before retrying.');}
 const result=await response.json();if(response.status===401&&attempt===0)continue;
 if(!response.ok){const error=new Error(result.error?.message||'The studio service could not complete this operation.');error.code=result.error?.code;error.status=response.status;throw error;}return result.data;
 }
}
export function friendlyError(error){
  const code=error?.code||'';
  if(code==='permission-denied')return error.message||'Your account does not have access to this action.';
  if(code==='auth/popup-closed-by-user'||code==='auth/popup-blocked')return 'Sign-in popup was closed or blocked by your browser. Tap "Popup blocked? Sign in with redirect" below to continue.';
  if(code==='auth/invalid-email')return 'Please enter a valid email address.';
  if(code==='auth/user-disabled')return 'This account has been disabled. Please contact the studio.';
  if(code==='auth/user-not-found'||code==='auth/wrong-password'||code==='auth/invalid-credential')return 'Incorrect email or password. Double-check your details or switch to Create account.';
  if(code==='auth/email-already-in-use'||code==='auth/credential-already-in-use')return 'An account with this email already exists. Switch to Sign in instead.';
  if(code==='auth/weak-password')return 'Password must be at least 6 characters long.';
  if(code==='auth/too-many-requests')return 'Too many attempts. Please wait a minute and try again.';
  if(code==='auth/operation-not-allowed')return 'Email & password sign-in needs to be enabled in Firebase Console (Authentication → Sign-in method → Email/Password).';
  return error?.message||'Something went wrong. Please retry.';
}

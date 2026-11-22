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
function cachedPublic(path,onData){const key='silly-public-v2:'+path;try{const cache=JSON.parse(localStorage.getItem(key));if(cache&&Date.now()-cache.time<86400000)onData(cache.value);}catch{}return value=>{try{localStorage.setItem(key,JSON.stringify({time:Date.now(),value}));}catch{}onData(value);};}
async function observePublic(path,onData,onError){const publish=cachedPublic(path,onData);const {r,db}=await realtimeBackend();return r.onValue(r.ref(db,'publicStore/'+path),snapshot=>publish(snapshot.val()||{}),onError);}
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
    a.sendEmailVerification(result.user).catch(()=>{});
  }
  return result;
}
export async function resetPassword(email=''){
  const cleanEmail=String(email||'').trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail))throw new Error('Enter your email address above first, then tap Forgot password.');
  const {a,auth}=await backend();
  await a.sendPasswordResetEmail(auth,cleanEmail);
}
export async function observeSettings(onData,onError){return observePublic('settings',v=>onData(normalizeSettings(v)),onError);}
export async function saveSettings(value){return callBackend('saveStoreData',{kind:'settings',value:normalizeSettings(value)});}
export async function observeArtists(onData,onError){return observePublic('artists',v=>onData(normalizeArtists(v)),onError);}
export async function saveArtists(value){return callBackend('saveStoreData',{kind:'artists',value:normalizeArtists(value)});}
export async function observeContent(onData,onError){return observePublic('content',v=>onData(normalizeContent(v)),onError);}
export async function saveContent(value){const error=validateContent(value);if(error)throw new Error(error);return callBackend('saveStoreData',{kind:'content',value:normalizeContent(value)});}
export async function observePromos(onData,onError){return observePublic('promos',v=>onData(normalizePromos(v)),onError);}
export async function savePromos(value){return callBackend('saveStoreData',{kind:'promos',value:normalizePromos(value)});}
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
 const timer=setInterval(refresh,30000);
 return async()=>{active=false;clearInterval(timer);productListeners.delete(refresh);const stopPub=await stopPublicPromise;stopPub?.();};
}
export async function saveProduct(product,id){
  const existingUpdatedAt=id?(adminProducts.find(p=>p.id===id)?.updatedAt??product?.updatedAt??null):null;
  const result=await callBackend('saveProduct',{product,id:id||null,expectedUpdatedAt:existingUpdatedAt});
  try{localStorage.removeItem('silly-public-v2:products');}catch{}
  for(const refresh of productListeners)await refresh();
  return result.id;
}
export async function archiveProduct(id){
  await callBackend('archiveProduct',{id});
  try{localStorage.removeItem('silly-public-v2:products');}catch{}
  for(const refresh of productListeners)await refresh();
}
export async function deleteProduct(id){
  await callBackend('deleteProduct',{id});
  try{localStorage.removeItem('silly-public-v2:products');}catch{}
  for(const refresh of productListeners)await refresh();
}
export async function uploadImage(file){return encodeImage(file);}
export async function saveCheckout(id,customer,cart,displayedProducts,customizations=[],payAtCheckout=false,promoCode=''){
 const invalid=validateCustomer(customer);if(invalid)throw new Error(invalid);const {auth}=await backend();await auth.authStateReady();if(!auth.currentUser||auth.currentUser.isAnonymous)throw new Error('Sign in before checkout.');
 const extras=await prepareCustomizations(id,auth.currentUser.uid,customizations);
 return callBackend('createRequest',{requestId:id,customer,cart:cart.map(item=>({id:item.id,quantity:item.quantity,unitPrice:displayedProducts.find(p=>p.id===item.id)?.price})),customizations:extras,payAtCheckout,promoCode:String(promoCode||'').trim().toUpperCase()});
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
export async function loadRequests(){return callBackend('loadRequests');}
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
export async function loadLabel(){return callBackend('getLabels');}
export async function saveLabel(text){return callBackend('saveStoreData',{kind:'labels',value:text});}
export async function loadSales(){return callBackend('loadSales');}
export async function cancelRequest(id,reason){return callBackend('cancelRequest',{requestId:id,reason});}
export async function callBackend(name,data={}){
 const {auth,app}=await backend();await auth.authStateReady();if(!auth.currentUser)throw new Error('Sign in to continue.');
 const url=backendURL()+'/api/'+encodeURIComponent(name);
 for(let attempt=0;attempt<2;attempt++){
 const headers={'Content-Type':'application/json','X-Firebase-Project':firebaseConfig.projectId,Authorization:'Bearer '+await auth.currentUser.getIdToken(attempt===1)};
 if(APP_CHECK_SITE_KEY){const check=await import('https://www.gstatic.com/firebasejs/12.3.0/firebase-app-check.js');let instance;try{instance=check.getAppCheck(app);}catch{instance=check.initializeAppCheck(app,{provider:new check.ReCaptchaEnterpriseProvider(APP_CHECK_SITE_KEY),isTokenAutoRefreshEnabled:true});}headers['X-Firebase-AppCheck']=(await check.getToken(instance)).token;}
 let response;try{response=await fetch(url,{method:'POST',headers,body:JSON.stringify(data),signal:AbortSignal.timeout(name==='currentUser'?8000:60000)});}catch{throw new Error('The studio service could not be reached. Refresh your requests before retrying.');}
 const result=await response.json();if(response.status===401&&attempt===0)continue;
 if(!response.ok){const error=new Error(result.error?.message||'The studio service could not complete this operation.');error.code=result.error?.code;throw error;}return result.data;
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

import {selectedCartLines,cartIssues,pruneCart} from './cart-state.js';
import {invoicePDF,downloadFile} from './downloads.js?v=invoice-2026-10-21-2';
import {ORDER_STATUSES,availableStatuses,canTransition,statusHelp} from './order-workflow.js';
import {openQuoteEditor} from './quote-editor.js';
import './image-loading.js';
import {pageSkeleton,skeletonMarkup} from './skeletons.js';
import {deferPageRender} from './page-loading.js';
import {mountSalesDashboard} from './sales-dashboard.js';
import {payRequest,preloadRazorpay} from './payments.js';
import {mountReviewEditor,collectReviews} from './review-editor.js';
import {MAX_CART_ITEMS,CATEGORIES,categoryOf,money,SHIPPING_CHARGE,shippingPaiseForQuantity,totalWithShipping,artworkColorFor,artworkThemeStyle,contrastColorFor,normalizeProduct,sortArtworks,ARTWORK_SORT_MODES,escapeHTML as e,safeImage,cartLines,subtotal,filterProducts,validateCustomer} from './commerce.js';
import {DEFAULT_ARTISTS,artistSlug,normalizeArtists,mergeArtistsWithProducts} from './artists.js';
import * as store from './store.js';
import {mapPanel,mountDeliveryMap} from './delivery-location.js';
import {validLocation,locationLink} from './location-utils.js';
import {openLabel,openBatchLabels,mountLabelTemplate} from './labels.js';
import {mountOrdersMap} from './orders-map.js';
import {POLICY_TABS,normalizeAdminTab,countActionableOrders,adminSidebarMarkup,policySubnavMarkup,filterOrders,orderFilterCounts,ordersToolbarMarkup,orderCardMarkup} from './admin-ui.js';
import {decorateCartButtons,animateCart,animateCartCheckout,playPaymentOutcome,preloadPaymentOutcomeSvg,reviewSection,mountReviews,mountHeroBanner,mountArtistScrollPrompt,sampleArtworkBgFromImage} from './shop-effects.js';
import {accountMarkup,ordersListMarkup} from './customer-dashboard.js';
import {steppedProgress} from './stepped-progress.js';
import {normalizeProfile,validateProfile,checkoutDefaults} from './profile.js';
import {logoutMarkup,mountLogout,animateLogout} from './logout.js';
import {DEFAULT_SETTINGS,FALLBACK_BANNER_ARTWORKS,normalizeSettings,safeStoreLink,bannerMarkup,settingsForm} from './store-settings.js';
import {DEFAULT_CONTENT,normalizeContent,contentCategories,applyStoreContent,footerMarkup} from './store-content.js';
import {homeMarkup,homeFilterPanelMarkup,artistsPageMarkup,artistDetailMarkup,storyMarkup,infoMarkup,productCardMarkup} from './storefront-view.js';
import {mountContentEditor} from './content-editor.js';
import {mountSitePreviewPanel,openSitePreviewModal} from './site-preview.js';
import {mountArtistStudio} from './artist-studio.js';
import {randomId,customizationFields,setProductNote,addReferences,removeReference,refreshReferencePreviews,clearCustomization,checkoutCustomizations,clearCustomizations} from './customization.js';
import {DEFAULT_PROMOS,normalizePromos,calculateDiscounts,nextBundleHint} from './promotions.js';
import {mountHomeLayoutEditor} from './home-layout-editor.js';
import {mountPromosAdmin} from './promos-admin.js';
import {mountBackupExport} from './backup-export.js';
import {hamsterLoaderMarkup} from './hamster-loader.js';
import {mountLiveSiteEditor} from './live-site-editor.js';
import {flashControl} from './inline-edit.js';
let storeSettings={...DEFAULT_SETTINGS};
let settingsReady=true,settingsError='';
let siteContent=normalizeContent(DEFAULT_CONTENT),contentDraft=null,contentEditor=null,contentReady=true,contentError='';
let storePromos={...DEFAULT_PROMOS};
let appliedPromoCode='',promoFeedback='';
let requestedAdminPage=location.hash.startsWith('#admin/')?location.hash.slice(1):'admin';
let deliveryMap,stopReviews=()=>{},stopHeroBanner=()=>{},stopArtistPrompt=()=>{};

const $ = id => document.getElementById(id);
document.querySelector('.skip-link').addEventListener('click',event=>{event.preventDefault();$('main').focus();$('main').scrollIntoView({behavior:'instant'});});
const cartKey = 'silly-shop-cart-v1';
const pendingCheckoutKey='silly-shop-pending-payment-v1';
const STARTER_PRODUCTS = FALLBACK_BANNER_ARTWORKS.map((item, idx) => normalizeProduct({...item, displayOrder: idx + 1, stock: 1, visible: true}));
let products = [...STARTER_PRODUCTS], artists = [...DEFAULT_ARTISTS], cart = [], user = null, isAdmin = false, catalogReady = true, catalogSynced = false, catalogError = '', unsubscribeProducts, catalogGeneration = 0;
let filter = {sort:'',available:false,discounted:false,productType:'',search:''}, adminTab = 'products', adminSearch = '', adminCategory = '';
let requestList = [], requestsLoaded = false, requestsError = '', editingId = null, editingImages = [], editingArtistId = null, artistPromptDismissed = false;
const selectedLabelOrders = new Set();
let cartCleanupNotes = [], smoothCheckoutNav = false;
let ordersMapController = null, labelTemplateController = null, settingsDirty = false;
let artistStudioController = null, settingsPreviewController = null, productsPreviewController = null, modalPreviewController = null, productsPreviewOpen = false, bannerPreviewObjectUrl = '';
let promosAdminController = null, homeLayoutController = null;
let activePolicyTab = 'contact', orderSearch = '', orderStatusFilter = 'all';
let highlightedOrderId = null, inlinePriceEditId = null;
const expandedOrderIds = new Set();
const previousPositiveStock = new Map();
const rememberedProducts=new Map();
let checkoutProducts=[];
let checkoutDraft = {}, checkoutId = randomId(), completedRequest = null, submitting = false, paymentSceneActive = false, checkoutStep = 1, lastRenderedPage = '', activeProductTab = 'desc';
function isAnimationPlaying() {
  return paymentSceneActive || Boolean(document.querySelector(
    '.cart-button[aria-busy="true"], .cart-checkout-flow.is-checking-out, .pos-transaction-container.is-animating, .logoutButton.clicked, .payment-outcome-scene'
  ));
}
const checkoutTouched=new Set();
let checkoutStepMotionToken=0,checkoutStepAnimations=[];
let toastTimer, orderNote = '';
let authLoading=true,authError='',accountState={requests:[],profile:{},loaded:false,loading:false,orderFilter:'all',orderQuery:''},profileDraftLocation=undefined;
try {const saved = JSON.parse(localStorage.getItem(cartKey)); if (Array.isArray(saved)) cart = saved.filter(c=>c && typeof c.id==='string' && Number.isInteger(c.quantity) && c.quantity>0).slice(0,MAX_CART_ITEMS);} catch {}
const visible = () => sortArtworks(products.filter(p=>p.visible && !p.archived), storeSettings.artworkSort || 'manual');
const imageOf = p => safeImage(p.images?.[0],categoryOf(p.category)?.image);
const route = () => {const parts=location.hash.slice(1).split('/');return {page:parts[0] || 'home',id:parts.slice(1).join('/')};};
let categoryLinks = `<a href="#home">Home &amp; Banner</a><a href="#shop">All Artworks</a><a href="#artists">Artists</a><a href="#about">About hehe.cafe</a>`;
$('collection-menu').innerHTML=categoryLinks;
$('mobile-menu').innerHTML=`<a href="#home">Home</a><a href="#shop">All artworks</a><a href="#artists">Artists</a><a href="#about">About hehe.cafe</a><a href="#account">My account</a>`;
$('footer').innerHTML=footerMarkup(siteContent);
document.body.dataset.cartBtnMode = storeSettings.cartButtonMode || 'black';

function toast(message) {clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,5000);}
let busyDepth=0;
function setBusyOverlay(active,message='Saving changes…'){
  let overlay=$('admin-saving-overlay');
  if(active){
    busyDepth+=1;
    if(!overlay){
      overlay=document.createElement('div');
      overlay.id='admin-saving-overlay';
      overlay.className='saving-overlay';
      overlay.setAttribute('role','status');
      overlay.setAttribute('aria-live','polite');
      overlay.innerHTML=`<div class="saving-overlay-card">${hamsterLoaderMarkup({size:'md',label:message})}<span class="saving-overlay-text"></span></div>`;
    }
    const host=document.querySelector('dialog[open]')||document.body;
    if(overlay.parentElement!==host)host.append(overlay);
    const label=overlay.querySelector('.saving-overlay-text');
    if(label)label.textContent=message;
    overlay.hidden=false;
    requestAnimationFrame(()=>overlay.classList.add('is-visible'));
    return;
  }
  busyDepth=Math.max(0,busyDepth-1);
  if(busyDepth===0&&overlay){
    overlay.classList.remove('is-visible');
    overlay.hidden=true;
    if(overlay.parentElement&&overlay.parentElement!==document.body)document.body.append(overlay);
  }
}
async function withSavingOverlay(message,fn){
  setBusyOverlay(true,message);
  try{return await fn();}
  finally{setBusyOverlay(false);}
}
function createLoaderController(){
  let visible=false;
  return {
    show(message){
      if(!visible){
        visible=true;
        setBusyOverlay(true,message);
        return;
      }
      const label=$('admin-saving-overlay')?.querySelector('.saving-overlay-text');
      if(label)label.textContent=message;
    },
    hide(){
      if(!visible)return;
      visible=false;
      setBusyOverlay(false);
    }
  };
}
function persistCart(){try{localStorage.setItem(cartKey,JSON.stringify(cart));}catch{toast('Your browser could not save the cart. Keep this tab open.');}updateCartBadge();}
function clearPendingCheckout(){try{localStorage.removeItem(pendingCheckoutKey);}catch{}}
function lines(){return selectedCartLines(cart,products,[...rememberedProducts.values()]);}
function bagPricing(entries=lines()){
  const subtotalPaise=Math.round(subtotal(entries)*100);
  const totalQty=entries.reduce((sum,item)=>sum+item.quantity,0);
  const baseShippingPaise=shippingPaiseForQuantity(totalQty);
  const pricing=calculateDiscounts({
    subtotalPaise,
    totalQty,
    shippingPaise:baseShippingPaise,
    promoCode:appliedPromoCode,
    promos:storePromos
  });
  return {...pricing,totalQty,baseShippingPaise,itemDuePaise:pricing.totalPaise};
}
function bagOffersMarkup(entries,pricing,context='cart'){
  const totalQty=entries.reduce((sum,item)=>sum+item.quantity,0);
  const hint=nextBundleHint(totalQty,storePromos);
  const bundleHtml=pricing.bundleDiscountPaise>0
    ?`<div class="bundle-savings-pill is-unlocked"><strong>Bundle unlocked · −${money(pricing.bundleDiscountPaise/100)}</strong><span>${e(pricing.bundleLabel||'Multi-artwork bundle')} applied automatically</span></div>`
    :(hint?`<div class="bundle-savings-pill"><strong>Add ${hint.remaining} more ${hint.remaining===1?'artwork':'artworks'} to unlock bundle pricing</strong><span>${e(hint.label)}</span></div>`:'');
  const codeStatus=pricing.appliedCode&&!pricing.promoError
    ?`<p class="promo-feedback is-ok"><strong>${e(pricing.appliedCode)}</strong> applied${pricing.freeShipping?' · Free India Post shipping':pricing.codeDiscountPaise?` · −${money(pricing.codeDiscountPaise/100)} off`:''}</p>`
    :((pricing.promoError||promoFeedback)?`<p class="promo-feedback is-err">${e(pricing.promoError||promoFeedback)}</p>`:'');
  return `${bundleHtml}<div class="promo-code-box"><label class="promo-code-label" for="${context}-promo-input"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2M13 17v2M13 11v2"/></svg><span>Promo or studio code</span></label><div class="promo-code-row"><input id="${context}-promo-input" type="text" maxlength="24" autocomplete="off" placeholder="Enter code (e.g. HEHE10)" value="${e(appliedPromoCode)}"><button type="button" class="button outline small" data-action="apply-promo" data-context="${context}">Apply</button>${(appliedPromoCode||pricing.appliedCode)?'<button type="button" class="text-link" data-action="remove-promo">Remove</button>':''}</div>${codeStatus}</div>`;
}
function discountTotalRowsMarkup(pricing,qtyLabel='Artworks subtotal'){
  const rows=[`<div class="total-row"><span>${e(qtyLabel)}</span><strong>${money(pricing.subtotalPaise/100)}</strong></div>`];
  if(pricing.bundleDiscountPaise>0)rows.push(`<div class="total-row is-discount"><span>${e(pricing.bundleLabel||'Bundle savings')}</span><strong>−${money(pricing.bundleDiscountPaise/100)}</strong></div>`);
  if(pricing.codeDiscountPaise>0)rows.push(`<div class="total-row is-discount"><span>Promo (${e(pricing.appliedCode)})</span><strong>−${money(pricing.codeDiscountPaise/100)}</strong></div>`);
  rows.push(`<div class="total-row"><span>India Post shipping (${pricing.totalQty||1} × ₹${SHIPPING_CHARGE})</span><strong>${pricing.freeShipping?`Free <del>${money((pricing.baseShippingPaise||SHIPPING_CHARGE*100)/100)}</del>`:money(pricing.shippingPaise/100)}</strong></div>`);
  rows.push(`<div class="total-row grand"><span>Total</span><strong>${money(pricing.totalPaise/100)}<svg class="checkout-total-sparkle" viewBox="0 0 18 18" aria-hidden="true"><path d="M3 13 11 5M9 14l6-2M5 7l2-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></strong></div>`);
  return rows.join('');
}
function paymentAnimationItems(orderItems,fallbackCart=cart){
  const fallback=fallbackCart.map(({id,quantity})=>{
    const product=checkoutProducts.find(item=>item.id===id)||products.find(item=>item.id===id)||rememberedProducts.get(id);
    return {productId:id,title:product?.title||'Item',quantity};
  });
  const source=Array.isArray(orderItems)&&orderItems.length?orderItems:fallback;
  return source.slice(0,MAX_CART_ITEMS).map(item=>{
    const savedProduct=fallback.find(candidate=>candidate.productId===item?.productId);
    return {title:String(item?.title||item?.name||savedProduct?.title||'Item'),quantity:Number.isInteger(item?.quantity)&&item.quantity>0?item.quantity:savedProduct?.quantity||1};
  });
}
function cartCleanupBannerMarkup(){
  if(!cartCleanupNotes.length)return '';
  return `<div class="cart-cleanup-note" role="status"><div class="cart-cleanup-note-body"><strong>Bag updated</strong><ul>${cartCleanupNotes.map(note=>`<li>${e(note)}</li>`).join('')}</ul></div><button type="button" class="icon-button cart-cleanup-dismiss" data-action="dismiss-cart-notice" aria-label="Dismiss bag notice"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button></div>`;
}
function updateCartBadge(){const count=cart.reduce((n,c)=>n+c.quantity,0);$('cart-count').textContent=count;$('cart-count').hidden=!count;if($('cart-header-count')){$('cart-header-count').textContent=count;$('cart-header-count').hidden=!count;}}
function reconcileCart(){
  if(submitting||paymentSceneActive){updateCartBadge();return;}
  if(catalogSynced&&catalogReady&&!catalogError&&products.length&&cart.length){
    const {cart:cleaned,changed,notes,removedIds}=pruneCart(cart,products,[...rememberedProducts.values()]);
    if(changed){
      removedIds.forEach(id=>clearCustomization(id));
      cart=cleaned;persistCart();
      for(const note of notes){if(!cartCleanupNotes.includes(note))cartCleanupNotes.push(note);}
      if(notes.length&&!submitting)toast(notes[0]);
      if($('cart-dialog')?.open)renderCart();
      if(route().page==='checkout'&&!submitting&&!paymentSceneActive){captureCheckout();renderCheckout();}
    }
  }
  updateCartBadge();updateCheckoutAvailability();
}
function updateCheckoutAvailability(){
  if(!$('checkout-form')||submitting||paymentSceneActive)return;
  const issues=cartIssues(cart,products,checkoutProducts),notice=$('checkout-availability');
  const messages=catalogError?['Availability could not refresh. Your cart and delivery details are saved. Retry before submitting.']:!catalogReady?['Checking current availability…']:issues;
  if(notice){notice.textContent=messages.join(' ');notice.hidden=!messages.length;}
  const review=$('review-checkout-cart');if(review)review.hidden=!messages.length;
  const submit=$('checkout-submit');if(submit)submit.disabled=submitting||messages.length>0;
}
function openDialog(id){
  const dialog=$(id);if(!dialog)return;
  clearTimeout(dialog._closeTimer);
  dialog.classList.remove('is-closing');
  if(!dialog.open){
    dialog.classList.remove('is-open');
    dialog.showModal();
    requestAnimationFrame(()=>requestAnimationFrame(()=>{if(dialog.open)dialog.classList.add('is-open');}));
  }else{
    dialog.classList.add('is-open');
  }
}
function closeDialog(dialog,{immediate=false}={}){
  if(!dialog||!dialog.open)return Promise.resolve();
  clearTimeout(dialog._closeTimer);
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(immediate||!dialog.classList.contains('cart-drawer')||reducedMotion){
    dialog.classList.remove('is-open','is-closing');
    dialog.close();
    return Promise.resolve();
  }
  dialog.classList.remove('is-open');
  dialog.classList.add('is-closing');
  return new Promise(resolve=>{
    const finish=()=>{
      clearTimeout(dialog._closeTimer);
      dialog.removeEventListener('transitionend',onEnd);
      dialog.classList.remove('is-closing');
      if(dialog.open)dialog.close();
      resolve();
    };
    const onEnd=ev=>{if(ev.target===dialog&&ev.propertyName==='transform')finish();};
    dialog.addEventListener('transitionend',onEnd);
    dialog._closeTimer=setTimeout(finish,340);
  });
}
function closeDialogs(opts){return Promise.all([...document.querySelectorAll('dialog[open]')].map(d=>closeDialog(d,opts)));}
$('cart-dialog')?.addEventListener('cancel',event=>{event.preventDefault();closeDialog($('cart-dialog'));});
function quantityControl(id,value,max,context='cart'){return `<div class="quantity"><button type="button" data-action="quantity" data-id="${e(id)}" data-context="${context}" data-delta="-1" aria-label="Decrease quantity" ${value<=1?'disabled':''}><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg></button><input type="number" aria-label="${context==='product'?'Quantity':`Quantity for ${products.find(p=>p.id===id)?.title || 'item'}`}" value="${value}" min="1" max="${Math.min(99,max)}" data-quantity="${e(id)}" data-context="${context}"><button type="button" data-action="quantity" data-id="${e(id)}" data-context="${context}" data-delta="1" aria-label="Increase quantity" ${value>=Math.min(99,max)?'disabled':''}><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg></button></div>`;}
function addToCart(id,quantity=1,open=true){
  const product=visible().find(p=>p.id===id);if(!product || product.stock<1)return toast('This item is sold out.');
  const current=cart.find(c=>c.id===id);const next=(current?.quantity||0)+quantity;
  if(next>Math.min(99,product.stock))return toast(`Only ${product.stock} available. Your cart already has ${current?.quantity||0}.`);
  if(!current && cart.length>=MAX_CART_ITEMS)return toast(`You can add up to ${MAX_CART_ITEMS} different items.`);
  if(current)current.quantity=next;else cart.push({id,quantity});
  completedRequest=null;checkoutId=randomId();persistCart();renderCart();if(open)openDialog('cart-dialog');
  return true;
}
function renderCart(){
  updateCartBadge();
  if(cart.length&&!catalogReady){$('cart-content').innerHTML=catalogError?catalogErrorMarkup():skeletonMarkup('rows','Loading your art bag…');return;}
  const entries=lines();
  const cleanupBanner=cartCleanupBannerMarkup();
  if(!entries.length){$('cart-content').innerHTML=`${cleanupBanner}<div class="empty-state"><span class="empty-icon">✦</span><h2>Your art bag is empty</h2><p>Browse hehe.cafe to collect an original artwork.</p><a href="#home" class="button" data-action="close-dialog">Explore artworks</a></div>`;return;}
  const pricing=bagPricing(entries);
  const bagTotal=pricing.totalPaise/100;
  const rows=entries.map(({product:p,quantity,total})=>`<div class="cart-row"><a class="cart-thumb-ring" href="#product/${e(p.id)}" data-action="close-dialog"><img src="${e(imageOf(p))}" alt="${e(p.title)}"></a><div class="cart-row-main"><div class="cart-row-head"><div><h3><a href="#product/${e(p.id)}" data-action="close-dialog">${e(p.title)}</a></h3><p class="cart-artist-meta">by ${e(p.artist||'Suprita Chatterjee')}</p></div><span class="cart-price-pill">${money(total)}</span></div><div class="cart-row-tools">${quantityControl(p.id,quantity,Math.max(quantity,p.stock))}<button class="remove-button" data-action="remove" data-id="${e(p.id)}" aria-label="Remove ${e(p.title)}">Remove</button></div></div></div>`).join('');
  const ticket=`<div class="cart-ticket-card"><div class="cart-ticket-left"><div class="cart-ticket-row"><span>Artworks subtotal</span><strong>${money(pricing.subtotalPaise/100)}</strong></div>${pricing.bundleDiscountPaise>0?`<div class="cart-ticket-row is-saving"><span>${e(pricing.bundleLabel||'Bundle savings')}</span><strong>−${money(pricing.bundleDiscountPaise/100)}</strong></div>`:''}${pricing.codeDiscountPaise>0?`<div class="cart-ticket-row is-saving"><span>Promo (${e(pricing.appliedCode)})</span><strong>−${money(pricing.codeDiscountPaise/100)}</strong></div>`:''}<div class="cart-ticket-row"><span>India Post shipping (${pricing.totalQty} × ₹${SHIPPING_CHARGE})</span><strong>${pricing.freeShipping?'Free':money(pricing.shippingPaise/100)}</strong></div><div class="cart-ticket-total"><small>Total</small><strong>INR ${e(money(bagTotal).replace(/^₹/,''))}</strong></div></div><div class="cart-ticket-collage" aria-hidden="true">${entries.slice(0,3).map(({product:p})=>`<img src="${e(imageOf(p))}" alt="">`).join('')}</div></div>`;
  $('cart-content').innerHTML=`<div class="cart-checkout-flow cart-dark-sheet"><div class="cart-sheet-handle" aria-hidden="true"></div><div class="cart-checkout-pile"><section class="cart-checkout-card cart-checkout-current">${cleanupBanner}<div class="cart-checkout-items">${rows}</div>${bagOffersMarkup(entries,pricing,'cart')}<label class="cart-note cart-dark-note" for="order-note">Note for hehe.cafe <span class="muted">(optional)</span><textarea id="order-note" maxlength="1000" placeholder="Gift note, framing preference, or delivery instructions…">${e(orderNote)}</textarea></label>${ticket}<p class="small cart-limit-note">Up to ${MAX_CART_ITEMS} artworks per order.</p></section><section class="cart-checkout-card cart-checkout-confirmed" aria-hidden="true"><span class="cart-checkout-ready-icon" aria-hidden="true"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 13l4 4L19 7"/></svg></span><h2>Opening checkout…</h2><p>Confirm your address to complete your order.</p></section></div><button class="cart-checkout-button cart-pill-checkout" type="button" data-action="cart-checkout"><svg class="cart-checkout-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.1 11.5a2 2 0 0 0 2 1.6h8.7a2 2 0 0 0 2-1.5L22 8H6"/><circle cx="10" cy="20" r="1.2"/><circle cx="18" cy="20" r="1.2"/></svg><span class="cart-checkout-label">Make Payment · ${money(bagTotal)}</span><span class="cart-pill-chevrons" aria-hidden="true"><svg class="ui-icon ui-chevrons" viewBox="0 0 28 16" aria-hidden="true"><path d="m4 3 5 5-5 5"/><path d="m12 3 5 5-5 5"/><path d="m20 3 5 5-5 5"/></svg></span><svg class="cart-checkout-check" viewBox="0 0 24 24" aria-hidden="true"><path d="m4 12 5 5L20 6"/></svg></button><button class="text-link full cart-dark-browse" data-action="close-dialog" style="display:block;margin:14px auto 4px">Continue browsing</button></div>`;
}
function breadcrumbs(current,extra=''){return `<div class="breadcrumbs"><a href="#home">hehe.cafe</a><span>/</span>${extra}<span>${e(current)}</span></div>`;}
function productCard(p){return productCardMarkup(p,siteContent);}
function story(){return storyMarkup();}
function renderHome(){
  if((!contentReady&&!contentError)||(!settingsReady&&!settingsError)){$('main').innerHTML=pageSkeleton('home');return;}
  $('main').innerHTML=homeMarkup(products,storeSettings,siteContent,{catalogLoading:!catalogReady&&!catalogError,catalogError,filter,artists});
}
function renderShop(){
  const {page,id}=route();
  const search=page==='search'?decodeURIComponent(id):(filter.search||'');
  const title=page==='search'?`Search: “${search}”`:'All artworks at hehe.cafe';
  $('main').innerHTML=`<div class="container"><div class="page-head home-intro-row"><div>${breadcrumbs(page==='search'?'Search':'All artworks')}<h1>${e(title)}</h1><p>Original paintings, small-batch studio pieces and tactile art.</p></div>${homeFilterPanelMarkup(products,filter)}</div><hr class="section-rule rule-terracotta" aria-hidden="true"><div id="product-results"></div></div>`;
  renderProductResults();
}
function refreshFilterUI(keepOpen=false){
  const wrap=document.querySelector('.home-filter-wrap');
  if(wrap){
    const tmp=document.createElement('div');
    tmp.innerHTML=homeFilterPanelMarkup(products,filter);
    const nextWrap=tmp.firstElementChild;
    wrap.replaceWith(nextWrap);
    if(keepOpen){
      const panel=nextWrap.querySelector('#home-filter-panel');
      const btn=nextWrap.querySelector('[data-action="toggle-filter-menu"]');
      if(panel){panel.hidden=false;}
      if(btn){btn.setAttribute('aria-expanded','true');}
    }
  }
  renderProductResults();
  decorateCartButtons();
}
function renderArtists(){
  $('main').innerHTML=artistsPageMarkup(artists,products,siteContent);
}
function renderArtistProfile(slug){
  const allArtists=mergeArtistsWithProducts(artists,products);
  const artist=allArtists.find(a=>a.id===slug);
  if(!artist)return renderNotFound();
  const artistProducts=filterProducts(products,{artist:artist.id,sort:storeSettings.artworkSort||'manual'});
  $('main').innerHTML=artistDetailMarkup(artist,artistProducts,siteContent);
}
function renderProductResults(){
  if(!$('product-results'))return;
  if(!catalogReady&&!catalogError){if($('product-count'))$('product-count').textContent='';$('product-results').innerHTML=skeletonMarkup('products','Loading artworks…');return;}
  const {page,id}=route();
  const activeSearch=page==='search'?decodeURIComponent(id):(filter.search||'');
  const sortMode=filter.sort||storeSettings.artworkSort||'manual';
  const list=filterProducts(products,{...filter,sort:sortMode,category:'',search:activeSearch});
  if($('product-count'))$('product-count').textContent=catalogReady?`${list.length} ${list.length===1?'artwork':'artworks'}`:'';
  $('product-results').innerHTML=list.length?`<div class="product-grid">${list.map(productCard).join('')}</div>`:catalogError?catalogErrorMarkup():`<div class="empty-state"><h2>No matching artworks found.</h2><p>Try clearing your filters or showing all pieces.</p><button type="button" class="button outline" data-action="reset-filters">Show all artworks</button></div>`;
}
function catalogErrorMarkup(){return '<div class="empty-state" role="alert"><h2>The gallery catalogue could not load</h2><p>Check your connection and try again.</p><button class="button outline" data-action="retry">Try again</button></div>';}
function applyProductWash(hex){
  if(!hex)return;
  const ink=contrastColorFor(hex);
  document.body.style.setProperty('--art-accent',hex);
  document.body.style.setProperty('--art-ink',ink);
  const pageEl=document.querySelector('.product-immersive-page');
  if(pageEl){
    pageEl.style.setProperty('--art-accent',hex);
    pageEl.style.setProperty('--art-ink',ink);
  }
}
function sampleAndWashProductImage(img){
  if(!img)return;
  const apply=()=>{
    const sampled=sampleArtworkBgFromImage(img);
    if(sampled)applyProductWash(sampled);
  };
  if(img.complete&&img.naturalWidth>0)apply();
  else img.addEventListener('load',apply,{once:true});
}
function renderProduct(){
  const p=visible().find(p=>p.id===route().id);if(!p){if(catalogError){$('main').innerHTML=`<div class="container">${catalogErrorMarkup()}</div>`;return;}if(!catalogReady){$('main').innerHTML=pageSkeleton('product');return;}return renderNotFound();}
  const artist=p.artist||'Suprita Chatterjee';
  const slug=artistSlug(artist);
  const productType=p.productType||'Fridge Magnet';
  const themeStyle=artworkThemeStyle(p);
  const bgColor=artworkColorFor(p);
  const inkColor=contrastColorFor(bgColor);
  const soldOut=p.stock<1;
  if(!['desc','details','care'].includes(activeProductTab))activeProductTab='desc';
  document.body.dataset.productWash='true';
  applyProductWash(bgColor);
  $('main').innerHTML=`<div class="product-immersive-page" style="${themeStyle};--art-accent:${e(bgColor)};--art-ink:${e(inkColor)}">
    <div class="product-immersive-hero"><div class="container">
      <div class="product-topbar">
        <a href="#home" class="product-float-btn" aria-label="Back to all artworks"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg></a>
        <span class="product-topbar-title">${e(p.title)}</span>
        <button type="button" class="product-float-btn" data-action="zoom" aria-label="Zoom ${e(p.title)} image"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg></button>
      </div>
      <div class="product-immersive-grid" data-product-card style="${themeStyle}">
        <div class="product-stage-column">
          <button class="product-blended-stage" data-action="zoom" aria-label="Zoom ${e(p.title)} image">
            <img id="product-main-image" src="${e(imageOf(p))}" alt="${e(p.title)} by ${e(artist)}" data-artwork-img>
          </button>
          ${p.images.length>1?`<div class="product-gallery-dots thumbs">${p.images.map((img,i)=>`<button type="button" data-action="thumbnail" data-index="${i}" class="${i===0?'active is-active':''}" aria-label="View image ${i+1}"></button>`).join('')}</div>`:''}
        </div>
        <div class="product-detail-panel">
          <div class="product-title-row">
            <h1>${e(p.title)}</h1>
            <span class="product-dim-note artwork-type-pill">${e(p.dimensions||productType)}</span>
          </div>
          <div class="product-submeta">
            <p class="detail-artist-line">by <a class="artist-link" href="#artist/${e(slug)}">${e(artist)}</a> · ${e(productType)}</p>
            ${soldOut?'<span class="card-sold-out-pill detail-sold-pill">Sold out</span>':''}
          </div>
          <div class="product-tabs" role="tablist" aria-label="Artwork details">
            <button type="button" class="product-tab ${activeProductTab==='desc'?'is-active':''}" role="tab" aria-selected="${activeProductTab==='desc'}" data-action="product-tab" data-tab="desc">Description</button>
            <button type="button" class="product-tab ${activeProductTab==='details'?'is-active':''}" role="tab" aria-selected="${activeProductTab==='details'}" data-action="product-tab" data-tab="details">Details</button>
            <button type="button" class="product-tab ${activeProductTab==='care'?'is-active':''}" role="tab" aria-selected="${activeProductTab==='care'}" data-action="product-tab" data-tab="care">Care &amp; Framing</button>
          </div>
          <div class="product-tab-panels">
            <div class="product-tab-panel" data-tab-panel="desc" ${activeProductTab==='desc'?'':'hidden'}>
              <p class="description">${e(p.description||'An original piece created at hehe.cafe.')}</p>
            </div>
            <div class="product-tab-panel" data-tab-panel="details" ${activeProductTab==='details'?'':'hidden'}>
              <dl class="artwork-meta-grid"><div><dt>Artwork Name</dt><dd>${e(p.title)}</dd></div><div><dt>Category</dt><dd>${e(productType)}</dd></div><div><dt>Artist</dt><dd><a class="artist-link" href="#artist/${e(slug)}">${e(artist)}</a></dd></div><div><dt>Medium / Material</dt><dd>${e(p.material||'Original studio medium')}</dd></div><div><dt>Dimensions</dt><dd>${e(p.dimensions||'Standard gallery format')}</dd></div><div><dt>Shipping</dt><dd>₹${SHIPPING_CHARGE} per item via India Post · <a class="text-link" href="#info/shipping">Delivery policy</a></dd></div></dl>
            </div>
            <div class="product-tab-panel" data-tab-panel="care" ${activeProductTab==='care'?'':'hidden'}>
              <p class="description">${e(p.care||'Keep out of direct moisture and harsh midday sun. Ships in acid-free protective gallery sleeves.')}</p>
            </div>
          </div>
          <div class="product-purchase-bar">
            <div class="product-purchase-price">
              <small>Price${p.comparePrice>p.price?` <del>${money(p.comparePrice)}</del>`:''}</small>
              <strong>${money(p.price)}</strong>
              <span>+ ₹${SHIPPING_CHARGE} per item India Post shipping</span>
            </div>
            ${soldOut?`<button type="button" class="product-cart-pill is-sold-out" disabled>Sold out</button>`:`<div class="product-purchase-btns"><button class="button product-cart-pill artwork-cart-btn" data-action="add-detail" data-id="${e(p.id)}" data-artwork-btn style="${themeStyle}">Add to Cart</button><button type="button" class="product-buy-link" data-action="buy-now" data-id="${e(p.id)}">Buy now →</button></div>`}
          </div>
        </div>
      </div>
    </div></div>
    <div class="product-related-band"><div class="container">
      <hr class="section-rule rule-terracotta" aria-hidden="true">
      <section class="related"><div class="section-heading"><h2>More artworks from hehe.cafe</h2><a href="#home" class="text-link">View all artworks →</a></div><div class="product-grid">${visible().filter(item=>item.id!==p.id).slice(0,3).map(productCard).join('')}</div></section>
    </div></div>
  </div>`;
  sampleAndWashProductImage($('product-main-image'));
}
const states=['Andaman and Nicobar Islands','Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chandigarh','Chhattisgarh','Dadra and Nagar Haveli and Daman and Diu','Delhi','Goa','Gujarat','Haryana','Himachal Pradesh','Jammu and Kashmir','Jharkhand','Karnataka','Kerala','Ladakh','Lakshadweep','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Puducherry','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal'];
function field(name,label,options={}){return `<label class="field ${options.wide?'wide':''}" for="${name}">${label}<input id="${name}" name="${name}" type="${options.type||'text'}" ${options.optional?'':'required'} maxlength="${options.max||100}" ${options.auto?`autocomplete="${options.auto}"`:''} ${options.pattern?`pattern="${options.pattern}"`:''} ${options.mode?`inputmode="${options.mode}"`:''} value="${e(checkoutDraft[name]||'')}" placeholder="${e(options.placeholder||label)}"></label>`;}
function checkoutProgress(step){
  const labels=['Contact','Delivery','Review','Complete'];
  return `<div id="checkout-progress">${steppedProgress(labels,step,'Checkout progress')}</div>`;
}
function updateCheckoutProgress(step){
  const progress=$('checkout-progress')?.querySelector('.checkout-progress');if(!progress)return;
  const items=[...progress.querySelectorAll('li')],current=Math.max(1,Math.min(items.length,Number(step)||1));
  const fill=progress.querySelector('.checkout-progress-line span');
  if(fill)fill.style.width=`${items.length>1?(current-1)/(items.length-1)*100:0}%`;
  const animate=!matchMedia('(prefers-reduced-motion: reduce)').matches,changedMarkers=[];
  items.forEach((item,index)=>{
    const number=index+1,complete=number<current,active=number===current,marker=item.querySelector('.checkout-step-marker');
    item.classList.toggle('is-complete',complete);item.classList.toggle('is-active',active);
    if(active)item.setAttribute('aria-current','step');else item.removeAttribute('aria-current');
    if(marker&&marker.classList.contains('is-check')!==complete){
      marker.classList.remove('is-glyph-transitioning');
      marker.classList.toggle('is-check',complete);
      marker.innerHTML=complete?'<span class="checkout-step-glyph"><svg class="checkout-step-check" viewBox="0 0 20 20" aria-hidden="true"><path d="m4 10.5 4 4L16 6.5"></path></svg></span>':`<span class="checkout-step-glyph">${number}</span>`;
      if(animate)changedMarkers.push(marker);
    }
  });
  clearTimeout(updateCheckoutProgress.timer);
  if(animate&&changedMarkers.length){void progress.offsetWidth;changedMarkers.forEach(marker=>marker.classList.add('is-glyph-transitioning'));updateCheckoutProgress.timer=setTimeout(()=>changedMarkers.forEach(marker=>marker.classList.remove('is-glyph-transitioning')),850);}
}
function cancelCheckoutStepMotion(form){
  checkoutStepMotionToken++;
  checkoutStepAnimations.forEach(animation=>animation.cancel());checkoutStepAnimations=[];
  const stage=form.querySelector('.checkout-step-stage');
  if(stage){stage.style.height='';stage.style.overflow='';}
  form.querySelectorAll('[data-checkout-step]').forEach(page=>{page.style.zIndex='';});
  form.classList.remove('is-step-transitioning');
}
function checkoutProfileDefaults(profile=accountState.profile){
  return checkoutDefaults(profile,user,accountState.requests);
}
function applyCheckoutProfile(profile=accountState.profile){
  const form=$('checkout-form');if(!form||!user||user.isAnonymous)return;
  const defaults=checkoutProfileDefaults(profile);
  for(const key of ['email','firstName','lastName','phone','address','apartment','city','state','postalCode']){
    const input=form.elements.namedItem(key);
    if(input&&!checkoutTouched.has(key)&&!String(input.value||'').trim()&&defaults[key])input.value=defaults[key];
  }
  if(!checkoutDraft.location&&!checkoutTouched.has('location')&&validLocation(defaults.location)){
    checkoutDraft.location={...defaults.location};
    deliveryMap?.setSavedLocation(checkoutDraft.location);
  }
  captureCheckout();
  if(checkoutStep===3){renderCheckoutReview();preloadRazorpay();preloadPaymentOutcomeSvg().catch(()=>{});}
}
function renderCheckout(){
  if(deferPageRender(render))return;
  if(user&&!user.isAnonymous){
    const defaults=checkoutProfileDefaults();
    for(const key of ['email','firstName','lastName','phone','address','apartment','city','state','postalCode'])if(checkoutDraft[key]===undefined&&!checkoutTouched.has(key)&&defaults[key])checkoutDraft[key]=defaults[key];
    if(!checkoutDraft.location&&!checkoutTouched.has('location')&&validLocation(defaults.location))checkoutDraft.location={...defaults.location};
  }
  deliveryMap?.destroy();deliveryMap=null;
  if(completedRequest&&!submitting&&!paymentSceneActive)return renderSuccess();
  if(authLoading||(cart.length&&!catalogReady&&!catalogError)){$('main').innerHTML=pageSkeleton('checkout');return;}
  if(cart.length&&!catalogReady&&catalogError){$('main').innerHTML=`<div class="container">${catalogErrorMarkup()}</div>`;return;}
  const cleanupBanner=cartCleanupBannerMarkup();
  const entries=lines();checkoutProducts=entries.map(l=>({...l.product}));if(!entries.length){$('main').innerHTML=`<div class="container checkout-wrap empty-state">${cleanupBanner}<h1>Your art bag is empty</h1><p>Add an artwork before checking out.</p><a class="button" href="#home">Explore artworks →</a></div>`;return;}
  if(!user||user.isAnonymous){
    $('main').innerHTML=`<div class="container checkout-wrap">${cleanupBanner}<div class="page-head">${breadcrumbs('Checkout','<a href="#home">Artworks</a><span>/</span>')}<h1>Sign in to check out</h1><p>Your art bag is saved. Sign in with Google to enter delivery details and complete your order.</p></div><section class="checkout-info checkout-signin-card"><img class="checkout-signin-cat" src="assets/checkout/cat-coffee.webp" alt="" aria-hidden="true" decoding="async"><div class="checkout-signin-copy"><strong>One-tap Google sign-in</strong><p>After signing in, you’ll return right here to complete your order.</p>${authLoading?'<p role="status">Checking your sign-in…</p>':'<button type="button" class="button" data-action="signin">Continue with Google</button><button type="button" class="text-link signin-redirect-link" data-action="signin-redirect">Popup blocked? Sign in with redirect →</button>'}</div></section><p style="margin-top:20px"><a class="text-link" href="#home">← Back to hehe.cafe</a></p></div>`;
    return;
  }
  const pricing = bagPricing(entries);
  const orderSub = pricing.subtotalPaise / 100;
   const orderTotal = pricing.totalPaise / 100;
  const itemCount = entries.reduce((n, l) => n + l.quantity, 0);
  const consentChecked = checkoutDraft.consent !== false;
  const noteVal=checkoutDraft.notes??orderNote;
  const bgLeftSvg='<svg class="checkout-bg-left" viewBox="0 0 210 260" aria-hidden="true"><path d="M20 28c68 8 134 52 150 112 16 58-24 106-86 112-46 5-76-26-84-74V34Z" fill="#e5a245" opacity=".85"/></svg>';
  const bgRightSvg='<svg class="checkout-bg-right" viewBox="0 0 230 280" aria-hidden="true"><path d="M180 14C112 28 54 78 36 144c-18 66 18 118 82 124 46 5 88-22 104-72V26Z" fill="#8ca65a" opacity=".85"/></svg>';
  const cloudSunImg='<img class="checkout-cloud-art" src="assets/checkout/cloud-sun.webp" alt="" aria-hidden="true" decoding="async">';
  const peekCatImg='<img class="checkout-peek-cat" src="assets/checkout/cat-peeking.webp" alt="" aria-hidden="true" decoding="async">';
  const summaryCatImg='<img class="checkout-cat-art" src="assets/checkout/cat-blanket-nap.webp" alt="" aria-hidden="true" decoding="async">';
  const meadowWrapMarkup='<div class="checkout-meadow-wrap" aria-hidden="true"><img class="checkout-meadow-art" src="assets/checkout/meadow-wide.webp" alt="" decoding="async"></div>';
  const mobileSceneMarkup='<div class="checkout-mobile-scene" aria-hidden="true"><img class="checkout-mobile-hills" src="assets/checkout/meadow-hills.webp" alt="" decoding="async"><img class="checkout-mobile-cat" src="assets/checkout/scene-cat-flowers.webp" alt="" decoding="async"></div>';
  const footerFlowersMarkup='<div class="checkout-footer-flowers" aria-hidden="true"><img class="checkout-flower-a" src="assets/checkout/flower-orange.webp" alt="" decoding="async"><img class="checkout-flower-b" src="assets/checkout/flower-yellow.webp" alt="" decoding="async"></div>';
  $('main').innerHTML=`<div class="checkout-wrap">${bgLeftSvg}${bgRightSvg}${cleanupBanner}<div class="page-head checkout-page-head">${cloudSunImg}${breadcrumbs('Checkout','<a href="#home">Artworks</a><span>/</span>')}<h1>Checkout <svg class="checkout-title-sparkle" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 17 15 7M12 19l8-3M7 10l3-7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></h1><p>Complete your delivery details below.</p></div><div class="checkout-layout"><form id="checkout-form" class="checkout-form" novalidate>${peekCatImg}${!user||user.isAnonymous?'<div class="checkout-info"><strong>Keep this request in your account</strong><p>Sign in with Google before saving so you can track status, cancel and save your address.</p><button type="button" class="button outline small" data-action="signin">Continue with Google</button></div>':''}${checkoutProgress(checkoutStep)}<div class="checkout-step-stage"><section class="checkout-step" data-checkout-step="1" aria-labelledby="checkout-contact-heading"><h2 id="checkout-contact-heading" tabindex="-1">1 · Contact details</h2><p class="small muted">Where hehe.cafe can send order updates and delivery tracking.</p><div class="form-grid">${field('email','Email address',{type:'email',auto:'email',wide:true,max:254})}${field('phone','Mobile number',{type:'tel',auto:'tel',wide:true,max:16,placeholder:'+91 98765 43210'})}${field('firstName','First name',{auto:'given-name'})}${field('lastName','Last name',{auto:'family-name'})}</div></section><section class="checkout-step" data-checkout-step="2" aria-labelledby="checkout-delivery-heading"><h2 id="checkout-delivery-heading" tabindex="-1">2 · Delivery address</h2><p class="small muted">Add your full delivery address and confirm your pin on the map.</p><div class="form-grid"><label class="field wide" for="country">Country / region<select id="country" name="country" autocomplete="country-name"><option>India</option></select></label>${field('address','Street address',{auto:'address-line1',wide:true,max:300})}${field('apartment','Apartment, landmark, etc. (optional)',{auto:'address-line2',optional:true,wide:true,max:150})}${field('city','City',{auto:'address-level2'})}<label class="field" for="state">State<select id="state" name="state" autocomplete="address-level1" required><option value="">Select state</option>${states.map(s=>`<option ${checkoutDraft.state===s?'selected':''}>${s}</option>`).join('')}</select></label>${field('postalCode','PIN code',{auto:'postal-code',pattern:'[1-9][0-9]{5}',mode:'numeric',max:6})}</div>${mapPanel(checkoutDraft.location)}</section><section class="checkout-step" data-checkout-step="3" aria-labelledby="checkout-review-heading"><h2 id="checkout-review-heading" tabindex="-1">3 · Review &amp; pay</h2><div id="checkout-review" class="checkout-review"></div><label class="field wide checkout-note-field" for="checkout-notes"><span class="checkout-note-label"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H7l-3 3V5Z"/><path d="M8 9h8M8 12.5h5"/></svg>Note for hehe.cafe (optional)</span><textarea id="checkout-notes" name="notes" maxlength="1000" placeholder="Add delivery instructions, framing requests or a gift note…">${e(noteVal)}</textarea><span id="checkout-notes-count" class="note-char-count">${String(noteVal).length} / 1000</span></label><p class="checkout-step-due"><strong>Total due now: ${money(orderTotal)}</strong> · ${pricing.freeShipping?'Includes free India Post shipping.':`Includes ₹${SHIPPING_CHARGE} × ${itemCount} (${money(pricing.shippingPaise/100)}) India Post shipping.`}</p><label class="checkbox checkout-consent-box"><input name="consent" type="checkbox" required ${consentChecked?'checked':''}><span>I agree to share these details with hehe.cafe for order fulfilment. <a href="#info/privacy" class="text-link">Privacy policy</a></span></label></section></div><div class="checkout-step-actions"><button id="checkout-prev" type="button" class="button outline checkout-back-btn" data-action="checkout-previous" hidden>← Back</button><button id="checkout-next" type="button" class="button checkout-next-btn" data-action="checkout-next">Continue →</button><button id="checkout-submit" type="submit" class="pos-transaction-container" hidden aria-label="Pay ${money(orderTotal)}"><span class="left-side" aria-hidden="true"><span class="card"><span class="card-line"></span><span class="buttons"></span></span><span class="post"><span class="post-line"></span><span class="screen"><span class="dollar">₹</span></span><span class="numbers"></span><span class="numbers-line2"></span></span></span><span class="right-side"><span class="new">Pay ${money(orderTotal)}</span><svg viewBox="0 0 451.846 451.847" class="arrow" aria-hidden="true"><path d="M345.441 248.292L151.154 442.573c-12.359 12.365-32.397 12.365-44.75 0-12.354-12.354-12.354-32.391 0-44.744L278.318 225.92 106.409 54.017c-12.354-12.359-12.354-32.394 0-44.748 12.354-12.359 32.391-12.359 44.75 0l194.287 194.284c6.177 6.18 9.262 14.271 9.262 22.366 0 8.099-3.091 16.196-9.267 22.373z"/></svg></span></button></div><p id="checkout-availability" class="notice" role="alert" hidden></p><button id="review-checkout-cart" type="button" class="text-link" data-action="review-checkout-cart" hidden>Review updated bag</button><p id="checkout-notice" class="notice" role="alert"></p><a href="#home" class="text-link">← Back to hehe.cafe</a>${mobileSceneMarkup}</form><aside class="checkout-summary summary-collapsed" aria-labelledby="summary-title">${summaryCatImg}<button type="button" class="summary-toggle" data-action="toggle-summary" aria-expanded="false" aria-controls="checkout-summary-content"><span class="summary-toggle-label">View order summary <svg viewBox="0 0 24 24" class="ui-chevron" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></span><strong>${money(orderTotal)}</strong></button><div id="checkout-summary-content"><div class="section-heading" style="margin:0 0 18px"><h2 id="summary-title">Order summary</h2><button class="text-link" data-action="cart">Edit bag</button></div>${entries.map(({product:p,quantity,total})=>`<div class="checkout-item"><div class="checkout-item-image"><img src="${e(imageOf(p))}" alt="${e(p.title)}"><span>${quantity}</span></div><div>${e(p.title)}<small>by ${e(p.artist||'Suprita Chatterjee')}</small></div><span>${money(total)}</span></div>`).join('')}${bagOffersMarkup(entries,pricing,'checkout')}<hr>${discountTotalRowsMarkup(pricing,`Artworks · ${itemCount} ${itemCount===1?'piece':'pieces'}`)}<div class="checkout-info checkout-protected-card"><span class="protected-shield" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3 4 6.5v5.5c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V6.5L12 3Z"/><path d="m9 12 2 2 4-4"/></svg></span><div><strong>Protected checkout</strong><p>Your artwork is reserved upon payment verification.</p></div></div></div>${meadowWrapMarkup}</aside></div>${footerFlowersMarkup}</div>`;
  mountCheckoutMap();
  applyCheckoutProfile();
  if(user&&!user.isAnonymous&&(!accountState.loaded||accountState.error||accountState.profileError)&&!accountState.loading)void fetchCustomerAccount();
  setCheckoutStep(checkoutStep,{focus:false});
}
function setCheckoutStep(step,{focus=true}={}){
  const previousStep=checkoutStep,nextStep=Math.max(1,Math.min(3,step));
  const form=$('checkout-form');if(!form)return;
  captureCheckout();
  const pages=[...form.querySelectorAll('[data-checkout-step]')],from=pages.find(page=>!page.hidden&&Number(page.dataset.checkoutStep)===previousStep)||pages.find(page=>!page.hidden),to=pages.find(page=>Number(page.dataset.checkoutStep)===nextStep);
  cancelCheckoutStepMotion(form);checkoutStep=nextStep;updateCheckoutProgress(checkoutStep);
  if(checkoutStep===3){renderCheckoutReview();preloadRazorpay();preloadPaymentOutcomeSvg().catch(()=>{});}
  const stage=form.querySelector('.checkout-step-stage'),canAnimate=previousStep!==nextStep&&from&&to&&stage&&typeof from.animate==='function'&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(canAnimate){
    pages.forEach(page=>{page.hidden=page!==from&&page!==to;});to.hidden=false;
    from.style.zIndex='1';to.style.zIndex='2';
    stage.style.overflow='hidden';const startHeight=from.getBoundingClientRect().height;stage.style.height=`${startHeight}px`;const endHeight=to.getBoundingClientRect().height;
    form.classList.add('is-step-transitioning');const forward=nextStep>previousStep;
    const leave=from.animate([{opacity:1,transform:'translateX(0) scale(1)'},{opacity:0,transform:`translateX(${forward?-36:36}px) scale(.985)`}],{duration:260,easing:'cubic-bezier(.4,0,.2,1)',fill:'both'});
    const enter=to.animate([{opacity:0,transform:`translateX(${forward?36:-36}px) scale(.985)`},{opacity:1,transform:'translateX(0) scale(1)'}],{duration:400,delay:50,easing:'cubic-bezier(.22,1,.36,1)',fill:'both'});
    const resize=stage.animate([{height:`${startHeight}px`},{height:`${endHeight}px`}],{duration:420,easing:'cubic-bezier(.22,1,.36,1)',fill:'both'});
    if(form.getBoundingClientRect().top<84)form.scrollIntoView({behavior:'smooth',block:'start'});
    checkoutStepAnimations=[leave,enter,resize];const token=checkoutStepMotionToken;
    let done=false;
    const finish=()=>{
      if(done||token!==checkoutStepMotionToken)return;
      done=true;clearTimeout(fallbackTimer);
      from.hidden=true;checkoutStepAnimations.forEach(animation=>animation.cancel());checkoutStepAnimations=[];
      stage.style.height='';stage.style.overflow='';form.classList.remove('is-step-transitioning');
    };
    const fallbackTimer=setTimeout(finish,560);
    Promise.all(checkoutStepAnimations.map(animation=>animation.finished.catch(()=>{}))).then(finish);
  }else pages.forEach(page=>{page.hidden=Number(page.dataset.checkoutStep)!==checkoutStep;});
  const previous=$('checkout-prev'),next=$('checkout-next'),submit=$('checkout-submit');
  previous.hidden=checkoutStep===1;next.hidden=checkoutStep===3;submit.hidden=checkoutStep!==3;
  updateCheckoutAvailability();
  if(focus)form.querySelector(`[data-checkout-step="${checkoutStep}"] h2`)?.focus({preventScroll:canAnimate});
}
function renderCheckoutReview(){
  const review=$('checkout-review');if(!review)return;
  const value=id=>$(id)?.value?.trim()||'';
  const name=[value('firstName'),value('lastName')].filter(Boolean).join(' ');
  const address=[value('address'),value('apartment'),value('city'),value('state'),value('postalCode'),value('country')].filter(Boolean).join(', ');
  const pinOk=validLocation(checkoutDraft.location);
  const editSvg='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
  review.innerHTML=`
    <div class="checkout-review-row">
      <span class="review-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0 1 16 0"/></svg></span>
      <span class="review-label">Contact</span>
      <div class="review-body"><strong>${e(name)}</strong><small>${e(value('email'))}${value('phone')?`<br>${e(value('phone'))}`:''}</small></div>
      <button type="button" class="review-edit-btn" data-action="checkout-edit-step" data-step="1" aria-label="Edit contact details">${editSvg}</button>
    </div>
    <div class="checkout-review-row">
      <span class="review-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 6h11v10H3z"/><path d="M14 9h4l3 3v4h-7V9Z"/><circle cx="7.5" cy="18" r="1.8"/><circle cx="17.5" cy="18" r="1.8"/></svg></span>
      <span class="review-label">Deliver to</span>
      <div class="review-body"><strong>${e(address)}</strong></div>
      <button type="button" class="review-edit-btn" data-action="checkout-edit-step" data-step="2" aria-label="Edit delivery address">${editSvg}</button>
    </div>
    <div class="checkout-review-row">
      <span class="review-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 21s-6-5.3-6-10.5a6 6 0 1 1 12 0C18 15.7 12 21 12 21Z"/><circle cx="12" cy="10.5" r="2.2"/></svg></span>
      <span class="review-label">Delivery pin</span>
      <div class="review-body"><strong class="review-pin-pill ${pinOk?'is-ok':'is-warn'}">${pinOk?'✓ Confirmed':'Needs confirmation'}</strong></div>
      <button type="button" class="review-edit-btn" data-action="checkout-edit-step" data-step="2" aria-label="Edit delivery pin">${editSvg}</button>
    </div>`;
}
function checkoutStepValid(){
  const form=$('checkout-form'),page=form?.querySelector(`[data-checkout-step="${checkoutStep}"]`);if(!page)return false;
  const showInvalid=control=>{
    const msg=control.validationMessage||'Please complete the highlighted field.';
    if($('checkout-notice'))$('checkout-notice').textContent=msg;
    control.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});
    control.focus({preventScroll:true});
    control.reportValidity();
    return false;
  };
  if(checkoutStep===1){
    const phone=$('phone');
    for(const control of page.querySelectorAll('input,select,textarea'))if(control!==phone&&!control.checkValidity())return showInvalid(control);
    phone.setCustomValidity(/^(?:\+91[ -]?)?[6-9]\d{9}$/.test(phone.value.replace(/\s/g,''))?'':'Enter a valid 10-digit Indian mobile number.');
    if(!phone.checkValidity())return showInvalid(phone);
  }else if(checkoutStep===2){
    for(const control of page.querySelectorAll('input,select,textarea'))if(!control.checkValidity())return showInvalid(control);
    captureCheckout();
    if(deliveryMap?.needsConfirmation()){$('checkout-notice').textContent='Choose and confirm your delivery pin on the map before continuing.';deliveryMap.focus();return false;}
  }
  $('checkout-notice').textContent='';captureCheckout();return true;
}
function mountCheckoutMap(){
  deliveryMap=mountDeliveryMap(document.querySelector('.delivery-pin'),{
    initial:checkoutDraft.location,
    getAddress:()=>{captureCheckout();return checkoutDraft;},
    onChange:point=>{checkoutTouched.add('location');if(point)checkoutDraft.location=point;else delete checkoutDraft.location;const notice=$('checkout-notice');if(validLocation(point)&&notice&&/delivery pin/i.test(notice.textContent||''))notice.textContent='';},
    onAddress:address=>{for(const key of ['address','city','state','postalCode']){if(!address[key]||!$(key))continue;if(key==='state'&&!states.includes(address[key]))continue;$(key).value=address[key];checkoutTouched.add(key);}captureCheckout();},
  });
  updateCheckoutAvailability();
}

function captureCheckout(){const form=$('checkout-form');if(!form)return;const data=new FormData(form);const point=checkoutDraft.location;checkoutDraft=Object.fromEntries(data);if(point)checkoutDraft.location=point;checkoutDraft.consent=data.get('consent')==='on';}
async function checkoutFingerprint(customer){
  const value=JSON.stringify({uid:user.uid,customer,promoCode:appliedPromoCode||'',cart:cart.map(item=>({id:item.id,quantity:item.quantity})).sort((a,b)=>a.id.localeCompare(b.id))});
  if(globalThis.crypto?.subtle?.digest){
    const digest=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
    return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
  }
  let h1=0xdeadbeef,h2=0x41c6ce57;
  for(let i=0;i<value.length;i++){const ch=value.charCodeAt(i);h1=Math.imul(h1^ch,2654435761);h2=Math.imul(h2^ch,1597334677);}
  return `${(h1>>>0).toString(16).padStart(8,'0')}${(h2>>>0).toString(16).padStart(8,'0')}`;
}
function renderSuccess(){$('main').innerHTML=`<div class="container"><section class="success-card">${checkoutProgress(4)}<img class="checkout-success-cat" src="assets/checkout/cat-box-happy.webp" alt="" aria-hidden="true" decoding="async"><span class="success-icon"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 13l4 4L19 7"/></svg></span><p class="eyebrow">Payment successful · hehe.cafe</p><h1>Thanks, ${e(completedRequest.customer.firstName)}.</h1><p>Your order is confirmed and will ship via India Post.</p><p>Order Reference: <strong>${e(completedRequest.id.slice(0,8).toUpperCase())}</strong></p><div class="checkout-info"><strong>Total paid: ${money(completedRequest.quote.amount/100)}</strong>${completedRequest.quote?.freeShipping?'<p style="margin:6px 0 0">Includes free India Post shipping.</p>':completedRequest.quote?.shipping>0?`<p style="margin:6px 0 0">Includes India Post shipping (${money(completedRequest.quote.shipping/100)}).</p>`:''}</div><section id="save-address-prompt" class="save-address-prompt"><h2>Save this address for next time?</h2><p>Your delivery details stay with this order either way.</p><div class="save-address-actions"><button class="button" data-action="save-checkout-address">${user&&!user.isAnonymous?'Save address':'Sign in & save address'}</button><button class="text-link" data-action="skip-save-address">Not now</button></div><p class="notice" role="status"></p></section><a class="button" href="#home">Keep exploring hehe.cafe →</a><p style="margin-top:20px"><a href="#account/requests" class="text-link">View my orders →</a></p></section></div>`;}
function showPaymentPreviewChoice(){
  let dialog=$('payment-preview-dialog');
  if(!dialog){
    dialog=document.createElement('dialog');dialog.id='payment-preview-dialog';dialog.className='checkout-payment-dialog';
    dialog.setAttribute('aria-labelledby','payment-preview-title');
    dialog.innerHTML='<p class="eyebrow">Payment preview</p><h2 id="payment-preview-title">Choose a result</h2><p>This is a simulation only. It will not contact Razorpay, create an order, or change stock.</p><div class="checkout-payment-dialog-actions"><button type="button" class="button" data-action="preview-payment-outcome" data-outcome="success">Preview successful payment</button><button type="button" class="button outline" data-action="preview-payment-outcome" data-outcome="failure">Preview failed payment</button><button type="button" class="text-link" data-action="cancel-payment-preview">Cancel</button></div>';
    document.body.append(dialog);
  }
  if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
  dialog.querySelector('[data-outcome="success"]')?.focus();
}
async function waitForCheckoutButtonAnimation(button){
  const pause=ms=>new Promise(resolve=>window.setTimeout(resolve,ms));
  if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){await pause(80);return;}
  if(typeof button.getAnimations!=='function'||typeof window.requestAnimationFrame!=='function'){await pause(1650);return;}
  await new Promise(resolve=>window.requestAnimationFrame(()=>window.requestAnimationFrame(resolve)));
  const animations=button.getAnimations({subtree:true}).filter(a=>a.playState==='running'||a.playState==='pending');
  if(animations.length)await Promise.race([Promise.all(animations.map(a=>a.finished.catch(()=>{}))),pause(1850)]);
  else await pause(1650);
  if(button.isConnected)await pause(120);
}
async function submitCheckout(event){
  event.preventDefault();if(submitting)return;
  if(checkoutStep<3){if(checkoutStepValid())setCheckoutStep(checkoutStep+1);return;}
  captureCheckout();updateCheckoutAvailability();
  if(!catalogReady||catalogError||cartIssues(cart,products,checkoutProducts).length)return;
  if(!user||user.isAnonymous){$('checkout-notice').textContent='Sign in with Google above to save and pay for your request.';return;}
  if(deliveryMap?.needsConfirmation()){$('checkout-notice').textContent='Choose and confirm your delivery pin on the map before paying.';setCheckoutStep(2);deliveryMap.focus();return;}
  const customer=Object.fromEntries(Object.entries(checkoutDraft).map(([k,v])=>[k,typeof v==='string'?v.trim():v]));
  const error=validateCustomer(customer);if(error){$('checkout-notice').textContent=error;if(!customer.consent)$('checkout-form').elements.consent.focus();return;}
  // Snapshot names and quantities before payment reserves stock and live catalogue updates can hide cart lines.
  const cartSnapshot=cart.map(item=>({...item}));
  const animationItems=paymentAnimationItems(null,cartSnapshot);
  submitting=true;const button=$('checkout-submit');button.disabled=true;button.setAttribute('aria-busy','true');button.classList.add('is-animating');$('checkout-notice').textContent='';
  const loader=createLoaderController();
  let popupOpened=false,checkoutDone=false;
  const buttonAnim=waitForCheckoutButtonAnimation(button).then(()=>{
    button.classList.remove('is-animating');
    if(!popupOpened&&!checkoutDone)loader.show('Opening secure checkout…');
  });
  preloadPaymentOutcomeSvg().catch(()=>{});
  try{
    const paymentConfig=await store.checkoutPaymentConfig();
    if(paymentConfig.paymentPreviewEnabled){
      checkoutDone=true;
      await buttonAnim;
      loader.hide();
      showPaymentPreviewChoice();
      return;
    }
    if(!paymentConfig.paymentsEnabled)throw new Error('Razorpay payments are not enabled yet. No order or payment was created.');
    const fingerprint=await checkoutFingerprint(customer);let pending=null;
    try{pending=JSON.parse(localStorage.getItem(pendingCheckoutKey)||'null');}catch{}
    if(pending?.uid===user.uid){
      let oldRequest=accountState.requests.find(request=>request.id===pending.id);
      if(!oldRequest){const history=await store.loadCustomerRequests();oldRequest=history.requests.find(request=>request.id===pending.id);}
      if(['cancelled','closed'].includes(oldRequest?.status)||(oldRequest?.paymentStatus==='captured'&&oldRequest.status!=='cancel_requested')){clearPendingCheckout();pending=null;checkoutId=randomId();}
      else if(pending.fingerprint!==fingerprint)throw new Error('An unpaid checkout already exists for this account. Finish or cancel it under My account before starting a different checkout.');
      else checkoutId=pending.id;
    }
    const promoForOrder=bagPricing(lines()).appliedCode;
    let saved=await store.saveCheckout(checkoutId,customer,cart,checkoutProducts,checkoutCustomizations(cart),true,promoForOrder);
    if(saved.status==='cancelled'){
      clearPendingCheckout();checkoutId=randomId();
      saved=await store.saveCheckout(checkoutId,customer,cart,checkoutProducts,checkoutCustomizations(cart),true,promoForOrder);
    }
    if(['cancel_requested','closed'].includes(saved.status))throw new Error('This checkout has a pending cancellation. Wait for the studio to release it before starting another order.');
    if(saved.paymentStatus==='captured'){
      checkoutDone=true;
      await buttonAnim;
      loader.hide();
      clearPendingCheckout();completedRequest=saved;deliveryMap?.destroy();deliveryMap=null;
      paymentSceneActive=true;
      try{await playPaymentOutcome('success',{items:animationItems});}finally{paymentSceneActive=false;}
      cart=[];persistCart();clearCustomizations();checkoutDraft={};checkoutTouched.clear();orderNote='';appliedPromoCode='';promoFeedback='';checkoutId=randomId();renderSuccess();window.scrollTo({top:0,behavior:'smooth'});$('main').focus({preventScroll:true});return;
    }
    try{localStorage.setItem(pendingCheckoutKey,JSON.stringify({id:saved.id,uid:user.uid,fingerprint}));}catch{}
    requestsLoaded=false;accountState.loaded=false;
    try{
      await payRequest(saved.id,'items',{
        beforeOpen:async()=>{await buttonAnim;},
        onOpen:()=>{popupOpened=true;loader.hide();},
        onVerifying:()=>{popupOpened=true;loader.show('Verifying payment…');}
      });
    }catch(paymentError){
      popupOpened=true;checkoutDone=true;
      button.classList.remove('is-animating');
      loader.show('Checking payment status…');
      const cancelResult=await store.callBackend('cancelFailedPayment',{requestId:saved.id,purpose:'items',reason:paymentError?.message||'Payment failed'}).catch(()=>null);
      if(cancelResult?.paid===true){
        loader.hide();
        completedRequest=saved;deliveryMap?.destroy();deliveryMap=null;
        paymentSceneActive=true;
        try{await playPaymentOutcome('success',{items:animationItems});}finally{paymentSceneActive=false;}
        clearPendingCheckout();cart=[];persistCart();clearCustomizations();checkoutDraft={};checkoutTouched.clear();orderNote='';appliedPromoCode='';promoFeedback='';checkoutId=randomId();
        if(route().page==='checkout'){renderSuccess();window.scrollTo({top:0,behavior:'smooth'});$('main').focus({preventScroll:true});}
        else{render();toast('Payment successful. Thank you!');}
        return;
      }
      loader.hide();
      cartCleanupNotes.length=0;
      cart=cartSnapshot.map(item=>({...item}));persistCart();
      for(const item of cartSnapshot){
        const pre=checkoutProducts.find(p=>p.id===item.id);
        const cur=products.find(p=>p.id===item.id);
        if(pre&&cur&&cur.stock<pre.stock){cur.stock=pre.stock;rememberedProducts.set(cur.id,cur);}
      }
      clearPendingCheckout();completedRequest=null;checkoutId=randomId();requestsLoaded=false;accountState.loaded=false;
      deliveryMap?.destroy();deliveryMap=null;
      paymentSceneActive=true;
      try{await playPaymentOutcome('failure',{message:'Payment failed. This order was cancelled and your items are still in your cart if you want to try again.',items:animationItems});}finally{paymentSceneActive=false;}
      return;
    }
    checkoutDone=true;
    loader.hide();
    completedRequest=saved;deliveryMap?.destroy();deliveryMap=null;
    paymentSceneActive=true;
    try{await playPaymentOutcome('success',{items:animationItems});}finally{paymentSceneActive=false;}
    clearPendingCheckout();cart=[];persistCart();clearCustomizations();checkoutDraft={};checkoutTouched.clear();orderNote='';appliedPromoCode='';promoFeedback='';checkoutId=randomId();
    if(route().page==='checkout'){renderSuccess();window.scrollTo({top:0,behavior:'smooth'});$('main').focus({preventScroll:true});}
    else{render();toast('Payment successful. Thank you!');}
  }catch(error){
    checkoutDone=true;
    button.classList.remove('is-animating');
    loader.hide();
    if($('checkout-notice'))$('checkout-notice').textContent=store.friendlyError(error);else toast(store.friendlyError(error));
  }finally{
    checkoutDone=true;
    button.classList.remove('is-animating');
    loader.hide();
    submitting=false;
    $('checkout-submit')?.removeAttribute('aria-busy');
    $('checkout-submit')?.classList.remove('is-paying');
    updateCheckoutAvailability();
  }
}
function mountProfileMap(){
  const form=$('customer-profile-form');
  const pinRoot=form?.querySelector('.delivery-pin');
  if(!pinRoot)return;
  profileDraftLocation=validLocation(accountState.profile?.location)?{...accountState.profile.location}:null;
  deliveryMap=mountDeliveryMap(pinRoot,{
    initial:profileDraftLocation,
    getAddress:()=>{const current=$('customer-profile-form');return current?Object.fromEntries(new FormData(current)):{};},
    onChange:point=>{profileDraftLocation=point;},
    onAddress:address=>{
      const current=$('customer-profile-form');if(!current)return;
      for(const key of ['address','city','state','postalCode']){
        if(!address[key]||!current.elements[key])continue;
        if(key==='state'&&!states.includes(address[key]))continue;
        current.elements[key].value=address[key];
      }
    }
  });
}
function renderAccount(){
  if(deferPageRender(render))return;
  deliveryMap?.destroy();deliveryMap=null;
  $('main').innerHTML=accountMarkup(user,isAdmin,{...accountState,products,tab:route().id,states,authLoading,authError});mountLogout();
  mountProfileMap();
  if(user&&!user.isAnonymous&&!accountState.loaded&&!accountState.loading)fetchCustomerAccount();
}
function refreshAccountOrdersList(){
  const host=$('account-orders-list');
  if(!host)return;
  host.innerHTML=ordersListMarkup(accountState.requests,{filter:accountState.orderFilter||'all',query:accountState.orderQuery||'',products,openFirst:true});
  document.querySelectorAll('[data-action="account-order-filter"]').forEach(btn=>{
    const active=(btn.dataset.filter||'all')===(accountState.orderFilter||'all');
    btn.classList.toggle('is-active',active);
    if(btn.getAttribute('role')==='tab')btn.setAttribute('aria-selected',String(active));
  });
}
async function fetchCustomerAccount(more=false){
  if(!user||user.isAnonymous||accountState.loading)return;
  const uid=user.uid;accountState.loading=true;accountState.error='';
  if(route().page==='account')renderAccount();
  const [history,profile]=await Promise.allSettled([store.loadCustomerRequests(more?accountState.cursor:null),more?Promise.resolve(accountState.profile):store.loadProfile()]);
  if(user?.uid!==uid)return;
  if(history.status==='fulfilled'){
    accountState.requests=more?[...accountState.requests,...history.value.requests]:history.value.requests;
    accountState.cursor=history.value.cursor;accountState.hasMore=history.value.hasMore;
  }else accountState.error=store.friendlyError(history.reason);
  if(profile.status==='fulfilled'){accountState.profile=profile.value;accountState.profileError='';}
  else accountState.profileError=store.friendlyError(profile.reason);
  accountState.loading=false;accountState.loaded=true;
  if(route().page==='account')renderAccount();
  if(route().page==='checkout'&&$('checkout-form')&&!submitting)applyCheckoutProfile(accountState.profile);
}
async function submitCustomerProfile(event){
  event.preventDefault();const form=event.target,button=form.querySelector('[type="submit"]'),notice=$('profile-notice');
  if(profileDraftLocation&&!validLocation(profileDraftLocation)){
    notice.classList.remove('is-success');
    notice.textContent='Confirm your delivery pin on the map before saving your details.';
    deliveryMap?.focus();
    return;
  }
  const payload={...accountState.profile,...Object.fromEntries(new FormData(form))};
  if(profileDraftLocation!==undefined)payload.location=profileDraftLocation??null;
  const profile=normalizeProfile(payload),error=validateProfile(profile);
  if(error){notice.textContent=error;return;}
  button.disabled=true;notice.classList.remove('is-success');notice.textContent='Saving your details…';
  try{await store.saveProfile(profile);accountState.profile=profile;notice.classList.add('is-success');notice.textContent=validLocation(profile.location)?'Your address and confirmed delivery pin are saved for next time.':'Your details are saved for next time.';}
  catch(error){notice.textContent=store.friendlyError(error);}finally{button.disabled=false;}
}
function applyStoreBanners(){
  const announcement=document.querySelector('.announcement');
  announcement.hidden=!storeSettings.announcementVisible;
  announcement.innerHTML=`<a href="${e(storeSettings.announcementLink)}"><span class="announcement-text">${e(storeSettings.announcementText)}</span> <span aria-hidden="true">→</span></a>`;
  document.body.dataset.cartBtnMode=storeSettings.cartButtonMode||'black';
}
function draftSettingsFromForm(){
  const form=$('banner-form');
  if(!form)return storeSettings;
  const data=new FormData(form);
  const draft={...storeSettings};
  for(const key of ['announcementText','announcementLink','bannerEyebrow','bannerTitle','bannerText','bannerArtistLabel','bannerArtistLink','bannerButton','bannerLink','bannerButtonStyle','bannerButtonPosition','bannerImage']){
    if(data.has(key))draft[key]=String(data.get(key)||'');
  }
  if(!draft.bannerImage&&form.elements.bannerImage?.dataset.savedImage==='true')draft.bannerImage=storeSettings.bannerImage;
  draft.announcementVisible=data.get('announcementVisible')==='on';
  draft.bannerVisible=data.get('bannerVisible')==='on';
  draft.bannerShowArtist=data.get('bannerShowArtist')==='on';
  draft.bannerButtonVisible=data.get('bannerButtonVisible')==='on';
  draft.bannerButtonOffsetX=Number(data.get('bannerButtonOffsetX')||0);
  draft.bannerButtonOffsetY=Number(data.get('bannerButtonOffsetY')||0);
  draft.reviewsVisible=data.get('reviewsVisible')==='on';
  if(homeLayoutController){
    const lv=homeLayoutController.getValue();
    draft.homeSectionOrder=lv.homeSectionOrder;
    draft.promoBlocks=lv.promoBlocks;
  }else{
    try{if(data.get('homeSectionOrderJson'))draft.homeSectionOrder=JSON.parse(String(data.get('homeSectionOrderJson')));}catch{}
    try{if(data.get('promoBlocksJson'))draft.promoBlocks=JSON.parse(String(data.get('promoBlocksJson')));}catch{}
  }
  try{draft.reviewImages=collectReviews(form);}catch{}
  const pickedFile=form.elements.bannerFile?.files?.[0];
  if(pickedFile&&pickedFile.type?.startsWith('image/')){
    if(bannerPreviewObjectUrl)URL.revokeObjectURL(bannerPreviewObjectUrl);
    bannerPreviewObjectUrl=URL.createObjectURL(pickedFile);
    return {...normalizeSettings(draft),bannerImage:bannerPreviewObjectUrl};
  }
  return normalizeSettings(draft);
}
async function submitBanners(event){
  event.preventDefault();if(!isAdmin)return;
  const form=event.target,data=new FormData(form),button=form.querySelector('[type="submit"]'),notice=$('banner-notice');
  const value=Object.fromEntries(data);delete value.bannerFile;
  if(!value.bannerImage&&form.elements.bannerImage.dataset.savedImage==='true')value.bannerImage=storeSettings.bannerImage;
  value.announcementVisible=data.get('announcementVisible')==='on';value.bannerVisible=data.get('bannerVisible')==='on';
  value.bannerShowArtist=data.get('bannerShowArtist')==='on';
  value.bannerButtonVisible=data.get('bannerButtonVisible')==='on';
  value.reviewsVisible=data.get('reviewsVisible')==='on';
  value.bannerEyebrow=String(value.bannerEyebrow||'').trim();
  value.bannerArtistLabel=String(value.bannerArtistLabel||'').trim();
  value.bannerArtistLink=String(value.bannerArtistLink||'').trim();
  value.bannerLink=String(value.bannerLink||'').trim()||'#artworks';
  value.bannerButtonOffsetX=Number(value.bannerButtonOffsetX||0);
  value.bannerButtonOffsetY=Number(value.bannerButtonOffsetY||0);
  value.artworkSort=storeSettings.artworkSort||'manual';
  value.cartButtonMode=storeSettings.cartButtonMode||'black';
  value.bannerLimit=Number.isInteger(storeSettings.bannerLimit)?storeSettings.bannerLimit:8;
  if(homeLayoutController){
    const lv=homeLayoutController.getValue();
    value.homeSectionOrder=lv.homeSectionOrder;
    value.promoBlocks=lv.promoBlocks;
  }else{
    try{if(value.homeSectionOrderJson)value.homeSectionOrder=JSON.parse(String(value.homeSectionOrderJson));}catch{}
    try{if(value.promoBlocksJson)value.promoBlocks=JSON.parse(String(value.promoBlocksJson));}catch{}
  }
  delete value.homeSectionOrderJson;
  delete value.promoBlocksJson;
  try{value.reviewImages=collectReviews(form);}catch(error){notice.textContent=error.message;return;}
  if(value.reviewsVisible&&!value.reviewImages.length){notice.textContent='Add at least one review image or hide this section.';return;}
  if(safeStoreLink(value.announcementLink)!==value.announcementLink){notice.textContent='Use a store link such as #shop or a valid HTTPS URL for the announcement link.';return;}
  if(value.bannerLink&&safeStoreLink(value.bannerLink)!==value.bannerLink){notice.textContent='Use a store link such as #artworks or a valid HTTPS URL for the banner button link.';return;}
  if(value.bannerArtistLink&&safeStoreLink(value.bannerArtistLink)!==value.bannerArtistLink){notice.textContent='Use a store link such as #artists or a valid HTTPS URL for the artist credit link.';return;}
  button.disabled=true;notice.classList.remove('is-success');notice.textContent='Saving banners…';
  try{
    await withSavingOverlay('Saving store settings…',async()=>{
      const file=data.get('bannerFile');
      if(file?.size)value.bannerImage=await store.uploadImage(file,'store-banner');
      else if(value.bannerImage&&safeImage(value.bannerImage,'')!==value.bannerImage)throw new Error('Use an HTTPS image URL or choose an image file.');
      await store.saveSettings(normalizeSettings(value));storeSettings=normalizeSettings(value);
      settingsDirty=false;
      notice.classList.add('is-success');notice.textContent='Banners saved. Your visibility settings are live in this store.';
      if($('banner-preview'))$('banner-preview').innerHTML=bannerMarkup({...storeSettings,bannerVisible:true});
      settingsPreviewController?.update();
    });
  }catch(error){notice.textContent=store.friendlyError(error);}finally{button.disabled=false;}
}
async function showProductCustomizations(id){
  if(!user||user.isAnonymous)return;
  const target=$(`request-custom-${id}`),request=(isAdmin&&route().page==='admin'?requestList:accountState.requests).find(o=>o.id===id);if(!target||!request)return;
  target.innerHTML=skeletonMarkup('rows','Loading product notes…');
  try{
    const entries=await store.loadCustomizations(id);
    const sections=[];
    for(const entry of entries){
      const photos=[];
      for(const path of entry.images){
        try{const url=await store.referenceImageURL(path);photos.push(`<a href="${e(url)}" target="_blank" rel="noopener"><img src="${e(url)}" alt="Customer reference image"></a>`);}catch{photos.push('<p class="small">Image could not load. Try again or check access to this request.</p>');}
      }
      sections.push(`<section><h3>${e(request.items.find(item=>item.productId===entry.productId)?.title||entry.productId)}</h3><p class="product-note-copy">${e(entry.note||'Reference images only.')}</p><div class="reference-gallery">${photos.join('')}</div></section>`);
    }
    target.innerHTML=sections.join('')||'<p class="muted">No product notes or reference images were added.</p>';
  }catch(error){target.textContent=store.friendlyError(error);}
}
function destroyAdminControllers(){
  contentEditor?.destroy();contentEditor=null;
  ordersMapController?.destroy();ordersMapController=null;
  labelTemplateController?.destroy();labelTemplateController=null;
  artistStudioController?.destroy();artistStudioController=null;
  settingsPreviewController?.destroy();settingsPreviewController=null;
  productsPreviewController?.destroy();productsPreviewController=null;
  promosAdminController?.destroy();promosAdminController=null;
  homeLayoutController?.destroy();homeLayoutController=null;
  if(bannerPreviewObjectUrl){URL.revokeObjectURL(bannerPreviewObjectUrl);bannerPreviewObjectUrl='';}
}
function hasUnsavedAdminChanges(){
  return Boolean(contentEditor?.isDirty?.()||labelTemplateController?.isDirty?.()||artistStudioController?.isDirty?.()||promosAdminController?.isDirty?.()||(adminTab==='settings'&&settingsDirty));
}
function syncProductsPreview(){
  const host=$('admin-products-preview');
  const btn=document.querySelector('[data-action="toggle-products-preview"]');
  if(btn)btn.textContent=productsPreviewOpen?'Hide storefront preview':'Preview storefront 👁';
  if(!host)return;
  host.hidden=!productsPreviewOpen;
  if(!productsPreviewOpen){
    productsPreviewController?.destroy();productsPreviewController=null;
    host.innerHTML='';
    return;
  }
  if(!productsPreviewController){
    productsPreviewController=mountSitePreviewPanel(host,{
      getContent:()=>siteContent,
      getProducts:()=>products,
      getSettings:()=>storeSettings,
      getHeader:()=>document.querySelector('.site-header').outerHTML,
      getArtists:()=>artists,
      initialPage:'home',
      title:'Live storefront preview',
      height:460
    });
  }else{
    productsPreviewController.update();
  }
}
function confirmLeaveAdminTab(){
  if(!hasUnsavedAdminChanges())return true;
  return window.confirm('You have unsaved changes in this tab. Leave without saving?');
}
function updateAdminOrdersBadge(){
  const badge=$('admin-orders-badge');
  if(!badge)return;
  const count=countActionableOrders(requestList);
  badge.textContent=count;
  badge.hidden=!count;
}
function renderAdmin(){
  if(authLoading){$('main').innerHTML=pageSkeleton('admin');return;}
  if(!isAdmin){renderAccount();return;}
  const routeId=route().id;
  if(routeId){
    const resolved=normalizeAdminTab(routeId);
    adminTab=resolved.tab;
    if(resolved.policyTab)activePolicyTab=resolved.policyTab;
  }
  destroyAdminControllers();
  if(!requestsLoaded)void fetchRequests();
  const existingNav=document.querySelector('.admin-layout .admin-nav');
  if(existingNav&&$('admin-content')){
    existingNav.querySelectorAll('.admin-tab[data-tab]').forEach(btn=>{
      btn.classList.toggle('active',btn.dataset.tab===adminTab);
    });
    updateAdminOrdersBadge();
    const activeBtn=existingNav.querySelector('.admin-tab.active');
    if(activeBtn){
      const left=activeBtn.offsetLeft,right=left+activeBtn.offsetWidth;
      if(left<existingNav.scrollLeft)existingNav.scrollLeft=Math.max(0,left-12);
      else if(right>existingNav.scrollLeft+existingNav.clientWidth)existingNav.scrollLeft=right-existingNav.clientWidth+12;
    }
    renderAdminContent();
    return;
  }
  $('main').innerHTML=`<div class="wide-container admin-layout">${adminSidebarMarkup({activeTab:adminTab,actionableCount:countActionableOrders(requestList),user,logoutHtml:logoutMarkup()})}<section class="admin-main" id="admin-content"></section></div>`;renderAdminContent();mountLogout();
  document.querySelector('.admin-layout .admin-tab.active')?.scrollIntoView({behavior:'instant',inline:'center',block:'nearest'});
}
function renderAdminContent(){
  if(deferPageRender(render))return;
  if(!$('admin-content')){render();return;}
  destroyAdminControllers();
  if(adminTab==='sales'){mountSalesDashboard($('admin-content'),{load:store.loadSales,getProducts:()=>products});
  }else if(adminTab==='promos'){
    promosAdminController=mountPromosAdmin($('admin-content'),{
      getPromos:()=>storePromos,
      onSavePromos:async next=>{
        const updated=normalizePromos(next);
        await withSavingOverlay('Saving promos & bundles…',()=>store.savePromos(updated));
        storePromos=updated;
      }
    });
  }else if(adminTab==='backup'){
    mountBackupExport($('admin-content'),{
      getSnapshot:async()=>{
        const [ordersRes,salesRes]=await Promise.allSettled([
          requestsLoaded?Promise.resolve(requestList):store.loadRequests(),
          store.loadSales()
        ]);
        if(ordersRes.status==='fulfilled'){
          requestList=ordersRes.value;
          requestsLoaded=true;
        }
        return {
          products,
          artists,
          content:siteContent,
          settings:storeSettings,
          promos:storePromos,
          orders:ordersRes.status==='fulfilled'?ordersRes.value:requestList,
          sales:salesRes.status==='fulfilled'?salesRes.value:[]
        };
      },
      onRestore:async(kind,payload)=>{
        if(kind==='content'){
          const normalized=normalizeContent(payload);
          await withSavingOverlay('Restoring storefront copy…',()=>store.saveContent(normalized));
          siteContent=normalized;
          refreshStoreContent();
        }else if(kind==='settings'){
          const normalized=normalizeSettings(payload);
          await withSavingOverlay('Restoring homepage & banners…',()=>store.saveSettings(normalized));
          storeSettings=normalized;
          applyStoreBanners();
        }else if(kind==='artists'){
          const normalized=normalizeArtists(payload);
          await withSavingOverlay('Restoring artist pages…',()=>store.saveArtists(normalized));
          artists=normalized;
        }else if(kind==='promos'){
          const normalized=normalizePromos(payload);
          await withSavingOverlay('Restoring promos & bundles…',()=>store.savePromos(normalized));
          storePromos=normalized;
        }else{
          throw new Error('Unsupported backup section.');
        }
      }
    });
  }else if(adminTab==='labels'){labelTemplateController=mountLabelTemplate($('admin-content'),{load:store.loadLabel,save:store.saveLabel});
  }else if(adminTab==='artists'){
    artistStudioController=mountArtistStudio($('admin-content'),{
      getArtists:()=>artists,
      getProducts:()=>products,
      getContent:()=>siteContent,
      getSettings:()=>storeSettings,
      getHeader:()=>document.querySelector('.site-header').outerHTML,
      onUpload:file=>store.uploadImage(file,'artists'),
      onSaveArtists:async next=>{
        const updated=normalizeArtists(next);
        await withSavingOverlay('Saving artist pages…',()=>store.saveArtists(updated));
        artists=updated;
      }
    });
  }else if(adminTab==='orders-map'){
    ordersMapController=mountOrdersMap($('admin-content'),{
      getOrders:async(force=false)=>{if(force||!requestsLoaded)await fetchRequests();return requestList;},
      onPrintLabel:request=>openLabel(request,{load:store.loadLabel,save:store.saveLabel}),
      onViewOrder:orderId=>{
        highlightedOrderId=orderId;
        expandedOrderIds.add(orderId);
        orderSearch='';
        orderStatusFilter='all';
        adminTab='requests';
        location.hash='admin/requests';
      }
    });
  }else if(adminTab==='products'){
    if(!catalogReady){$('admin-content').innerHTML=`<div class="admin-title"><h1>Your artworks</h1></div>${catalogError?catalogErrorMarkup():skeletonMarkup('table','Loading artworks…')}`;return;}
    const activeSort=storeSettings.artworkSort||'manual';
    const btnMode=storeSettings.cartButtonMode||'black';
    const bannerLimit=Number.isInteger(storeSettings.bannerLimit)?storeSettings.bannerLimit:8;
    const limitOptions=[[3,'3 artworks'],[5,'5 artworks'],[8,'8 artworks (default)'],[10,'10 artworks'],[12,'12 artworks'],[15,'15 artworks'],[20,'20 artworks'],[0,'No limit (all banner pieces)']];
    $('admin-content').innerHTML=`<div class="admin-title"><div><h1>Your artworks</h1><p>Manage your artworks, homepage &amp; banner visibility, stock, pricing and display order.</p></div><div class="admin-title-actions"><button type="button" class="button outline small" data-action="toggle-products-preview">${productsPreviewOpen?'Hide storefront preview':'Preview storefront 👁'}</button><button class="button" data-action="new-product">+ Add artwork</button></div></div><div class="stats-grid"><div class="stat"><span>Total artworks</span><strong id="admin-total-count">${products.length}</strong></div><div class="stat"><span>Published</span><strong id="admin-published-count">${products.filter(p=>p.visible).length}</strong></div><div class="stat"><span>Sold out</span><strong id="admin-sold-count">${products.filter(p=>!p.stock).length}</strong></div></div><div id="admin-products-preview" class="products-preview-panel" ${productsPreviewOpen?'':'hidden'}></div><div class="admin-filters"><input id="admin-search" aria-label="Search admin products" placeholder="Search artworks by title, artist or SKU…" value="${e(adminSearch)}"><label class="admin-sort-control"><span>Storefront order</span><select id="admin-artwork-sort" aria-label="Storefront artwork display order">${ARTWORK_SORT_MODES.map(([val,label])=>`<option value="${e(val)}" ${activeSort===val?'selected':''}>${e(label)}</option>`).join('')}</select></label><label class="admin-sort-control"><span>Add to cart buttons</span><select id="admin-cart-btn-mode" aria-label="Add to cart button style"><option value="black" ${btnMode==='black'?'selected':''}>Black buttons (default)</option><option value="artwork" ${btnMode==='artwork'?'selected':''}>Match artwork color</option></select></label><label class="admin-sort-control"><span>Banner limit</span><select id="admin-banner-limit" aria-label="Maximum artworks shown in banner">${limitOptions.map(([val,label])=>`<option value="${val}" ${bannerLimit===val?'selected':''}>${e(label)}</option>`).join('')}</select></label></div><div id="admin-product-table"></div>`;renderAdminTable();syncProductsPreview();
  }else if(adminTab==='requests'){
    $('admin-content').innerHTML=`<div class="admin-title"><div><h1>Orders & requests</h1><p>Search, filter, update fulfilment and print labels. Shipping is ₹${SHIPPING_CHARGE} per item.</p></div><button class="button outline small" data-action="refresh-requests">Refresh</button></div><div id="requests-shell">${requestsLoaded?'':skeletonMarkup('rows','Loading requests…')}</div>`;
    if(requestsLoaded)renderRequests();else fetchRequests();
  }else if(adminTab==='policies'){
    if(!contentReady&&!contentError){$('admin-content').innerHTML=skeletonMarkup('editor','Loading your published pages…');return;}
    $('admin-content').innerHTML=`<div class="admin-title"><div><h1>Pages &amp; policies</h1><p>Edit your contact page and store policies from one place.</p></div></div>${policySubnavMarkup(activePolicyTab)}<div id="admin-policy-editor"></div>`;
    contentEditor=mountContentEditor($('admin-policy-editor'),siteContent,{pageOnly:activePolicyTab,
      draft:contentDraft,loadError:contentError,products:()=>products,settings:()=>storeSettings,header:()=>document.querySelector('.site-header').outerHTML,artists:()=>artists,
      onDraft:value=>{contentDraft=value;},
      onUpload:file=>store.uploadImage(file,'store-content'),
      onPublish:async value=>{if(!isAdmin)throw new Error('Sign in with an administrator account to publish.');try{await store.saveContent(value);}catch(error){throw new Error(store.friendlyError(error));}siteContent=normalizeContent(value);refreshStoreContent();}
    });
  }else if(adminTab==='content'){
    if(!contentReady&&!contentError){$('admin-content').innerHTML=skeletonMarkup('editor','Loading your published pages…');return;}
    contentEditor=mountContentEditor($('admin-content'),siteContent,{pageOnly:'',
      draft:contentDraft,loadError:contentError,products:()=>products,settings:()=>storeSettings,header:()=>document.querySelector('.site-header').outerHTML,artists:()=>artists,
      onDraft:value=>{contentDraft=value;},
      onUpload:file=>store.uploadImage(file,'store-content'),
      onPublish:async value=>{if(!isAdmin)throw new Error('Sign in with an administrator account to publish.');try{await store.saveContent(value);}catch(error){throw new Error(store.friendlyError(error));}siteContent=normalizeContent(value);refreshStoreContent();}
    });
  }else{
    if(!settingsReady){$('admin-content').innerHTML=settingsError?`<p class="notice" role="alert">${e(settingsError)}</p>`:skeletonMarkup('form','Loading store settings…');return;}
    settingsDirty=false;
    $('admin-content').innerHTML=`<div class="admin-title"><div><h1>Homepage &amp; banners</h1><p>Edit announcement bar, banner copy, action button placement, homepage section order, promo blocks and customer reviews — click text right in the preview or edit fields below.</p></div></div><div class="content-workspace settings-workspace">${settingsForm(storeSettings)}<div id="settings-live-preview"></div></div>`;
    mountReviewEditor($('admin-content'),storeSettings.reviewImages);
    const resolveBannerCtrl=id=>{
      const f=$('banner-form');
      if(!f||!id)return null;
      if(id.startsWith('promo:')){
        const [,pid,key]=id.split(':');
        return $('home-layout-editor-slot')?.querySelector(`[data-promo-id="${CSS.escape(pid)}"][data-promo-field="${CSS.escape(key)}"]`)||null;
      }
      if(id.startsWith('settings:'))return f.elements[id.slice(9)]||null;
      return f.elements[id]||null;
    };
    const syncBannerInline=(id,text)=>{
      const f=$('banner-form');
      if(!f||!id)return;
      if(id.startsWith('promo:')){
        const [,pid,key]=id.split(':');
        homeLayoutController?.setBlockField?.(pid,key,text);
        return;
      }
      const fieldName=id.startsWith('settings:')?id.slice(9):id;
      const ctrl=f.elements[fieldName];
      if(ctrl&&ctrl.value!==text)ctrl.value=text;
      settingsDirty=true;
    };
    const bannerInlineTargets=()=>{
      const d=draftSettingsFromForm();
      const list=[
        {id:'settings:announcementText',selector:'.announcement .announcement-text, .announcement',kinds:['home'],max:160,value:d.announcementText||''},
        {id:'settings:bannerEyebrow',selector:'.hero-banner-eyebrow',kinds:['home'],max:80,value:d.bannerEyebrow||''},
        {id:'settings:bannerTitle',selector:'.hero-banner-heading',kinds:['home'],max:100,value:d.bannerTitle||''},
        {id:'settings:bannerText',selector:'.hero-banner-subtext',kinds:['home'],multiline:true,max:400,value:d.bannerText||''},
        {id:'settings:bannerArtistLabel',selector:'.hero-banner-artist',kinds:['home'],max:160,allowMismatch:true},
        {id:'settings:bannerButton',selector:'.hero-banner-cta .hero-cta-label',kinds:['home'],max:50,allowMismatch:true}
      ];
      for(const b of d.promoBlocks||[]){
        if(!b?.id||b.enabled===false)continue;
        const base=`[data-promo-block="${b.id}"]`;
        if(b.eyebrow)list.push({id:`promo:${b.id}:eyebrow`,selector:`${base} .promo-block-copy .eyebrow`,kinds:['home'],max:80,value:b.eyebrow});
        if(b.heading)list.push({id:`promo:${b.id}:heading`,selector:`${base} .promo-block-copy h2`,kinds:['home'],max:120,value:b.heading});
        if(b.body)list.push({id:`promo:${b.id}:body`,selector:`${base} .promo-block-body`,kinds:['home'],multiline:true,max:600,value:b.body});
        if(b.buttonLabel)list.push({id:`promo:${b.id}:buttonLabel`,selector:`${base} .promo-cta-label`,kinds:['home'],max:50,value:b.buttonLabel});
      }
      list.push(
        {id:'goto:catalog',selector:'.home-artworks-section .home-intro h2, .home-artworks-section .home-intro .eyebrow',kinds:['home'],type:'goto',tab:'content',tabLabel:'Storefront editor',label:'Catalogue headings'},
        {id:'goto:story',selector:'.story-block',kinds:['home'],type:'goto',tab:'content',tabLabel:'Storefront editor',label:'The story section'},
        {id:'goto:footer',selector:'#footer',kinds:['home'],type:'goto',tab:'content',tabLabel:'Storefront editor',label:'The footer'},
        {id:'goto:products',selector:'.product-card',kinds:['home'],type:'goto',tab:'products',tabLabel:'Your artworks',label:'Artwork cards'}
      );
      return list;
    };
    settingsPreviewController=mountSitePreviewPanel($('settings-live-preview'),{
      getContent:()=>siteContent,
      getProducts:()=>products,
      getSettings:draftSettingsFromForm,
      getHeader:()=>document.querySelector('.site-header').outerHTML,
      getArtists:()=>artists,
      initialPage:'home',
      title:'Live homepage preview',
      height:580,
      inlineTargets:bannerInlineTargets,
      onInlineStart:t=>flashControl(resolveBannerCtrl(t.id)),
      onInlineInput:(t,text)=>syncBannerInline(t.id,text),
      onInlineCommit:(t,text)=>syncBannerInline(t.id,text),
      onInlinePick:t=>{
        if(t.tab){
          const notice=$('banner-notice');
          if(notice){
            const link=document.createElement('a');link.className='text-link';link.href=`#admin/${t.tab}`;link.textContent=t.tabLabel;
            notice.classList.remove('is-success');
            notice.replaceChildren(document.createTextNode(`${t.label} is edited in `),link,document.createTextNode('.'));
          }
          return;
        }
        flashControl(resolveBannerCtrl(t.id),{focus:true});
      }
    });
    const layoutSlot=$('home-layout-editor-slot');
    if(layoutSlot){
      homeLayoutController=mountHomeLayoutEditor(layoutSlot,{
        initialOrder:storeSettings.homeSectionOrder,
        initialBlocks:storeSettings.promoBlocks,
        onUpload:file=>store.uploadImage(file,'store-promo'),
        onChange:({homeSectionOrder,promoBlocks})=>{
          const f=$('banner-form');
          if(f?.elements.homeSectionOrderJson)f.elements.homeSectionOrderJson.value=JSON.stringify(homeSectionOrder);
          if(f?.elements.promoBlocksJson)f.elements.promoBlocksJson.value=JSON.stringify(promoBlocks);
          settingsDirty=true;
          settingsPreviewController?.update();
        },
        onHighlight:selector=>{
          settingsPreviewController?.highlight?.(selector,{page:'home'});
        }
      });
    }
    const bannerFormEl=$('banner-form');
    if(bannerFormEl){
      const highlightBannerControl=el=>{
        if(!el||el.closest('#home-layout-editor-slot'))return;
        const name=el.name||'';
        const map={
          announcementVisible:'.announcement',
          announcementText:'.announcement',
          announcementLink:'.announcement',
          bannerVisible:'[data-hero-banner]',
          bannerImage:'[data-hero-banner]',
          bannerFile:'[data-hero-banner]',
          bannerEyebrow:'.hero-banner-eyebrow || .hero-text-plate',
          bannerTitle:'.hero-banner-heading || .hero-text-plate',
          bannerText:'.hero-banner-subtext || .hero-text-plate',
          bannerShowArtist:'.hero-banner-artist || .hero-text-plate',
          bannerArtistLabel:'.hero-banner-artist || .hero-text-plate',
          bannerArtistLink:'.hero-banner-artist || .hero-text-plate',
          bannerButtonVisible:'.hero-banner-cta || [data-hero-banner]',
          bannerButton:'.hero-banner-cta || [data-hero-banner]',
          bannerLink:'.hero-banner-cta || [data-hero-banner]',
          bannerButtonStyle:'.hero-banner-cta || [data-hero-banner]',
          bannerButtonPosition:'.hero-banner-cta || [data-hero-banner]',
          bannerButtonOffsetX:'.hero-banner-cta || [data-hero-banner]',
          bannerButtonOffsetY:'.hero-banner-cta || [data-hero-banner]',
          reviewsVisible:'#reviews || .reviews-section'
        };
        const sel=el.closest('[data-action="pick-banner-cta-pos"],[data-action="pick-banner-cta-style"],[data-action="reset-banner-cta-pos"]')
          ?'.hero-banner-cta || [data-hero-banner]'
          :(el.closest('.review-editor-card,#review-editor-list,[data-review-slot]')?'#reviews || .reviews-section':map[name]);
        if(sel)settingsPreviewController?.highlight?.(sel,{page:'home'});
      };
      bannerFormEl.addEventListener('focusin',ev=>{
        const ctrl=ev.target.closest('input,textarea,select');
        if(ctrl)highlightBannerControl(ctrl);
      });
      bannerFormEl.addEventListener('click',ev=>{
        const ctrl=ev.target.closest('[data-action="pick-banner-cta-pos"],[data-action="pick-banner-cta-style"],[data-action="reset-banner-cta-pos"],input[type=checkbox],input[type=file]');
        if(ctrl)highlightBannerControl(ctrl);
        setTimeout(()=>{if($('banner-form'))settingsPreviewController?.update();},60);
      });
    }
  }
}
function renderAdminTable(){const activeSort=storeSettings.artworkSort||'manual';const isManual=activeSort==='manual';const ordered=sortArtworks(products,activeSort);const list=ordered.filter(p=>`${p.title} ${p.artist||''} ${p.productType||''} ${p.sku}`.toLowerCase().includes(adminSearch.toLowerCase()));$('admin-product-table').innerHTML=list.length?`<div class="table-wrap"><table class="admin-products-table"><thead><tr><th>Order</th><th>Artwork</th><th>Show in</th><th>Category</th><th>Artist</th><th>Inventory</th><th>Price</th><th></th></tr></thead><tbody>${list.map(p=>{const pos=ordered.findIndex(item=>item.id===p.id);const onHome=p.visible===true&&!p.archived;const onBanner=p.inBanner!==false&&!p.archived;const stockCell=`<button type="button" class="stock-toggle-pill ${p.stock?'is-in-stock':'is-sold-out'}" data-action="toggle-stock" data-id="${e(p.id)}" title="Click to toggle availability">${p.stock?`${p.stock} in stock`:'Sold out'}</button>`;const priceCell=inlinePriceEditId===p.id?`<form class="inline-price-form" data-inline-price-id="${e(p.id)}"><input type="number" name="price" min="0.01" max="10000000" step="0.01" value="${e(p.price)}" aria-label="New price for ${e(p.title)}" required><button type="submit" class="inline-price-save" aria-label="Save price"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 13l4 4L19 7"/></svg></button><button type="button" class="inline-price-cancel" data-action="cancel-inline-price" aria-label="Cancel price edit"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button></form>`:`<div class="price-cell-wrap"><strong>${money(p.price)}</strong><button type="button" class="inline-price-btn" data-action="edit-inline-price" data-id="${e(p.id)}" aria-label="Quick edit price for ${e(p.title)}" title="Quick edit price"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg></button></div>`;return `<tr><td data-label="Order"><div class="admin-order-controls"><span class="order-rank-badge">#${pos+1}</span>${isManual?`<button type="button" class="order-move-btn" data-action="move-product" data-id="${e(p.id)}" data-dir="-1" aria-label="Move ${e(p.title)} up" ${pos===0?'disabled':''}><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg></button><button type="button" class="order-move-btn" data-action="move-product" data-id="${e(p.id)}" data-dir="1" aria-label="Move ${e(p.title)} down" ${pos===ordered.length-1?'disabled':''}><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg></button>`:''}</div></td><td data-label="Artwork"><div class="table-product"><img src="${e(imageOf(p))}" alt=""><span><strong>${e(p.title)}</strong>${p.featured?' <span title="Featured">✳</span>':''}</span></div></td><td data-label="Show in"><div class="admin-flag-group"><button type="button" class="admin-flag-toggle ${onHome?'is-on':''}" data-action="toggle-product-flag" data-id="${e(p.id)}" data-field="visible" aria-pressed="${onHome?'true':'false'}"><span class="toggle-track" aria-hidden="true"></span><span>Homepage</span></button><button type="button" class="admin-flag-toggle is-banner ${onBanner?'is-on':''}" data-action="toggle-product-flag" data-id="${e(p.id)}" data-field="inBanner" aria-pressed="${onBanner?'true':'false'}"><span class="toggle-track" aria-hidden="true"></span><span>Banner</span></button></div></td><td data-label="Category">${e(p.productType||'Fridge Magnet')}</td><td data-label="Artist">${e(p.artist||'Suprita Chatterjee')}</td><td data-label="Inventory">${stockCell}</td><td data-label="Price">${priceCell}</td><td class="table-action-cell"><button class="table-action" data-action="edit-product" data-id="${e(p.id)}" aria-label="Edit ${e(p.title)}">Edit artwork</button></td></tr>`;}).join('')}</tbody></table></div>`:'<div class="empty-state"><h2>No artworks yet.</h2><p>Add an artwork or change your search.</p></div>';}
async function quickToggleStock(id){
  if(!isAdmin)return;
  const idx=products.findIndex(p=>p.id===id);
  if(idx<0)return;
  const current=products[idx];
  const prevSnapshot={...current};
  if(current.stock>0)previousPositiveStock.set(id,current.stock);
  const nextStock=current.stock>0?0:(previousPositiveStock.get(id)||1);
  const nextProduct={...current,stock:nextStock,archived:false};
  products=products.map((item,i)=>i===idx?nextProduct:item);
  renderAdminTable();
  if($('admin-sold-count'))$('admin-sold-count').textContent=products.filter(p=>!p.stock).length;
  try{
    await withSavingOverlay('Updating inventory…',()=>store.saveProduct(nextProduct,id));
    toast(nextStock?`"${current.title}" marked in stock (${nextStock}).`:`"${current.title}" marked sold out.`);
  }catch(error){
    products=products.map((item,i)=>i===idx?prevSnapshot:item);
    renderAdminTable();
    if($('admin-sold-count'))$('admin-sold-count').textContent=products.filter(p=>!p.stock).length;
    toast(store.friendlyError(error));
  }
}
async function saveInlinePrice(id,rawPrice){
  if(!isAdmin)return;
  const idx=products.findIndex(p=>p.id===id);
  if(idx<0)return;
  const nextPrice=Number(rawPrice);
  if(!Number.isFinite(nextPrice)||nextPrice<=0||nextPrice>10000000){toast('Enter a valid price greater than zero.');return;}
  const current=products[idx];
  const prevSnapshot={...current};
  const nextCompare=current.comparePrice&&current.comparePrice>nextPrice?current.comparePrice:0;
  const nextProduct={...current,price:nextPrice,comparePrice:nextCompare,archived:false};
  inlinePriceEditId=null;
  products=products.map((item,i)=>i===idx?nextProduct:item);
  renderAdminTable();
  try{
    await withSavingOverlay('Updating price…',()=>store.saveProduct(nextProduct,id));
    toast(`Price for "${current.title}" updated to ${money(nextPrice)}.`);
  }catch(error){
    products=products.map((item,i)=>i===idx?prevSnapshot:item);
    renderAdminTable();
    toast(store.friendlyError(error));
  }
}
async function toggleProductFlag(id,field){
  if(!isAdmin||!['visible','inBanner'].includes(field))return;
  const idx=products.findIndex(p=>p.id===id);
  if(idx<0)return;
  const current=products[idx];
  const prevSnapshot={...current};
  const nextVal=field==='visible'?!current.visible:!(current.inBanner!==false);
  const nextProduct={...current,[field]:nextVal,archived:false};
  if(field==='inBanner'&&nextVal&&!current.visible)nextProduct.visible=true;
  products=products.map((item,i)=>i===idx?nextProduct:item);
  renderAdminTable();
  if($('admin-published-count'))$('admin-published-count').textContent=products.filter(p=>p.visible).length;
  try{
    await withSavingOverlay(field==='visible'?'Updating homepage visibility…':'Updating banner visibility…',()=>store.saveProduct(nextProduct,id));
    if(field==='visible')toast(nextVal?`"${current.title}" shown on homepage.`:`"${current.title}" hidden from homepage.`);
    else toast(nextVal?`"${current.title}" added to homepage banner.`:`"${current.title}" removed from homepage banner.`);
  }catch(error){
    products=products.map((item,i)=>i===idx?prevSnapshot:item);
    renderAdminTable();
    if($('admin-published-count'))$('admin-published-count').textContent=products.filter(p=>p.visible).length;
    toast(store.friendlyError(error));
  }
}
function renderAdminArtists(){
  const list=mergeArtistsWithProducts(artists,products);
  $('admin-content').innerHTML=`<div class="admin-title"><div><h1>Artists</h1><p>Customize each artist’s photo, signature style name and bio for their storefront page.</p></div><button class="button" data-action="new-artist">+ Add artist</button></div><div class="admin-artist-grid">${list.map(a=>`<article class="admin-artist-card"><div class="admin-artist-head"><img src="${e(safeImage(a.coverImage,'assets/artwork-1.jpg'))}" alt="${e(a.name)}"><div><span class="artist-style-pill">${e(a.style||'Independent Studio Artist')}</span><h2>${e(a.name)}</h2><p class="small muted">${a.artworkCount} published ${a.artworkCount===1?'artwork':'artworks'}</p></div></div><p class="admin-artist-oneliner">${e(a.oneLiner||'')}</p><div class="admin-artist-actions"><a class="text-link" href="#artist/${e(a.id)}">View page ↗</a><button type="button" class="table-action" data-action="edit-artist" data-id="${e(a.id)}">Edit profile</button></div></article>`).join('')}</div>`;
}
function openArtistEditor(id){
  if(!isAdmin)return;
  const all=mergeArtistsWithProducts(artists,products);
  const existing=id?all.find(a=>a.id===id):null;
  editingArtistId=existing?existing.id:null;
  const a=existing||{name:'',style:'',oneLiner:'',about:'',photo:''};
  $('editor-dialog').innerHTML=`<div class="drawer-header"><div><p class="eyebrow">hehe.cafe / Artists</p><h2 id="editor-title">${existing?'Edit artist profile':'Add artist'}</h2></div><button class="icon-button" data-action="close-dialog" aria-label="Close artist editor"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button></div><form id="artist-form"><div class="form-grid"><label class="field">Artist name<input name="name" required maxlength="120" value="${e(a.name)}" placeholder="e.g. Suprita Chatterjee"></label><label class="field">Signature style name<input name="style" required maxlength="120" value="${e(a.style)}" placeholder="e.g. Hand-Sculpted Clay &amp; Watercolour"></label><label class="field wide">One-liner for artist card<input name="oneLiner" required maxlength="220" value="${e(a.oneLiner)}" placeholder="Short poetic summary shown on the Artists directory card…"></label><label class="field wide">About the artist (shown on their page banner)<textarea name="about" maxlength="2000" placeholder="Share their story, mediums and inspirations…">${e(a.about)}</textarea></label><label class="field wide">Photo URL or leave existing saved photo<input name="photo" maxlength="100000" data-saved-photo="${e(a.photo||'')}" placeholder="https://… or upload below" value="${a.photo&&!a.photo.startsWith('data:')?e(a.photo):''}"></label><label class="field wide">Or upload artist photo · JPG, PNG, WebP · up to 6 MB<input id="artist-photo-file" name="photoFile" type="file" accept="image/jpeg,image/png,image/webp"></label></div><div class="image-preview-grid" id="artist-photo-preview">${a.photo?`<img src="${e(safeImage(a.photo))}" alt="Artist photo preview">`:''}</div><div class="editor-actions">${existing&&artists.length>1?`<button type="button" class="danger-link" data-action="delete-artist" data-id="${e(existing.id)}">Remove artist</button>`:'<span></span>'}<button id="save-artist" class="button" type="submit">${existing?'Save artist':'Add artist'} →</button></div><p id="artist-notice" class="notice" role="alert"></p></form>`;
  openDialog('editor-dialog');
}
async function submitArtist(event){
  event.preventDefault();if(!isAdmin)return;
  const form=event.target,data=new FormData(form),notice=$('artist-notice'),button=$('save-artist');
  const name=String(data.get('name')||'').trim();
  const style=String(data.get('style')||'').trim();
  const oneLiner=String(data.get('oneLiner')||'').trim();
  const about=String(data.get('about')||'').trim();
  if(!name||!style||!oneLiner){notice.textContent='Enter the artist name, style and one-liner.';return;}
  let photo=String(data.get('photo')||'').trim()||form.elements.photo?.dataset.savedPhoto||'';
  const file=data.get('photoFile');
  button.disabled=true;button.textContent='Saving…';notice.textContent='';
  try{
    await withSavingOverlay('Saving artist profile…',async()=>{
      if(file?.size)photo=await store.uploadImage(file,'artists');
      const nextId=editingArtistId||artistSlug(name);
      const entry={id:nextId,name,style,oneLiner,about,photo};
      const base=normalizeArtists(artists).filter(a=>a.id!==nextId);
      const updated=normalizeArtists([entry,...base]);
      await store.saveArtists(updated);
      artists=updated;
      $('editor-dialog').close();
      if(adminTab==='artists')renderAdminArtists();
      toast(`Saved artist profile for ${name}.`);
    });
  }catch(error){
    notice.textContent=store.friendlyError(error);
  }finally{
    button.disabled=false;button.textContent='Save artist →';
  }
}
async function moveProductOrder(id,direction){
  if(!isAdmin)return;
  const ordered=sortArtworks(products);
  const idx=ordered.findIndex(p=>p.id===id);
  const targetIdx=idx+direction;
  if(idx<0||targetIdx<0||targetIdx>=ordered.length)return;
  const reordered=[...ordered];
  const [moved]=reordered.splice(idx,1);
  reordered.splice(targetIdx,0,moved);
  const changed=[];
  reordered.forEach((item,i)=>{
    const nextOrder=i+1;
    if(item.displayOrder!==nextOrder){
      item.displayOrder=nextOrder;
      changed.push(item);
    }
  });
  products=reordered;
  renderAdminTable();
  try{
    await withSavingOverlay('Updating artwork order…',async()=>{
      for(const item of changed){
        await store.saveProduct({...item,displayOrder:item.displayOrder},item.id);
      }
    });
    toast(`Moved "${moved.title}" to #${targetIdx+1}.`);
    syncProductsPreview();
  }catch(error){
    toast(store.friendlyError(error));
  }
}
async function fetchRequests(){try{requestList=await store.loadRequests();requestsError='';}catch(error){requestsError=store.friendlyError(error);}requestsLoaded=true;updateAdminOrdersBadge();if($('requests-shell'))renderRequests();}
function manualPaymentControls(o){
  const manual=o.paymentMethod==='manual',captured=o.paymentStatus==='captured',refunded=o.paymentStatus==='refunded';
  const canPaid=o.status==='contacted'&&!!o.quote&&o.inventoryReserved&&!['pending','captured','refunded'].includes(o.paymentStatus)&&!o.razorpayOrderId;
  const canUnpaid=manual&&captured&&['contacted','processing'].includes(o.status);
  const help=canPaid?'Only record money already received.':o.razorpayOrderId||o.paymentStatus==='failed'||o.paymentStatus==='pending'?'A Razorpay session already exists; verify its result in Razorpay before recording an offline payment.':!o.quote||!o.inventoryReserved?'Confirm the total and reserve stock first.':o.status!=='contacted'?'This request must be contacted before payment can be recorded.': 'Payment status is controlled by the verified Razorpay record.';
  let controls='';
  if(manual&&captured&&o.status==='cancelled'&&o.refundStatus==='required')controls='<button class="button outline small" data-action="manual-refund" data-id="'+e(o.id)+'">Mark offline refund complete</button><p class="small muted">Return the funds first.</p>';
  else if(canUnpaid)controls='<button class="button outline small" data-action="manual-unpaid" data-id="'+e(o.id)+'">Mark unpaid</button>';
  else if(!captured&&!refunded)controls='<button type="button" class="button small" data-action="manual-paid" data-id="'+e(o.id)+'" '+(canPaid?'':'disabled')+'>Mark paid</button><button type="button" class="button outline small" disabled>Mark unpaid</button><p class="small muted">'+e(help)+'</p>';
  else controls='<p class="small muted">'+(manual?'Offline payment recorded · '+e(o.manualPayment?.method||'Payment')+' · Reference '+e(o.manualPayment?.reference||''):'Razorpay payment is verified. Use Razorpay refund controls for any reversal.')+'</p>';
  const paymentTitle=captured?'Payment successful':refunded?'Payment refunded':(o.paymentStatus==='failed'||o.status==='cancelled'||o.razorpayOrderId)?'Payment failed':'Unpaid';
  if(!captured&&!refunded)return '<section class="manual-payment-controls"><h3>Payment status · '+paymentTitle+'</h3><label class="field">Offline method<select name="manual-method"><option value="upi">UPI</option><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="other">Other</option></select></label><label class="field">Receipt / transaction reference<input name="manual-reference" minlength="3" maxlength="100" autocomplete="off" placeholder="UPI UTR or receipt number"></label>'+controls+'</section>';
  return '<section class="manual-payment-controls"><h3>Payment status · '+paymentTitle+(manual?' · Offline':'')+'</h3>'+controls+'</section>';
}
function updateBatchLabelBar(){
  const validIds=new Set(requestList.map(o=>o.id));
  for(const id of [...selectedLabelOrders])if(!validIds.has(id))selectedLabelOrders.delete(id);
  const count=selectedLabelOrders.size;
  const countEl=$('batch-label-count');
  if(countEl)countEl.textContent=count?`${count} ${count===1?'order':'orders'} selected`:'Select orders to print labels (4-in-1 A4 or thermal)';
  const clearBtn=document.querySelector('[data-action="select-labels-clear"]');
  const a4Btn=document.querySelector('[data-action="print-batch-a4"]');
  const thermalBtn=document.querySelector('[data-action="print-batch-thermal"]');
  if(clearBtn)clearBtn.disabled=count===0;
  if(a4Btn){a4Btn.disabled=count===0;a4Btn.textContent=`Print A4 4-in-1${count?` (${count})`:''} ↗`;}
  if(thermalBtn){thermalBtn.disabled=count===0;thermalBtn.textContent=`Print thermal${count?` (${count})`:''} ↗`;}
  document.querySelectorAll('[data-select-label-order]').forEach(cb=>{
    const checked=selectedLabelOrders.has(cb.dataset.selectLabelOrder);
    cb.checked=checked;
    cb.closest('.order-card')?.classList.toggle('is-label-selected',checked);
  });
}
function renderRequests(){
  const shell=$('requests-shell');if(!shell)return;
  const validIds=new Set(requestList.map(o=>o.id));
  for(const id of [...selectedLabelOrders])if(!validIds.has(id))selectedLabelOrders.delete(id);
  if(requestsError){shell.innerHTML=`<p class="notice" role="alert">${e(requestsError)}</p>`;return;}
  if(!requestList.length){shell.innerHTML='<div class="empty-state"><span class="empty-icon">↘</span><h2>All quiet for now.</h2><p>Saved checkout requests will appear here.</p></div>';return;}
  shell.innerHTML=`<div id="orders-toolbar-wrap">${ordersToolbarMarkup({counts:orderFilterCounts(requestList),query:orderSearch,status:orderStatusFilter,selectedCount:selectedLabelOrders.size})}</div><div id="orders-cards-wrap"></div>`;
  renderOrdersCards();
}
function renderOrdersCards(){
  const wrap=$('orders-cards-wrap');if(!wrap)return;
  const validIds=new Set(requestList.map(o=>o.id));
  for(const id of [...selectedLabelOrders])if(!validIds.has(id))selectedLabelOrders.delete(id);
  const counts=orderFilterCounts(requestList);
  document.querySelectorAll('[data-action="set-order-filter"]').forEach(btn=>{
    const key=btn.dataset.status||'all';
    const active=key===orderStatusFilter;
    btn.classList.toggle('is-active',active);
    btn.setAttribute('aria-pressed',String(active));
    const span=btn.querySelector('span');
    if(span&&Object.hasOwn(counts,key))span.textContent=counts[key];
  });
  updateBatchLabelBar();
  const filtered=filterOrders(requestList,{query:orderSearch,status:orderStatusFilter});
  wrap.innerHTML=filtered.length?filtered.map(o=>{
    const statusOptionsHtml=ORDER_STATUSES.filter(([value])=>!['cancel_requested','cancelled'].includes(value)).map(([value,label])=>`<option value="${value}" ${o.status===value?'selected':''} ${value!==o.status&&!canTransition(o,value)?'disabled':''}>${label}</option>`).join('');
    return orderCardMarkup(o,{
      selected:selectedLabelOrders.has(o.id),
      open:expandedOrderIds.has(o.id),
      highlighted:highlightedOrderId===o.id,
      manualPaymentHtml:manualPaymentControls(o),
      statusOptionsHtml,
      statusSelectDisabled:availableStatuses(o).length<2,
      statusHelpText:statusHelp(o),
      locationUrl:locationLink(o.customer),
      hasPin:validLocation(o.customer.location),
      shippingNote:o.quote?.shipping?` · Shipping ${money(o.quote.shipping/100)}`:o.quote?.freeShipping?' · Free shipping':''
    });
  }).join(''):'<div class="empty-state"><h2>No matching orders</h2><p>Try another search term or status filter.</p></div>';
  if(highlightedOrderId){
    const targetId=highlightedOrderId;
    const card=wrap.querySelector(`[data-order-id="${CSS.escape(targetId)}"]`);
    if(card){
      card.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});
      setTimeout(()=>{card.classList.remove('is-highlighted');if(highlightedOrderId===targetId)highlightedOrderId=null;},2400);
    }
  }
}
function openEditor(id){
  if(!isAdmin)return;editingId=id||null;const ordered=sortArtworks(products);const currentIndex=id?ordered.findIndex(item=>item.id===id):-1;const defaultOrder=currentIndex>=0?(Number.isInteger(ordered[currentIndex].displayOrder)&&ordered[currentIndex].displayOrder<1000?ordered[currentIndex].displayOrder:currentIndex+1):ordered.length+1;const p=products.find(p=>p.id===id)||{title:'',artist:'Suprita Chatterjee',productType:'Fridge Magnet',tag:'',displayOrder:defaultOrder,bgColor:'',description:'',category:'paintings',price:'',stock:1,visible:true,inBanner:true,images:[],material:'',dimensions:'',care:'',sku:''};editingImages=[...p.images];
  const orderVal=Number.isInteger(p.displayOrder)&&p.displayOrder<1000?p.displayOrder:defaultOrder;
  const artistChoices=mergeArtistsWithProducts(artists,products,{includeHidden:true});
  $('editor-dialog').innerHTML=`<div class="drawer-header"><div><p class="eyebrow">hehe.cafe / Artworks</p><h2 id="editor-title">${id?'Edit artwork':'Add artwork'}</h2></div><button class="icon-button" data-action="close-dialog" aria-label="Close artwork editor"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button></div><form id="product-form"><input type="hidden" name="category" value="${e(p.category||'paintings')}"><input type="hidden" id="product-bg-color" name="bgColor" value="${e(p.bgColor||'')}"><datalist id="artist-name-options">${artistChoices.map(a=>`<option value="${e(a.name)}">`).join('')}</datalist><div class="form-grid"><label class="field">Artwork name<input name="title" required maxlength="120" value="${e(p.title)}" placeholder="e.g. Monsoon Window II"></label><label class="field">Artist name<input name="artist" list="artist-name-options" required maxlength="120" value="${e(p.artist||'Suprita Chatterjee')}" placeholder="e.g. Suprita Chatterjee"></label><label class="field">Category (shown on card)<input name="productType" list="product-type-options" required maxlength="60" value="${e(p.productType||'Fridge Magnet')}" placeholder="e.g. Fridge Magnet"><datalist id="product-type-options"><option value="Fridge Magnet"><option value="Clay Frame"><option value="Original Painting"><option value="Coaster"><option value="Keychain"></datalist></label><label class="field">Product tag / badge (optional)<input name="tag" maxlength="60" value="${e(p.tag||'')}" placeholder="e.g. Special edition (leave blank for none)"></label><label class="field wide">Artwork description &amp; story<textarea name="description" maxlength="3000" placeholder="Describe the artwork, inspiration, texture and story…">${e(p.description)}</textarea></label><label class="field">Display order (1 = shown first)<input name="displayOrder" type="number" min="1" max="10000" step="1" value="${e(orderVal)}"></label><label class="field">Price (₹)<input name="price" type="number" required min="0.01" max="10000000" step="0.01" value="${e(p.price)}"></label><label class="field">Compare-at price (₹, optional)<input name="comparePrice" type="number" min="0" max="10000000" step="0.01" value="${p.comparePrice||''}"></label><label class="field">Available quantity (0 = Sold out, 1 = In stock)<input name="stock" type="number" required min="0" max="100000" step="1" value="${p.stock}"></label><label class="field">Catalogue ref / SKU (optional)<input name="sku" maxlength="80" value="${e(p.sku)}"></label><label class="field">Medium / Material (optional)<input name="material" maxlength="150" value="${e(p.material)}" placeholder="e.g. Gouache on 300gsm cotton paper"></label><label class="field">Dimensions (optional)<input name="dimensions" maxlength="150" value="${e(p.dimensions)}" placeholder="e.g. 12 × 16 inches"></label><label class="field wide">Care &amp; framing notes (optional)<input name="care" maxlength="500" value="${e(p.care)}"></label><label class="field wide">Additional image URLs (one per line)<textarea id="product-image-urls" name="imageUrls" placeholder="https://…"></textarea></label><label class="field wide">Or upload artwork photos · JPG, PNG, WebP · up to 6 MB each<input id="product-files" name="images" type="file" accept="image/jpeg,image/png,image/webp" multiple ></label></div><div id="editor-saved-images" class="image-preview-grid"></div><div id="editor-image-preview" class="image-preview-grid"></div><section class="editor-card-preview-wrap" aria-label="Live artwork card preview"><p class="eyebrow">Live storefront card preview</p><div id="editor-card-preview" class="editor-card-preview"></div></section><p class="small muted" style="margin-top:12px">Up to 8 images. The first image is your cover — its background color is detected automatically when Artwork Color button mode is enabled.</p><label class="checkbox"><input type="checkbox" name="visible" ${p.visible?'checked':''}>Show on homepage</label><label class="checkbox"><input type="checkbox" name="inBanner" ${p.inBanner!==false?'checked':''}>Show in homepage banner</label><label class="checkbox"><input type="checkbox" name="featured" ${p.featured?'checked':''}>Feature on homepage</label><div class="editor-actions">${id?`<button type="button" class="danger-link" data-action="archive-product" data-id="${e(id)}">Archive artwork</button>`:'<span></span>'}<button id="save-product" class="button" type="submit">${id?'Save changes':'Add artwork'} →</button></div><p id="product-notice" class="notice" role="alert"></p></form>`;renderSavedProductImages();renderEditorCardPreview();openDialog('editor-dialog');
}
function renderEditorCardPreview(){
  const host=$('editor-card-preview'),form=$('product-form');
  if(!host||!form)return;
  const data=new FormData(form);
  const firstUploaded=$('editor-image-preview')?.querySelector('img')?.src;
  const urls=String(data.get('imageUrls')||'').split(/\r?\n/).map(v=>v.trim()).filter(v=>safeImage(v,'')===v);
  const imgList=[...editingImages,...urls,...(firstUploaded?[firstUploaded]:[])];
  const price=Number(data.get('price')),comparePrice=Number(data.get('comparePrice')||0),stock=Number(data.get('stock'));
  const draft=normalizeProduct({
    id:editingId||'preview-art',
    title:String(data.get('title')||'Untitled Artwork').trim()||'Untitled Artwork',
    artist:String(data.get('artist')||'Suprita Chatterjee').trim()||'Suprita Chatterjee',
    productType:String(data.get('productType')||'Fridge Magnet').trim()||'Fridge Magnet',
    tag:String(data.get('tag')||'').trim(),
    bgColor:String(data.get('bgColor')||'').trim(),
    description:String(data.get('description')||'Original handmade artwork from hehe.cafe.').trim(),
    material:String(data.get('material')||'').trim(),
    dimensions:String(data.get('dimensions')||'').trim(),
    price:Number.isFinite(price)&&price>0?price:250,
    comparePrice:Number.isFinite(comparePrice)&&comparePrice>0?comparePrice:0,
    stock:Number.isInteger(stock)&&stock>=0?stock:1,
    visible:data.get('visible')==='on',
    images:imgList.length?imgList:['assets/artwork-1.jpg']
  });
  host.innerHTML=productCardMarkup(draft,siteContent);
}
function renderSavedProductImages(){
  $('editor-saved-images').innerHTML=editingImages.map((img,i)=>`<div class="saved-product-image"><img src="${e(safeImage(img))}" alt="Saved product photo ${i+1}"><button type="button" class="text-link" data-action="remove-product-image" data-index="${i}" aria-label="Remove saved photo ${i+1}">Remove</button></div>`).join('');
}
async function submitProduct(event){event.preventDefault();if(!isAdmin)return;const form=event.target;const data=new FormData(form);const price=Number(data.get('price')),comparePrice=Number(data.get('comparePrice')||0),stock=Number(data.get('stock'));
  const urls=String(data.get('imageUrls')||'').split(/\r?\n/).map(v=>v.trim()).filter(Boolean);const files=[...$('product-files').files];
  const fail=m=>$('product-notice').textContent=m;
  if(!String(data.get('title')).trim())return fail('Enter an artwork name.');
  if(!Number.isFinite(price)||price<=0||!Number.isInteger(stock)||stock<0)return fail('Enter a valid price and whole-number stock quantity.');
  if(comparePrice && comparePrice<=price)return fail('The compare-at price must be higher than the selling price.');
  if(editingImages.length+urls.length+files.length>8)return fail('Use up to 8 images.');
  if(urls.some(url=>safeImage(url,'')!==url))return fail('Use HTTPS image URLs.');
  const button=$('save-product');button.disabled=true;button.textContent='Saving…';fail('');
  try{
    await withSavingOverlay('Saving artwork…',async()=>{
      const id=editingId||randomId();const uploaded=[];for(const file of files)uploaded.push(await store.uploadImage(file,id));
      const existing=editingId?products.find(item=>item.id===editingId):null;
      const rawOrder=Number(data.get('displayOrder'));
      const displayOrder=Number.isInteger(rawOrder)&&rawOrder>=1&&rawOrder<=100000?rawOrder:(existing?.displayOrder??products.length+1);
      const p={title:String(data.get('title')).trim(),artist:String(data.get('artist')||'Suprita Chatterjee').trim()||'Suprita Chatterjee',productType:String(data.get('productType')||'Fridge Magnet').trim().slice(0,60)||'Fridge Magnet',tag:String(data.get('tag')||'').trim().slice(0,60),displayOrder,bgColor:String(data.get('bgColor')||'').trim(),description:String(data.get('description')).trim(),category:data.get('category')||'paintings',price,comparePrice,stock,sku:String(data.get('sku')).trim(),material:String(data.get('material')).trim(),dimensions:String(data.get('dimensions')).trim(),care:String(data.get('care')).trim(),visible:data.get('visible')==='on',inBanner:data.get('inBanner')==='on',featured:data.get('featured')==='on',archived:false,images:[...editingImages,...urls,...uploaded],...(existing?.updatedAt?{updatedAt:existing.updatedAt}:{})};
      if(!editingId)p.createdAt=Date.now();
      await store.saveProduct(p,id);
    });
    $('editor-dialog').close();toast('Artwork saved.');
    syncProductsPreview();
  }catch(error){fail(store.friendlyError(error));}finally{button.disabled=false;button.textContent='Save changes →';}
}
function renderInfo(){const markup=infoMarkup(siteContent,route().id);if(!markup)return renderNotFound();$('main').innerHTML=markup;}
function renderNotFound(){$('main').innerHTML='<div class="container empty-state"><h1>Artwork not found</h1><p>This piece may have been archived or the link may have changed.</p><a href="#home" class="button">Back to hehe.cafe →</a></div>';}
function render(){
  $('main').removeAttribute('data-loading');
  delete $('main').dataset.smoothNav;
  delete document.body.dataset.productWash;
  document.body.style.removeProperty('--art-accent');
  document.body.style.removeProperty('--art-ink');
  destroyAdminControllers();
  deliveryMap?.destroy();deliveryMap=null;stopReviews();stopHeroBanner();stopArtistPrompt();
  const {page}=route();if(page!=='checkout'&&lastRenderedPage==='checkout')checkoutStep=1;lastRenderedPage=page;document.body.dataset.page=page;document.querySelectorAll('.desktop-nav>a').forEach(a=>a.toggleAttribute('aria-current',a.hash===`#${page}`||(page==='artist'&&a.hash==='#artists')));document.querySelectorAll('.desktop-nav>a[aria-current]').forEach(a=>a.setAttribute('aria-current','page'));
  document.title=`${page==='home'?'Original artworks & prints':page==='artists'||page==='artist'?'Artists':page==='admin'?'Studio admin':page==='checkout'?'Checkout':page==='account'?'Your account':'Art gallery'} · hehe.cafe`;
  if(deferPageRender(render))return;
  if(['about','info'].includes(page)&&!contentReady&&!contentError){$('main').innerHTML=pageSkeleton(page);return;}
  if(page==='home')renderHome();else if(['shop','collection','search'].includes(page))renderShop();else if(page==='artists')renderArtists();else if(page==='artist')renderArtistProfile(route().id);else if(page==='product')renderProduct();else if(page==='checkout')renderCheckout();else if(page==='admin')renderAdmin();else if(page==='account')renderAccount();else if(page==='about')$('main').innerHTML=`<div class="container"><div class="page-head">${breadcrumbs('About hehe.cafe')}<h1>About hehe.cafe</h1></div><hr class="section-rule rule-terracotta" aria-hidden="true">${story()}</div>`;else if(page==='info')renderInfo();else renderNotFound();
  applyStoreContent(siteContent,page);decorateCartButtons();stopReviews=mountReviews();stopHeroBanner=mountHeroBanner();mountLogout();
  if(page==='home'||page==='shop')stopArtistPrompt=mountArtistScrollPrompt({dismissed:artistPromptDismissed,onDismiss:()=>{artistPromptDismissed=true;}});
  liveSiteEditor?.sync();
}
function updateBanner(){const banner=$('connection-banner');banner.hidden=!catalogError;banner.innerHTML=catalogError?'The catalogue could not load. <button class="text-link" data-action="retry">Try again</button>':'';}
function mergeWithStarterProducts(remoteList = []) {
  const realRemote = (Array.isArray(remoteList) ? remoteList : []).filter(p => p && p.id && !String(p.images?.[0] || '').endsWith('.svg'));
  if (realRemote.length > 0) return realRemote;
  return [...STARTER_PRODUCTS];
}
function onCatalogUpdated(){
  if(submitting||isAnimationPlaying())return;
  const page=route().page;
  if(page==='checkout'&&$('checkout-form')){captureCheckout();updateCheckoutAvailability();return;}
  if(page==='admin'){
    if(adminTab==='products'&&!inlinePriceEditId){
      if($('admin-product-table')){
        if($('admin-total-count'))$('admin-total-count').textContent=products.length;
        if($('admin-published-count'))$('admin-published-count').textContent=products.filter(p=>p.visible).length;
        if($('admin-sold-count'))$('admin-sold-count').textContent=products.filter(p=>!p.stock).length;
        renderAdminTable();
        syncProductsPreview();
      }else renderAdminContent();
    }else if(adminTab==='artists'&&!artistStudioController?.isDirty?.()){
      if(artistStudioController)artistStudioController.refresh();
      else renderAdminContent();
    }else{
      settingsPreviewController?.update();
      modalPreviewController?.update();
    }
    return;
  }
  render();
}
async function startCatalog(){const generation=++catalogGeneration;if(unsubscribeProducts)unsubscribeProducts();catalogError='';updateBanner();if(!catalogReady){render();if($('cart-dialog').open)renderCart();if($('search-dialog').open)renderSearch();}try{const stop=await store.observeProducts(isAdmin,list=>{if(generation!==catalogGeneration)return;products=mergeWithStarterProducts(list);for(const p of products)rememberedProducts.set(p.id,p);catalogReady=true;catalogSynced=true;catalogError='';reconcileCart();updateBanner();onCatalogUpdated();if($('cart-dialog').open)renderCart();if($('search-dialog').open)renderSearch();},error=>{if(generation!==catalogGeneration)return;if(!products.length)products=[...STARTER_PRODUCTS];catalogReady=true;catalogSynced=true;catalogError='';reconcileCart();updateBanner();if(route().page==='checkout'&&$('checkout-form'))updateCheckoutAvailability();else onCatalogUpdated();if($('cart-dialog').open)renderCart();if($('search-dialog').open)renderSearch();});if(generation!==catalogGeneration)stop();else unsubscribeProducts=stop;}catch(error){if(generation!==catalogGeneration)return;if(!products.length)products=[...STARTER_PRODUCTS];catalogReady=true;catalogSynced=true;catalogError='';reconcileCart();updateBanner();onCatalogUpdated();if($('cart-dialog').open)renderCart();if($('search-dialog').open)renderSearch();}}

function launchProductWashTransition(card,href){
  if(!href||matchMedia('(prefers-reduced-motion: reduce)').matches)return false;
  document.querySelectorAll('.product-wash-transition').forEach(el=>el.remove());
  const sampled=sampleArtworkBgFromImage(card?.querySelector('img'));
  const bg=sampled||card?.dataset?.bgColor||card?.style?.getPropertyValue('--artwork-bg')?.trim()||'#f3cfa8';
  const rect=card.getBoundingClientRect();
  const cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
  const wash=document.createElement('div');
  wash.className='product-wash-transition';
  wash.style.setProperty('--wash-bg',bg);
  document.body.append(wash);
  $('main').dataset.smoothNav='product';
  activeProductTab='desc';
  const maxR=Math.hypot(Math.max(cx,innerWidth-cx),Math.max(cy,innerHeight-cy));
  wash.animate(
    [{clipPath:`circle(28px at ${cx}px ${cy}px)`,opacity:.78},{clipPath:`circle(${Math.ceil(maxR)}px at ${cx}px ${cy}px)`,opacity:1}],
    {duration:760,easing:'cubic-bezier(.22,1,.36,1)',fill:'forwards'}
  );
  setTimeout(()=>{
    location.hash=href.slice(1);
    requestAnimationFrame(()=>{
      const pageEl=document.querySelector('.product-immersive-page');
      if(pageEl){
        pageEl.classList.add('is-wash-entering');
        requestAnimationFrame(()=>{
          if(!pageEl.isConnected)return;
          pageEl.classList.add('is-wash-revealing');
          pageEl.classList.remove('is-wash-entering');
          setTimeout(()=>{if(pageEl.isConnected)pageEl.classList.remove('is-wash-revealing');},600);
        });
      }
      requestAnimationFrame(()=>{
        delete $('main').dataset.smoothNav;
        wash.animate([{opacity:1},{opacity:0}],{duration:520,easing:'cubic-bezier(.22,1,.36,1)',fill:'forwards'}).finished.catch(()=>{}).finally(()=>wash.remove());
      });
    });
  },560);
  return true;
}

let pendingArtistPassFlight=null;

function launchArtistPassTransition(card,href){
  if(!card||!href||matchMedia('(prefers-reduced-motion: reduce)').matches)return false;
  const passEl=card.querySelector('.artist-lanyard-pass')||card;
  const fromRect=passEl.getBoundingClientRect();
  if(fromRect.width<10||fromRect.height<10)return false;
  if(pendingArtistPassFlight){
    clearTimeout(pendingArtistPassFlight.timer);
    pendingArtistPassFlight.flight?.remove();
    if(pendingArtistPassFlight.sourceEl?.isConnected)pendingArtistPassFlight.sourceEl.style.visibility='';
    pendingArtistPassFlight=null;
  }
  const flight=passEl.cloneNode(true);
  flight.classList.add('artist-pass-flight');
  flight.style.left=`${fromRect.left}px`;
  flight.style.top=`${fromRect.top}px`;
  flight.style.width=`${fromRect.width}px`;
  flight.style.height=`${fromRect.height}px`;
  flight.style.borderRadius=getComputedStyle(passEl).borderRadius||'24px';
  document.body.append(flight);
  passEl.style.visibility='hidden';
  pendingArtistPassFlight={
    flight,
    sourceEl:passEl,
    fromRect,
    timer:setTimeout(()=>{
      if(!pendingArtistPassFlight)return;
      pendingArtistPassFlight.flight?.remove();
      if(pendingArtistPassFlight.sourceEl?.isConnected)pendingArtistPassFlight.sourceEl.style.visibility='';
      pendingArtistPassFlight=null;
    },1400)
  };
  location.hash=href.slice(1);
  return true;
}

function completeArtistPassFlight(){
  if(!pendingArtistPassFlight)return;
  const {flight,sourceEl,fromRect,timer}=pendingArtistPassFlight;
  clearTimeout(timer);
  pendingArtistPassFlight=null;
  const destPass=document.querySelector('.artist-pass-stage .artist-lanyard-pass');
  const destStrap=document.querySelector('.artist-pass-stage .lanyard-strap');
  const details=document.querySelector('.artist-pass-details');
  const works=document.querySelector('.artist-works-reveal');
  if(!destPass){
    if(sourceEl?.isConnected)sourceEl.style.visibility='';
    flight.animate([{opacity:1},{opacity:0}],{duration:160,fill:'forwards'}).finished.catch(()=>{}).finally(()=>flight.remove());
    return;
  }
  details?.classList.add('is-flight-entering');
  works?.classList.add('is-flight-entering');
  destPass.style.visibility='hidden';
  if(destStrap)destStrap.style.opacity='0';
  const toRect=destPass.getBoundingClientRect();
  const fromRadius=flight.style.borderRadius||getComputedStyle(flight).borderRadius||'24px';
  const toRadius=getComputedStyle(destPass).borderRadius||'24px';
  const anim=flight.animate([
    {left:`${fromRect.left}px`,top:`${fromRect.top}px`,width:`${fromRect.width}px`,height:`${fromRect.height}px`,borderRadius:fromRadius},
    {left:`${toRect.left}px`,top:`${toRect.top}px`,width:`${toRect.width}px`,height:`${toRect.height}px`,borderRadius:toRadius}
  ],{duration:440,easing:'cubic-bezier(.22,1,.36,1)',fill:'forwards'});
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    details?.classList.remove('is-flight-entering');
    works?.classList.remove('is-flight-entering');
    if(destStrap){
      destStrap.style.transition='opacity .28s ease .16s';
      destStrap.style.opacity='1';
    }
  }));
  anim.finished.catch(()=>{}).finally(()=>{
    destPass.style.visibility='';
    if(destStrap){
      destStrap.style.opacity='';
      destStrap.style.transition='';
    }
    details?.classList.remove('is-flight-entering');
    works?.classList.remove('is-flight-entering');
    if(sourceEl?.isConnected)sourceEl.style.visibility='';
    flight.remove();
  });
}

document.addEventListener('click',async event=>{
  if(liveSiteEditor?.isActive?.()&&!event.target.closest('.live-site-editor-ui')&&!event.target.closest('dialog'))return;
  const productLink=event.target.closest('[data-product-card] a[href^="#product/"]');
  if(productLink&&!event.target.closest('[data-action]')&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey&&route().page!=='admin'){
    if(launchProductWashTransition(productLink.closest('[data-product-card]'),productLink.getAttribute('href'))){event.preventDefault();return;}
  }
  const artistLink=event.target.closest('a.artist-lanyard-card[href^="#artist/"]');
  if(artistLink&&!event.target.closest('[data-action]')&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey&&route().page!=='admin'){
    if(launchArtistPassTransition(artistLink,artistLink.getAttribute('href'))){event.preventDefault();return;}
  }
  const target=event.target.closest('[data-action]');if(!target||target.disabled)return;const action=target.dataset.action,id=target.dataset.id;
  try{
    if(action==='checkout-next'){if(checkoutStepValid())setCheckoutStep(checkoutStep+1);}
    else if(action==='checkout-previous'){captureCheckout();setCheckoutStep(checkoutStep-1);}
    else if(action==='checkout-edit-step'){captureCheckout();setCheckoutStep(Number(target.dataset.step)||1);}
    else if(action==='cart'){reconcileCart();renderCart();openDialog('cart-dialog');}
    else if(action==='dismiss-cart-notice'){cartCleanupNotes=[];document.querySelectorAll('.cart-cleanup-note').forEach(el=>el.remove());}
    else if(action==='cart-checkout'){
      const flow=target.closest('.cart-checkout-flow');target.disabled=true;
      await animateCartCheckout(flow);
      if(!target.isConnected)return;
      smoothCheckoutNav=true;
      $('main').dataset.smoothNav='checkout';
      try{
        if(route().page==='checkout'){render();window.scrollTo({top:0,behavior:'instant'});}
        else{location.hash='checkout';}
        await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
        await closeDialog($('cart-dialog'));
      }finally{
        smoothCheckoutNav=false;
        delete $('main').dataset.smoothNav;
      }
      $('main').focus({preventScroll:true});
    }
    else if(action==='payment-preview-return'){const preview=target.dataset.preview==='true';cartCleanupNotes.length=0;renderCheckout();const notice=$('checkout-notice');if(notice){notice.textContent=preview?'Preview only: no payment, order or stock reservation was recorded.':'Payment failed and the order was cancelled. Your cart is saved so you can try again.';notice.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});}}
    else if(action==='cancel-payment-preview'){$('payment-preview-dialog')?.close();$('payment-preview-dialog')?.removeAttribute('open');}
     else if(action==='preview-payment-outcome'){if(!(await store.paymentPreviewEnabled()))return;$('payment-preview-dialog')?.close();$('payment-preview-dialog')?.removeAttribute('open');deliveryMap?.destroy();deliveryMap=null;paymentSceneActive=true;try{await playPaymentOutcome(target.dataset.outcome==='success'?'success':'failure',{preview:true,items:paymentAnimationItems()});}finally{paymentSceneActive=false;}}
    else if(action==='toggle-summary'){const collapsed=target.closest('.checkout-summary').classList.toggle('summary-collapsed');target.setAttribute('aria-expanded',String(!collapsed));target.querySelector('.summary-toggle-label').innerHTML=`${collapsed?'View order summary':'Hide summary'} <svg viewBox="0 0 24 24" class="ui-chevron" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`;}
    else if(action==='pick-banner-cta-pos'&&isAdmin){
      const form=$('banner-form'),pos=target.dataset.pos||'below-text';
      if(form?.elements.bannerButtonPosition){
        form.elements.bannerButtonPosition.value=pos;
        form.querySelectorAll('[data-action="pick-banner-cta-pos"]').forEach(btn=>{
          const active=btn.dataset.pos===pos;
          btn.classList.toggle('is-active',active);
          btn.setAttribute('aria-pressed',String(active));
        });
        settingsDirty=true;
        settingsPreviewController?.update();
        settingsPreviewController?.highlight?.('.hero-banner-cta || [data-hero-banner]',{page:'home'});
      }
    }
    else if(action==='pick-banner-cta-style'&&isAdmin){
      const form=$('banner-form'),style=target.dataset.style||'light';
      if(form?.elements.bannerButtonStyle){
        form.elements.bannerButtonStyle.value=style;
        form.querySelectorAll('[data-action="pick-banner-cta-style"]').forEach(btn=>{
          const active=btn.dataset.style===style;
          btn.classList.toggle('is-active',active);
          btn.setAttribute('aria-pressed',String(active));
        });
        settingsDirty=true;
        settingsPreviewController?.update();
        settingsPreviewController?.highlight?.('.hero-banner-cta || [data-hero-banner]',{page:'home'});
      }
    }
    else if(action==='reset-banner-cta-pos'&&isAdmin){
      const form=$('banner-form');
      if(form){
        if(form.elements.bannerButtonPosition)form.elements.bannerButtonPosition.value='below-text';
        form.querySelectorAll('[data-action="pick-banner-cta-pos"]').forEach(btn=>{
          const active=btn.dataset.pos==='below-text';
          btn.classList.toggle('is-active',active);
          btn.setAttribute('aria-pressed',String(active));
        });
        if(form.elements.bannerButtonOffsetX)form.elements.bannerButtonOffsetX.value='0';
        if(form.elements.bannerButtonOffsetY)form.elements.bannerButtonOffsetY.value='0';
        if($('banner-cta-x-val'))$('banner-cta-x-val').textContent='0px';
        if($('banner-cta-y-val'))$('banner-cta-y-val').textContent='0px';
        settingsDirty=true;
        settingsPreviewController?.update();
        settingsPreviewController?.highlight?.('.hero-banner-cta || [data-hero-banner]',{page:'home'});
      }
    }
    else if(action==='apply-promo'){
      const ctx=target.dataset.context||'cart';
      const input=$(`${ctx}-promo-input`)||target.closest('.promo-code-box')?.querySelector('input');
      const raw=String(input?.value||'').trim().toUpperCase();
      if(!raw){
        promoFeedback='Enter a promo code first.';
      }else{
        const test=calculateDiscounts({
          subtotalPaise:Math.round(subtotal(lines())*100),
          totalQty:lines().reduce((sum,item)=>sum+item.quantity,0),
          shippingPaise:shippingPaiseForQuantity(lines().reduce((sum,item)=>sum+item.quantity,0)),
          promoCode:raw,
          promos:storePromos
        });
        if(test.promoError){
          appliedPromoCode='';
          promoFeedback=test.promoError;
        }else{
          appliedPromoCode=test.appliedCode;
          promoFeedback='';
          toast(`Promo code ${test.appliedCode} applied.`);
        }
      }
      if($('cart-dialog')?.open)renderCart();
      if(route().page==='checkout'&&$('checkout-form')){captureCheckout();renderCheckout();}
    }
    else if(action==='remove-promo'){
      appliedPromoCode='';
      promoFeedback='';
      if($('cart-dialog')?.open)renderCart();
      if(route().page==='checkout'&&$('checkout-form')){captureCheckout();renderCheckout();}
    }
    else if(action==='close-dialog'){await closeDialog(target.closest('dialog'));}
    else if(action==='search'){openDialog('search-dialog');$('search-input').focus();renderSearch();}
    else if(action==='menu'){const menu=$('mobile-menu');menu.hidden=!menu.hidden;target.setAttribute('aria-expanded',String(!menu.hidden));}
    else if(action==='collections'){const menu=$('collection-menu');menu.hidden=!menu.hidden;target.setAttribute('aria-expanded',String(!menu.hidden));}
    else if(action==='add'){if(addToCart(id,1,false)){await animateCart(target);if(target.isConnected){openDialog('cart-dialog');setTimeout(()=>{if(target.isConnected){target.classList.remove('clicked');target.removeAttribute('aria-label');}},250);}}}
    else if(action==='quick-buy'){if(addToCart(id,1,false)){$('main').dataset.smoothNav='checkout';await closeDialogs({immediate:true});location.hash='checkout';}}
    else if(action==='print-label'){if(isAdmin){const request=requestList.find(o=>o.id===id);if(request)await openLabel(request,{load:store.loadLabel,save:store.saveLabel});}}
    else if(action==='add-detail'||action==='buy-now'){const quantity=Number(document.querySelector('[data-context="product"][data-quantity]')?.value||1);if(!Number.isInteger(quantity)||quantity<1)return toast('Enter a whole-number quantity.');if(addToCart(id,quantity,false)){if(action==='buy-now'){$('main').dataset.smoothNav='checkout';location.hash='checkout';}else{await animateCart(target);if(target.isConnected){openDialog('cart-dialog');setTimeout(()=>{if(target.isConnected){target.classList.remove('clicked');target.removeAttribute('aria-label');}},250);}}}}
    else if(action==='remove'){clearCustomization(id);cart=cart.filter(c=>c.id!==id);persistCart();renderCart();if(route().page==='checkout'){captureCheckout();renderCheckout();}}
    else if(action==='quantity'){
      const context=target.dataset.context,delta=Number(target.dataset.delta),control=target.closest('.quantity');
      if(![-1,1].includes(delta)||!control)return;
      const product=products.find(item=>item.id===id)||rememberedProducts.get(id);
      if(context==='product'){
        const input=control.querySelector('[data-quantity]');if(!input||!product)return;
        const stock=Math.max(1,Number(product.stock)||1),value=Math.max(1,Math.min(99,stock,Number(input.value||1)+delta));
        control.outerHTML=quantityControl(id,value,stock,'product');
      }else{
        const line=cart.find(item=>item.id===id);if(!line)return;
        const stock=Number(product?.stock),maximum=Math.max(line.quantity,Number.isFinite(stock)&&stock>0?Math.min(99,stock):line.quantity);
        const value=Math.max(1,Math.min(maximum,line.quantity+delta));
        if(value===line.quantity){if(delta>0)toast('The available stock limit has been reached.');return;}
        line.quantity=value;persistCart();renderCart();
        if(route().page==='checkout'){captureCheckout();renderCheckout();}
      }
    }
    else if(action==='zoom'){$('zoom-image').src=$('product-main-image').src;$('zoom-image').alt=$('product-main-image').alt;openDialog('image-dialog');}
    else if(action==='remove-product-image'){editingImages.splice(Number(target.dataset.index),1);renderSavedProductImages();renderEditorCardPreview();}
    else if(action==='product-tab'){
      const next=target.dataset.tab||'desc';
      activeProductTab=next;
      const panelRoot=target.closest('.product-detail-panel');
      panelRoot?.querySelectorAll('[data-action="product-tab"]').forEach(btn=>{
        const on=btn.dataset.tab===next;
        btn.classList.toggle('is-active',on);
        btn.setAttribute('aria-selected',String(on));
      });
      panelRoot?.querySelectorAll('[data-tab-panel]').forEach(p=>{p.hidden=p.dataset.tabPanel!==next;});
    }
    else if(action==='thumbnail'){const p=products.find(p=>p.id===route().id);const mainImg=$('product-main-image');if(mainImg&&p){mainImg.src=safeImage(p.images[Number(target.dataset.index)]);sampleAndWashProductImage(mainImg);}document.querySelectorAll('.thumbs button').forEach(b=>{const on=b===target;b.classList.toggle('active',on);b.classList.toggle('is-active',on);});}
    else if(action==='signin'||action==='signin-redirect'){target.disabled=true;const p=store.signIn({redirect:action==='signin-redirect'});await p;if(target.isConnected)target.disabled=false;}
    else if(action==='skip-save-address'){$('save-address-prompt').remove();}
    else if(action==='save-checkout-address'){target.disabled=true;if(!user||user.isAnonymous)await store.signIn();const profile=normalizeProfile(completedRequest.customer);await store.saveProfile(profile);accountState.profile=profile;if($('save-address-prompt'))$('save-address-prompt').innerHTML='<p role="status">Your address and confirmed pin are saved for next time.</p>';}
    else if(action==='cancel-request'){target.disabled=true;const form=target.closest('.cancel-form');await store.cancelRequest(id,form.querySelector('textarea').value);await fetchCustomerAccount();toast('Your cancellation has been saved.');}
    else if(action==='download-invoice'){target.disabled=true;try{const invoice=await store.callBackend('getInvoice',{requestId:id});const pdf=await invoicePDF(invoice);downloadFile(pdf,'invoice-'+String(invoice.number||id).replace(/[^a-zA-Z0-9_-]/g,'')+'.pdf','application/pdf');toast('PDF invoice downloaded.');}finally{target.disabled=false;}}
    else if(action==='pay-request'){
      target.disabled=true;
      const purpose=target.dataset.purpose||'items';
      const loader=createLoaderController();
      loader.show('Opening secure checkout…');
      try{
        await payRequest(id,purpose,{onOpen:()=>loader.hide(),onVerifying:()=>loader.show('Verifying payment…')});
        await fetchCustomerAccount();
        toast(purpose==='shipping'?'Shipping payment successful. Thank you!':'Payment successful. Thank you!');
      }catch(err){
        loader.show('Checking payment status…');
        const cancelResult=await store.callBackend('cancelFailedPayment',{requestId:id,purpose,reason:err?.message||'Payment failed'}).catch(()=>null);
        await fetchCustomerAccount();
        if(cancelResult?.paid===true)toast(purpose==='shipping'?'Shipping payment successful. Thank you!':'Payment successful. Thank you!');
        else toast(purpose==='shipping'?'Shipping payment failed.':'Payment failed. Order cancelled.');
      }finally{
        loader.hide();
        if(target.isConnected)target.disabled=false;
      }
    }
    else if(action==='approve-quote'){const request=requestList.find(r=>r.id===id);if(request)openQuoteEditor(request,{approve:data=>store.callBackend('approveQuote',data),onSaved:()=>{requestsLoaded=false;renderAdminContent();}});}
    else if(action==='resolve-cancellation'){target.disabled=true;await withSavingOverlay('Updating order…',()=>store.callBackend('resolveCancellation',{requestId:id,approve:target.dataset.approve==='true'}));requestsLoaded=false;renderAdminContent();}
    else if(action==='manual-paid'){const box=target.closest('.manual-payment-controls'),method=box.querySelector('[name=manual-method]').value,reference=box.querySelector('[name=manual-reference]').value.trim();if(!reference)return toast('Enter the offline payment reference.');target.disabled=true;await withSavingOverlay('Recording offline payment…',()=>store.callBackend('setManualPaymentStatus',{requestId:id,status:'paid',method,reference}));requestsLoaded=false;renderAdminContent();toast('Offline payment recorded.');}
    else if(action==='manual-unpaid'){if(!window.confirm('Mark this offline payment unpaid? Confirm that the money was never received or has been returned.'))return;target.disabled=true;await withSavingOverlay('Updating payment status…',()=>store.callBackend('setManualPaymentStatus',{requestId:id,status:'unpaid'}));requestsLoaded=false;renderAdminContent();toast('Offline payment marked unpaid.');}
    else if(action==='manual-refund'){if(!window.confirm('Confirm that you have already returned the offline payment to the customer.'))return;target.disabled=true;await withSavingOverlay('Recording offline refund…',()=>store.callBackend('setManualPaymentStatus',{requestId:id,status:'refunded'}));requestsLoaded=false;renderAdminContent();toast('Offline refund recorded.');}
    else if(action==='review-checkout-cart'){captureCheckout();renderCheckout();renderCart();openDialog('cart-dialog');}
    else if(action==='account-refresh'||action==='account-more'){await fetchCustomerAccount(action==='account-more');}
    else if(action==='account-order-filter'){accountState.orderFilter=target.dataset.filter||'all';refreshAccountOrdersList();}
    else if(action==='order-card-tab'){
      const card=target.closest('.customer-request'),nextTab=target.dataset.orderTab||'overview';
      card?.querySelectorAll('[data-action="order-card-tab"]').forEach(btn=>{
        const on=btn.dataset.orderTab===nextTab;
        btn.classList.toggle('is-active',on);
        btn.setAttribute('aria-selected',String(on));
      });
      card?.querySelectorAll('[data-order-panel]').forEach(panel=>{panel.hidden=panel.dataset.orderPanel!==nextTab;});
    }
    else if(action==='request-customizations'){await showProductCustomizations(id);}
    else if(action==='remove-reference'){removeReference(id,target.dataset.fileId);refreshReferencePreviews(id);}
    else if(action==='signout'){await animateLogout(target);await store.signOut();location.hash='account';}
    else if(action==='admin-tab'){if(!confirmLeaveAdminTab())return;adminTab=target.dataset.tab;location.hash='admin/'+adminTab;}
    else if(action==='admin-policy-tab'){if(!confirmLeaveAdminTab())return;activePolicyTab=target.dataset.policy||'contact';adminTab='policies';location.hash='admin/'+activePolicyTab;}
    else if(action==='open-site-preview'&&isAdmin){
      const defaultPage=adminTab==='artists'?'artists':adminTab==='policies'?activePolicyTab:'home';
      modalPreviewController?.destroy();
      modalPreviewController=openSitePreviewModal($('site-preview-dialog'),{
        getContent:()=>siteContent,
        getProducts:()=>products,
        getSettings:()=>adminTab==='settings'?draftSettingsFromForm():storeSettings,
        getHeader:()=>document.querySelector('.site-header').outerHTML,
        getArtists:()=>artists,
        initialPage:defaultPage
      });
    }
    else if(action==='toggle-products-preview'&&isAdmin){productsPreviewOpen=!productsPreviewOpen;syncProductsPreview();}
    else if(action==='set-order-filter'&&isAdmin){orderStatusFilter=target.dataset.status||'all';renderOrdersCards();}
    else if(action==='toggle-order-card'&&isAdmin){
      const card=target.closest('.order-card');
      if(expandedOrderIds.has(id))expandedOrderIds.delete(id);else expandedOrderIds.add(id);
      const isOpen=expandedOrderIds.has(id);
      card?.classList.toggle('is-open',isOpen);
      const body=card?.querySelector('.order-card-body');if(body)body.hidden=!isOpen;
      card?.querySelectorAll('[data-action="toggle-order-card"]').forEach(btn=>btn.setAttribute('aria-expanded',String(isOpen)));
      const chev=card?.querySelector('.order-expand-chevron');if(chev)chev.setAttribute('aria-label',isOpen?'Collapse order details':'Expand order details');
    }
    else if(action==='new-product')openEditor();
    else if(action==='edit-product')openEditor(id);
    else if(action==='move-product'){await moveProductOrder(id,Number(target.dataset.dir)||0);syncProductsPreview();}
    else if(action==='toggle-product-flag'){target.disabled=true;try{await toggleProductFlag(id,target.dataset.field);syncProductsPreview();}finally{if(target.isConnected)target.disabled=false;}}
    else if(action==='toggle-stock'){target.disabled=true;try{await quickToggleStock(id);syncProductsPreview();}finally{if(target.isConnected)target.disabled=false;}}
    else if(action==='edit-inline-price'){inlinePriceEditId=id;renderAdminTable();const input=document.querySelector('.inline-price-form input');input?.focus();input?.select();}
    else if(action==='cancel-inline-price'){inlinePriceEditId=null;renderAdminTable();}
    else if(action==='archive-product'){await withSavingOverlay('Archiving artwork…',()=>store.archiveProduct(id));$('editor-dialog').close();toast('Product archived. Edit it to publish it again.');syncProductsPreview();}
    else if(action==='new-artist')openArtistEditor();
    else if(action==='edit-artist')openArtistEditor(id);
    else if(action==='delete-artist'){if(window.confirm('Remove this artist profile?')){const next=normalizeArtists(artists.filter(a=>a.id!==id));await withSavingOverlay('Removing artist…',()=>store.saveArtists(next));artists=next;$('editor-dialog').close();if(adminTab==='artists')renderAdminArtists();toast('Artist profile removed.');}}
    else if(action==='refresh-requests'){requestsLoaded=false;renderAdminContent();}
    else if(action==='view-requests'){adminTab='requests';requestsLoaded=false;location.hash='admin/requests';}
    else if(action==='select-labels-four'&&isAdmin){
      selectedLabelOrders.clear();
      const visibleOrders=filterOrders(requestList,{query:orderSearch,status:orderStatusFilter});
      const paid=visibleOrders.filter(o=>o.paymentStatus==='captured');
      const pool=paid.length>=4?paid:[...paid,...visibleOrders.filter(o=>o.paymentStatus!=='captured')];
      pool.slice(0,4).forEach(o=>selectedLabelOrders.add(o.id));
      updateBatchLabelBar();
    }
    else if(action==='select-labels-all'&&isAdmin){
      filterOrders(requestList,{query:orderSearch,status:orderStatusFilter}).forEach(o=>selectedLabelOrders.add(o.id));
      updateBatchLabelBar();
    }
    else if(action==='select-labels-clear'&&isAdmin){
      selectedLabelOrders.clear();
      updateBatchLabelBar();
    }
    else if((action==='print-batch-a4'||action==='print-batch-thermal')&&isAdmin){
      const picked=requestList.filter(o=>selectedLabelOrders.has(o.id));
      if(picked.length)await openBatchLabels(picked,{load:store.loadLabel,defaultMode:action==='print-batch-thermal'?'thermal':'a4-4up'});
    }
    else if(action==='toggle-filter-menu'){const panel=$('home-filter-panel');if(panel){const open=panel.hidden;panel.hidden=!open;target.setAttribute('aria-expanded',String(open));}}
    else if(action==='set-filter-sort'){filter.sort=target.dataset.sort||'';refreshFilterUI(true);}
    else if(action==='toggle-filter-discounted'){filter.discounted=!filter.discounted;refreshFilterUI(true);}
    else if(action==='toggle-filter-available'){filter.available=!filter.available;refreshFilterUI(true);}
    else if(action==='set-filter-type'){filter.productType=target.dataset.type||'';refreshFilterUI(true);}
    else if(action==='reset-filters'){filter={sort:'',available:false,discounted:false,productType:'',search:''};if($('home-search-input'))$('home-search-input').value='';refreshFilterUI(false);}
    else if(action==='retry'){catalogError='';await startCatalog();}
  }catch(error){const notice=$('save-address-prompt')?.querySelector('.notice')||$('auth-notice')||$('product-notice')||$('artist-notice');if(notice)notice.textContent=store.friendlyError(error);else toast(store.friendlyError(error));target.disabled=false;}
});
document.addEventListener('click',event=>{
  if(!event.target.closest('.nav-dropdown')){$('collection-menu').hidden=true;document.querySelector('[data-action="collections"]')?.setAttribute('aria-expanded','false');}
  if(!event.target.closest('.home-filter-wrap')){const panel=$('home-filter-panel');if(panel&&!panel.hidden){panel.hidden=true;document.querySelector('[data-action="toggle-filter-menu"]')?.setAttribute('aria-expanded','false');}}
});
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeDialog(dialog);}}));
document.addEventListener('submit',event=>{if(event.target.id==='customer-profile-form')submitCustomerProfile(event);if(event.target.id==='checkout-form')submitCheckout(event);if(event.target.id==='banner-form')submitBanners(event);if(event.target.id==='product-form')submitProduct(event);if(event.target.id==='artist-form')submitArtist(event);if(event.target.matches('.inline-price-form')){event.preventDefault();saveInlinePrice(event.target.dataset.inlinePriceId,event.target.elements.price.value);}if(event.target.id==='search-form'){event.preventDefault();location.hash=`search/${encodeURIComponent($('search-input').value.trim())}`;closeDialogs();}});
document.addEventListener('keydown',event=>{if(event.key==='Enter'&&(event.target.id==='cart-promo-input'||event.target.id==='checkout-promo-input')){event.preventDefault();event.target.closest('.promo-code-box')?.querySelector('[data-action="apply-promo"]')?.click();}});
document.addEventListener('input',event=>{if(event.target.dataset.productNote)setProductNote(event.target.dataset.productNote,event.target.value);if(event.target.id==='checkout-notes'&&$('checkout-notes-count'))$('checkout-notes-count').textContent=`${event.target.value.length} / 1000`;if(event.target.id==='search-input')renderSearch();if(event.target.id==='home-search-input'){filter.search=event.target.value;renderProductResults();decorateCartButtons();}if(event.target.id==='account-order-search'){accountState.orderQuery=event.target.value;refreshAccountOrdersList();}if(event.target.id==='order-note')orderNote=event.target.value;if(event.target.id==='admin-search'){adminSearch=event.target.value;renderAdminTable();}if(event.target.id==='admin-orders-search'){orderSearch=event.target.value;renderOrdersCards();}if(event.target.closest('#product-form'))renderEditorCardPreview();if(event.target.closest('#banner-form')){if(event.target.name==='bannerButtonOffsetX'&&$('banner-cta-x-val'))$('banner-cta-x-val').textContent=`${event.target.value}px`;if(event.target.name==='bannerButtonOffsetY'&&$('banner-cta-y-val'))$('banner-cta-y-val').textContent=`${event.target.value}px`;settingsDirty=true;settingsPreviewController?.update();}if(event.target.closest('#checkout-form')){if(event.target.name)checkoutTouched.add(event.target.name);captureCheckout();}});
document.addEventListener('change',async event=>{const t=event.target;if(t.closest('#product-form'))renderEditorCardPreview();if(t.closest('#banner-form')){settingsDirty=true;settingsPreviewController?.update();}if(t.dataset.referenceFiles){try{addReferences(t.dataset.referenceFiles,t.files);refreshReferencePreviews(t.dataset.referenceFiles);}catch(error){toast(error.message);}t.value='';}
  if(t.id==='sort-filter'){filter.sort=t.value;renderProductResults();decorateCartButtons();}if(t.id==='available-filter'){filter.available=t.checked;renderProductResults();decorateCartButtons();}if(t.id==='category-filter')location.hash=t.value?`collection/${t.value}`:'shop';if(t.id==='admin-category'){adminCategory=t.value;renderAdminTable();}
  if(t.id==='admin-artwork-sort'&&isAdmin){
    const nextSort=t.value;
    storeSettings=normalizeSettings({...storeSettings,artworkSort:nextSort});
    renderAdminTable();
    syncProductsPreview();
    try{
      await withSavingOverlay('Updating storefront order…',()=>store.saveSettings(storeSettings));
      const label=ARTWORK_SORT_MODES.find(([id])=>id===nextSort)?.[1]||nextSort;
      toast(`Storefront order set to: ${label}`);
    }catch(error){
      toast(store.friendlyError(error));
    }
  }
  if(t.id==='admin-cart-btn-mode'&&isAdmin){
    const nextMode=t.value==='artwork'?'artwork':'black';
    storeSettings=normalizeSettings({...storeSettings,cartButtonMode:nextMode});
    document.body.dataset.cartBtnMode=nextMode;
    syncProductsPreview();
    try{
      await withSavingOverlay('Updating button style…',()=>store.saveSettings(storeSettings));
      toast(nextMode==='black'?'Add to cart buttons set to black.':'Add to cart buttons now match each artwork color.');
    }catch(error){
      toast(store.friendlyError(error));
    }
  }
  if(t.id==='admin-banner-limit'&&isAdmin){
    const rawLimit=Number(t.value);
    const nextLimit=Number.isInteger(rawLimit)&&rawLimit>=0&&rawLimit<=50?rawLimit:8;
    storeSettings=normalizeSettings({...storeSettings,bannerLimit:nextLimit});
    syncProductsPreview();
    try{
      await withSavingOverlay('Updating banner limit…',()=>store.saveSettings(storeSettings));
      toast(nextLimit===0?'Banner set to show all banner-enabled artworks.':`Banner limit set to ${nextLimit} artworks.`);
    }catch(error){
      toast(store.friendlyError(error));
    }
  }
  if(t.id==='artist-photo-file'){
    const file=t.files?.[0];
    if(file&&file.type.startsWith('image/')){
      const preview=$('artist-photo-preview');
      if(preview){
        preview.replaceChildren();
        const img=document.createElement('img');
        const url=URL.createObjectURL(file);
        img.src=url;img.alt='Artist preview';
        img.onload=()=>URL.revokeObjectURL(url);
        img.onerror=()=>URL.revokeObjectURL(url);
        preview.append(img);
      }
    }
  }
  if(t.dataset.quantity){const p=products.find(p=>p.id===t.dataset.quantity)||rememberedProducts.get(t.dataset.quantity)||{id:t.dataset.quantity,stock:0};let value=Number(t.value);if(!Number.isInteger(value)||value<1)value=1;value=Math.max(1,Math.min(value,Math.max(cart.find(c=>c.id===p.id)?.quantity||1,p.stock),99));if(t.dataset.context==='product'){t.parentElement.outerHTML=quantityControl(p.id,value,p.stock,'product');}else{cart.find(c=>c.id===p.id).quantity=value;persistCart();renderCart();if(route().page==='checkout'){captureCheckout();renderCheckout();}}}
  if(t.dataset.selectLabelOrder&&isAdmin){
    if(t.checked)selectedLabelOrders.add(t.dataset.selectLabelOrder);
    else selectedLabelOrders.delete(t.dataset.selectLabelOrder);
    updateBatchLabelBar();
  }
  if(t.dataset.requestStatus){t.disabled=true;try{await withSavingOverlay('Updating order status…',async()=>{await store.updateRequest(t.dataset.requestStatus,t.value);await fetchRequests();});toast('Request status updated.');}catch(error){await fetchRequests();toast(store.friendlyError(error));}finally{if(t.isConnected)t.disabled=false;}}
  if(t.id==='product-files'){$('editor-image-preview').replaceChildren();for(const [idx,file] of [...t.files].slice(0,8).entries()){if(!file.type.startsWith('image/'))continue;const image=document.createElement('img');const url=URL.createObjectURL(file);image.src=url;image.alt=file.name;image.onload=()=>{if(idx===0&&$('product-bg-color')){const sampled=sampleArtworkBgFromImage(image);if(sampled)$('product-bg-color').value=sampled;}renderEditorCardPreview();URL.revokeObjectURL(url);};image.onerror=()=>URL.revokeObjectURL(url);$('editor-image-preview').append(image);}renderEditorCardPreview();}
});
function renderSearch(){if($('search-input').value&&!catalogReady){$('search-results').innerHTML=catalogError?catalogErrorMarkup():skeletonMarkup('rows','Loading search results…');return;}const query=$('search-input').value;const results=filterProducts(products,{search:query}).slice(0,6);$('search-results').innerHTML=query?results.length?results.map(p=>`<a class="search-result" href="#product/${e(p.id)}" data-action="close-dialog"><img src="${e(imageOf(p))}" alt=""><div>${e(p.title)}<span>by ${e(p.artist||'Suprita Chatterjee')} · ${money(p.price)}</span></div></a>`).join(''):'<p class="muted" style="margin-top:25px">No artworks found. Try searching by title, artist or medium.</p>':`<p class="eyebrow" style="margin-top:25px">Quick links</p><div class="footer-links">${categoryLinks}</div>`;}
window.addEventListener('hashchange',()=>{if(location.hash==='#main'){return;}paymentSceneActive=false;if(location.hash==='#artworks'){document.getElementById('artworks')?.scrollIntoView({behavior:'smooth'});return;}$('mobile-menu').hidden=true;document.querySelector('[data-action="menu"]').setAttribute('aria-expanded','false');if(!smoothCheckoutNav)closeDialogs();render();window.scrollTo({top:0,behavior:'instant'});completeArtistPassFlight();if(!smoothCheckoutNav)$('main').focus({preventScroll:true});});
window.addEventListener('storage',event=>{if(event.key===cartKey){try{const value=JSON.parse(event.newValue);cart=Array.isArray(value)?value:[];reconcileCart();updateCartBadge();if($('cart-dialog').open)renderCart();if(route().page==='checkout'){captureCheckout();renderCheckout();}}catch{}}});
document.addEventListener('error',event=>{if(event.target instanceof HTMLImageElement&&!event.target.closest('.leaflet-container')&&!event.target.dataset.fallback){event.target.dataset.fallback='1';event.target.src='assets/paintings.svg';}},true);
const liveSiteEditor=mountLiveSiteEditor({
  isAdmin:()=>isAdmin,
  getRoute:route,
  getContent:()=>siteContent,
  getSettings:()=>storeSettings,
  getArtists:()=>artists,
  getProducts:()=>products,
  onSaveContent:async next=>{
    const clean=normalizeContent(next);
    await withSavingOverlay('Saving page changes…',()=>store.saveContent(clean));
    siteContent=clean;
    refreshStoreContent();
  },
  onSaveSettings:async next=>{
    const clean=normalizeSettings(next);
    await withSavingOverlay('Saving homepage & banners…',()=>store.saveSettings(clean));
    storeSettings=clean;
    applyStoreBanners();
  },
  onSaveArtists:async next=>{
    const clean=normalizeArtists(next);
    await withSavingOverlay('Saving artist changes…',()=>store.saveArtists(clean));
    artists=clean;
  },
  onRefresh:()=>render()
});
updateCartBadge();updateBanner();render();
startCatalog();
void store.backend().catch(()=>{});
store.observeAuth((nextUser,nextAdmin)=>{
  const changed=isAdmin!==nextAdmin,identityChanged=user?.uid!==nextUser?.uid;
  if(identityChanged){
    contentDraft=null;
    if(user&&!user.isAnonymous){checkoutDraft={};checkoutTouched.clear();completedRequest=null;orderNote='';clearCustomizations();closeDialogs();}
    accountState={requests:[],profile:{},loaded:false,loading:false,orderFilter:'all',orderQuery:''};
  }
  user=nextUser;isAdmin=nextAdmin;authLoading=false;authError='';requestList=[];requestsLoaded=false;
  if(changed)startCatalog();
  if(['account','admin'].includes(route().page)){
    if(nextAdmin&&identityChanged){location.hash=requestedAdminPage;requestedAdminPage='admin';render();}
    else if(!nextAdmin&&route().page==='admin')location.hash='account';else render();
  }
  if(route().page==='checkout'&&!submitting&&!paymentSceneActive){if(identityChanged)captureCheckout();renderCheckout();}
  if(identityChanged&&user&&!user.isAnonymous)fetchCustomerAccount();
  liveSiteEditor.sync();
}).catch(error=>{authLoading=false;authError=store.friendlyError(error);if(['account','admin'].includes(route().page))renderAccount();if(route().page==='checkout')renderCheckout();});
function settingsLoadFailed(){
  settingsError='Store settings could not load. Check your connection and reload to try again.';
  if(route().page==='home')render();
  if(route().page==='admin'&&adminTab==='settings')renderAdminContent();
}
let lastSettingsJson='';
store.observeSettings(settings=>{
  const nextJson=JSON.stringify(settings);
  if(nextJson===lastSettingsJson&&settingsReady)return;
  lastSettingsJson=nextJson;
  storeSettings=settings;settingsReady=true;settingsError='';applyStoreBanners();
  if(liveSiteEditor.isActive())return;
  const page=route().page;
  if((page==='home'||page==='shop')&&!isAnimationPlaying())render();
  if(page==='admin'){
    if(adminTab==='settings'&&!settingsDirty&&!$('banner-form')?.contains(document.activeElement))renderAdminContent();
    if(adminTab==='products'){
      if($('admin-artwork-sort'))$('admin-artwork-sort').value=storeSettings.artworkSort||'manual';
      if($('admin-cart-btn-mode'))$('admin-cart-btn-mode').value=storeSettings.cartButtonMode||'black';
      if($('admin-banner-limit'))$('admin-banner-limit').value=String(Number.isInteger(storeSettings.bannerLimit)?storeSettings.bannerLimit:8);
      if($('admin-product-table'))renderAdminTable();
    }
  }
},settingsLoadFailed).catch(settingsLoadFailed);
store.observeArtists(list=>{
  artists=normalizeArtists(list);
  if(liveSiteEditor.isActive())return;
  if(['artists','artist','home'].includes(route().page))render();
  if(route().page==='admin'&&adminTab==='artists'&&!artistStudioController?.isDirty?.()){
    if(artistStudioController)artistStudioController.refresh();
    else renderAdminContent();
  }
},()=>{}).catch(()=>{});
store.observePromos(nextPromos=>{
  storePromos=normalizePromos(nextPromos);
  if($('cart-dialog')?.open)renderCart();
  if(route().page==='checkout'&&$('checkout-form')&&!submitting){captureCheckout();renderCheckout();}
  if(route().page==='admin'&&adminTab==='promos'&&!promosAdminController?.isDirty?.()){
    promosAdminController?.refresh?.();
  }
},()=>{}).catch(()=>{});
function refreshStoreContent(){
  contentCategories(siteContent).forEach((c,i)=>Object.assign(CATEGORIES[i],c));
  categoryLinks=`<a href="#home">Home &amp; Banner</a><a href="#shop">All Artworks</a><a href="#artists">Artists</a><a href="#about">About hehe.cafe</a>`;
  $('collection-menu').innerHTML=categoryLinks;
  $('mobile-menu').innerHTML=`<a href="#home">Home</a><a href="#shop">All artworks</a><a href="#artists">Artists</a><a href="#about">About hehe.cafe</a><a href="#account">My account</a>`;
  $('footer').innerHTML=footerMarkup(siteContent);applyStoreContent(siteContent,route().page);
  liveSiteEditor?.sync();
}
store.observeContent(value=>{
  const nextContent=normalizeContent(value);
  const changed=JSON.stringify(nextContent)!==JSON.stringify(siteContent);
  siteContent=value;contentReady=true;contentError='';
  if(liveSiteEditor.isActive())return;
  refreshStoreContent();
  if(contentEditor){contentEditor.updatePublished(value);return;}
  if(changed&&!submitting&&!isAnimationPlaying()&&!['checkout','account','admin'].includes(route().page))render();
},()=>{contentError='Published page content could not load. Check your connection and deploy the updated Realtime Database rules, then reload. Publishing is disabled until the content loads.';if(!submitting&&!isAnimationPlaying()&&!['checkout','account','admin'].includes(route().page))render();}).catch(()=>{contentError='The page editor could not connect. Reload to try again.';if(!submitting&&!isAnimationPlaying()&&!['checkout','account','admin'].includes(route().page))render();});


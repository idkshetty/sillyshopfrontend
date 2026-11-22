import {escapeHTML as e,money,safeImage} from './commerce.js';
import {locationLink} from './location-utils.js';
import {mapPanel} from './delivery-location.js';
import {logoutMarkup} from './logout.js';
import {steppedProgress} from './stepped-progress.js';
import {pageSkeleton,skeletonMarkup} from './skeletons.js';
const googleIcon=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 262" aria-hidden="true"><path fill="#4285F4" d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622 38.755 30.023 2.685.268c24.659-22.774 38.875-56.282 38.875-96.027"/><path fill="#34A853" d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055-34.523 0-63.824-22.773-74.269-54.25l-1.531.13-40.298 31.187-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1"/><path fill="#FBBC05" d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82 0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602l42.356-32.782"/><path fill="#EB4335" d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0 79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251"/></svg>`;
const statuses={details_received:'Details received',reviewed:'Reviewed by studio',contacted:'Studio contacted you',closed:'Closed',processing:'Preparing your order',packed:'Packed',shipped:'Shipped',out_for_delivery:'Out for delivery',delivered:'Delivered',cancel_requested:'Cancellation requested',cancelled:'Cancelled'};
const date=value=>{const d=new Date(value?.seconds?value.seconds*1000:value);return Number.isNaN(+d)?'Just received':d.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});};
const icon=path=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">${path}</svg>`;
const icons={overview:icon('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'),requests:icon('<path d="m3 7 9-4 9 4v10l-9 4-9-4Z M3 7l9 4 9-4 M12 11v10 M8 5l9 4"/>'),profile:icon('<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>')};
const productImageMap=products=>{
  const map=new Map();
  for(const p of products||[]){if(p?.id&&p.images?.[0])map.set(p.id,p.images[0]);}
  return map;
};
export function filterCustomerRequests(requests=[],{filter='all',query=''}={}){
  const q=String(query||'').trim().toLowerCase();
  return (requests||[]).filter(r=>{
    if(filter==='delivered'&&r.status!=='delivered')return false;
    if(filter==='in_progress'&&(['delivered','cancelled','cancel_requested','closed'].includes(r.status)||r.paymentStatus==='refunded'))return false;
    if(filter==='refunded'&&(!['cancelled','cancel_requested','closed'].includes(r.status)&&r.paymentStatus!=='refunded'))return false;
    if(!q)return true;
    const id=String(r.id||'').toLowerCase();
    const st=String(statuses[r.status]||'').toLowerCase();
    const items=(r.items||[]).map(i=>String(i.title||'').toLowerCase()).join(' ');
    return id.includes(q)||id.slice(0,8).includes(q)||st.includes(q)||items.includes(q);
  });
}
function signInCard(loading,error) {
  return `<div class="container"><section class="account-welcome"><div class="account-welcome-art"><img src="assets/silly-sensei-loading.webp" alt="hehe.cafe studio mascot"></div><div class="account-welcome-copy"><p class="eyebrow">Your account</p><h1>Sign in to<br>hehe.cafe</h1><p>View your artwork orders and manage your delivery details.</p><div class="login-benefits"><p>${icons.requests} Follow your checkout requests</p><p>${icons.profile} Save details for your next visit</p></div><button class="google-signin" data-action="signin" ${loading?'disabled':''}>${googleIcon} <span>${loading?'Checking your account…':'Continue with Google'}</span></button><button type="button" class="text-link signin-redirect-link" data-action="signin-redirect" ${loading?'disabled':''}>Popup blocked? Sign in with redirect →</button><p id="auth-notice" class="notice" role="alert">${e(error||'')}</p><p class="small muted">Your account is private. We only use your details to help with your orders.</p><a class="text-link" href="#home">Continue exploring artworks</a></div></section></div>`;
}
function requestCard(request,{productImages=new Map(),open=false}={}) {
  const c=request.customer, reference=request.id.slice(0,8).toUpperCase();
  const paid=['captured','refunded'].includes(request.paymentStatus);
  const stepIds=paid?['contacted','processing','packed','shipped','out_for_delivery','delivered']:['details_received','reviewed','contacted','closed'];
  const stepLabels=paid?['Confirmed','Preparing','Packed','Shipped','Out for delivery','Delivered']:['Received','Reviewed','Contacted','Closed'];
  const step=Math.max(0,stepIds.indexOf(request.status));
  const refunded=request.paymentStatus==='refunded';
  const terminal=['cancelled','cancel_requested'].includes(request.status)||(paid&&request.status==='closed')||refunded;
  const terminalLabel=refunded?'Payment refunded':statuses[request.status]||'Request closed';
  const terminalText=refunded?' · This order is no longer in fulfilment.':request.status==='cancel_requested'?' · The studio is reviewing your cancellation request.':request.status==='cancelled'?' · This request has been cancelled.':' · This order is closed.';
  const progress=terminal?`<p class="request-progress-note" role="status"><strong>${e(terminalLabel)}</strong>${terminalText}</p>`:steppedProgress(stepLabels,step+1,paid?'Order status progress':'Request status progress');
  const totalQty=(request.items||[]).reduce((n,i)=>n+i.quantity,0);
  const displayTotal=Number.isFinite(Number(request.estimatedSubtotal))?Number(request.estimatedSubtotal):(request.quote?.amount?request.quote.amount/100:0);
  const leadItem=(request.items||[])[0];
  const leadImg=leadItem?safeImage(leadItem.image||leadItem.thumbnail||productImages.get(leadItem.productId||leadItem.id),''):'';
  const paymentBlock=request.checkoutPayment
    ?(request.paymentStatus!=='captured'&&request.paymentStatus!=='refunded'&&!['cancelled','cancel_requested','closed'].includes(request.status)
      ?`<div class="payment-info">Pay for items now: <strong>${money(request.quote.amount/100)}</strong><p>Shipping will be confirmed and billed separately by the studio.</p><button class="button small" data-action="pay-request" data-id="${e(request.id)}" data-purpose="items">Pay item subtotal</button></div>`
      :request.paymentStatus==='captured'
        ?`<div class="payment-info">Item subtotal paid: <strong>${money(request.quote.amount/100)}</strong>${request.shippingQuote?.amount>0?request.shippingPaymentStatus==='captured'?`<p>Shipping paid: ${money(request.shippingQuote.amount/100)}</p>`:`<p>Shipping charge due: <strong>${money(request.shippingQuote.amount/100)}</strong></p><button class="button small" data-action="pay-request" data-id="${e(request.id)}" data-purpose="shipping">Pay shipping</button>`:request.shippingQuote?.amount===0?'<p>Shipping confirmed: no additional charge.</p>':'<p>Shipping will be confirmed and billed separately by the studio.</p>'}</div>`
        :'')
    :request.quote&&!['captured','refunded'].includes(request.paymentStatus)&&!['cancelled','cancel_requested','closed'].includes(request.status)
      ?`<div class="payment-info">Studio-confirmed total: <strong>${money(request.quote.amount/100)}</strong><p>Includes the agreed delivery charges. Read the <a class="text-link" href="#info/refunds">cancellation policy</a> before paying.</p><button class="button small" data-action="pay-request" data-id="${e(request.id)}" data-purpose="items">Pay with Razorpay</button></div>`
      :'';
  const statusHint=request.checkoutPayment
    ?(request.paymentStatus==='captured'?'Item subtotal paid':request.paymentStatus==='refunded'?'Payment refunded':'Item payment pending')
    :request.paymentStatus==='captured'?'Payment received':request.paymentStatus==='refunded'?'Payment refunded':'Checkout request / awaiting studio quote';
  const cancelBlock=!['cancelled','cancel_requested','closed','packed','shipped','out_for_delivery','delivered'].includes(request.status)
    ?`<div class="cancel-form"><h3>Need to cancel this order?</h3><p class="small muted">Unpaid requests without a confirmed quote are cancelled immediately. Confirmed orders go to the studio for review.</p><label class="field">Reason (optional)<textarea maxlength="500" placeholder="Let the studio know why"></textarea></label><button class="button outline small" data-action="cancel-request" data-id="${e(request.id)}">Confirm cancellation request</button></div>`
    :'<p class="small muted">This order can no longer be cancelled online. Reach out to the studio directly if you need assistance.</p>';
  return `<details class="customer-request order-history-card" ${open?'open':''}>
    <summary>
      <div class="order-thumb-box">${leadImg?`<img src="${e(leadImg)}" alt="${e(leadItem?.title||'Artwork')}" loading="lazy" decoding="async">`:`<span class="order-thumb-fallback">${icons.requests}</span>`}</div>
      <div class="order-meta-cols">
        <div class="order-meta-col"><small>Order number</small><strong>#${e(reference)}</strong></div>
        <div class="order-meta-col"><small>Ordered date</small><strong>${date(request.createdAt)}</strong></div>
        <div class="order-meta-col"><small>Status</small><span class="request-status status-${e(request.status)}">${e(statuses[request.status]||'Details received')}</span></div>
      </div>
      <div class="order-summary-right">
        <span class="order-brand-mark">hehe.cafe</span>
        <div class="request-amount"><strong>${money(displayTotal)}</strong><span>${totalQty} ${totalQty===1?'item':'items'}</span></div>
        <span class="request-expand" aria-hidden="true"><svg viewBox="0 0 24 24" class="ui-chevron" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></span>
      </div>
    </summary>
    <div class="customer-request-body">
      <div class="order-inner-tabs" role="tablist" aria-label="Order card views">
        <button type="button" class="order-inner-tab is-active" role="tab" aria-selected="true" data-action="order-card-tab" data-order-tab="overview">Overview</button>
        <button type="button" class="order-inner-tab" role="tab" aria-selected="false" data-action="order-card-tab" data-order-tab="details">Order details</button>
        <button type="button" class="order-inner-tab" role="tab" aria-selected="false" data-action="order-card-tab" data-order-tab="track">Track</button>
        <button type="button" class="order-inner-tab" role="tab" aria-selected="false" data-action="order-card-tab" data-order-tab="help">Help with order</button>
      </div>
      <section class="order-tab-panel" data-order-panel="overview">
        <div class="order-overview-banner">
          <strong>${e(statuses[request.status]||'Details received')}</strong>
          <span>${e(statusHint)}</span>
        </div>
        ${paymentBlock}
        ${request.refundStatus==='required'?'<p class="payment-info">Cancellation approved. Your refund is awaiting processing by the studio.</p>':''}
        <div class="order-items-list">
          ${(request.items||[]).map(item=>{
            const thumb=safeImage(item.image||item.thumbnail||productImages.get(item.productId||item.id),'');
            return `<div class="order-item-row">
              <div class="order-item-thumb">${thumb?`<img src="${e(thumb)}" alt="${e(item.title)}" loading="lazy" decoding="async">`:`<span>${icons.requests}</span>`}</div>
              <div class="order-item-copy"><strong>${e(item.title)}</strong><small>${money(item.unitPrice)} × ${item.quantity}</small></div>
              <strong class="order-item-total">${money(item.unitPrice*item.quantity)}</strong>
            </div>`;
          }).join('')}
        </div>
        <button type="button" class="text-link order-notes-trigger" data-action="request-customizations" data-id="${e(request.id)}">View product notes &amp; images</button>
        <div id="request-custom-${e(request.id)}" class="request-customizations"></div>
        <div class="order-card-footer">
          <div class="order-invoice-slot">${paid?`<button class="button outline small" data-action="download-invoice" data-id="${e(request.id)}">Download invoice</button>`:'<span class="small muted">Invoice ready once payment is verified</span>'}</div>
          <div class="order-footer-total"><span>${totalQty} ${totalQty===1?'item':'items'}</span><strong>${money(displayTotal)}</strong></div>
        </div>
      </section>
      <section class="order-tab-panel" data-order-panel="details" hidden>
        <div class="request-detail-grid">
          <section>
            <h3>Your collection</h3>
            ${(request.items||[]).map(item=>`<div class="customer-line"><span>${e(item.title)}<small>Quantity ${item.quantity}</small></span><strong>${money(item.unitPrice*item.quantity)}</strong></div>`).join('')}
          </section>
          <section>
            <h3>Delivery details</h3>
            <p class="small muted">Shipped via India Post</p>
            <p>${e(c.firstName)} ${e(c.lastName)}<br>${e(c.address)}${c.apartment?`<br>${e(c.apartment)}`:''}<br>${e(c.city)}, ${e(c.state)} ${e(c.postalCode)}<br>${e(c.phone)}</p>
            <a class="text-link" href="${e(locationLink(c))}" target="_blank" rel="noopener">View your delivery pin ↗</a>
            ${c.notes?`<h3>Your note</h3><p class="product-note-copy">${e(c.notes)}</p>`:''}
          </section>
        </div>
      </section>
      <section class="order-tab-panel" data-order-panel="track" hidden>
        <div class="request-order-progress ${paid?'is-delivery-progress':''}">${progress}</div>
      </section>
      <section class="order-tab-panel" data-order-panel="help" hidden>
        <div class="order-help-grid">
          ${cancelBlock}
          <div class="order-help-links">
            <p class="small muted">Questions about shipping, framing or studio timing?</p>
            <a class="text-link" href="#info/contact">Contact hehe.cafe studio →</a>
            <a class="text-link" href="#info/refunds">Read refund &amp; cancellation policy →</a>
          </div>
        </div>
      </section>
    </div>
  </details>`;
}
function emptyRequests() {return `<div class="dashboard-empty"><span>${icons.requests}</span><h3>No orders yet</h3><p>Requests saved while signed in will appear here as the studio reviews them.</p><a class="button" href="#shop">Explore the collection →</a></div>`;}
export function ordersListMarkup(requests=[],{filter='all',query='',products=[],openFirst=true}={}){
  const list=filterCustomerRequests(requests,{filter,query});
  if(!requests.length)return emptyRequests();
  if(!list.length)return `<div class="dashboard-empty"><span>${icons.requests}</span><h3>No matching orders</h3><p>Try a different filter or search keyword.</p><button type="button" class="button outline small" data-action="account-order-filter" data-filter="all">Show all orders</button></div>`;
  const productImages=productImageMap(products);
  return list.map((req,idx)=>requestCard(req,{productImages,open:openFirst&&idx===0})).join('');
}
function profileForm(user,profile,states) {
  const names=(user.displayName||'').trim().split(/\s+/),p={firstName:names[0]||'',lastName:names.slice(1).join(' '),...profile};
  const input=(key,label,max=100,auto='',required=false)=>`<label class="field">${label}<input name="${key}" value="${e(p[key]||'')}" maxlength="${max}" autocomplete="${auto}" ${required?'required':''}></label>`;
  return `<form id="customer-profile-form" class="dashboard-panel profile-form"><div class="panel-heading"><div><h2>Personal details</h2><p>Update your contact details.</p></div><span class="secure-badge">Private to you</span></div><div class="form-grid">${input('firstName','First name',100,'given-name',true)}${input('lastName','Last name',100,'family-name',true)}<label class="field">Email address<input value="${e(user.email||'')}" type="email" readonly><small>Managed by your Google account</small></label>${input('phone','Mobile number',16,'tel')}</div><hr><h2>Default delivery address</h2><p class="small muted">Optional. Saved details and a confirmed delivery pin fill checkout. You can update the pin anytime.</p><div class="form-grid">${input('address','Street address',300,'address-line1')}${input('apartment','Apartment / landmark',150,'address-line2')}${input('city','City',100,'address-level2')}<label class="field">State<select name="state" autocomplete="address-level1"><option value="">Choose state</option>${states.map(state=>`<option ${p.state===state?'selected':''}>${e(state)}</option>`).join('')}</select></label>${input('postalCode','PIN code',6,'postal-code')}<label class="field">Country<input value="India" readonly></label></div>${mapPanel(p.location)}<div class="profile-save"><button type="submit" class="button">Save my details →</button><p id="profile-notice" class="notice" role="status"></p></div></form>`;
}
export function accountMarkup(user,admin,state={}) {
  if(state.authLoading)return pageSkeleton('account');
  if (!user || user.isAnonymous) return signInCard(state.authLoading,state.authError);
  if(state.loaded===false)return pageSkeleton('account');
  const tab=['requests','profile'].includes(state.tab)?state.tab:'overview',profile=state.profile||{},requests=state.requests||[],products=state.products||[];
  const orderFilter=state.orderFilter||'all',orderQuery=state.orderQuery||'';
  const name=profile.firstName||user.displayName?.split(' ')[0]||'friend',initials=((profile.firstName||user.displayName||'S')[0]+(profile.lastName||'').slice(0,1)).toUpperCase();
  const title={overview:'Account overview',requests:'Order history',profile:'My details'}[tab];
  const subtitle=tab==='requests'
    ?`You have <strong>${requests.length} ${requests.length===1?'order':'orders'}</strong> in total`
    :tab==='profile'
      ?'Manage your personal contact information and default delivery pin.'
      :'Track recent artwork orders, saved address and studio updates.';
  const loadState=state.loading?skeletonMarkup('rows','Loading your requests…'):state.error?`<div class="dashboard-error" role="alert"><p>${e(state.error)}</p><button class="text-link" data-action="account-refresh">Try again →</button></div>`:'';
  const ordersHtml=loadState||ordersListMarkup(requests,{filter:orderFilter,query:orderQuery,products,openFirst:true});
  const recentHtml=loadState||ordersListMarkup(requests.slice(0,3),{filter:'all',query:'',products,openFirst:false});
  const address=profile.address?`<p>${e(profile.address)}${profile.apartment?`, ${e(profile.apartment)}`:''}<br>${e(profile.city)}${profile.state?`, ${e(profile.state)}`:''} ${e(profile.postalCode)}</p>`:'<p>Add your delivery address for a quicker checkout next time.</p>';
  const filterTabs=[['all','View all'],['delivered','Delivered'],['in_progress','In progress'],['refunded','Cancelled']];
  const content=tab==='profile'
    ?`${state.profileError?`<p class="notice" role="alert">${e(state.profileError)}</p>`:''}${profileForm(user,profile,state.states||[])}`
    :tab==='requests'
      ?`<div class="order-history-toolbar">
          <div class="order-filter-pills" role="tablist" aria-label="Filter orders">
            ${filterTabs.map(([id,label])=>`<button type="button" class="order-filter-pill ${orderFilter===id?'is-active':''}" role="tab" aria-selected="${orderFilter===id?'true':'false'}" data-action="account-order-filter" data-filter="${id}">${label}</button>`).join('')}
          </div>
          <label class="order-search-box">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
            <input type="search" id="account-order-search" value="${e(orderQuery)}" placeholder="Order ID, artwork name…" aria-label="Search orders">
          </label>
        </div>
        <div id="account-orders-list">${ordersHtml}</div>
        ${state.hasMore?'<button class="button outline" data-action="account-more">Load older orders</button>':''}`
      :`<div class="dashboard-stats"><article>${icons.requests}<span>Latest request</span><strong>${requests[0]?`#${e(requests[0].id.slice(0,8).toUpperCase())}`:'No requests yet'}</strong><small>${requests[0]?e(statuses[requests[0].status]):'Your requests will appear here'}</small></article><article>${icons.profile}<span>Your details</span><strong>${profile.address?'Ready for next time':'Make checkout easier'}</strong><a href="#account/profile">${profile.address?'Manage your address':'Add delivery details'} →</a></article><article class="dashboard-studio"><img src="assets/silly-sensei-loading.webp" alt=""><span>hehe.cafe</span><strong>Browse the<br>gallery</strong><a href="#home">View artworks →</a></article></div><div class="section-heading"><h2>Recent orders</h2><a class="text-link" href="#account/requests">View all →</a></div><div id="account-recent-list">${recentHtml}</div><div class="dashboard-bottom"><section class="dashboard-panel"><p class="eyebrow">Delivery, made easier</p><h2>Your saved address</h2>${address}<a class="text-link" href="#account/profile">Manage details →</a></section><section class="dashboard-panel"><p class="eyebrow">Support</p><h2>Need help?</h2><p>Have a question about a piece or your request? The studio is here to help.</p><a class="text-link" href="#info/contact">Get in touch →</a></section></div>`;
  return `<div class="wide-container customer-dashboard"><aside class="customer-sidebar"><a class="dashboard-identity" href="#account"><span class="customer-avatar">${e(initials)}</span><div><strong class="sidebar-greeting">Hey, ${e(name)}</strong><small class="sidebar-email">${e(user.email||'')}</small></div></a><nav aria-label="Account navigation">${[['overview','Account overview'],['requests','Order history'],['profile','My details']].map(([key,label])=>`<a href="#account${key==='overview'?'':'/'+key}" ${tab===key?'aria-current="page"':''}>${icons[key]}<span>${label}</span>${key==='requests'&&requests.length?`<span class="sidebar-nav-count">${requests.length}</span>`:''}</a>`).join('')}</nav><div class="customer-sidebar-bottom"><div class="customer-sidebar-links">${admin?'<a class="text-link" href="#admin">Open studio dashboard ↗</a>':''}<a class="text-link" href="#shop">Back to gallery ↗</a></div>${logoutMarkup()}</div></aside><section class="customer-main"><header class="dashboard-heading"><div><h1>${title}</h1><p>${subtitle}</p></div>${tab==='requests'?'<button type="button" class="button outline small" data-action="account-refresh">Refresh ↻</button>':'<a class="button outline small" href="#shop">Continue shopping ↗</a>'}</header>${content}</section></div>`;
}

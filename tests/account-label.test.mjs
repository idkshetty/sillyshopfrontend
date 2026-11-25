import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProfile,validateProfile,checkoutDefaults} from '../frontend/profile.js';
import {defaultLabel,normalizeLabel,validateLabel} from '../frontend/label-data.js';
import {labelMarkup} from '../frontend/labels.js';
import {accountMarkup} from '../frontend/customer-dashboard.js';
import {canPrintOrderLabel,orderCardMarkup} from '../frontend/admin-ui.js';
import {infoMarkup} from '../frontend/storefront-view.js';
import {DEFAULT_CONTENT} from '../frontend/store-content.js';
import {friendlyError} from '../frontend/store.js';
const request={id:'label-test',customer:{firstName:'Test',lastName:'Customer',address:'12 Test Lane',apartment:'',city:'Bengaluru',state:'Karnataka',postalCode:'560001',phone:'9876543210',location:{latitude:12.97,longitude:77.59,confirmed:true,source:'pin',accuracy:0,formattedAddress:'Bengaluru'}},items:[{quantity:1}]};
test('profile accepts optional address fields and safely retains a confirmed delivery pin',()=>{
  const p=normalizeProfile({firstName:' Test ',lastName:'Customer'});assert.equal(validateProfile(p),'');assert.equal(p.firstName,'Test');
  assert.ok(validateProfile({...p,postalCode:'000000'}));assert.ok(validateProfile({...p,phone:'123'}));
  const location={latitude:12.97,longitude:77.59,source:'pin',accuracy:0,formattedAddress:'Bengaluru',confirmed:true};
  assert.deepEqual(normalizeProfile({firstName:'Test',lastName:'Customer',location}).location,location);
  assert.equal(validateProfile(normalizeProfile({firstName:'Test',lastName:'Customer',location:{...location,latitude:500}})),'Choose and confirm a valid delivery pin.');
});
test('checkout autofills profile fields and falls back to the latest confirmed order pin',()=>{
  const location={latitude:12.9716,longitude:77.5946,source:'pin',accuracy:0,formattedAddress:'Bengaluru, Karnataka',confirmed:true};
  const defaults=checkoutDefaults({firstName:'Saved',phone:'9876543210'},
    {email:'buyer@example.com',displayName:'Account Name'},
    [{customer:{firstName:'Older',lastName:'Customer',address:'12 Saved Road',city:'Bengaluru',state:'Karnataka',postalCode:'560001',location}}]);
  assert.equal(defaults.email,'buyer@example.com');
  assert.equal(defaults.firstName,'Saved');
  assert.equal(defaults.lastName,'Customer');
  assert.equal(defaults.address,'12 Saved Road');
  assert.equal(defaults.postalCode,'560001');
  assert.deepEqual(defaults.location,location);
  assert.deepEqual(checkoutDefaults({location},{email:'buyer@example.com'},[]).location,location,
    'a confirmed location saved in the profile should fill checkout without needing order history');
});
test('label overrides preserve source data and escape text before rendering',()=>{
  const original=JSON.stringify(request),text=normalizeLabel(request,{recipient:'<img src=x onerror=bad>',handling:'Fragile'});
  assert.equal(validateLabel(text),'');assert.equal(JSON.stringify(request),original);
  const html=labelMarkup(request,text,'<svg></svg>');assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img src=x'));assert.ok(html.includes('12.970000'));
  assert.ok(validateLabel({...defaultLabel(request),postalCode:'bad'}));
});
test('signed-out account has real sign-in only and dashboard escapes profile content',()=>{
  const signedOut=accountMarkup(null,false);assert.ok(signedOut.includes('Continue with Google'));assert.ok(!signedOut.includes('preview-admin'));
  assert.ok(signedOut.includes('id="email-auth-form"'));
  assert.ok(signedOut.includes('data-auth-mode="signin"'));
  assert.ok(signedOut.includes('name="email"')&&signedOut.includes('name="password"'));
  assert.ok(signedOut.includes('Forgot password?'));
  const signUpView=accountMarkup(null,false,{authMode:'signup'});
  assert.ok(signUpView.includes('data-auth-mode="signup"'));
  assert.ok(signUpView.includes('name="name"')&&signUpView.includes('name="confirmPassword"'));
  assert.ok(signUpView.includes('Create account →'));
  const html=accountMarkup({uid:'test',displayName:'Test',email:'test@example.com'},false,{profile:{firstName:'<script>x</script>'},requests:[]});
  assert.ok(html.includes('Request')||html.includes('requests'));assert.ok(!html.includes('<script>x'));assert.ok(!html.includes('Open studio dashboard'));
});
test('customer order history uses the shared stepped progress bar for fulfilment status',()=>{
  const order={...request,id:'order-track-123456',status:'shipped',paymentStatus:'captured',estimatedSubtotal:1200,createdAt:Date.now(),items:[{title:'Painted cup',quantity:1,unitPrice:1200}]};
  const html=accountMarkup({uid:'buyer',displayName:'Test Buyer',email:'buyer@example.com'},false,{tab:'requests',requests:[order]});
  assert.ok(html.includes('aria-label="Order status progress"'));
  assert.ok(html.includes('Confirmed')&&html.includes('Out for delivery')&&html.includes('Delivered'));
  assert.ok(html.includes('aria-current="step"'));
  assert.ok(html.includes('request-order-progress is-delivery-progress'));
  assert.ok(!html.includes('request-timeline'));
});
test('checkout payment separates the paid item subtotal from a later shipping payment',()=>{
  const order={...request,id:'split-payment-order',status:'processing',paymentStatus:'captured',checkoutPayment:true,quote:{amount:12000},shippingQuote:{amount:1800},shippingPaymentStatus:'not_started',estimatedSubtotal:120,createdAt:Date.now(),items:[{title:'Painted cup',quantity:1,unitPrice:120}]};
  const html=accountMarkup({uid:'buyer',displayName:'Test Buyer',email:'buyer@example.com'},false,{tab:'requests',requests:[order]});
  assert.match(html,/Payment successful/);assert.match(html,/Item subtotal paid/);assert.match(html,/Shipping charge due/);assert.match(html,/data-purpose="shipping"/);assert.match(html,/Pay shipping/);
  const failedOrder={...request,id:'failed-payment-order',status:'cancelled',paymentStatus:'failed',checkoutPayment:true,quote:{amount:12000},estimatedSubtotal:120,createdAt:Date.now(),items:[{title:'Painted cup',quantity:1,unitPrice:120}]};
  const failedHtml=accountMarkup({uid:'buyer',displayName:'Test Buyer',email:'buyer@example.com'},false,{tab:'requests',requests:[failedOrder]});
  assert.match(failedHtml,/Payment failed/);assert(!/Payment pending/i.test(failedHtml));
  const inclusiveOrder={...request,id:'inclusive-shipping-order',status:'processing',paymentStatus:'captured',checkoutPayment:true,quote:{amount:33000,subtotal:25000,shipping:8000},estimatedSubtotal:250,createdAt:Date.now(),items:[{title:'Cup A',quantity:1,unitPrice:150},{title:'Cup B',quantity:1,unitPrice:100}]};
  const inclusiveHtml=accountMarkup({uid:'buyer',displayName:'Test Buyer',email:'buyer@example.com'},false,{tab:'requests',requests:[inclusiveOrder]});
  assert.match(inclusiveHtml,/Total paid/);assert.match(inclusiveHtml,/330\.00/);assert.match(inclusiveHtml,/Includes India Post shipping.*80\.00/);
});
test('unverified email/password user sees verification banner and profile tab exposes DPDP privacy controls',()=>{
  const unverifiedHtml=accountMarkup({uid:'pw-user',displayName:'Buyer',email:'buyer@example.com',emailVerified:false},false,{tab:'overview',requests:[]});
  assert.match(unverifiedHtml,/email-verify-banner/);
  assert.match(unverifiedHtml,/data-action="resend-verification"/);
  assert.match(unverifiedHtml,/data-action="refresh-verification"/);
  const verifiedHtml=accountMarkup({uid:'pw-user',displayName:'Buyer',email:'buyer@example.com',emailVerified:true},false,{tab:'profile',profile:{},requests:[],states:['Kerala']});
  assert.doesNotMatch(verifiedHtml,/email-verify-banner/);
  assert.match(verifiedHtml,/data-action="export-my-data"/);
  assert.match(verifiedHtml,/data-action="delete-saved-data"/);
  assert.match(verifiedHtml,/data-action="delete-my-account"/);
});
test('pending checkout shows Payment pending (not Payment failed), non-printable orders hide labels, signup has 2 toggles & policy pages format headings',()=>{
  const baseOrder={...request,id:'pending-checkout-1',customer:{...request.customer},status:'details_received',paymentStatus:'not_started',checkoutPayment:true,razorpayOrderId:'order_123',estimatedSubtotal:290,quote:{amount:29000,shipping:4000},items:[{title:'Clay Cat',quantity:1,unitPrice:250}]};
  const pendingAcct=accountMarkup({uid:'buyer',displayName:'Buyer',email:'buyer@example.com'},false,{tab:'requests',requests:[baseOrder]});
  assert.match(pendingAcct,/Payment pending/);
  assert.doesNotMatch(pendingAcct,/Payment failed/);

  assert.equal(canPrintOrderLabel(baseOrder),false);
  assert.equal(canPrintOrderLabel({...baseOrder,paymentStatus:'failed',status:'cancelled'}),false);
  assert.equal(canPrintOrderLabel({...baseOrder,paymentStatus:'refunded'}),false);
  assert.equal(canPrintOrderLabel({...baseOrder,status:'processing',paymentStatus:'captured'}),true);

  const failedCard=orderCardMarkup({...baseOrder,paymentStatus:'failed',status:'cancelled'});
  assert.match(failedCard,/Payment failed/);
  assert.doesNotMatch(failedCard,/Print label/);
  assert.doesNotMatch(failedCard,/data-select-label-order/);

  const paidCard=orderCardMarkup({...baseOrder,status:'processing',paymentStatus:'captured'});
  assert.match(paidCard,/Payment successful/);
  assert.match(paidCard,/Print label/);
  assert.match(paidCard,/data-select-label-order/);

  const signUpHtml=accountMarkup(null,false,{authMode:'signup'});
  assert.equal((signUpHtml.match(/data-action="toggle-password"/g)||[]).length,2);
  assert.match(signUpHtml,/id="signup-password-hint"/);

  const privacyHtml=infoMarkup(DEFAULT_CONTENT,'privacy');
  assert.match(privacyHtml,/class="policy-meta-banner"/);
  assert.match(privacyHtml,/<h2 id="policy-sec-/);
  assert.match(privacyHtml,/data-action="scroll-policy-sec"/);
  assert.doesNotMatch(privacyHtml,/href="#policy-sec-/);
});
test('friendlyError maps Firebase network and browser auth errors into clear guidance',()=>{
  const netMsg=friendlyError({code:'auth/network-request-failed',message:'Firebase: Error (auth/network-request-failed).'});
  assert.doesNotMatch(netMsg,/Firebase: Error/i);
  assert.match(netMsg,/internet|Google sign-in|Chrome or Safari/i);

  const msgOnly=friendlyError({message:'Firebase: Error (auth/network-request-failed).'});
  assert.doesNotMatch(msgOnly,/Firebase: Error/i);
  assert.match(msgOnly,/Google sign-in/i);

  const storageMsg=friendlyError({code:'auth/web-storage-unsupported'});
  assert.match(storageMsg,/cookies or storage/i);

  const popupBlockedMsg=friendlyError({code:'auth/popup-blocked'});
  assert.match(popupBlockedMsg,/Allow popups/i);
  assert.doesNotMatch(popupBlockedMsg,/Sign in with redirect/i);

  const internalMsg=friendlyError({code:'auth/internal-error'});
  assert.match(internalMsg,/Continue with Google/i);
  assert.doesNotMatch(internalMsg,/Sign in with redirect/i);

  const domainMsg=friendlyError({code:'auth/unauthorized-domain'});
  assert.match(domainMsg,/hehe\.cafe/i);

  const defaultAuth=accountMarkup(null,false);
  assert.doesNotMatch(defaultAuth,/data-action="signin-redirect"/);
  const redirectAllowedAuth=accountMarkup(null,false,{allowRedirect:true});
  assert.match(redirectAllowedAuth,/data-action="signin-redirect"/);
});

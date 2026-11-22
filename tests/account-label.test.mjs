import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProfile,validateProfile,checkoutDefaults} from '../frontend/profile.js';
import {defaultLabel,normalizeLabel,validateLabel} from '../frontend/label-data.js';
import {labelMarkup} from '../frontend/labels.js';
import {accountMarkup} from '../frontend/customer-dashboard.js';
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
});

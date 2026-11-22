import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {isAdmin,verifySignature,verifiedPayment,quoteItems,canTransition} from '../backend/core.js';
import {summarizeSales} from '../frontend/sales-dashboard.js';
import {labelForRequest} from '../frontend/label-data.js';
import {API_ORIGINS} from '../backend/origins.js';
import {availableStatuses,statusHelp,statusChangeError} from '../frontend/order-workflow.js';
test('API origins allow local development and production but reject lookalike hosts',()=>{
  const allowed=origin=>API_ORIGINS.some(rule=>typeof rule==='string'?rule===origin:rule.test(origin));
  for(const origin of ['http://localhost:4173','http://127.0.0.1:5500','https://localhost','http://[::1]:8080','https://www.sillysensei.com','https://shopatsillysensei.web.app'])assert(allowed(origin),origin);
  for(const origin of ['http://localhost.evil.com:5500','https://www.sillysensei.com.evil.com','null','file://localhost','https://attacker.example'])assert(!allowed(origin),origin);
});
test('admin authorization requires a trusted claim or verified allowlisted email',()=>{
  assert.equal(isAdmin({email:'Supritachat.25@gmail.com',email_verified:true}),true);
  for(const token of [{email:'Supritachat.25@gmail.com'},{email:'attacker@example.com',email_verified:true},{admin:'true'},{}])assert.equal(isAdmin(token),false);
});
test('payment and webhook signatures reject changed bodies, malformed signatures and wrong keys',()=>{
  const body='order_abc|pay_123',secret='unit-test-only',signature=createHmac('sha256',secret).update(body).digest('hex');
  assert.equal(verifySignature(body,signature,secret),true);
  assert.equal(verifySignature(body+'x',signature,secret),false);assert.equal(verifySignature(body,signature,'wrong'),false);
  for(const bad of ['abc','g'.repeat(64),undefined])assert.equal(verifySignature(body,bad,secret),false);
});
test('payment is accepted only when captured for the stored order and exact amount/currency',()=>{
  const order={razorpayOrderId:'order_abc',quote:{amount:12300}},p={order_id:'order_abc',amount:12300,currency:'INR',captured:true,status:'captured'};
  assert(verifiedPayment(p,order));
  for(const change of [{order_id:'order_other'},{amount:1},{currency:'USD'},{captured:false},{status:'authorized'}])assert.equal(verifiedPayment({...p,...change},order),false);
});
test('separately confirmed shipping payments require their own stored order and exact amount',()=>{
  const order={checkoutPayment:true,razorpayOrderId:'order_items',quote:{amount:12300},shippingRazorpayOrderId:'order_shipping',shippingQuote:{amount:8500}};
  const shipping={order_id:'order_shipping',amount:8500,currency:'INR',captured:true,status:'captured'};
  assert(verifiedPayment(shipping,order,'shipping'));
  assert.equal(verifiedPayment({...shipping,amount:12300},order,'shipping'),false);
  assert.equal(verifiedPayment({...shipping,order_id:'order_items'},order,'shipping'),false);
  assert.equal(verifiedPayment(shipping,order,'items'),false);
});
test('quotes use current catalogue prices, enforce qty 1, allow 6+ items, and reject duplicates or insufficient stock',()=>{
  const items=[{productId:'art',quantity:1,unitPrice:1}],products={art:{title:'Art',price:450.25,stock:2,visible:true,category:'paintings'}};
  assert.equal(quoteItems(items,products,5000).amount,50025);
  assert.throws(()=>quoteItems([{productId:'art',quantity:2,unitPrice:1}],products,5000));
  const manyProducts=Object.fromEntries(Array.from({length:6},(_,i)=>[`a${i}`,{title:`Art ${i}`,price:100,stock:1,visible:true,category:'paintings'}]));
  const manyQuote=quoteItems(Object.keys(manyProducts).map(productId=>({productId,quantity:1})),manyProducts,24000);
  assert.equal(manyQuote.items.length,6);
  assert.equal(manyQuote.amount,84000);
  for(const [list,stock,shipping] of [[items,0,0],[[...items,...items],2,0],[items,2,-1],[items,2,0.2]])assert.throws(()=>quoteItems(list,{art:{...products.art,stock}},shipping));
});
test('fulfilment cannot bypass payment or reopen a cancelled order',()=>{
  assert.equal(canTransition({status:'processing',paymentStatus:'not_started'},'shipped'),false);
  assert.equal(canTransition({status:'processing',paymentStatus:'captured'},'packed'),true);
  assert.equal(canTransition({status:'cancelled',paymentStatus:'captured'},'processing'),false);
  assert.equal(canTransition({status:'contacted',inventoryReserved:true},'closed'),false);
});
test('admin status choices preserve payment/stock restrictions and explain blocked steps',()=>{
  const unpaid={status:'contacted',paymentStatus:'not_started',inventoryReserved:true};
  assert.deepEqual(availableStatuses(unpaid).map(([s])=>s),['reviewed','contacted']);
  assert.match(statusHelp(unpaid),/verified payment/);
  assert.match(statusChangeError(unpaid,'shipped'),/verified payment/);
  assert.match(statusChangeError(unpaid,'closed'),/reserved stock/);
  assert.deepEqual(availableStatuses({status:'processing',paymentStatus:'captured'}).map(([s])=>s),['processing','packed']);
  for(const status of ['cancelled','closed','cancel_requested'])assert.deepEqual(availableStatuses({status,paymentStatus:'captured'}).map(([s])=>s),[status]);
});
test('sales excludes unverified, unpaid and test data and clamps refunds',()=>{
  const p={verified:true,mode:'live',currency:'INR',amount:10000,refundedAmount:2000,paidAt:'2026-10-01T23:00:00Z',items:[{productId:'a',title:'Art',quantity:2}]};
  const result=summarizeSales([p,{...p,verified:false},{...p,mode:'test'}],{from:'2026-10-02',to:'2026-10-02'});
  assert.equal(result.count,1);assert.equal(result.net,8000);assert.equal(result.products[0].quantity,2);
  assert.equal(summarizeSales([{...p,refundedAmount:50000}]).net,0);
});
test('global label template cannot override individual customer details',()=>{
  const request={customer:{firstName:'A',lastName:'B',address:'Private address',city:'City',state:'State',postalCode:'560001',phone:'9000000000'}};
  const label=labelForRequest(request,{heading:'Ship to',recipient:'Injected recipient',address:'Wrong address'});
  assert.equal(label.heading,'Ship to');assert.equal(label.recipient,'A B');assert.equal(label.address,'Private address');
});
test('sales summary computes per-artist revenue, orders, units and share',()=>{
  const catalog=[{id:'p1',artist:'Suprita Chatterjee',price:300},{id:'p2',artist:'Rohan Verma',price:200}];
  const rows=[
    {verified:true,mode:'live',currency:'INR',amount:84000,paidAt:'2026-10-05T10:00:00Z',items:[{productId:'p1',title:'Cats',quantity:2,unitPrice:300,artist:'Suprita Chatterjee'},{productId:'p2',title:'Snail',quantity:1,unitPrice:200}]},
    {verified:true,mode:'live',currency:'INR',amount:34000,paidAt:'2026-10-06T10:00:00Z',items:[{productId:'p1',title:'Cats',quantity:1,unitPrice:300,artist:'Suprita Chatterjee'}]},
    {verified:false,mode:'live',currency:'INR',amount:50000,paidAt:'2026-10-06T10:00:00Z',items:[{productId:'p2',title:'Snail',quantity:5,unitPrice:200,artist:'Rohan Verma'}]}
  ];
  const res=summarizeSales(rows,{mode:'live',products:catalog});
  assert.equal(res.artists.length,2);
  assert.equal(res.artists[0].artist,'Suprita Chatterjee');
  assert.equal(res.artists[0].orders,2);
  assert.equal(res.artists[0].units,3);
  assert.equal(res.artists[0].revenuePaise,90000);
  assert.equal(res.artists[0].sharePct,81.8);
  assert.equal(res.artists[1].artist,'Rohan Verma');
  assert.equal(res.artists[1].orders,1);
  assert.equal(res.artists[1].units,1);
  assert.equal(res.artists[1].revenuePaise,20000);
  assert.equal(res.artists[1].sharePct,18.2);
});

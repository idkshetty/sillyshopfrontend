process.env.EMAIL_PROVIDER='resend';
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHmac} from 'node:crypto';
process.env.GCLOUD_PROJECT='demo-silly-render';process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8080';
process.env.PAYMENTS_ENABLED='true';process.env.EMAIL_ENABLED='true';process.env.RAZORPAY_KEY_ID='rzp_test_unit';process.env.RAZORPAY_KEY_SECRET='unit-secret';process.env.EMAIL_FROM='Studio <studio@example.com>';process.env.STORE_URL='https://www.sillysensei.com/shop.html';process.env.RESEND_API_KEY='unit-secret';
const require=createRequire(new URL('../backend/package.json',import.meta.url)),{getFirestore,Timestamp}=require('firebase-admin/firestore'),{getAuth}=require('firebase-admin/auth');
await fetch('http://127.0.0.1:8080/emulator/v1/projects/demo-silly-render/databases/(default)/documents',{method:'DELETE'});
const functions=await import('../backend/service.js'),db=getFirestore(),auth=getAuth();
const admin={uid:'backend-admin',token:{admin:true,email_verified:true}},owner={uid:'backend-owner',token:{email:'owner@example.com',email_verified:true}},stranger={uid:'stranger',token:{email_verified:true}};
let sends=0,payment={},created=0;const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>{
 if(String(url).startsWith('https://api.razorpay.com/v1/orders')){created++;const body=JSON.parse(options.body);return {ok:true,json:async()=>({id:'order_unit'+created,amount:body.amount})};}
 if(String(url).startsWith('https://api.razorpay.com/v1/payments/'))return {ok:true,json:async()=>payment};
 if(String(url)==='https://api.resend.com/emails'){sends++;const body=JSON.parse(options.body);assert.deepEqual(body.to,['owner@example.com']);assert(!body.text.includes('Private Street'));assert(!body.text.includes('12.9716'));return {ok:true,json:async()=>({id:'email-unit'})};}
 return originalFetch(url,options);
};
const getUser=auth.getUser.bind(auth);auth.getUser=async uid=>({uid,email:'owner@example.com',emailVerified:true});
after(async()=>{auth.getUser=getUser;globalThis.fetch=originalFetch;await db.terminate();});
const invoke=(name,context,data)=>functions[name]({auth:context,data});
const ref=db.doc('checkoutRequests/backend-flow');
test('server quote, payment, cancellation and refund lifecycle is private and idempotent',async()=>{
 await db.doc('products/backend-art').set({title:'Painting',category:'paintings',price:450.25,visible:true,stock:2});
 await ref.set({uid:owner.uid,customer:{firstName:'Test',lastName:'Buyer',email:'not-the-owner@example.com',phone:'9000000000',address:'Private Street'},items:[{productId:'backend-art',quantity:2,unitPrice:1}],status:'details_received',paymentStatus:'not_started',createdAt:Timestamp.now()});
 await assert.rejects(invoke('approveQuote',owner,{requestId:ref.id,shipping:0}));
 await assert.rejects(invoke('approveQuote',null,{requestId:ref.id,shipping:0}));
 const quotes=await Promise.all([invoke('approveQuote',admin,{requestId:ref.id,shipping:5000}),invoke('approveQuote',admin,{requestId:ref.id,shipping:5000})]);assert.equal(quotes[0].amount,95050);assert.equal((await db.doc('products/backend-art').get()).data().stock,0);
 await assert.rejects(invoke('createRazorpayOrder',stranger,{requestId:ref.id}));
 await assert.rejects(invoke('getInvoice',owner,{requestId:ref.id}));
 const gateway=await invoke('createRazorpayOrder',owner,{requestId:ref.id});await invoke('createRazorpayOrder',owner,{requestId:ref.id});assert.equal(created,1);
 payment={id:'pay_unit',order_id:gateway.orderId,amount:gateway.amount,currency:'INR',captured:true,status:'captured',created_at:Math.floor(Date.now()/1000),amount_refunded:0};
 await assert.rejects(invoke('verifyRazorpayPayment',owner,{requestId:ref.id,paymentId:'pay_unit',signature:'0'.repeat(64)}));
 const data={requestId:ref.id,paymentId:'pay_unit',signature:createHmac('sha256','unit-secret').update(gateway.orderId+'|pay_unit').digest('hex')};
 assert.equal((await invoke('verifyRazorpayPayment',owner,data)).paid,true);assert.equal((await invoke('verifyRazorpayPayment',owner,data)).paid,true);assert.equal((await ref.get()).data().status,'processing');
 await assert.rejects(invoke('getInvoice',null,{requestId:ref.id}));
 await assert.rejects(invoke('getInvoice',stranger,{requestId:ref.id}));
 assert.equal((await invoke('getInvoice',owner,{requestId:ref.id})).amount,95050);
 assert.equal((await invoke('getInvoice',admin,{requestId:ref.id})).shipping,5000);
 await invoke('cancelRequest',owner,{requestId:ref.id,reason:'Changed my mind'});await invoke('resolveCancellation',admin,{requestId:ref.id,approve:true});assert.equal((await ref.get()).data().refundStatus,'required');assert.equal((await db.doc('products/backend-art').get()).data().stock,2);
 await assert.rejects(invoke('resolveCancellation',admin,{requestId:ref.id,approve:true}));
 payment={...payment,status:'refunded',amount_refunded:gateway.amount};await invoke('verifyRazorpayPayment',owner,data);const sale=(await db.doc('sales/'+ref.id).get()).data();assert.equal(sale.refundedAmount,sale.amount);assert.equal(sale.mode,'test');assert.equal((await ref.get()).data().paymentStatus,'refunded');
 assert.equal((await invoke('getInvoice',owner,{requestId:ref.id})).refundedAmount,gateway.amount);
});
test('status emails survive in the outbox and duplicate processing does not resend',async()=>{
 const {sendQueuedEmail}=await import('../backend/mail.js');
 const messages=await db.collection('mailOutbox').where('requestId','==',ref.id).get();assert(messages.size>=4);
 const message=messages.docs[0];await sendQueuedEmail(db,auth,message.ref);await sendQueuedEmail(db,auth,message.ref);
 assert.equal(sends,1);assert.equal((await message.ref.get()).data().state,'sent');
});
test('checkout subtotal and later shipping use separate verified Razorpay orders and one invoice',async()=>{
 const item={productId:'shipping-art',title:'Small sculpture',category:'clay-models',quantity:1,unitPrice:20};
 await db.doc('products/shipping-art').set({title:item.title,category:item.category,price:20,visible:true,stock:0});
 const shippingRef=db.doc('checkoutRequests/split-payment-flow');
 await shippingRef.set({uid:owner.uid,customer:{firstName:'Test',lastName:'Buyer',phone:'9000000000',address:'Private Street'},items:[item],estimatedSubtotal:20,currency:'INR',status:'processing',paymentStatus:'captured',checkoutPayment:true,inventoryReserved:true,quote:{amount:2000,subtotal:2000,shipping:0,currency:'INR'},createdAt:Timestamp.now(),updatedAt:Timestamp.now()});
 await db.doc('sales/'+shippingRef.id).set({verified:true,requestId:shippingRef.id,paymentId:'pay_item_existing',itemAmount:2000,amount:2000,refundedAmount:0,mode:'test',currency:'INR',paidAt:Timestamp.now(),items:[item]});
 const quote=await invoke('approveQuote',admin,{requestId:shippingRef.id,shipping:800});assert.equal(quote.amount,800);
 const shippingOrder=await invoke('createRazorpayOrder',owner,{requestId:shippingRef.id,purpose:'shipping'});assert.equal(shippingOrder.amount,800);
 payment={id:'pay_shipping',order_id:shippingOrder.orderId,amount:800,currency:'INR',captured:true,status:'captured',created_at:Math.floor(Date.now()/1000),amount_refunded:0};
 const data={requestId:shippingRef.id,purpose:'shipping',paymentId:'pay_shipping',signature:createHmac('sha256','unit-secret').update(shippingOrder.orderId+'|pay_shipping').digest('hex')};
 assert.equal((await invoke('verifyRazorpayPayment',owner,data)).paid,true);
 const saved=(await shippingRef.get()).data(),sale=(await db.doc('sales/'+shippingRef.id).get()).data();
 assert.equal(saved.shippingPaymentStatus,'captured');assert.equal(saved.paidAmount,2800);assert.equal(sale.amount,2800);assert.equal(sale.shippingAmount,800);
 const invoice=await invoke('getInvoice',owner,{requestId:shippingRef.id});assert.equal(invoice.amount,2800);assert.equal(invoice.shipping,800);
});

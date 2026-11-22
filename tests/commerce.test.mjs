import test from 'node:test';
import assert from 'node:assert/strict';
import {cartLines,subtotal,totalWithShipping,shippingForQuantity,shippingPaiseForQuantity,filterProducts,validateCustomer,safeImage,escapeHTML,CATEGORIES} from '../frontend/commerce.js';
import {pruneCart} from '../frontend/cart-state.js';
const products=[{id:'a',title:'Landscape',description:'Mountain painting',category:'paintings',price:10.10,stock:2,visible:true},{id:'b',title:'Clay friend',description:'Small clay model',category:'clay-models',price:0.20,stock:3,visible:true},{id:'hidden',title:'Hidden',price:20,stock:5,visible:false},{id:'sold',title:'Sold',price:30,stock:0,visible:true}];
test('cart drops hidden, removed, sold out, duplicate and malformed lines; caps stock',()=>{
  const result=cartLines([{id:'a',quantity:8},{id:'a',quantity:1},{id:'b',quantity:1.2},{id:'hidden',quantity:1},{id:'sold',quantity:1},{id:'gone',quantity:1},null],products);
  assert.equal(result.length,1);assert.equal(result[0].quantity,2);assert.equal(result[0].total,20.20);
});
test('pruneCart removes unavailable or sold-out items, clamps stock, and emits user notes',()=>{
  const pruned=pruneCart(
    [{id:'a',quantity:5},{id:'b',quantity:2},{id:'hidden',quantity:1},{id:'sold',quantity:1},{id:'gone',quantity:1}],
    products,
    [{id:'gone',title:'Removed Sketch'}]
  );
  assert.equal(pruned.changed,true);
  assert.deepEqual(pruned.cart,[{id:'a',quantity:2},{id:'b',quantity:2}]);
  assert.deepEqual(pruned.removedIds,['hidden','sold','gone']);
  assert.equal(pruned.notes.length,4);
  assert.ok(pruned.notes.some(n=>n.includes('Landscape')&&n.includes('adjusted to 2')));
  assert.ok(pruned.notes.some(n=>n.includes('Sold')&&n.includes('sold out')));
  assert.ok(pruned.notes.some(n=>n.includes('Hidden')&&n.includes('no longer available')));
  assert.ok(pruned.notes.some(n=>n.includes('Removed Sketch')&&n.includes('no longer available')));
  const clean=pruneCart([{id:'b',quantity:1}],products);
  assert.equal(clean.changed,false);
  assert.deepEqual(clean.notes,[]);
});
test('subtotal uses integer paise arithmetic',()=>assert.equal(subtotal(cartLines([{id:'a',quantity:1},{id:'b',quantity:1}],products)),10.30));
test('shipping multiplies ₹40 per total item quantity in totals and paise helpers',()=>{
  assert.equal(shippingForQuantity(1),40);
  assert.equal(shippingForQuantity(2),80);
  assert.equal(shippingPaiseForQuantity(2),8000);
  assert.equal(shippingPaiseForQuantity(3),12000);
  const one=cartLines([{id:'a',quantity:1}],products);
  const two=cartLines([{id:'a',quantity:2}],products);
  const three=cartLines([{id:'a',quantity:2},{id:'b',quantity:1}],products);
  assert.equal(totalWithShipping(one),50.10);
  assert.equal(totalWithShipping(two),100.20);
  assert.equal(totalWithShipping(three),140.40);
  assert.equal(totalWithShipping([]),0);
});
test('public category, search, availability and price sorting compose',()=>{
  assert.deepEqual(filterProducts(products,{search:'CLAY',available:true}).map(p=>p.id),['b']);
  assert.deepEqual(filterProducts(products,{category:'paintings'}).map(p=>p.id),['a']);
  assert.deepEqual(filterProducts(products,{sort:'price-asc',available:true}).map(p=>p.id),['b','a']);
  assert.equal(CATEGORIES.length,4);
});
const customer={email:'preview@example.com',phone:'+91 9876543210',firstName:'Sample',lastName:'Customer',address:'12 Example Lane',apartment:'',city:'Bengaluru',state:'Karnataka',postalCode:'560001',country:'India',notes:'',consent:true,location:{latitude:12.9716,longitude:77.5946,source:'pin',accuracy:0,formattedAddress:'Bengaluru',confirmed:true}};
test('checkout validates contact, delivery and consent',()=>{
  assert.equal(validateCustomer(customer),'');
  for(const change of [{email:'bad'},{phone:'123'},{postalCode:'000000'},{firstName:' '},{address:''},{country:'UK'},{consent:false},{location:null},{location:{...customer.location,confirmed:false}}])assert.ok(validateCustomer({...customer,...change}));
});
test('product content and URLs cannot inject HTML or javascript',()=>{
  assert.equal(safeImage('javascript:alert(1)','fallback'),'fallback');
  assert.equal(safeImage('data:text/html,hello','fallback'),'fallback');
  assert.equal(safeImage('https://example.com/art.jpg'),'https://example.com/art.jpg');
  assert.equal(escapeHTML('<img src=x onerror="bad">'),'&lt;img src=x onerror=&quot;bad&quot;&gt;');
});
test('promotions compute bundle tiers, promo codes and 1 rupee payable floor',async()=>{
  const {normalizePromos,calculateDiscounts,nextBundleHint}=await import('../frontend/promotions.js');
  const promos=normalizePromos({
    codes:[
      {code:' haha10 ',type:'percent',value:10,maxDiscount:40,minSubtotal:200,active:true,label:'10% off up to ₹40'},
      {code:'FREESHIP',type:'free_shipping',value:0,minSubtotal:0,active:true},
      {code:'FLAT9999',type:'fixed',value:9999,minSubtotal:0,active:true}
    ],
    bundles:[
      {id:'b5',minQty:5,discountType:'percent',value:20,active:true},
      {id:'b2',minQty:2,discountType:'fixed',value:50,active:true,label:'Duo pack ₹50 off'}
    ]
  });
  assert.deepEqual(promos.bundles.map(b=>b.minQty),[2,5]);
  const res1=calculateDiscounts({subtotalPaise:50000,totalQty:2,shippingPaise:4000,promoCode:'haha10',promos});
  assert.equal(res1.bundleDiscountPaise,5000);
  assert.equal(res1.appliedCode,'HAHA10');
  assert.equal(res1.codeDiscountPaise,4000);
  assert.equal(res1.totalPaise,50000-5000-4000+4000);
  const resShip=calculateDiscounts({subtotalPaise:25000,totalQty:1,shippingPaise:4000,promoCode:'FREESHIP',promos});
  assert.equal(resShip.freeShipping,true);
  assert.equal(resShip.shippingPaise,0);
  assert.equal(resShip.totalPaise,25000);
  const resMin=calculateDiscounts({subtotalPaise:10000,totalQty:1,shippingPaise:4000,promoCode:'HAHA10',promos});
  assert.equal(resMin.appliedCode,'');
  assert.match(resMin.promoError,/Add ₹100 more/);
  const resShipFreeItems=calculateDiscounts({subtotalPaise:5000,totalQty:1,shippingPaise:4000,promoCode:'FLAT9999',promos});
  assert.equal(resShipFreeItems.codeDiscountPaise,5000);
  assert.equal(resShipFreeItems.totalPaise,4000);
  const resFloor=calculateDiscounts({subtotalPaise:5000,totalQty:1,shippingPaise:0,promoCode:'FLAT9999',promos});
  assert.equal(resFloor.totalPaise,100);
  const hint=nextBundleHint(1,promos);
  assert.equal(hint?.minQty,2);
  assert.equal(hint?.remaining,1);
});

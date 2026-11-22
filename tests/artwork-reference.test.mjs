import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProduct,cardImage} from '../frontend/commerce.js';
import {FALLBACK_BANNER_ARTWORKS,normalizeSettings} from '../frontend/store-settings.js';
import {orderCardMarkup} from '../frontend/admin-ui.js';

test('the seven starter artworks have distinct six-digit references',()=>{
  const refs=FALLBACK_BANNER_ARTWORKS.map(p=>normalizeProduct(p).refNumber);
  assert.equal(refs.length,7);
  assert.equal(new Set(refs).size,7);
  assert(refs.every(ref=>/^[1-9][0-9]{5}$/.test(ref)));
});

test('admin order item shows its saved reference or current product reference',()=>{
  const order={id:'order_12345678',customer:{firstName:'A'},items:[{productId:'a',quantity:1,title:'Cat <art>',unitPrice:250,refNumber:'610001'},{productId:'b',quantity:1,title:'Snail',unitPrice:250}],estimatedSubtotal:500};
  const html=orderCardMarkup(order,{refByProductId:{b:'610002'}});
  assert.match(html,/Cat &lt;art&gt;.*Ref 610001/);
  assert.match(html,/Snail.*Ref 610002/);
});

test('Freeimage stays opt-in without R2 and card URLs stay intact',()=>{
  assert.equal(normalizeSettings({}).productImageStorage,'firebase');
  assert.equal(normalizeSettings({productImageStorage:'r2'}).productImageStorage,'firebase');
  assert.equal(normalizeSettings({productImageStorage:'freeimage'}).productImageStorage,'freeimage');
  const url='https://iili.io/example.jpg';
  assert.equal(cardImage(url),url);
  assert.equal(cardImage('assets/artwork-1.jpg'),'assets/artwork-1.jpg');
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validCoordinates,validLocation,locationLink,featureAddress,featureLabel,encodeDigiPin,decodeDigiPin,formatDigiPin,parseLocationQuery,customerDigiPin} from '../frontend/location-utils.js';
import {labelMarkup} from '../frontend/labels.js';
import {encodeTSPL,encodeTSPL2In,encodeZPL,encodeESCPOS} from '../frontend/thermal-printer.js';
test('only finite confirmed coordinates can be stored or printed as a pin',()=>{
  const location={latitude:12.9716,longitude:77.5946,confirmed:true,source:'pin',accuracy:0,formattedAddress:'Bengaluru'};
  assert.ok(validLocation(location));assert.ok(validCoordinates(0,0));
  for(const bad of [{latitude:NaN},{longitude:181},{latitude:91},{confirmed:false},{source:'unknown'},{accuracy:-1}])assert.equal(validLocation({...location,...bad}),false);
  const url=locationLink({location});assert.equal(new URL(url).searchParams.get('query'),'12.971600,77.594600');assert.ok(!url.includes('Bengaluru'));
});
test('label without a confirmed pin searches the typed address',()=>{
  const url=new URL(locationLink({address:'12 A & B Street',city:'Bengaluru',postalCode:'560001',country:'India'}));
  assert.equal(url.hostname,'www.google.com');assert.equal(url.searchParams.get('query'),'12 A & B Street, Bengaluru, 560001, India');
});
test('mapped address only offers available fields and preserves manual PIN when absent',()=>{
  const feature={properties:{name:'Park',street:'Example Road',housenumber:'12',city:'Bengaluru',state:'Karnataka',countrycode:'IN',country:'India'}};
  assert.deepEqual(featureAddress(feature),{address:'12 Example Road',city:'Bengaluru',state:'Karnataka',postalCode:'',country:'India'});
  assert.equal(featureLabel(feature),'12 Example Road, Park, Bengaluru, Karnataka, India');
});
test('official India Post DIGIPIN encodes, decodes, formats, and parses Google Maps URLs & coordinates',()=>{
  assert.equal(encodeDigiPin(28.622788,77.213033),'39J-49L-L8T4');
  const pos=decodeDigiPin('39j49ll8t4');
  assert(Math.abs(pos.latitude-28.622788)<0.0001);
  assert(Math.abs(pos.longitude-77.213033)<0.0001);
  assert.equal(formatDigiPin('39j 49l l8t4'),'39J-49L-L8T4');
  assert.equal(formatDigiPin('39O-49I-01T4'),'');

  const dPin=parseLocationQuery('39J-49L-L8T4');
  assert.equal(dPin.type,'digipin');assert.equal(dPin.digipin,'39J-49L-L8T4');

  const gmAt=parseLocationQuery('https://www.google.com/maps/place/Dak+Bhawan/@28.622788,77.213033,17z');
  assert.equal(gmAt.type,'coords');assert.equal(gmAt.digipin,'39J-49L-L8T4');

  const gmQ=parseLocationQuery('https://maps.google.com/?q=28.622788,77.213033');
  assert.equal(gmQ.type,'coords');assert.equal(gmQ.digipin,'39J-49L-L8T4');

  const gmBang=parseLocationQuery('https://www.google.com/maps/place/Test/data=!3d28.622788!4d77.213033');
  assert.equal(gmBang.type,'coords');assert.equal(gmBang.digipin,'39J-49L-L8T4');

  const rawCoords=parseLocationQuery('28.622788, 77.213033');
  assert.equal(rawCoords.type,'coords');assert.equal(rawCoords.digipin,'39J-49L-L8T4');
});
test('shipping labels (HTML and thermal TSPL/ZPL/ESCPOS) include India Post DIGIPIN',()=>{
  const req={
    id:'digipin-order-1',
    paymentStatus:'captured',
    customer:{
      firstName:'Asha',lastName:'Rao',email:'a@b.in',phone:'9876543210',
      address:'Flat 4B, Dak Bhawan Enclave',apartment:'Near Parliament Street',
      city:'New Delhi',state:'Delhi',postalCode:'110001',country:'India',
      location:{latitude:28.622788,longitude:77.213033,confirmed:true,source:'pin',accuracy:10,formattedAddress:'New Delhi'}
    },
    items:[{title:'Clay Frame',quantity:1,unitPrice:250}]
  };
  assert.equal(customerDigiPin(req.customer),'39J-49L-L8T4');
  const html=labelMarkup(req,{},'<svg></svg>');
  assert.match(html,/DIGIPIN:<\/b>\s*39J-49L-L8T4/);
  const dec=new TextDecoder();
  assert.match(dec.decode(encodeTSPL(req)),/DIGIPIN: 39J-49L-L8T4/);
  assert.match(dec.decode(encodeTSPL2In(req)),/39J-49L-L8T4/);
  assert.match(dec.decode(encodeZPL(req)),/DIGIPIN: 39J-49L-L8T4/);
  assert.match(dec.decode(encodeESCPOS(req)),/DIGIPIN: 39J-49L-L8T4/);
});

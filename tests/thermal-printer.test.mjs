import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeTSPL,encodeTSPL2In,encodeZPL,encodeESCPOS,getUnprintedOrders} from '../frontend/thermal-printer.js';
import {thermalPrinterDockMarkup} from '../frontend/admin-ui.js';
import {normalizeSettings,mobileGridBreakpointCss} from '../frontend/store-settings.js';

const sampleOrder={
  id:'order-9f8e7d6c-1234',
  paymentStatus:'captured',
  status:'processing',
  createdAt:1730000002000,
  items:[{title:'Moss Meadow Cat',quantity:1},{title:'Cobalt Snail "Ltd"',quantity:1}],
  customer:{
    firstName:'Asha',
    lastName:'Rao',
    address:'42 Indiranagar 100ft Rd',
    apartment:'Apt "3B" ^ ~ \\',
    city:'Bengaluru',
    state:'Karnataka',
    postalCode:'560038',
    phone:'+91 9876543210',
    location:{latitude:12.9784,longitude:77.6408,confirmed:true}
  }
};

test('encodeTSPL outputs clean 100x150 commands with order metadata, QR pin link, and sanitized quotes',()=>{
  const out=new TextDecoder().decode(encodeTSPL(sampleOrder));
  assert.match(out,/SIZE 100 mm,150 mm/);
  assert.match(out,/#ORDER-9F/);
  assert.match(out,/\[PREPAID\]/);
  assert.match(out,/Asha Rao/);
  assert.match(out,/560038/);
  assert.match(out,/QRCODE 40,758,M,6,A,0,"https:\/\/www\.google\.com\/maps/);
  assert.ok(!out.includes('""3B""'),'quotes inside address should be escaped');
  assert.match(out,/PRINT 1,1/);
});

test('encodeZPL outputs valid ZPL II 4x6 block with UNPAID fallback and QR code',()=>{
  const unpaid={...sampleOrder,id:'unpaid1234',paymentStatus:'not_started'};
  const out=new TextDecoder().decode(encodeZPL(unpaid));
  assert.ok(out.startsWith('^XA'));
  assert.ok(out.trimEnd().endsWith('^XZ'));
  assert.match(out,/#UNPAID12/);
  assert.match(out,/\[UNPAID\]/);
  assert.match(out,/\^BQN,2,6\^FDQA,https:\/\/www\.google\.com\/maps/);
  assert.ok(!out.includes('Apt 3B ^ '),'ZPL delimiters should be stripped from user fields');
});

test('encodeESCPOS writes ESC/POS init, QR store bytes, partial cut, and customer fields',()=>{
  const bytes=encodeESCPOS(sampleOrder);
  assert.equal(bytes[0],0x1B);
  assert.equal(bytes[1],0x40);
  const text=new TextDecoder('latin1').decode(bytes);
  assert.match(text,/#ORDER-9F/);
  assert.match(text,/PREPAID/);
  assert.match(text,/560038/);
  assert.ok(bytes[bytes.length-4]===0x1D&&bytes[bytes.length-3]===0x56,'ends with GS V cut command');
});

test('getUnprintedOrders filters printed/cancelled/closed/in-flight orders and sorts oldest first',()=>{
  const orders=[
    {id:'newer-paid',paymentStatus:'captured',status:'processing',createdAt:{seconds:200}},
    {id:'printed',paymentStatus:'captured',status:'packed',createdAt:{seconds:50},labelPrintedAt:12345},
    {id:'cancelled',paymentStatus:'failed',status:'cancelled',createdAt:{seconds:60}},
    {id:'closed',paymentStatus:'captured',status:'closed',createdAt:{seconds:70}},
    {id:'in-flight',paymentStatus:'captured',status:'processing',createdAt:{seconds:80}},
    {id:'unpaid',paymentStatus:'not_started',status:'details_received',createdAt:{seconds:90}},
    {id:'older-paid',paymentStatus:'captured',status:'processing',createdAt:{seconds:100}}
  ];
  assert.deepEqual(
    getUnprintedOrders(orders,{paidOnly:true,excludeIds:new Set(['in-flight'])}).map(o=>o.id),
    ['older-paid','newer-paid']
  );
  assert.deepEqual(
    getUnprintedOrders(orders,{paidOnly:false,excludeIds:new Set(['in-flight'])}).map(o=>o.id),
    ['unpaid','older-paid','newer-paid']
  );
});

test('normalizeSettings hides About page by default, shows story section by default, and preserves explicit toggles',()=>{
  assert.equal(normalizeSettings().aboutVisible,false);
  assert.equal(normalizeSettings({aboutVisible:true}).aboutVisible,true);
  assert.equal(normalizeSettings().storyVisible,true);
  assert.equal(normalizeSettings({storyVisible:false}).storyVisible,false);
  assert.equal(normalizeSettings().mobileBreakpoint,580);
  assert.equal(normalizeSettings({mobileBreakpoint:640}).mobileBreakpoint,640);
  assert.equal(normalizeSettings({mobileBreakpoint:100}).mobileBreakpoint,580);
  const bpCss=mobileGridBreakpointCss(640);
  assert.match(bpCss,/@media \(max-width: 640px\)/);
  assert.match(bpCss,/@media \(min-width: 641px\) and \(max-width: 900px\)/);
});

test('encodeTSPL2In outputs 50x75mm 2-inch commands within 384 dots width and escapes quotes',()=>{
  const out=new TextDecoder().decode(encodeTSPL2In(sampleOrder));
  assert.match(out,/SIZE 50 mm,75 mm/);
  assert.match(out,/GAP 2 mm,0 mm/);
  assert.match(out,/#ORDER-9F/);
  assert.match(out,/\[PREPAID\]/);
  assert.match(out,/Asha Rao/);
  assert.match(out,/560038/);
  assert.match(out,/QRCODE 16,370,M,4,A,0,"https:\/\/www\.google\.com\/maps/);
  assert.ok(!out.includes('""3B""'),'quotes inside address should be escaped');
  assert.match(out,/PRINT 1,1/);
  const barWidths=[...out.matchAll(/^BAR\s+\d+,\d+,(\d+),/gm)].map(m=>Number(m[1]));
  assert.ok(barWidths.length>=4,'should render section dividers');
  assert.ok(barWidths.every(w=>w<=384),'all horizontal bars fit inside 2-inch printable width');
});

test('thermalPrinterDockMarkup renders 2-inch SEZNIK Josh status and browser-2in protocol selection',()=>{
  const html=thermalPrinterDockMarkup({protocol:'browser-2in',connected:false},{unprintedCount:2,unprintedPaidCount:2});
  assert.match(html,/Browser 2&quot; label driver \(50×75 mm · SEZNIK Josh\)/);
  assert.match(html,/<option value="browser-2in" selected>/);
});

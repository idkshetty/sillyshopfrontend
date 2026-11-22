import test from 'node:test';
import assert from 'node:assert/strict';
import {invoiceData} from '../backend/invoices.js';
import {invoicePDF, salesCSV, csvCell} from '../frontend/downloads.js';
import {summarizeSales} from '../frontend/sales-dashboard.js';
const order = {customer:{firstName:'<script>alert(1)</script>',address:'Private address,',apartment:'',city:'Baikady',state:'Karnataka',postalCode:'576213',country:'India',phone:'+91 98765 43210',email:'buyer@example.com'}};
const sale = {verified:true,mode:'test',currency:'INR',amount:12500,refundedAmount:2500,
  paymentId:'pay_123',requestId:'req_123',paidAt:{seconds:1790897400},
  items:[{title:'Art "rose",\nblue',quantity:2,unitPrice:50}]};
test('invoice uses verified amounts and item snapshot, with bounded refunds and shipping',()=>{
  const invoice=invoiceData('req_123',order,sale);
  assert.match(invoice.number,/^INV-\d{4}-REQ123$/);
  assert.equal(invoiceData('req_123',order,{...sale,invoiceNumber:'INV-2026-000001'}).number,'INV-2026-000001');
  assert.match(invoiceData('req_123',order,{...sale,invoiceNumber:'SS-0a2e11b8-9f6d-4a5e-845f-4d015b519fff'}).number,/^INV-\d{4}-REQ123$/);
  assert.match(invoiceData('req_123',order,{...sale,invoiceNumber:'INV-2026-REQ123'}).number,/^INV-\d{4}-REQ123$/);
  assert.equal(invoice.shipping,2500);assert.equal(invoice.subtotal,10000);
  assert.equal(invoiceData('req_123',order,{...sale,refundedAmount:999999}).refundedAmount,12500);
  for(const change of [{verified:false},{currency:'USD'},{amount:1},{mode:'unknown'},{paidAt:'bad'},{items:[]}])
    assert.throws(()=>invoiceData('req_123',order,{...sale,...change}));
  assert.equal(invoice.customer.name,'<script>alert(1)</script>');
  assert.equal(invoice.customer.address,'Private address, Baikady, Karnataka, 576213, India');
  assert.equal(invoice.customer.phone,'+91 98765 43210');assert.equal(invoice.customer.email,'buyer@example.com');
  assert(!invoice.number.includes('Vishnu Shetty'));
});
test('verified offline manual payment orders can recover a missing legacy sale record',()=>{
  const offlineOrder={...order,paymentStatus:'captured',paymentMethod:'manual',paidAmount:120600,
    quote:{amount:120600,currency:'INR'},items:[{title:'Artwork',quantity:3,unitPrice:102}],
    manualPayment:{method:'upi',reference:'UTR-2026-12345',recordedAt:{seconds:1790897400},recordedBy:'admin'}};
  const invoice=invoiceData('req_offline',offlineOrder,null);
  assert.equal(invoice.mode,'manual');assert.equal(invoice.amount,120600);
  assert.equal(invoice.paymentMethod,'upi');assert.equal(invoice.paymentId,'UTR-2026-12345');
  assert.equal(invoice.items[0].unitAmount,10200);
  assert.throws(()=>invoiceData('req_offline',{...offlineOrder,paymentStatus:'not_started'},null));
  assert.throws(()=>invoiceData('req_offline',{...offlineOrder,razorpayOrderId:'order_gateway'},null));
});
test('CSV handles quotes, Unicode, newlines and spreadsheet formula prefixes',()=>{
  for(const input of ['=1+1',' +SUM(A1:A9)','\t@cmd','\rtext','-42','@formula'])
    assert(csvCell(input).startsWith('"\''));
  assert.equal(csvCell('rose, "blue"'),'"rose, ""blue"""');
  const csv=salesCSV([sale]);assert(csv.startsWith('\uFEFF'));
  assert(csv.includes('"125.00","25.00","100.00"'));
  assert(csv.includes('Art ""rose"",\nblue'));
});
test('exports contain exactly the dashboard-selected verified payments',()=>{
  const rows=[sale,{...sale,mode:'live',paymentId:'pay_live'},{...sale,verified:false,paymentId:'pay_fake'}];
  const summary=summarizeSales(rows,{mode:'test',from:'2026-10-02',to:'2026-10-02'});
  assert.equal(summary.count,1);
  assert(!salesCSV(summary.rows).includes('pay_live'));
  assert(!salesCSV(summary.rows).includes('pay_fake'));
  assert.equal(salesCSV([]).split('\r\n').length,2);
});
test('invoice PDF embeds the rendered page image instead of an empty image stream',async()=>{
  const oldImage=globalThis.Image,oldDocument=globalThis.document;
  class FakeImage {
    constructor(){this.width=640;this.height=240;}
    set src(_value){queueMicrotask(()=>this.onload?.());}
  }
  class FakeCanvas {
    constructor(){this.width=0;this.height=0;this.context=new Proxy({measureText:value=>({width:String(value).length*10})},{get:(target,key)=>key in target?target[key]:()=>{},set:()=>true});}
    getContext(){return this.context;}
    toBlob(callback){callback(new Blob([Uint8Array.of(0xff,0xd8,0xff,0xd9)],{type:'image/jpeg'}));}
  }
  globalThis.Image=FakeImage;globalThis.document={createElement:()=>new FakeCanvas()};
  try{
    const pdf=await invoicePDF({number:'SS-20261021-ABC12345',paidAt:'2026-10-21T10:00:00.000Z',customer:{name:'Sample',address:'Udupi'},items:[{title:'Artwork',quantity:1,unitAmount:25000}],subtotal:25000,shipping:0,amount:25000,refundedAmount:0,paymentId:'pay_demo',paymentMethod:'Razorpay',mode:'test'});
    const bytes=new Uint8Array(await pdf.arrayBuffer()), text=new TextDecoder('latin1').decode(bytes);
    assert.equal(pdf.type,'application/pdf');assert.match(text,/\/Length 4 >>\nstream\n/);
    assert(bytes.some((value,index)=>value===0xff&&bytes[index+1]===0xd8&&bytes[index+2]===0xff));
    const xref=Number(text.match(/startxref\n(\d+)/)?.[1]);assert.equal(text.slice(xref,xref+4),'xref');
  }finally{
    if(oldImage===undefined)delete globalThis.Image;else globalThis.Image=oldImage;
    if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;
  }
});

import {labelForRequest} from './label-data.js';
import {locationLink} from './location-utils.js';

const PREFS_KEY='hehe-thermal-printer-prefs';
const VALID_PROTOCOLS=new Set(['tspl','tspl-2in','zpl','escpos','browser','browser-2in']);

function readPrefs(){
  const defaults={protocol:'tspl',baudRate:9600,autoPrint:false,autoPrintPaidOnly:true};
  try{
    const raw=JSON.parse(localStorage.getItem(PREFS_KEY)||'{}');
    return {
      protocol:VALID_PROTOCOLS.has(raw.protocol)?raw.protocol:defaults.protocol,
      baudRate:raw.baudRate===115200?115200:defaults.baudRate,
      autoPrint:Boolean(raw.autoPrint),
      autoPrintPaidOnly:raw.autoPrintPaidOnly===undefined?defaults.autoPrintPaidOnly:Boolean(raw.autoPrintPaidOnly)
    };
  }catch{
    return defaults;
  }
}

function savePrefs(prefs){
  try{localStorage.setItem(PREFS_KEY,JSON.stringify(prefs));}catch{}
}

function timestampMs(value){
  if(!value)return 0;
  if(typeof value==='number')return value;
  if(typeof value.seconds==='number')return value.seconds*1000;
  const parsed=Date.parse(String(value));
  return Number.isNaN(parsed)?0:parsed;
}

export function cleanThermalText(value=''){
  return String(value??'')
    .replace(/\u20B9/g,'Rs.')
    .replace(/[\u2013\u2014]/g,'-')
    .replace(/[\u2018\u2019]/g,"'")
    .replace(/[\u201C\u201D]/g,'"')
    .replace(/\u00B7/g,'*')
    .replace(/[\x00-\x1F\x7F]/g,' ')
    .replace(/[^\x20-\x7E]/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

export function wrapThermalLines(text='',maxCols=34,maxLines=3){
  const clean=cleanThermalText(text);
  if(!clean)return [];
  const words=clean.split(' ');
  const lines=[];
  let current='';
  for(const word of words){
    if(lines.length>=maxLines)break;
    const candidate=current?`${current} ${word}`:word;
    if(candidate.length<=maxCols){
      current=candidate;
      continue;
    }
    if(current){
      lines.push(current);
      if(lines.length>=maxLines){current='';break;}
      current=word.length>maxCols?word.slice(0,maxCols):word;
    }else{
      lines.push(word.slice(0,maxCols));
      current='';
    }
  }
  if(current&&lines.length<maxLines)lines.push(current);
  return lines;
}

function buildThermalFields(request={},template={}){
  const t=labelForRequest(request,template);
  const c=request.customer||{};
  const ref=cleanThermalText(String(request.id||'ORDER').slice(0,8).toUpperCase())||'ORDER';
  const paid=request.paymentStatus==='captured';
  const statusBadge=paid?'PREPAID':'UNPAID';
  const mapUrl=locationLink(c);
  const streetParts=[t.address,t.apartment].map(cleanThermalText).filter(Boolean).join(', ');
  const cityLine=[t.city,t.state].map(cleanThermalText).filter(Boolean).join(', ');
  const items=(request.items||[]).filter(Boolean);
  const itemCount=items.reduce((n,i)=>n+(Number(i.quantity)||1),0);
  const itemsSummary=items.map(i=>cleanThermalText(i.title||'Artwork')).filter(Boolean).join(', ');
  return {
    ref,
    paid,
    statusBadge,
    mapUrl,
    brand:cleanThermalText(t.message||'hehe.cafe'),
    heading:cleanThermalText(t.heading||'DELIVERY ADDRESS'),
    deliverTo:cleanThermalText(t.deliverTo||'DELIVER TO'),
    recipient:cleanThermalText(t.recipient||'Customer'),
    streetLines:wrapThermalLines(streetParts,36,3),
    cityLine:cleanThermalText(cityLine).slice(0,38),
    postalLabel:cleanThermalText(t.postalLabel||'PIN CODE'),
    postalCode:cleanThermalText(t.postalCode||''),
    phoneLabel:cleanThermalText(t.phoneLabel||'CONTACT'),
    phone:cleanThermalText(t.phone||''),
    qrHeading:cleanThermalText(t.qrHeading||'SCAN FOR LOCATION'),
    postageNote:cleanThermalText(t.postageNote||'Shipped via India Post'),
    itemCount,
    itemLines:wrapThermalLines(itemsSummary?`Artworks (${itemCount}): ${itemsSummary}`:'',40,2)
  };
}

function utf8Bytes(text){
  return new TextEncoder().encode(text);
}

function escTspl(str=''){
  return cleanThermalText(str).replace(/["\\]/g,"'");
}

function escZpl(str=''){
  return cleanThermalText(str).replace(/[\^~\\]/g,' ');
}

/** Encode a 100x150 mm parcel label in TSPL (Xprinter, TSC, TVS, Rollo). */
export function encodeTSPL(request={},template={}){
  const f=buildThermalFields(request,template);
  const cmds=[
    'SIZE 100 mm,150 mm',
    'GAP 2 mm,0 mm',
    'DIRECTION 1',
    'REFERENCE 0,0',
    'CLS',
    `TEXT 40,34,"3",0,2,2,"${escTspl(f.brand)}"`,
    'TEXT 42,88,"2",0,1,1,"HANDMADE ART STUDIO"',
    `TEXT 510,36,"3",0,1,1,"#${escTspl(f.ref)}"`,
    `TEXT 510,74,"3",0,1,1,"[${escTspl(f.statusBadge)}]"`,
    'BAR 40,126,720,4',
    `TEXT 40,146,"2",0,1,1,"${escTspl(f.deliverTo)}"`,
    `TEXT 40,182,"3",0,1,2,"${escTspl(f.recipient.slice(0,28))}"`
  ];
  let y=246;
  for(const line of f.streetLines){
    cmds.push(`TEXT 40,${y},"3",0,1,1,"${escTspl(line)}"`);
    y+=36;
  }
  if(f.cityLine){
    cmds.push(`TEXT 40,${y},"3",0,1,1,"${escTspl(f.cityLine)}"`);
    y+=44;
  }
  y=Math.max(y+10,410);
  cmds.push('BAR 40,'+(y-14)+',720,2');
  cmds.push(`TEXT 40,${y},"2",0,1,1,"${escTspl(f.postalLabel)}"`);
  cmds.push(`TEXT 40,${y+30},"4",0,1,1,"${escTspl(f.postalCode)}"`);
  cmds.push(`TEXT 340,${y},"2",0,1,1,"${escTspl(f.phoneLabel)}"`);
  cmds.push(`TEXT 340,${y+30},"3",0,1,1,"${escTspl(f.phone)}"`);
  let iy=y+98;
  for(const iline of f.itemLines){
    cmds.push(`TEXT 40,${iy},"2",0,1,1,"${escTspl(iline)}"`);
    iy+=28;
  }
  cmds.push('BAR 40,730,720,2');
  cmds.push(`QRCODE 40,758,M,6,A,0,"${escTspl(f.mapUrl)}"`);
  cmds.push(`TEXT 250,790,"3",0,1,1,"${escTspl(f.qrHeading)}"`);
  cmds.push('TEXT 250,834,"2",0,1,1,"Open delivery pin in Google Maps"');
  cmds.push('BAR 40,1040,720,3');
  cmds.push(`TEXT 40,1064,"2",0,1,1,"${escTspl(f.postageNote.slice(0,44))}"`);
  cmds.push(`TEXT 40,1104,"2",0,1,1,"Order #${escTspl(f.ref)} * ${escTspl(f.statusBadge)}"`);
  cmds.push('PRINT 1,1');
  return utf8Bytes(cmds.join('\r\n')+'\r\n');
}

/** Encode a 50x75 mm (2-inch, 203 dpi) parcel label in TSPL (SEZNIK / 2-inch USB). */
export function encodeTSPL2In(request={},template={}){
  const f=buildThermalFields(request,template);
  const streetLines2In=wrapThermalLines(f.streetLines.join(', '),26,3);
  const cmds=[
    'SIZE 50 mm,75 mm',
    'GAP 2 mm,0 mm',
    'DIRECTION 1',
    'REFERENCE 0,0',
    'CLS',
    `TEXT 16,14,"2",0,1,2,"${escTspl(f.brand.slice(0,14))}"`,
    `TEXT 216,14,"2",0,1,1,"#${escTspl(f.ref)}"`,
    `TEXT 216,42,"1",0,1,1,"[${escTspl(f.statusBadge)}]"`,
    'BAR 16,70,360,3',
    `TEXT 16,82,"1",0,1,1,"${escTspl(f.deliverTo)}"`,
    `TEXT 16,104,"2",0,1,2,"${escTspl(f.recipient.slice(0,22))}"`
  ];
  let y=154;
  for(const line of streetLines2In){
    cmds.push(`TEXT 16,${y},"2",0,1,1,"${escTspl(line)}"`);
    y+=24;
  }
  if(f.cityLine){
    cmds.push(`TEXT 16,${y},"2",0,1,1,"${escTspl(f.cityLine.slice(0,28))}"`);
    y+=26;
  }
  y=Math.max(y+8,258);
  cmds.push(`BAR 16,${y-8},360,2`);
  cmds.push(`TEXT 16,${y},"1",0,1,1,"${escTspl(f.postalLabel)}"`);
  cmds.push(`TEXT 16,${y+18},"3",0,1,1,"${escTspl(f.postalCode.slice(0,10))}"`);
  cmds.push(`TEXT 184,${y},"1",0,1,1,"${escTspl(f.phoneLabel)}"`);
  cmds.push(`TEXT 184,${y+20},"2",0,1,1,"${escTspl(f.phone.slice(0,15))}"`);
  cmds.push('BAR 16,356,360,2');
  cmds.push(`QRCODE 16,370,M,4,A,0,"${escTspl(f.mapUrl)}"`);
  cmds.push(`TEXT 184,394,"2",0,1,1,"${escTspl(f.qrHeading.slice(0,16))}"`);
  cmds.push('TEXT 184,424,"1",0,1,1,"Scan for Maps pin"');
  cmds.push(`TEXT 184,446,"1",0,1,1,"Items: ${f.itemCount}"`);
  cmds.push('BAR 16,536,360,2');
  cmds.push(`TEXT 16,548,"1",0,1,1,"${escTspl(f.postageNote.slice(0,34))}"`);
  cmds.push('PRINT 1,1');
  return utf8Bytes(cmds.join('\r\n')+'\r\n');
}

/** Encode a 4x6 inch (203 dpi) parcel label in ZPL II (Zebra / compatible). */
export function encodeZPL(request={},template={}){
  const f=buildThermalFields(request,template);
  const parts=[
    '^XA',
    '^PW812',
    '^LL1218',
    '^CI28',
    `^FO40,36^A0N,44,44^FD${escZpl(f.brand)}^FS`,
    '^FO40,86^A0N,22,22^FDHANDMADE ART STUDIO^FS',
    `^FO530,36^A0N,32,32^FD#${escZpl(f.ref)}^FS`,
    `^FO530,76^A0N,28,28^FD[${escZpl(f.statusBadge)}]^FS`,
    '^FO40,126^GB732,3,3^FS',
    `^FO40,148^A0N,22,22^FD${escZpl(f.deliverTo)}^FS`,
    `^FO40,182^A0N,42,42^FD${escZpl(f.recipient.slice(0,28))}^FS`
  ];
  let y=244;
  for(const line of f.streetLines){
    parts.push(`^FO40,${y}^A0N,30,30^FD${escZpl(line)}^FS`);
    y+=38;
  }
  if(f.cityLine){
    parts.push(`^FO40,${y}^A0N,30,30^FD${escZpl(f.cityLine)}^FS`);
    y+=44;
  }
  y=Math.max(y+10,410);
  parts.push(`^FO40,${y-12}^GB732,2,2^FS`);
  parts.push(`^FO40,${y}^A0N,20,20^FD${escZpl(f.postalLabel)}^FS`);
  parts.push(`^FO40,${y+28}^A0N,48,48^FD${escZpl(f.postalCode)}^FS`);
  parts.push(`^FO340,${y}^A0N,20,20^FD${escZpl(f.phoneLabel)}^FS`);
  parts.push(`^FO340,${y+28}^A0N,34,34^FD${escZpl(f.phone)}^FS`);
  let iy=y+98;
  for(const iline of f.itemLines){
    parts.push(`^FO40,${iy}^A0N,24,24^FD${escZpl(iline)}^FS`);
    iy+=30;
  }
  parts.push('^FO40,730^GB732,2,2^FS');
  parts.push(`^FO40,758^BQN,2,6^FDQA,${cleanAsciiUrl(f.mapUrl)}^FS`);
  parts.push(`^FO240,790^A0N,28,28^FD${escZpl(f.qrHeading)}^FS`);
  parts.push('^FO240,832^A0N,22,22^FDOpen delivery pin in Google Maps^FS');
  parts.push('^FO40,1040^GB732,3,3^FS');
  parts.push(`^FO40,1066^A0N,24,24^FD${escZpl(f.postageNote.slice(0,48))}^FS`);
  parts.push(`^FO40,1104^A0N,22,22^FDOrder #${escZpl(f.ref)} * ${escZpl(f.statusBadge)}^FS`);
  parts.push('^XZ');
  return utf8Bytes(parts.join('\r\n')+'\r\n');
}

function cleanAsciiUrl(url=''){
  return String(url||'').replace(/[\x00-\x1F\x7F\^~]/g,'');
}

/** Encode an 80mm / 58mm thermal slip with QR code in ESC/POS bytes. */
export function encodeESCPOS(request={},template={}){
  const f=buildThermalFields(request,template);
  const chunks=[];
  const pushBytes=(...bytes)=>chunks.push(Uint8Array.from(bytes));
  const pushText=text=>chunks.push(utf8Bytes(text));

  pushBytes(0x1B,0x40); // ESC @ init
  pushBytes(0x1B,0x61,0x01); // Center
  pushBytes(0x1B,0x45,0x01,0x1D,0x21,0x11); // Bold + double size
  pushText(`${f.brand}\n`);
  pushBytes(0x1D,0x21,0x00,0x1B,0x45,0x00); // Normal
  pushText(`HANDMADE ART STUDIO\n`);
  pushBytes(0x1B,0x45,0x01);
  pushText(`#${f.ref}  [${f.statusBadge}]\n`);
  pushBytes(0x1B,0x45,0x00);
  pushText('--------------------------------\n');

  pushBytes(0x1B,0x61,0x00); // Left
  pushText(`${f.deliverTo}\n`);
  pushBytes(0x1B,0x45,0x01,0x1D,0x21,0x01); // Bold + double height
  pushText(`${f.recipient}\n`);
  pushBytes(0x1D,0x21,0x00,0x1B,0x45,0x00);
  for(const line of wrapThermalLines(f.streetLines.join(', '),32,4))pushText(`${line}\n`);
  if(f.cityLine)pushText(`${f.cityLine.slice(0,32)}\n`);
  pushBytes(0x1B,0x45,0x01);
  pushText(`${f.postalLabel}: ${f.postalCode}\n`);
  pushText(`${f.phoneLabel}: ${f.phone}\n`);
  pushBytes(0x1B,0x45,0x00);
  for(const iline of f.itemLines)pushText(`${iline.slice(0,32)}\n`);
  pushText('--------------------------------\n');

  // Native ESC/POS QR code (GS ( k)
  const qrBytes=utf8Bytes(f.mapUrl);
  const storeLen=qrBytes.length+3;
  const pL=storeLen&0xFF,pH=(storeLen>>8)&0xFF;
  pushBytes(0x1B,0x61,0x01);
  pushBytes(0x1D,0x28,0x6B,0x04,0x00,0x31,0x41,0x32,0x00); // Model 2
  pushBytes(0x1D,0x28,0x6B,0x03,0x00,0x31,0x43,0x05); // Size 5
  pushBytes(0x1D,0x28,0x6B,0x03,0x00,0x31,0x45,0x31); // Error correction M
  pushBytes(0x1D,0x28,0x6B,pL,pH,0x31,0x50,0x30);
  chunks.push(qrBytes);
  pushBytes(0x1D,0x28,0x6B,0x03,0x00,0x31,0x51,0x30); // Print QR
  pushText(`\n${f.qrHeading}\n`);
  pushText(`${f.postageNote.slice(0,32)}\n`);
  pushText('\n\n\n');
  pushBytes(0x1D,0x56,0x42,0x00); // Partial cut

  const total=chunks.reduce((sum,c)=>sum+c.length,0);
  const out=new Uint8Array(total);
  let offset=0;
  for(const chunk of chunks){out.set(chunk,offset);offset+=chunk.length;}
  return out;
}

/** Return active unprinted orders sorted FIFO oldest-first. */
export function getUnprintedOrders(orders=[],{paidOnly=false,excludeIds=new Set()}={}){
  return (Array.isArray(orders)?orders:[])
    .filter(o=>{
      if(!o||!o.id||o.labelPrintedAt)return false;
      if(['cancelled','closed'].includes(o.status))return false;
      if(excludeIds?.has?.(o.id))return false;
      if(paidOnly&&o.paymentStatus!=='captured')return false;
      return true;
    })
    .sort((a,b)=>timestampMs(a.createdAt)-timestampMs(b.createdAt));
}

export function createThermalPrinterController({onStateChange}={}){
  const prefs=readPrefs();
  let transport=null; // 'usb' | 'serial' | null
  let usbDevice=null,usbInterface=0,usbEndpoint=0;
  let serialPort=null;
  let deviceName='';
  let busy=false;
  let lastError='';
  let lastPrintedId='';
  let lastPrintedAt=0;
  const inFlightIds=new Set();
  let queuePromise=Promise.resolve();

  const emit=()=>onStateChange?.(getState());

  function isHardwareConnected(){
    if(transport==='usb')return Boolean(usbDevice?.opened);
    if(transport==='serial')return Boolean(serialPort?.writable);
    return false;
  }

  function getState(){
    return {
      ...prefs,
      transport:isHardwareConnected()?transport:null,
      connected:isHardwareConnected(),
      deviceName:isHardwareConnected()?deviceName:'',
      busy,
      queuedCount:inFlightIds.size,
      lastError,
      lastPrintedId,
      lastPrintedAt,
      webUsbSupported:typeof navigator!=='undefined'&&'usb' in navigator,
      webSerialSupported:typeof navigator!=='undefined'&&'serial' in navigator
    };
  }

  function setOptions(patch={}){
    if(patch.protocol&&VALID_PROTOCOLS.has(patch.protocol))prefs.protocol=patch.protocol;
    if(patch.baudRate!==undefined)prefs.baudRate=Number(patch.baudRate)===115200?115200:9600;
    if(patch.autoPrint!==undefined)prefs.autoPrint=Boolean(patch.autoPrint);
    if(patch.autoPrintPaidOnly!==undefined)prefs.autoPrintPaidOnly=Boolean(patch.autoPrintPaidOnly);
    savePrefs(prefs);
    emit();
  }

  async function disconnect(){
    try{await usbDevice?.close?.();}catch{}
    try{await serialPort?.close?.();}catch{}
    transport=null;usbDevice=null;serialPort=null;deviceName='';lastError='';
    emit();
  }

  async function connectUSB(){
    if(typeof navigator==='undefined'||!('usb' in navigator))throw new Error('WebUSB is not supported in this browser. Use Chrome/Edge or the Browser thermal driver.');
    let device=null;
    try{
      device=await navigator.usb.requestDevice({filters:[]});
    }catch(error){
      if(error?.name==='NotFoundError')return null;
      throw error;
    }
    await disconnect();
    await device.open();
    if(device.configuration===null&&device.configurations?.length){
      await device.selectConfiguration(device.configurations[0].configurationValue);
    }
    let chosenIface=null,chosenEp=null;
    for(const iface of (device.configuration?.interfaces||[])){
      for(const alt of (iface.alternates||[])){
        const ep=(alt.endpoints||[]).find(e=>e.direction==='out'&&e.type==='bulk')||(alt.endpoints||[]).find(e=>e.direction==='out');
        if(ep){chosenIface=iface.interfaceNumber;chosenEp=ep.endpointNumber;break;}
      }
      if(chosenEp!==null)break;
    }
    if(chosenEp===null){
      try{await device.close();}catch{}
      throw new Error('This USB device has no bulk printer endpoint. Try Serial/COM connection or Browser thermal driver.');
    }
    await device.claimInterface(chosenIface);
    usbDevice=device;usbInterface=chosenIface;usbEndpoint=chosenEp;transport='usb';
    deviceName=[device.manufacturerName,device.productName].filter(Boolean).join(' ').trim()||'USB Thermal Printer';
    lastError='';
    if(prefs.protocol==='browser-2in'){prefs.protocol='tspl-2in';savePrefs(prefs);}
    else if(prefs.protocol==='browser'){prefs.protocol='tspl';savePrefs(prefs);}
    emit();
    return getState();
  }

  async function connectSerial(){
    if(typeof navigator==='undefined'||!('serial' in navigator))throw new Error('Web Serial is not supported in this browser. Use Chrome/Edge or the Browser thermal driver.');
    let port=null;
    try{
      port=await navigator.serial.requestPort();
    }catch(error){
      if(error?.name==='NotFoundError')return null;
      throw error;
    }
    await disconnect();
    await port.open({baudRate:prefs.baudRate});
    serialPort=port;transport='serial';
    const info=port.getInfo?.()||{};
    deviceName=info.usbVendorId?`Serial Printer (${info.usbVendorId.toString(16)})`:`Serial / COM Printer (${prefs.baudRate})`;
    lastError='';
    if(prefs.protocol==='browser-2in'){prefs.protocol='tspl-2in';savePrefs(prefs);}
    else if(prefs.protocol==='browser'){prefs.protocol='tspl';savePrefs(prefs);}
    emit();
    return getState();
  }

  async function writeBytes(bytes){
    if(!isHardwareConnected())throw new Error('No thermal printer connected.');
    const chunkSize=1024;
    if(transport==='usb'){
      for(let i=0;i<bytes.length;i+=chunkSize){
        await usbDevice.transferOut(usbEndpoint,bytes.slice(i,i+chunkSize));
      }
      return;
    }
    const writer=serialPort.writable.getWriter();
    try{
      for(let i=0;i<bytes.length;i+=chunkSize){
        await writer.write(bytes.slice(i,i+chunkSize));
      }
    }finally{
      writer.releaseLock();
    }
  }

  function encodeForProtocol(request,template){
    if(prefs.protocol==='tspl-2in')return encodeTSPL2In(request,template);
    if(prefs.protocol==='zpl')return encodeZPL(request,template);
    if(prefs.protocol==='escpos')return encodeESCPOS(request,template);
    return encodeTSPL(request,template);
  }

  function enqueue(id,task){
    inFlightIds.add(id);
    emit();
    const run=queuePromise.then(async()=>{
      busy=true;emit();
      try{
        await task();
      }finally{
        inFlightIds.delete(id);
        busy=false;
        emit();
      }
    });
    queuePromise=run.catch(()=>{});
    return run;
  }

  async function printLabel(request,template={}){
    if(!request?.id)throw new Error('Missing order data.');
    if(prefs.protocol==='browser'||prefs.protocol==='browser-2in'||!isHardwareConnected())throw new Error('Connect a USB or Serial thermal printer first.');
    return enqueue(request.id,async()=>{
      const bytes=encodeForProtocol(request,template);
      await writeBytes(bytes);
      lastError='';
      lastPrintedId=request.id;
      lastPrintedAt=Date.now();
      await new Promise(resolve=>setTimeout(resolve,250));
    });
  }

  async function printBatch(requests=[],template={}, {onEachPrinted}={}){
    const printedIds=[];
    for(const req of requests){
      if(!req?.id||inFlightIds.has(req.id))continue;
      try{
        await printLabel(req,template);
        printedIds.push(req.id);
        await onEachPrinted?.(req);
      }catch(error){
        lastError=error?.message||'Print failed.';
        emit();
        throw error;
      }
    }
    return printedIds;
  }

  async function printTestLabel(template={}){
    const sample={
      id:'TEST0001',
      paymentStatus:'captured',
      items:[{title:'Test Artwork Label',quantity:1}],
      customer:{
        firstName:'hehe.cafe',
        lastName:'Printer Test',
        address:'12 Studio Lane',
        apartment:'Ground Floor',
        city:'Bengaluru',
        state:'Karnataka',
        postalCode:'560001',
        phone:'9000000000',
        location:{latitude:12.9716,longitude:77.5946,confirmed:true}
      }
    };
    return printLabel(sample,template);
  }

  if(typeof navigator!=='undefined'&&'usb' in navigator&&typeof navigator.usb?.addEventListener==='function'){
    navigator.usb.addEventListener('disconnect',event=>{if(event?.device===usbDevice)void disconnect();});
  }
  if(typeof navigator!=='undefined'&&'serial' in navigator&&typeof navigator.serial?.addEventListener==='function'){
    navigator.serial.addEventListener('disconnect',event=>{if(event?.target===serialPort)void disconnect();});
  }

  return {
    getState,
    setOptions,
    connectUSB,
    connectSerial,
    disconnect,
    isHardwareConnected,
    printLabel,
    printBatch,
    printTestLabel,
    hasInFlight:id=>inFlightIds.has(id)
  };
}

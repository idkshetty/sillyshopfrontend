import {escapeHTML as e} from './commerce.js';
import {skeletonMarkup} from './skeletons.js';
import {customerDigiPin,validLocation,locationLink} from './location-utils.js';
import {loadScript} from './browser-library.js';
import {TEMPLATE_FIELDS,DEFAULT_LABEL_TEMPLATE,normalizeTemplate,labelForRequest} from './label-data.js';

const PRINT_MODE_KEY='hehe-label-print-mode';
const VALID_PRINT_MODES=new Set(['thermal','thermal-2in','a4-4up']);
function getSavedPrintMode(fallback='thermal'){
  try{const m=localStorage.getItem(PRINT_MODE_KEY);return VALID_PRINT_MODES.has(m)?m:fallback;}catch{return fallback;}
}
function savePrintMode(mode){
  try{localStorage.setItem(PRINT_MODE_KEY,mode);}catch{}
}
function upgradeTemplateCopy(t={}){
  const merged={...DEFAULT_LABEL_TEMPLATE,...t};
  return {
    ...merged,
    qrHeading:merged.qrHeading==='SCAN FOR EXACT PIN'?'SCAN FOR LOCATION':merged.qrHeading,
    message:['HEHE.CAFE','SILLY SENSEI'].includes(merged.message)?'hehe.cafe':merged.message
  };
}

export function labelMarkup(request,t,qr,{variant='standard'}={}) {
  const copy=upgradeTemplateCopy(t);
  const c=request.customer,hasPin=validLocation(c.location),digi=customerDigiPin(c);
  const paid=request.paymentStatus==='captured';
  const coordsAttr=hasPin?` data-coords="${c.location.latitude.toFixed(6)}, ${c.location.longitude.toFixed(6)}"`:'';
  return `<article class="address-label${variant==='2in'?' is-2in':''}">
    <div class="label-top">
      <header class="label-header">
        <div class="label-brand">
          <span class="label-brand-mark">hehe.cafe</span>
          <span class="label-brand-sub">HANDMADE ART STUDIO</span>
        </div>
        <div class="label-order-meta">
          <b>${e(copy.heading)}</b>
          <span class="label-order-id">#${e(request.id.slice(0,8).toUpperCase())}</span>
        </div>
      </header>
      <div class="label-address">
        <span class="label-caption">${e(copy.deliverTo)}</span>
        <h2>${e(copy.recipient)}</h2>
        <p class="label-street">${e(copy.address)}${copy.apartment?`<br>${e(copy.apartment)}`:''}</p>
        <p class="label-city">${e(copy.city)}, ${e(copy.state)}</p>
        <div class="label-postal-row">
          <div class="label-postal"><span>${e(copy.postalLabel)}</span><strong>${e(copy.postalCode)}</strong></div>
          <div class="label-phone"><b>${e(copy.phoneLabel)}</b><span>${e(copy.phone)}</span></div>
        </div>
      </div>
    </div>
    <div class="label-bottom">
      <div class="label-location">
        <div class="label-qr" role="img" aria-label="QR code for delivery location"${coordsAttr}>${qr}</div>
        <div class="label-location-copy">
          <b>${e(copy.qrHeading)}</b>
          ${digi?`<p class="label-digipin"><b>DIGIPIN:</b> ${e(digi)}</p>`:''}
          ${hasPin&&c.location.formattedAddress?`<p class="label-nearby"><b>Nearby:</b> ${e(c.location.formattedAddress)}</p>`:(!hasPin?'<p class="label-nearby">Google Maps address search</p>':'')}
        </div>
      </div>
      <footer class="label-footer">
        <div class="label-footer-brand">
          <strong class="label-footer-logo">${e(copy.message)}</strong>
          <span>${e(copy.postageNote)}</span>
        </div>
        <span class="label-payment-badge ${paid?'is-paid':'is-unpaid'}">${paid?'PREPAID':'UNPAID'}</span>
      </footer>
    </div>
  </article>`;
}
async function buildQRObject(customer){
  await loadScript('assets/vendor/qrcode.js');
  const qr=window.qrcode(0,'M');
  qr.addData(locationLink(customer),'Byte');
  qr.make();
  return qr;
}
async function makeQR(customer){
  const qr=await buildQRObject(customer);
  return qr.createSvgTag({cellSize:3,margin:12,scalable:true});
}
function wrapCanvasLines(ctx,text,maxWidth,maxLines=3){
  const words=String(text||'').trim().split(/\s+/).filter(Boolean);
  if(!words.length)return [];
  const lines=[];
  let cur='';
  for(const word of words){
    const candidate=cur?`${cur} ${word}`:word;
    if(ctx.measureText(candidate).width<=maxWidth){cur=candidate;continue;}
    if(cur){
      lines.push(cur);
      if(lines.length>=maxLines){cur='';break;}
      cur=word;
    }else{
      let clipped=word;
      while(clipped.length>1&&ctx.measureText(clipped+'…').width>maxWidth)clipped=clipped.slice(0,-1);
      lines.push(clipped+(clipped.length<word.length?'…':''));
      cur='';
      if(lines.length>=maxLines)break;
    }
  }
  if(cur&&lines.length<maxLines){
    let last=cur;
    if(ctx.measureText(last).width>maxWidth){
      while(last.length>1&&ctx.measureText(last+'…').width>maxWidth)last=last.slice(0,-1);
      last+='…';
    }
    lines.push(last);
  }
  return lines;
}
async function download2InchLabelPng(request,template){
  const copy=upgradeTemplateCopy(labelForRequest(request,template));
  const c=request.customer||{};
  const hasPin=validLocation(c.location);
  const paid=request.paymentStatus==='captured';
  const ref=String(request.id||'ORDER').slice(0,8).toUpperCase();
  const itemCount=(request.items||[]).reduce((n,i)=>n+(Number(i.quantity)||1),0);
  const qr=await buildQRObject(c);

  const canvas=document.createElement('canvas');
  const digi=customerDigiPin(c);
  canvas.width=400;
  canvas.height=600;
  const ctx=canvas.getContext('2d');
  if(!ctx)throw new Error('Could not initialize canvas for PNG export.');

  ctx.fillStyle='#ffffff';
  ctx.fillRect(0,0,400,600);
  ctx.strokeStyle='#000000';
  ctx.lineWidth=2;
  ctx.strokeRect(4,4,392,592);

  // Header
  ctx.fillStyle='#000000';
  ctx.textBaseline='alphabetic';
  ctx.font='700 24px Georgia, serif';
  ctx.fillText('hehe.cafe',16,38);

  const refText=`#${ref}`;
  ctx.font='700 16px "JetBrains Mono", monospace';
  const badgeW=Math.min(168,Math.ceil(ctx.measureText(refText).width)+18);
  ctx.fillStyle='#000000';
  ctx.fillRect(384-badgeW,15,badgeW,28);
  ctx.fillStyle='#ffffff';
  ctx.textAlign='center';
  ctx.fillText(refText,384-badgeW/2,35);
  ctx.textAlign='left';

  ctx.fillStyle='#000000';
  ctx.fillRect(16,54,368,3);

  // Address block
  let y=74;
  ctx.font='700 11px "JetBrains Mono", monospace';
  ctx.fillText(String(copy.deliverTo||'DELIVER TO').toUpperCase(),16,y);
  y+=26;

  ctx.font='700 22px Georgia, serif';
  for(const line of wrapCanvasLines(ctx,copy.recipient,368,2)){
    ctx.fillText(line,16,y);
    y+=24;
  }
  y+=2;

  ctx.font='500 16px Arial, sans-serif';
  const streetFull=[copy.address,copy.apartment].filter(Boolean).join(', ');
  for(const line of wrapCanvasLines(ctx,streetFull,368,3)){
    ctx.fillText(line,16,y);
    y+=20;
  }

  ctx.font='700 16px Arial, sans-serif';
  for(const line of wrapCanvasLines(ctx,`${copy.city}, ${copy.state}`,368,1)){
    ctx.fillText(line,16,y);
    y+=22;
  }

  // PIN & Phone boxes
  const boxTop=Math.max(y+8,248);
  ctx.fillRect(16,boxTop-10,368,2);

  ctx.lineWidth=2;
  ctx.strokeRect(16,boxTop,174,58);
  ctx.font='700 10px "JetBrains Mono", monospace';
  ctx.fillText(String(copy.postalLabel||'PIN CODE').toUpperCase(),24,boxTop+15);
  ctx.font='700 26px "JetBrains Mono", monospace';
  ctx.fillText(String(copy.postalCode||'').slice(0,8),24,boxTop+46);

  ctx.lineWidth=1.5;
  ctx.strokeRect(198,boxTop,186,58);
  ctx.font='700 10px "JetBrains Mono", monospace';
  ctx.fillText(String(copy.phoneLabel||'CONTACT').toUpperCase(),206,boxTop+15);
  ctx.font='700 16px "JetBrains Mono", monospace';
  ctx.fillText(String(copy.phone||'').slice(0,15),206,boxTop+43);

  // QR section
  const qrTop=Math.max(boxTop+72,344);
  ctx.fillRect(16,qrTop-10,368,2);

  const qrSize=156;
  ctx.fillStyle='#ffffff';
  ctx.fillRect(16,qrTop,qrSize,qrSize);
  ctx.lineWidth=2;
  ctx.strokeStyle='#000000';
  ctx.strokeRect(16,qrTop,qrSize,qrSize);

  const modCount=qr.getModuleCount();
  const cell=Math.max(2,Math.floor((qrSize-16)/modCount));
  const qrDrawSize=cell*modCount;
  const qrX=16+Math.floor((qrSize-qrDrawSize)/2);
  const qrY=qrTop+Math.floor((qrSize-qrDrawSize)/2);
  ctx.fillStyle='#000000';
  for(let r=0;r<modCount;r++){
    for(let col=0;col<modCount;col++){
      if(qr.isDark(r,col))ctx.fillRect(qrX+col*cell,qrY+r*cell,cell,cell);
    }
  }

  let ry=qrTop+24;
  ctx.font='700 14px Arial, sans-serif';
  for(const line of wrapCanvasLines(ctx,copy.qrHeading,196,2)){
    ctx.fillText(line,186,ry);
    ry+=18;
  }
  ctx.font='500 12px Arial, sans-serif';
  ctx.fillText('Open delivery pin',186,ry+4);
  ctx.fillText('in Google Maps',186,ry+19);
  if(digi){
    ctx.font='700 12px "JetBrains Mono", monospace';
    ctx.fillText(`DIGIPIN: ${digi}`,186,ry+38);
    ry+=18;
  }
  if(itemCount){
    ctx.font='700 12px Arial, sans-serif';
    ctx.fillText(`Items: ${itemCount}`,186,ry+42);
  }
  if(hasPin&&c.location?.formattedAddress){
    ctx.font='400 11px Arial, sans-serif';
    let ny=ry+62;
    for(const line of wrapCanvasLines(ctx,c.location.formattedAddress,196,2)){
      if(ny<qrTop+qrSize)ctx.fillText(line,186,ny);
      ny+=14;
    }
  }

  // Footer
  ctx.save();
  ctx.setLineDash([5,4]);
  ctx.lineWidth=1.5;
  ctx.beginPath();
  ctx.moveTo(16,526);
  ctx.lineTo(384,526);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle='#000000';
  ctx.font='700 16px Georgia, serif';
  ctx.fillText(wrapCanvasLines(ctx,copy.message||'hehe.cafe',250,1)[0]||'hehe.cafe',16,552);
  ctx.font='500 11px Arial, sans-serif';
  ctx.fillText(wrapCanvasLines(ctx,copy.postageNote||'',255,1)[0]||'',16,572);

  const statusText=paid?'PREPAID':'UNPAID';
  ctx.font='700 12px "JetBrains Mono", monospace';
  const statusW=Math.ceil(ctx.measureText(statusText).width)+18;
  ctx.lineWidth=1.5;
  ctx.strokeRect(384-statusW,540,statusW,26);
  ctx.textAlign='center';
  ctx.fillText(statusText,384-statusW/2,557);
  ctx.textAlign='left';

  const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG export failed.')),'image/png'));
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');
  link.href=url;
  link.download=`hehe-label-${ref}-2in.png`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function getPrintRoot(){
  let printRoot=document.getElementById('print-root');
  if(!printRoot){printRoot=document.createElement('div');printRoot.id='print-root';document.body.append(printRoot);}
  return printRoot;
}
function chunkLabels(list,size=4){
  const out=[];
  for(let i=0;i<list.length;i+=size)out.push(list.slice(i,i+size));
  return out.length?out:[[]];
}
function buildPrintPagesHtml(labelHtmlList,mode='thermal',{preview=false}={}){
  if(mode==='a4-4up'){
    return chunkLabels(labelHtmlList,4).map(group=>{
      const cells=Array.from({length:4},(_,idx)=>group[idx]?`<div class="print-a4-cell">${group[idx]}</div>`:'<div class="print-a4-cell is-empty"><div class="print-a4-empty" aria-hidden="true"><span>Empty slot</span></div></div>').join('');
      return `<div class="${preview?'a4-preview-sheet ':' '}print-a4-sheet">${cells}</div>`;
    }).join('');
  }
  if(mode==='thermal-2in'){
    return labelHtmlList.map(html=>`<div class="print-thermal-2in-page">${html}</div>`).join('');
  }
  return labelHtmlList.map(html=>`<div class="print-thermal-page">${html}</div>`).join('');
}
function applyPrintPageStyle(mode='thermal'){
  let style=document.getElementById('label-print-page-style');
  if(!style){
    style=document.createElement('style');
    style.id='label-print-page-style';
    document.head.append(style);
  }else if(style.parentElement!==document.head){
    document.head.append(style);
  }
  style.textContent=mode==='a4-4up'
    ?'@media print{@page{size:A4 portrait;margin:0}}'
    :mode==='thermal-2in'
      ?'@media print{@page{size:50mm 75mm;margin:0}}'
      :'@media print{@page{size:100mm 150mm;margin:0}}';
}
function triggerLabelPrint(labelHtmlList,mode='thermal'){
  const list=Array.isArray(labelHtmlList)?labelHtmlList:[labelHtmlList];
  applyPrintPageStyle(mode);
  const printRoot=getPrintRoot();
  printRoot.className=`print-mode-${mode}`;
  printRoot.innerHTML=buildPrintPagesHtml(list,mode);
  document.body.classList.add('printing-label');
  window.addEventListener('afterprint',()=>{
    document.body.classList.remove('printing-label');
    if(!document.getElementById('label-dialog')?.open)printRoot.replaceChildren();
  },{once:true});
  window.print();
}
function formatSwitchMarkup(mode){
  return `<div class="label-mode-toggle" role="group" aria-label="Print layout format">
    <button type="button" class="label-mode-btn ${mode==='thermal-2in'?'is-active':''}" data-label-mode="thermal-2in" aria-pressed="${mode==='thermal-2in'}">2" label (50 × 75 mm)</button>
    <button type="button" class="label-mode-btn ${mode==='thermal'?'is-active':''}" data-label-mode="thermal" aria-pressed="${mode==='thermal'}">4×6" thermal (100 × 150 mm)</button>
    <button type="button" class="label-mode-btn ${mode==='a4-4up'?'is-active':''}" data-label-mode="a4-4up" aria-pressed="${mode==='a4-4up'}">A4 sheet (4-in-1)</button>
  </div>`;
}
export async function openLabel(request,{load,onPrinted,thermalPrinter}) {
  const [template,qr]=await Promise.all([load(),makeQR(request.customer)]);
  let dialog=document.getElementById('label-dialog');
  if(!dialog){dialog=document.createElement('dialog');dialog.id='label-dialog';dialog.className='label-dialog';document.body.append(dialog);}
  const labelCopy=labelForRequest(request,template);
  const htmlStandard=labelMarkup(request,labelCopy,qr);
  const html2In=labelMarkup(request,labelCopy,qr,{variant:'2in'});
  let mode=getSavedPrintMode('thermal');
  let copies=4;
  const hwReady=Boolean(thermalPrinter?.isHardwareConnected?.());
  const hwLabel=hwReady?'Send to thermal printer ↗':'';
  dialog.innerHTML=`<div class="drawer-header"><div class="label-dialog-title"><p class="eyebrow">Dispatch</p><div class="label-dialog-heading-row"><h2 id="label-title">Delivery label</h2><span class="label-size-badge" id="label-mode-badge"></span></div></div><button type="button" class="icon-button" id="label-close" aria-label="Close label"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button></div>
    <div class="label-mode-bar">
      ${formatSwitchMarkup(mode)}
      <label class="label-copies-bar" id="label-copies-wrap"><span>Copies on sheet</span><select id="label-copies-select"><option value="1">1 label</option><option value="2">2 copies</option><option value="4" selected>4 copies (full sheet)</option></select></label>
    </div>
    <div class="label-print-preview"><div class="label-sheet" id="label-dialog-sheet"></div></div>
    <p class="small muted label-print-tip" id="label-print-tip"></p>
    <div class="label-controls"><a href="#admin/labels" class="text-link" id="label-template-link">Edit the global label template →</a><a class="text-link" href="${e(locationLink(request.customer))}" target="_blank" rel="noopener">Open Google Maps ↗</a><button type="button" class="button outline small" id="label-download-png" hidden>Save 2" PNG (We Print)</button>${hwReady?`<button type="button" class="button outline small" id="label-hw-print">${hwLabel}</button>`:''}<button class="button" id="label-print"></button></div>`;
  dialog.setAttribute('aria-labelledby','label-title');
  const sheet=$('#label-dialog-sheet',dialog)||dialog.querySelector('#label-dialog-sheet');
  const badge=dialog.querySelector('#label-mode-badge');
  const tip=dialog.querySelector('#label-print-tip');
  const printBtn=dialog.querySelector('#label-print');
  const hwBtn=dialog.querySelector('#label-hw-print');
  const pngBtn=dialog.querySelector('#label-download-png');
  const copiesWrap=dialog.querySelector('#label-copies-wrap');
  const copiesSelect=dialog.querySelector('#label-copies-select');
  function paintDialog(){
    dialog.querySelectorAll('[data-label-mode]').forEach(btn=>{
      const active=btn.dataset.labelMode===mode;
      btn.classList.toggle('is-active',active);
      btn.setAttribute('aria-pressed',String(active));
    });
    copiesWrap.hidden=mode!=='a4-4up';
    if(pngBtn)pngBtn.hidden=mode!=='thermal-2in';
    badge.textContent=mode==='a4-4up'?'A4 · 4-in-1 sheet':mode==='thermal-2in'?'50 × 75 mm · 2" Thermal':'100 × 150 mm · 4×6" Thermal';
    tip.textContent=mode==='a4-4up'
      ?'Choose A4 paper size at 100% scale with margins set to None and browser headers/footers off. Cut along the dashed guides.'
      :mode==='thermal-2in'
        ?'Set paper size to 50 × 75 mm (2 × 3 in) at 100% scale with margins set to None (fits SEZNIK Josh / 2-inch rolls). Or click Save 2" PNG to print from the We Print mobile app over Bluetooth.'
        :'Set your thermal printer paper size to 100 × 150 mm (4 × 6 in) at 100% scale with margins set to None.';
    printBtn.textContent=mode==='a4-4up'?'Print A4 4-in-1 sheet ↗':mode==='thermal-2in'?'Print 2" label ↗':'Print 4×6" label ↗';
    sheet.classList.toggle('is-a4-preview',mode==='a4-4up');
    sheet.classList.toggle('is-2in-preview',mode==='thermal-2in');
    sheet.innerHTML=mode==='a4-4up'?buildPrintPagesHtml(Array(copies).fill(htmlStandard),'a4-4up',{preview:true}):(mode==='thermal-2in'?html2In:htmlStandard);
  }
  dialog.querySelectorAll('[data-label-mode]').forEach(btn=>btn.onclick=()=>{mode=btn.dataset.labelMode;savePrintMode(mode);paintDialog();});
  copiesSelect.onchange=()=>{copies=Number(copiesSelect.value)||4;paintDialog();};
  dialog.querySelector('#label-close').onclick=()=>dialog.close();
  dialog.querySelector('#label-template-link').onclick=()=>dialog.close();
  const printRoot=getPrintRoot();
  dialog.onclose=()=>{dialog.replaceChildren();printRoot.replaceChildren();document.body.classList.remove('printing-label');};
  if(pngBtn){
    pngBtn.onclick=async()=>{
      pngBtn.disabled=true;pngBtn.textContent='Generating PNG…';
      try{
        await download2InchLabelPng(request,template);
        Promise.resolve(onPrinted?.([request.id])).catch(()=>{});
        pngBtn.textContent='Saved 2" PNG ✓';
      }catch(error){
        tip.textContent=error?.message||'Could not generate 2" PNG.';
      }finally{
        setTimeout(()=>{if(pngBtn.isConnected){pngBtn.disabled=false;pngBtn.textContent='Save 2" PNG (We Print)';}},1500);
      }
    };
  }
  if(hwBtn){
    hwBtn.onclick=async()=>{
      hwBtn.disabled=true;hwBtn.textContent='Printing…';
      try{
        await thermalPrinter.printLabel(request,template);
        Promise.resolve(onPrinted?.([request.id])).catch(()=>{});
        hwBtn.textContent='Sent to printer ✓';
      }catch(error){
        tip.textContent=error?.message||'Hardware thermal print failed.';
        hwBtn.disabled=false;hwBtn.textContent=hwLabel;
      }
    };
  }
  printBtn.onclick=()=>{
    triggerLabelPrint(mode==='a4-4up'?Array(copies).fill(htmlStandard):[mode==='thermal-2in'?html2In:htmlStandard],mode);
    Promise.resolve(onPrinted?.([request.id])).catch(()=>{});
  };
  paintDialog();
  dialog.showModal();
}
export async function openBatchLabels(requests,{load,defaultMode='a4-4up',onPrinted,thermalPrinter}) {
  if(!Array.isArray(requests)||!requests.length)return;
  const [template,qrs]=await Promise.all([load(),Promise.all(requests.map(r=>makeQR(r.customer)))]);
  const standardHtmlList=requests.map((req,i)=>labelMarkup(req,labelForRequest(req,template),qrs[i]));
  const twoInHtmlList=requests.map((req,i)=>labelMarkup(req,labelForRequest(req,template),qrs[i],{variant:'2in'}));
  let dialog=document.getElementById('label-dialog');
  if(!dialog){dialog=document.createElement('dialog');dialog.id='label-dialog';dialog.className='label-dialog label-batch-dialog';document.body.append(dialog);}
  let mode=VALID_PRINT_MODES.has(defaultMode)?defaultMode:getSavedPrintMode('a4-4up');
  const hwReady=Boolean(thermalPrinter?.isHardwareConnected?.());
  dialog.innerHTML=`<div class="drawer-header"><div class="label-dialog-title"><p class="eyebrow">Batch dispatch</p><div class="label-dialog-heading-row"><h2 id="label-title">${requests.length} ${requests.length===1?'label':'labels'} ready</h2><span class="label-size-badge" id="label-mode-badge"></span></div></div><button type="button" class="icon-button" id="label-close" aria-label="Close batch labels"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button></div>
    <div class="label-mode-bar">${formatSwitchMarkup(mode)}<span class="small muted" id="batch-summary-meta"></span></div>
    <div class="label-print-preview"><div class="label-sheet is-batch" id="label-dialog-sheet"></div></div>
    <p class="small muted label-print-tip" id="label-print-tip"></p>
    <div class="label-controls"><a href="#admin/labels" class="text-link" id="label-template-link">Edit the global label template →</a>${hwReady?`<button type="button" class="button outline small" id="label-hw-print">Send all ${requests.length} to thermal printer ↗</button>`:''}<button class="button" id="label-print"></button></div>`;
  dialog.setAttribute('aria-labelledby','label-title');
  const sheet=dialog.querySelector('#label-dialog-sheet');
  const badge=dialog.querySelector('#label-mode-badge');
  const meta=dialog.querySelector('#batch-summary-meta');
  const tip=dialog.querySelector('#label-print-tip');
  const printBtn=dialog.querySelector('#label-print');
  const hwBtn=dialog.querySelector('#label-hw-print');
  function paintBatch(){
    dialog.querySelectorAll('[data-label-mode]').forEach(btn=>{
      const active=btn.dataset.labelMode===mode;
      btn.classList.toggle('is-active',active);
      btn.setAttribute('aria-pressed',String(active));
    });
    const sheets=Math.ceil(requests.length/4);
    badge.textContent=mode==='a4-4up'?`A4 · ${sheets} ${sheets===1?'sheet':'sheets'}`:mode==='thermal-2in'?`2" Thermal · ${requests.length} ${requests.length===1?'label':'labels'}`:`4×6" Thermal · ${requests.length} ${requests.length===1?'label':'labels'}`;
    meta.textContent=mode==='a4-4up'?`${requests.length} ${requests.length===1?'order':'orders'} across ${sheets} A4 ${sheets===1?'sheet':'sheets'} (4 per page)`:mode==='thermal-2in'?`${requests.length} ${requests.length===1?'order':'orders'} · 1 label per page (50 × 75 mm)`:`${requests.length} ${requests.length===1?'order':'orders'} · 1 label per page (100 × 150 mm)`;
    tip.textContent=mode==='a4-4up'
      ?'Print on A4 portrait at 100% scale with margins set to None and browser headers/footers off. Up to 4 labels per sheet.'
      :mode==='thermal-2in'
        ?'Print on a 50 × 75 mm (2 × 3 in) thermal label roll at 100% scale with margins set to None (fits SEZNIK Josh / 2-inch rolls).'
        :'Print on a 100 × 150 mm (4 × 6 in) thermal label roll at 100% scale with margins set to None.';
    printBtn.textContent=mode==='a4-4up'?`Print ${sheets} A4 ${sheets===1?'sheet':'sheets'} ↗`:mode==='thermal-2in'?`Print ${requests.length} 2" ${requests.length===1?'label':'labels'} ↗`:`Print ${requests.length} thermal ${requests.length===1?'label':'labels'} ↗`;
    sheet.classList.toggle('is-a4-preview',mode==='a4-4up');
    sheet.classList.toggle('is-2in-preview',mode==='thermal-2in');
    sheet.innerHTML=mode==='a4-4up'?buildPrintPagesHtml(standardHtmlList,'a4-4up',{preview:true}):`<div class="thermal-batch-stack">${(mode==='thermal-2in'?twoInHtmlList:standardHtmlList).join('')}</div>`;
  }
  dialog.querySelectorAll('[data-label-mode]').forEach(btn=>btn.onclick=()=>{mode=btn.dataset.labelMode;savePrintMode(mode);paintBatch();});
  dialog.querySelector('#label-close').onclick=()=>dialog.close();
  dialog.querySelector('#label-template-link').onclick=()=>dialog.close();
  const printRoot=getPrintRoot();
  dialog.onclose=()=>{dialog.replaceChildren();printRoot.replaceChildren();document.body.classList.remove('printing-label');};
  if(hwBtn){
    hwBtn.onclick=async()=>{
      hwBtn.disabled=true;hwBtn.textContent=`Sending ${requests.length}…`;
      try{
        await thermalPrinter.printBatch(requests,template,{onEachPrinted:req=>Promise.resolve(onPrinted?.([req.id])).catch(()=>{})});
        hwBtn.textContent=`Printed ${requests.length} ✓`;
      }catch(error){
        tip.textContent=error?.message||'Hardware batch print failed.';
        hwBtn.disabled=false;hwBtn.textContent=`Send all ${requests.length} to thermal printer ↗`;
      }
    };
  }
  printBtn.onclick=()=>{
    triggerLabelPrint(mode==='thermal-2in'?twoInHtmlList:standardHtmlList,mode);
    Promise.resolve(onPrinted?.(requests.map(r=>r.id))).catch(()=>{});
  };
  paintBatch();
  dialog.showModal();
}
function $(sel,root){return root.querySelector(sel);}
export function mountLabelTemplate(root,{load,save}) {
  let disposed=false,dirty=false;
  root.innerHTML=skeletonMarkup('editor','Loading your shared label settings…');
  const request={id:'sample-label',paymentStatus:'captured',customer:{firstName:'Sample',lastName:'Recipient',address:'12 Example Street',apartment:'Apartment 4B',city:'Bengaluru',state:'Karnataka',postalCode:'560001',phone:'9000000000',location:{latitude:12.9716,longitude:77.5946,source:'pin',confirmed:true,accuracy:0,formattedAddress:'Bengaluru, Karnataka'}},items:[{quantity:1}]};
  (async()=>{
    try{
      const [value,qr]=await Promise.all([load(),makeQR(request.customer)]);if(disposed||!root.isConnected)return;
      let template=upgradeTemplateCopy(normalizeTemplate(value));
      let previewMode=getSavedPrintMode('thermal');
      const names={heading:'Label heading',qrHeading:'QR heading',message:'Footer brand',deliverTo:'Recipient caption',postalLabel:'PIN code caption',phoneLabel:'Phone caption',postageNote:'Postage note'};
      const groups=[
        {title:'Header & footer',keys:['heading','message','postageNote']},
        {title:'Address & QR captions',keys:['deliverTo','postalLabel','phoneLabel','qrHeading']}
      ];
      const renderField=key=>`<label class="field ${key==='postageNote'||key==='qrHeading'?'wide':''}">${names[key]}<input name="${key}" maxlength="${TEMPLATE_FIELDS[key]}" value="${e(template[key])}"></label>`;
      root.innerHTML=`<div class="admin-title"><div><h1>Label template</h1><p>One shared parcel design supporting 2-inch labels, 4×6" thermal printers and 4-in-1 A4 sheets.</p></div></div>
    <div class="label-template-layout">
      <form id="label-template-form" class="label-template-form-card">
        <p class="small muted">Customer names, addresses and confirmed map pins are filled from each order automatically.</p>
        ${groups.map(group=>`<div class="label-fieldset"><h3>${group.title}</h3><div class="label-field-grid">${group.keys.map(renderField).join('')}</div></div>`).join('')}
        <div class="label-template-actions">
          <button class="button" type="submit">Save for all labels</button>
          <button class="button outline small" type="button" id="label-reset-defaults">Reset defaults</button>
        </div>
        <p class="notice" role="status"></p>
      </form>
      <section class="label-preview-panel" aria-label="Live label preview">
        <div class="label-preview-head">
          <div>
            <p class="eyebrow">Live preview</p>
            <span class="label-size-badge" id="template-size-badge"></span>
          </div>
          <button type="button" class="button outline small" id="label-preview-print">Print sample ↗</button>
        </div>
        <div class="label-preview-mode-row">
          <div class="label-mode-toggle is-compact" role="group" aria-label="Preview format">
            <button type="button" class="label-mode-btn ${previewMode==='thermal-2in'?'is-active':''}" data-template-mode="thermal-2in" aria-pressed="${previewMode==='thermal-2in'}">2" (50×75)</button>
            <button type="button" class="label-mode-btn ${previewMode==='thermal'?'is-active':''}" data-template-mode="thermal" aria-pressed="${previewMode==='thermal'}">Thermal 100×150</button>
            <button type="button" class="label-mode-btn ${previewMode==='a4-4up'?'is-active':''}" data-template-mode="a4-4up" aria-pressed="${previewMode==='a4-4up'}">A4 4-in-1</button>
          </div>
        </div>
        <div class="label-sheet"></div>
      </section>
    </div>`;
      const form=root.querySelector('form'),notice=form.querySelector('.notice');
      const previewSheet=root.querySelector('.label-sheet');
      const sizeBadge=root.querySelector('#template-size-badge');
      const sampleHtml=(variant='standard')=>labelMarkup(request,labelForRequest(request,template),qr,{variant});
      const paint=()=>{
        const single=sampleHtml(previewMode==='thermal-2in'?'2in':'standard');
        root.querySelectorAll('[data-template-mode]').forEach(btn=>{
          const active=btn.dataset.templateMode===previewMode;
          btn.classList.toggle('is-active',active);
          btn.setAttribute('aria-pressed',String(active));
        });
        sizeBadge.textContent=previewMode==='a4-4up'?'A4 · 4-in-1':previewMode==='thermal-2in'?'50 × 75 mm · 2"':'100 × 150 mm';
        previewSheet.classList.toggle('is-a4-preview',previewMode==='a4-4up');
        previewSheet.classList.toggle('is-2in-preview',previewMode==='thermal-2in');
        previewSheet.innerHTML=previewMode==='a4-4up'?buildPrintPagesHtml(Array(4).fill(sampleHtml('standard')),'a4-4up',{preview:true}):single;
      };
      form.oninput=()=>{dirty=true;template={...template,...normalizeTemplate(Object.fromEntries(new FormData(form)))};paint();notice.textContent='Unsaved changes';};
      root.querySelectorAll('[data-template-mode]').forEach(btn=>btn.onclick=()=>{previewMode=btn.dataset.templateMode;savePrintMode(previewMode);paint();});
      root.querySelector('#label-reset-defaults').onclick=()=>{
        dirty=true;
        template={...DEFAULT_LABEL_TEMPLATE};
        for(const key of Object.keys(names)){if(form.elements[key])form.elements[key].value=DEFAULT_LABEL_TEMPLATE[key];}
        paint();
        notice.textContent='Reset to defaults — click Save to apply.';
      };
      root.querySelector('#label-preview-print').onclick=()=>{
        const single=sampleHtml(previewMode==='thermal-2in'?'2in':'standard');
        triggerLabelPrint(previewMode==='a4-4up'?Array(4).fill(sampleHtml('standard')):[single],previewMode);
      };
      form.onsubmit=async event=>{event.preventDefault();const button=form.querySelector('button[type="submit"]');button.disabled=true;notice.textContent='Saving…';try{await save(normalizeTemplate(template));dirty=false;notice.textContent='Saved. Every new print uses this template.';}catch(error){notice.textContent=error.message||'Could not save. Your edits are still here.';}finally{button.disabled=false;}};paint();
    }catch{if(!disposed&&root.isConnected)root.innerHTML='<h1>Label template</h1><p class="notice" role="alert">Could not load the shared label settings. Deploy the current Firestore rules and refresh.</p>';}
  })();
  return {isDirty:()=>dirty,destroy(){disposed=true;}};
}

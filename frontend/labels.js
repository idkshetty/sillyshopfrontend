import {escapeHTML as e} from './commerce.js';
import {skeletonMarkup} from './skeletons.js';
import {validLocation,locationLink} from './location-utils.js';
import {loadScript} from './browser-library.js';
import {TEMPLATE_FIELDS,DEFAULT_LABEL_TEMPLATE,normalizeTemplate,labelForRequest} from './label-data.js';

const PRINT_MODE_KEY='hehe-label-print-mode';
function getSavedPrintMode(fallback='thermal'){
  try{const m=localStorage.getItem(PRINT_MODE_KEY);return m==='a4-4up'||m==='thermal'?m:fallback;}catch{return fallback;}
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

export function labelMarkup(request,t,qr) {
  const copy=upgradeTemplateCopy(t);
  const c=request.customer,hasPin=validLocation(c.location);
  const paid=request.paymentStatus==='captured';
  const coordsAttr=hasPin?` data-coords="${c.location.latitude.toFixed(6)}, ${c.location.longitude.toFixed(6)}"`:'';
  return `<article class="address-label">
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
async function makeQR(customer){await loadScript('assets/vendor/qrcode.js');const qr=window.qrcode(0,'M');qr.addData(locationLink(customer),'Byte');qr.make();return qr.createSvgTag({cellSize:3,margin:12,scalable:true});}
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
    <button type="button" class="label-mode-btn ${mode==='thermal'?'is-active':''}" data-label-mode="thermal" aria-pressed="${mode==='thermal'}">Label printer (100 × 150 mm)</button>
    <button type="button" class="label-mode-btn ${mode==='a4-4up'?'is-active':''}" data-label-mode="a4-4up" aria-pressed="${mode==='a4-4up'}">A4 sheet (4-in-1)</button>
  </div>`;
}
export async function openLabel(request,{load}) {
  const [template,qr]=await Promise.all([load(),makeQR(request.customer)]);
  let dialog=document.getElementById('label-dialog');
  if(!dialog){dialog=document.createElement('dialog');dialog.id='label-dialog';dialog.className='label-dialog';document.body.append(dialog);}
  const html=labelMarkup(request,labelForRequest(request,template),qr);
  let mode=getSavedPrintMode('thermal');
  let copies=4;
  dialog.innerHTML=`<div class="drawer-header"><div class="label-dialog-title"><p class="eyebrow">Dispatch</p><div class="label-dialog-heading-row"><h2 id="label-title">Delivery label</h2><span class="label-size-badge" id="label-mode-badge"></span></div></div><button type="button" class="icon-button" id="label-close" aria-label="Close label"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button></div>
    <div class="label-mode-bar">
      ${formatSwitchMarkup(mode)}
      <label class="label-copies-bar" id="label-copies-wrap"><span>Copies on sheet</span><select id="label-copies-select"><option value="1">1 label</option><option value="2">2 copies</option><option value="4" selected>4 copies (full sheet)</option></select></label>
    </div>
    <div class="label-print-preview"><div class="label-sheet" id="label-dialog-sheet"></div></div>
    <p class="small muted label-print-tip" id="label-print-tip"></p>
    <div class="label-controls"><a href="#admin/labels" class="text-link" id="label-template-link">Edit the global label template →</a><a class="text-link" href="${e(locationLink(request.customer))}" target="_blank" rel="noopener">Open Google Maps ↗</a><button class="button" id="label-print"></button></div>`;
  dialog.setAttribute('aria-labelledby','label-title');
  const sheet=$('#label-dialog-sheet',dialog)||dialog.querySelector('#label-dialog-sheet');
  const badge=dialog.querySelector('#label-mode-badge');
  const tip=dialog.querySelector('#label-print-tip');
  const printBtn=dialog.querySelector('#label-print');
  const copiesWrap=dialog.querySelector('#label-copies-wrap');
  const copiesSelect=dialog.querySelector('#label-copies-select');
  function paintDialog(){
    dialog.querySelectorAll('[data-label-mode]').forEach(btn=>{
      const active=btn.dataset.labelMode===mode;
      btn.classList.toggle('is-active',active);
      btn.setAttribute('aria-pressed',String(active));
    });
    copiesWrap.hidden=mode!=='a4-4up';
    badge.textContent=mode==='a4-4up'?'A4 · 4-in-1 sheet':'100 × 150 mm · Thermal';
    tip.textContent=mode==='a4-4up'
      ?'Choose A4 paper size at 100% scale with margins set to None and browser headers/footers off. Cut along the dashed guides.'
      :'Set your thermal printer paper size to 100 × 150 mm (4 × 6 in) at 100% scale with margins set to None.';
    printBtn.textContent=mode==='a4-4up'?'Print A4 4-in-1 sheet ↗':'Print thermal label ↗';
    sheet.classList.toggle('is-a4-preview',mode==='a4-4up');
    sheet.innerHTML=mode==='a4-4up'?buildPrintPagesHtml(Array(copies).fill(html),'a4-4up',{preview:true}):html;
  }
  dialog.querySelectorAll('[data-label-mode]').forEach(btn=>btn.onclick=()=>{mode=btn.dataset.labelMode;savePrintMode(mode);paintDialog();});
  copiesSelect.onchange=()=>{copies=Number(copiesSelect.value)||4;paintDialog();};
  dialog.querySelector('#label-close').onclick=()=>dialog.close();
  dialog.querySelector('#label-template-link').onclick=()=>dialog.close();
  const printRoot=getPrintRoot();
  dialog.onclose=()=>{dialog.replaceChildren();printRoot.replaceChildren();document.body.classList.remove('printing-label');};
  printBtn.onclick=()=>triggerLabelPrint(mode==='a4-4up'?Array(copies).fill(html):[html],mode);
  paintDialog();
  dialog.showModal();
}
export async function openBatchLabels(requests,{load,defaultMode='a4-4up'}) {
  if(!Array.isArray(requests)||!requests.length)return;
  const [template,qrs]=await Promise.all([load(),Promise.all(requests.map(r=>makeQR(r.customer)))]);
  const labelHtmlList=requests.map((req,i)=>labelMarkup(req,labelForRequest(req,template),qrs[i]));
  let dialog=document.getElementById('label-dialog');
  if(!dialog){dialog=document.createElement('dialog');dialog.id='label-dialog';dialog.className='label-dialog label-batch-dialog';document.body.append(dialog);}
  let mode=defaultMode==='thermal'||defaultMode==='a4-4up'?defaultMode:getSavedPrintMode('a4-4up');
  dialog.innerHTML=`<div class="drawer-header"><div class="label-dialog-title"><p class="eyebrow">Batch dispatch</p><div class="label-dialog-heading-row"><h2 id="label-title">${requests.length} ${requests.length===1?'label':'labels'} ready</h2><span class="label-size-badge" id="label-mode-badge"></span></div></div><button type="button" class="icon-button" id="label-close" aria-label="Close batch labels"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button></div>
    <div class="label-mode-bar">${formatSwitchMarkup(mode)}<span class="small muted" id="batch-summary-meta"></span></div>
    <div class="label-print-preview"><div class="label-sheet is-batch" id="label-dialog-sheet"></div></div>
    <p class="small muted label-print-tip" id="label-print-tip"></p>
    <div class="label-controls"><a href="#admin/labels" class="text-link" id="label-template-link">Edit the global label template →</a><button class="button" id="label-print"></button></div>`;
  dialog.setAttribute('aria-labelledby','label-title');
  const sheet=dialog.querySelector('#label-dialog-sheet');
  const badge=dialog.querySelector('#label-mode-badge');
  const meta=dialog.querySelector('#batch-summary-meta');
  const tip=dialog.querySelector('#label-print-tip');
  const printBtn=dialog.querySelector('#label-print');
  function paintBatch(){
    dialog.querySelectorAll('[data-label-mode]').forEach(btn=>{
      const active=btn.dataset.labelMode===mode;
      btn.classList.toggle('is-active',active);
      btn.setAttribute('aria-pressed',String(active));
    });
    const sheets=Math.ceil(requests.length/4);
    badge.textContent=mode==='a4-4up'?`A4 · ${sheets} ${sheets===1?'sheet':'sheets'}`:`Thermal · ${requests.length} ${requests.length===1?'label':'labels'}`;
    meta.textContent=mode==='a4-4up'?`${requests.length} ${requests.length===1?'order':'orders'} across ${sheets} A4 ${sheets===1?'sheet':'sheets'} (4 per page)`:`${requests.length} ${requests.length===1?'order':'orders'} · 1 label per page (100 × 150 mm)`;
    tip.textContent=mode==='a4-4up'
      ?'Print on A4 portrait at 100% scale with margins set to None and browser headers/footers off. Up to 4 labels per sheet.'
      :'Print on a 100 × 150 mm (4 × 6 in) thermal label roll at 100% scale with margins set to None.';
    printBtn.textContent=mode==='a4-4up'?`Print ${sheets} A4 ${sheets===1?'sheet':'sheets'} ↗`:`Print ${requests.length} thermal ${requests.length===1?'label':'labels'} ↗`;
    sheet.classList.toggle('is-a4-preview',mode==='a4-4up');
    sheet.innerHTML=mode==='a4-4up'?buildPrintPagesHtml(labelHtmlList,'a4-4up',{preview:true}):`<div class="thermal-batch-stack">${labelHtmlList.join('')}</div>`;
  }
  dialog.querySelectorAll('[data-label-mode]').forEach(btn=>btn.onclick=()=>{mode=btn.dataset.labelMode;savePrintMode(mode);paintBatch();});
  dialog.querySelector('#label-close').onclick=()=>dialog.close();
  dialog.querySelector('#label-template-link').onclick=()=>dialog.close();
  const printRoot=getPrintRoot();
  dialog.onclose=()=>{dialog.replaceChildren();printRoot.replaceChildren();document.body.classList.remove('printing-label');};
  printBtn.onclick=()=>triggerLabelPrint(labelHtmlList,mode);
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
      root.innerHTML=`<div class="admin-title"><div><h1>Label template</h1><p>One shared parcel design supporting both thermal label printers and 4-in-1 A4 sheets.</p></div></div>
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
      const sampleHtml=()=>labelMarkup(request,labelForRequest(request,template),qr);
      const paint=()=>{
        const single=sampleHtml();
        root.querySelectorAll('[data-template-mode]').forEach(btn=>{
          const active=btn.dataset.templateMode===previewMode;
          btn.classList.toggle('is-active',active);
          btn.setAttribute('aria-pressed',String(active));
        });
        sizeBadge.textContent=previewMode==='a4-4up'?'A4 · 4-in-1':'100 × 150 mm';
        previewSheet.classList.toggle('is-a4-preview',previewMode==='a4-4up');
        previewSheet.innerHTML=previewMode==='a4-4up'?buildPrintPagesHtml(Array(4).fill(single),'a4-4up',{preview:true}):single;
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
        const single=sampleHtml();
        triggerLabelPrint(previewMode==='a4-4up'?Array(4).fill(single):[single],previewMode);
      };
      form.onsubmit=async event=>{event.preventDefault();const button=form.querySelector('button[type="submit"]');button.disabled=true;notice.textContent='Saving…';try{await save(normalizeTemplate(template));dirty=false;notice.textContent='Saved. Every new print uses this template.';}catch(error){notice.textContent=error.message||'Could not save. Your edits are still here.';}finally{button.disabled=false;}};paint();
    }catch{if(!disposed&&root.isConnected)root.innerHTML='<h1>Label template</h1><p class="notice" role="alert">Could not load the shared label settings. Deploy the current Firestore rules and refresh.</p>';}
  })();
  return {isDirty:()=>dirty,destroy(){disposed=true;}};
}

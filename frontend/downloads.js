export function downloadFile(content, filename, type) {
  const blob = content instanceof Blob ? content : new Blob([content], {type});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

// Quote every cell and neutralize spreadsheet formulas, including whitespace prefixes.
export function csvCell(value) {
  let text = String(value ?? '');
  if (/^[\s\uFEFF]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function salesCSV(rows) {
  const header = ['Request ID','Payment/reference','Payment source','Method','Paid at (UTC)','Currency','Collected (INR)','Refunded (INR)','Net (INR)','Items'];
  const lines = rows.map(r => {
    const date = new Date(r.paidAt?.seconds ? r.paidAt.seconds * 1000 : r.paidAt);
    const refund = Math.min(r.amount, Math.max(0, Number.isSafeInteger(r.refundedAmount) ? r.refundedAmount : 0));
    return [r.requestId || r.id, r.paymentReference || r.paymentId, r.mode, r.paymentMethod||'Razorpay', date.toISOString(), r.currency,
      (r.amount / 100).toFixed(2), (refund / 100).toFixed(2), ((r.amount - refund) / 100).toFixed(2),
      (r.items || []).map(i => `${i.quantity} × ${i.title}`).join('; ')];
  });
  return '\uFEFF' + [header, ...lines].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
const PAGE = {width: 1240, height: 1754};
const INK = '#171717', GREEN = '#176b3a', MUTED = '#555b57', LINE = '#c7cac8';
const amountText = cents => new Intl.NumberFormat('en-IN', {style:'currency',currency:'INR',minimumFractionDigits:2}).format((cents||0)/100);

function loadInvoiceLogo() {
  return Promise.resolve(null);
}

function drawInvoicePage(invoice, logo) {
  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d');
  const left = 92, right = PAGE.width - 92;
  measureCtx.font = '23px "Plus Jakarta Sans", Arial, sans-serif';
  const addressLines = wrapCanvasTextAll(measureCtx, invoice.customer?.address || '', 680);
  let preContactY = 523 + addressLines.length * 35;
  if (invoice.customer?.phone) preContactY += 31;
  const customerInfoBottom = preContactY + (invoice.customer?.email ? 28 : 0);
  const tableTop = Math.max(690, customerInfoBottom + 45), rowHeight = 82;
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const totalRows = [['Sub total', invoice.subtotal]];
  if (Number.isSafeInteger(invoice.discount) && invoice.discount > 0) {
    totalRows.push([invoice.promoCode ? `Discount (${invoice.promoCode})` : 'Discount', -invoice.discount]);
  }
  totalRows.push(
    ['Delivery', invoice.shipping],
    ['Paid total', invoice.amount],
    ['Refunded to date', invoice.refundedAmount],
    ['Net collected', invoice.amount - invoice.refundedAmount]
  );
  const preTotalsTop = tableTop + 58 + items.length * rowHeight + 54;
  const totalsBottom = preTotalsTop + Math.max(totalRows.length * 43, 140);
  const pageHeight = Math.max(PAGE.height, totalsBottom + 230);

  const canvas = measureCanvas;
  canvas.width = PAGE.width; canvas.height = pageHeight;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0,0,PAGE.width,pageHeight);
  if (logo) {
    const scale = Math.min(260 / logo.width, 105 / logo.height);
    ctx.drawImage(logo,left,62,logo.width*scale,logo.height*scale);
  } else {
    ctx.fillStyle=INK;ctx.font='700 44px "Fraunces", Georgia, serif';ctx.fillText('hehe.cafe',left,121);
  }
  const paidAt = new Date(invoice.paidAt);
  const paidLabel = Number.isFinite(+paidAt) ? new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'}).format(paidAt)+' IST' : '';
  const invoiceDateText = Number.isFinite(+paidAt) ? formatInvoiceDate(paidAt) : '—';
  drawInvoiceCloud(ctx,(left+right)/2,148,1.12);

  ctx.textAlign='center';ctx.fillStyle=INK;ctx.font='700 138px "Plus Jakarta Sans", Arial, sans-serif';ctx.fillText('INVOICE',(left+right)/2,340);
  drawInvoiceSideArc(ctx,-14,782,124);
  drawInvoiceCloud(ctx,right+13,830,1.48);

  ctx.textAlign='left';ctx.fillStyle=INK;ctx.font='700 30px "Plus Jakarta Sans", Arial, sans-serif';ctx.fillText(`TO : ${(invoice.customer?.name||'Customer').toLocaleUpperCase('en-IN')}`,left,478);
  ctx.fillStyle=INK;ctx.font='23px "Plus Jakarta Sans", Arial, sans-serif';
  addressLines.forEach((line,i)=>ctx.fillText(line,left,523+i*35));
  ctx.fillStyle=MUTED;ctx.font='20px "Plus Jakarta Sans", Arial, sans-serif';
  let contactY=523+addressLines.length*35;
  if(invoice.customer?.phone){ctx.fillText(String(invoice.customer.phone),left,contactY);contactY+=31;}
  if(invoice.customer?.email)ctx.fillText(String(invoice.customer.email),left,contactY);

  const metaX=right;
  ctx.textAlign='right';ctx.fillStyle=INK;ctx.font='700 23px "Plus Jakarta Sans", Arial, sans-serif';ctx.fillText('Invoice Date',metaX,455);
  ctx.font='23px "Plus Jakarta Sans", Arial, sans-serif';ctx.fillText(invoiceDateText,metaX,491);
  ctx.font='700 23px "Plus Jakarta Sans", Arial, sans-serif';ctx.fillText('Invoice no.',metaX,542);
  ctx.font='17px "Plus Jakarta Sans", Arial, sans-serif';ctx.fillText(invoice.number,metaX,578);
  if(invoice.mode==='test'){ctx.fillStyle='#9c5c00';ctx.font='700 18px "Plus Jakarta Sans", Arial, sans-serif';ctx.fillText('TEST PAYMENT',metaX,611);}
  ctx.textAlign='left';

  drawInvoiceCloud(ctx,left-22,tableTop+178,1.45);
  drawInvoiceCloud(ctx,right+15,tableTop+205,1.48);
  ctx.fillStyle=INK;ctx.font='700 24px "Plus Jakarta Sans", Arial, sans-serif';
  ctx.fillText('Description',left+18,tableTop+39);
  ctx.textAlign='right';ctx.fillText('Qty',right-320,tableTop+39);ctx.fillText('Price',right-18,tableTop+39);
  ctx.strokeStyle=INK;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(left,tableTop+54);ctx.lineTo(right,tableTop+54);ctx.stroke();
  let y=tableTop+58;
  items.forEach((item)=>{
    const top=y;
    ctx.strokeStyle=LINE;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(left,top+rowHeight);ctx.lineTo(right,top+rowHeight);ctx.stroke();
    ctx.textAlign='left';ctx.fillStyle=INK;ctx.font='23px "Plus Jakarta Sans", Arial, sans-serif';
    wrapCanvasText(ctx,String(item.title||'Item'),right-left-440,2).forEach((line,lineIndex)=>ctx.fillText(line,left+18,top+39+lineIndex*29));
    ctx.textAlign='right';ctx.fillText(String(item.quantity||0),right-320,top+43);
    ctx.fillText(amountText(item.unitAmount*(item.quantity||0)),right-18,top+43);
    y+=rowHeight;
  });

  ctx.strokeStyle=INK;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();
  const totalsTop=y+54, labelX=right-360, valueX=right-18;
  const paymentX=left+18;
  ctx.textAlign='left';ctx.fillStyle=INK;ctx.font='700 23px "Plus Jakarta Sans", Arial, sans-serif';ctx.fillText('Payment',paymentX,totalsTop+8);
  ctx.font='700 23px "Plus Jakarta Sans", Arial, sans-serif';ctx.fillText(':',paymentX+155,totalsTop+8);
  ctx.font='23px "Plus Jakarta Sans", Arial, sans-serif';ctx.fillText(invoice.paymentMethod||'Payment',paymentX+183,totalsTop+8);
  if(invoice.paymentId){ctx.fillStyle=MUTED;ctx.font='20px "Plus Jakarta Sans", Arial, sans-serif';wrapCanvasText(ctx,`Reference ${invoice.paymentId}`,430,2).forEach((line,i)=>ctx.fillText(line,paymentX+183,totalsTop+42+i*27));}
  if(paidLabel){ctx.fillStyle=MUTED;ctx.font='19px "Plus Jakarta Sans", Arial, sans-serif';ctx.fillText('Paid '+paidLabel,paymentX+183,totalsTop+101);}

  ctx.textAlign='right';ctx.font='22px "Plus Jakarta Sans", Arial, sans-serif';ctx.fillStyle=MUTED;
  totalRows.forEach(([label,value],index)=>{
    const rowY=totalsTop+index*43;
    const isPaid=label==='Paid total';
    const isDiscount=value<0;
    ctx.fillStyle=isPaid?INK:isDiscount?GREEN:MUTED;ctx.font=`${isPaid?'700 ':'400 '}22px "Plus Jakarta Sans", Arial, sans-serif`;
    ctx.fillText(label,labelX,rowY);ctx.fillText(value<0?`-${amountText(-value)}`:amountText(value),valueX,rowY);
  });

  const footerY=pageHeight-176;
  drawInvoiceCloud(ctx,(left+right)/2,footerY-123,2.45);
  ctx.textAlign='left';ctx.fillStyle=INK;ctx.font='22px "Plus Jakarta Sans", Arial, sans-serif';ctx.fillText('Visit Our Gallery Online',left,footerY+2);
  ctx.font='700 28px "Fraunces", Georgia, serif';ctx.fillText('hehe.cafe',left,footerY+44);
  ctx.textAlign='right';ctx.fillStyle=INK;ctx.font='700 22px "Plus Jakarta Sans", Arial, sans-serif';ctx.fillText('Thank you for your order',right,footerY+2);
  return canvas;
}

function drawInvoiceCloud(ctx,centerX,y,scale=1) {
  ctx.save();ctx.strokeStyle='#d4d8d5';ctx.lineWidth=3;ctx.globalAlpha=0.72;
  const w=210*scale,x=centerX-w/2;
  ctx.beginPath();ctx.moveTo(x,y);ctx.bezierCurveTo(x-22*scale,y,x-20*scale,y-30*scale,x+10*scale,y-30*scale);
  ctx.bezierCurveTo(x+15*scale,y-72*scale,x+68*scale,y-78*scale,x+86*scale,y-40*scale);
  ctx.bezierCurveTo(x+115*scale,y-62*scale,x+153*scale,y-48*scale,x+153*scale,y-18*scale);
  ctx.bezierCurveTo(x+183*scale,y-28*scale,x+207*scale,y-14*scale,x+w,y);
  ctx.moveTo(x,y);ctx.lineTo(x+34*scale,y);ctx.moveTo(x+w-35*scale,y);ctx.lineTo(x+w,y);ctx.stroke();ctx.restore();
}

function drawInvoiceSideArc(ctx,x,y,radius) {
  ctx.save();ctx.strokeStyle='#d2d5d3';ctx.lineWidth=3;ctx.globalAlpha=0.76;
  ctx.beginPath();ctx.arc(x,y,radius,-1.2,1.2);ctx.stroke();ctx.restore();
}

function formatInvoiceDate(date) {
  const day=Number(new Intl.DateTimeFormat('en-IN',{day:'numeric',timeZone:'Asia/Kolkata'}).format(date));
  const suffix=day%100>=11&&day%100<=13?'th':({1:'st',2:'nd',3:'rd'}[day%10]||'th');
  const month=new Intl.DateTimeFormat('en-IN',{month:'short',timeZone:'Asia/Kolkata'}).format(date);
  const year=new Intl.DateTimeFormat('en-IN',{year:'numeric',timeZone:'Asia/Kolkata'}).format(date);
  return `${day}${suffix} ${month} ${year}`;
}

function wrapCanvasText(ctx,text,maxWidth,maxLines=3) {
  const words=String(text||'').split(/\s+/).filter(Boolean), lines=[];
  let line='';
  for(const word of words){
    const candidate=line?`${line} ${word}`:word;
    if(ctx.measureText(candidate).width>maxWidth&&line){lines.push(line);line=word;if(lines.length===maxLines-1)break;}
    else line=candidate;
  }
  if(line&&lines.length<maxLines)lines.push(line);
  if(lines.length===maxLines&&words.join(' ').length>lines.join(' ').length){
    let last=lines[maxLines-1];while(last&&ctx.measureText(last+'…').width>maxWidth)last=last.slice(0,-1);lines[maxLines-1]=last.trimEnd()+'…';
  }
  return lines;
}

function wrapCanvasTextAll(ctx,text,maxWidth) {
  const words=String(text||'').trim().split(/\s+/).filter(Boolean), lines=[];
  let line='';
  for(const word of words){
    const candidate=line?`${line} ${word}`:word;
    if(line&&ctx.measureText(candidate).width>maxWidth){lines.push(line);line=word;}
    else line=candidate;
  }
  if(line)lines.push(line);
  return lines;
}

async function canvasJPEG(canvas) {
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(result=>result?resolve(result):reject(new Error('Could not render invoice PDF.')),'image/jpeg',0.94));
  return new Uint8Array(await blob.arrayBuffer());
}

// Build a self-contained, one-page PDF from a high-resolution invoice canvas. No print dialog or PDF service required.
export async function invoicePDF(invoice) {
  if(document.fonts?.ready)await document.fonts.ready;
  const logo=await loadInvoiceLogo();
  const canvas=drawInvoicePage(invoice,logo);
  const jpeg=await canvasJPEG(canvas);
  const pdfW=595.28;
  const pdfH=canvas.height===PAGE.height?841.89:Number((pdfW*(canvas.height/canvas.width)).toFixed(2));
  const encoder=new TextEncoder();
  const objects=[
    encoder.encode('<< /Type /Catalog /Pages 2 0 R >>'),
    encoder.encode('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    encoder.encode(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pdfW} ${pdfH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`),
    [encoder.encode(`<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`),jpeg,encoder.encode('\nendstream')],
    (()=>{const content=encoder.encode(`q\n${pdfW} 0 0 ${pdfH} 0 0 cm\n/Im0 Do\nQ`);return [encoder.encode(`<< /Length ${content.length} >>\nstream\n`),content,encoder.encode('\nendstream')];})()
  ];
  const chunks=[encoder.encode('%PDF-1.4\n%Invoice\n')], offsets=[0];let byteLength=chunks[0].length;
  for(let i=0;i<objects.length;i++){
    offsets.push(byteLength);
    const prefix=encoder.encode(`${i+1} 0 obj\n`),suffix=encoder.encode('\nendobj\n');
    const pieces=Array.isArray(objects[i])?objects[i]:[objects[i]];
    chunks.push(prefix,...pieces,suffix);byteLength+=prefix.length+pieces.reduce((n,p)=>n+p.length,0)+suffix.length;
  }
  const xrefOffset=byteLength;
  let xref=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
  for(const offset of offsets.slice(1))xref+=`${String(offset).padStart(10,'0')} 00000 n \n`;
  chunks.push(encoder.encode(`${xref}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`));
  return new Blob(chunks,{type:'application/pdf'});
}

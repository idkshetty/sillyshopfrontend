import {contrastColorFor,shadeColor,validHexColor} from './commerce.js';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const sampledColorCache = new Map();

export function sampleArtworkBgFromImage(img) {
  if (!img || !img.complete || !img.naturalWidth || !img.naturalHeight) return '';
  const src = img.currentSrc || img.src || '';
  if (sampledColorCache.has(src)) return sampledColorCache.get(src);
  try {
    const size = 32;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return '';
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;
    // Check if the outer corners/backdrop are transparent — if so, keep the background white (#ffffff)
    const cornerCoords = [[1, 1], [size - 2, 1], [1, size - 2], [size - 2, size - 2], [2, 10], [size - 3, 10]];
    let transparentCorners = 0;
    for (const [cx, cy] of cornerCoords) {
      const cIdx = (cy * size + cx) * 4;
      if (data[cIdx + 3] < 180) transparentCorners++;
    }
    if (transparentCorners >= 2) {
      sampledColorCache.set(src, '#ffffff');
      return '#ffffff';
    }
    // Sample all 4 outer perimeter strips for uniform studio backdrop color matching
    let rSum = 0, gSum = 0, bSum = 0, count = 0;
    const regions = [
      [4, size - 5, 1, 4],
      [4, size - 5, size - 5, size - 2],
      [1, 4, 4, size - 5],
      [size - 5, size - 2, 4, size - 5]
    ];
    for (const [x0, x1, y0, y1] of regions) {
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const idx = (y * size + x) * 4;
          const a = data[idx + 3] / 255;
          // Composite over white if semi-transparent
          const r = Math.round(data[idx] * a + 255 * (1 - a));
          const g = Math.round(data[idx + 1] * a + 255 * (1 - a));
          const b = Math.round(data[idx + 2] * a + 255 * (1 - a));
          rSum += r; gSum += g; bSum += b; count++;
        }
      }
    }
    if (!count) return '#ffffff';
    const toHex = n => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
    const hex = `#${toHex(rSum / count)}${toHex(gSum / count)}${toHex(bSum / count)}`;
    sampledColorCache.set(src, hex);
    return hex;
  } catch {
    return '';
  }
}

export function applyArtworkColorToContainer(container, hex) {
  if (!container || !validHexColor(hex)) return;
  const fg = contrastColorFor(hex);
  const hover = shadeColor(hex, fg === '#181715' ? -0.09 : 0.12);
  const border = shadeColor(hex, fg === '#181715' ? -0.18 : 0.22);
  container.style.setProperty('--artwork-bg', hex);
  container.style.setProperty('--artwork-fg', fg);
  container.style.setProperty('--artwork-hover', hover);
  container.style.setProperty('--artwork-border', border);
  container.dataset.bgColor = hex;
  container.querySelectorAll('[data-artwork-btn],.cart-button,[data-action="add"],[data-action="add-detail"]').forEach(btn => {
    btn.style.setProperty('--artwork-bg', hex);
    btn.style.setProperty('--artwork-fg', fg);
    btn.style.setProperty('--artwork-hover', hover);
    btn.style.setProperty('--artwork-border', border);
  });
  const swatch = container.querySelector('.artwork-color-swatch');
  if (swatch) swatch.style.background = hex;
}

export function syncArtworkColors(root = document) {
  root.querySelectorAll('[data-product-card],[data-hero-slide]').forEach(card => {
    const img = card.querySelector('[data-artwork-img],img');
    if (!img) return;
    const updateFromImg = () => {
      const sampled = sampleArtworkBgFromImage(img);
      if (sampled) applyArtworkColorToContainer(card, sampled);
    };
    if (img.complete && img.naturalWidth > 0) updateFromImg();
    else img.addEventListener('load', updateFromImg, { once: true });
  });
}

export function decorateCartButtons(root = document) {
  root.querySelectorAll('[data-action="add"],[data-action="add-detail"]').forEach(button => {
    if (button.disabled || button.classList.contains('cart-button')) return;
    const inlineStyle = button.getAttribute('style') || '';
    button.classList.remove('button', 'outline', 'full');
    button.classList.add('cart-button');
    if (inlineStyle) button.setAttribute('style', inlineStyle);
    button.innerHTML = `<span class="add-to-cart">Add to cart</span>
      <span class="added" aria-hidden="true">Added ✓</span>
      <i class="fas fa-shopping-cart" aria-hidden="true"></i>
      <i class="fas fa-box" aria-hidden="true"></i>`;
  });
  syncArtworkColors(root);
}

function cartClick() {
  let button = this;
  button.classList.add('clicked');
}

export async function animateCart(button) {
  button.classList.remove('clicked');
  void button.offsetWidth;
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  button.setAttribute('aria-label', 'Added to cart');
  cartClick.call(button);
  if (reduced()) {
    await new Promise(resolve => setTimeout(resolve, 150));
  } else if (typeof button.getAnimations === 'function' && typeof requestAnimationFrame === 'function') {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const anims = button.getAnimations({ subtree: true }).filter(a => a.playState === 'running' || a.playState === 'pending');
    if (anims.length) {
      await Promise.race([
        Promise.all(anims.map(a => a.finished.catch(() => {}))),
        new Promise(resolve => setTimeout(resolve, 1900))
      ]);
    } else {
      await new Promise(resolve => setTimeout(resolve, 1550));
    }
    if (button.isConnected) await new Promise(resolve => setTimeout(resolve, 250));
  } else {
    await new Promise(resolve => setTimeout(resolve, 1800));
  }
  button.disabled = false;
  button.removeAttribute('aria-busy');
}

export async function animateCartCheckout(flow) {
  if (!flow || flow.classList.contains('is-checking-out')) return;
  const current = flow.querySelector('.cart-checkout-current');
  const confirmed = flow.querySelector('.cart-checkout-confirmed');
  flow.classList.add('is-checking-out');
  if (current) {
    current.setAttribute('aria-hidden', 'true');
    current.inert = true;
  }
  confirmed?.removeAttribute('aria-hidden');
  if (reduced()) {
    await new Promise(resolve => setTimeout(resolve, 180));
    return;
  }
  if (typeof flow.getAnimations === 'function' && typeof requestAnimationFrame === 'function') {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const anims = flow.getAnimations({ subtree: true }).filter(a => a.playState === 'running' || a.playState === 'pending');
    if (anims.length) {
      await Promise.race([
        Promise.all(anims.map(a => a.finished.catch(() => {}))),
        new Promise(resolve => setTimeout(resolve, 1900))
      ]);
    } else {
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    if (flow.isConnected) await new Promise(resolve => setTimeout(resolve, 260));
  } else {
    await new Promise(resolve => setTimeout(resolve, 1900));
  }
}

export function mountHeroBanner(root = document) {
  const banner = root.querySelector('[data-hero-banner]');
  if (!banner) return () => {};
  const slides = [...banner.querySelectorAll('[data-hero-slide]')];
  const dots = [...banner.querySelectorAll('[data-action="banner-slide"]')];
  if (slides.length <= 1) return () => {};

  let activeIndex = 0;
  let paused = false;

  function showSlide(nextIndex) {
    activeIndex = ((nextIndex % slides.length) + slides.length) % slides.length;
    const slide = slides[activeIndex];
    slides.forEach((s, i) => {
      const isCurrent = i === activeIndex;
      s.classList.toggle('is-active', isCurrent);
      const link = s.querySelector('a');
      if (link) link.tabIndex = isCurrent ? 0 : -1;
    });
    dots.forEach((d, i) => {
      const isCurrent = i === activeIndex;
      d.classList.toggle('is-active', isCurrent);
      d.setAttribute('aria-selected', String(isCurrent));
    });
    const bgColor = slide.dataset.bgColor || '#f3cfa8';
    const fg = contrastColorFor(bgColor);
    const hover = shadeColor(bgColor, fg === '#181715' ? -0.09 : 0.12);
    const border = shadeColor(bgColor, fg === '#181715' ? -0.18 : 0.22);
    banner.style.setProperty('--banner-bg', bgColor);
    banner.style.setProperty('--artwork-bg', bgColor);
    banner.style.setProperty('--artwork-fg', fg);
    banner.style.setProperty('--artwork-hover', hover);
    banner.style.setProperty('--artwork-border', border);

    const titleEl = banner.querySelector('[data-banner-art-title]');
    const artistEl = banner.querySelector('[data-banner-art-artist]');
    const ctaEl = banner.querySelector('[data-banner-cta]');
    if (titleEl) titleEl.textContent = slide.dataset.title || '';
    if (artistEl && artistEl.dataset.bannerArtistCustom !== 'true') {
      artistEl.textContent = `Art by ${slide.dataset.artist || 'Suprita Chatterjee'}`;
      if (slide.dataset.artistSlug) artistEl.setAttribute('href', `#artist/${slide.dataset.artistSlug}`);
    }
    if (ctaEl) ctaEl.setAttribute('href', slide.dataset.href || '#artworks');
  }

  const onClick = event => {
    const btn = event.target.closest('[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'banner-prev') {
      event.preventDefault();
      showSlide(activeIndex - 1);
    } else if (btn.dataset.action === 'banner-next') {
      event.preventDefault();
      showSlide(activeIndex + 1);
    } else if (btn.dataset.action === 'banner-slide') {
      event.preventDefault();
      showSlide(Number(btn.dataset.index) || 0);
    }
  };
  banner.addEventListener('click', onClick);
  const onEnter = () => { paused = true; };
  const onLeave = () => { paused = false; };
  banner.addEventListener('mouseenter', onEnter);
  banner.addEventListener('mouseleave', onLeave);
  banner.addEventListener('focusin', onEnter);
  banner.addEventListener('focusout', onLeave);

  const timer = setInterval(() => {
    if (!paused && !document.hidden && !reduced()) {
      showSlide(activeIndex + 1);
    }
  }, 4000);

  return () => {
    clearInterval(timer);
    banner.removeEventListener('click', onClick);
    banner.removeEventListener('mouseenter', onEnter);
    banner.removeEventListener('mouseleave', onLeave);
    banner.removeEventListener('focusin', onEnter);
    banner.removeEventListener('focusout', onLeave);
  };
}

let cachedPaymentSvgSource=null,paymentSvgPromise=null,paymentBgPreloaded=false;
export function preloadPaymentOutcomeSvg(){
  if(!paymentBgPreloaded&&typeof Image==='function'){paymentBgPreloaded=true;const img=new Image();img.src=new URL('./assets/payment-truck-bg.webp',import.meta.url).href;}
  if(cachedPaymentSvgSource)return Promise.resolve(cachedPaymentSvgSource);
  if(!paymentSvgPromise){
    paymentSvgPromise=fetch(new URL('./assets/payment-shipping.svg?v=cloud-drop-2',import.meta.url),{cache:'force-cache'})
      .then(response=>{if(!response.ok)throw new Error(`Could not load payment animation (${response.status}).`);return response.text();})
      .then(source=>{cachedPaymentSvgSource=source;return source;})
      .catch(error=>{paymentSvgPromise=null;throw error;});
  }
  return paymentSvgPromise;
}
async function loadPaymentShippingSvg(){
  const source=await preloadPaymentOutcomeSvg();
  const parsed=new DOMParser().parseFromString(source,'image/svg+xml');
  if(parsed.querySelector('parsererror')||parsed.documentElement.localName!=='svg')throw new Error('The payment animation SVG is invalid.');
  const svg=document.importNode(parsed.documentElement,true);
  svg.setAttribute('aria-hidden','true');
  svg.setAttribute('focusable','false');
  return svg;
}

function buildCloudDropItems(svg,orderedItems,success){
  const ns='http://www.w3.org/2000/svg';
  const xlink='http://www.w3.org/1999/xlink';
  const doc=svg.ownerDocument;
  const cloud=svg.querySelector('[data-anim="drop-cloud"]');
  const bucket=svg.querySelector('[data-anim="cloud-items"]');
  if(cloud){
    const body=cloud.querySelector('[data-cloud-body]');
    const shade=cloud.querySelector('[data-cloud-shade]');
    const hi=cloud.querySelector('[data-cloud-hi]');
    if(success){
      body?.setAttribute('fill','url(#cloud-sunny)');
      body?.setAttribute('stroke','#7D6B5D');
      shade?.setAttribute('fill','#E7DEC9');
      shade?.setAttribute('opacity','.55');
      hi?.setAttribute('opacity','.7');
    }else{
      body?.setAttribute('fill','url(#cloud-storm)');
      body?.setAttribute('stroke','#4B586B');
      shade?.setAttribute('fill','#57687E');
      shade?.setAttribute('opacity','.55');
      hi?.setAttribute('opacity','.22');
    }
  }
  if(!bucket)return {cloud,cards:[],size:58};
  bucket.replaceChildren();
  const source=Array.isArray(orderedItems)?orderedItems.slice(0,5):[];
  const items=(source.length?source:[{title:'Original artwork',image:'assets/paintings.svg',quantity:1}]).map(item=>({
    title:String(item?.title||'Item').trim().slice(0,120),
    image:String(item?.image||'assets/paintings.svg').trim()||'assets/paintings.svg',
    quantity:Number.isInteger(item?.quantity)&&item.quantity>0?item.quantity:1
  }));
  const size=items.length===1?66:items.length===2?58:items.length===3?52:44;
  const gap=items.length<=2?12:8;
  const totalWidth=items.length*size+(items.length-1)*gap;
  const startX=198-totalWidth/2;
  const startY=68;
  const defs=svg.querySelector('defs')||svg.insertBefore(doc.createElementNS(ns,'defs'),svg.firstChild);
  defs.querySelectorAll('[id^="cloud-item-clip-"]').forEach(node=>node.remove());
  const uid=Math.random().toString(36).slice(2,7);

  const cards=items.map((item,index)=>{
    const clipId=`cloud-item-clip-${uid}-${index}`;
    const clip=doc.createElementNS(ns,'clipPath');
    clip.setAttribute('id',clipId);
    const clipRect=doc.createElementNS(ns,'rect');
    clipRect.setAttribute('x','4');clipRect.setAttribute('y','4');
    clipRect.setAttribute('width',String(size-8));clipRect.setAttribute('height',String(size-8));
    clipRect.setAttribute('rx','6');
    clip.append(clipRect);
    defs.append(clip);

    const card=doc.createElementNS(ns,'g');
    card.setAttribute('data-anim','cloud-item');
    card.setAttribute('data-start-x',String(startX+index*(size+gap)));
    card.setAttribute('data-start-y',String(startY));
    card.setAttribute('data-size',String(size));
    card.setAttribute('transform',`translate(${startX+index*(size+gap)} ${startY})`);

    const groundShadow=doc.createElementNS(ns,'ellipse');
    groundShadow.setAttribute('data-item-ground-shadow','');
    groundShadow.setAttribute('cx',String(size/2));
    groundShadow.setAttribute('cy',String(size+3));
    groundShadow.setAttribute('rx',String(Math.round(size*.44)));
    groundShadow.setAttribute('ry','4.5');
    groundShadow.setAttribute('fill','rgba(38,44,54,.28)');
    groundShadow.setAttribute('opacity','0');
    card.append(groundShadow);

    const dropShadow=doc.createElementNS(ns,'rect');
    dropShadow.setAttribute('x','2');dropShadow.setAttribute('y','3');
    dropShadow.setAttribute('width',String(size));dropShadow.setAttribute('height',String(size));
    dropShadow.setAttribute('rx','9');dropShadow.setAttribute('fill','rgba(28,24,20,.2)');
    card.append(dropShadow);

    const frame=doc.createElementNS(ns,'rect');
    frame.setAttribute('width',String(size));frame.setAttribute('height',String(size));
    frame.setAttribute('rx','9');frame.setAttribute('fill','#FFFDF9');
    frame.setAttribute('stroke','#D5C7AE');frame.setAttribute('stroke-width','1.8');
    card.append(frame);

    const innerBg=doc.createElementNS(ns,'rect');
    innerBg.setAttribute('x','4');innerBg.setAttribute('y','4');
    innerBg.setAttribute('width',String(size-8));innerBg.setAttribute('height',String(size-8));
    innerBg.setAttribute('rx','6');innerBg.setAttribute('fill','#EFE8D8');
    card.append(innerBg);

    const img=doc.createElementNS(ns,'image');
    img.setAttribute('x','4');img.setAttribute('y','4');
    img.setAttribute('width',String(size-8));img.setAttribute('height',String(size-8));
    img.setAttribute('preserveAspectRatio','xMidYMid slice');
    img.setAttribute('clip-path',`url(#${clipId})`);
    img.setAttribute('href',item.image);
    img.setAttributeNS(xlink,'xlink:href',item.image);
    card.append(img);

    const wet=doc.createElementNS(ns,'g');
    wet.setAttribute('data-item-wet','');
    wet.setAttribute('opacity','0');
    const wetTint=doc.createElementNS(ns,'rect');
    wetTint.setAttribute('x','4');wetTint.setAttribute('y','4');
    wetTint.setAttribute('width',String(size-8));wetTint.setAttribute('height',String(size-8));
    wetTint.setAttribute('rx','6');wetTint.setAttribute('fill','rgba(78,108,142,.22)');
    const wetStreaks=doc.createElementNS(ns,'path');
    wetStreaks.setAttribute('d',`M${Math.round(size*.26)} ${Math.round(size*.28)}l-3 10M${Math.round(size*.68)} ${Math.round(size*.36)}l-3 11`);
    wetStreaks.setAttribute('stroke','#C6E0F5');wetStreaks.setAttribute('stroke-width','1.6');
    wetStreaks.setAttribute('stroke-linecap','round');
    wet.append(wetTint,wetStreaks);
    card.append(wet);

    if(item.quantity>1){
      const pill=doc.createElementNS(ns,'rect');
      const pw=size>=56?24:20;
      pill.setAttribute('x',String(size-pw-3));pill.setAttribute('y','3');
      pill.setAttribute('width',String(pw));pill.setAttribute('height','14');
      pill.setAttribute('rx','7');pill.setAttribute('fill','#181715');
      const qt=doc.createElementNS(ns,'text');
      qt.setAttribute('x',String(size-pw/2-3));qt.setAttribute('y','12.5');
      qt.setAttribute('text-anchor','middle');qt.setAttribute('fill','#FFFFFF');
      qt.setAttribute('font-family','Arial, sans-serif');qt.setAttribute('font-size','8.5');
      qt.setAttribute('font-weight','700');
      qt.textContent=`×${item.quantity}`;
      card.append(pill,qt);
    }

    const title=doc.createElementNS(ns,'title');
    title.textContent=`${item.quantity} × ${item.title}`;
    card.append(title);
    bucket.append(card);
    return card;
  });
  return {cloud,cards,size};
}

function setPaymentOutcomeBadge(svg,success){
  const badge=svg.querySelector('[data-anim="btn-shipped"]');
  if(!badge)return;
  badge.querySelector('[id="label"],[data-outcome-label]')?.remove();
  badge.querySelector('[id="check"],[data-outcome-cross]')?.remove();

  const ns='http://www.w3.org/2000/svg';
  const label=svg.ownerDocument.createElementNS(ns,'text');
  if(success){
    badge.querySelector('rect')?.setAttribute('fill','#E6F2E5');
    badge.querySelector('[id="btn-dash"]')?.setAttribute('fill','#C6DCC9');
    label.setAttribute('id','label');
    label.setAttribute('data-outcome-label','success');
    label.setAttribute('x','152');label.setAttribute('y','35');
    label.setAttribute('text-anchor','end');label.setAttribute('fill','#176B3A');
    label.setAttribute('font-family','Arial, sans-serif');label.setAttribute('font-size','13');
    label.setAttribute('font-weight','700');label.setAttribute('letter-spacing','.5');
    label.textContent='ORDER PLACED';
    const check=svg.ownerDocument.createElementNS(ns,'path');
    check.setAttribute('id','check');
    check.setAttribute('d','M162 29.5L166.5 35.5L176 22.5');
    check.setAttribute('fill','none');check.setAttribute('stroke','#176B3A');
    check.setAttribute('stroke-width','3');check.setAttribute('opacity','.85');
    check.setAttribute('stroke-linecap','round');check.setAttribute('stroke-linejoin','round');
    badge.append(label,check);
    return;
  }

  badge.querySelector('rect')?.setAttribute('fill','#F5E8E5');
  badge.querySelector('[id="btn-dash"]')?.setAttribute('fill','#D7A8A2');
  label.setAttribute('data-outcome-label','failure');
  label.setAttribute('x','160');label.setAttribute('y','34.5');
  label.setAttribute('text-anchor','end');label.setAttribute('fill','#9B392F');
  label.setAttribute('font-family','Arial, sans-serif');label.setAttribute('font-size','11.5');
  label.setAttribute('font-weight','700');label.setAttribute('letter-spacing','.4');
  label.textContent='ORDER NOT PLACED';
  const cross=svg.ownerDocument.createElementNS(ns,'path');
  cross.setAttribute('data-outcome-cross','failure');
  cross.setAttribute('d','M170 23 L183 36 M183 23 L170 36');
  cross.setAttribute('fill','none');cross.setAttribute('stroke','#9B392F');
  cross.setAttribute('stroke-width','3');cross.setAttribute('stroke-linecap','round');
  badge.append(label,cross);
}

function populatePaymentRain(container){
  if(!container)return;
  let increment=0,html='';
  while(increment<92){
    const randoHundo=String(Math.floor(Math.random()*98)+1).padStart(2,'0');
    const randoFiver=Math.floor(Math.random()*3)+2;
    increment+=randoFiver;
    const timing=`animation-delay:0.${randoHundo}s;animation-duration:0.5${randoHundo}s`;
    html+=`<div class="drop" style="left:${increment}%;${timing}"><div class="stem" style="${timing}"></div><div class="splat" style="${timing}"></div></div>`;
  }
  container.innerHTML=html;
}

async function animateOutcomeTruck(scene,success,orderedItems=[]){
  const svg=scene.querySelector('#ship-it');
  if(!svg)return;
  if(!reduced()&&!window.gsap){
    const deadline=Date.now()+1000;
    while(!window.gsap&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,50));
  }
  const gsap=window.gsap;
  const {cloud,cards,size}=buildCloudDropItems(svg,orderedItems,success);
  const rainBox=scene.querySelector('.payment-rain');
  setPaymentOutcomeBadge(svg,success);
  scene._stopRain=()=>{rainBox?.classList.remove('is-raining');rainBox?.replaceChildren();};

  if(reduced()||!gsap){
    svg.querySelectorAll('[data-anim]').forEach(element=>element.classList.remove('hidden'));
    if(success){
      cards.forEach(card=>card.setAttribute('opacity','0'));
    }else{
      const landingY=358-size;
      const tilts=[-6,5,-4,6,-5];
      if(rainBox){populatePaymentRain(rainBox);rainBox.classList.add('is-raining');}
      cards.forEach((card,index)=>{
        const x=Number(card.getAttribute('data-start-x')||170);
        card.setAttribute('transform',`translate(${x} ${landingY}) rotate(${tilts[index%tilts.length]} ${size/2} ${size/2})`);
        card.querySelector('[data-item-ground-shadow]')?.setAttribute('opacity','1');
        card.querySelector('[data-item-wet]')?.setAttribute('opacity','1');
      });
    }
    return;
  }

  const select=name=>svg.querySelector(`[data-anim="${name}"]`);
  const selectAll=name=>svg.querySelectorAll(`[data-anim="${name}"]`);
  const ripple=select('ripple'),btnBg=select('btn-bg'),btnLabel=select('btn-label'),btnShadow=select('btn-shadow');
  const frontGroup=select('front-group'),frontWheels=selectAll('front-wheel'),frontWheelBack=select('front-wheel-back');
  const backWheels=selectAll('back-wheel'),backWheelsBack=selectAll('back-wheel-back'),containerParts=selectAll('container-part');
  const containerLip=select('container-lip'),container=select('container'),truckBtn=select('truck-btn'),shippedBtn=select('btn-shipped');
  // Keep every beat on the same running timeline; CSS rain runs smoothly once activated.
  const timeline=gsap.timeline();
  const truckStart=.2;
  const at=seconds=>truckStart+seconds;
  const truckDeparture=at(1.4);

  if(cloud)gsap.set(cloud,{autoAlpha:1,x:0,y:0});
  if(success&&cards.length){
    cards.forEach(card=>gsap.set(card,{autoAlpha:0,scale:.76,transformOrigin:'center top'}));
    const dropStart=.72,dropDur=.48,landingY=276-size/2;
    if(cloud)timeline.to(cloud,{y:-5,duration:.24,ease:'power1.out'},.15).to(cloud,{y:0,duration:.28,ease:'power1.inOut'},.39);
    cards.forEach((card,index)=>{
      const startY=Number(card.getAttribute('data-start-y')||68);
      const stagger=index*.06;
      timeline.to(card,{autoAlpha:1,scale:1,duration:.16,ease:'back.out(1.6)'},dropStart+stagger-.12)
        .to(card,{y:landingY-startY,duration:dropDur,ease:'power2.in'},dropStart+stagger)
        .to(card,{autoAlpha:0,duration:.1,ease:'power1.in'},dropStart+stagger+dropDur-.02);
    });
    timeline.to([btnBg,btnLabel],{scaleX:1.05,transformOrigin:'center',duration:.2,ease:'power1.inOut',repeat:1,yoyo:true},dropStart+dropDur-.06)
      .to([btnBg,btnLabel],{scaleY:.94,duration:.2,ease:'power1.inOut',repeat:1,yoyo:true},dropStart+dropDur-.06);
  }else if(!success&&cards.length){
    const fallingLayer=svg.ownerDocument.createElementNS('http://www.w3.org/2000/svg','g');
    fallingLayer.setAttribute('data-anim','fallen-order-layer');
    if(cloud?.parentNode)cloud.parentNode.insertBefore(fallingLayer,cloud);else svg.append(fallingLayer);
    cards.forEach(card=>{
      fallingLayer.append(card);
      gsap.set(card,{autoAlpha:0,scale:.78,transformOrigin:'center center'});
    });
    if(rainBox)populatePaymentRain(rainBox);
    const dropStart=truckDeparture+.35;
    const landingY=358-size;
    const tilts=[-7,6,-5,7,-4];
    if(cloud){
      timeline.to(cloud,{x:-3,duration:.08,repeat:3,yoyo:true,ease:'sine.inOut'},dropStart-.12)
        .set(cloud,{x:0},dropStart+.22);
    }
    cards.forEach((card,index)=>{
      const startY=Number(card.getAttribute('data-start-y')||68);
      const stagger=index*.11;
      const gShadow=card.querySelector('[data-item-ground-shadow]');
      const wet=card.querySelector('[data-item-wet]');
      timeline.to(card,{autoAlpha:1,scale:1,duration:.16,ease:'power1.out'},dropStart+stagger-.08)
        .to(card,{y:landingY-startY,rotation:tilts[index%tilts.length],duration:.74,ease:'bounce.out'},dropStart+stagger);
      if(gShadow)timeline.to(gShadow,{opacity:1,duration:.18,ease:'power1.out'},dropStart+stagger+.42);
      if(wet)timeline.to(wet,{opacity:1,duration:.45,ease:'power1.out'},dropStart+stagger+.65);
    });
    const rainStart=dropStart+.15;
    if(rainBox)timeline.call(()=>rainBox.classList.add('is-raining'),[],rainStart);
  }

  timeline
    .set(frontGroup,{x:-50,scale:.84,transformOrigin:'left top',autoAlpha:1},at(0))
    .set([frontWheels,frontWheelBack],{y:-25,autoAlpha:1},at(0))
    .set(frontWheels[1],{autoAlpha:0},at(0))
    .set(container,{scale:.98,transformOrigin:'right top',autoAlpha:1},at(0))
    .set([containerParts,containerLip],{y:-15,autoAlpha:1},at(0))
    .set(containerParts[2],{autoAlpha:.5},at(0))
    .set([backWheels,backWheelsBack],{y:-30,autoAlpha:1},at(0))
    .to(container,{scale:1,duration:.5},at(0))
    .to(containerParts,{y:0,duration:.5,stagger:-.1},at(.2))
    .to(containerLip,{y:0,duration:.5},at(.6))
    .to(backWheelsBack,{y:0,duration:.5,stagger:-.1},at(.55))
    .to(backWheels,{y:0,duration:.5,stagger:.1},at(.6))
    .to(frontGroup,{scale:1,x:0,duration:.6,ease:'back.out(1.4)'},at(.7))
    .to(frontWheelBack,{y:0,duration:.5},at(.8))
    .to(frontWheels,{y:0,duration:.5,ease:'back.out(5.4)'},at(.9))
    .set(frontWheels[1],{autoAlpha:1},at(1.05))
    .set(shippedBtn,{autoAlpha:1},at(1.05))
    .fromTo(truckBtn,{x:0},{x:'+=1000',duration:1.2,ease:'back.in(.5)'},truckDeparture)
    .fromTo(truckBtn,{autoAlpha:1},{autoAlpha:0,duration:.5,ease:'power1.in'},truckDeparture+1.2);

  timeline.set(btnShadow,{autoAlpha:0},0)
    .set(ripple,{x:10,y:10},0)
    .fromTo(ripple,{autoAlpha:.5,scale:0},{autoAlpha:0,scale:20,duration:.5,transformOrigin:'center',ease:'power1.out'},0);

  // Slow every beat together so the truck, artwork drop, and falling rain keep their timing.
  timeline.timeScale(1.05);
  return new Promise(resolve=>timeline.eventCallback('onComplete',()=>{
    resolve();
  }));
}

export async function playPaymentOutcome(outcome,{preview=false,message='',items=[]}={}){
  const main=document.getElementById('main');if(!main)return;
  const success=outcome==='success';
  main.innerHTML=`<section class="payment-outcome-scene ${success?'is-success':'is-failure'}" aria-live="polite" aria-label="Payment ${success?'successful':'failed'}"><div class="payment-outcome-pill">${success?'Payment verified':'Payment unsuccessful'}</div><div class="payment-truck-stage"><div class="payment-road" aria-hidden="true"></div><div class="payment-rain" aria-hidden="true"></div></div><div class="payment-outcome-copy"><h1>${success?'Payment successful':'Payment failed'}</h1><p></p><button type="button" class="button" data-action="payment-preview-return" hidden>Return to checkout</button></div></section>`;
  const scene=main.querySelector('.payment-outcome-scene'),copy=scene.querySelector('.payment-outcome-copy p'),button=scene.querySelector('button');
  try{scene.querySelector('.payment-truck-stage').append(await loadPaymentShippingSvg());}
  catch(error){console.error('Payment animation could not load:',error);}
  button.dataset.preview=String(preview);
  scene.scrollIntoView?.({behavior:reduced()?'auto':'smooth',block:'start'});
  await animateOutcomeTruck(scene,success,items);
  copy.textContent=preview?(success?'Success preview: this is how a verified payment will look. No payment, order or stock reservation was recorded.':'Failure preview: the cart is unchanged and you can retry. No payment, order or stock reservation was recorded.'):success?'Your order is confirmed and will ship via India Post.':message||'Payment failed. This order was cancelled and your cart is saved so you can try again.';
  try{
    if(preview||!success){button.hidden=false;await new Promise(resolve=>button.addEventListener('click',resolve,{once:true}));}
    else await new Promise(resolve=>setTimeout(resolve,reduced()?300:1100));
  }finally{scene._stopRain?.();}
}

export function truckContent(label) {
  return `<span class="default">${label}</span>
    <span class="success" aria-hidden="true">Details saved
      <svg viewBox="0 0 12 10"><polyline points="1.5 6 4.5 9 10.5 1"></polyline></svg>
    </span>
    <div class="truck" aria-hidden="true">
      <div class="wheel"></div>
      <div class="back"></div>
      <div class="front"></div>
      <div class="box"></div>
    </div>`;
}

function playTruck(button, onComplete) {
  let box = button.querySelector('.box'),
      truck = button.querySelector('.truck');

  if (!button.classList.contains('done')) {
    if (!button.classList.contains('animation')) {
      button.classList.add('animation');

      gsap.to(button, {
        '--box-s': 1,
        '--box-o': 1,
        duration: .38,
        delay: .16,
        ease: 'back.out(1.15)'
      });
      gsap.to(box, {
        x: 0,
        duration: .5,
        delay: .3,
        ease: 'power2.out'
      });
      gsap.to(button, {
        '--hx': -5,
        '--bx': 50,
        duration: .32,
        delay: .46,
        ease: 'power2.inOut'
      });
      gsap.to(box, {
        y: 0,
        duration: .28,
        delay: .62,
        ease: 'power2.out'
      });
      gsap.set(button, {
        '--truck-y': 0,
        '--truck-y-n': -26
      });
      gsap.to(button, {
        '--truck-y': 1,
        '--truck-y-n': -25,
        duration: .3,
        delay: .72,
        ease: 'sine.inOut',
        onComplete() {
          gsap.timeline({
            onComplete() {
              button.classList.add('done');
              onComplete();
            }
          }).to(truck, {x: 0, duration: .42, ease: 'power2.out'})
            .to(truck, {x: 28, duration: .82, ease: 'sine.inOut'})
            .to(truck, {x: 68, duration: .78, ease: 'sine.inOut'})
            .to(truck, {x: 96, duration: .58, ease: 'power2.inOut'});
        }
      });
    }
  } else {
    button.classList.remove('animation', 'done');
    gsap.set(truck, {x: 4});
    gsap.set(button, {
      '--hx': 0,
      '--bx': 0,
      '--box-s': .5,
      '--box-o': 0,
      '--truck-y': 0,
      '--truck-y-n': -26
    });
    gsap.set(box, {x: -24, y: -6});
  }
}

export function beginCheckoutAnimation(button) {
  const label = button.querySelector('.default');
  const originalLabel = label.textContent;
  const actions = button.closest('.checkout-step-actions');
  let context;
  function moveButton(centered) {
    if (!button.isConnected || !actions) return;
    const before = button.getBoundingClientRect();
    button.classList.add('checkout-centering-prep');
    actions.classList.toggle('is-saving', centered);
    const after = button.getBoundingClientRect();
    button.style.setProperty('--checkout-shift-x', `${before.left - after.left}px`);
    void button.offsetWidth;
    button.classList.remove('checkout-centering-prep');
    button.classList.add('checkout-centering');
    requestAnimationFrame(() => button.style.setProperty('--checkout-shift-x', '0px'));
  }
  moveButton(true);
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  button.setAttribute('aria-label', 'Saving checkout details');
  return {
    async complete() {
      if (!button.isConnected) return;
      label.textContent = originalLabel;
      if (reduced() || !window.gsap) {
        button.classList.add('animation', 'done');
      } else {
        await new Promise(resolve => {
          context = gsap.context(() => playTruck(button, resolve), button);
        });
      }
      button.setAttribute('aria-label', 'Checkout details saved');
      button.setAttribute('aria-busy', 'false');
      // Let the original .45 s tick delay and .4 s stroke animation finish.
      if (!reduced()) await new Promise(resolve => setTimeout(resolve, 1100));
    },
    reset() {
      context?.revert();
      button.classList.remove('animation', 'done');
      moveButton(false);
      button.disabled = false;
      button.removeAttribute('aria-busy');
      button.removeAttribute('aria-label');
      label.textContent = originalLabel;
    }
  };
}

export function reviewSection(images=[]) {
  if(!images.length)return '';
  if(images.length<7)return `<section class="reviews-section"><p class="eyebrow">Reviews</p><h2>Customer reviews</h2><div class="review-small-grid">${images.map((url,i)=>`<img src="${url.replaceAll('&','&amp;').replaceAll('"','&quot;')}" alt="Customer review ${i+1}" loading="lazy" decoding="async">`).join('')}</div></section>`;
  const positions = ['hideLeft', 'prevLeftSecond', 'prev', 'selected', 'next', 'nextRightSecond', 'hideRight'];
  return `<section class="reviews-section" aria-label="Customer review carousel">
    <p class="eyebrow">Reviews</p>
    <h2>Customer reviews</h2>
    <div class="review-stage"><div id="carousel" tabindex="0" aria-label="Customer reviews. Use left and right arrow keys to browse.">
      ${images.map((url, i) => `<div class="${positions[i]}" data-review="${i}"><img src="${url.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}" alt="Customer review ${i+1}" draggable="false" loading="lazy" decoding="async"></div>`).join('')}
    </div></div>
    <div class="review-progress"><span id="review-position">4 / 7</span><button type="button" id="review-pause" class="text-link" aria-pressed="false">Pause animation</button></div>
  </section>`;
}

export function mountReviews() {
  const root = document.querySelector('.reviews-section');
  if (!root?.querySelector('#carousel') || !window.jQuery) return () => {};
  const $ = window.jQuery;
  const carousel = $(root).find('#carousel');
  const pause = root.querySelector('#review-pause');
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = media.matches, hover = false, focus = false;

  // The supplied carousel function; selectors are scoped to this carousel.
  function moveToSelected(element) {
    if (element == 'next') {
      var selected = carousel.find('.selected').next();
    } else if (element == 'prev') {
      var selected = carousel.find('.selected').prev();
    } else {
      var selected = element;
    }
    var next = $(selected).next();
    var prev = $(selected).prev();
    var prevSecond = $(prev).prev();
    var nextSecond = $(next).next();
    $(selected).removeClass().addClass('selected');
    $(prev).removeClass().addClass('prev');
    $(next).removeClass().addClass('next');
    $(nextSecond).removeClass().addClass('nextRightSecond');
    $(prevSecond).removeClass().addClass('prevLeftSecond');
    $(nextSecond).nextAll().removeClass().addClass('hideRight');
    $(prevSecond).prevAll().removeClass().addClass('hideLeft');
  }

  function update() {
    carousel.children().each((_, card) => card.setAttribute('aria-hidden', String(!card.classList.contains('selected'))));
    root.querySelector('#review-position').textContent = `${Number(carousel.find('.selected').attr('data-review')) + 1} / 7`;
    pause.textContent = paused ? 'Play animation' : 'Pause animation';
    pause.setAttribute('aria-pressed', String(paused));
  }
  function advance(direction) {
    // Recycle an invisible end card; the original class choreography stays intact.
    if (direction === 'next') carousel.append(carousel.children().first());
    else carousel.prepend(carousel.children().last());
    moveToSelected(direction);
    update();
  }
  carousel.on('keydown', event => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      advance(event.key === 'ArrowRight' ? 'next' : 'prev');
    }
  });
  carousel.children().on('click', function () {
    const selected = $(this);
    while (selected.index() > 3) carousel.append(carousel.children().first());
    while (selected.index() < 3) carousel.prepend(carousel.children().last());
    moveToSelected(selected);
    update();
  });
  pause.onclick = () => { paused = !paused; update(); };
  root.onmouseenter = () => hover = true;
  root.onmouseleave = () => hover = false;
  root.onfocusin = () => focus = true;
  root.onfocusout = event => { focus = root.contains(event.relatedTarget); };
  const change = () => { paused = media.matches; update(); };
  media.addEventListener('change', change);
  const interval = setInterval(() => {
    if (!paused && !hover && !focus && !document.hidden) advance('next');
  }, 4200);
  update();
  return () => {
    clearInterval(interval);
    carousel.off();
    carousel.children().off();
    media.removeEventListener('change', change);
  };
}

export function mountArtistScrollPrompt({ dismissed = false, onDismiss = () => {} } = {}) {
  const existing = document.getElementById('artist-scroll-prompt');
  if (existing) existing.remove();
  if (dismissed) return () => {};
  const target = document.getElementById('product-results') || document.querySelector('.product-grid');
  if (!target) return () => {};

  const prompt = document.createElement('div');
  prompt.id = 'artist-scroll-prompt';
  prompt.className = 'artist-scroll-prompt';
  prompt.hidden = true;
  prompt.innerHTML = `<a href="#artists" class="artist-scroll-prompt-cta"><span class="artist-prompt-dot" aria-hidden="true"></span><span>Do you want to filter with artists?</span><span aria-hidden="true">→</span></a><button type="button" class="artist-scroll-prompt-close" aria-label="Dismiss artist filter prompt"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>`;
  document.body.append(prompt);

  let raf = 0;
  let isDismissed = false;
  const update = () => {
    raf = 0;
    if (isDismissed || !prompt.isConnected) return;
    const rect = target.getBoundingClientRect();
    const total = Math.max(rect.height, 1);
    const viewed = window.innerHeight * 0.65 - rect.top;
    const progress = viewed / total;
    const shouldShow = window.scrollY > 120 && progress >= 0.30;
    if (shouldShow) {
      prompt.hidden = false;
      requestAnimationFrame(() => prompt.classList.add('is-visible'));
    } else if (window.scrollY <= 80 || progress < 0.20) {
      prompt.classList.remove('is-visible');
      prompt.hidden = true;
    }
  };
  const onScroll = () => {
    if (!raf) raf = requestAnimationFrame(update);
  };
  const closeBtn = prompt.querySelector('.artist-scroll-prompt-close');
  const onClose = () => {
    isDismissed = true;
    prompt.classList.remove('is-visible');
    prompt.hidden = true;
    onDismiss();
  };
  closeBtn?.addEventListener('click', onClose);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  return () => {
    if (raf) cancelAnimationFrame(raf);
    window.removeEventListener('scroll', onScroll);
    closeBtn?.removeEventListener('click', onClose);
    prompt.remove();
  };
}

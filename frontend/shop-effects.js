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

async function loadPaymentShippingSvg(){
  const response=await fetch(new URL('./assets/payment-shipping.svg?v=red-truck-2',import.meta.url),{cache:'force-cache'});
  if(!response.ok)throw new Error(`Could not load payment animation (${response.status}).`);
  const source=await response.text();
  const parsed=new DOMParser().parseFromString(source,'image/svg+xml');
  if(parsed.querySelector('parsererror')||parsed.documentElement.localName!=='svg')throw new Error('The payment animation SVG is invalid.');
  const svg=document.importNode(parsed.documentElement,true);
  svg.setAttribute('aria-hidden','true');
  svg.setAttribute('focusable','false');
  return svg;
}

function buildPaymentList(svg,orderedItems){
  const list=svg.querySelector('[data-anim="list"]');
  if(!list)return {list,rows:[]};
  // Every outcome gets a fresh SVG, but explicitly reset visibility so the
  // success timeline cannot inherit a hidden state from the source artwork.
  list.classList.remove('hidden');
  list.style.visibility='visible';
  list.style.opacity='1';
  list.querySelectorAll('[data-anim="list-item"]').forEach(row=>row.remove());
  const items=(Array.isArray(orderedItems)?orderedItems:[]).slice(0,5).map(item=>({
    title:String(item?.title||'Item').trim().slice(0,120),
    quantity:Number.isInteger(item?.quantity)&&item.quantity>0?item.quantity:1
  }));
  if(!items.length)return {list,rows:[]};

  const ns='http://www.w3.org/2000/svg',rowHeight=Math.min(46,Math.floor((169-4*(items.length-1))/items.length));
  const gap=4,totalHeight=items.length*rowHeight+(items.length-1)*gap;
  const firstY=80+(169-totalHeight)/2;
  const rows=items.map((item,index)=>{
    const row=svg.ownerDocument.createElementNS(ns,'g');
    row.setAttribute('data-anim','list-item');
    row.style.visibility='visible';
    row.style.opacity='1';
    const content=svg.ownerDocument.createElementNS(ns,'g');
    content.setAttribute('transform',`translate(104.59 ${firstY+index*(rowHeight+gap)})`);
    const depth=svg.ownerDocument.createElementNS(ns,'rect');
    depth.setAttribute('data-item-depth','');depth.setAttribute('x','5');depth.setAttribute('y','5');
    depth.setAttribute('width','185');depth.setAttribute('height',String(rowHeight));depth.setAttribute('rx','5');
    depth.setAttribute('fill','#D4B783');depth.setAttribute('opacity','0');
    content.append(depth);
    const background=svg.ownerDocument.createElementNS(ns,'rect');
    background.setAttribute('data-item-face','front');
    background.setAttribute('x','.7');background.setAttribute('y','.63');background.setAttribute('width','185');
    background.setAttribute('height',String(rowHeight));background.setAttribute('rx','5');background.setAttribute('fill','#F4F6F8');
    content.append(background);

    const fullTitle=svg.ownerDocument.createElementNS(ns,'title');
    fullTitle.textContent=`${item.quantity} × ${item.title}`;
    content.append(fullTitle);
    const title=svg.ownerDocument.createElementNS(ns,'text');
    const fontSize=items.length===5?8:items.length===4?9:10;
    const lines=[];
    let line='';
    for(const word of item.title.split(/\s+/)){
      const candidate=line?`${line} ${word}`:word;
      if(candidate.length>25&&line){lines.push(line);line=word;}else line=candidate;
    }
    if(line)lines.push(line);
    if(lines.length>2){lines.length=2;lines[1]=`${lines[1].slice(0,21).trimEnd()}…`;}
    const titleY=lines.length>1?rowHeight/2-fontSize*.15:rowHeight/2+fontSize*.34;
    title.setAttribute('x','10');title.setAttribute('y',String(titleY));title.setAttribute('fill','#43474b');
    title.setAttribute('font-family','Arial, sans-serif');title.setAttribute('font-size',String(fontSize));
    lines.forEach((lineText,lineIndex)=>{
      const span=svg.ownerDocument.createElementNS(ns,'tspan');
      span.setAttribute('x','10');if(lineIndex)span.setAttribute('dy',String(fontSize+2));
      span.textContent=lineText;title.append(span);
    });
    content.append(title);

    const quantity=svg.ownerDocument.createElementNS(ns,'text');
    quantity.setAttribute('x','175');quantity.setAttribute('y',String(rowHeight/2+fontSize*.34));
    quantity.setAttribute('text-anchor','end');quantity.setAttribute('fill','#43474b');
    quantity.setAttribute('font-family','Arial, sans-serif');quantity.setAttribute('font-size',String(fontSize));
    quantity.setAttribute('font-weight','700');quantity.textContent=`× ${item.quantity}`;
    content.append(quantity);row.append(content);list.append(row);return row;
  });
  return {list,rows};
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

async function animateOutcomeTruck(scene,success,orderedItems=[]){
  const svg=scene.querySelector('#ship-it');
  if(!svg)return;
  if(!reduced()&&!window.gsap){
    const deadline=Date.now()+1000;
    while(!window.gsap&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,50));
  }
  const gsap=window.gsap;
  const {list,rows}=buildPaymentList(svg,orderedItems);
  setPaymentOutcomeBadge(svg,success);
  if(reduced()||!gsap){
    svg?.querySelectorAll('[data-anim]').forEach(element=>element.classList.remove('hidden'));
    if(!rows.length)list?.classList.add('hidden');
    return;
  }

  // The supplied CodePen sequence is scoped to this payment scene and runs once.
  const select=name=>svg.querySelector(`[data-anim="${name}"]`);
  const selectAll=name=>svg.querySelectorAll(`[data-anim="${name}"]`);
  const ripple=select('ripple'),btnBg=select('btn-bg'),btnLabel=select('btn-label'),btnShadow=select('btn-shadow');
  const frontGroup=select('front-group'),frontWheels=selectAll('front-wheel'),frontWheelBack=select('front-wheel-back');
  const backWheels=selectAll('back-wheel'),backWheelsBack=selectAll('back-wheel-back'),containerParts=selectAll('container-part');
  const containerLip=select('container-lip'),container=select('container'),truckBtn=select('truck-btn'),shippedBtn=select('btn-shipped');
  // Keep every step on the same running timeline. Nested paused GSAP timelines
  // remain paused when inserted as children, leaving this scene at its first frame.
  const timeline=gsap.timeline();
  const truckStart=.2;
  const at=seconds=>truckStart+seconds;
  const truckDeparture=at(1.4);
  if(success&&rows.length){
    gsap.set([list,...rows],{autoAlpha:1});
    const rowStart=.95,rowTravel=.48,rowFade=.12;
    timeline.to(list,{y:-10,duration:.3,ease:'power1.inOut'},0)
      .to(list,{y:0,duration:.05,ease:'power1.in'},.3);
    rows.forEach((row,index)=>{
      const rowY=Number(row.querySelector('g')?.getAttribute('transform')?.match(/translate\(\s*[-\d.]+\s+([\d.]+)/)?.[1]||0);
      // Keep the order readable, then drop all rows together into the cargo bed.
      const landingY=[271.5,281.5,278.5][index]??278;
      timeline.fromTo(row,{y:0,autoAlpha:1},{y:landingY-rowY,duration:rowTravel,ease:'power2.in'},rowStart)
        .to(row,{autoAlpha:0,duration:rowFade,ease:'power1.in'},rowStart+rowTravel);
    });
    timeline.to([btnBg,btnLabel],{scaleX:1.05,transformOrigin:'center',duration:.2,ease:'power1.inOut',repeat:1,yoyo:true},rowStart-.08)
      .to([btnBg,btnLabel],{scaleY:.95,duration:.2,ease:'power1.inOut',repeat:1,yoyo:true},rowStart-.08);
  }else if(!success&&rows.length){
    // Keep the failure badge in place while the ordered items drop vertically
    // onto the foreground after the empty truck leaves.
    const fallingLayer=svg.ownerDocument.createElementNS('http://www.w3.org/2000/svg','g');
    fallingLayer.setAttribute('data-anim','fallen-order-layer');
    svg.append(fallingLayer);
    rows.forEach(row=>fallingLayer.append(row));
    const rowStart=truckDeparture+1.75;
    rows.forEach((row,index)=>{
      const rowY=Number(row.querySelector('g')?.getAttribute('transform')?.match(/translate\(\s*[-\d.]+\s+([\d.]+)/)?.[1]||0);
      const rowHeight=Number(row.querySelector('[data-item-face="front"]')?.getAttribute('height')||30);
      const depth=row.querySelector('[data-item-depth]');
      const stackOffset=Math.floor(index/2)*8;
      const landingY=339-rowHeight*.78-stackOffset;
      timeline.set(row,{transformOrigin:'center center'},rowStart+index*.12)
        .to(row,{
          y:landingY-rowY,
          scale:.78,
          duration:.78+Math.min(rowHeight,40)/150,
          ease:'bounce.out'
        },rowStart+index*.12)
        .to(depth,{autoAlpha:1,duration:.18,ease:'power1.out'},rowStart+index*.12+.12);
    });
  }else if(!rows.length)timeline.set(list,{autoAlpha:0},0);

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

  // Slow every beat together so the truck and falling order keep their timing.
  timeline.timeScale(.78);
  return new Promise(resolve=>timeline.eventCallback('onComplete',()=>{
    resolve();
  }));
}

export async function playPaymentOutcome(outcome,{preview=false,message='',items=[]}={}){
  const main=document.getElementById('main');if(!main)return;
  const success=outcome==='success';
  main.innerHTML=`<section class="payment-outcome-scene ${success?'is-success':'is-failure'}" aria-live="polite" aria-label="Payment ${success?'successful':'failed'}"><div class="payment-truck-stage"><div class="payment-road" aria-hidden="true"></div></div><div class="payment-outcome-copy"><h1>${success?'Payment successful':'Payment failed'}</h1><p></p><button type="button" class="button" data-action="payment-preview-return" hidden>Return to checkout</button></div></section>`;
  const scene=main.querySelector('.payment-outcome-scene'),copy=scene.querySelector('.payment-outcome-copy p'),button=scene.querySelector('button');
  try{scene.querySelector('.payment-truck-stage').append(await loadPaymentShippingSvg());}
  catch(error){console.error('Payment animation could not load:',error);}
  button.dataset.preview=String(preview);
  scene.scrollIntoView?.({behavior:reduced()?'auto':'smooth',block:'start'});
  await animateOutcomeTruck(scene,success,items);
  copy.textContent=preview?(success?'Success preview: this is how a verified payment will look. No payment, order or stock reservation was recorded.':'Failure preview: the cart is unchanged and you can retry. No payment, order or stock reservation was recorded.'):success?'Your order is confirmed and will ship via India Post.':message||'Payment failed. This order was cancelled and your cart is saved so you can try again.';
  if(preview||!success){button.hidden=false;await new Promise(resolve=>button.addEventListener('click',resolve,{once:true}));}
  else await new Promise(resolve=>setTimeout(resolve,reduced()?400:1800));
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

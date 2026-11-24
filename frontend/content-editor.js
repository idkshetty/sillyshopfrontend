import {CONTENT_SCHEMA,normalizeContent,validateContent,applyStoreContent,footerMarkup} from './store-content.js';
import {homeMarkup,storyMarkup,infoMarkup,productCardMarkup,artistsPageMarkup,artistDetailMarkup,productDetailPreviewMarkup} from './storefront-view.js';
import {mobileGridBreakpointCss} from './store-settings.js';
import {mergeArtistsWithProducts} from './artists.js';
import {escapeHTML as e,filterProducts} from './commerce.js';
import {isInlineImage} from './image-data.js';
import {mountInlineEditing,readInlinePref,writeInlinePref,inlineToolbarMarkup,inlineHintMarkup,flashControl} from './inline-edit.js';
import {accountMarkup} from './customer-dashboard.js';

export function previewPageOptions(artists=[],products=[]){
  const artistList=mergeArtistsWithProducts(artists,products,{includeHidden:true});
  const base=[
    ['home','Homepage'],
    ['shop','All artworks (Shop)'],
    ['artists','Artists directory'],
    ...artistList.map(a=>[`artist:${a.id}`,`Artist · ${a.name}`]),
    ['product','Artwork detail page'],
    ['checkout','Checkout page'],
    ['account','Sign-in page'],
    ['about','Our story'],
    ['contact','Contact'],
    ['shipping','Shipping'],
    ['refunds','Cancellation & returns'],
    ['privacy','Privacy'],
    ['terms','Terms'],
    ['footer','Footer']
  ];
  return base;
}

export function hashForPreviewPage(page='home',products=[]){
  if(page==='home')return '#home';
  if(page==='shop')return '#shop';
  if(page==='artists')return '#artists';
  if(page==='about')return '#about';
  if(page==='footer')return '#footer';
  if(page==='checkout')return '#checkout';
  if(page==='account')return '#account';
  if(page.startsWith('artist:'))return `#artist/${page.slice(7)}`;
  if(page==='product'||page.startsWith('product:')){
    const explicit=page.startsWith('product:')?page.slice(8):'';
    const firstVisible=(Array.isArray(products)?products:[]).find(p=>p&&p.visible&&!p.archived);
    const id=explicit||firstVisible?.id||'';
    return id?`#product/${id}`:'#shop';
  }
  if(['contact','shipping','refunds','privacy','terms'].includes(page))return `#info/${page}`;
  return '#home';
}

const INFO_PAGES = ['contact', 'shipping', 'refunds', 'privacy', 'terms'];
const footerLinkSelector = n => `#footer .footer-top > div:nth-of-type(${n <= 4 ? 2 : 3}) a:nth-of-type(${((n - 1) % 4) + 1})`;
const T = (key, selector, kinds = null, options = {}) => ({ key, selector, kinds, ...options });

/** Storefront copy that can be edited by clicking it in the live preview (key = content field name). */
export const INLINE_CONTENT_TARGETS = [
  T('brand.name', '.brand-wordmark', null, { required: true }),
  T('brand.logo', '.site-header .brand', null, { type: 'pick' }),
  T('brand.mascot', '.story-symbol > img', ['home', 'about'], { type: 'pick' }),
  T('navigation.home', '.desktop-nav > a[href="#home"]', null, { required: true }),
  T('navigation.shop', '.desktop-nav > a[href="#shop"]', null, { required: true }),
  T('navigation.story', '.desktop-nav > a[href="#about"]', null, { required: true }),
  T('artists.navLabel', '.desktop-nav > a[href="#artists"]', null, { required: true }),
  T('home.eyebrow', '.home-intro .eyebrow', ['home']),
  T('home.heading', '.home-intro h1, .home-intro h2', ['home'], { required: true }),
  T('home.shopTitle', '.page-head h1', ['shop'], { required: true }),
  T('home.shopDescription', '.page-head p:not(.eyebrow)', ['shop']),
  T('home.checkoutTitle', '.checkout-wrap > .page-head h1', ['checkout'], { required: true }),
  T('home.checkoutDescription', '.checkout-wrap > .page-head p:not(.eyebrow)', ['checkout']),
  T('home.relatedTitle', '.related .section-heading > h2', ['product'], { required: true }),
  T('artists.eyebrow', '.artists-page .page-head .eyebrow', ['artists']),
  T('artists.heading', '.artists-page .page-head h1', ['artists'], { required: true }),
  T('artists.description', '.artists-page .page-head p:not(.eyebrow)', ['artists']),
  T('story.pageTitle', '.page-head > h1', ['about'], { required: true }),
  T('story.eyebrow', '.story-copy > .eyebrow', ['home', 'about']),
  T('story.heading', '.story-copy > h2', ['home', 'about'], { required: true }),
  T('story.text1', '.story-copy > p:nth-of-type(2)', ['home', 'about'], { multiline: true }),
  T('story.text2', '.story-copy > p:nth-of-type(3)', ['home', 'about'], { multiline: true }),
  T('story.button', '.story-copy > a .story-cta-label', ['home', 'about'], { required: true }),
  T('story.caption', '.story-symbol > span', ['home', 'about']),
  T('footer.trust1Title', '#footer .footer-trust-item[data-trust-card="1"] strong', null, { required: true }),
  T('footer.trust1Text', '#footer .footer-trust-item[data-trust-card="1"] span'),
  T('footer.trust2Title', '#footer .footer-trust-item[data-trust-card="2"] strong', null, { required: true }),
  T('footer.trust2Text', '#footer .footer-trust-item[data-trust-card="2"] span'),
  T('footer.trust3Title', '#footer .footer-trust-item[data-trust-card="3"] strong', null, { required: true }),
  T('footer.trust3Text', '#footer .footer-trust-item[data-trust-card="3"] span'),
  T('footer.description', '#footer .footer-top > div:first-child p'),
  T('footer.heading1', '#footer .footer-top > div:nth-of-type(2) h3', null, { required: true }),
  T('footer.heading2', '#footer .footer-top > div:nth-of-type(3) h3', null, { required: true }),
  ...Array.from({ length: 8 }, (_, i) => T(`footer.link${i + 1}Label`, footerLinkSelector(i + 1), null, { required: true })),
  T('footer.privacyLabel', '#footer .footer-bottom a[href="#info/privacy"]', null, { required: true }),
  T('footer.termsLabel', '#footer .footer-bottom a[href="#info/terms"]', null, { required: true }),
  T('pages.refundsTitle', '#footer .footer-bottom a[href="#info/refunds"]', null, { required: true }),
  T('footer.locale', '#footer .footer-bottom > div > span'),
  T('footer.copyright', '#footer .footer-bottom > span', null, { type: 'pick' })
];

const gotoTarget = (id, selector, kinds, tab, tabLabel, label) => ({ id: `goto:${id}`, selector, kinds, type: 'goto', tab, tabLabel, label });
/** Areas of the storefront that are edited somewhere other than this editor. */
const GOTO_TARGETS = [
  gotoTarget('announcement', '.announcement', null, 'settings', 'Homepage & banners', 'The announcement bar'),
  gotoTarget('banner', '[data-hero-banner]', ['home'], 'settings', 'Homepage & banners', 'The homepage banner'),
  gotoTarget('promo', '.promo-block', ['home'], 'settings', 'Homepage & banners', 'Promo blocks'),
  gotoTarget('reviews', '.reviews-section, #reviews', ['home'], 'settings', 'Homepage & banners', 'Customer reviews'),
  gotoTarget('artists', '.artist-card, .artist-profile-banner, .artist-custom-sections', ['artists', 'artist'], 'artists', 'Artist pages', 'Artist cards and pages'),
  gotoTarget('products', '.product-card', ['home', 'shop', 'artist'], 'products', 'Your artworks', 'Artwork cards')
];

export function contentInlineTargets(page) {
  const list = [...INLINE_CONTENT_TARGETS];
  if (INFO_PAGES.includes(page)) {
    list.push(T(`pages.${page}Title`, '.info-page h1', ['info'], { required: true }));
    list.push(T(`pages.${page}Body`, '.info-page > p:not(.eyebrow)', ['info'], { type: 'pick' }));
  }
  return [...list, ...GOTO_TARGETS];
}

const KIND_PAGE = { home: 'home', shop: 'shop', artists: 'artists', about: 'about', product: 'product', checkout: 'checkout' };
const HIGHLIGHT_EXTRAS = {
  'brand.pageTitle': { page: null, selector: '.brand-wordmark' },
  'brand.accountLogo': { page: 'account', selector: '.account-welcome-art > img' },
  'brand.showAccountMascot': { page: 'account', selector: '.account-welcome' },
  'navigation.account': { page: null, selector: '.header-actions > a[href="#account"]' },
  'story.button': { page: 'home', selector: '.story-copy > a' },
  'story.destination': { page: 'home', selector: '.story-copy > a' },
  'collections.paintingsImage': { page: 'home', selector: '.home-artworks-section' },
  'collections.clayImage': { page: 'home', selector: '.home-artworks-section' },
  'collections.moldsImage': { page: 'home', selector: '.home-artworks-section' },
  'collections.rocksImage': { page: 'home', selector: '.home-artworks-section' },
  'sections.collections': { page: 'home', selector: '.home-artworks-section' },
  'sections.story': { page: 'home', selector: '.story-block' },
  'sections.footer': { page: null, selector: '#footer' },
  'footer.showTrustStrip': { page: null, selector: '#footer .footer-trust-strip' },
  'footer.trust1Visible': { page: null, selector: '#footer .footer-trust-item[data-trust-card="1"]' },
  'footer.trust2Visible': { page: null, selector: '#footer .footer-trust-item[data-trust-card="2"]' },
  'footer.trust3Visible': { page: null, selector: '#footer .footer-trust-item[data-trust-card="3"]' }
};

/** Where in the preview a content field appears (page = null keeps the current preview page). */
export function highlightForKey(key, page = 'home') {
  if (HIGHLIGHT_EXTRAS[key]) return HIGHLIGHT_EXTRAS[key];
  const link = /^footer\.link(\d)(?:Label|Url)$/.exec(key);
  if (link) return { page: null, selector: footerLinkSelector(Number(link[1])) };
  const hit = contentInlineTargets(page).find(t => t.key === key) || INLINE_CONTENT_TARGETS.find(t => t.key === key);
  if (hit) {
    const here = INFO_PAGES.includes(page) ? 'info' : page;
    const kinds = hit.kinds;
    if (!kinds || kinds.includes(here)) return { page: null, selector: hit.selector };
    return { page: KIND_PAGE[kinds[0]] || null, selector: hit.selector };
  }
  const info = /^pages\.(\w+?)(Title|Body)$/.exec(key);
  if (info && INFO_PAGES.includes(info[1])) return { page: info[1], selector: info[2] === 'Title' ? '.info-page h1' : '.info-page' };
  return null;
}

function resolveHighlightForControl(control, page) {
  if (!control) return null;
  const name = control.getAttribute('name') || control.dataset?.upload || control.dataset?.imageReset || '';
  return name ? highlightForKey(name, page) : null;
}

function checkoutPreviewMarkup(c) {
  return `<div class="checkout-wrap"><div class="page-head"><div class="breadcrumbs"><a href="#home">hehe.cafe</a><span>/</span><a href="#home">Artworks</a><span>/</span><span>Checkout</span></div><h1>${e(c.home.checkoutTitle)}</h1><p>${e(c.home.checkoutDescription)}</p></div><hr class="section-rule rule-terracotta" aria-hidden="true"><div class="checkout-layout"><div class="checkout-form"><section class="checkout-step"><h2>1 · Contact details</h2><p class="small muted">Sample layout. Customers fill in their own details here.</p></section></div></div></div>`;
}

export function editorPreview(content,page,products,settings,header,artists=[]) {
  const c=normalizeContent(content);
  const safeProducts=Array.isArray(products)?products:[];
  let main=homeMarkup(safeProducts,settings,c,{artists}),kind='home';
  if(page==='about'){kind=page;main=`<div class="container"><div class="page-head"><h1>${e(c.story.pageTitle)}</h1></div>${storyMarkup()}</div>`;}
  if(page==='footer'){kind=page;main='';}
  if(page==='checkout'){kind='checkout';main=checkoutPreviewMarkup(c);}
  if(page==='account'){kind='account';main=accountMarkup(null,false,{});}
  if(page==='shop'){kind=page;main=`<div class="container"><div class="page-head"><h1>${e(c.home.shopTitle)}</h1><p>${e(c.home.shopDescription)}</p></div><div class="product-grid">${safeProducts.filter(p=>p.visible&&!p.archived).map(p=>productCardMarkup(p,c)).join('')}</div></div>`;}
  if(page==='artists'){kind='artists';main=artistsPageMarkup(artists,safeProducts,c);}
  if(page&&page.startsWith('artist:')){
    kind='artist';
    const slug=page.slice(7);
    const allArtists=mergeArtistsWithProducts(artists,safeProducts,{includeHidden:true});
    const found=allArtists.find(a=>a.id===slug)||allArtists[0];
    main=found?artistDetailMarkup(found,filterProducts(safeProducts,{artist:found.id,sort:settings?.artworkSort||'manual'}),c,{expanded:true}):artistsPageMarkup(artists,safeProducts,c);
  }
  if(page==='product'||(page&&page.startsWith('product:'))){
    kind='product';
    const pid=page.startsWith('product:')?page.slice(8):'';
    const firstVisible=safeProducts.find(p=>p&&p.visible&&!p.archived);
    const chosen=(pid&&safeProducts.find(p=>p.id===pid))||firstVisible||safeProducts[0]||null;
    const related=chosen?safeProducts.filter(item=>item&&item.id!==chosen.id&&item.visible&&!item.archived).slice(0,3):[];
    main=productDetailPreviewMarkup(chosen,c,related);
  }
  if(['contact','shipping','refunds','privacy','terms'].includes(page)){kind='info';main=infoMarkup(c,page);}
  const bpCss=mobileGridBreakpointCss(settings?.mobileBreakpoint);
  const doc=new DOMParser().parseFromString(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><base href="${e(new URL('./',document.baseURI).href)}"><link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,400&family=JetBrains+Mono:wght@500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">${['shop.css','brand.css','features.css','dashboard.css','animations.css','animation-integration.css','studio-updates.css'].map(css=>`<link rel="stylesheet" href="${css}">`).join('')}<style id="preview-mobile-breakpoint">${bpCss}</style><style>a,button,input,select{pointer-events:none}body{overflow-x:hidden}.site-header{position:relative}.story-copy>p{white-space:pre-line}[data-edit-highlight="true"]{outline:3px solid #d96b43!important;outline-offset:4px!important;box-shadow:0 0 0 5px rgba(217,107,67,.28),0 0 0 2px rgba(255,255,255,.88)!important;animation:edit-pulse 1.5s ease-in-out infinite;scroll-margin-block:80px}@keyframes edit-pulse{0%,100%{box-shadow:0 0 0 4px rgba(217,107,67,.22),0 0 0 2px rgba(255,255,255,.85)}50%{box-shadow:0 0 0 9px rgba(217,107,67,.38),0 0 0 2px rgba(255,255,255,.95)}}</style></head><body data-page="${kind}">${settings.announcementVisible?`<div class="announcement">${e(settings.announcementText)}</div>`:''}${header}<main>${main}</main><footer id="footer" class="site-footer">${footerMarkup(c)}</footer></body></html>`,'text/html');
  applyStoreContent(c,kind,doc);
  doc.querySelectorAll('script,iframe,dialog').forEach(el=>el.remove());
  doc.querySelectorAll('*').forEach(el=>{for(const attribute of [...el.attributes])if(/^on/i.test(attribute.name))el.removeAttribute(attribute.name);});
  return '<!doctype html>'+doc.documentElement.outerHTML;
}

export function mountContentEditor(root,initial,{onPublish,onUpload,products=()=>[],settings=()=>({}),header=()=>'',artists=()=>[],onDraft=()=>{},draft:priorDraft,loadError='',pageOnly=''}) {
  let published=normalizeContent(initial),draft=normalizeContent(priorDraft||initial),busy=false,timer,page=pageOnly||'home',device='desktop',previousPage=pageOnly||'home',lastPreviewHtml='';
  const schema=pageOnly?{pages:{label:CONTENT_SCHEMA.pages.fields[pageOnly+'Title'].value,fields:Object.fromEntries(Object.entries(CONTENT_SCHEMA.pages.fields).filter(([key])=>key===pageOnly+'Title'||key===pageOnly+'Body'))}}:CONTENT_SCHEMA;
  const fieldMarkup=(section,key,f,groupLabel)=>{const id=`content-${section}-${key}`,name=section+'.'+key,v=draft[section][key];
    const searchMeta=e(`${f.label} ${groupLabel} ${section} ${key}`.toLowerCase());
    let inner='';
    if(f.kind==='checkbox')inner=`<label class="visibility-toggle" for="${id}"><input id="${id}" name="${name}" type="checkbox" ${v?'checked':''}>${e(f.label)}</label>`;
    else if(f.kind==='image')inner=`<label class="field" for="${id}">${e(f.label)}<input id="${id}" name="${name}" maxlength="${f.max}" data-saved-image="${isInlineImage(v)}" value="${isInlineImage(v)?'':e(v)}" placeholder="${isInlineImage(v)?'Image selected · paste a URL to replace':'https://… or choose a file below'}"></label><div class="content-image-control"><img data-image-preview="${name}" src="${e(v)}" alt="${e(f.label)} preview"><button type="button" class="text-link" data-image-reset="${name}">Restore default</button></div><label class="content-upload">Choose image<input type="file" data-upload="${name}" accept="image/jpeg,image/png,image/webp"></label>`;
    else inner=`<label class="field" for="${id}">${e(f.label)}${f.kind==='textarea'?`<textarea id="${id}" name="${name}" maxlength="${f.max}" rows="${f.max>500?5:3}">${e(v)}</textarea>`:`<input id="${id}" name="${name}" maxlength="${f.max}" value="${e(v)}">`}</label>`;
    return `<div class="content-field-item" data-search-text="${searchMeta}">${inner}</div>`;
  };
  const options=previewPageOptions(artists(),products());
  const inlineOn=readInlinePref();
  root.innerHTML=`<div class="admin-title"><div><p class="eyebrow">Make it yours</p><h1>${pageOnly?e(CONTENT_SCHEMA.pages.fields[pageOnly+'Title'].value):'Storefront editor'}</h1><p>Edit your pages, navigation and copy, and see every change in real time before publishing.</p></div></div><div class="content-toolbar"><span class="content-save-state" role="status"></span><div><button type="button" class="button outline small" data-content-discard>Discard changes</button><button type="submit" form="content-form" class="button small">Publish changes</button></div></div>${loadError?`<p class="notice" role="alert">${e(loadError)}</p>`:''}<p class="content-message" role="status"></p><div class="content-workspace"><form id="content-form" class="content-form"><div class="content-tip">Search or open any section to edit. Image uploads use JPG, PNG or WebP, up to 6 MB.</div><div class="content-search-wrap"><input type="search" class="content-search-input" data-content-search aria-label="Search editable fields" placeholder="Search headings, navigation, links, policies…"></div>${Object.entries(schema).map(([section,group],i)=>`<details class="content-group" name="content-sections" ${i===0?'open':''} data-section="${section}"><summary>${e(group.label)}<span>${Object.keys(group.fields).length}</span></summary><div class="content-fields">${Object.entries(group.fields).map(([key,f])=>fieldMarkup(section,key,f,group.label)).join('')}</div></details>`).join('')}</form><section class="content-preview" aria-label="Storefront draft preview"><div class="content-preview-toolbar"><label>Preview page<select aria-label="Preview page">${options.map(([id,label])=>`<option value="${e(id)}">${e(label)}</option>`).join('')}</select></label><div class="content-devices-group">${inlineToolbarMarkup(inlineOn)}<div class="content-devices" role="group" aria-label="Preview screen size"><button type="button" data-device="desktop" aria-pressed="true">Desktop</button><button type="button" data-device="mobile" aria-pressed="false">Mobile</button></div><a class="content-preview-open-link button outline small" data-preview-live-link href="${e(hashForPreviewPage(page,products()))}">Open live ↗</a></div></div>${inlineHintMarkup(inlineOn)}<div class="content-preview-stage"><div class="content-preview-frame"><iframe title="Live storefront preview" sandbox="allow-same-origin" tabindex="-1"></iframe></div></div></section></div>`;
  const form=root.querySelector('form'),notice=root.querySelector('.content-message'),state=root.querySelector('.content-save-state'),frame=root.querySelector('iframe'),stage=root.querySelector('.content-preview-stage'),holder=root.querySelector('.content-preview-frame'),liveLink=root.querySelector('[data-preview-live-link]'),searchField=root.querySelector('[data-content-search]');
  let pendingPreview=false,suppressNavUntil=0,commitTimer=null;
  const inlineControl=key=>form.elements.namedItem(key);
  const inlineSchemaField=key=>{const [section,name]=String(key).split('.');return CONTENT_SCHEMA[section]?.fields[name];};
  const inlineDraftValue=key=>{const [section,name]=String(key).split('.');return draft[section]?.[name];};
  function revealField(key,{focus=false}={}){
    const control=inlineControl(key);if(!control)return;
    if(control.closest('.content-field-item')?.hidden&&searchField){searchField.value='';searchField.dispatchEvent(new Event('input',{bubbles:true}));}
    flashControl(control,{focus,onOpen:()=>{suppressNavUntil=Date.now()+600;}});
  }
  function showGoto(target){
    const link=document.createElement('a');link.className='text-link';link.href='#admin/'+target.tab;link.textContent=target.tabLabel;
    notice.classList.remove('is-error');
    notice.replaceChildren(document.createTextNode(target.label+' is edited in '),link,document.createTextNode('. Unpublished changes on this page stay saved as a draft.'));
  }
  const inline=mountInlineEditing({
    frame,enabled:inlineOn,
    getTargets:()=>contentInlineTargets(page).filter(t=>t.tab||inlineControl(t.key)).map(t=>t.tab?t:{...t,id:t.key,max:inlineSchemaField(t.key)?.max,value:t.type==='pick'?undefined:inlineDraftValue(t.key)}),
    onStart:t=>revealField(t.key),
    onInput:(t,text)=>{const control=inlineControl(t.key);if(!control)return;control.value=text;capture();notice.textContent='';status();},
    onCommit:(t,text,info)=>{
      const control=inlineControl(t.key);
      if(control){control.value=text;capture();notice.textContent='';status();}
      clearTimeout(commitTimer);
      if(!info?.switching&&(info?.changed||pendingPreview)){
        commitTimer=setTimeout(()=>{if(!inline.isEditing()){pendingPreview=false;preview();}},40);
      }
    },
    onPick:t=>{if(t.tab){showGoto(t);return;}revealField(t.key,{focus:true});},
    onState:active=>root.classList.toggle('is-inline-editing',active)
  });
  const inlineToggle=root.querySelector('[data-inline-toggle]'),inlineHint=root.querySelector('[data-inline-hint]');
  inlineToggle?.addEventListener('click',()=>{const next=!inline.isEnabled();inline.setEnabled(next);writeInlinePref(next);inlineToggle.classList.toggle('is-on',next);inlineToggle.setAttribute('aria-pressed',String(next));if(inlineHint)inlineHint.hidden=!next;});
  function dirty(){return JSON.stringify(draft)!==JSON.stringify(published);}
  function status(){state.textContent=dirty()?'● Unpublished changes':'✓ All changes published';root.querySelector('[data-content-discard]').disabled=busy||!dirty();root.querySelector('[type="submit"]').disabled=busy||!dirty()||!!loadError;}
  function size(){const width=device==='mobile'?390:1200,scale=Math.min(1,Math.max(240,stage.clientWidth-24)/width);holder.style.width=width+'px';holder.style.height=(600/scale)+'px';holder.style.transform=`scale(${scale})`;stage.style.height='624px';}
  let activeHighlight='';
  let pendingHighlightScroll=false;
  function findHighlightTarget(doc,spec){
    if(!doc||!spec)return null;
    for(const part of String(spec).split('||')){
      const sel=part.trim();if(!sel)continue;
      const el=doc.querySelector(sel);if(el)return el;
    }
    return null;
  }
  function applyEditorHighlight(scroll=false){
    const doc=frame.contentDocument;if(!doc)return;
    doc.querySelectorAll('[data-edit-highlight]').forEach(el=>el.removeAttribute('data-edit-highlight'));
    if(!activeHighlight)return;
    const target=findHighlightTarget(doc,activeHighlight);if(!target)return;
    target.setAttribute('data-edit-highlight','true');
    if(scroll)target.scrollIntoView({behavior:'smooth',block:'center',inline:'nearest'});
  }
  function preview(){
    if(inline.isEditing()){pendingPreview=true;return;}
    if(liveLink)liveLink.setAttribute('href',hashForPreviewPage(page,products()));
    const html=editorPreview(draft,page,products(),settings(),header(),artists());
    if(html!==lastPreviewHtml){
      const scrollTop=page===previousPage?(frame.contentDocument?.documentElement.scrollTop||0):0;
      const activeControl=document.activeElement&&root.contains(document.activeElement)?document.activeElement:null;
      const selStart=activeControl&&'selectionStart'in activeControl?activeControl.selectionStart:null;
      const selEnd=activeControl&&'selectionEnd'in activeControl?activeControl.selectionEnd:null;
      previousPage=page;lastPreviewHtml=html;
      frame.onload=()=>{
        frame.contentWindow?.scrollTo(0,scrollTop);
        applyEditorHighlight(pendingHighlightScroll);
        pendingHighlightScroll=false;
        inline.bind();
        if(activeControl&&activeControl.isConnected&&document.activeElement!==activeControl&&!activeControl.matches?.('iframe')){
          try{
            activeControl.focus({preventScroll:true});
            if(selStart!==null&&selEnd!==null&&typeof activeControl.setSelectionRange==='function'){
              activeControl.setSelectionRange(selStart,selEnd);
            }
          }catch{}
        }
      };
      frame.srcdoc=html;
    }else{
      if(pendingHighlightScroll){applyEditorHighlight(true);pendingHighlightScroll=false;}
      else if(activeHighlight){applyEditorHighlight(false);}
      inline.refresh();
    }
    size();status();
  }
  function capture(){for(const [section,group] of Object.entries(schema))for(const [key,f] of Object.entries(group.fields)){const el=form.elements.namedItem(section+'.'+key);if(!el)continue;if(f.kind==='image'&&el.dataset.savedImage==='true'&&!el.value)continue;draft[section][key]=f.kind==='checkbox'?el.checked:el.value;}onDraft(structuredClone(draft));}
  function restoreFields(){for(const [section,group] of Object.entries(schema))for(const [key,f] of Object.entries(group.fields)){const name=section+'.'+key,el=form.elements.namedItem(name),v=draft[section][key];if(!el)continue;if(f.kind==='checkbox')el.checked=v;else if(f.kind==='image'){el.dataset.savedImage=String(isInlineImage(v));el.value=isInlineImage(v)?'':v;el.placeholder=isInlineImage(v)?'Image selected · paste a URL to replace':'https://… or choose a file below';form.querySelector(`[data-image-preview="${name}"]`).src=v;}else el.value=v;}}
  form.querySelectorAll('[data-image-reset]').forEach(button=>button.addEventListener('click',()=>{const [section,key]=button.dataset.imageReset.split('.');draft[section][key]=CONTENT_SCHEMA[section].fields[key].value;restoreFields();capture();preview();}));
  function changed(event){if(event?.target===searchField)return;capture();notice.textContent='';clearTimeout(timer);timer=setTimeout(preview,180);status();}
  function locked(value){busy=value;form.inert=value;root.querySelectorAll('.content-toolbar button').forEach(el=>el.disabled=value);status();}
  if(searchField){
    searchField.addEventListener('input',()=>{
      const q=searchField.value.trim().toLowerCase();
      form.querySelectorAll('.content-group').forEach(group=>{
        let matches=0;
        group.querySelectorAll('.content-field-item').forEach(item=>{
          const meta=item.dataset.searchText||'';
          const valueText=[...item.querySelectorAll('input,textarea')].map(el=>el.value||'').join(' ').toLowerCase();
          const hit=!q||meta.includes(q)||valueText.includes(q);
          item.hidden=!hit;
          if(hit)matches+=1;
        });
        group.hidden=Boolean(q&&matches===0);
        if(q&&matches>0)group.open=true;
      });
    });
  }
  function highlightControl(control){
    const match=resolveHighlightForControl(control,page);
    if(!match)return;
    activeHighlight=match.selector||'';
    pendingHighlightScroll=true;
    const pageSelect=root.querySelector('[aria-label="Preview page"]');
    if(match.page&&match.page!==page&&pageSelect&&[...pageSelect.options].some(o=>o.value===match.page)){
      page=match.page;pageSelect.value=page;
      preview();
      return;
    }
    applyEditorHighlight(true);
    pendingHighlightScroll=false;
  }
  form.addEventListener('keydown',event=>{
    if(event.target.closest('input,textarea,select')){
      event.stopPropagation();
      if(event.key==='Enter'&&event.target.tagName==='INPUT'&&event.target.type!=='submit'){
        event.preventDefault();
      }
    }
  });
  form.addEventListener('input',changed);
  form.addEventListener('focusin',event=>{const c=event.target.closest('input,textarea,select');if(c)highlightControl(c);});
  form.addEventListener('click',event=>{const c=event.target.closest('input[type=checkbox],input[type=file],button');if(c)highlightControl(c);});
  form.addEventListener('change',async event=>{
    if(event.target===searchField)return;
    const name=event.target.dataset.upload,file=event.target.files?.[0];
    if(!name&&event.target.type==='checkbox'){changed(event);return;}
    if(!name||!file)return;
    locked(true);notice.textContent='Preparing image…';notice.classList.remove('is-error');
    try{const url=await onUpload(file);if(!root.isConnected)return;const [section,key]=name.split('.');draft[section][key]=url;restoreFields();capture();preview();notice.textContent='Image ready in your draft. Publish to show it in the store.';}
    catch(error){notice.textContent=error.message||'The image could not upload. Please try again.';notice.classList.add('is-error');}
    finally{locked(false);event.target.value='';}
  });
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;capture();const invalid=validateContent(draft);notice.classList.toggle('is-error',!!invalid);if(invalid){notice.textContent=invalid;return;}
    locked(true);notice.textContent='Publishing changes…';
    try{await onPublish(structuredClone(draft));published=normalizeContent(draft);onDraft(null);notice.textContent='Published. Your storefront now shows these changes.';}
    catch(error){notice.textContent=error.message||'Publishing failed. Your draft is still here; please try again.';notice.classList.add('is-error');}
    finally{locked(false);}
  });
  root.querySelector('[data-content-discard]').addEventListener('click',()=>{draft=normalizeContent(published);restoreFields();onDraft(null);notice.textContent='Draft discarded. Showing published content.';preview();});
  root.querySelector('[aria-label="Preview page"]').addEventListener('change',event=>{page=event.target.value;preview();});
  root.querySelectorAll('[data-device]').forEach(button=>button.addEventListener('click',()=>{device=button.dataset.device;root.querySelectorAll('[data-device]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));size();}));
  form.querySelectorAll('details').forEach(group=>group.addEventListener('toggle',()=>{if(!group.open||Date.now()<suppressNavUntil)return;const sec=group.dataset.section;if(sec==='brand'||sec==='navigation')return;const nextPage=sec==='footer'?'footer':sec==='story'?'about':sec==='artists'?'artists':sec==='pages'?(pageOnly||'contact'):'home';if(nextPage!==page){page=nextPage;const sel=root.querySelector('[aria-label="Preview page"]');if(sel)sel.value=page;preview();}}));
  root.querySelector('[aria-label="Preview page"]').value=page;
  if(pageOnly){
    const starter=document.createElement('button');starter.type='button';starter.className='text-link';starter.textContent='Load editable starter wording';
    starter.onclick=()=>{for(const key of [pageOnly+'Title',pageOnly+'Body'])draft.pages[key]=CONTENT_SCHEMA.pages.fields[key].value;restoreFields();capture();preview();notice.textContent='Current policy wording loaded. Review details, then publish.';};
    form.prepend(starter);form.querySelector('textarea').rows=16;
  }
  const observer=new ResizeObserver(size);observer.observe(stage);preview();
  return {destroy(){observer.disconnect();clearTimeout(timer);clearTimeout(commitTimer);inline.destroy();},isDirty:dirty,updatePublished(value){const next=normalizeContent(value);const same=JSON.stringify(next)===JSON.stringify(published);const keepDraft=dirty();published=next;if(!keepDraft&&!busy&&!same){draft=normalizeContent(value);restoreFields();preview();}status();}};
}

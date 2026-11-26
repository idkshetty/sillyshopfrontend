import {POLICY_DEFAULTS} from './policy-defaults.js';
import {LEGACY_POLICY_DEFAULTS} from './policy-legacy.js';
import {starterCopy} from './placeholder-copy.js';
import {escapeHTML as e,safeImage} from './commerce.js';
import {MAX_INLINE_IMAGE_LENGTH} from './image-data.js';
const field=(label,value,kind='text',max=120)=>({label,value,kind,max});
const body=(label,value)=>field(label,value,'textarea',25000);
const link=(label,value)=>field(label,value,'link',500);
const picture=(label,value)=>field(label,value,'image',MAX_INLINE_IMAGE_LENGTH);
const toggle=(label,value=true)=>field(label,value,'checkbox');
export const CONTENT_SCHEMA={
  brand:{label:'Branding',fields:{name:field('Store name','hehe.cafe'),pageTitle:field('Browser tab title','hehe.cafe · Art & prints'),logo:picture('Store logo','assets/brand-logo.webp'),mascot:picture('Studio mascot','assets/silly-sensei-loading.webp'),accountLogo:picture('Sign-in page logo','assets/silly-sensei-loading.webp'),showAccountMascot:toggle('Show sign-in page logo')}},
  navigation:{label:'Header & navigation',fields:{home:field('Home link label','Home'),shop:field('Shop link label','All artworks'),story:field('Story link label','About hehe.cafe'),account:field('Account link label','My account')}},
  home:{label:'Homepage & shop headings',fields:{eyebrow:field('Homepage eyebrow','hehe.cafe · artworks'),heading:field('Homepage heading','Artistic clay magnets for some hehe'),shopTitle:field('Shop page heading','Artistic clay magnets for some hehe'),shopDescription:field('Shop page description','Hand-sculpted artistic clay magnets and miniature paintings by Suprita Chatterjee.','textarea',400),checkoutTitle:field('Checkout heading','Checkout'),checkoutDescription:field('Checkout introduction','Complete your delivery details below.','textarea',400),relatedTitle:field('Related products heading','More artworks from hehe.cafe'),searchPlaceholder:field('Search box placeholder (live site only)','Search by artwork name, artist, medium…'),cartTitle:field('Cart drawer heading (live site only)','Your art bag')}},
  artists:{label:'Artists page',fields:{navLabel:field('Artists nav link label','Artists'),eyebrow:field('Artists page eyebrow','hehe.cafe · independent makers'),heading:field('Artists page heading','Meet our artists'),description:field('Artists page intro','Choose an artist to explore their signature style and every handmade piece they’ve crafted for hehe.cafe.','textarea',400)}},
  collections:{label:'Fallback artwork images',fields:{paintingsImage:picture('Fallback image · Paintings (used when an artwork has no photo)','assets/paintings.svg'),clayImage:picture('Fallback image · Clay models','assets/clay-models.svg'),moldsImage:picture('Fallback image · Molds','assets/molds.svg'),rocksImage:picture('Fallback image · Rock paints','assets/rock-paints.svg')}},
  story:{label:'Story & studio section',fields:{pageTitle:field('Our story page heading','About hehe.cafe'),eyebrow:field('Story eyebrow','The space behind the art'),heading:field('Story heading','Welcome to hehe.cafe'),text1:body('Story paragraph one','hehe.cafe is an independent art café and online gallery built around original, human-made artworks. We keep the walls pale and quiet so every brushstroke, glaze and pigment study stands out on its own terms.'),text2:body('Story paragraph two','Every piece lists the artwork name, artist, medium and story upfront — shipped via India Post at ₹40 per item.'),caption:field('Mascot caption','hehe.cafe'),button:field('Story link label','Explore all artworks'),destination:link('Story link destination','#shop')}},
  footer:{label:'Footer',fields:{showTrustStrip:toggle('Show footer highlight strip',true),trust1Visible:toggle('Show highlight card 1',true),trust1Title:field('Highlight 1 heading','Original handmade art','text',120),trust1Text:field('Highlight 1 subtitle','Made by artists · Unique pieces','text',200),trust2Visible:toggle('Show highlight card 2',true),trust2Title:field('Highlight 2 heading','India Post tracked delivery','text',120),trust2Text:field('Highlight 2 subtitle','₹40 per item across India','text',200),trust3Visible:toggle('Show highlight card 3',true),trust3Title:field('Highlight 3 heading','Protected checkout','text',120),trust3Text:field('Highlight 3 subtitle','Verified UPI, cards & netbanking via Razorpay','text',200),description:field('Footer description','hehe.cafe · An independent art gallery & café storefront for original handmade artworks crafted by independent artists.','textarea',500),heading1:field('First column heading','Explore hehe.cafe'),heading2:field('Second column heading','Policies & help'),copyright:field('Copyright line ({year} inserts current year)','© {year} hehe.cafe.','text',300),locale:field('Region & currency label','INR ₹ · India Post'),privacyLabel:field('Privacy link label','Privacy'),termsLabel:field('Terms link label','Terms'),link1Label:field('Link 1 label','Home'),link1Url:link('Link 1 destination','#home'),link2Label:field('Link 2 label','All artworks'),link2Url:link('Link 2 destination','#shop'),link3Label:field('Link 3 label','Meet our artists'),link3Url:link('Link 3 destination','#artists'),link4Label:field('Link 4 label','My account'),link4Url:link('Link 4 destination','#account'),link5Label:field('Link 5 label','Shipping (₹40/item)'),link5Url:link('Link 5 destination','#info/shipping'),link6Label:field('Link 6 label','Cancellation & returns'),link6Url:link('Link 6 destination','#info/refunds'),link7Label:field('Link 7 label','Contact & grievance'),link7Url:link('Link 7 destination','#info/contact'),link8Label:field('Link 8 label','Privacy policy'),link8Url:link('Link 8 destination','#info/privacy')}},
  pages:{label:'Contact & policy pages',fields:Object.fromEntries(Object.entries(POLICY_DEFAULTS).map(([key,value])=>[key,key.endsWith('Body')?body(key.replace('Body','')+' page text',value):field(key.replace('Title','')+' page title',value)]))},
  sections:{label:'Section visibility',fields:{collections:toggle('Show artwork catalogue on homepage'),story:toggle('Show homepage story'),footer:toggle('Show footer')}}
};
export const DEFAULT_CONTENT=Object.fromEntries(Object.entries(CONTENT_SCHEMA).map(([section,group])=>[section,Object.fromEntries(Object.entries(group.fields).map(([key,f])=>[key,f.value]))]));
export function contentCategories(c){return [['paintings','paintings'],['clay-models','clay'],['molds','molds'],['rock-paints','rocks']].map(([id,key])=>({id,image:c.collections[key+'Image']}));}
export function safeContentLink(value){return typeof value==='string'&&(/^(?:#(?:home|shop|artworks|artists|artist\/[a-z0-9-]+|about|account(?:\/(?:requests|profile))?|info\/(?:contact|shipping|refunds|privacy|terms)|collection\/[a-z-]+|product\/[\w-]+)|https:\/\/[^\s<>"']+|mailto:[^\s<>"']+@[^\s<>"']+|tel:\+?[\d -]+)$/.test(value));}
export function normalizeContent(value={}) {
  return Object.fromEntries(Object.entries(CONTENT_SCHEMA).map(([section,group])=>[section,Object.fromEntries(Object.entries(group.fields).map(([key,f])=>{
    let v=starterCopy(value[section]?.[key]);
    if(section==='brand' && key==='accountLogo' && v===undefined)v=starterCopy(value.brand?.mascot);
    if(section==='pages' && key.endsWith('Body') && (v===LEGACY_POLICY_DEFAULTS[key] || v===LEGACY_POLICY_DEFAULTS[key]?.replace(/(?:hello|orders)@hehe\.cafe/gi,'abhishekreddy2499@gmail.com')))v=POLICY_DEFAULTS[key];
    if(f.kind==='image'&&typeof v==='string')v=v.replace(/^assets\/(brand-logo|silly-sensei-loading|loading-doodles)\.png$/, 'assets/$1.webp');
    if(f.kind==='checkbox')return [key,typeof v==='boolean'?v:f.value];
    if(typeof v!=='string')return [key,f.value];
    if(f.kind==='link'&&!safeContentLink(v))return [key,f.value];
    if(f.kind==='image'&&safeImage(v,'')!==v)return [key,f.value];
    return [key,v.slice(0,f.max)];
  }))]));
}
export function validateContent(content){
  for(const [section,group] of Object.entries(CONTENT_SCHEMA))for(const [key,f] of Object.entries(group.fields)){
    const v=content[section]?.[key];
    if(f.kind==='checkbox'){if(typeof v!=='boolean')return `${f.label}: choose a visibility option.`;continue;}
    if(typeof v!=='string'||v.length>f.max)return `${f.label}: use up to ${f.max} characters.`;
    if(f.kind==='link'&&!safeContentLink(v))return `${f.label}: use a store route, HTTPS URL, email or phone link.`;
    if(f.kind==='image'&&(!v||safeImage(v,'')!==v))return `${f.label}: choose an image, an HTTPS image URL or an assets/ path.`;
  }
  return '';
}
export function footerMarkup(c,categoryLinks='') {
  const f=c.footer,links=start=>Array.from({length:4},(_,i)=>{const n=start+i;return `<a href="${e(f[`link${n}Url`])}">${e(f[`link${n}Label`])}</a>`;}).join('');
  const brandName = (!c.brand.name || c.brand.name === 'Silly Sensei') ? 'hehe.cafe' : c.brand.name;
  const hasCustomLogo = c.brand.logo && !/^assets\/brand-logo\.(?:webp|png)$/.test(c.brand.logo);
  const t1 = f.trust1Visible !== false && ((f.trust1Title ?? 'Original handmade art') || (f.trust1Text ?? 'Made by artists · Unique pieces'));
  const t2 = f.trust2Visible !== false && ((f.trust2Title ?? 'India Post tracked delivery') || (f.trust2Text ?? '₹40 per item across India'));
  const t3 = f.trust3Visible !== false && ((f.trust3Title ?? 'Protected checkout') || (f.trust3Text ?? 'Verified UPI, cards & netbanking via Razorpay'));
  const showStrip = f.showTrustStrip !== false && (t1 || t2 || t3);
  return `<div class="container">
    <div class="footer-trust-strip" aria-label="Gallery highlights" ${showStrip ? '' : 'hidden'}>
      <div class="footer-trust-item" data-trust-card="1" ${t1 ? '' : 'hidden'}><strong>${e(f.trust1Title ?? 'Original handmade art')}</strong>${(f.trust1Text ?? 'Made by artists · Unique pieces') ? `<span>${e(f.trust1Text ?? 'Made by artists · Unique pieces')}</span>` : ''}</div>
      <div class="footer-trust-item" data-trust-card="2" ${t2 ? '' : 'hidden'}><strong>${e(f.trust2Title ?? 'India Post tracked delivery')}</strong>${(f.trust2Text ?? '₹40 per item across India') ? `<span>${e(f.trust2Text ?? '₹40 per item across India')}</span>` : ''}</div>
      <div class="footer-trust-item" data-trust-card="3" ${t3 ? '' : 'hidden'}><strong>${e(f.trust3Title ?? 'Protected checkout')}</strong>${(f.trust3Text ?? 'Verified UPI, cards & netbanking via Razorpay') ? `<span>${e(f.trust3Text ?? 'Verified UPI, cards & netbanking via Razorpay')}</span>` : ''}</div>
    </div>
    <div class="footer-top">
      <div class="footer-brand-col">
        <a href="#home" class="brand"><img class="brand-logo" src="${e(c.brand.logo)}" alt="${e(brandName)}" width="48" height="48" ${hasCustomLogo ? '' : 'hidden'}><span class="brand-wordmark">${e(brandName)}</span></a>
        <p>${e(f.description)}</p>
      </div>
      <div class="footer-links"><h3>${e(f.heading1)}</h3>${links(1)}</div>
      <div class="footer-links"><h3>${e(f.heading2)}</h3>${links(5)}</div>
      <div class="footer-links footer-support-col">
        <h3>Support &amp; care</h3>
        <a href="mailto:abhishekreddy2499@gmail.com">abhishekreddy2499@gmail.com</a>
        <a href="tel:+918073263514">+91 8073 263 514</a>
        <span class="footer-support-hours">Mon–Sat · 10 AM – 7 PM IST</span>
        <a href="#info/contact">Grievance &amp; contact →</a>
      </div>
    </div>
    <div class="footer-bottom">
      <span>${e(f.copyright.replaceAll('{year}',String(new Date().getFullYear()))).replace(e(c.brand.name),`<a href="#home" class="footer-brand-link">${e(brandName)}</a>`)}</span>
      <div class="footer-bottom-links"><a href="#info/refunds">${e(c.pages?.refundsTitle||'Cancellation & returns')}</a><a href="#info/privacy">${e(f.privacyLabel)}</a><a href="#info/terms">${e(f.termsLabel)}</a><a href="status.html" target="_blank" rel="noopener">System status</a><span class="footer-locale-pill">${e(f.locale)}</span></div>
    </div>
  </div>`;
}
export function applyStoreContent(c,page,root=document) {
  const set=(selector,text)=>root.querySelectorAll(selector).forEach(el=>{el.textContent=text;});
  const image=(selector,url)=>root.querySelectorAll(selector).forEach(el=>{if(el.getAttribute('src')!==url)el.setAttribute('src',url);});
  const href=(selector,url)=>root.querySelectorAll(selector).forEach(el=>el.setAttribute('href',url));
  const brandName = (!c.brand.name || c.brand.name === 'Silly Sensei') ? 'hehe.cafe' : c.brand.name;
  const hasCustomLogo = c.brand.logo && !/^assets\/brand-logo\.(?:webp|png)$/.test(c.brand.logo);
  image('.brand-logo',c.brand.logo);root.querySelectorAll('.brand-logo').forEach(el=>{el.alt=brandName;el.hidden=!hasCustomLogo;});
  set('.brand-wordmark',brandName);
  image('.story-symbol>img,.dashboard-studio>img',c.brand.mascot);
  image('.account-welcome-art>img',c.brand.accountLogo);
  root.querySelectorAll('.account-welcome-art').forEach(el=>{el.hidden=!c.brand.showAccountMascot;});
  set('.desktop-nav>a[href="#home"]',c.navigation.home);set('.desktop-nav>a[href="#shop"]',c.navigation.shop);set('.desktop-nav>a[href="#artists"]',c.artists.navLabel);set('.desktop-nav>a[href="#about"]',c.navigation.story);
  for(const [route,key] of [['home','home'],['shop','shop'],['about','story'],['account','account']])set(`#mobile-menu>a[href="#${route}"]`,c.navigation[key]);
  set('#mobile-menu>a[href="#artists"]',c.artists.navLabel);
  root.querySelector('.header-actions>a[href="#account"]')?.setAttribute('aria-label',c.navigation.account);
  root.querySelector('.site-header .brand')?.setAttribute('aria-label',brandName+' home');
  set('.home-intro .eyebrow',c.home.eyebrow);set('.home-intro h1,.home-intro h2',c.home.heading);
  if(page==='shop'){set('.page-head h1',c.home.shopTitle);set('.page-head p:not(.eyebrow)',c.home.shopDescription);}
  if(page==='artists'){set('.artists-page .page-head .eyebrow',c.artists.eyebrow);set('.artists-page .page-head h1',c.artists.heading);set('.artists-page .page-head p:not(.eyebrow)',c.artists.description);}
  if(page==='checkout'){set('.checkout-wrap>.page-head h1',c.home.checkoutTitle);set('.checkout-wrap>.page-head p:not(.eyebrow)',c.home.checkoutDescription);}
  set('.related .section-heading>h2',c.home.relatedTitle);set('#cart-title',c.home.cartTitle);const search=root.querySelector('#search-input');if(search)search.placeholder=c.home.searchPlaceholder;
  const homeSearch=root.querySelector('#home-search-input');if(homeSearch)homeSearch.placeholder=c.home.searchPlaceholder;
  set('.story-copy>.eyebrow',c.story.eyebrow);set('.story-copy>h2',c.story.heading);set('.story-copy>p:nth-of-type(2)',c.story.text1);set('.story-copy>p:nth-of-type(3)',c.story.text2);set('.story-symbol>span',c.story.caption);root.querySelectorAll('.story-copy>a').forEach(el=>{const lbl=el.querySelector('.story-cta-label');if(lbl)lbl.textContent=c.story.button;else el.textContent=c.story.button+' →';});href('.story-copy>a',c.story.destination);if(page==='about')set('.page-head>h1',c.story.pageTitle);
  for(const [key,selector] of Object.entries({collections:'.home-artworks-section',story:'.story-block',footer:'#footer'}))root.querySelectorAll(selector).forEach(el=>el.hidden=key==='story'&&page==='about'?false:!c.sections[key]);
  if(root.nodeType===9)root.title=c.brand.pageTitle;
}

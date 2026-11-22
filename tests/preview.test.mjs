import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {DOMParser,parseHTML} from 'linkedom';
import {editorPreview} from '../frontend/content-editor.js';
import {DEFAULT_CONTENT,normalizeContent} from '../frontend/store-content.js';
import {DEFAULT_SETTINGS,normalizeSettings,settingsForm,bannerMarkup} from '../frontend/store-settings.js';
import {normalizeArtist,mergeArtistsWithProducts} from '../frontend/artists.js';
import {accountMarkup} from '../frontend/customer-dashboard.js';
globalThis.DOMParser=DOMParser;
globalThis.document=parseHTML('<html><head><base href="http://localhost:4173/shop.html"></head><body></body></html>').document;
const inline='data:image/webp;base64,AAAA';
test('uploaded collection imagery appears in preview even when the category has products',()=>{
 const content=normalizeContent(DEFAULT_CONTENT);content.collections.paintingsImage=inline;
 const product={id:'p',visible:true,category:'paintings',images:['https://example.com/old.jpg'],price:100,title:'Art',description:'Art',stock:1};
 const html=editorPreview(content,'home',[product],DEFAULT_SETTINGS,'<header class="site-header"><div class="desktop-nav"><button data-action="collections">Collections</button></div></header>');
 const doc=new DOMParser().parseFromString(html,'text/html');assert.equal(doc.querySelector('.collection-image img').src,inline);assert.equal(doc.querySelectorAll('script').length,0);assert(!doc.querySelector('.nav-chevron'));
});
test('every policy preview uses its own editable title and body, safely escaped',()=>{
 for(const page of ['contact','shipping','refunds','privacy','terms']){
  const c=normalizeContent(DEFAULT_CONTENT);c.pages[page+'Title']='Changed '+page;c.pages[page+'Body']='<script>unsafe()</script>\n\nEdited paragraph.';
  const html=editorPreview(c,page,[],DEFAULT_SETTINGS,'');const doc=new DOMParser().parseFromString(html,'text/html');assert.equal(doc.querySelector('h1').textContent,'Changed '+page);assert(!doc.querySelector('script'));assert.match(html,/Edited paragraph/);
 }
});
test('reviews accept bounded uploaded images and render separate upload cards',()=>{
 const settings=normalizeSettings({...DEFAULT_SETTINGS,reviewImages:[inline]});assert.equal(settings.reviewImages[0],inline);
 const doc=new DOMParser().parseFromString(settingsForm(settings),'text/html');assert.equal(doc.querySelectorAll('[data-review-card]').length,7);assert.equal(doc.querySelector('.review-editor-image img').src,inline);assert(!doc.querySelector('textarea[name=reviewImages]'));
});
test('Google button uses the supplied coloured SVG and customer requests expose cancellation',()=>{
 assert.equal(new DOMParser().parseFromString(accountMarkup(null,false),'text/html').querySelectorAll('.google-signin svg path').length,4);
 const request={id:'own-order',customer:{firstName:'Test',lastName:'Buyer',address:'Street',city:'City',state:'State',postalCode:'560001'},items:[{title:'Painting',quantity:1,unitPrice:100}],estimatedSubtotal:100,status:'details_received',paymentStatus:'not_started'};
 const doc=new DOMParser().parseFromString(accountMarkup({uid:'owner',email:'owner@example.com'},false,{tab:'requests',requests:[request]}),'text/html');assert(doc.querySelector('[data-action=cancel-request]'));assert.match(doc.querySelector('.request-detail-grid a').href,/google.com\/maps/);
});
test('homepage banner supports editable eyebrow, headline, subtitle, custom artist credit, button and visibility',()=>{
 const s=normalizeSettings({...DEFAULT_SETTINGS,bannerEyebrow:'Studio pick',bannerTitle:'Custom Head',bannerText:'Custom Sub',bannerShowArtist:true,bannerArtistLabel:'Handmade by Studio',bannerArtistLink:'#artists',bannerButtonVisible:true,bannerButton:'Shop now',bannerLink:'#shop',bannerButtonStyle:'terracotta',bannerButtonPosition:'bottom-right',bannerButtonOffsetX:12,bannerButtonOffsetY:-8});
 const html=bannerMarkup(s,[{id:'p1',title:'Fox',artist:'Suprita',price:200,visible:true,images:['assets/artwork-1.jpg']}]);
 const doc=new DOMParser().parseFromString(html,'text/html');
 assert.equal(doc.querySelector('.hero-banner-eyebrow').textContent,'Studio pick');
 assert.equal(doc.querySelector('.hero-banner-heading').textContent,'Custom Head');
 assert.equal(doc.querySelector('.hero-banner-subtext').textContent,'Custom Sub');
 assert.equal(doc.querySelector('.hero-banner-artist').textContent,'Handmade by Studio');
 assert.equal(doc.querySelector('.hero-banner-artist').getAttribute('href'),'#artists');
 const cta=doc.querySelector('.hero-banner-cta');
 assert.equal(cta.getAttribute('href'),'#shop');
 assert(cta.classList.contains('is-style-terracotta'));
 assert(cta.classList.contains('is-pos-bottom-right'));
 assert.match(cta.getAttribute('style'),/--cta-x:12px;--cta-y:-8px/);
 assert(!new DOMParser().parseFromString(bannerMarkup({...s,bannerButtonVisible:false},[]),'text/html').querySelector('.hero-banner-cta'));
 assert.equal(bannerMarkup({...s,bannerVisible:false},[]),'');
});
test('rich artist pages support custom banners, quotes, sections, hidden filtering and safe previewing',()=>{
 const a1=normalizeArtist({name:'Mira Sen',style:'Ink & Clay',location:'Kolkata',bannerEyebrow:'Guest maker',bannerTitle:'World of Mira',quote:'Made slowly.',accentColor:'#2c6e49',visible:true,sections:[{heading:'Studio note',body:'Fired in small batches.'}],instagram:'@mirasen',website:'https://mira.example.com'});
 const hiddenArtist=normalizeArtist({name:'Secret Artist',style:'Paint',oneLiner:'Hidden',visible:false});
 assert.equal(a1.instagram,'https://instagram.com/mirasen');
 assert.equal(mergeArtistsWithProducts([a1,hiddenArtist],[],{includeHidden:false}).some(a=>a.id==='secret-artist'),false);
 assert.equal(mergeArtistsWithProducts([a1,hiddenArtist],[],{includeHidden:true}).some(a=>a.id==='secret-artist'),true);
 const html=editorPreview(normalizeContent(DEFAULT_CONTENT),'artist:mira-sen',[],DEFAULT_SETTINGS,'',[a1]);
 const doc=new DOMParser().parseFromString(html,'text/html');
 assert.equal(doc.querySelector('h1').textContent,'World of Mira');
 assert.match(doc.querySelector('.artist-quote').textContent,/Made slowly/);
 assert.equal(doc.querySelector('.artist-custom-section-card h2').textContent,'Studio note');
});
test('account profile renders delivery pin map controls and request cards use SVG chevrons',async()=>{
 const {filterCustomerRequests}=await import('../frontend/customer-dashboard.js');
 const profileDoc=new DOMParser().parseFromString(accountMarkup({uid:'u1',email:'u1@example.com'},false,{tab:'profile',profile:{firstName:'Asha'},states:['Karnataka']}),'text/html');
 assert(profileDoc.querySelector('#customer-profile-form .delivery-pin'));
 assert(profileDoc.querySelector('[data-map="device"]'));
 const sampleReq={id:'ord1',customer:{firstName:'A',lastName:'B',address:'1 St',city:'Blr',state:'Karnataka',postalCode:'560001'},items:[{title:'Art Frame',quantity:1,unitPrice:100}],estimatedSubtotal:100,status:'details_received',paymentStatus:'not_started'};
 const deliveredReq={...sampleReq,id:'ord2',status:'delivered',paymentStatus:'captured',items:[{title:'Clay Cat',quantity:1,unitPrice:250}]};
 const reqDoc=new DOMParser().parseFromString(accountMarkup({uid:'u1',email:'u1@example.com'},false,{tab:'requests',requests:[sampleReq,deliveredReq]}),'text/html');
 assert(reqDoc.querySelector('.request-expand svg.ui-chevron'));
 assert.equal(reqDoc.querySelector('.request-expand').textContent.trim(),'');
 assert(reqDoc.querySelector('.order-history-toolbar'));
 assert.equal(reqDoc.querySelectorAll('[data-action="account-order-filter"]').length,4);
 assert(reqDoc.querySelector('#account-order-search'));
 assert.equal(reqDoc.querySelectorAll('.order-history-card:first-of-type [data-action="order-card-tab"]').length,4);
 assert(reqDoc.querySelector('.logoutButton[data-action="signout"]'));
 assert.equal(filterCustomerRequests([sampleReq,deliveredReq],{filter:'delivered'}).length,1);
 assert.equal(filterCustomerRequests([sampleReq,deliveredReq],{filter:'in_progress'}).length,1);
 assert.equal(filterCustomerRequests([sampleReq,deliveredReq],{query:'clay'}).length,1);
});
test('homepage section ordering, custom promo blocks and live editor highlight CSS work',async()=>{
 const {normalizeSettings}=await import('../frontend/store-settings.js');
 const {promoBlockMarkup,homeMarkup}=await import('../frontend/storefront-view.js');
 const {editorPreview}=await import('../frontend/content-editor.js');
 const block={id:'promo-drop',enabled:true,eyebrow:'Drop <1>',heading:'3-Magnet Pack',body:'Save on studio sets',buttonLabel:'Shop sets',buttonLink:'#artworks',theme:'terracotta',align:'center'};
 const settings=normalizeSettings({promoBlocks:[block],homeSectionOrder:['story','promo-drop','artworks','banner','invalid-id']});
 assert.deepEqual(settings.homeSectionOrder,['story','promo-drop','artworks','banner','reviews']);
 const promoHtml=promoBlockMarkup(block);
 assert.match(promoHtml,/is-theme-terracotta/);
 assert.match(promoHtml,/is-align-center/);
 assert.match(promoHtml,/Drop &lt;1&gt;/);
 assert.equal(promoBlockMarkup({...block,enabled:false}),'');
 const html=homeMarkup([],settings);
 assert(html.indexOf('story-block')<html.indexOf('data-promo-block="promo-drop"'));
 assert(html.indexOf('data-promo-block="promo-drop"')<html.indexOf('id="artworks"'));
 assert(html.indexOf('id="artworks"')<html.indexOf('data-hero-banner'));
 const previewHtml=editorPreview({},'home',[],settings,'<header></header>',[]);
 assert.match(previewHtml,/\[data-edit-highlight="true"\]/);
});
test('hamster loader, lanyard artist pass, inline edit normalizers and floating map UI work',async()=>{
 const {hamsterLoaderMarkup}=await import('../frontend/hamster-loader.js');
 const loader=hamsterLoaderMarkup({label:'Saving',caption:'Working…'});
 assert.match(loader,/hehe-wheel-and-hamster/);
 assert(!/credit|uiverse|Nawsome/i.test(loader));
 const {artistsPageMarkup,artistDetailMarkup}=await import('../frontend/storefront-view.js');
 const a1=normalizeArtist({name:'Kavya Rao',style:'Clay',oneLiner:'Tactile pieces.',quote:'Slow work',sections:[{heading:'Notes',body:'Body'}]});
 const a2=normalizeArtist({name:'Meera Nair',style:'Ink',oneLiner:'Bold strokes.'});
 const dirDoc=new DOMParser().parseFromString(artistsPageMarkup([a1,a2],[],DEFAULT_CONTENT),'text/html');
 assert(dirDoc.querySelector('.artist-grid.artist-lanyard-grid'));
 const dirCards=[...dirDoc.querySelectorAll('a.artist-card.artist-lanyard-card')];
 assert.equal(dirCards.length,2);
 for(const card of dirCards){
  assert(card.querySelector('.lanyard-strap'));
  assert(card.querySelector('.artist-lanyard-pass'));
  assert(card.querySelector('h2.artist-lanyard-name'));
  assert(card.querySelector('.artist-style-pill'));
  assert(card.querySelector('.artist-lanyard-mark'));
 }
 const artistHtml=artistDetailMarkup(a1,[],DEFAULT_CONTENT);
 const artistDoc=new DOMParser().parseFromString(artistHtml,'text/html');
 assert(artistDoc.querySelector('.artist-pass-stage.is-expanded'));
 assert(artistDoc.querySelector('.artist-works-reveal.is-expanded'));
 assert(artistDoc.querySelector('.artist-lanyard-pass'));
 assert(!artistDoc.querySelector('.artist-pass-cue'));
 assert(!artistDoc.querySelector('[data-action="toggle-artist-pass"]'));
 assert.equal(artistDoc.querySelector('.artist-lanyard-name').textContent,'Kavya Rao');
 assert.equal(artistDoc.querySelector('.artist-quote-text').textContent,'Slow work');
 assert(artistDoc.querySelector('.artist-custom-section-card[data-artist-sec-idx="0"]'));
 const {liveNormalize,finalNormalize}=await import('../frontend/inline-edit.js');
 assert.equal(liveNormalize({multiline:false,max:10},'Hi\nthere friend'),'Hi there f');
 assert.equal(finalNormalize({multiline:true,max:50},'Line 1  \n\n\n\nLine 2  '),'Line 1\n\nLine 2');
 const {mapPanel}=await import('../frontend/delivery-location.js');
 const mapDoc=new DOMParser().parseFromString(mapPanel(null),'text/html');
 assert(mapDoc.querySelector('[data-map="device"]'));
 assert(mapDoc.querySelector('[data-map="open"]'));
 assert(mapDoc.querySelector('#map-floating-address-text'));
 assert(!mapDoc.querySelector('#delivery-map'));
});
test('closed dialogs and inactive overlays cannot intercept pointer touches',()=>{
 const css=readFileSync(new URL('../frontend/studio-updates.css',import.meta.url),'utf8');
 const logoutCss=readFileSync(new URL('../frontend/logout.css',import.meta.url),'utf8');
 assert.match(css,/dialog:not\(\[open\]\)\{display:none!important;pointer-events:none!important\}/);
 assert(!/#cart-dialog\.cart-drawer\{[^}]*display\s*:\s*flex\b/.test(css));
 assert.match(css,/#cart-dialog\.cart-drawer\[open\]\{display:flex\}/);
 assert.match(css,/\.cart-drawer:not\(\.is-open\),dialog\.map-picker-dialog:not\(\.is-open\),\.saving-overlay:not\(\.is-visible\)\{pointer-events:none\}/);
 assert(!/\.customer-sidebar-bottom\{[^}]*grid-template-columns:\s*1fr auto/.test(css));
 assert.match(logoutCss,/min-width:\s*160px;/);
});

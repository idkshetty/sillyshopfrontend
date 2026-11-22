import {escapeHTML as e,safeImage,money,SHIPPING_CHARGE,artworkColorFor,artworkThemeStyle,contrastColorFor,sortArtworks,filterProducts} from './commerce.js';
import {artistSlug,mergeArtistsWithProducts} from './artists.js';
import {contentCategories,DEFAULT_CONTENT} from './store-content.js';
import {bannerMarkup,FALLBACK_BANNER_ARTWORKS,DEFAULT_HOME_SECTIONS,safeStoreLink} from './store-settings.js';
import {reviewSection} from './shop-effects.js';
import {skeletonMarkup} from './skeletons.js';

export function storyMarkup(){
  return `<section class="story-block">
    <div class="story-symbol">
      <img src="assets/silly-sensei-loading.webp" alt="hehe.cafe studio emblem" loading="lazy" decoding="async">
      <span>hehe.cafe</span>
    </div>
    <div class="story-copy">
      <p class="eyebrow">The space behind the art</p>
      <h2>Welcome to hehe.cafe</h2>
      <p>hehe.cafe is an independent art café and online gallery built around original, human-made artworks. We keep the walls pale and quiet so every brushstroke, clay frame and pigment study stands out on its own terms.</p>
      <p>Every piece lists the artwork name, artist, medium and story upfront — shipped via India Post for ₹${SHIPPING_CHARGE}.</p>
      <a class="text-link" href="#shop"><span class="story-cta-label">Explore all artworks</span> <span aria-hidden="true">→</span></a>
    </div>
  </section>`;
}

export function productCardMarkup(p,content=DEFAULT_CONTENT){
  const CATEGORIES=contentCategories(content);
  const categoryOf=id=>CATEGORIES.find(c=>c.id===id);
  const imageOf=item=>safeImage(item.images?.[0],categoryOf(item.category)?.image || 'assets/artwork-1.jpg');
  const artist=p.artist||'Suprita Chatterjee';
  const slug=artistSlug(artist);
  const productType=p.productType||'Fridge Magnet';
  const desc=(p.description||'Original handmade artwork from hehe.cafe.').trim();
  const specs=[p.material,p.dimensions].filter(Boolean).join(' · ');
  const themeStyle=artworkThemeStyle(p);
  const bgColor=artworkColorFor(p);
  const soldOut=p.stock<1;
  return `<article class="product-card ${soldOut?'is-sold-out-card':''}" data-product-card data-product-id="${e(p.id)}" data-bg-color="${e(bgColor)}" style="${themeStyle}">
    <a class="product-card-image" href="#product/${e(p.id)}">
      <div class="artwork-mat-frame">
        <img src="${e(imageOf(p))}" alt="${e(p.title)} by ${e(artist)}" loading="lazy" decoding="async" data-artwork-img>
      </div>
      ${!soldOut&&p.tag?`<span class="badge unique-badge">${e(p.tag)}</span>`:''}
    </a>
    <div class="product-card-body">
      <div class="product-card-meta-top">
        <p class="artwork-artist">Artist · <a class="artist-link" href="#artist/${e(slug)}">${e(artist)}</a></p>
        <span class="artwork-type-pill">${e(productType)}</span>
      </div>
      <h2><a href="#product/${e(p.id)}">${e(p.title)}</a></h2>
      ${soldOut?'<span class="card-sold-out-pill">Sold out</span>':''}
      <p class="artwork-card-description">${e(desc)}</p>
      ${specs?`<p class="artwork-card-specs">${e(specs)}</p>`:''}
      <div class="product-card-price-row">
        <p class="price">${money(p.price)}${p.comparePrice>p.price?` <del>${money(p.comparePrice)}</del>`:''}</p>
        <span class="shipping-tag">+ ₹${SHIPPING_CHARGE} shipping</span>
      </div>
      <div class="product-card-actions ${soldOut?'is-sold-out-actions':''}">
        ${soldOut
          ? `<button type="button" class="button artwork-cart-btn is-sold-out" disabled>Sold out</button>`
          : `<button class="button artwork-cart-btn" data-action="add" data-id="${e(p.id)}" data-artwork-btn style="${themeStyle}">Add to cart</button>
             <button type="button" class="quick-buy-btn" data-action="quick-buy" data-id="${e(p.id)}" title="Buy now with ₹${SHIPPING_CHARGE} flat shipping">Buy now →</button>`}
      </div>
    </div>
  </article>`;
}

export function homeFilterPanelMarkup(products,filter={}){
  const types=[...new Set((Array.isArray(products)?products:[]).filter(p=>p&&p.visible&&!p.archived).map(p=>(p.productType||'Fridge Magnet').trim()).filter(Boolean))];
  const sortOptions=[
    ['','Studio order'],
    ['title-asc','Alphabetical (A → Z)'],
    ['title-desc','Alphabetical (Z → A)'],
    ['newest','Latest artworks'],
    ['price-asc','Price (low → high)'],
    ['price-desc','Price (high → low)']
  ];
  const currentSort=filter.sort||'';
  const activeCount=Number(Boolean(currentSort))+Number(Boolean(filter.discounted))+Number(Boolean(filter.available))+Number(Boolean(filter.productType));
  return `<div class="home-filter-wrap">
    <button type="button" class="home-filter-btn ${activeCount?'has-active':''}" data-action="toggle-filter-menu" aria-expanded="false" aria-controls="home-filter-panel">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M7 12h10M10 18h4"/></svg>
      <span>Filter</span>
      ${activeCount?`<span class="filter-count-dot">${activeCount}</span>`:''}
    </button>
    <div id="home-filter-panel" class="home-filter-panel" hidden>
      <div class="filter-panel-group">
        <p class="filter-panel-label">Sort artworks</p>
        <div class="filter-chip-row">
          ${sortOptions.map(([val,label])=>`<button type="button" class="filter-chip ${currentSort===val?'is-active':''}" data-action="set-filter-sort" data-sort="${e(val)}">${e(label)}</button>`).join('')}
        </div>
      </div>
      <div class="filter-panel-group">
        <p class="filter-panel-label">Show</p>
        <div class="filter-chip-row">
          <button type="button" class="filter-chip ${filter.discounted?'is-active':''}" data-action="toggle-filter-discounted">Discounted items</button>
          <button type="button" class="filter-chip ${filter.available?'is-active':''}" data-action="toggle-filter-available">In stock only</button>
        </div>
      </div>
      ${types.length>1?`<div class="filter-panel-group">
        <p class="filter-panel-label">Category</p>
        <div class="filter-chip-row">
          <button type="button" class="filter-chip ${!filter.productType?'is-active':''}" data-action="set-filter-type" data-type="">All types</button>
          ${types.map(t=>`<button type="button" class="filter-chip ${filter.productType===t?'is-active':''}" data-action="set-filter-type" data-type="${e(t)}">${e(t)}</button>`).join('')}
        </div>
      </div>`:''}
      <div class="filter-panel-group filter-panel-footer">
        <a class="filter-artist-cta" href="#artists">Filter by artist →</a>
        ${activeCount?`<button type="button" class="text-link" data-action="reset-filters">Reset all</button>`:''}
      </div>
    </div>
  </div>`;
}

export function promoBlockMarkup(block){
  if(!block||block.enabled===false)return '';
  const hasCopy=Boolean(block.eyebrow||block.heading||block.body||block.buttonLabel||block.image);
  if(!hasCopy)return '';
  const theme=block.theme||'warm-paper';
  const align=block.align==='center'?'center':'left';
  const img=block.image?safeImage(block.image,''):'';
  const link=safeStoreLink(block.buttonLink||'#shop');
  return `<section class="promo-block is-theme-${e(theme)} is-align-${e(align)} ${img?'has-image':''}" data-promo-block="${e(block.id)}">
    <div class="promo-block-copy">
      ${block.eyebrow?`<p class="eyebrow">${e(block.eyebrow)}</p>`:''}
      ${block.heading?`<h2>${e(block.heading)}</h2>`:''}
      ${block.body?`<p class="promo-block-body">${e(block.body)}</p>`:''}
      ${block.buttonLabel?`<a class="button promo-block-cta" href="${e(link)}"><span class="promo-cta-label">${e(block.buttonLabel)}</span> <span aria-hidden="true">→</span></a>`:''}
    </div>
    ${img?`<div class="promo-block-media"><img src="${e(img)}" alt="${e(block.heading||'Studio promotion')}" loading="lazy" decoding="async"></div>`:''}
  </section>`;
}

export function homeMarkup(products,storeSettings,content=DEFAULT_CONTENT,{catalogLoading=false,catalogError='',filter={sort:'',available:false,discounted:false,productType:'',search:''},artists=[]}={}){
  const sortMode=filter?.sort||storeSettings?.artworkSort||'manual';
  const CATEGORIES=contentCategories(content);
  const allVisible=filterProducts(products,{sort:sortMode,available:Boolean(filter?.available),discounted:Boolean(filter?.discounted),productType:filter?.productType||'',search:filter?.search||''});
  const hasFilter=Boolean(filter?.sort||filter?.available||filter?.discounted||filter?.productType||filter?.search);
  const hiddenCompat=`<div class="collection-image" hidden aria-hidden="true"><img src="${e(CATEGORIES[0]?.image||'assets/paintings.svg')}" alt=""></div>`;
  const bannerHtml=bannerMarkup(storeSettings,sortArtworks(products.filter(p=>p.visible&&!p.archived),storeSettings?.artworkSort||'manual'));
  const artworksHtml=`<section id="artworks" class="home-artworks-section" aria-labelledby="home-artworks-heading">
      <div class="home-intro home-intro-row">
        <div>
          <p class="eyebrow">${e(content?.home?.eyebrow||'hehe.cafe · artworks')}</p>
          <h2 id="home-artworks-heading">${e(content?.home?.heading||'Artistic clay magnets for some hehe')}</h2>
        </div>
        ${homeFilterPanelMarkup(products,filter)}
      </div>
      <div id="product-results">
        ${catalogLoading?skeletonMarkup('products','Loading artworks…'):catalogError&&!allVisible.length?`<div class="empty-state" role="alert"><h2>Artworks could not load</h2><p>Check your connection and try again.</p><button class="button outline" data-action="retry">Try again</button></div>`:allVisible.length?`<div class="product-grid">${allVisible.map(p=>productCardMarkup(p,content)).join('')}</div>`:hasFilter?`<div class="empty-state"><h2>No matching artworks</h2><p>No pieces match those filters yet.</p><button type="button" class="button outline" data-action="reset-filters">Show all artworks</button></div>`:`<div class="product-grid">${FALLBACK_BANNER_ARTWORKS.map(item=>productCardMarkup(item,content)).join('')}</div>`}
      </div>
    </section>`;
  const storyHtml=storeSettings?.storyVisible===false?'':storyMarkup();
  const reviewsHtml=storeSettings.reviewsVisible?reviewSection(storeSettings.reviewImages):'';
  const promoMap=new Map((Array.isArray(storeSettings?.promoBlocks)?storeSettings.promoBlocks:[]).map(b=>[b.id,promoBlockMarkup(b)]));
  const sectionOrder=Array.isArray(storeSettings?.homeSectionOrder)&&storeSettings.homeSectionOrder.length?storeSettings.homeSectionOrder:DEFAULT_HOME_SECTIONS;
  const parts=[];
  const seen=new Set();
  for(const id of [...sectionOrder,...DEFAULT_HOME_SECTIONS,...promoMap.keys()]){
    if(seen.has(id))continue;
    seen.add(id);
    const markup=id==='banner'?bannerHtml:id==='artworks'?artworksHtml:id==='story'?storyHtml:id==='reviews'?reviewsHtml:(promoMap.get(id)||'');
    if(markup)parts.push({id,markup});
  }
  const rules=['rule-terracotta','rule-sage','rule-rose'];
  const joined=parts.map((part,idx)=>idx===0?part.markup:`<hr class="section-rule ${rules[(idx-1)%rules.length]}" aria-hidden="true">\n${part.markup}`).join('\n');
  return `<div class="container">
    ${hiddenCompat}
    ${joined}
  </div>`;
}

export function artistsPageMarkup(artists=[],products=[],content=DEFAULT_CONTENT){
  const list=mergeArtistsWithProducts(artists,products,{includeHidden:false});
  const ac=content?.artists||{};
  return `<div class="container artists-page">
    <div class="page-head">
      <div class="breadcrumbs"><a href="#home">hehe.cafe</a><span>/</span><span>${e(ac.navLabel||'Artists')}</span></div>
      <p class="eyebrow">${e(ac.eyebrow||'hehe.cafe · independent makers')}</p>
      <h1>${e(ac.heading||'Meet our artists')}</h1>
      <p>${e(ac.description||'Choose an artist to explore their signature style and every handmade piece they’ve crafted for hehe.cafe.')}</p>
    </div>
    <hr class="section-rule rule-terracotta" aria-hidden="true">
    <div class="artist-grid artist-lanyard-grid">
      ${list.map(a=>`<a class="artist-card artist-lanyard-card ${a.featured?'is-featured-artist':''}" href="#artist/${e(a.id)}" data-artist-id="${e(a.id)}" ${a.accentColor?`style="--artist-accent:${e(a.accentColor)}"`:''}>
        <div class="lanyard-strap" aria-hidden="true"><span class="lanyard-grommet"></span></div>
        <div class="artist-lanyard-pass">
          <span class="lanyard-slot" aria-hidden="true"></span>
          ${a.featured?'<span class="artist-featured-badge">Featured</span>':''}
          <div class="artist-lanyard-photo"><img src="${e(safeImage(a.coverImage,'assets/artwork-1.jpg'))}" alt="${e(a.name)}" loading="lazy" decoding="async"></div>
          <div class="artist-lanyard-overlay">
            <div class="artist-lanyard-id">
              <h2 class="artist-lanyard-name">${e(a.name)}</h2>
              <span class="artist-style-pill artist-lanyard-role">${e(a.style||'Independent Studio Artist')}</span>
              ${a.location?`<span class="artist-location-pill artist-lanyard-loc">${e(a.location)}</span>`:''}
              ${a.oneLiner?`<p class="artist-oneliner artist-lanyard-oneliner">${e(a.oneLiner)}</p>`:''}
            </div>
            <div class="artist-lanyard-meta-col">
              <span class="artist-lanyard-mark">hehe.cafe</span>
              <span class="artist-lanyard-count">${a.artworkCount} ${a.artworkCount===1?'piece':'pieces'}</span>
            </div>
          </div>
        </div>
      </a>`).join('')}
    </div>
  </div>`;
}

export function artistDetailMarkup(artist,artistProducts=[],content=DEFAULT_CONTENT){
  const photo=safeImage(artist.coverImage||artist.photo,'assets/artwork-1.jpg');
  const bannerImg=artist.bannerImage?safeImage(artist.bannerImage,''):'';
  const count=artistProducts.length;
  const heading=artist.bannerTitle||artist.name;
  const sections=Array.isArray(artist.sections)?artist.sections.filter(s=>s&&(s.heading||s.body)):[];
  const accentStyle=artist.accentColor?`style="--artist-accent:${e(artist.accentColor)}"`:'';
  return `<div class="container artist-detail-page" ${accentStyle}>
    <div class="breadcrumbs" style="padding-top:24px;margin-bottom:18px"><a href="#home">hehe.cafe</a><span>/</span><a href="#artists">${e(content?.artists?.navLabel||'Artists')}</a><span>/</span><span>${e(artist.name)}</span></div>
    <section class="artist-pass-stage is-expanded" data-artist-pass-stage>
      <div class="artist-lanyard-wrap">
        <div class="lanyard-strap" aria-hidden="true"><span class="lanyard-grommet"></span></div>
        <div class="artist-lanyard-pass">
          <span class="lanyard-slot" aria-hidden="true"></span>
          <div class="artist-lanyard-photo"><img src="${e(photo)}" alt="${e(artist.name)}"></div>
          <div class="artist-lanyard-overlay">
            <div class="artist-lanyard-id">
              <span class="artist-lanyard-name">${e(artist.name)}</span>
              <span class="artist-lanyard-role">${e(artist.style||'Independent Studio Artist')}</span>
            </div>
            <span class="artist-lanyard-mark">hehe.cafe</span>
          </div>
        </div>
      </div>
      <div class="artist-pass-details">
        <section class="artist-profile-banner ${bannerImg?'has-cover-backdrop':''}">
          ${bannerImg?`<div class="artist-banner-backdrop" aria-hidden="true"><img src="${e(bannerImg)}" alt=""></div>`:''}
          <div class="artist-banner-copy">
            ${artist.bannerEyebrow?`<p class="eyebrow artist-banner-eyebrow">${e(artist.bannerEyebrow)}</p>`:''}
            <div class="artist-card-pills">
              <span class="artist-style-pill">${e(artist.style||'Independent Studio Artist')}</span>
              ${artist.location?`<span class="artist-location-pill">${e(artist.location)}</span>`:''}
            </div>
            <h1>${e(heading)}</h1>
            ${artist.bannerTitle&&artist.bannerTitle!==artist.name?`<p class="artist-byline">${e(artist.name)}</p>`:''}
            <p class="artist-banner-about">${e(artist.about||artist.oneLiner||`Original handmade artworks by ${artist.name}.`)}</p>
            ${artist.quote?`<blockquote class="artist-quote">“<span class="artist-quote-text">${e(artist.quote)}</span>”</blockquote>`:''}
            <div class="artist-banner-meta">
              <span>${count} ${count===1?'artwork':'artworks'} on hehe.cafe</span>
              ${artist.instagram?`<a class="text-link" href="${e(artist.instagram)}" target="_blank" rel="noopener">Instagram ↗</a>`:''}
              ${artist.website?`<a class="text-link" href="${e(artist.website)}" target="_blank" rel="noopener">Website ↗</a>`:''}
              <a class="text-link" href="#artists">← All artists</a>
            </div>
          </div>
        </section>
        ${sections.length?`<section class="artist-custom-sections">${sections.map((sec,idx)=>`<article class="artist-custom-section-card" data-artist-sec-idx="${idx}">${sec.heading?`<h2>${e(sec.heading)}</h2>`:''}${sec.body?`<p>${e(sec.body)}</p>`:''}</article>`).join('')}</section>`:''}
      </div>
    </section>
    <div class="artist-works-reveal is-expanded" data-artist-works-reveal>
      <hr class="section-rule rule-terracotta" aria-hidden="true">
      <section class="artist-works-section">
        <div class="section-heading">
          <h2>${e(artist.worksHeading||`Artworks by ${artist.name}`)}</h2>
          <a href="#home" class="text-link">All artworks →</a>
        </div>
        ${count?`<div class="product-grid">${artistProducts.map(p=>productCardMarkup(p,content)).join('')}</div>`:`<div class="empty-state"><h2>No published pieces yet</h2><p>Check back soon for new works by ${e(artist.name)}.</p><a class="button outline" href="#artists">Browse other artists</a></div>`}
      </section>
    </div>
  </div>`;
}

export function productDetailPreviewMarkup(p,content=DEFAULT_CONTENT,related=[]){
  if(!p)return '<div class="container empty-state"><h2>No published artwork to preview</h2><p>Publish an artwork to preview its detail page.</p></div>';
  const artist=p.artist||'Suprita Chatterjee';
  const img=safeImage(p.images?.[0],'assets/artwork-1.jpg');
  const productType=p.productType||'Fridge Magnet';
  const bgColor=artworkColorFor(p);
  const inkColor=contrastColorFor(bgColor);
  const themeStyle=artworkThemeStyle(p);
  return `<div class="product-immersive-page" style="${themeStyle};--art-accent:${e(bgColor)};--art-ink:${e(inkColor)}">
    <div class="product-immersive-hero"><div class="container product-preview-page">
      <div class="product-topbar">
        <a href="#shop" class="product-float-btn" aria-label="Back"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg></a>
        <span class="product-topbar-title">${e(p.title)}</span>
        <span class="product-float-btn" aria-hidden="true"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg></span>
      </div>
      <div class="product-immersive-grid">
        <div class="product-stage-column">
          <div class="product-blended-stage"><img src="${e(img)}" alt="${e(p.title)}"></div>
          <div class="product-gallery-dots" aria-hidden="true"><span class="is-active"></span>${(p.images||[]).slice(1).map(()=>'<span></span>').join('')}</div>
        </div>
        <div class="product-detail-panel">
          <div class="product-title-row">
            <h1>${e(p.title)}</h1>
            <span class="artwork-type-pill">${e(p.dimensions||productType)}</span>
          </div>
          <p class="detail-artist-line">by ${e(artist)} · ${e(productType)}</p>
          <div class="product-tabs" role="tablist"><button type="button" class="product-tab is-active">Description</button><button type="button" class="product-tab">Details</button><button type="button" class="product-tab">Care &amp; Framing</button></div>
          <p class="description">${e(p.description||'An original piece created at hehe.cafe.')}</p>
          <div class="product-purchase-bar">
            <div class="product-purchase-price"><small>Price</small><strong>${money(p.price)}</strong></div>
            <button type="button" class="product-cart-pill">Add to Cart</button>
          </div>
        </div>
      </div>
    </div></div>
    ${related.length?`<div class="product-related-band"><div class="container"><hr class="section-rule rule-terracotta" aria-hidden="true"><section class="related"><div class="section-heading"><h2>${e(content?.home?.relatedTitle||'More artworks from hehe.cafe')}</h2><a href="#home" class="text-link">View all artworks →</a></div><div class="product-grid">${related.map(item=>productCardMarkup(item,content)).join('')}</div></section></div></div>`:''}
  </div>`;
}

export function infoMarkup(content,id){
  if(!['contact','shipping','refunds','privacy','terms'].includes(id))return '';
  const title=content.pages[id+'Title'];
  const brandName = (!content.brand.name || content.brand.name === 'Silly Sensei') ? 'hehe.cafe' : content.brand.name;
  return `<div class="container"><article class="info-page"><div class="breadcrumbs"><a href="#home">Home</a><span>/</span><span>${e(title)}</span></div><p class="eyebrow">${e(brandName)} / Good to know</p><h1>${e(title)}</h1>${content.pages[id+'Body'].split(/\n\s*\n/).map(p=>`<p style="white-space:pre-line">${e(p)}</p>`).join('')}${id==='privacy'?'<section class="map-privacy"><h2>Delivery maps and location</h2><p>Address search sends your location query to Photon. Esri World Imagery and OpenStreetMap receive requests for the map area you view. Your name, email address and phone number are not included in these map requests. These providers also receive ordinary connection information, such as your IP address.</p><p>Device location is requested only when you choose Use my location. Your confirmed pin is saved with your order and may appear on a delivery label. Delivery links and label QR codes open Google Maps.</p><h3>Using the delivery map</h3><p>Hover over the map and scroll with your mouse wheel or trackpad to zoom. On touchscreens, pinch with two fingers. Tap the map or drag the pin to your entrance, then confirm it. Keyboard users can focus the map, pan with arrow keys, and choose Pin map centre.</p></section>':''}<a class="text-link" href="#home">Back to hehe.cafe →</a></article></div>`;
}

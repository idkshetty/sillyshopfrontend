import {reviewCards} from './review-editor.js';
import {starterCopy} from './placeholder-copy.js';
import {isInlineImage,validImageSource,encodeImage} from './image-data.js';
import {escapeHTML as e, safeImage, artworkColorFor, artworkThemeStyle, sortArtworks, ARTWORK_SORT_MODES, money} from './commerce.js';
import {artistSlug} from './artists.js';

export const BANNER_CTA_POSITIONS = [
  ['below-text', 'Below banner text'],
  ['bottom-left', 'Bottom left'],
  ['bottom-center', 'Bottom center'],
  ['bottom-right', 'Bottom right'],
  ['top-left', 'Top left'],
  ['top-right', 'Top right']
];

export const BANNER_CTA_STYLES = [
  ['light', 'Light pill'],
  ['dark', 'Black pill'],
  ['outline', 'Glass outline'],
  ['terracotta', 'Terracotta']
];

export const DEFAULT_HOME_SECTIONS = ['banner', 'artworks', 'story', 'reviews'];

export const PROMO_THEMES = [
  ['warm-paper', 'Warm paper'],
  ['terracotta', 'Studio terracotta'],
  ['forest', 'Forest sage'],
  ['ink-dark', 'Gallery black']
];

export const DEFAULT_SETTINGS = {
  announcementVisible: false,
  announcementText: 'welcome to hehe.cafe · handmade clay frames & paintings · ₹40 India Post shipping',
  announcementLink: '#home',
  bannerVisible: true,
  bannerEyebrow: '',
  bannerTitle: 'hehe.cafe',
  bannerText: 'Artistic clay magnets for some hehe',
  bannerShowArtist: true,
  bannerArtistLabel: '',
  bannerArtistLink: '',
  bannerButtonVisible: true,
  bannerButton: '',
  bannerLink: '#artworks',
  bannerButtonStyle: 'light',
  bannerButtonPosition: 'below-text',
  bannerButtonOffsetX: 0,
  bannerButtonOffsetY: 0,
  bannerImage: 'assets/artwork-1.jpg',
  homeSectionOrder: [...DEFAULT_HOME_SECTIONS],
  promoBlocks: [],
  reviewsVisible: false,
  reviewImages: [],
  artworkSort: 'manual',
  cartButtonMode: 'black',
  bannerLimit: 8,
  aboutVisible: false,
  storyVisible: true
};

export const FALLBACK_BANNER_ARTWORKS = [
  {
    id: 'hehe-art-1',
    refNumber: '610001',
    title: 'Two Cats in a Meadow Frame',
    artist: 'Suprita Chatterjee',
    productType: 'Fridge Magnet',
    description: 'Two sleepy cats curled together in watercolour and ink, set inside a hand-sculpted moss green clay frame with yellow blossoms.',
    price: 250,
    stock: 1,
    tag: '',
    featured: true,
    images: ['assets/artwork-1.jpg'],
    bgColor: '#3b5d20',
    material: 'Hand-sculpted clay frame & watercolour on paper',
    dimensions: '6 × 5.5 in'
  },
  {
    id: 'hehe-art-2',
    refNumber: '610002',
    title: 'Little Snail in Striped Clay',
    artist: 'Suprita Chatterjee',
    productType: 'Fridge Magnet',
    description: 'A curious yellow snail with a textured ochre shell, framed in hand-painted cobalt and lime stripes on sculpted clay.',
    price: 250,
    stock: 1,
    tag: '',
    featured: false,
    images: ['assets/artwork-2.jpg'],
    bgColor: '#587920',
    material: 'Hand-sculpted clay frame & watercolour ink',
    dimensions: '6.5 × 5.5 in'
  },
  {
    id: 'hehe-art-3',
    refNumber: '610003',
    title: 'Starstruck Puppy in Polka Frame',
    artist: 'Suprita Chatterjee',
    productType: 'Fridge Magnet',
    description: 'Wide-eyed golden pup gazing at a little spark, housed in a cobalt blue clay frame dotted with bright yellow paint.',
    price: 250,
    stock: 1,
    tag: '',
    featured: true,
    images: ['assets/artwork-3.jpg'],
    bgColor: '#245a9f',
    material: 'Hand-sculpted clay frame & watercolour on paper',
    dimensions: '6 × 6.5 in'
  },
  {
    id: 'hehe-art-4',
    refNumber: '610004',
    title: 'Teary-Eyed Pup in Royal Polka',
    artist: 'Suprita Chatterjee',
    productType: 'Fridge Magnet',
    description: 'Soft ginger puppy portrait with dewy eyes, nestled inside an organic horizontal royal-blue clay frame with sunny yellow dots.',
    price: 250,
    stock: 1,
    tag: '',
    featured: false,
    images: ['assets/artwork-4.jpg'],
    bgColor: '#2245a7',
    material: 'Hand-sculpted clay frame & watercolour ink',
    dimensions: '7 × 5 in'
  },
  {
    id: 'hehe-art-5',
    refNumber: '610005',
    title: 'Wine O’Clock Kitty',
    artist: 'Suprita Chatterjee',
    productType: 'Fridge Magnet',
    description: 'A rosy-cheeked ginger cat raising a glass of red wine, framed in a pebble-shaped clay border with forest green and ultramarine stripes.',
    price: 250,
    stock: 1,
    tag: '',
    featured: true,
    images: ['assets/artwork-5.jpg'],
    bgColor: '#364a27',
    material: 'Hand-sculpted clay frame & watercolour on paper',
    dimensions: '6.5 × 5.5 in'
  },
  {
    id: 'hehe-art-6',
    refNumber: '610006',
    title: 'Cheers Doggo in Violet Stripes',
    artist: 'Suprita Chatterjee',
    productType: 'Fridge Magnet',
    description: 'A serene pup toasting with a glass of rosé, set in a tall hand-moulded clay frame painted in iris purple and crimson stripes.',
    price: 250,
    stock: 1,
    tag: '',
    featured: false,
    images: ['assets/artwork-6.jpg'],
    bgColor: '#65559b',
    material: 'Hand-sculpted clay frame & watercolour ink',
    dimensions: '5.5 × 7 in'
  },
  {
    id: 'hehe-art-7',
    refNumber: '610007',
    title: 'Puppy & Daisy in Wavy Stripes',
    artist: 'Suprita Chatterjee',
    productType: 'Fridge Magnet',
    description: 'A gentle yellow puppy pausing to smell a daisy, framed in a circular clay border with sky-blue and vermilion ribbons.',
    price: 250,
    stock: 1,
    tag: '',
    featured: true,
    images: ['assets/artwork-7.jpg'],
    bgColor: '#a81d20',
    material: 'Hand-sculpted clay frame & watercolour on paper',
    dimensions: '6 × 6 in'
  }
];

export function safeStoreLink(value) {
  return typeof value === 'string' && (/^#(?:home|shop|artworks|artists|artist\/[a-z0-9-]+|collection\/[a-z-]+|product\/[a-zA-Z0-9_-]+|about|account)$/.test(value) || /^https:\/\/[^\s<>"']+$/.test(value)) ? value : '#shop';
}
export function normalizePromoBlock(raw = {}, idx = 0) {
  const rawId = String(raw.id || `promo-${idx + 1}`).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  const id = rawId && !DEFAULT_HOME_SECTIONS.includes(rawId) ? rawId : `promo-${idx + 1}`;
  const rawLink = String(raw.buttonLink || '#shop').trim();
  const buttonLink = rawLink ? safeStoreLink(rawLink) : '#shop';
  const image = raw.image && validImageSource(raw.image) ? safeImage(raw.image, '') : '';
  return {
    id,
    enabled: raw.enabled !== false,
    eyebrow: String(raw.eyebrow || '').trim().slice(0, 80),
    heading: String(raw.heading || '').trim().slice(0, 120),
    body: String(raw.body || '').trim().slice(0, 600),
    buttonLabel: String(raw.buttonLabel || '').trim().slice(0, 50),
    buttonLink,
    image,
    theme: PROMO_THEMES.some(([t]) => t === raw.theme) ? raw.theme : 'warm-paper',
    align: raw.align === 'center' ? 'center' : 'left'
  };
}

export function normalizeSectionOrder(order = DEFAULT_HOME_SECTIONS, promoBlocks = []) {
  const validIds = new Set([...DEFAULT_HOME_SECTIONS, ...(Array.isArray(promoBlocks) ? promoBlocks.map(b => b.id) : [])]);
  const list = Array.isArray(order) ? order : [];
  const next = [];
  const seen = new Set();
  for (const id of list) {
    if (typeof id === 'string' && validIds.has(id) && !seen.has(id)) {
      seen.add(id);
      next.push(id);
    }
  }
  for (const id of validIds) {
    if (!seen.has(id)) {
      seen.add(id);
      next.push(id);
    }
  }
  return next;
}

export function normalizeSettings(value = {}) {
  const result = {...DEFAULT_SETTINGS};
  for (const key of Object.keys(result)) {
    if (typeof value[key] === typeof result[key]) result[key] = starterCopy(value[key]);
  }
  result.bannerEyebrow = String(result.bannerEyebrow || '').trim().slice(0, 80);
  result.bannerTitle = String(result.bannerTitle ?? DEFAULT_SETTINGS.bannerTitle).trim().slice(0, 100);
  result.bannerText = String(result.bannerText ?? DEFAULT_SETTINGS.bannerText).trim().slice(0, 400);
  result.bannerShowArtist = value.bannerShowArtist === undefined ? DEFAULT_SETTINGS.bannerShowArtist : Boolean(value.bannerShowArtist);
  result.bannerArtistLabel = String(result.bannerArtistLabel || '').trim().slice(0, 160);
  const rawArtistLink = String(result.bannerArtistLink || '').trim();
  result.bannerArtistLink = rawArtistLink ? (safeStoreLink(rawArtistLink) === rawArtistLink ? rawArtistLink : '') : '';
  result.bannerButtonVisible = value.bannerButtonVisible === undefined ? DEFAULT_SETTINGS.bannerButtonVisible : Boolean(value.bannerButtonVisible);
  result.bannerButton = String(result.bannerButton || '').trim().slice(0, 50);
  const rawBannerLink = String(result.bannerLink || '').trim();
  result.bannerLink = rawBannerLink ? safeStoreLink(rawBannerLink) : '#artworks';
  result.bannerButtonStyle = BANNER_CTA_STYLES.some(([id]) => id === value.bannerButtonStyle) ? value.bannerButtonStyle : 'light';
  result.bannerButtonPosition = BANNER_CTA_POSITIONS.some(([id]) => id === value.bannerButtonPosition) ? value.bannerButtonPosition : 'below-text';
  const rawOffX = Math.round(Number(value.bannerButtonOffsetX));
  const rawOffY = Math.round(Number(value.bannerButtonOffsetY));
  result.bannerButtonOffsetX = Number.isFinite(rawOffX) ? Math.max(-60, Math.min(60, rawOffX)) : 0;
  result.bannerButtonOffsetY = Number.isFinite(rawOffY) ? Math.max(-60, Math.min(60, rawOffY)) : 0;
  const rawBlocks = Array.isArray(value.promoBlocks) ? value.promoBlocks : (value.promoBlocks && typeof value.promoBlocks === 'object' ? Object.values(value.promoBlocks) : []);
  const seenBlocks = new Set();
  result.promoBlocks = [];
  for (const [idx, item] of rawBlocks.entries()) {
    if (!item || typeof item !== 'object') continue;
    const block = normalizePromoBlock(item, idx);
    if (seenBlocks.has(block.id)) continue;
    seenBlocks.add(block.id);
    result.promoBlocks.push(block);
    if (result.promoBlocks.length >= 3) break;
  }
  result.homeSectionOrder = normalizeSectionOrder(value.homeSectionOrder, result.promoBlocks);
  if (value.announcementVisible === undefined || value.announcementText === 'Welcome to Silly Sensei') {
    result.announcementVisible = false;
  }
  if (value.bannerVisible === undefined) result.bannerVisible = true;
  result.announcementLink = safeStoreLink(result.announcementLink);
  result.bannerImage = safeImage(result.bannerImage, DEFAULT_SETTINGS.bannerImage);
  result.reviewImages = (Array.isArray(value.reviewImages)?value.reviewImages:[]).filter(validImageSource).slice(0,7);
  result.artworkSort = ARTWORK_SORT_MODES.some(([id]) => id === value.artworkSort) ? value.artworkSort : 'manual';
  result.cartButtonMode = value.cartButtonMode === 'artwork' ? 'artwork' : 'black';
  const rawLimit = Number(value.bannerLimit);
  result.bannerLimit = Number.isInteger(rawLimit) && rawLimit >= 0 && rawLimit <= 50 ? rawLimit : 8;
  result.aboutVisible = value.aboutVisible === true;
  result.storyVisible = value.storyVisible !== false;
  return result;
}
export function bannerSlidesFor(products = [], settings = DEFAULT_SETTINGS) {
  const sortMode = settings?.artworkSort || 'manual';
  const visible = sortArtworks((Array.isArray(products) ? products : []).filter(p => p && p.visible && !p.archived), sortMode);
  const bannerPicked = visible.filter(p => p.inBanner !== false);
  const source = bannerPicked.length ? bannerPicked : (visible.length ? visible : FALLBACK_BANNER_ARTWORKS);
  const limit = Number.isInteger(settings?.bannerLimit) && settings.bannerLimit >= 0 ? settings.bannerLimit : 8;
  const limited = limit === 0 ? source : source.slice(0, limit);
  return limited.map(p => ({
    id: p.id,
    title: p.title || 'Untitled Artwork',
    artist: p.artist || 'Suprita Chatterjee',
    price: p.price,
    image: safeImage(p.images?.[0], settings.bannerImage || 'assets/artwork-1.jpg'),
    bgColor: artworkColorFor(p)
  }));
}
export function bannerMarkup(settings = DEFAULT_SETTINGS, products = []) {
  if (settings && settings.bannerVisible === false) return '';
  const slides = bannerSlidesFor(products, settings);
  const first = slides[0] || FALLBACK_BANNER_ARTWORKS[0];
  const themeStyle = artworkThemeStyle({ bgColor: first.bgColor, images: [first.image], id: first.id });
  const eyebrow = String(settings?.bannerEyebrow || '').trim();
  const title = settings?.bannerTitle === undefined ? DEFAULT_SETTINGS.bannerTitle : String(settings.bannerTitle).trim();
  const subtext = settings?.bannerText === undefined ? DEFAULT_SETTINGS.bannerText : String(settings.bannerText).trim();
  const showArtist = settings?.bannerShowArtist !== false;
  const customArtist = String(settings?.bannerArtistLabel || '').trim();
  const artistHref = settings?.bannerArtistLink ? safeStoreLink(settings.bannerArtistLink) : `#artist/${artistSlug(first.artist)}`;
  const artistText = customArtist || `Art by ${first.artist}`;
  const ctaLabel = String(settings?.bannerButton || '').trim() || 'Explore artworks';
  const showCta = settings?.bannerButtonVisible !== false && Boolean(ctaLabel);
  const ctaHref = safeStoreLink(settings?.bannerLink || '#artworks');
  const ctaStyle = settings?.bannerButtonStyle || 'light';
  const ctaPos = settings?.bannerButtonPosition || 'below-text';
  const ctaX = Number(settings?.bannerButtonOffsetX) || 0;
  const ctaY = Number(settings?.bannerButtonOffsetY) || 0;
  const ctaHtml = showCta ? `<a class="hero-banner-cta is-style-${e(ctaStyle)} is-pos-${e(ctaPos)}" href="${e(ctaHref)}" style="--cta-x:${ctaX}px;--cta-y:${ctaY}px"><span class="hero-cta-label">${e(ctaLabel)}</span> <span aria-hidden="true">→</span></a>` : '';
  return `<section class="store-banner hehe-hero-banner ${showCta ? `has-cta-${e(ctaPos)}` : ''}" data-hero-banner style="${themeStyle};--banner-bg:${e(first.bgColor)}">
    <div class="hero-bg-stage" aria-hidden="true">
      ${slides.map((s, idx) => `<div class="hero-bg-slide ${idx === 0 ? 'is-active' : ''}" data-hero-slide="${idx}" data-bg-color="${e(s.bgColor)}" data-title="${e(s.title)}" data-artist="${e(s.artist)}" data-artist-slug="${e(artistSlug(s.artist))}" data-price="${e(s.price ? money(s.price) : '')}" data-href="#product/${e(s.id)}">
        <img src="${e(s.image)}" alt="" ${idx === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} data-artwork-img>
      </div>`).join('')}
    </div>
    <div class="hero-banner-overlay">
      <div class="hero-text-plate">
        ${eyebrow ? `<span class="hero-banner-eyebrow">${e(eyebrow)}</span>` : ''}
        ${title ? `<h1 class="hero-banner-heading">${e(title)}</h1>` : ''}
        ${subtext ? `<p class="hero-banner-subtext">${e(subtext)}</p>` : ''}
        ${showArtist ? `<a class="hero-banner-artist" href="${e(artistHref)}" data-banner-art-artist ${customArtist ? 'data-banner-artist-custom="true"' : ''}>${e(artistText)}</a>` : ''}
        ${ctaPos === 'below-text' ? ctaHtml : ''}
      </div>
      <div class="hero-bottom-bar">
        <div class="hero-dots" role="tablist" aria-label="Banner artworks">
          ${slides.map((s, idx) => `<button type="button" class="hero-dot ${idx === 0 ? 'is-active' : ''}" data-action="banner-slide" data-index="${idx}" aria-label="Show ${e(s.title)}" aria-selected="${idx === 0 ? 'true' : 'false'}"></button>`).join('')}
        </div>
      </div>
    </div>
    ${ctaPos !== 'below-text' ? ctaHtml : ''}
  </section>`;
}
export function settingsForm(s) {
  const ctaX = Number(s.bannerButtonOffsetX) || 0;
  const ctaY = Number(s.bannerButtonOffsetY) || 0;
  const ctaPos = s.bannerButtonPosition || 'below-text';
  const ctaStyle = s.bannerButtonStyle || 'light';
  return `<form id="banner-form" class="settings-note banner-editor">
  <h2>Storefront pages</h2>
  <label class="visibility-toggle"><input type="checkbox" name="aboutVisible" ${s.aboutVisible?'checked':''}><span>Show "About hehe.cafe" page on storefront</span></label>
  <label class="visibility-toggle"><input type="checkbox" name="storyVisible" ${s.storyVisible!==false?'checked':''}><span>Show "Welcome to hehe.cafe" story section on homepage</span></label>
  <hr>
  <h2>Announcement bar</h2>
  <label class="visibility-toggle"><input type="checkbox" name="announcementVisible" ${s.announcementVisible?'checked':''}><span>Announcement bar visible</span></label>
  <div class="form-grid"><label class="field wide">Announcement text<input name="announcementText" maxlength="160" required value="${e(s.announcementText)}"></label><label class="field wide">Announcement link<input name="announcementLink" required maxlength="500" value="${e(s.announcementLink)}"></label></div>
  <hr>
  <h2>Homepage hero banner</h2>
  <p class="small muted">Edit the headline, subtitle, artist credit line, action button appearance &amp; position, and fallback artwork image.</p>
  <label class="visibility-toggle"><input type="checkbox" name="bannerVisible" ${s.bannerVisible?'checked':''}><span>Homepage rotating artwork banner visible</span></label>
  <div class="form-grid">
    <label class="field wide">Banner eyebrow (optional small tag)<input name="bannerEyebrow" maxlength="80" placeholder="e.g. Original artworks &amp; prints" value="${e(s.bannerEyebrow||'')}"></label>
    <label class="field wide">Banner headline (leave blank to hide)<input name="bannerTitle" maxlength="100" value="${e(s.bannerTitle??'')}"></label>
    <label class="field wide">Banner subtitle / tagline<textarea name="bannerText" maxlength="400">${e(s.bannerText??'')}</textarea></label>
  </div>
  <label class="visibility-toggle"><input type="checkbox" name="bannerShowArtist" ${s.bannerShowArtist!==false?'checked':''}><span>Show artist credit on homepage banner</span></label>
  <div class="form-grid">
    <label class="field">Banner artist text (blank auto-updates per slide)<input name="bannerArtistLabel" maxlength="160" placeholder="Auto: Art by &lt;slide artist&gt;" value="${e(s.bannerArtistLabel||'')}"></label>
    <label class="field">Artist credit link (blank links to artist page)<input name="bannerArtistLink" maxlength="500" placeholder="e.g. #artists or #artist/suprita-chatterjee" value="${e(s.bannerArtistLink||'')}"></label>
  </div>
  <label class="visibility-toggle"><input type="checkbox" name="bannerButtonVisible" ${s.bannerButtonVisible!==false?'checked':''}><span>Show "Explore artworks" action button</span></label>
  <div class="form-grid">
    <label class="field">Button text<input name="bannerButton" maxlength="50" placeholder="e.g. Explore artworks" value="${e(s.bannerButton||'')}"></label>
    <label class="field">Button link<input name="bannerLink" maxlength="500" placeholder="#artworks" value="${e(s.bannerLink||'#artworks')}"></label>
    <div class="field wide">
      <span>Button style</span>
      <input type="hidden" name="bannerButtonStyle" value="${e(ctaStyle)}">
      <div class="cta-style-chips" role="group" aria-label="Banner button style">
        ${BANNER_CTA_STYLES.map(([id,label])=>`<button type="button" class="cta-style-chip ${ctaStyle===id?'is-active':''}" data-action="pick-banner-cta-style" data-style="${e(id)}" aria-pressed="${ctaStyle===id}">${e(label)}</button>`).join('')}
      </div>
    </div>
    <div class="field wide">
      <span>Button position on banner</span>
      <input type="hidden" name="bannerButtonPosition" value="${e(ctaPos)}">
      <div class="cta-position-grid" role="group" aria-label="Choose banner button position">
        ${[['top-left','Top left'],['top-right','Top right'],['below-text','With headline'],['bottom-left','Bottom left'],['bottom-center','Bottom center'],['bottom-right','Bottom right']].map(([id,label])=>`<button type="button" class="cta-pos-btn is-pos-preview-${e(id)} ${ctaPos===id?'is-active':''}" data-action="pick-banner-cta-pos" data-pos="${e(id)}" aria-pressed="${ctaPos===id}"><span>${e(label)}</span></button>`).join('')}
      </div>
    </div>
    <label class="field"><span class="banner-offset-label"><span>Horizontal fine-tune</span><span id="banner-cta-x-val" class="banner-offset-val">${ctaX}px</span></span><input type="range" name="bannerButtonOffsetX" min="-60" max="60" step="2" value="${ctaX}"></label>
    <label class="field"><span class="banner-offset-label"><span>Vertical fine-tune</span><span id="banner-cta-y-val" class="banner-offset-val">${ctaY}px</span></span><input type="range" name="bannerButtonOffsetY" min="-60" max="60" step="2" value="${ctaY}"></label>
    <div class="field wide"><button type="button" class="text-link" data-action="reset-banner-cta-pos">Reset button position</button></div>
    <label class="field wide">Fallback banner image URL<input name="bannerImage" maxlength="100000" data-saved-image="${isInlineImage(s.bannerImage)}" placeholder="${isInlineImage(s.bannerImage)?'Image saved · choose a new file or paste a URL to replace':'https://…'}" value="${isInlineImage(s.bannerImage)?'':e(s.bannerImage)}"></label>
    <label class="field wide">Or choose a fallback banner image<input name="bannerFile" type="file" accept="image/jpeg,image/png,image/webp"></label>
  </div>
  <hr>
  <input type="hidden" name="homeSectionOrderJson" value="${e(JSON.stringify(s.homeSectionOrder||DEFAULT_HOME_SECTIONS))}">
  <input type="hidden" name="promoBlocksJson" value="${e(JSON.stringify(s.promoBlocks||[]))}">
  <div id="home-layout-editor-slot"></div>
  <hr>
  <h2>Customer reviews</h2>
  <label class="visibility-toggle"><input type="checkbox" name="reviewsVisible" ${s.reviewsVisible?'checked':''}><span>Customer reviews visible</span></label>
  ${reviewCards(s.reviewImages)}
  <div class="banner-form-actions"><button class="button" type="submit">Save homepage &amp; banners</button><span id="banner-notice" role="status" class="notice"></span></div></form>`;
}

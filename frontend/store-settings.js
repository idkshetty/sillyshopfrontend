import {reviewCards} from './review-editor.js';
import {starterCopy} from './placeholder-copy.js';
import {isInlineImage,validImageSource,encodeImage} from './image-data.js';
import {escapeHTML as e, safeImage, progressiveImageSources, artworkColorFor, artworkThemeStyle, sortArtworks, ARTWORK_SORT_MODES, money} from './commerce.js';
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

export const MOBILE_BREAKPOINT_OPTIONS = [
  [580, 'Up to 580px · All phones & closed foldables (1 per row, default)'],
  [520, 'Up to 520px · Standard & large phones (1 per row)'],
  [640, 'Up to 640px · Extra-wide phones (foldables open at 641px+)'],
  [720, 'Up to 720px · Phones & compact foldables (1 per row)'],
  [760, 'Up to 760px · All mobile & small tablets (1 per row)'],
  [360, 'Up to 360px · Compact phones only (2 per row on most phones)']
];

export function mobileGridBreakpointCss(rawBp = 580) {
  const n = Math.round(Number(rawBp));
  const bp = Number.isInteger(n) && n >= 320 && n <= 840 ? n : 580;
  const tabMin = bp + 1;
  return `@media (max-width: ${bp}px) {
  .product-grid, .related .product-grid {
    grid-template-columns: minmax(0, 1fr) !important;
    gap: 20px !important;
  }
  .product-card {
    padding: 14px 14px 16px !important;
    border-radius: 16px !important;
  }
  .product-card-image {
    padding: 8px !important;
    aspect-ratio: 4 / 3 !important;
  }
  .product-card-meta-top {
    flex-direction: row !important;
    align-items: center !important;
    justify-content: space-between !important;
    gap: 8px !important;
    margin-bottom: 6px !important;
  }
  .product-card h2 {
    font-size: 17px !important;
    line-height: 1.3 !important;
    margin: 2px 0 6px !important;
  }
  .artwork-card-description {
    display: -webkit-box !important;
    -webkit-line-clamp: 2 !important;
  }
  .product-card .price {
    font-size: 16px !important;
  }
  .product-card-actions {
    grid-template-columns: minmax(136px, 1fr) auto !important;
    gap: 8px !important;
  }
  .product-card .cart-button,
  .product-card .artwork-cart-btn {
    height: 44px !important;
    min-height: 44px !important;
    min-width: 136px !important;
    padding: 0 14px !important;
    font-size: 13px !important;
  }
  .product-card .quick-buy-btn {
    min-height: 44px !important;
    padding: 0 14px !important;
    font-size: 12.5px !important;
    width: auto !important;
  }
}
@media (max-width: 359px) {
  .product-card-actions {
    grid-template-columns: 1fr !important;
  }
  .product-card .quick-buy-btn {
    width: 100% !important;
  }
}
@media (min-width: ${tabMin}px) and (max-width: 900px) {
  .product-grid, .related .product-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    gap: 14px !important;
  }
  .product-card {
    padding: 10px 10px 12px !important;
    border-radius: 14px !important;
  }
  .product-card-image {
    padding: 6px !important;
    aspect-ratio: 1 !important;
  }
  .product-card-meta-top {
    flex-direction: column !important;
    align-items: flex-start !important;
    gap: 4px !important;
    margin-bottom: 4px !important;
  }
  .product-card h2 {
    font-size: 14.5px !important;
    line-height: 1.25 !important;
    margin: 2px 0 4px !important;
  }
  .artwork-card-description,
  .artwork-card-specs {
    display: none !important;
  }
  .product-card-actions {
    grid-template-columns: 1fr !important;
    gap: 6px !important;
  }
  .product-card .cart-button,
  .product-card .artwork-cart-btn {
    width: 100% !important;
    min-width: 0 !important;
    height: 40px !important;
    min-height: 40px !important;
    padding: 0 10px !important;
    font-size: 12.5px !important;
  }
  .product-card .quick-buy-btn {
    width: 100% !important;
    min-height: 38px !important;
    padding: 0 12px !important;
    font-size: 12.5px !important;
    text-align: center !important;
    justify-content: center !important;
  }
}`;
}

export const DEFAULT_BACK_ATTACHMENTS = [
  { id: 'magnet', label: 'Fridge Magnet', shortLabel: 'Magnet', price: 20, description: 'Strong ceramic-safe neodymium magnet fixed on the back.', image: 'assets/attachments/magnet-placeholder.svg', enabled: true },
  { id: 'tape', label: 'Sticky Tape', shortLabel: 'Sticky tape', price: 15, description: 'Double-sided heavy-duty wall mounting strips included.', image: 'assets/attachments/tape-placeholder.svg', enabled: true },
  { id: 'stand', label: 'Desk Buddy Stand', shortLabel: 'Desk stand', price: 50, description: 'Fold-out tabletop display stand to turn it into a desk buddy.', image: 'assets/attachments/stand-placeholder.svg', enabled: true }
];

export function normalizeBackAttachments(raw) {
  const list = Array.isArray(raw) ? raw : (raw && typeof raw === 'object' ? Object.values(raw) : []);
  const byId = new Map(list.filter(o => o && typeof o === 'object' && typeof o.id === 'string').map(o => [o.id.trim().toLowerCase(), o]));
  return DEFAULT_BACK_ATTACHMENTS.map(def => {
    const src = byId.get(def.id) || {};
    const rawPrice = Number(src.price);
    const price = Number.isFinite(rawPrice) && rawPrice >= 0 && rawPrice <= 5000 ? Math.round(rawPrice * 100) / 100 : def.price;
    const label = String(src.label || '').trim().slice(0, 48) || def.label;
    const shortLabel = String(src.shortLabel || '').trim().slice(0, 24) || def.shortLabel;
    const description = String(src.description || '').trim().slice(0, 160) || def.description;
    const image = src.image && validImageSource(src.image) ? safeImage(src.image, def.image) : def.image;
    return {
      id: def.id,
      label,
      shortLabel,
      price,
      description,
      image,
      enabled: src.enabled !== false
    };
  });
}

export function resolveBackAttachment(attachmentId, settings = null) {
  if (!settings || settings.backAttachmentsEnabled !== true) return null;
  const options = normalizeBackAttachments(settings.backAttachmentOptions).filter(o => o.enabled !== false);
  if (!options.length) return null;
  const key = String(attachmentId || '').trim().toLowerCase();
  return options.find(o => o.id === key) || options[0];
}

export const DEFAULT_DIY_KIT = {
  title: 'DIY Paint Kit',
  subtitle: 'Paint your own handmade hehe.cafe clay frame at home — beginner-friendly & relaxing.',
  includesText: 'Includes sculpted clay frame · line art guide · acrylic paints · brush · back attachment',
  priceHint: 299,
  badgeText: 'DIY Paint Kit',
  image: 'assets/diy-kit-placeholder.svg',
  showHomepageBanner: true
};

export function normalizeDiyKit(raw) {
  const src = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
  const rawPrice = Number(src.priceHint);
  const priceHint = Number.isFinite(rawPrice) && rawPrice >= 0 && rawPrice <= 50000 ? Math.round(rawPrice * 100) / 100 : DEFAULT_DIY_KIT.priceHint;
  const image = src.image && validImageSource(src.image) ? safeImage(src.image, DEFAULT_DIY_KIT.image) : DEFAULT_DIY_KIT.image;
  return {
    title: String(src.title || '').trim().slice(0, 64) || DEFAULT_DIY_KIT.title,
    subtitle: String(src.subtitle || '').trim().slice(0, 220) || DEFAULT_DIY_KIT.subtitle,
    includesText: String(src.includesText || '').trim().slice(0, 180) || DEFAULT_DIY_KIT.includesText,
    priceHint,
    badgeText: String(src.badgeText || '').trim().slice(0, 28) || DEFAULT_DIY_KIT.badgeText,
    image,
    showHomepageBanner: src.showHomepageBanner !== false
  };
}

export const DEFAULT_SETTINGS = {
  announcementVisible: false,
  announcementText: 'welcome to hehe.cafe · handmade clay frames & paintings · ₹40/item India Post shipping',
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
  bannerImage: 'https://iili.io/ofJ6Nr7.jpg',
  homeSectionOrder: [...DEFAULT_HOME_SECTIONS],
  promoBlocks: [],
  reviewsVisible: false,
  reviewImages: [],
  artworkSort: 'manual',
  cartButtonMode: 'black',
  bannerLimit: 8,
  mobileBreakpoint: 580,
  aboutVisible: false,
  storyVisible: true,
  productImageStorage: 'firebase',
  backAttachmentsEnabled: false,
  backAttachmentOptions: DEFAULT_BACK_ATTACHMENTS.map(o => ({ ...o })),
  diyKitEnabled: false,
  diyKit: { ...DEFAULT_DIY_KIT }
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
    images: ['https://iili.io/ofJ6Nr7.jpg'],
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
    images: ['https://iili.io/ofJ6rLQ.jpg'],
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
    images: ['https://iili.io/ofJP9Bp.jpg'],
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
    images: ['https://iili.io/ofJPBjf.jpg'],
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
    images: ['https://iili.io/ofJPAve.jpg'],
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
    images: ['https://iili.io/ofJPYjj.jpg'],
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
    images: ['https://iili.io/ofJPaZx.jpg'],
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
  const rawMobileBp = Math.round(Number(value.mobileBreakpoint));
  result.mobileBreakpoint = Number.isInteger(rawMobileBp) && rawMobileBp >= 320 && rawMobileBp <= 840 ? rawMobileBp : 580;
  result.aboutVisible = value.aboutVisible === true;
  result.storyVisible = value.storyVisible !== false;
  result.productImageStorage = value.productImageStorage === 'freeimage' ? 'freeimage' : 'firebase';
  result.backAttachmentsEnabled = value.backAttachmentsEnabled === true;
  result.backAttachmentOptions = normalizeBackAttachments(value.backAttachmentOptions);
  result.diyKitEnabled = value.diyKitEnabled === true;
  result.diyKit = normalizeDiyKit(value.diyKit);
  return result;
}
export function bannerSlidesFor(products = [], settings = DEFAULT_SETTINGS) {
  const sortMode = settings?.artworkSort || 'manual';
  const visible = sortArtworks((Array.isArray(products) ? products : []).filter(p => p && p.visible && !p.archived), sortMode);
  const bannerPicked = visible.filter(p => p.inBanner !== false);
  const source = bannerPicked.length ? bannerPicked : (visible.length ? visible : FALLBACK_BANNER_ARTWORKS);
  const limit = Number.isInteger(settings?.bannerLimit) && settings.bannerLimit >= 0 ? settings.bannerLimit : 8;
  const limited = limit === 0 ? source : source.slice(0, limit);
  return limited.map(p => {
    const prog = progressiveImageSources(p, 0, settings.bannerImage || 'https://iili.io/ofJ6Nr7.jpg');
    return {
      id: p.id,
      title: p.title || 'Untitled Artwork',
      artist: p.artist || 'Suprita Chatterjee',
      price: p.price,
      image: prog.src,
      hdImage: prog.hdSrc,
      fallbackImage: prog.fallbackSrc,
      bgColor: artworkColorFor(p)
    };
  });
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
        <img src="${e(s.image)}"${s.hdImage ? ` data-hd-src="${e(s.hdImage)}"` : ''}${s.fallbackImage ? ` data-fallback-src="${e(s.fallbackImage)}"` : ''} alt="" ${idx === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" data-artwork-img>
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
  const mobileBp = Number.isInteger(s.mobileBreakpoint) ? s.mobileBreakpoint : 580;
  const diy = normalizeDiyKit(s.diyKit);
  const pill = (on, txtOn = 'ON', txtOff = 'OFF') => `<span class="settings-status-pill ${on ? 'is-on' : 'is-off'}">${on ? txtOn : txtOff}</span>`;
  return `<form id="banner-form" class="settings-note banner-editor">
  <div class="admin-mode-switcher" role="navigation" aria-label="Editor workspace switcher">
    <a class="admin-mode-tab" href="#admin/content">Text, Logos &amp; Pages</a>
    <span class="admin-mode-tab is-active" aria-current="page">Banners, Features &amp; Layout</span>
  </div>
  <div class="settings-nav-sticky">
    <div class="settings-sticky-top">
      <input type="search" class="content-search-input" data-settings-search aria-label="Search settings" placeholder="Find setting (magnet, DIY kit, banner, button, reviews, grid…)">
      <button class="button small" type="submit">Save settings</button>
    </div>
    <div class="settings-cat-row" role="group" aria-label="Filter settings by section">
      <button type="button" class="pilot-chip is-active" data-settings-cat="all">All (7)</button>
      <button type="button" class="pilot-chip" data-settings-cat="banner">Hero banner</button>
      <button type="button" class="pilot-chip" data-settings-cat="attachments">Back attachments ${s.backAttachmentsEnabled ? '· ON' : ''}</button>
      <button type="button" class="pilot-chip" data-settings-cat="diy">DIY Paint Kit ${s.diyKitEnabled ? '· ON' : ''}</button>
      <button type="button" class="pilot-chip" data-settings-cat="layout">Homepage layout</button>
      <button type="button" class="pilot-chip" data-settings-cat="pages">Pages &amp; grid</button>
      <button type="button" class="pilot-chip" data-settings-cat="announcement">Announcement</button>
      <button type="button" class="pilot-chip" data-settings-cat="reviews">Reviews</button>
    </div>
  </div>

  <details class="settings-acc-card" open data-settings-sec="banner" data-settings-keywords="hero banner headline subtitle artist cta button position offset fallback image explore artworks">
    <summary class="settings-acc-sum">
      <div><strong>Homepage hero banner</strong><small>Headline, subtitle, artist link, CTA button placement &amp; fallback photo</small></div>
      ${pill(s.bannerVisible !== false)}
    </summary>
    <div class="settings-acc-body">
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
    </div>
  </details>

  <details class="settings-acc-card" open data-settings-sec="attachments" data-settings-keywords="back attachment magnet magnetic strip sticky tape desk buddy stand bag checkout customization">
    <summary class="settings-acc-sum">
      <div><strong>Back attachment customization</strong><small>Let shoppers choose Magnet, Sticky Tape, or Desk Buddy Stand in Art Bag</small></div>
      ${pill(s.backAttachmentsEnabled === true)}
    </summary>
    <div class="settings-acc-body">
      <p class="small muted">When turned on, shoppers can pick Magnet, Sticky Tape, or Desk Buddy Stand directly in their bag (base price + selected add-on). Selections appear automatically inside Admin Orders &amp; invoices.</p>
      <label class="visibility-toggle"><input type="checkbox" name="backAttachmentsEnabled" ${s.backAttachmentsEnabled===true?'checked':''}><span>Enable back attachment options on storefront bag &amp; checkout</span></label>
      <div class="back-attach-admin-grid">
        ${normalizeBackAttachments(s.backAttachmentOptions).map(opt => `<div class="back-attach-admin-card" data-attach-row="${e(opt.id)}">
          <div class="back-attach-admin-head">
            <img class="back-attach-admin-thumb" src="${e(opt.image)}" alt="${e(opt.label)} preview">
            <label class="visibility-toggle" style="margin:0;flex:1"><input type="checkbox" name="attach_${e(opt.id)}_enabled" ${opt.enabled!==false?'checked':''}><span>Enable ${e(opt.label)}</span></label>
          </div>
          <div class="form-grid" style="margin-top:8px">
            <label class="field">Display name<input name="attach_${e(opt.id)}_label" maxlength="48" value="${e(opt.label)}"></label>
            <label class="field">Short chip label<input name="attach_${e(opt.id)}_shortLabel" maxlength="24" value="${e(opt.shortLabel)}"></label>
            <label class="field">Extra add-on price (₹)<input type="number" name="attach_${e(opt.id)}_price" min="0" max="5000" step="1" value="${e(opt.price)}"></label>
            <label class="field">Back photo URL (swap anytime)<input name="attach_${e(opt.id)}_image" maxlength="100000" value="${e(opt.image)}"></label>
            <label class="field wide">Short description<input name="attach_${e(opt.id)}_description" maxlength="160" value="${e(opt.description)}"></label>
          </div>
        </div>`).join('')}
      </div>
    </div>
  </details>

  <details class="settings-acc-card" open data-settings-sec="diy" data-settings-keywords="diy paint kit category spotlight homepage banner line art price">
    <summary class="settings-acc-sum">
      <div><strong>DIY Paint Kit category &amp; spotlight</strong><small>Show/hide the DIY Kit product category, filter tab &amp; homepage card</small></div>
      ${pill(s.diyKitEnabled === true)}
    </summary>
    <div class="settings-acc-body">
      <p class="small muted">Control whether DIY Paint Kit artworks, category tab, and homepage spotlight appear on the storefront. Toggle off anytime to hide all DIY Kits without deleting products.</p>
      <label class="visibility-toggle"><input type="checkbox" name="diyKitEnabled" ${s.diyKitEnabled===true?'checked':''}><span>Enable DIY Paint Kits on storefront (show DIY Kit artworks, category tab &amp; spotlight)</span></label>
      <div class="back-attach-admin-card" style="margin-top:10px">
        <div class="back-attach-admin-head">
          <img class="back-attach-admin-thumb" src="${e(diy.image)}" alt="${e(diy.title)} preview">
          <label class="visibility-toggle" style="margin:0;flex:1"><input type="checkbox" name="diyKitShowBanner" ${diy.showHomepageBanner!==false?'checked':''}><span>Show DIY Kit spotlight banner on homepage</span></label>
        </div>
        <div class="form-grid" style="margin-top:8px">
          <label class="field">Spotlight title<input name="diyKitTitle" maxlength="64" value="${e(diy.title)}"></label>
          <label class="field">Card badge text<input name="diyKitBadge" maxlength="28" value="${e(diy.badgeText)}"></label>
          <label class="field">Starting price hint (₹)<input type="number" name="diyKitPriceHint" min="0" max="50000" step="1" value="${e(diy.priceHint)}"></label>
          <label class="field">Placeholder / photo URL (swap anytime)<input name="diyKitImage" maxlength="100000" value="${e(diy.image)}"></label>
          <label class="field wide">Subtitle<input name="diyKitSubtitle" maxlength="220" value="${e(diy.subtitle)}"></label>
          <label class="field wide">What's included line (shown on spotlight, cards &amp; product page)<input name="diyKitIncludes" maxlength="180" value="${e(diy.includesText)}"></label>
        </div>
      </div>
    </div>
  </details>

  <details class="settings-acc-card" open data-settings-sec="layout" data-settings-keywords="homepage section order promo blocks reorder custom section">
    <summary class="settings-acc-sum">
      <div><strong>Homepage section order &amp; promo blocks</strong><small>Reorder sections and manage custom homepage promotional cards</small></div>
      <span class="settings-status-pill is-on">${(s.promoBlocks||[]).length} promos</span>
    </summary>
    <div class="settings-acc-body">
      <input type="hidden" name="homeSectionOrderJson" value="${e(JSON.stringify(s.homeSectionOrder||DEFAULT_HOME_SECTIONS))}">
      <input type="hidden" name="promoBlocksJson" value="${e(JSON.stringify(s.promoBlocks||[]))}">
      <div id="home-layout-editor-slot"></div>
    </div>
  </details>

  <details class="settings-acc-card" open data-settings-sec="pages" data-settings-keywords="about page story section mobile grid breakpoint 1 per row foldable">
    <summary class="settings-acc-sum">
      <div><strong>Storefront visibility &amp; mobile grid</strong><small>About page link, story block, and mobile 1-per-row breakpoint</small></div>
    </summary>
    <div class="settings-acc-body">
      <label class="visibility-toggle"><input type="checkbox" name="aboutVisible" ${s.aboutVisible?'checked':''}><span>Show "About hehe.cafe" page on storefront</span></label>
      <label class="visibility-toggle"><input type="checkbox" name="storyVisible" ${s.storyVisible!==false?'checked':''}><span>Show "Welcome to hehe.cafe" story section on homepage</span></label>
      <div class="form-grid" style="margin-top:10px">
        <label class="field wide">Mobile 1-per-row max width (phones &amp; closed foldables show 1 artwork per row; opened foldables &amp; tablets above this show 2 per row)
          <select name="mobileBreakpoint">
            ${MOBILE_BREAKPOINT_OPTIONS.map(([val, label]) => `<option value="${val}" ${mobileBp === val ? 'selected' : ''}>${e(label)}</option>`).join('')}
          </select>
        </label>
      </div>
    </div>
  </details>

  <details class="settings-acc-card" open data-settings-sec="announcement" data-settings-keywords="announcement top bar banner text link">
    <summary class="settings-acc-sum">
      <div><strong>Announcement bar</strong><small>Top slim notice bar across storefront pages</small></div>
      ${pill(s.announcementVisible === true)}
    </summary>
    <div class="settings-acc-body">
      <label class="visibility-toggle"><input type="checkbox" name="announcementVisible" ${s.announcementVisible?'checked':''}><span>Announcement bar visible</span></label>
      <div class="form-grid"><label class="field wide">Announcement text<input name="announcementText" maxlength="160" required value="${e(s.announcementText)}"></label><label class="field wide">Announcement link<input name="announcementLink" required maxlength="500" value="${e(s.announcementLink)}"></label></div>
    </div>
  </details>

  <details class="settings-acc-card" open data-settings-sec="reviews" data-settings-keywords="customer reviews collector cards photos screenshots">
    <summary class="settings-acc-sum">
      <div><strong>Customer reviews gallery</strong><small>Up to 7 collector screenshots shown on the homepage</small></div>
      ${pill(s.reviewsVisible === true)}
    </summary>
    <div class="settings-acc-body">
      <label class="visibility-toggle"><input type="checkbox" name="reviewsVisible" ${s.reviewsVisible?'checked':''}><span>Customer reviews visible</span></label>
      ${reviewCards(s.reviewImages)}
    </div>
  </details>

  <div class="banner-form-actions settings-sticky-save"><button class="button" type="submit">Save homepage &amp; settings</button><span id="banner-notice" role="status" class="notice"></span></div></form>`;
}

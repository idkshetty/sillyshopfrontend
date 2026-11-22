import {validLocation} from './location-utils.js';
import {validImageSource} from './image-data.js';
export const MAX_ITEM_QUANTITY = 1;
export const SHIPPING_CHARGE = 40;
export const SHIPPING_PAISE = 4000;
export const shippingForQuantity = qty => Math.max(0, Math.floor(Number(qty) || 0)) * SHIPPING_CHARGE;
export const shippingPaiseForQuantity = qty => Math.max(0, Math.floor(Number(qty) || 0)) * SHIPPING_PAISE;
export const CATEGORIES = [
  { id: 'paintings', name: 'Paintings', description: 'Little windows to a world of colour.', image: 'assets/paintings.svg' },
  { id: 'clay-models', name: 'Clay models', description: 'Small characters. Big personalities.', image: 'assets/clay-models.svg' },
  { id: 'molds', name: 'Molds', description: 'For all the things you have yet to make.', image: 'assets/molds.svg' },
  { id: 'rock-paints', name: 'Rock paints', description: 'Ordinary stones, a little less ordinary.', image: 'assets/rock-paints.svg' },
];
export const categoryOf = id => CATEGORIES.find(c => c.id === id);
export const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(value || 0);
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function safeImage(value, fallback = 'assets/paintings.svg') {
  return validImageSource(value)?value:fallback;
}
export function cardImage(value, fallback = 'assets/paintings.svg') {
  return safeImage(value,fallback);
}

const ASSET_BG_COLORS = {
  'assets/artwork-1.jpg': '#3b5d20',
  'assets/artwork-2.jpg': '#587920',
  'assets/artwork-3.jpg': '#245a9f',
  'assets/artwork-4.jpg': '#2245a7',
  'assets/artwork-5.jpg': '#364a27',
  'assets/artwork-6.jpg': '#65559b',
  'assets/artwork-7.jpg': '#a81d20',
  'assets/paintings.svg': '#3b5d20',
  'assets/paintings-sunset.svg': '#a81d20',
  'assets/clay-models.svg': '#587920',
  'assets/clay-models-peach.svg': '#245a9f',
  'assets/molds.svg': '#364a27',
  'assets/molds-rose.svg': '#65559b',
  'assets/rock-paints.svg': '#2245a7',
  'assets/rock-paints-blue.svg': '#245a9f'
};
const FALLBACK_ART_PALETTE = [
  '#3b5d20', '#587920', '#245a9f', '#2245a7', '#364a27', '#65559b', '#a81d20'
];

export function validHexColor(value) {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value.trim());
}

function hexToRgb(hex) {
  const clean = String(hex || '').replace('#', '');
  if (clean.length !== 6) return { r: 218, g: 210, b: 196 };
  const num = parseInt(clean, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function rgbToHex(r, g, b) {
  const clamp = n => Math.max(0, Math.min(255, Math.round(n)));
  return '#' + [clamp(r), clamp(g), clamp(b)].map(v => v.toString(16).padStart(2, '0')).join('');
}

export function shadeColor(hex, factor = -0.08) {
  const { r, g, b } = hexToRgb(hex);
  const adjust = c => factor < 0 ? c * (1 + factor) : c + (255 - c) * factor;
  return rgbToHex(adjust(r), adjust(g), adjust(b));
}

export function contrastColorFor(hex) {
  const { r, g, b } = hexToRgb(hex);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.58 ? '#181715' : '#faf8f5';
}

export function artworkColorFor(product = {}) {
  if (validHexColor(product.bgColor)) return product.bgColor.trim().toLowerCase();
  const img = String(product.images?.[0] || '');
  if (ASSET_BG_COLORS[img]) return ASSET_BG_COLORS[img];
  const seed = String(product.id || product.title || 'art');
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  return FALLBACK_ART_PALETTE[Math.abs(hash) % FALLBACK_ART_PALETTE.length];
}

export function artworkThemeStyle(product = {}, overrideHex = '') {
  const bg = validHexColor(overrideHex) ? overrideHex : artworkColorFor(product);
  const fg = contrastColorFor(bg);
  const hover = shadeColor(bg, fg === '#181715' ? -0.09 : 0.12);
  const border = shadeColor(bg, fg === '#181715' ? -0.18 : 0.22);
  return `--artwork-bg:${bg};--artwork-fg:${fg};--artwork-hover:${hover};--artwork-border:${border}`;
}

export function normalizeProduct(raw = {}) {
  const category = categoryOf(raw.category) ? raw.category : 'paintings';
  const images = (Array.isArray(raw.images) ? raw.images : []).map(v => safeImage(v));
  const backupImages = (Array.isArray(raw.backupImages) ? raw.backupImages : []).map(v => safeImage(v, '')).filter(Boolean).slice(0, 8);
  const bgColor = validHexColor(raw.bgColor) ? raw.bgColor.trim().toLowerCase() : '';
  const rawOrder = Number(raw.displayOrder ?? raw.sortOrder);
  const displayOrder = Number.isInteger(rawOrder) && rawOrder >= 0 ? rawOrder : 1000;
  return {
    ...raw,
    title: String(raw.title || 'Untitled'),
    artist: String(raw.artist || 'Suprita Chatterjee').trim() || 'Suprita Chatterjee',
    productType: String(raw.productType ?? '').trim().slice(0, 60) || 'Fridge Magnet',
    tag: String(raw.tag ?? '').trim().slice(0, 60),
    displayOrder,
    category,
    bgColor,
    material: String(raw.material || '').trim(),
    dimensions: String(raw.dimensions || '').trim(),
    care: String(raw.care || '').trim(),
    sku: String(raw.sku || '').trim(),
    refNumber: /^[1-9][0-9]{5}$/.test(String(raw.refNumber || '')) ? String(raw.refNumber) : '',
    price: Number.isFinite(Number(raw.price)) && Number(raw.price) >= 0 ? Number(raw.price) : 0,
    stock: Math.max(0, Math.floor(Number(raw.stock) || 0)),
    visible: raw.visible === true,
    inBanner: raw.inBanner !== false,
    images,
    backupImages,
    description: String(raw.description || '')
  };
}
export const ARTWORK_SORT_MODES = [
  ['manual', 'Manual order (↑ / ↓ & display order)'],
  ['featured', 'Featured first (✳)'],
  ['newest', 'Date added (newest first)'],
  ['oldest', 'Date added (oldest first)'],
  ['updated', 'Recently updated first'],
  ['title-asc', 'Alphabetical (A → Z)'],
  ['title-desc', 'Alphabetical (Z → A)'],
  ['price-asc', 'Price (low → high)'],
  ['price-desc', 'Price (high → low)']
];

function timestampOf(val) {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  if (typeof val.seconds === 'number') return val.seconds * 1000;
  return 0;
}

export function sortArtworks(list = [], mode = 'manual') {
  const sortMode = ARTWORK_SORT_MODES.some(([id]) => id === mode) ? mode : 'manual';
  return [...list].sort((a, b) => {
    if (sortMode === 'title-asc' || sortMode === 'title') {
      return String(a?.title || '').localeCompare(String(b?.title || '')) || String(a?.id || '').localeCompare(String(b?.id || ''));
    }
    if (sortMode === 'title-desc') {
      return String(b?.title || '').localeCompare(String(a?.title || '')) || String(a?.id || '').localeCompare(String(b?.id || ''));
    }
    if (sortMode === 'newest') {
      return (timestampOf(b?.createdAt) - timestampOf(a?.createdAt)) || (timestampOf(b?.updatedAt) - timestampOf(a?.updatedAt)) || String(b?.id || '').localeCompare(String(a?.id || ''));
    }
    if (sortMode === 'oldest') {
      return (timestampOf(a?.createdAt) - timestampOf(b?.createdAt)) || (timestampOf(a?.updatedAt) - timestampOf(b?.updatedAt)) || String(a?.id || '').localeCompare(String(b?.id || ''));
    }
    if (sortMode === 'updated') {
      return (timestampOf(b?.updatedAt) - timestampOf(a?.updatedAt)) || (timestampOf(b?.createdAt) - timestampOf(a?.createdAt)) || String(a?.id || '').localeCompare(String(b?.id || ''));
    }
    if (sortMode === 'price-asc') {
      return (Number(a?.price) || 0) - (Number(b?.price) || 0) || String(a?.title || '').localeCompare(String(b?.title || ''));
    }
    if (sortMode === 'price-desc') {
      return (Number(b?.price) || 0) - (Number(a?.price) || 0) || String(a?.title || '').localeCompare(String(b?.title || ''));
    }
    if (sortMode === 'featured') {
      const featDiff = Number(Boolean(b?.featured)) - Number(Boolean(a?.featured));
      if (featDiff !== 0) return featDiff;
    }
    const orderA = Number.isInteger(a?.displayOrder) ? a.displayOrder : 1000;
    const orderB = Number.isInteger(b?.displayOrder) ? b.displayOrder : 1000;
    if (orderA !== orderB) return orderA - orderB;
    const featDiff = Number(Boolean(b?.featured)) - Number(Boolean(a?.featured));
    if (featDiff !== 0) return featDiff;
    return String(a?.id || '').localeCompare(String(b?.id || ''));
  });
}
export function cartLines(cart, products) {
  if (!Array.isArray(cart)) return [];
  const seen = new Set();
  return cart.flatMap(item => {
    if (!item || typeof item.id !== 'string' || seen.has(item.id)) return [];
    seen.add(item.id);
    const product = products.find(p => p.id === item.id && p.visible);
    if (!product || !Number.isInteger(item.quantity) || item.quantity < 1 || product.stock < 1) return [];
    const quantity = Math.min(item.quantity, product.stock, MAX_ITEM_QUANTITY);
    return [{ product, quantity, total: Math.round(product.price * 100) * quantity / 100 }];
  });
}
export const subtotal = lines => lines.reduce((sum, line) => sum + Math.round(line.total * 100), 0) / 100;
export const totalWithShipping = lines => {
  const sub = subtotal(lines);
  const qty = (lines || []).reduce((sum, line) => sum + (Number(line?.quantity) || 0), 0);
  return sub > 0 ? Math.round((sub + shippingForQuantity(qty)) * 100) / 100 : 0;
};
export function filterProducts(products, { category = '', search = '', sort = 'featured', available = false, discounted = false, productType = '', artist = '' } = {}) {
  const query = search.trim().toLowerCase();
  const typeFilter = productType.trim().toLowerCase();
  const artistFilter = artist.trim().toLowerCase();
  const filtered = products.filter(p => {
    if (!p.visible) return false;
    if (category && p.category !== category) return false;
    if (available && p.stock <= 0) return false;
    if (discounted && !(Number(p.comparePrice) > Number(p.price))) return false;
    if (typeFilter && (p.productType || 'Fridge Magnet').trim().toLowerCase() !== typeFilter) return false;
    if (artistFilter) {
      const pArtistSlug = String(p.artist || 'Suprita Chatterjee').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      if (pArtistSlug !== artistFilter) return false;
    }
    if (query) {
      const hay = `${p.title} ${p.artist || ''} ${p.productType || ''} ${p.description} ${p.material || ''} ${categoryOf(p.category)?.name}`.toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  });
  const mode = sort === 'title' ? 'title-asc' : sort;
  return sortArtworks(filtered, mode);
}
export function validateCustomer(c) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email || '') || c.email.length > 254) return 'Enter a valid email address.';
  if (!c.firstName?.trim() || !c.lastName?.trim()) return 'Enter your first and last name.';
  if (!/^(?:\+91[ -]?)?[6-9]\d{9}$/.test((c.phone || '').replace(/\s/g,''))) return 'Enter a valid 10-digit Indian mobile number.';
  if (!c.address?.trim() || !c.city?.trim() || !c.state?.trim()) return 'Complete your delivery address.';
  if (!/^[1-9]\d{5}$/.test(c.postalCode || '')) return 'Enter a valid 6-digit PIN code.';
  if (c.country !== 'India') return 'Delivery is currently available within India.';
  if (!validLocation(c.location)) return 'Choose and confirm your delivery pin on the map.';
  if ([c.firstName,c.lastName,c.city,c.state].some(v => v.length > 100) || c.address.length > 300 || (c.apartment || '').length > 150 || (c.notes || '').length > 1000) return 'Please shorten the details in the form.';
  if (c.consent !== true) return 'Please allow us to use these details for your checkout request.';
  return '';
}

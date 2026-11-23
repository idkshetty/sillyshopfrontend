import { safeImage } from './commerce.js';
import { validImageSource } from './image-data.js';

export function artistSlug(name = '') {
  return String(name || 'artist')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'artist';
}

export function safeArtistLink(value = '', kind = 'website') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (kind === 'instagram' && /^@?[a-zA-Z0-9._]{1,60}$/.test(raw)) {
    const handle = raw.replace(/^@/, '');
    return `https://instagram.com/${handle}`;
  }
  return /^https:\/\/[^\s<>"']+$/.test(raw) ? raw.slice(0, 300) : '';
}

export const DEFAULT_ARTISTS = [
  {
    id: 'suprita-chatterjee',
    name: 'Suprita Chatterjee',
    style: 'Hand-Sculpted Clay & Watercolour',
    location: 'Bengaluru, India',
    bannerEyebrow: 'hehe.cafe · resident artist',
    bannerTitle: '',
    oneLiner: 'Playful miniature clay frames paired with tender ink & watercolour characters.',
    about: 'Suprita Chatterjee creates one-of-a-kind hand-sculpted clay frames and original miniature watercolour paintings at hehe.cafe. Every piece is moulded, painted and varnished by hand so no two magnets or artworks are ever alike.',
    quote: '',
    photo: 'https://img3.pixhost.to/images/7410/814393231_artwork.jpg',
    bannerImage: '',
    accentColor: '#d96b43',
    worksHeading: '',
    instagram: '',
    website: '',
    visible: true,
    featured: true,
    sections: []
  }
];

function normalizeArtistSections(list) {
  if (!Array.isArray(list)) return [];
  const result = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const heading = String(item.heading || '').trim().slice(0, 120);
    const body = String(item.body || '').trim().slice(0, 2000);
    if (!heading && !body) continue;
    result.push({ heading, body });
    if (result.length >= 4) break;
  }
  return result;
}

export function normalizeArtist(raw = {}) {
  const name = String(raw.name || '').trim().slice(0, 120);
  const id = artistSlug(raw.id || name);
  const photo = raw.photo && validImageSource(raw.photo) ? safeImage(raw.photo, '') : '';
  const bannerImage = raw.bannerImage && validImageSource(raw.bannerImage) ? safeImage(raw.bannerImage, '') : '';
  const rawAccent = String(raw.accentColor || '').trim();
  const accentColor = /^#[0-9a-fA-F]{6}$/.test(rawAccent) ? rawAccent.toLowerCase() : '';
  return {
    id,
    name,
    style: String(raw.style || '').trim().slice(0, 120),
    location: String(raw.location || '').trim().slice(0, 100),
    bannerEyebrow: String(raw.bannerEyebrow || '').trim().slice(0, 80),
    bannerTitle: String(raw.bannerTitle || '').trim().slice(0, 120),
    oneLiner: String(raw.oneLiner || '').trim().slice(0, 220),
    about: String(raw.about || '').trim().slice(0, 4000),
    quote: String(raw.quote || '').trim().slice(0, 400),
    photo,
    bannerImage,
    accentColor,
    worksHeading: String(raw.worksHeading || '').trim().slice(0, 120),
    instagram: safeArtistLink(raw.instagram || '', 'instagram'),
    website: safeArtistLink(raw.website || '', 'website'),
    visible: raw.visible !== false,
    featured: raw.featured === true,
    sections: normalizeArtistSections(raw.sections)
  };
}

export function normalizeArtists(value) {
  const list = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? Object.values(value)
      : [];
  const seen = new Set();
  const normalized = [];
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const item = normalizeArtist(raw);
    if (!item.name || seen.has(item.id)) continue;
    seen.add(item.id);
    normalized.push(item);
    if (normalized.length >= 50) break;
  }
  return normalized.length ? normalized : DEFAULT_ARTISTS.map(a => normalizeArtist(a));
}

export function mergeArtistsWithProducts(savedArtists = [], products = [], { includeHidden = false } = {}) {
  const base = normalizeArtists(savedArtists);
  const map = new Map(base.map(a => [a.id, { ...a, artworkCount: 0, coverImage: a.photo || '' }]));
  const visibleProducts = (Array.isArray(products) ? products : []).filter(p => p && p.visible && !p.archived);

  for (const p of visibleProducts) {
    const artistName = String(p.artist || 'Suprita Chatterjee').trim() || 'Suprita Chatterjee';
    const slug = artistSlug(artistName);
    if (!map.has(slug)) {
      map.set(slug, normalizeArtist({
        id: slug,
        name: artistName,
        style: 'Independent Studio Artist',
        oneLiner: `Original handmade pieces by ${artistName} at hehe.cafe.`,
        about: `${artistName} creates small-batch original artworks and tactile pieces for hehe.cafe.`,
        photo: safeImage(p.images?.[0], 'https://img3.pixhost.to/images/7410/814393231_artwork.jpg')
      }));
      map.get(slug).artworkCount = 0;
      map.get(slug).coverImage = safeImage(p.images?.[0], 'https://img3.pixhost.to/images/7410/814393231_artwork.jpg');
    }
    const entry = map.get(slug);
    entry.artworkCount += 1;
    if (!entry.coverImage && p.images?.[0]) {
      entry.coverImage = safeImage(p.images[0], 'https://img3.pixhost.to/images/7410/814393231_artwork.jpg');
    }
  }

  for (const entry of map.values()) {
    if (!entry.coverImage) entry.coverImage = entry.photo || 'https://img3.pixhost.to/images/7410/814393231_artwork.jpg';
    if (!entry.style) entry.style = 'Independent Studio Artist';
    if (!entry.oneLiner) entry.oneLiner = `Original handmade pieces by ${entry.name} at hehe.cafe.`;
  }

  const combined = [...map.values()].filter(entry => includeHidden || entry.visible !== false);
  combined.sort((a, b) => Number(b.featured) - Number(a.featured));
  return combined;
}

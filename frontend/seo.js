import { SHIPPING_CHARGE } from './commerce.js';
import { artistSlug } from './artists.js';

export const SITE_ORIGIN = 'https://hehe.cafe';
export const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/assets/artwork-1.jpg`;
const DEFAULT_TITLE = 'hehe.cafe — Handmade Clay Magnets, Original Artworks & Prints in India';
const DEFAULT_DESC = 'Collect original handmade clay fridge magnets, miniature paintings, and tactile small-batch artworks by independent artists at hehe.cafe. Shipped artist-direct across India via India Post (₹40/item).';
const INDEX_ROBOTS = 'index, follow, max-image-preview:large, max-snippet:-1';
const NOINDEX_FOLLOW = 'noindex, follow';
const NOINDEX_NOFOLLOW = 'noindex, nofollow';

/** Resolve a storefront image path into a crawler-safe HTTPS URL. */
export function absoluteAssetUrl(src, origin = SITE_ORIGIN) {
  const base = String(origin || SITE_ORIGIN).replace(/\/+$/, '');
  const raw = String(src || '').trim();
  if (!raw || raw.startsWith('data:') || raw.startsWith('blob:')) return `${base}/assets/artwork-1.jpg`;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${base}/${raw.replace(/^\/+/, '')}`;
}

function summarize(text = '', fallback = DEFAULT_DESC, maxLen = 160) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  const base = clean || fallback;
  if (base.length <= maxLen) return base;
  return `${base.slice(0, maxLen - 1).trimEnd()}…`;
}

function productOfferNode(p, origin = SITE_ORIGIN) {
  const artist = String(p.artist || 'Suprita Chatterjee').trim() || 'Suprita Chatterjee';
  const url = `${origin}/#product/${encodeURIComponent(p.id)}`;
  return {
    '@type': 'Product',
    name: p.title || 'Original Artwork',
    sku: p.refNumber || p.sku || p.id,
    image: absoluteAssetUrl(p.images?.[0], origin),
    description: summarize(p.description, `${p.title || 'Original artwork'} handmade by ${artist}.`),
    material: p.material || undefined,
    brand: { '@type': 'Brand', name: 'hehe.cafe' },
    creator: { '@type': 'Person', name: artist },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'INR',
      price: String(Number(p.price) || 0),
      availability: p.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url,
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingRate: {
          '@type': 'MonetaryAmount',
          value: String(SHIPPING_CHARGE),
          currency: 'INR'
        },
        shippingDestination: {
          '@type': 'DefinedRegion',
          addressCountry: 'IN'
        }
      }
    }
  };
}

/** Build title, meta descriptions, robots directives, OG tags & JSON-LD for a storefront route. */
export function buildRouteSEO({ page = 'home', id = '', products = [], artists = [], content = {} } = {}) {
  const visibleProducts = (Array.isArray(products) ? products : []).filter(p => p && p.visible !== false && !p.archived);
  const visibleArtists = Array.isArray(artists) ? artists.filter(Boolean) : [];
  const canonical = `${SITE_ORIGIN}/`;
  const base = {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESC,
    robots: INDEX_ROBOTS,
    canonical,
    ogUrl: canonical,
    ogType: 'website',
    ogImage: DEFAULT_OG_IMAGE,
    ogImageAlt: 'Two Cats in a Meadow Frame — handmade clay magnet by Suprita Chatterjee at hehe.cafe',
    jsonLd: null
  };

  if (['admin', 'account', 'checkout'].includes(page)) {
    const pageName = page === 'admin' ? 'Studio Admin' : page === 'checkout' ? 'Checkout' : 'Your Account';
    return {
      ...base,
      title: `${pageName} | hehe.cafe`,
      description: `Private ${pageName.toLowerCase()} area on hehe.cafe.`,
      robots: NOINDEX_NOFOLLOW,
      jsonLd: null
    };
  }

  if (page === 'search') {
    let q = '';
    try { q = decodeURIComponent(String(id || '')).trim(); } catch { q = String(id || '').trim(); }
    return {
      ...base,
      title: q ? `Search: ${q} | hehe.cafe` : 'Search Artworks | hehe.cafe',
      description: q ? `Browse handmade artworks matching "${q}" at hehe.cafe.` : DEFAULT_DESC,
      robots: NOINDEX_FOLLOW
    };
  }

  if (page === 'product') {
    const p = visibleProducts.find(item => item.id === id);
    if (!p) {
      return {
        ...base,
        title: 'Artwork | hehe.cafe',
        description: DEFAULT_DESC
      };
    }
    const artist = String(p.artist || 'Suprita Chatterjee').trim() || 'Suprita Chatterjee';
    const productType = String(p.productType || 'Handmade Artwork').trim();
    const productUrl = `${SITE_ORIGIN}/#product/${encodeURIComponent(p.id)}`;
    const priceLabel = Number.isFinite(Number(p.price)) ? `₹${p.price}` : '';
    const descFallback = `${p.title} (${productType}) by ${artist}.${p.material ? ` ${p.material}.` : ''} Shipped via India Post for ₹${SHIPPING_CHARGE}.`;
    return {
      ...base,
      title: `${p.title} by ${artist}${priceLabel ? ` — ${priceLabel}` : ''} | hehe.cafe`,
      description: summarize(p.description, descFallback),
      ogType: 'product',
      ogUrl: productUrl,
      ogImage: absoluteAssetUrl(p.images?.[0]),
      ogImageAlt: `${p.title} by ${artist}`,
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          {
            ...productOfferNode(p),
            '@id': productUrl
          },
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'hehe.cafe', item: canonical },
              { '@type': 'ListItem', position: 2, name: 'All artworks', item: `${SITE_ORIGIN}/#shop` },
              { '@type': 'ListItem', position: 3, name: p.title, item: productUrl }
            ]
          }
        ]
      }
    };
  }

  if (page === 'artists') {
    return {
      ...base,
      title: 'Independent Artists — Meet the Makers | hehe.cafe',
      description: summarize(content?.artists?.description, 'Meet the independent Indian artists crafting handmade clay magnets, miniature paintings, and studio editions at hehe.cafe.'),
      ogUrl: `${SITE_ORIGIN}/#artists`,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Independent Artists | hehe.cafe',
        url: `${SITE_ORIGIN}/#artists`,
        mainEntity: {
          '@type': 'ItemList',
          itemListElement: visibleArtists.slice(0, 20).map((a, idx) => ({
            '@type': 'ListItem',
            position: idx + 1,
            item: {
              '@type': 'Person',
              name: a.name,
              description: summarize(a.oneLiner || a.about, a.style || 'Independent Studio Artist'),
              image: absoluteAssetUrl(a.coverImage || a.photo),
              url: `${SITE_ORIGIN}/#artist/${encodeURIComponent(a.id || artistSlug(a.name))}`
            }
          }))
        }
      }
    };
  }

  if (page === 'artist') {
    const artist = visibleArtists.find(a => (a.id || artistSlug(a.name)) === id);
    if (!artist) {
      return {
        ...base,
        title: 'Artist Profile | hehe.cafe'
      };
    }
    const artistUrl = `${SITE_ORIGIN}/#artist/${encodeURIComponent(artist.id || id)}`;
    const sameAs = [artist.instagram, artist.website].filter(u => typeof u === 'string' && /^https:\/\//i.test(u));
    return {
      ...base,
      title: `${artist.name} — ${artist.style || 'Independent Studio Artist'} | hehe.cafe`,
      description: summarize(artist.about || artist.oneLiner, `Original handmade artworks by ${artist.name} on hehe.cafe.`),
      ogType: 'profile',
      ogUrl: artistUrl,
      ogImage: absoluteAssetUrl(artist.coverImage || artist.photo),
      ogImageAlt: `${artist.name} studio portrait on hehe.cafe`,
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'ProfilePage',
            url: artistUrl,
            mainEntity: {
              '@type': 'Person',
              name: artist.name,
              description: summarize(artist.about || artist.oneLiner, artist.style || 'Independent Studio Artist'),
              image: absoluteAssetUrl(artist.coverImage || artist.photo),
              ...(sameAs.length ? { sameAs } : {})
            }
          },
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'hehe.cafe', item: canonical },
              { '@type': 'ListItem', position: 2, name: 'Artists', item: `${SITE_ORIGIN}/#artists` },
              { '@type': 'ListItem', position: 3, name: artist.name, item: artistUrl }
            ]
          }
        ]
      }
    };
  }

  if (page === 'info') {
    const validPolicy = ['contact', 'shipping', 'refunds', 'privacy', 'terms'].includes(id);
    const title = (validPolicy && content?.pages?.[`${id}Title`]) || 'Studio Information';
    const rawBody = (validPolicy && content?.pages?.[`${id}Body`]) || '';
    const cleanedBody = String(rawBody).replace(/^Last updated:.*$/im, '').trim();
    const infoUrl = validPolicy ? `${SITE_ORIGIN}/#info/${id}` : canonical;
    return {
      ...base,
      title: `${title} | hehe.cafe`,
      description: summarize(cleanedBody, `${title} for hehe.cafe online art storefront.`),
      ogUrl: infoUrl,
      jsonLd: validPolicy ? {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': id === 'contact' ? 'ContactPage' : 'WebPage',
            name: `${title} | hehe.cafe`,
            url: infoUrl
          },
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'hehe.cafe', item: canonical },
              { '@type': 'ListItem', position: 2, name: title, item: infoUrl }
            ]
          }
        ]
      } : null
    };
  }

  if (page === 'about') {
    return {
      ...base,
      title: 'About hehe.cafe — Artist-Direct Handmade Art Gallery in India',
      description: summarize(content?.story?.text1, DEFAULT_DESC),
      ogUrl: `${SITE_ORIGIN}/#about`,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'AboutPage',
        name: 'About hehe.cafe',
        url: `${SITE_ORIGIN}/#about`
      }
    };
  }

  const isShop = ['shop', 'collection'].includes(page);
  const items = visibleProducts.slice(0, 20).map((p, idx) => ({
    '@type': 'ListItem',
    position: idx + 1,
    item: productOfferNode(p)
  }));
  return {
    ...base,
    title: isShop ? 'All Artworks — Handmade Clay Magnets & Original Paintings | hehe.cafe' : DEFAULT_TITLE,
    description: isShop ? summarize(content?.home?.shopDescription, DEFAULT_DESC) : DEFAULT_DESC,
    ogUrl: isShop ? `${SITE_ORIGIN}/#shop` : canonical,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: isShop ? 'All Artworks | hehe.cafe' : 'hehe.cafe Online Art Gallery',
      url: isShop ? `${SITE_ORIGIN}/#shop` : canonical,
      description: DEFAULT_DESC,
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: visibleProducts.length,
        itemListElement: items
      }
    }
  };
}

function upsertMeta(doc, attrName, attrValue, content) {
  let el = doc.head.querySelector(`meta[${attrName}="${attrValue}"]`);
  if (!el) {
    el = doc.createElement('meta');
    el.setAttribute(attrName, attrValue);
    doc.head.append(el);
  }
  el.setAttribute('content', String(content ?? ''));
}

function upsertLink(doc, rel, href) {
  let el = doc.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = doc.createElement('link');
    el.setAttribute('rel', rel);
    doc.head.append(el);
  }
  el.setAttribute('href', String(href ?? ''));
}

/** Synchronize document title, meta tags, canonical link, OG/Twitter tags, and dynamic JSON-LD. */
export function applyRouteSEO(params = {}, doc = globalThis.document) {
  if (!doc?.head) return null;
  const seo = buildRouteSEO(params);
  doc.title = seo.title;
  upsertMeta(doc, 'name', 'description', seo.description);
  upsertMeta(doc, 'name', 'robots', seo.robots);
  upsertLink(doc, 'canonical', seo.canonical);
  upsertMeta(doc, 'property', 'og:type', seo.ogType);
  upsertMeta(doc, 'property', 'og:title', seo.title);
  upsertMeta(doc, 'property', 'og:description', seo.description);
  upsertMeta(doc, 'property', 'og:url', seo.ogUrl || seo.canonical);
  upsertMeta(doc, 'property', 'og:image', seo.ogImage);
  upsertMeta(doc, 'property', 'og:image:alt', seo.ogImageAlt);
  upsertMeta(doc, 'name', 'twitter:title', seo.title);
  upsertMeta(doc, 'name', 'twitter:description', seo.description);
  upsertMeta(doc, 'name', 'twitter:image', seo.ogImage);
  upsertMeta(doc, 'name', 'twitter:image:alt', seo.ogImageAlt);

  let scriptEl = doc.getElementById('seo-jsonld-dynamic');
  if (!scriptEl) {
    scriptEl = doc.createElement('script');
    scriptEl.type = 'application/ld+json';
    scriptEl.id = 'seo-jsonld-dynamic';
    doc.head.append(scriptEl);
  }
  scriptEl.textContent = seo.jsonLd ? JSON.stringify(seo.jsonLd).replace(/</g, '\\u003c') : '';
  return seo;
}

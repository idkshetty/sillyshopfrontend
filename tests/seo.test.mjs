import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';
import { buildRouteSEO, applyRouteSEO, absoluteAssetUrl, SITE_ORIGIN } from '../frontend/seo.js';
import { DEFAULT_CONTENT } from '../frontend/store-content.js';

test('absoluteAssetUrl resolves relative assets and falls back on data URIs', () => {
  assert.equal(absoluteAssetUrl('assets/artwork-2.jpg'), `${SITE_ORIGIN}/assets/artwork-2.jpg`);
  assert.equal(absoluteAssetUrl('https://cdn.example.com/art.webp'), 'https://cdn.example.com/art.webp');
  assert.equal(absoluteAssetUrl('data:image/webp;base64,AAAA'), 'https://iili.io/ofJ6Nr7.jpg');
});

test('buildRouteSEO generates Product JSON-LD, Artist ProfilePage, Policy schema & noindex private routes', () => {
  const sampleProducts = [
    { id: 'p1', refNumber: '610001', title: 'Two Cats', artist: 'Suprita Chatterjee', productType: 'Fridge Magnet', description: 'Hand-sculpted clay frame.', price: 250, stock: 1, visible: true, images: ['assets/artwork-1.jpg'], material: 'Clay & watercolour' },
    { id: 'p2', title: 'Hidden Work', price: 300, stock: 0, visible: false, images: ['assets/artwork-2.jpg'] }
  ];
  const sampleArtists = [
    { id: 'suprita-chatterjee', name: 'Suprita Chatterjee', style: 'Clay & Watercolor', oneLiner: 'Tiny painted worlds.', coverImage: 'assets/artwork-1.jpg', instagram: 'https://instagram.com/suprita' }
  ];

  const homeSeo = buildRouteSEO({ page: 'home', products: sampleProducts, artists: sampleArtists, content: DEFAULT_CONTENT });
  assert.equal(homeSeo.canonical, `${SITE_ORIGIN}/`);
  assert.match(homeSeo.robots, /index, follow/);
  assert.equal(homeSeo.jsonLd['@type'], 'CollectionPage');
  assert.equal(homeSeo.jsonLd.mainEntity.numberOfItems, 1);

  const prodSeo = buildRouteSEO({ page: 'product', id: 'p1', products: sampleProducts, artists: sampleArtists, content: DEFAULT_CONTENT });
  assert.match(prodSeo.title, /Two Cats by Suprita Chatterjee/);
  assert.match(prodSeo.title, /₹250/);
  assert.equal(prodSeo.ogType, 'product');
  assert.equal(prodSeo.jsonLd['@graph'][0]['@type'], 'Product');
  assert.equal(prodSeo.jsonLd['@graph'][0].offers.priceCurrency, 'INR');
  assert.equal(prodSeo.jsonLd['@graph'][0].offers.price, '250');
  assert.equal(prodSeo.jsonLd['@graph'][0].offers.availability, 'https://schema.org/InStock');
  assert.equal(prodSeo.jsonLd['@graph'][0].offers.shippingDetails.shippingRate.value, '40');
  assert.equal(prodSeo.jsonLd['@graph'][1]['@type'], 'BreadcrumbList');

  const artistSeo = buildRouteSEO({ page: 'artist', id: 'suprita-chatterjee', products: sampleProducts, artists: sampleArtists, content: DEFAULT_CONTENT });
  assert.match(artistSeo.title, /Suprita Chatterjee/);
  assert.equal(artistSeo.ogType, 'profile');
  assert.equal(artistSeo.jsonLd['@graph'][0]['@type'], 'ProfilePage');
  assert.deepEqual(artistSeo.jsonLd['@graph'][0].mainEntity.sameAs, ['https://instagram.com/suprita']);

  const contactSeo = buildRouteSEO({ page: 'info', id: 'contact', content: DEFAULT_CONTENT });
  assert.equal(contactSeo.jsonLd['@graph'][0]['@type'], 'ContactPage');

  for (const priv of ['admin', 'account', 'checkout']) {
    const s = buildRouteSEO({ page: priv });
    assert.equal(s.robots, 'noindex, nofollow');
    assert.equal(s.jsonLd, null);
  }
});

test('applyRouteSEO updates head tags safely and escapes closing script tags in JSON-LD', () => {
  const { document } = parseHTML('<!doctype html><html><head><title>Init</title><meta name="description" content=""><meta property="og:image" content=""></head><body></body></html>');
  const injectedProduct = { id: 'xss', title: 'Art </script><script>alert(1)</script>', artist: 'Tester', price: 199, stock: 1, visible: true, images: ['assets/artwork-3.jpg'] };
  applyRouteSEO({ page: 'product', id: 'xss', products: [injectedProduct], content: DEFAULT_CONTENT }, document);

  assert.match(document.title, /Art <\/script>/);
  assert.equal(document.head.querySelector('link[rel="canonical"]').getAttribute('href'), `${SITE_ORIGIN}/`);
  assert.equal(document.head.querySelector('meta[property="og:image"]').getAttribute('content'), `${SITE_ORIGIN}/assets/artwork-3.jpg`);
  const jsonLdText = document.getElementById('seo-jsonld-dynamic').textContent;
  assert(!jsonLdText.includes('</script>'), 'JSON-LD must escape closing script tags');
  assert.match(jsonLdText, /\\u003c\/script>/);
});

test('static crawl files and HTML metadata are properly configured for hehe.cafe', () => {
  const robots = readFileSync(new URL('../frontend/robots.txt', import.meta.url), 'utf8');
  assert.match(robots, /Sitemap:\s*https:\/\/hehe\.cafe\/sitemap\.xml/);
  assert.match(robots, /Disallow:\s*\/admin\.html/);

  const sitemap = readFileSync(new URL('../frontend/sitemap.xml', import.meta.url), 'utf8');
  assert.match(sitemap, /<loc>https:\/\/hehe\.cafe\/<\/loc>/);
  assert(!sitemap.includes('#'), 'sitemap must not contain fragment URLs');

  const manifest = JSON.parse(readFileSync(new URL('../frontend/manifest.webmanifest', import.meta.url), 'utf8'));
  assert.equal(manifest.short_name, 'hehe.cafe');

  const indexHtml = readFileSync(new URL('../frontend/index.html', import.meta.url), 'utf8');
  assert.match(indexHtml, /<link rel="canonical" href="https:\/\/hehe\.cafe\/">/);
  assert.match(indexHtml, /<meta property="og:title"/);
  assert.match(indexHtml, /<meta name="twitter:card"/);
  assert.match(indexHtml, /id="seo-jsonld-base"/);

  const shopHtml = readFileSync(new URL('../frontend/shop.html', import.meta.url), 'utf8');
  assert.match(shopHtml, /content="noindex, follow"/);

  const adminHtml = readFileSync(new URL('../frontend/admin.html', import.meta.url), 'utf8');
  const checkoutHtml = readFileSync(new URL('../frontend/checkout.html', import.meta.url), 'utf8');
  assert.match(adminHtml, /content="noindex, nofollow"/);
  assert.match(checkoutHtml, /content="noindex, nofollow"/);
});

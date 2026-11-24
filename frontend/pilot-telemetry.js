// Detailed storefront behavioral telemetry: active time, section dwell, scroll depth & click heatmap coordinates.

const SECTION_SELECTORS = [
  ['bag', '#cart-dialog[open]'],
  ['hero', '[data-hero-banner]'],
  ['artworks', '#artworks'],
  ['product', '.product-immersive-hero, .product-detail-panel'],
  ['checkout', '#checkout-form'],
  ['story', '.story-block'],
  ['reviews', '#reviews, .reviews-section'],
  ['artists', '.artists-page, .artist-profile-banner'],
  ['shop', '.product-grid'],
  ['footer', '#footer'],
  ['header', '.site-header']
];

function detectSectionFromEl(target) {
  if (!target || typeof target.closest !== 'function') return 'other';
  for (const [name, sel] of SECTION_SELECTORS) {
    if (target.closest(sel)) return name;
  }
  return 'other';
}

function summarizeClickTarget(el) {
  if (!el || typeof el.closest !== 'function') return '';
  const actionable = el.closest('[data-action], button, a, summary, input[type="submit"]');
  const node = actionable || el.closest('[data-product-card]') || el;
  const action = node?.dataset?.action || '';
  const aria = node?.getAttribute?.('aria-label') || '';
  const cardTitle = el.closest('[data-product-card]')?.querySelector('h2, h3, .product-topbar-title')?.textContent?.trim() || '';
  const text = (node?.textContent || '').replace(/\s+/g, ' ').trim();
  if (action === 'add' || action === 'add-detail') return `Add to bag${cardTitle ? `: ${cardTitle}` : ''}`.slice(0, 80);
  if (action === 'quick-buy' || action === 'buy-now') return `Buy now${cardTitle ? `: ${cardTitle}` : ''}`.slice(0, 80);
  if (action === 'set-bag-attachment') return `Attachment: ${node?.dataset?.attachmentId || text}`.slice(0, 80);
  if (cardTitle && el.closest('a[href^="#product/"]')) return `Open: ${cardTitle}`.slice(0, 80);
  return (aria || text || action || 'Page click').slice(0, 80);
}

function extractProductId(el) {
  if (!el || typeof el.closest !== 'function') return '';
  const byAttr = el.closest('[data-product-id]')?.dataset?.productId || el.closest('[data-id]')?.dataset?.id || '';
  if (byAttr && /^[a-zA-Z0-9_-]{2,128}$/.test(byAttr)) return byAttr;
  const href = el.closest('a[href^="#product/"]')?.getAttribute('href') || '';
  const m = /^#product\/([a-zA-Z0-9_-]{2,128})$/.exec(href);
  return m ? m[1] : '';
}

function currentScrollPct() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return 0;
  const docEl = document.documentElement;
  const docH = Math.max(docEl?.scrollHeight || 0, document.body?.scrollHeight || 0, window.innerHeight || 1);
  const reached = (window.scrollY || window.pageYOffset || 0) + (window.innerHeight || 0);
  return Math.max(0, Math.min(100, Math.round((reached / docH) * 100)));
}

function detectViewportCenterSection(page) {
  const bagOpen = Boolean(document.querySelector('#cart-dialog[open]'));
  if (bagOpen) return 'bag';
  const midY = (window.innerHeight || 700) * 0.45;
  let best = '';
  let bestDist = Infinity;
  for (const [name, sel] of SECTION_SELECTORS) {
    if (name === 'bag' || name === 'header') continue;
    const node = document.querySelector(sel);
    if (!node || node.hidden) continue;
    const rect = node.getBoundingClientRect();
    if (rect.height < 20) continue;
    if (rect.top <= midY && rect.bottom >= midY) return name;
    const dist = Math.min(Math.abs(rect.top - midY), Math.abs(rect.bottom - midY));
    if (dist < bestDist) {
      bestDist = dist;
      best = name;
    }
  }
  return best || page || 'other';
}

export function mountPilotTelemetry({ getRoute, getVisitorId, sendEvent, isSuppressed }) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { flushNow() {}, destroy() {} };
  }

  let lastActivityAt = Date.now();
  let currentPage = getRoute?.()?.page || 'home';
  let pendingDurationSec = 0;
  let maxScrollPct = currentScrollPct();
  let flushedMaxScroll = 0;
  const pendingDwell = Object.create(null);
  const recentClickMap = new Map();

  const touchActivity = () => {
    lastActivityAt = Date.now();
  };

  const onScroll = () => {
    touchActivity();
    if (isSuppressed?.()) return;
    const pct = currentScrollPct();
    if (pct > maxScrollPct) maxScrollPct = pct;
  };

  const onClick = event => {
    touchActivity();
    if (isSuppressed?.()) return;
    const vid = getVisitorId?.();
    if (!vid) return;
    const page = getRoute?.()?.page || 'home';
    if (page === 'admin') return;
    const docEl = document.documentElement;
    const docW = Math.max(docEl?.scrollWidth || 0, window.innerWidth || 1);
    const docH = Math.max(docEl?.scrollHeight || 0, document.body?.scrollHeight || 0, window.innerHeight || 1);
    const pageX = Number.isFinite(event.pageX) ? event.pageX : ((event.clientX || 0) + (window.scrollX || 0));
    const pageY = Number.isFinite(event.pageY) ? event.pageY : ((event.clientY || 0) + (window.scrollY || 0));
    const xPct = Math.max(0, Math.min(100, Math.round((pageX / docW) * 1000) / 10));
    const yPct = Math.max(0, Math.min(100, Math.round((pageY / docH) * 1000) / 10));
    const section = detectSectionFromEl(event.target);
    const targetLabel = summarizeClickTarget(event.target);
    const productId = extractProductId(event.target);

    if (productId) {
      const now = Date.now();
      if (now - (recentClickMap.get(productId) || 0) < 1800) return;
      recentClickMap.set(productId, now);
    }

    void sendEvent('click', {
      page,
      section,
      targetLabel,
      xPct,
      yPct,
      viewportW: window.innerWidth || 0,
      viewportH: window.innerHeight || 0,
      ...(productId ? { productId } : {})
    });
  };

  function flushEngagement({ force = false } = {}) {
    if (isSuppressed?.()) return;
    const page = getRoute?.()?.page || currentPage || 'home';
    if (page === 'admin') return;
    const hasDwell = Object.keys(pendingDwell).length > 0;
    const scrollGrew = maxScrollPct > flushedMaxScroll;
    if (!force && pendingDurationSec < 2 && !scrollGrew && !hasDwell) return;
    if (pendingDurationSec === 0 && !scrollGrew && !hasDwell) return;

    const payload = {
      page: currentPage || page,
      durationSec: pendingDurationSec,
      maxScrollPct,
      sectionDwell: { ...pendingDwell }
    };
    pendingDurationSec = 0;
    flushedMaxScroll = maxScrollPct;
    for (const k of Object.keys(pendingDwell)) delete pendingDwell[k];
    void sendEvent('engage', payload);
  }

  const secondTimer = setInterval(() => {
    if (document.visibilityState !== 'visible' || isSuppressed?.()) return;
    const now = Date.now();
    if (now - lastActivityAt > 45000) return;
    const page = getRoute?.()?.page || 'home';
    if (page === 'admin') return;
    if (page !== currentPage) {
      flushEngagement({ force: true });
      currentPage = page;
      maxScrollPct = currentScrollPct();
      flushedMaxScroll = 0;
    }
    pendingDurationSec += 1;
    const sec = detectViewportCenterSection(page);
    if (sec) pendingDwell[sec] = (pendingDwell[sec] || 0) + 1;
    if (pendingDurationSec >= 12) flushEngagement();
  }, 1000);

  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') flushEngagement({ force: true });
    else touchActivity();
  };

  const onPageHide = () => flushEngagement({ force: true });
  const onHashChange = () => {
    const nextPage = getRoute?.()?.page || 'home';
    if (nextPage !== currentPage) {
      flushEngagement({ force: true });
      currentPage = nextPage;
      maxScrollPct = currentScrollPct();
      flushedMaxScroll = 0;
    }
  };

  window.addEventListener('pointerdown', touchActivity, { passive: true });
  window.addEventListener('keydown', touchActivity, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('click', onClick, true);
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('hashchange', onHashChange);

  return {
    flushNow() { flushEngagement({ force: true }); },
    noteProductView(productId) {
      if (!productId || isSuppressed?.()) return;
      const now = Date.now();
      if (now - (recentClickMap.get(productId) || 0) < 1800) return;
      recentClickMap.set(productId, now);
      void sendEvent('click', {
        page: getRoute?.()?.page || 'product',
        section: 'product',
        targetLabel: 'View product detail',
        productId
      });
    },
    destroy() {
      clearInterval(secondTimer);
      window.removeEventListener('pointerdown', touchActivity);
      window.removeEventListener('keydown', touchActivity);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('hashchange', onHashChange);
    }
  };
}

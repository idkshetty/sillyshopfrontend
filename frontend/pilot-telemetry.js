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

function classifyPilotClick(el) {
  if (!el || typeof el.closest !== 'function') return { major: false, action: '', deadClick: false };
  const interactive = el.closest('[data-action], [data-pilot-major], a[href], button, input, select, textarea, summary, label, [role="button"]');
  const actAttr = interactive?.dataset?.action || '';
  const href = interactive?.getAttribute?.('href') || '';
  const pid = extractProductId(el);
  let major = false;
  let action = '';
  if (actAttr === 'add' || actAttr === 'add-detail') { major = true; action = 'add_to_bag'; }
  else if (actAttr === 'buy-now' || actAttr === 'quick-buy') { major = true; action = 'buy_now'; }
  else if (actAttr === 'cart') { major = true; action = 'bag_open'; }
  else if (actAttr === 'cart-checkout' || actAttr === 'checkout-next' || actAttr === 'checkout-edit-step') { major = true; action = 'checkout_next'; }
  else if (actAttr === 'set-bag-attachment' || actAttr === 'toggle-bag-attach-preview') { major = true; action = 'back_attachment'; }
  else if (actAttr === 'search' || actAttr === 'apply-promo') { major = true; action = actAttr === 'search' ? 'search' : 'promo'; }
  else if (actAttr === 'toggle-filter-menu' || actAttr === 'filter-chip' || actAttr === 'reset-filters') { major = true; action = 'filter'; }
  else if (interactive?.id === 'checkout-submit' || interactive?.dataset?.pilotMajor) { major = true; action = interactive.dataset?.pilotMajor || 'cta'; }
  else if (href.startsWith('#product/') || pid) { major = true; action = 'product_view'; }
  else if (href.startsWith('#artist/')) { major = true; action = 'artist_link'; }
  else if (interactive?.matches?.('button.button, a.button')) { major = true; action = 'cta'; }
  return { major, action, deadClick: !interactive };
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
    return { noteProductView() {}, noteFunnel() {}, flushNow() {}, destroy() {} };
  }

  let lastActivityAt = Date.now();
  let currentPage = getRoute?.()?.page || 'home';
  let pendingDurationSec = 0;
  let maxScrollPct = currentScrollPct();
  let flushedMaxScroll = 0;
  const pendingDwell = Object.create(null);
  const pendingClicks = [];
  const pendingFunnel = new Set();
  const recentClickMap = new Map();
  const rageHistory = [];
  let debounceFlushTimer = null;

  const touchActivity = () => {
    lastActivityAt = Date.now();
  };

  const onScroll = () => {
    touchActivity();
    if (isSuppressed?.()) return;
    const pct = currentScrollPct();
    if (pct > maxScrollPct) maxScrollPct = pct;
  };

  function detectRageClick(x, y, now) {
    rageHistory.push({ x, y, at: now });
    while (rageHistory.length && now - rageHistory[0].at > 1500) rageHistory.shift();
    if (rageHistory.length < 3) return false;
    return rageHistory.filter(p => Math.hypot(p.x - x, p.y - y) <= 40).length >= 3;
  }

  function scheduleChunkFlush(delayMs = 1500) {
    if (debounceFlushTimer) clearTimeout(debounceFlushTimer);
    debounceFlushTimer = setTimeout(() => {
      debounceFlushTimer = null;
      flushEngagement();
    }, delayMs);
  }

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
    const { major, action, deadClick } = classifyPilotClick(event.target);
    const rageClick = detectRageClick(event.clientX || 0, event.clientY || 0, Date.now());

    if (action === 'product_view') pendingFunnel.add('product_view');
    if (action === 'add_to_bag' || action === 'buy_now') pendingFunnel.add('add_to_bag');
    if (action === 'bag_open') pendingFunnel.add('bag_open');
    if (action === 'checkout_next') pendingFunnel.add('checkout_start');

    if (productId) {
      const now = Date.now();
      if (now - (recentClickMap.get(productId) || 0) < 1800) return;
      recentClickMap.set(productId, now);
    }

    pendingClicks.push({
      page,
      section,
      targetLabel,
      xPct,
      yPct,
      major,
      ...(action ? { action } : {}),
      ...(deadClick ? { deadClick: true } : {}),
      ...(rageClick ? { rageClick: true } : {}),
      path: location.hash || `#${page}`,
      viewportW: window.innerWidth || 0,
      viewportH: window.innerHeight || 0,
      at: Date.now(),
      ...(productId ? { productId } : {})
    });
    if (pendingClicks.length > 25) pendingClicks.shift();
    if (pendingClicks.length >= 20) {
      if (debounceFlushTimer) { clearTimeout(debounceFlushTimer); debounceFlushTimer = null; }
      flushEngagement({ force: true });
    } else if (major || rageClick) {
      scheduleChunkFlush(1500);
    }
  };

  function flushEngagement({ force = false, exited = false } = {}) {
    if (isSuppressed?.()) return;
    if (debounceFlushTimer) { clearTimeout(debounceFlushTimer); debounceFlushTimer = null; }
    const page = getRoute?.()?.page || currentPage || 'home';
    if (page === 'admin') return;
    const hasDwell = Object.keys(pendingDwell).length > 0;
    const hasClicks = pendingClicks.length > 0;
    const hasFunnel = pendingFunnel.size > 0;
    const scrollGrew = maxScrollPct > flushedMaxScroll;
    if (!force && !exited && !hasClicks && !hasFunnel && pendingDurationSec < 2 && !scrollGrew && !hasDwell) return;
    if (!exited && !hasClicks && !hasFunnel && pendingDurationSec === 0 && !scrollGrew && !hasDwell) return;

    const clicks = pendingClicks.splice(0, 25);
    const funnelSteps = [...pendingFunnel];
    pendingFunnel.clear();
    const payload = {
      page: currentPage || page,
      durationSec: pendingDurationSec,
      maxScrollPct,
      sectionDwell: { ...pendingDwell },
      viewportW: window.innerWidth || 0,
      viewportH: window.innerHeight || 0,
      ...(funnelSteps.length ? { funnelSteps } : {}),
      ...(exited ? { exited: true } : {}),
      ...(clicks.length ? { clicks } : {})
    };
    pendingDurationSec = 0;
    flushedMaxScroll = maxScrollPct;
    for (const k of Object.keys(pendingDwell)) delete pendingDwell[k];
    void sendEvent(clicks.length ? 'batch' : 'engage', payload);
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
    // Chunked passive flush every 45s — sends zero pings while idle
    if (pendingDurationSec >= 45) flushEngagement();
  }, 1000);

  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') flushEngagement({ force: true, exited: true });
    else touchActivity();
  };

  const onPageHide = () => flushEngagement({ force: true, exited: true });
  const onHashChange = () => {
    const nextPage = getRoute?.()?.page || 'home';
    if (nextPage !== currentPage) {
      flushEngagement({ force: true });
      currentPage = nextPage;
      maxScrollPct = currentScrollPct();
      flushedMaxScroll = 0;
      if (nextPage === 'product') pendingFunnel.add('product_view');
      if (nextPage === 'checkout') pendingFunnel.add('checkout_start');
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
    flushNow(opts = {}) { flushEngagement({ force: true, ...(opts || {}) }); },
    noteProductView(productId) {
      if (!productId || isSuppressed?.()) return;
      const now = Date.now();
      if (now - (recentClickMap.get(productId) || 0) < 1800) return;
      recentClickMap.set(productId, now);
      pendingFunnel.add('product_view');
      pendingClicks.push({
        page: getRoute?.()?.page || 'product',
        section: 'product',
        targetLabel: 'View artwork',
        action: 'product_view',
        major: true,
        path: location.hash || `#product/${productId}`,
        viewportW: window.innerWidth || 0,
        viewportH: window.innerHeight || 0,
        at: now,
        productId
      });
      if (pendingClicks.length > 25) pendingClicks.shift();
      if (pendingClicks.length >= 20) flushEngagement({ force: true });
      else scheduleChunkFlush(1500);
    },
    noteFunnel(step) {
      if (!step || isSuppressed?.()) return;
      pendingFunnel.add(String(step).slice(0, 32));
      scheduleChunkFlush(1500);
    },
    destroy() {
      if (debounceFlushTimer) clearTimeout(debounceFlushTimer);
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

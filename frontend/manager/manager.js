import {
  observeGoogleAuth,
  signInWithGoogle,
  signOutManager,
  callManager,
  uploadArtworkFiles
} from './manager-store.js?v=20261125j';
import {
  revenueTrendChartMarkup,
  genreVelocityMatrixMarkup,
  cafeComparisonChartMarkup,
  storeGenreStatsMarkup,
  storePriceBandsMarkup,
  openPrintableChallan,
  openPrintableSettlement
} from './manager-charts.js';
import {
  mountTrafficGlobe,
  resolveLocationCoords
} from './traffic-globe.js?v=20261125c';
import {
  pilotControlsMarkup,
  pilotTimelineSvgMarkup,
  pilotEngagementMarkup,
  pilotFunnelAndBreakdownsMarkup,
  pilotRecentClicksMarkup,
  pilotVisitorsLogMarkup,
  parseDatetimeLocalValue,
  describeCustomRangePreview,
  formatIstReadable,
  quickRangeBounds,
  toDatetimeLocalValue
} from '../pilot-analytics-ui.js?v=20261125f';

const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => '₹' + (Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const fmtDate = ts => ts ? new Date(Number(ts)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fmtDateTime = ts => ts ? new Date(Number(ts)).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtClock = ts => ts ? new Date(Number(ts)).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
const fmtAgo = ts => {
  const sec = Math.max(0, Math.floor((Date.now() - Number(ts || 0)) / 1000));
  if (sec < 10) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
};
const normKey = v => String(v || '').trim().replace(/\s+/g, ' ').toLowerCase();
const daysBetween = ms => (Number.isFinite(Number(ms)) && Number(ms) > 0) ? Math.max(0, Math.round((Date.now() - Number(ms)) / 86400000)) : 0;

const googleSvg = `<svg viewBox="0 0 256 262" aria-hidden="true"><path fill="#4285F4" d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622 38.755 30.023 2.685.268c24.659-22.774 38.875-56.282 38.875-96.027"/><path fill="#34A853" d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055-34.523 0-63.824-22.773-74.269-54.25l-1.531.13-40.298 31.187-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1"/><path fill="#FBBC05" d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82 0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602l42.356-32.782"/><path fill="#EB4335" d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0 79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251"/></svg>`;

const STAGES = [
  ['all', 'All'],
  ['intake', 'Intake'],
  ['curated', 'Curated'],
  ['delivery_bin', 'Pickup bin'],
  ['at_cafe', 'At café'],
  ['live_online', 'In hehe.cafe'],
  ['sold', 'Sold'],
  ['returned', 'Returned']
];
const STAGE_LABEL = Object.fromEntries(STAGES.filter(([k]) => k !== 'all'));

const KANBAN_COLUMNS = [
  ['intake', 'Intake'],
  ['curated', 'Curated'],
  ['delivery_bin', 'Pickup Bin'],
  ['at_cafe', 'At Café'],
  ['live_online', 'In hehe.cafe'],
  ['returned', 'Returned'],
  ['sold', 'Sold']
];

const BIN_STEP_LABELS = [
  ['selected', 'Selected'],
  ['packed', 'Packed'],
  ['handed_over', 'Handed over'],
  ['received_at_studio', 'Received']
];

const GENRE_PRESETS = ['Fridge Magnet', 'Clay Frame', 'Original Painting', 'DIY Kit', 'Coaster', 'Keychain', 'Ceramic Study'];

const NAV_ICONS = {
  analytics: '<path d="M3 3v18h18"/><path d="M7 15v-4"/><path d="M12 15V8"/><path d="M17 15v-6"/>',
  traffic: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  artworks: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
  site: '<path d="M3 9h18v11H3z"/><path d="M5 4h14l2 5H3z"/><path d="M9 14h6"/>',
  customers: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  bins: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  cafes: '<path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><path d="M6 2v3"/><path d="M10 2v3"/><path d="M14 2v3"/>',
  payouts: '<path d="M6 3h12"/><path d="M6 8h12"/><path d="m6 13 8.5 8"/><path d="M6 13h3a4 4 0 0 0 0-8"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'
};

const state = {
  authReady: false,
  googleUser: null,
  rawNonGoogleUser: null,
  me: null,
  loadingMe: false,
  meError: '',
  tab: 'analytics',
  range: 'all',
  loadingData: false,
  busy: false,
  dataError: '',
  analytics: null,
  payoutData: null,
  siteStockData: null,
  siteFilter: 'all',
  siteSearch: '',
  customerBagsData: null,
  customerFilter: 'in_bag',
  customerSearch: '',
  siteTraffic: null,
  trafficUpdatedAt: 0,
  trafficLivePaused: false,
  trafficGlobeMode: 'all',
  trafficFocusedLocKey: '',
  trafficPreset: 'all',
  trafficDevice: 'all',
  trafficFromMs: 0,
  trafficToMs: 0,
  trafficFromLocal: '',
  trafficToLocal: '',
  itemDemandSort: 'clicks',
  importSearch: '',
  artworks: [],
  cafes: [],
  cafeStock: [],
  batches: [],
  orders: [],
  users: [],
  activeCafeId: '',
  drawerArtworkId: '',
  lookupQuery: '',
  stageFilter: 'all',
  artSearch: '',
  artView: typeof window !== 'undefined' && window.innerWidth >= 900 ? 'kanban' : 'grid',
  selectedArtIds: new Set(),
  selectedUploadImages: [],
  selectedUploadBackups: [],
  uploadingPhotosText: '',
  curateImages: [],
  curateBackups: [],
  uploadPanelOpen: false,
  uploadGenreDraft: 'Fridge Magnet',
  dragArtId: '',
  binModal: null,
  reconModal: null
};

function setBusy(active) {
  state.busy = Boolean(active);
  const bar = $('mgr-busy-bar');
  if (bar) bar.hidden = !state.busy;
}

function showModalError(msg) {
  const alertEl = $('mgr-modal-alert');
  if (alertEl) {
    alertEl.textContent = msg;
    alertEl.hidden = !msg;
  }
}

let toastTimer = null;
function toast(msg, { isError = false } = {}) {
  if ($('mgr-dialog')?.open && isError) {
    showModalError(msg);
  }
  const el = $('mgr-toast');
  if (!el) return;
  clearTimeout(toastTimer);
  el.textContent = msg;
  el.hidden = false;
  toastTimer = setTimeout(() => { el.hidden = true; }, 4800);
}

const getRefCode = a => a?.refNumber || a?.storeRefNumber || '';

function artImgTag(a, idx = 0, extra = '') {
  const primary = a?.images?.[idx] || '';
  const fb = a?.backupImages?.[idx] || '';
  const initialSrc = fb || primary;
  if (!initialSrc) return '';
  const hasRemoteHd = Boolean(fb && primary && primary !== fb && /^https:\/\//i.test(primary));
  const hdAttr = hasRemoteHd ? ` data-hd-src="${esc(primary)}"` : '';
  const fbAttr = (fb && fb !== primary) ? ` data-fallback-src="${esc(fb)}"` : '';
  return `<img src="${esc(initialSrc)}"${hdAttr}${fbAttr} decoding="async" ${extra}>`;
}

const mgrHdCache = new Set();
const mgrHdObserver = typeof IntersectionObserver === 'function'
  ? new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const img = entry.target;
        mgrHdObserver.unobserve(img);
        const hdSrc = img.dataset.hdSrc;
        if (!hdSrc || img.dataset.hdLoaded === '1') continue;
        if (mgrHdCache.has(hdSrc)) {
          img.dataset.hdLoaded = '1';
          if (img.getAttribute('src') !== hdSrc) img.src = hdSrc;
          continue;
        }
        const loader = new Image();
        loader.decoding = 'async';
        loader.onload = () => {
          const apply = () => {
            mgrHdCache.add(hdSrc);
            if (!img.isConnected) return;
            img.dataset.hdLoaded = '1';
            img.src = hdSrc;
          };
          if (typeof loader.decode === 'function') loader.decode().then(apply, apply);
          else apply();
        };
        loader.src = hdSrc;
      }
    }, { rootMargin: '360px 0px' })
  : null;
if (mgrHdObserver && typeof MutationObserver === 'function') {
  new MutationObserver(() => {
    document.querySelectorAll('img[data-hd-src]:not([data-hd-watched])').forEach(img => {
      img.dataset.hdWatched = '1';
      mgrHdObserver.observe(img);
    });
  }).observe(document.body, { childList: true, subtree: true });
}

// Automatic runtime fallback to Firebase Base64 backup if a Freeimage.host link ever breaks
document.addEventListener('error', event => {
  const img = event.target;
  if (!img || img.tagName !== 'IMG' || img.dataset.fallbackApplied === '1') return;
  const fb = img.dataset.fallbackSrc;
  if (fb && img.getAttribute('src') !== fb) {
    img.dataset.fallbackApplied = '1';
    img.src = fb;
  }
}, true);

function refPillMarkup(refNum, artworkId = '') {
  const code = String(refNum || '').trim();
  if (!code) return '<span class="mgr-muted mono" style="font-size:11px">#—</span>';
  if (artworkId) {
    return `<button type="button" class="mgr-ref-pill" data-action="open-drawer" data-id="${esc(artworkId)}" title="View artwork lifecycle">#${esc(code)}</button>`;
  }
  return `<span class="mgr-ref-pill">#${esc(code)}</span>`;
}

function findArtIdByRef(refNum, fallbackTitle = '') {
  const clean = String(refNum || '').trim();
  if (clean) {
    const byRef = state.artworks.find(a => a.refNumber === clean || a.storeRefNumber === clean);
    if (byRef) return byRef.id;
  }
  if (fallbackTitle) {
    const byTitle = state.artworks.find(a => normKey(a.title) === normKey(fallbackTitle));
    if (byTitle) return byTitle.id;
  }
  return '';
}

function agePillMarkup(days) {
  const d = Number(days) || 0;
  const cls = d >= 40 ? 'is-overdue' : d >= 21 ? 'is-warm' : '';
  const suffix = d >= 40 ? ' · review return' : '';
  return `<span class="mgr-age-pill ${cls}">${d}d on shelf${suffix}</span>`;
}

function binDestinationBadge(a) {
  const t = a.binTargetType || (a.assignedCafeId ? 'cafe' : 'studio');
  if (t === 'customer') {
    const label = `Customer · #${a.binTargetOrderRef || 'ORDER'}${a.binTargetCustomerName ? ` · ${a.binTargetCustomerName}` : ''}`;
    return `<span class="mgr-dest-tag is-customer">${esc(label)}</span>`;
  }
  if (t === 'cafe') {
    return `<span class="mgr-dest-tag is-cafe">Café · ${esc(a.binTargetCafeName || 'Partner Café')}</span>`;
  }
  return '<span class="mgr-dest-tag">Studio Stock</span>';
}

async function refreshAccess() {
  if (!state.googleUser) {
    state.me = null;
    state.meError = '';
    render();
    return;
  }
  state.loadingMe = true;
  state.meError = '';
  render();
  try {
    state.me = await callManager('managerMe');
    if (state.me?.status === 'approved') {
      if (state.me.role !== 'admin') state.artView = 'grid';
      await loadWorkspaceData();
    }
  } catch (error) {
    state.meError = error?.message || 'Could not verify access.';
  } finally {
    state.loadingMe = false;
    render();
  }
}

function trafficQueryPayload() {
  return {
    preset: state.trafficPreset || 'all',
    device: state.trafficDevice || 'all',
    ...(state.trafficPreset === 'custom' && state.trafficFromMs && state.trafficToMs
      ? { fromMs: state.trafficFromMs, toMs: state.trafficToMs }
      : {})
  };
}

function waPhoneHref(phone) {
  const digits = String(phone || '').replace(/\D+/g, '');
  if (!digits) return '';
  const normalized = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${normalized}`;
}

function buyerDetailsMarkup(buyer, { compact = false } = {}) {
  if (!buyer || typeof buyer !== 'object') return '';
  const name = buyer.name || 'Customer';
  const waHref = waPhoneHref(buyer.phone);
  if (compact) {
    return `<div class="mgr-buyer-inline">
      <strong>${esc(name)}</strong>
      <div class="mgr-art-meta">${buyer.orderRef ? `#${esc(buyer.orderRef)}` : ''}${buyer.city ? ` · ${esc(buyer.city)}` : ''}${buyer.paidAmount > 0 ? ` · ${money(buyer.paidAmount)}` : ''}</div>
      ${(buyer.phone || buyer.email) ? `<div class="mgr-contact-links">
        ${buyer.phone ? `<a href="tel:${esc(buyer.phone)}">${esc(buyer.phone)}</a>` : ''}
        ${waHref ? `<a href="${esc(waHref)}" target="_blank" rel="noopener">WhatsApp ↗</a>` : ''}
        ${buyer.email ? `<a href="mailto:${esc(buyer.email)}">${esc(buyer.email)}</a>` : ''}
      </div>` : ''}
    </div>`;
  }
  return `<div class="mgr-buyer-box">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
      <strong>Buyer &amp; Order Details</strong>
      <span class="mgr-pill is-sold">${buyer.orderRef ? `#${esc(buyer.orderRef)}` : 'Order'} · ${esc(buyer.paymentStatus || 'captured')}</span>
    </div>
    <div style="display:grid;gap:4px">
      <div><strong>${esc(name)}</strong>${buyer.purchasedAt ? ` <span class="mgr-muted">· ${fmtDateTime(buyer.purchasedAt)}</span>` : ''}</div>
      ${buyer.paidAmount > 0 ? `<div class="mgr-muted">Paid total: <strong style="color:var(--ink)">${money(buyer.paidAmount)}</strong>${buyer.orderStatus ? ` · Order status: ${esc(buyer.orderStatus.replace(/_/g, ' '))}` : ''}</div>` : ''}
      ${(buyer.email || buyer.phone) ? `<div class="mgr-contact-links">
        ${buyer.email ? `<a href="mailto:${esc(buyer.email)}">${esc(buyer.email)}</a>` : ''}
        ${buyer.phone ? `<a href="tel:${esc(buyer.phone)}">${esc(buyer.phone)}</a>` : ''}
        ${waHref ? `<a href="${esc(waHref)}" target="_blank" rel="noopener">WhatsApp ↗</a>` : ''}
      </div>` : ''}
      ${(buyer.address || buyer.city || buyer.postalCode) ? `<div class="mgr-muted">${esc([buyer.address, buyer.city, buyer.postalCode].filter(Boolean).join(', '))}</div>` : ''}
      ${buyer.notes ? `<div class="mgr-note-box">Buyer note: ${esc(buyer.notes)}</div>` : ''}
    </div>
  </div>`;
}

async function loadWorkspaceData() {
  if (state.me?.status !== 'approved') return;
  state.loadingData = true;
  state.dataError = '';
  setBusy(true);
  try {
    const isAdmin = state.me.role === 'admin';
    const [analytics, artworks, cafeData, payoutData, users, orders, siteStockData, customerBagsData, siteTraffic] = await Promise.all([
      callManager('managerAnalytics', { range: state.range }),
      callManager('managerListArtworks'),
      callManager('managerListCafes'),
      callManager('managerListPayouts'),
      isAdmin ? callManager('managerListUsers') : Promise.resolve([]),
      isAdmin ? callManager('managerListOrders') : Promise.resolve([]),
      isAdmin ? callManager('managerListSiteStock').catch(() => null) : Promise.resolve(null),
      isAdmin ? callManager('managerListCustomerBags').catch(() => null) : Promise.resolve(null),
      isAdmin ? callManager('managerSiteTraffic', trafficQueryPayload()).catch(() => null) : Promise.resolve(null)
    ]);
    state.analytics = analytics || null;
    state.artworks = Array.isArray(artworks) ? artworks : [];
    state.cafes = Array.isArray(cafeData?.cafes) ? cafeData.cafes : [];
    state.cafeStock = Array.isArray(cafeData?.stock) ? cafeData.stock : [];
    state.batches = Array.isArray(cafeData?.batches) ? cafeData.batches : [];
    state.payoutData = payoutData || null;
    state.users = Array.isArray(users) ? users : [];
    state.orders = Array.isArray(orders) ? orders : [];
    state.siteStockData = siteStockData || null;
    state.customerBagsData = customerBagsData || null;
    state.siteTraffic = siteTraffic || null;
    if (siteTraffic) state.trafficUpdatedAt = Date.now();
    const valid = new Set(state.artworks.map(a => a.id));
    for (const sid of [...state.selectedArtIds]) {
      if (!valid.has(sid)) state.selectedArtIds.delete(sid);
    }
    if (state.activeCafeId && !state.cafes.some(c => c.id === state.activeCafeId)) {
      state.activeCafeId = '';
    }
    if (state.drawerArtworkId && !valid.has(state.drawerArtworkId)) {
      state.drawerArtworkId = '';
    }
  } catch (error) {
    state.dataError = error?.message || 'Failed to load workspace data.';
  } finally {
    state.loadingData = false;
    setBusy(false);
    render();
  }
}

/* Global Ref # Quick-Lookup */
function lookupMatches(rawQuery) {
  const q = String(rawQuery || '').trim().toLowerCase().replace(/^#/, '');
  if (!q) return [];
  return state.artworks.filter(a => {
    const hay = [
      a.refNumber,
      a.storeRefNumber,
      a.title,
      a.artistName,
      a.genre,
      a.assignedCafeName,
      a.binTargetCustomerName,
      a.binTargetOrderRef,
      a.binTargetCafeName,
      a.buyer?.name,
      a.buyer?.email,
      a.buyer?.phone,
      a.buyer?.orderRef
    ].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(q);
  }).slice(0, 8);
}

function renderLookupPopoverHtml() {
  const q = state.lookupQuery.trim();
  if (!q) return '';
  const hits = lookupMatches(q);
  if (!hits.length) {
    return '<div class="mgr-lookup-pop"><p class="mgr-muted" style="padding:10px;font-size:12px">No artwork matches "#' + esc(q.replace(/^#/, '')) + '".</p></div>';
  }
  return `<div class="mgr-lookup-pop">${hits.map(a => `<button type="button" class="mgr-lookup-item" data-action="lookup-pick" data-id="${esc(a.id)}">
    ${a.images?.[0] ? artImgTag(a, 0, 'alt=""') : '<div style="width:34px;height:34px;border-radius:6px;background:var(--surface-soft)"></div>'}
    <div style="flex:1;min-width:0">
      <div style="display:flex;align-items:center;gap:6px">
        <span class="mono" style="font-size:11px;font-weight:600">#${esc(getRefCode(a) || '—')}</span>
        <strong style="font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(a.title)}</strong>
      </div>
      <div class="mgr-art-meta">${esc(a.artistName)} · ${esc(a.genre)}${a.buyer?.name ? ` · Buyer: ${esc(a.buyer.name)}` : a.assignedCafeName ? ` · ${esc(a.assignedCafeName)}` : a.binTargetCustomerName ? ` · ${esc(a.binTargetCustomerName)}` : ''}</div>
    </div>
    <span class="mgr-pill is-${esc(a.stage || 'intake')}">${esc(STAGE_LABEL[a.stage] || a.stage)}</span>
  </button>`).join('')}</div>`;
}

function updateLookupResultsOnly() {
  const mount = $('mgr-lookup-results');
  const clearBtn = $('mgr-lookup-clear-btn');
  const kbd = $('mgr-lookup-kbd-hint');
  if (mount) mount.innerHTML = renderLookupPopoverHtml();
  const hasQ = Boolean(state.lookupQuery.trim());
  if (clearBtn) clearBtn.hidden = !hasQ;
  if (kbd) kbd.hidden = hasQ;
}

/* Slide-Over Artwork Lifecycle Drawer */
function renderDrawer() {
  const backdrop = $('mgr-drawer-backdrop');
  const drawer = $('mgr-drawer');
  if (!backdrop || !drawer) return;
  const art = state.drawerArtworkId ? state.artworks.find(a => a.id === state.drawerArtworkId) : null;
  if (!art) {
    backdrop.hidden = true;
    drawer.hidden = true;
    drawer.innerHTML = '';
    return;
  }
  const isAdmin = state.me?.role === 'admin';
  const ref = getRefCode(art);
  const stockHist = state.cafeStock.filter(s => s.artworkId === art.id);
  const timeline = (Array.isArray(art.history) ? [...art.history] : []).sort((a, b) => (Number(b.at) || 0) - (Number(a.at) || 0));

  backdrop.hidden = false;
  drawer.hidden = false;
  drawer.innerHTML = `<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">
      <div>
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap">
          <span class="mgr-ref-pill">#${esc(ref || '—')}</span>
          <span class="mgr-pill is-${esc(art.stage || 'intake')}">${esc(STAGE_LABEL[art.stage] || art.stage)}</span>
          ${(art.siteCycleCount || 0) > 0 ? `<span class="mgr-cycle-pill">Cycles: ${art.siteCycleCount}</span>` : ''}
          ${art.storeProductId ? '<span class="mgr-store-badge">In hehe.cafe Artworks</span>' : ''}
        </div>
        <h2 style="font-size:18px">${esc(art.title)}</h2>
        <p class="mgr-muted">${esc(art.artistName)} · ${esc(art.genre)}</p>
      </div>
      <button type="button" class="mgr-btn outline small" data-action="close-drawer">Close</button>
    </div>

    ${art.images?.[0] ? artImgTag(art, 0, `class="mgr-drawer-photo" alt="${esc(art.title)}"`) : ''}

    <div class="mgr-spec-grid">
      <div><span>Selling price</span><strong>${art.price > 0 ? money(art.price) : 'Price TBD'}</strong></div>
      <div><span>Availability</span><strong>${art.stage === 'sold' ? 'Sold (0)' : art.stock === 0 ? 'Sold out (0)' : 'In stock (Unique 1-of-1)'}</strong></div>
      <div><span>Material</span><strong>${esc(art.material || '—')}</strong></div>
      <div><span>Dimensions</span><strong>${esc(art.dimensions || '—')}</strong></div>
      <div><span>Current location</span><strong>${esc(art.assignedCafeName || (art.stage === 'delivery_bin' ? (art.binTargetCustomerName ? `Order #${art.binTargetOrderRef}` : art.binTargetCafeName || 'Pickup bin') : STAGE_LABEL[art.stage] || art.stage))}</strong></div>
      <div><span>Site ↔ Warehouse cycles</span><strong>${Number(art.siteCycleCount) || 0} cycles (${Number(art.siteDropCount) || 0} site drops)</strong></div>
    </div>

    ${(isAdmin && art.buyer) ? buyerDetailsMarkup(art.buyer) : (isAdmin && art.stage === 'sold' ? '<div class="mgr-note-box">Marked sold (manual / café sale — no online checkout buyer record).</div>' : '')}

    ${art.stage === 'delivery_bin' ? `<div class="mgr-panel" style="margin:0;padding:12px">
      <p class="mgr-eyebrow" style="margin-bottom:6px">Pickup Bin Assignment</p>
      <div style="display:grid;gap:6px">
        <div>${binDestinationBadge(art)}</div>
        ${art.binTargetCustomerNotes ? `<div class="mgr-note-box">Customer note: ${esc(art.binTargetCustomerNotes)}</div>` : ''}
        ${art.binNote ? `<div class="mgr-note-box">Studio note: ${esc(art.binNote)}</div>` : ''}
      </div>
    </div>` : ''}

    ${(art.description || art.artistNotes) ? `<div>
      <p class="mgr-eyebrow" style="margin-bottom:4px">Notes &amp; Description</p>
      <p style="margin:0;font-size:12.5px;color:var(--ink-2)">${esc(art.description || art.artistNotes)}</p>
    </div>` : ''}

    ${isAdmin ? `<div style="display:flex;flex-wrap:wrap;gap:6px">
      <button type="button" class="mgr-btn outline small" data-action="edit-mgr-art" data-id="${esc(art.id)}">Curate details</button>
      ${!['sold', 'at_cafe'].includes(art.stage) ? `<button type="button" class="mgr-btn outline small" data-action="open-bin-modal" data-id="${esc(art.id)}">Put in Pickup Bin</button>` : ''}
      ${!['sold', 'at_cafe'].includes(art.stage) && state.cafes.length ? `<button type="button" class="mgr-btn outline small" data-action="send-one-cafe" data-id="${esc(art.id)}">Send to Café</button>` : ''}
      ${art.price > 0 && art.stage !== 'sold' ? `<button type="button" class="mgr-btn accent small" data-action="publish-mgr-art" data-id="${esc(art.id)}">${art.storeProductId ? 'Sync hehe.cafe ↻' : 'Add to hehe.cafe →'}</button>` : ''}
      ${art.stage !== 'sold' ? `<button type="button" class="mgr-btn danger small" data-action="drawer-mark-sold" data-id="${esc(art.id)}" data-prod="${esc(art.storeProductId || '')}">Mark sold</button>` : ''}
    </div>` : ''}

    ${stockHist.length ? `<div>
      <p class="mgr-eyebrow" style="margin-bottom:8px">Partner Café Placements (${stockHist.length})</p>
      <div style="display:grid;gap:6px">${stockHist.map(s => `<div style="padding:8px 10px;border:1px solid var(--line);border-radius:7px;font-size:12px">
        <div style="display:flex;justify-content:space-between;gap:6px">
          <strong>${esc(s.cafeName)}</strong>
          <span class="mgr-pill is-${esc(s.status)}">${esc(s.status.replace(/_/g, ' '))}</span>
        </div>
        <div class="mgr-muted">${s.batchCode ? `${esc(s.batchCode)} · ` : ''}Placed ${fmtDate(s.assignedAt)}${s.status === 'sold_at_cafe' ? ` · Sold ${money(s.salePrice || s.price)}` : s.status === 'returned_to_studio' ? ` · Returned (${s.daysAtCafe || 0}d)` : ` · ${daysBetween(s.assignedAt)}d held`}</div>
      </div>`).join('')}</div>
    </div>` : ''}

    <div>
      <p class="mgr-eyebrow" style="margin-bottom:10px">Lifecycle Timeline (${timeline.length})</p>
      <div class="mgr-timeline">
        ${timeline.map(ev => `<div class="mgr-timeline-step">
          <strong>${esc(ev.label)}</strong>
          <small>${fmtDateTime(ev.at)}${ev.by ? ` · ${esc(ev.by)}` : ''}</small>
        </div>`).join('')}
      </div>
    </div>`;
}

/* Gates */
function renderSignInGate() {
  const wrongProvider = state.rawNonGoogleUser && !state.googleUser;
  return `<div class="mgr-gate-wrap"><section class="mgr-gate-card">
    <p class="mgr-eyebrow">Private Studio Operations</p>
    <h1>Chain Manager</h1>
    <p class="mgr-muted">Invite-only workspace for 1-of-1 artwork curation, #Ref tracking, artist pickup bins, partner café batches, and sales analytics.</p>
    ${wrongProvider ? `<p class="mgr-pill is-pending">Signed in as ${esc(state.rawNonGoogleUser.email || 'non-Google user')} — Google Sign-In required.</p>` : ''}
    <button type="button" class="mgr-google-btn" data-action="google-signin">${googleSvg}<span>Continue with Google</span></button>
    <button type="button" class="mgr-link" data-action="google-signin-redirect">Popup blocked? Continue with redirect →</button>
    ${state.meError ? `<p class="mgr-muted" style="color:var(--danger)">${esc(state.meError)}</p>` : ''}
  </section></div>`;
}

function renderApprovalGate() {
  const m = state.me || {};
  const isRevoked = m.status === 'revoked';
  const isPending = m.status === 'pending';
  return `<div class="mgr-gate-wrap"><section class="mgr-gate-card">
    <p class="mgr-eyebrow">Authorization Gate · Google Account</p>
    <h1>${isRevoked ? 'Access Revoked' : isPending ? 'Approval Pending' : 'Request Studio Access'}</h1>
    <p class="mgr-muted">Signed in as <strong>${esc(m.email || state.googleUser?.email)}</strong></p>
    ${isRevoked
      ? `<p class="mgr-muted">Your Chain Manager access was revoked by an administrator. Contact studio management if this is an error.</p>`
      : isPending
        ? `<div class="mgr-panel" style="margin:0;background:var(--surface-soft)">
            <span class="mgr-pill is-pending">Pending one-time Admin approval</span>
            <p class="mgr-muted" style="margin-top:8px">Requested artist profile: <strong>${esc(m.requestedArtistName || 'Artist')}</strong>. Once approved, you will enter your workspace directly.</p>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button type="button" class="mgr-btn" data-action="recheck-access">Check approval status</button>
            <button type="button" class="mgr-btn outline" data-action="mgr-signout">Sign out</button>
          </div>`
        : `<form id="mgr-request-access-form" style="display:grid;gap:12px">
            <p class="mgr-muted">New artists require one-time approval from studio admin before viewing or uploading artworks.</p>
            <label class="mgr-field">Your artist / studio name<input name="artistName" required minlength="2" maxlength="120" value="${esc(m.name || '')}" placeholder="e.g. Suprita Chatterjee"></label>
            <label class="mgr-field">Optional note for Admin<textarea name="note" maxlength="500" placeholder="Artworks you create or studio notes…"></textarea></label>
            <button type="submit" class="mgr-btn">Request one-time approval →</button>
          </form>
          <button type="button" class="mgr-link" data-action="mgr-signout">Switch Google account</button>`}
    ${isRevoked ? `<button type="button" class="mgr-btn outline" data-action="mgr-signout">Sign out</button>` : ''}
  </section></div>`;
}

/* Analytics Tab */
function renderAnalyticsTab(isAdmin) {
  const a = state.analytics;
  if (!a) return `<div class="mgr-panel"><p class="mgr-muted">${state.loadingData ? 'Loading analytics…' : 'No analytics available yet.'}</p></div>`;
  const s = a.summary || {};
  const myPay = a.myPayout || {};
  const ranges = [['all', 'All time'], ['month', 'This month'], ['30d', '30 days'], ['90d', '90 days']];

  const kpisHtml = isAdmin
    ? `<div class="mgr-kpi-grid">
        <div class="mgr-kpi"><span>Combined gross sales</span><strong>${money(s.totalRevenue)}</strong><small>Online ${money(s.siteRevenue)} + Café ${money(s.cafeRevenue)}</small></div>
        <div class="mgr-kpi"><span>Studio net margin</span><strong>${money(s.studioNetRevenue)}</strong><small>After artist split &amp; café fee (${money(s.totalCafeCommission)})</small></div>
        <div class="mgr-kpi"><span>Artist payouts due</span><strong style="color:${(s.totalPayoutDue || 0) > 0 ? 'var(--warn-ink)' : 'var(--accent)'}">${money(s.totalPayoutDue)}</strong><small>Earned ${money(s.totalArtistEarned)} · Paid ${money(s.totalArtistPaid)}</small></div>
        <div class="mgr-kpi"><span>Units sold (1-of-1)</span><strong>${s.totalUnitsSold || 0}</strong><small>${s.siteUnitsSold || 0} online · ${s.cafeUnitsSold || 0} at cafés</small></div>
        <div class="mgr-kpi"><span>At partner cafés</span><strong>${s.activeCafeStockCount || 0}</strong><small>${s.returnedUnsoldCount || 0} returned unsold</small></div>
        <div class="mgr-kpi"><span>Pickup bin queue</span><strong>${s.deliveryBinCount || 0}</strong><small>${s.binPackedCount || 0} packed · ${s.binHandedOverCount || 0} handed over</small></div>
      </div>`
    : `<div class="mgr-kpi-grid">
        <div class="mgr-kpi"><span>Your balance due</span><strong style="color:${(myPay.balanceDue || 0) > 0 ? 'var(--warn-ink)' : 'var(--accent)'}">${money(myPay.balanceDue)}</strong><small>Rate ${myPay.commissionPct ?? 60}% · Paid ${money(myPay.totalPaid)}</small></div>
        <div class="mgr-kpi"><span>Your total earned</span><strong>${money(myPay.totalEarned)}</strong><small>Online ${money(myPay.earnedOnline)} + Café ${money(myPay.earnedCafe)}</small></div>
        <div class="mgr-kpi"><span>Your pieces sold</span><strong>${s.totalUnitsSold || 0}</strong><small>${s.siteUnitsSold || 0} online · ${s.cafeUnitsSold || 0} at cafés</small></div>
        <div class="mgr-kpi"><span>At partner cafés</span><strong>${s.activeCafeStockCount || 0}</strong><small>${s.returnedUnsoldCount || 0} returned unsold</small></div>
        <div class="mgr-kpi"><span>Pickup bin queue</span><strong>${s.deliveryBinCount || 0}</strong><small>${s.binSelectedCount || 0} waiting pack · ${s.intakeCount || 0} intake</small></div>
      </div>`;

  return `<div class="mgr-head">
      <div>
        <p class="mgr-eyebrow">${isAdmin ? 'Chain Overview' : `Artist Studio · ${esc(state.me.artistName)}`}</p>
        <h1>Sales &amp; Genre Velocity</h1>
      </div>
      <div class="mgr-head-actions">
        <div class="mgr-chips" style="margin:0">
          ${ranges.map(([key, label]) => `<button type="button" class="mgr-chip ${state.range === key ? 'is-active' : ''}" data-action="set-range" data-range="${key}">${label}</button>`).join('')}
        </div>
        <button type="button" class="mgr-btn outline small" data-action="refresh-all">Refresh ↻</button>
      </div>
    </div>
    ${kpisHtml}

    <div class="mgr-split">
      <section class="mgr-panel">
        <h2>6-month revenue trend</h2>
        <p class="mgr-muted" style="margin-bottom:8px">Monthly comparison between hehe.cafe online sales and partner café sales.</p>
        ${revenueTrendChartMarkup(a.monthlyTrend)}
      </section>
      <section class="mgr-panel">
        <h2>Genre velocity (fast vs slow movers)</h2>
        <p class="mgr-muted" style="margin-bottom:10px">Shows which styles sell fast versus which come back unsold.</p>
        ${genreVelocityMatrixMarkup(a.genreBreakdown)}
      </section>
    </div>

    ${isAdmin ? `<div class="mgr-split">
      <section class="mgr-panel">
        <h2>Partner café performance</h2>
        <p class="mgr-muted" style="margin-bottom:10px">Click any café name to view store-specific genre &amp; price-band analytics.</p>
        ${cafeComparisonChartMarkup(a.cafeBreakdown)}
      </section>
      <section class="mgr-panel">
        <h2>Artist earnings &amp; balances</h2>
        ${(a.artistBreakdown || []).length ? `<div class="mgr-table-wrap"><table class="mgr-table">
          <thead><tr><th>Artist</th><th>Split</th><th>Sold</th><th>Earned</th><th>Balance due</th></tr></thead>
          <tbody>${a.artistBreakdown.map(ar => `<tr>
            <td><strong>${esc(ar.artist)}</strong><br><small class="mgr-muted">${ar.siteUnits} site · ${ar.cafeUnits} café</small></td>
            <td>${ar.commissionPct}%</td>
            <td>${ar.totalUnits}</td>
            <td>${money(ar.artistEarned)}</td>
            <td><span class="mgr-due-pill ${ar.balanceDue > 0 ? '' : 'is-settled'}">${money(ar.balanceDue)}</span></td>
          </tr>`).join('')}</tbody>
        </table></div>` : '<p class="mgr-muted">No artist sales data in this range.</p>'}
      </section>
    </div>` : ''}

    <div class="mgr-split">
      <section class="mgr-panel">
        <h2>Recent sales (${isAdmin ? 'All channels' : 'Your artworks'})</h2>
        ${(a.recentSales || []).length ? `<div class="mgr-table-wrap"><table class="mgr-table">
          <thead><tr><th>Date</th><th>Ref #</th><th>Artwork</th><th>${isAdmin ? 'Buyer / Channel' : 'Location'}</th><th>Sale</th></tr></thead>
          <tbody>${a.recentSales.slice(0, 15).map(r => `<tr>
            <td>${fmtDate(r.at)}</td>
            <td>${refPillMarkup(r.refNumber, findArtIdByRef(r.refNumber, r.title))}</td>
            <td><strong>${esc(r.title)}</strong>${isAdmin ? `<br><small class="mgr-muted">${esc(r.artistName)} · ${esc(r.genre)}</small>` : ''}</td>
            <td><span class="mgr-pill ${r.channel === 'cafe' ? 'is-at_cafe' : 'is-live_online'}">${esc(r.location || r.channel)}</span>${isAdmin && r.buyerName ? `<div class="mgr-art-meta" style="margin-top:3px"><strong>${esc(r.buyerName)}</strong>${r.buyerCity ? ` · ${esc(r.buyerCity)}` : ''}${r.orderRef ? ` · #${esc(r.orderRef)}` : ''}</div>` : ''}</td>
            <td><strong>${money(r.revenue)}</strong></td>
          </tr>`).join('')}</tbody>
        </table></div>` : '<p class="mgr-muted">No completed sales recorded in this range.</p>'}
      </section>
      <section class="mgr-panel">
        <h2>Unsold returns insight</h2>
        ${(a.returnedStock || []).length ? `<div class="mgr-table-wrap"><table class="mgr-table">
          <thead><tr><th>Ref #</th><th>Artwork</th><th>Café</th><th>Days</th><th>Reason</th></tr></thead>
          <tbody>${a.returnedStock.slice(0, 15).map(r => `<tr>
            <td>${refPillMarkup(r.refNumber, findArtIdByRef(r.refNumber, r.title))}</td>
            <td><strong>${esc(r.title)}</strong><br><small class="mgr-muted">${esc(r.genre)}</small></td>
            <td>${esc(r.cafeName)}</td>
            <td>${r.daysAtCafe}d</td>
            <td>${esc(r.returnReason || 'Unsold')}</td>
          </tr>`).join('')}</tbody>
        </table></div>` : '<p class="mgr-muted">No unsold café returns in this range.</p>'}
      </section>
    </div>`;
}

/* Live Traffic, 3D Visitor Globe & Item Demand Tab */
let trafficGlobeController = null;
let managerPollTimer = null;
let managerPollInFlight = false;
const tabLiveSnapshots = new Map();
const trafficSectionHtml = new Map();

function captureScrollPositions(rootEl) {
  const saved = { selfTop: rootEl?.scrollTop || 0, selfLeft: rootEl?.scrollLeft || 0, wraps: [] };
  if (!rootEl) return saved;
  rootEl.querySelectorAll('.mgr-table-wrap').forEach((wrap, idx) => {
    saved.wraps.push({ idx, top: wrap.scrollTop, left: wrap.scrollLeft });
  });
  return saved;
}

function restoreScrollPositions(rootEl, saved) {
  if (!rootEl || !saved) return;
  if (saved.selfTop) rootEl.scrollTop = saved.selfTop;
  if (saved.selfLeft) rootEl.scrollLeft = saved.selfLeft;
  const wraps = rootEl.querySelectorAll('.mgr-table-wrap');
  for (const w of saved.wraps) {
    if (wraps[w.idx]) {
      wraps[w.idx].scrollTop = w.top;
      wraps[w.idx].scrollLeft = w.left;
    }
  }
}

function getNavItems(isAdmin) {
  const pendingUsersCount = isAdmin ? state.users.filter(u => u.status === 'pending').length : 0;
  const dueCount = (state.payoutData?.summaries || []).filter(r => r.balanceDue > 0).length;
  const liveSiteCount = state.siteStockData?.summary?.totalOnSite ?? state.artworks.filter(a => a.stage === 'live_online').length;
  const inBagCount = isAdmin ? (state.customerBagsData?.summary?.inBagCount || 0) : 0;
  const activeNowCount = isAdmin ? (state.siteTraffic?.summary?.activeNow || 0) : 0;
  const items = [
    ['analytics', 'Analytics', null],
    ...(isAdmin ? [['traffic', 'Live traffic', activeNowCount]] : []),
    ['artworks', 'Artworks', state.artworks.length],
    ...(isAdmin ? [['site', 'Site stock', liveSiteCount], ['customers', 'Customers', inBagCount]] : []),
    ['bins', 'Pickup bin', state.artworks.filter(a => a.stage === 'delivery_bin').length],
    ['cafes', 'Cafés', state.cafeStock.filter(s => ['at_cafe', 'return_requested'].includes(s.status)).length],
    ['payouts', 'Payouts', dueCount || null]
  ];
  if (isAdmin) items.push(['users', 'Team access', pendingUsersCount]);
  return items;
}

function updateAllNavBadges(isAdmin) {
  for (const [id, , count] of getNavItems(isAdmin)) {
    const val = Number(count) || 0;
    document.querySelectorAll(`[data-nav-badge="${id}"]`).forEach(el => {
      el.hidden = val <= 0;
      el.textContent = val > 0 ? String(val) : '';
    });
  }
}

function updateTrafficNavBadges() {
  updateAllNavBadges(state.me?.role === 'admin');
}

function isEditingInsideMain() {
  const active = document.activeElement;
  if (!active) return false;
  const mainEl = document.querySelector('.mgr-main');
  return Boolean(mainEl && mainEl.contains(active) && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName));
}

function patchMainTabDOM(isAdmin) {
  const mainEl = document.querySelector('.mgr-main');
  if (!mainEl) return;
  const scrollY = window.scrollY;
  const savedScroll = captureScrollPositions(mainEl);
  mainEl.innerHTML = renderActiveTabBody(isAdmin);
  restoreScrollPositions(mainEl, savedScroll);
  updateAllNavBadges(isAdmin);
  if (state.drawerArtworkId) renderDrawer();
  if (window.scrollY !== scrollY) window.scrollTo(0, scrollY);
}

function patchTrafficSection(key, el, nextHtml) {
  if (!el || trafficSectionHtml.get(key) === nextHtml) return false;
  if (el.contains(document.activeElement)) return false;
  const savedScroll = captureScrollPositions(el);
  const scrollY = window.scrollY;
  el.innerHTML = nextHtml;
  trafficSectionHtml.set(key, nextHtml);
  restoreScrollPositions(el, savedScroll);
  if (Math.abs(window.scrollY - scrollY) > 2) window.scrollTo(0, scrollY);
  return true;
}

function patchTrafficLiveDOM() {
  const controlsHtml = pilotControlsMarkup({
    preset: state.trafficPreset,
    device: state.trafficDevice,
    fromLocal: state.trafficFromLocal || toDatetimeLocalValue(Date.now() - 3600000),
    toLocal: state.trafficToLocal || toDatetimeLocalValue(Date.now()),
    rangeText: state.siteTraffic?.window?.rangeText || '',
    showHeatmapBtn: true,
    heatmapHref: 'https://hehe.cafe/#home?heatmap=1'
  });
  patchTrafficSection('controls', $('mgr-traffic-controls'), controlsHtml);
  patchTrafficSection('kpis', $('mgr-traffic-kpis'), renderTrafficKpisMarkup());
  patchTrafficSection('timeline', $('mgr-traffic-timeline'), pilotTimelineSvgMarkup(state.siteTraffic?.timeline, state.siteTraffic?.window));
  patchTrafficSection('dist', $('mgr-traffic-dist-list'), renderTrafficDistributionListMarkup());
  patchTrafficSection('browsing', $('mgr-traffic-browsing'), renderTrafficActiveBrowsingMarkup());
  patchTrafficSection('lower', $('mgr-traffic-lower'), renderTrafficLowerMarkup());
  patchTrafficSection('engagement', $('mgr-traffic-engagement'), pilotEngagementMarkup(state.siteTraffic || {}));
  patchTrafficSection('funnel', $('mgr-traffic-funnel'), pilotFunnelAndBreakdownsMarkup(state.siteTraffic || {}));
  patchTrafficSection('clicks', $('mgr-traffic-clicks'), `<div class="mgr-card" style="margin-top:14px"><div class="mgr-card-head"><h3>Major &amp; Recent Click Feed (${(state.siteTraffic?.recentClicks || []).length})</h3></div>${pilotRecentClicksMarkup(state.siteTraffic?.recentClicks || [])}</div>`);
  patchTrafficSection('visitorsLog', $('mgr-traffic-visitors-log'), pilotVisitorsLogMarkup(state.siteTraffic?.visitorsLog || []));
  const updEl = $('mgr-traffic-updated-at');
  if (updEl) updEl.textContent = state.trafficUpdatedAt ? `Updated ${fmtClock(state.trafficUpdatedAt)}` : 'Waiting…';
  updateTrafficNavBadges();
  syncTrafficGlobe();
}

let managerPollBackoffUntil = 0;
let managerPollIntervalMs = 0;
let trafficPollSeq = 0;
function currentManagerPollMs() {
  return state.tab === 'traffic' ? 5000 : 12000;
}
async function pollActiveTabLive({ manual = false } = {}) {
  const isAdmin = state.me?.role === 'admin';
  const tab = state.tab;
  const allowConcurrentTraffic = manual && tab === 'traffic' && isAdmin;
  if (managerPollInFlight && !allowConcurrentTraffic) return;
  if (state.me?.status !== 'approved') return;
  if (!manual && Date.now() < managerPollBackoffUntil) return;
  if (!manual && (
    state.trafficLivePaused
    || document.visibilityState !== 'visible'
    || state.busy
    || state.loadingData
    || Boolean(state.uploadingPhotosText)
    || Boolean(state.dragArtId)
    || Boolean($('mgr-dialog')?.open)
  )) return;

  if (!manual && isEditingInsideMain()) return;
  const myTrafficSeq = (tab === 'traffic' && isAdmin) ? ++trafficPollSeq : 0;
  managerPollInFlight = true;
  try {
    if (tab === 'traffic' && isAdmin) {
      const next = await callManager('managerSiteTraffic', trafficQueryPayload());
      if (next && myTrafficSeq === trafficPollSeq) {
        state.siteTraffic = next;
        state.trafficUpdatedAt = Date.now();
        if (state.tab === 'traffic') patchTrafficLiveDOM();
        else updateAllNavBadges(isAdmin);
      }
      return;
    }
    if (!manual && tab === 'artworks' && state.uploadPanelOpen) return;

    if (tab === 'analytics') {
      const next = await callManager('managerAnalytics', { range: state.range });
      const snap = JSON.stringify(next || null);
      if (next && tabLiveSnapshots.get('analytics') !== snap) {
        tabLiveSnapshots.set('analytics', snap);
        state.analytics = next;
        if (state.tab === 'analytics') patchMainTabDOM(isAdmin);
      }
    } else if (tab === 'artworks' || tab === 'bins') {
      const next = await callManager('managerListArtworks');
      const list = Array.isArray(next) ? next : [];
      const snap = JSON.stringify(list);
      if (tabLiveSnapshots.get('artworks') !== snap) {
        tabLiveSnapshots.set('artworks', snap);
        state.artworks = list;
        if (['artworks', 'bins'].includes(state.tab)) patchMainTabDOM(isAdmin);
      }
    } else if (tab === 'site' && isAdmin) {
      const next = await callManager('managerListSiteStock');
      const snap = JSON.stringify(next || null);
      if (next && tabLiveSnapshots.get('site') !== snap) {
        tabLiveSnapshots.set('site', snap);
        state.siteStockData = next;
        if (state.tab === 'site') patchMainTabDOM(isAdmin);
      }
    } else if (tab === 'customers' && isAdmin) {
      const next = await callManager('managerListCustomerBags');
      const snap = JSON.stringify(next || null);
      if (next && tabLiveSnapshots.get('customers') !== snap) {
        tabLiveSnapshots.set('customers', snap);
        state.customerBagsData = next;
        if (state.tab === 'customers') patchMainTabDOM(isAdmin);
      }
    } else if (tab === 'cafes') {
      const next = await callManager('managerListCafes');
      const snap = JSON.stringify(next || null);
      if (next && tabLiveSnapshots.get('cafes') !== snap) {
        tabLiveSnapshots.set('cafes', snap);
        state.cafes = Array.isArray(next?.cafes) ? next.cafes : [];
        state.cafeStock = Array.isArray(next?.stock) ? next.stock : [];
        state.batches = Array.isArray(next?.batches) ? next.batches : [];
        if (state.tab === 'cafes') patchMainTabDOM(isAdmin);
      }
    } else if (tab === 'payouts') {
      const next = await callManager('managerListPayouts');
      const snap = JSON.stringify(next || null);
      if (next && tabLiveSnapshots.get('payouts') !== snap) {
        tabLiveSnapshots.set('payouts', snap);
        state.payoutData = next;
        if (state.tab === 'payouts') patchMainTabDOM(isAdmin);
      }
    } else if (tab === 'users' && isAdmin) {
      const next = await callManager('managerListUsers');
      const list = Array.isArray(next) ? next : [];
      const snap = JSON.stringify(list);
      if (tabLiveSnapshots.get('users') !== snap) {
        tabLiveSnapshots.set('users', snap);
        state.users = list;
        if (state.tab === 'users') patchMainTabDOM(isAdmin);
      }
    }
  } catch (err) {
    if (err?.status === 429 || err?.code === 'resource-exhausted') {
      managerPollBackoffUntil = Date.now() + 45000;
    }
    // Keep existing snapshot during transient network hiccups
  } finally {
    managerPollInFlight = false;
  }
}

function syncManagerLivePolling() {
  const shouldPoll = state.me?.status === 'approved' && !state.trafficLivePaused;
  const wantMs = currentManagerPollMs();
  if (shouldPoll) {
    if (managerPollTimer && managerPollIntervalMs !== wantMs) {
      clearInterval(managerPollTimer);
      managerPollTimer = null;
    }
    if (!managerPollTimer) {
      managerPollIntervalMs = wantMs;
      managerPollTimer = setInterval(() => { void pollActiveTabLive(); }, wantMs);
    }
  } else if (managerPollTimer) {
    clearInterval(managerPollTimer);
    managerPollTimer = null;
    managerPollIntervalMs = 0;
  }
}

function renderTrafficKpisMarkup() {
  const t = state.siteTraffic;
  if (!t) {
    return `<div class="mgr-panel"><p class="mgr-muted">${state.loadingData ? 'Loading live visitor &amp; click telemetry…' : 'Visitor tracking initializes automatically once shoppers open hehe.cafe.'}</p></div>`;
  }
  const s = t.summary || {};
  const win = t.window || {};
  const eng = t.engagement || {};
  const dev = t.deviceSplit || {};
  const devTotal = Math.max(1, (dev.mobile || 0) + (dev.desktop || 0));
  const isAll = !win.preset || win.preset === 'all';
  const earliestTxt = win.earliestDataAt ? formatIstReadable(win.earliestDataAt) : '';
  const banner = `<div class="pilot-summary-banner">
    <span><strong>${esc(win.rangeText || 'All time')}</strong>${win.durationLabel && !isAll ? ` (${esc(win.durationLabel)})` : ''} · <strong>${s.windowVisitors ?? s.totalVisitors ?? 0}</strong> unique visitors, <strong>${s.windowPageViews ?? s.totalPageViews ?? 0}</strong> views, <strong>${s.windowClicks ?? s.totalProductClicks ?? 0}</strong> clicks</span>
    ${(s.windowVisitors === 0 && !isAll && earliestTxt)
      ? `<small class="mgr-muted">No sessions in range (earliest recorded visit: ${esc(earliestTxt)})</small>`
      : (win.legacyVisitorsCount > 0 ? `<small class="mgr-muted">${win.legacyVisitorsCount} pre-upgrade visitor(s) have timestamps only</small>` : '')}
  </div>`;
  if (!isAll) {
    return `${banner}<div class="mgr-kpi-grid">
      <div class="mgr-kpi"><span>Unique visitors (range)</span><strong>${s.windowVisitors ?? 0}</strong><small>${dev.mobile || 0} mob (${Math.round(((dev.mobile || 0) / devTotal) * 100)}%) · ${dev.desktop || 0} desk</small></div>
      <div class="mgr-kpi"><span>Page views (range)</span><strong>${s.windowPageViews ?? s.totalPageViews ?? 0}</strong><small>${s.avgViewsPerVisitor || 0} avg views / visitor</small></div>
      <div class="mgr-kpi"><span>All clicks (range)</span><strong>${s.windowClicks || 0}</strong><small>${s.windowMajorClicks || 0} major · ${s.windowProductClicks || 0} artwork · Bag ${eng.bagRatePct || 0}%</small></div>
      <div class="mgr-kpi"><span>Avg Dwell &amp; Scroll</span><strong>${eng.avgTimeOnSiteSec || 0}s</strong><small>Avg scroll ${eng.avgMaxScrollPct || 0}% · Bounce ${eng.bounceRatePct || 0}%</small></div>
      <div class="mgr-kpi"><span>Live now · All-time</span><strong style="color:var(--accent)">${s.activeNow || 0}</strong><small>All-time unique: ${s.lifetimeVisitors ?? s.totalVisitors ?? 0}</small></div>
    </div>`;
  }
  return `${banner}<div class="mgr-kpi-grid">
    <div class="mgr-kpi"><span>Active visitors now</span><strong style="color:var(--accent)">${s.activeNow || 0}</strong><small>Seen in last 5 minutes · Mob ${Math.round(((dev.mobile || 0) / devTotal) * 100)}% / Desk ${Math.round(((dev.desktop || 0) / devTotal) * 100)}%</small></div>
    <div class="mgr-kpi"><span>Visitors today (IST)</span><strong>${s.todayVisitors || 0}</strong><small>${s.todayClicks || 0} item clicks today</small></div>
    <div class="mgr-kpi"><span>Visitors yesterday</span><strong>${s.yesterdayVisitors || 0}</strong><small>Last 7d: ${s.last7DaysVisitors || 0}</small></div>
    <div class="mgr-kpi"><span>Last 30 days</span><strong>${s.last30DaysVisitors || 0}</strong><small>${s.lifetimePageViews ?? s.totalPageViews ?? 0} total visits</small></div>
    <div class="mgr-kpi"><span>All-time visitors</span><strong>${s.lifetimeVisitors ?? s.totalVisitors ?? 0}</strong><small>${s.totalProductClicks || 0} total item clicks</small></div>
  </div>`;
}

function renderTrafficDistributionListMarkup() {
  const t = state.siteTraffic;
  const allLocs = Array.isArray(t?.topLocations) ? t.topLocations : [];
  const locs = state.trafficGlobeMode === 'live'
    ? allLocs.filter(l => (l.activeNow || 0) > 0)
    : allLocs;
  const maxLoc = Math.max(1, ...locs.map(l => l.count || 0));
  if (!locs.length) {
    return state.trafficGlobeMode === 'live'
      ? '<p class="mgr-muted" style="padding:12px 4px">No visitors currently active in the last 5 minutes.</p>'
      : '<p class="mgr-muted" style="padding:12px 4px">Waiting for visitor location events…</p>';
  }
  return locs.map(l => {
    const key = `${l.label}|${l.country}`;
    const isFocused = state.trafficFocusedLocKey === key;
    return `<button type="button" class="mgr-dist-row ${isFocused ? 'is-active' : ''}" data-action="focus-globe-loc" data-loc-key="${esc(key)}">
      <span class="mgr-dist-label">
        <span class="mgr-dist-name" title="${esc(`${l.label}, ${l.country}`)}">${esc(l.label)}, ${esc(l.country)}${l.colo ? ` <small class="mgr-muted">(${esc(l.colo)})</small>` : ''}</span>
        ${l.activeNow > 0 ? `<span class="mgr-pill is-active" style="padding:1px 6px;font-size:10px">${l.activeNow} live</span>` : ''}
      </span>
      <span class="mgr-bar-track"><span class="mgr-bar-fill is-cf" style="display:block;width:${Math.max(5, Math.round(((l.count || 0) / maxLoc) * 100))}%"></span></span>
      <span class="mgr-dist-count">${l.count || 0}</span>
    </button>`;
  }).join('');
}

function renderTrafficActiveBrowsingMarkup() {
  const t = state.siteTraffic;
  const active = Array.isArray(t?.activeVisitors) ? t.activeVisitors : [];
  const period = Array.isArray(t?.periodVisitors) ? t.periodVisitors : [];
  const isAll = !t?.window || t.window.preset === 'all';
  const list = isAll ? active : (period.length ? period : active);
  if (!list.length) return '';
  const fmtHm = ts => ts ? new Date(Number(ts)).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';
  const heading = isAll
    ? `Currently browsing on hehe.cafe (${active.length})`
    : `Visitors in selected period (${list.length}${active.length ? ` · ${active.length} live now` : ''})`;
  return `<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line)">
    <p class="mgr-eyebrow" style="margin-bottom:8px">${esc(heading)}</p>
    <div style="display:flex;flex-wrap:wrap;gap:6px">${list.slice(0, 16).map(v => {
      const place = [v.city, v.region, v.country].filter(Boolean).join(', ') || 'Unknown';
      const inOut = `${fmtHm(v.inTimeAt || v.firstSeenAt)}–${v.isActive ? 'Live' : fmtHm(v.outTimeAt || v.lastSeenAt)}`;
      return `<span class="mgr-dest-tag">${v.ip ? `${esc(v.ip)} · ` : ''}${esc(place)} · ${esc(v.device)} · ${esc(inOut)} · ${esc(v.lastPath || '#home')}</span>`;
    }).join('')}</div>
  </div>`;
}

function renderTrafficLowerMarkup() {
  const t = state.siteTraffic;
  if (!t) return '';
  const isAll = !t.window || t.window.preset === 'all';
  const trendRows = isAll
    ? (t.dailyTrend || []).slice(-7).map(d => ({ label: d.label, visitors: d.uniqueVisitors || 0, clicks: d.productClicks || 0 }))
    : (t.timeline || []).slice(-12).map(b => ({ label: b.label, visitors: b.visitors || 0, clicks: b.clicks || 0 }));
  const maxTrend = Math.max(1, ...trendRows.map(d => d.visitors));
  const maxRef = Math.max(1, ...(t.topReferrers || []).map(r => r.count || 0));
  const sortedDemand = [...(t.itemDemand || [])].sort((x, y) => state.itemDemandSort === 'carts'
    ? ((y.inCartCount - x.inCartCount) || (y.clicks - x.clicks))
    : ((y.clicks - x.clicks) || (y.inCartCount - x.inCartCount)));

  return `<div class="mgr-split" style="margin-bottom:16px">
      <section class="mgr-panel" style="margin:0">
        <h2>Traffic sources</h2>
        <p class="mgr-muted" style="margin-bottom:10px">Where visitors came from in <strong>${esc(t.window?.rangeText || 'selected window')}</strong>.</p>
        ${(t.topReferrers || []).length ? `<div class="mgr-geo-list">${t.topReferrers.map(r => `<div class="mgr-geo-row">
          <div class="mgr-geo-row-head"><strong>${esc(r.source)}</strong><strong>${r.count}</strong></div>
          <div class="mgr-bar-track"><div class="mgr-bar-fill" style="width:${Math.max(4, Math.round((r.count / maxRef) * 100))}%;background:#1d5fe6"></div></div>
        </div>`).join('')}</div>` : '<p class="mgr-muted">No traffic source events in this window.</p>'}
      </section>
      <section class="mgr-panel" style="margin:0">
        <h2>${isAll ? '7-day visitor &amp; click trend' : esc(`${t.window?.label || 'Window'} breakdown`)}</h2>
        <div class="mgr-geo-list" style="margin-top:8px">${trendRows.length ? trendRows.map(d => `<div class="mgr-geo-row">
          <div class="mgr-geo-row-head">
            <span><strong>${esc(d.label)}</strong></span>
            <span class="mgr-muted">${d.visitors} visitors · ${d.clicks} clicks</span>
          </div>
          <div class="mgr-bar-track"><div class="mgr-bar-fill" style="width:${d.visitors ? Math.max(4, Math.round((d.visitors / maxTrend) * 100)) : 0}%"></div></div>
        </div>`).join('') : '<p class="mgr-muted">No intervals in this window.</p>'}</div>
      </section>
    </div>

    <section class="mgr-panel">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:10px">
        <div>
          <h2>Most Clicked Artworks &amp; Bags Demand</h2>
          <p class="mgr-muted">Live product clicks alongside how many shoppers currently have each artwork inside their bag.</p>
        </div>
        <div class="mgr-chips" style="margin:0">
          <button type="button" class="mgr-chip ${state.itemDemandSort === 'clicks' ? 'is-active' : ''}" data-action="set-demand-sort" data-sort="clicks">Most clicked</button>
          <button type="button" class="mgr-chip ${state.itemDemandSort === 'carts' ? 'is-active' : ''}" data-action="set-demand-sort" data-sort="carts">Most in bags</button>
        </div>
      </div>
      ${sortedDemand.length ? `<div class="mgr-table-wrap"><table class="mgr-table">
        <thead><tr><th>#</th><th>Artwork</th><th>Clicks</th><th>In bags</th><th>Ref #</th><th>Status</th></tr></thead>
        <tbody>${sortedDemand.slice(0, 25).map((item, idx) => `<tr>
          <td><span class="mono mgr-muted">${idx + 1}</span></td>
          <td>
            <div style="display:flex;align-items:center;gap:8px;min-width:135px">
              ${item.image ? `<img src="${esc(item.image)}" alt="" style="width:34px;height:34px;border-radius:6px;object-fit:cover;border:1px solid var(--line);flex-shrink:0">` : ''}
              <div><strong>${esc(item.title)}</strong><div class="mgr-art-meta">${esc(item.artist)} · ${money(item.price)}</div></div>
            </div>
          </td>
          <td><strong>${item.clicks}</strong>${item.todayClicks > 0 ? ` <small class="mgr-muted">(${item.todayClicks} today)</small>` : ''}</td>
          <td>${item.inCartCount > 0 ? `<span class="mgr-cart-count-pill">${item.inCartCount} in ${item.inCartCount === 1 ? 'bag' : 'bags'}</span>` : '<span class="mgr-muted">0</span>'}</td>
          <td>${refPillMarkup(item.refNumber, findArtIdByRef(item.refNumber, item.title))}</td>
          <td>${item.inStock ? '<span class="mgr-pill is-live_online">In stock</span>' : item.visible ? '<span class="mgr-pill is-sold">Sold out</span>' : '<span class="mgr-pill is-curated">Off site</span>'}</td>
        </tr>`).join('')}</tbody>
      </table></div>` : '<p class="mgr-muted">No product click or bag telemetry recorded yet.</p>'}
    </section>`;
}

function renderTrafficTab() {
  const updatedTxt = state.trafficUpdatedAt ? `Updated ${fmtClock(state.trafficUpdatedAt)}` : 'Waiting…';
  return `<div class="mgr-head">
      <div>
        <p class="mgr-eyebrow">Live Storefront Telemetry · hehe.cafe</p>
        <h1>Live Traffic &amp; Visitors</h1>
      </div>
      <div class="mgr-head-actions">
        <span id="mgr-traffic-live-pill" class="mgr-live-pill ${state.trafficLivePaused ? 'is-paused' : ''}">
          <span id="mgr-traffic-live-label">${state.trafficLivePaused ? 'Paused' : 'Live · 5s'}</span>
          <span class="mgr-muted">·</span>
          <span id="mgr-traffic-updated-at">${esc(updatedTxt)}</span>
        </span>
        <button type="button" class="mgr-btn outline small" id="mgr-traffic-toggle-btn" data-action="toggle-traffic-live">${state.trafficLivePaused ? 'Resume live' : 'Pause live'}</button>
        <button type="button" class="mgr-btn outline small" data-action="refresh-traffic-now">Refresh ↻</button>
      </div>
    </div>

    <div id="mgr-traffic-controls">${pilotControlsMarkup({
      preset: state.trafficPreset,
      device: state.trafficDevice,
      fromLocal: state.trafficFromLocal || toDatetimeLocalValue(Date.now() - 3600000),
      toLocal: state.trafficToLocal || toDatetimeLocalValue(Date.now()),
      rangeText: state.siteTraffic?.window?.rangeText || '',
      showHeatmapBtn: true,
      heatmapHref: 'https://hehe.cafe/#home?heatmap=1'
    })}</div>

    <div id="mgr-traffic-kpis">${renderTrafficKpisMarkup()}</div>

    <section class="mgr-panel" style="margin-bottom:16px">
      <div id="mgr-traffic-timeline">${pilotTimelineSvgMarkup(state.siteTraffic?.timeline, state.siteTraffic?.window)}</div>
    </section>

    <section class="mgr-panel mgr-globe-card">
      <div class="mgr-globe-head">
        <div>
          <h2>Visitor Distribution</h2>
          <p class="mgr-muted">Interactive edge geo-distribution &amp; live active visitors across cities.</p>
        </div>
        <div class="mgr-head-actions">
          <div class="mgr-view-toggle" role="group" aria-label="Globe location filter">
            <button type="button" class="${state.trafficGlobeMode === 'all' ? 'is-active' : ''}" data-action="set-globe-mode" data-mode="all">All visitors</button>
            <button type="button" class="${state.trafficGlobeMode === 'live' ? 'is-active' : ''}" data-action="set-globe-mode" data-mode="live">Live now</button>
          </div>
          <button type="button" class="mgr-btn outline small" data-action="reset-globe">Reset globe</button>
        </div>
      </div>
      <div class="mgr-globe-layout">
        <div id="mgr-traffic-globe-host" class="mgr-globe-host"></div>
        <div id="mgr-traffic-dist-list" class="mgr-globe-list-col">${renderTrafficDistributionListMarkup()}</div>
      </div>
      <div id="mgr-traffic-browsing">${renderTrafficActiveBrowsingMarkup()}</div>
    </section>

    <div id="mgr-traffic-lower">${renderTrafficLowerMarkup()}</div>
    <div id="mgr-traffic-engagement">${pilotEngagementMarkup(state.siteTraffic || {})}</div>
    <div id="mgr-traffic-funnel">${pilotFunnelAndBreakdownsMarkup(state.siteTraffic || {})}</div>
    <div id="mgr-traffic-clicks"><div class="mgr-card" style="margin-top:14px"><div class="mgr-card-head"><h3>Major &amp; Recent Click Feed (${(state.siteTraffic?.recentClicks || []).length})</h3></div>${pilotRecentClicksMarkup(state.siteTraffic?.recentClicks || [])}</div></div>
    <div id="mgr-traffic-visitors-log">${pilotVisitorsLogMarkup(state.siteTraffic?.visitorsLog || [])}</div>`;
}

function syncTrafficGlobe() {
  const isAdmin = state.me?.status === 'approved' && state.me?.role === 'admin';
  const host = $('mgr-traffic-globe-host');
  if (!isAdmin || state.tab !== 'traffic' || !host) {
    trafficGlobeController?.destroy();
    trafficGlobeController = null;
    return;
  }
  const locations = Array.isArray(state.siteTraffic?.topLocations) ? state.siteTraffic.topLocations : [];
    if (!trafficGlobeController || !host.contains(trafficGlobeController.getCanvas())) {
    trafficGlobeController?.destroy();
    trafficGlobeController = mountTrafficGlobe(host, {
      locations,
      mode: state.trafficGlobeMode,
      onSelect: loc => {
        state.trafficFocusedLocKey = `${loc.label}|${loc.country}`;
        document.querySelectorAll('#mgr-traffic-dist-list .mgr-dist-row').forEach(el => {
          el.classList.toggle('is-active', el.dataset.locKey === state.trafficFocusedLocKey);
        });
      }
    });
  } else {
    trafficGlobeController.setLocations(locations, {
      mode: state.trafficGlobeMode,
      focusedKey: state.trafficFocusedLocKey
    });
  }
}

/* Artworks Pipeline + Drag-and-Drop */
function filterArtworks() {
  const q = state.artSearch.trim().toLowerCase().replace(/^#/, '');
  return state.artworks.filter(a => {
    if (state.artView !== 'kanban' && state.stageFilter !== 'all' && a.stage !== state.stageFilter) return false;
    if (!q) return true;
    return `${a.title} ${a.artistName} ${a.genre} ${a.refNumber || ''} ${a.storeRefNumber || ''} ${a.assignedCafeName || ''} ${a.buyer?.name || ''} ${a.buyer?.email || ''} ${a.buyer?.phone || ''}`.toLowerCase().includes(q);
  });
}

function renderArtworksTab(isAdmin) {
  const filtered = filterArtworks();
  const isKanban = isAdmin && state.artView === 'kanban';
  const selCount = state.selectedArtIds.size;
  const activeCafes = state.cafes.filter(c => c.active !== false);

  const uploaderHtml = state.uploadPanelOpen ? `<section class="mgr-panel">
      <h2>Upload 1-of-1 artwork to intake</h2>
      <p class="mgr-muted" style="margin-bottom:14px">${isAdmin ? 'Uploads full-resolution images to Freeimage.host with automatic Firebase Base64 backup redundancy.' : `Uploading 1-of-1 artwork as <strong>${esc(state.me.artistName)}</strong> (Freeimage.host HD + Firebase Base64 backup).`}</p>
      <form id="mgr-upload-form" class="mgr-form-grid">
        <div class="mgr-field wide"><span>Photos (required · 1–4 photos · photo #1 becomes Cover)</span>
          <div class="mgr-photo-bar">
            <label class="mgr-btn accent mgr-camera-btn ${state.uploadingPhotosText ? 'is-disabled' : ''}">
              <span>📷 ${state.uploadingPhotosText ? 'Uploading…' : 'Take photo (Camera)'}</span>
              <input id="mgr-upload-camera" type="file" accept="image/*" capture="environment" ${state.uploadingPhotosText ? 'disabled' : ''}>
            </label>
            <label class="mgr-dropzone ${state.uploadingPhotosText ? 'is-disabled' : ''}">
              <strong>Choose from gallery / files</strong>
              <span class="mgr-muted">JPG, PNG, or WebP · hosted HD + Firebase backup</span>
              <input id="mgr-upload-files" type="file" accept="image/jpeg,image/png,image/webp" multiple ${state.uploadingPhotosText ? 'disabled' : ''}>
            </label>
          </div>
          ${state.uploadingPhotosText ? `<div class="mgr-upload-progress" role="status">${esc(state.uploadingPhotosText)}</div>` : ''}
        </div>
        ${state.selectedUploadImages.length ? `<div class="mgr-preview-imgs mgr-field wide" id="mgr-upload-preview">${state.selectedUploadImages.map((src, i) => `<div class="mgr-preview-thumb"><img src="${esc(src)}" ${state.selectedUploadBackups[i] && state.selectedUploadBackups[i] !== src ? `data-fallback-src="${esc(state.selectedUploadBackups[i])}"` : ''} alt="Preview ${i + 1}">${i === 0 ? '<span class="mgr-cover-tag">COVER</span>' : ''}<button type="button" class="mgr-thumb-del" data-action="remove-upload-thumb" data-idx="${i}" aria-label="Remove photo ${i + 1}">×</button></div>`).join('')}</div>` : '<div id="mgr-upload-preview"></div>'}
        <label class="mgr-field">Artwork title (optional)<input name="title" maxlength="120" placeholder="Optional — auto-named if left blank"></label>
        ${isAdmin ? `<label class="mgr-field">Artist name<input name="artistName" required maxlength="120" value="Suprita Chatterjee"></label>` : ''}
        <div class="mgr-field wide">
          <span>Quick genre / style</span>
          <div class="mgr-chips" style="margin:2px 0 4px">
            ${GENRE_PRESETS.map(g => `<button type="button" class="mgr-chip ${state.uploadGenreDraft === g ? 'is-active' : ''}" data-action="pick-upload-genre" data-genre="${esc(g)}">${esc(g)}</button>`).join('')}
          </div>
          <input id="mgr-upload-genre" name="genre" required maxlength="60" value="${esc(state.uploadGenreDraft)}" placeholder="Or type custom genre…">
        </div>
        <label class="mgr-field">Material (optional)<input name="material" maxlength="150" placeholder="e.g. Air-dry clay & acrylic"></label>
        <label class="mgr-field">Dimensions (optional)<input name="dimensions" maxlength="150" placeholder="e.g. 6 × 6 cm"></label>
        <label class="mgr-field wide">Artist story / notes for Admin<textarea name="notes" maxlength="1000" placeholder="Mention medium, glazes, story, or suggested price…"></textarea></label>
        <div class="mgr-field wide" style="display:flex;justify-content:flex-end;gap:10px">
          <button type="submit" class="mgr-btn" ${state.uploadingPhotosText ? 'disabled' : ''}>Upload 1-of-1 piece →</button>
        </div>
      </form>
    </section>` : '';

  const dropDockHtml = isAdmin ? `<div class="mgr-drop-dock" aria-label="Drag and drop targets">
      <span class="mgr-drop-dock-label">Drag artwork onto →</span>
      <div class="mgr-drop-zone" data-drop-target="pickup_bin">Pickup Bin (Assign Café / Order)</div>
      <div class="mgr-drop-zone" data-drop-target="live_online">Add to hehe.cafe Artworks</div>
      ${activeCafes.map(c => {
        const count = state.cafeStock.filter(s => s.cafeId === c.id && ['at_cafe', 'return_requested'].includes(s.status)).length;
        return `<div class="mgr-drop-zone" data-drop-cafe="${esc(c.id)}">${esc(c.name)} <small class="mgr-muted">(${count})</small></div>`;
      }).join('')}
    </div>` : '';

  const boardHtml = isKanban
    ? `<div class="mgr-kanban">${KANBAN_COLUMNS.map(([stage, label]) => {
        const colItems = filtered.filter(a => a.stage === stage);
        return `<section class="mgr-kanban-col" data-drop-stage="${esc(stage)}">
          <div class="mgr-kanban-col-head"><span>${esc(label)}</span><span>${colItems.length}</span></div>
          ${colItems.map(a => {
            const checked = state.selectedArtIds.has(a.id);
            const ref = getRefCode(a);
            return `<article class="mgr-kcard ${checked ? 'is-selected' : ''}" draggable="true" data-drag-art="${esc(a.id)}">
              <div class="mgr-kcard-top">
                ${a.images?.[0] ? artImgTag(a, 0, 'alt="" loading="lazy"') : ''}
                <div style="min-width:0;flex:1">
                  <div style="display:flex;align-items:center;justify-content:space-between;gap:4px;flex-wrap:wrap">
                    ${refPillMarkup(ref, a.id)}
                    ${a.price > 0 ? `<strong style="font-size:11.5px">${money(a.price)}</strong>` : '<small class="mgr-muted">TBD</small>'}
                  </div>
                  <div class="mgr-kcard-title">${esc(a.title)}</div>
                  <div class="mgr-art-meta">${esc(a.artistName)} · ${esc(a.genre)}</div>
                  ${(a.siteCycleCount || 0) > 0 ? `<div style="margin-top:3px"><span class="mgr-cycle-pill">Cycles: ${a.siteCycleCount}</span></div>` : ''}
                  ${a.storeProductId ? '<div style="margin-top:3px"><span class="mgr-store-badge">In hehe.cafe</span></div>' : ''}
                  ${isAdmin && a.stage === 'sold' && a.buyer ? `<div style="margin-top:3px"><span class="mgr-dest-tag is-customer">Buyer: ${esc(a.buyer.name)}${a.buyer.city ? ` · ${esc(a.buyer.city)}` : ''}</span></div>` : ''}
                  ${stage === 'delivery_bin' ? `<div style="margin-top:3px">${binDestinationBadge(a)}</div>` : ''}
                  ${a.assignedCafeName ? `<div class="mgr-art-meta">At ${esc(a.assignedCafeName)}</div>` : ''}
                </div>
              </div>
              <div class="mgr-kcard-foot">
                <label class="mgr-select-box"><input type="checkbox" data-select-art="${esc(a.id)}" ${checked ? 'checked' : ''}><span>Select</span></label>
                <div style="display:flex;gap:4px;flex-wrap:wrap">
                  <button type="button" class="mgr-btn outline small" data-action="edit-mgr-art" data-id="${esc(a.id)}">Curate</button>
                  ${stage !== 'sold' ? `<button type="button" class="mgr-btn accent small" data-action="publish-mgr-art" data-id="${esc(a.id)}" title="Add to hehe.cafe Admin Artworks (off homepage)">${a.storeProductId ? 'Sync' : '+ Site'}</button>` : ''}
                </div>
              </div>
            </article>`;
          }).join('') || '<p class="mgr-muted" style="font-size:11.5px;margin:4px 0">Drop pieces here</p>'}
        </section>`;
      }).join('')}</div>`
    : (filtered.length
      ? `<div class="mgr-art-grid">${filtered.map(a => {
          const checked = state.selectedArtIds.has(a.id);
          const ref = getRefCode(a);
          return `<article class="mgr-art-card ${checked ? 'is-selected' : ''}" ${isAdmin ? `draggable="true" data-drag-art="${esc(a.id)}"` : ''}>
            <div class="mgr-art-thumb">
              ${a.images?.[0] ? artImgTag(a, 0, `alt="${esc(a.title)}" loading="lazy"`) : ''}
              ${isAdmin ? `<label class="mgr-card-check"><input type="checkbox" data-select-art="${esc(a.id)}" ${checked ? 'checked' : ''}><span>Select</span></label>` : ''}
            </div>
            <div class="mgr-art-body">
              <div class="mgr-art-top">
                <span class="mgr-pill is-${esc(a.stage || 'intake')}">${esc(STAGE_LABEL[a.stage] || a.stage)}</span>
                ${refPillMarkup(ref, a.id)}
              </div>
              <div style="display:flex;justify-content:space-between;align-items:baseline;gap:6px">
                <h3>${esc(a.title)}</h3>
                ${a.price > 0 ? `<strong>${money(a.price)}</strong>` : '<small class="mgr-muted">TBD</small>'}
              </div>
              <div class="mgr-art-meta">
                ${esc(a.genre)} · ${esc(a.artistName)}
                <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px">
                  ${a.storeProductId ? '<span class="mgr-store-badge">In hehe.cafe Artworks</span>' : ''}
                  ${isAdmin && a.stage === 'sold' && a.buyer ? `<span class="mgr-dest-tag is-customer">Buyer: ${esc(a.buyer.name)}${a.buyer.city ? ` · ${esc(a.buyer.city)}` : ''}</span>` : ''}
                  ${(a.siteCycleCount || 0) > 0 ? `<span class="mgr-cycle-pill">Cycles: ${a.siteCycleCount}</span>` : ''}
                </div>
                ${a.stage === 'delivery_bin' ? `<div style="margin-top:5px">${binDestinationBadge(a)}</div>` : ''}
                ${a.assignedCafeName ? `<br>At café: <strong>${esc(a.assignedCafeName)}</strong>` : ''}
              </div>
              ${isAdmin ? `<div class="mgr-art-actions">
                <button type="button" class="mgr-btn outline small" data-action="edit-mgr-art" data-id="${esc(a.id)}">Curate</button>
                ${!['sold', 'at_cafe'].includes(a.stage) ? `<button type="button" class="mgr-btn outline small" data-action="open-bin-modal" data-id="${esc(a.id)}">Pickup Bin</button>` : ''}
                ${a.stage !== 'sold' ? `<button type="button" class="mgr-btn accent small" data-action="publish-mgr-art" data-id="${esc(a.id)}">${a.storeProductId ? 'Sync hehe.cafe ↻' : 'Add to hehe.cafe →'}</button>` : ''}
              </div>` : ''}
            </div>
          </article>`;
        }).join('')}</div>`
      : '<div class="mgr-panel"><p class="mgr-muted">No artworks match this filter yet.</p></div>');

  const bulkBarHtml = isAdmin && selCount > 0
    ? `<div class="mgr-bulk-bar" role="region" aria-label="Bulk artwork actions">
        <div><strong>${selCount} selected</strong> <button type="button" class="mgr-link" style="color:#d4d4d4;margin-left:8px" data-action="clear-art-selection">Clear</button></div>
        <div class="mgr-bulk-actions">
          <button type="button" class="mgr-btn outline small" data-action="bulk-assign-bin">Put in Pickup Bin…</button>
          ${state.cafes.length ? `<button type="button" class="mgr-btn accent small" data-action="bulk-assign-cafe">Send to Café →</button>` : ''}
          <button type="button" class="mgr-btn outline small" data-action="bulk-publish-store">Add to hehe.cafe Artworks ↗</button>
        </div>
      </div>` : '';

  return `<div class="mgr-head">
      <div>
        <p class="mgr-eyebrow">1-of-1 Studio Intake &amp; Curation</p>
        <h1>Artworks pipeline</h1>
      </div>
      <div class="mgr-head-actions">
        ${isAdmin ? `<div class="mgr-view-toggle" role="group" aria-label="Pipeline view"><button type="button" class="${state.artView === 'kanban' ? 'is-active' : ''}" data-action="set-art-view" data-view="kanban">Kanban</button><button type="button" class="${state.artView === 'grid' ? 'is-active' : ''}" data-action="set-art-view" data-view="grid">Grid</button></div>` : ''}
        <button type="button" class="mgr-btn" data-action="toggle-upload-panel">${state.uploadPanelOpen ? 'Close upload' : '+ Upload artwork'}</button>
        <button type="button" class="mgr-btn outline small" data-action="refresh-all">Refresh ↻</button>
      </div>
    </div>
    ${uploaderHtml}
    ${dropDockHtml}
    ${!isKanban ? `<div class="mgr-chips">
      ${STAGES.map(([k, label]) => {
        const count = k === 'all' ? state.artworks.length : state.artworks.filter(a => a.stage === k).length;
        return `<button type="button" class="mgr-chip ${state.stageFilter === k ? 'is-active' : ''}" data-action="set-stage-filter" data-stage="${k}">${esc(label)} (${count})</button>`;
      }).join('')}
    </div>` : ''}
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:12px">
      <input id="mgr-art-search" type="search" value="${esc(state.artSearch)}" placeholder="Filter by #Ref, title, genre, artist, or café…" style="width:100%;max-width:380px;padding:7px 12px;border-radius:8px;border:1px solid var(--line-strong);background:var(--surface)">
      ${isAdmin && filtered.length ? `<div style="display:flex;gap:12px"><button type="button" class="mgr-link" data-action="select-all-shown">Select all shown (${filtered.length})</button>${selCount ? `<button type="button" class="mgr-link" data-action="clear-art-selection">Clear</button>` : ''}</div>` : ''}
    </div>
    ${boardHtml}
    ${bulkBarHtml}`;
}

/* Pickup Bins Tab */
function renderBinsTab(isAdmin) {
  const binsMap = new Map();
  for (const a of state.artworks) {
    if (a.stage !== 'delivery_bin') continue;
    const owner = a.assignedBinArtist || a.artistName || 'Unassigned';
    if (!binsMap.has(owner)) binsMap.set(owner, []);
    binsMap.get(owner).push(a);
  }
  const groups = [...binsMap.entries()].sort(([a], [b]) => a.localeCompare(b));

  return `<div class="mgr-head">
      <div>
        <p class="mgr-eyebrow">Pickup Workflow · Selected → Packed → Handed Over → Received</p>
        <h1>Pickup delivery bins</h1>
      </div>
      <div class="mgr-head-actions"><button type="button" class="mgr-btn outline small" data-action="refresh-all">Refresh ↻</button></div>
    </div>
    ${groups.length ? `<div class="mgr-bins-grid">${groups.map(([artist, items]) => `<section class="mgr-panel">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <h2>${esc(artist)}</h2>
        <span class="mgr-pill is-delivery_bin">${items.length} ${items.length === 1 ? 'piece' : 'pieces'}</span>
      </div>
      ${items.map(item => {
        const curStep = item.binStatus || 'selected';
        const curIdx = Math.max(0, BIN_STEP_LABELS.findIndex(([k]) => k === curStep));
        const ref = getRefCode(item);
        return `<div class="mgr-bin-item">
          <div class="mgr-bin-row">
            ${item.images?.[0] ? artImgTag(item, 0, 'alt=""') : ''}
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                ${refPillMarkup(ref, item.id)}
                <strong>${esc(item.title)}</strong>
              </div>
              <div class="mgr-art-meta">${esc(item.genre)} · ${item.price > 0 ? money(item.price) : 'Price TBD'}${item.binBatch ? ` · Batch: ${esc(item.binBatch)}` : ''}</div>
            </div>
          </div>
          <div style="display:grid;gap:6px">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
              ${binDestinationBadge(item)}
              ${item.binTargetCustomerCity ? `<small class="mgr-muted">${esc(item.binTargetCustomerCity)}</small>` : ''}
            </div>
            ${item.binTargetType === 'customer' && item.binTargetCustomerNotes ? `<div class="mgr-note-box">Customer delivery note: ${esc(item.binTargetCustomerNotes)}</div>` : ''}
            ${item.binNote ? `<div class="mgr-note-box">Bin instruction: ${esc(item.binNote)}</div>` : ''}
          </div>
          <div class="mgr-bin-steps" aria-label="Pickup bin progress">
            ${BIN_STEP_LABELS.map(([k, lbl], idx) => `<span class="mgr-bin-step ${idx < curIdx ? 'is-done' : idx === curIdx ? 'is-cur' : ''}">${esc(lbl)}</span>`).join('')}
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${curStep === 'selected' ? `<button type="button" class="mgr-btn outline small" data-action="bin-step" data-id="${esc(item.id)}" data-status="packed">Mark packed ✓</button>` : ''}
            ${['selected', 'packed'].includes(curStep) ? `<button type="button" class="mgr-btn small" data-action="bin-step" data-id="${esc(item.id)}" data-status="handed_over">Mark handed over →</button>` : ''}
            ${isAdmin && curStep !== 'received_at_studio' ? `<button type="button" class="mgr-btn accent small" data-action="bin-receive-modal" data-id="${esc(item.id)}">Confirm received →</button>` : ''}
            ${isAdmin ? `<button type="button" class="mgr-btn outline small" data-action="open-bin-modal" data-id="${esc(item.id)}">Change target</button>` : ''}
          </div>
        </div>`;
      }).join('')}
    </section>`).join('')}</div>` : '<div class="mgr-panel"><p class="mgr-muted">No artworks queued in pickup bins yet. Drag an artwork onto Pickup Bin in the Artworks tab or select items and put them in a bin.</p></div>'}`;
}

/* Partner Cafés Overview & Dedicated Per-Store Detail View */
function buildCafeBatchGroups(cafeId) {
  const realBatches = state.batches.filter(b => b.cafeId === cafeId).map(b => {
    const items = state.cafeStock.filter(s => s.batchId === b.id);
    const activeItems = items.filter(s => ['at_cafe', 'return_requested'].includes(s.status));
    const oldestMs = activeItems.reduce((min, s) => Math.min(min, Number(s.assignedAt || s.assignedAtMs) || Date.now()), Infinity);
    return {
      ...b,
      items,
      activeItems,
      returnedItems: items.filter(s => s.status === 'returned_to_studio'),
      soldItems: items.filter(s => s.status === 'sold_at_cafe'),
      ageDays: activeItems.length && Number.isFinite(oldestMs) ? daysBetween(oldestMs) : 0
    };
  });

  const legacyItems = state.cafeStock.filter(s => s.cafeId === cafeId && !s.batchId);
  const legacyActive = legacyItems.filter(s => ['at_cafe', 'return_requested'].includes(s.status));
  if (legacyItems.length) {
    const oldestMs = legacyActive.reduce((min, s) => Math.min(min, Number(s.assignedAt || s.assignedAtMs) || Date.now()), Infinity);
    realBatches.push({
      id: 'legacy',
      batchCode: 'LEGACY-UNBATCHED',
      batchLabel: 'Earlier placements before batch numbering',
      cafeId,
      status: legacyActive.some(s => s.status === 'return_requested') ? 'return_requested' : legacyActive.length ? 'active' : 'reconciled',
      sentAt: legacyItems[0]?.assignedAt || 0,
      items: legacyItems,
      activeItems: legacyActive,
      returnedItems: legacyItems.filter(s => s.status === 'returned_to_studio'),
      soldItems: legacyItems.filter(s => s.status === 'sold_at_cafe'),
      ageDays: legacyActive.length && Number.isFinite(oldestMs) ? daysBetween(oldestMs) : 0
    });
  }
  return realBatches.sort((a, b) => (b.activeItems.length > 0) - (a.activeItems.length > 0) || ((Number(b.sentAt || b.sentAtMs) || 0) - (Number(a.sentAt || a.sentAtMs) || 0)));
}

function renderCafeDetailView(cafe) {
  const storeStat = (state.analytics?.cafeBreakdown || []).find(c => c.cafeId === cafe.id) || {
    totalSent: 0, activeStock: 0, oldestActiveDays: 0, soldUnits: 0, soldRevenue: 0,
    cafeCommissionTotal: 0, studioNetFromCafe: 0, returnedUnits: 0, sellThroughPct: 0,
    returnRatePct: 0, avgDaysToSell: null, genreStats: [], artistStats: [], priceBands: []
  };
  const batches = buildCafeBatchGroups(cafe.id);
  const allCafeActive = state.cafeStock.filter(s => s.cafeId === cafe.id && ['at_cafe', 'return_requested'].includes(s.status));
  const allCafeReturned = state.cafeStock.filter(s => s.cafeId === cafe.id && s.status === 'returned_to_studio');
  const assignableArts = state.artworks.filter(a => !['at_cafe', 'sold'].includes(a.stage));

  return `<div class="mgr-head">
      <div>
        <button type="button" class="mgr-link" style="margin-bottom:6px;display:inline-block" data-action="close-cafe-detail">← All partner cafés</button>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <h1>${esc(cafe.name)}</h1>
          ${allCafeActive.length ? agePillMarkup(storeStat.oldestActiveDays) : '<span class="mgr-pill">No active stock</span>'}
        </div>
        <p class="mgr-muted">${esc([cafe.area, cafe.city].filter(Boolean).join(', ') || 'Partner Café')} · ${Number(cafe.commissionPct) || 0}% café commission${cafe.contactName ? ` · Contact: ${esc(cafe.contactName)}` : ''}${cafe.phone ? ` (${esc(cafe.phone)})` : ''}</p>
      </div>
      <div class="mgr-head-actions">
        ${assignableArts.length ? `<button type="button" class="mgr-btn accent" data-action="open-assign-cafe-modal" data-cafe="${esc(cafe.id)}">+ Send stock batch</button>` : ''}
        <button type="button" class="mgr-btn outline small" data-action="print-handover-challan" data-id="${esc(cafe.id)}" ${allCafeActive.length ? '' : 'disabled'}>Handover PDF</button>
        <button type="button" class="mgr-btn outline small" data-action="print-return-challan" data-id="${esc(cafe.id)}" ${allCafeReturned.length ? '' : 'disabled'}>Return PDF</button>
        <button type="button" class="mgr-btn outline small" data-action="open-cafe-modal" data-id="${esc(cafe.id)}">Edit store</button>
      </div>
    </div>

    <div class="mgr-kpi-grid">
      <div class="mgr-kpi"><span>Store sell-through</span><strong>${storeStat.sellThroughPct || 0}%</strong><small>${storeStat.soldUnits} sold of ${storeStat.totalSent} dispatched</small></div>
      <div class="mgr-kpi"><span>Store gross sales</span><strong>${money(storeStat.soldRevenue)}</strong><small>Studio net ${money(storeStat.studioNetFromCafe)} · Café fee ${money(storeStat.cafeCommissionTotal)}</small></div>
      <div class="mgr-kpi"><span>Active on shelf</span><strong>${allCafeActive.length}</strong><small>${allCafeActive.length ? `Oldest placed ${storeStat.oldestActiveDays}d ago` : 'Shelf clear'}</small></div>
      <div class="mgr-kpi"><span>Returned unsold</span><strong>${storeStat.returnedUnits || 0}</strong><small>${storeStat.returnRatePct || 0}% return rate${storeStat.avgDaysToSell !== null ? ` · Avg ${storeStat.avgDaysToSell}d to sell` : ''}</small></div>
    </div>

    <div class="mgr-split">
      <section class="mgr-panel">
        <h2>What sells best at ${esc(cafe.name)}</h2>
        <p class="mgr-muted" style="margin-bottom:10px">Genre breakdown from actual sold vs unsold returned batches at this store.</p>
        ${storeGenreStatsMarkup(storeStat.genreStats)}
      </section>
      <div style="display:grid;gap:16px">
        <section class="mgr-panel" style="margin-bottom:0">
          <h2>Price sweet spot</h2>
          <p class="mgr-muted" style="margin-bottom:10px">Which price tiers convert fastest at this café.</p>
          ${storePriceBandsMarkup(storeStat.priceBands)}
        </section>
        <section class="mgr-panel" style="margin-bottom:0">
          <h2>Artists at this store</h2>
          ${(storeStat.artistStats || []).length ? `<div class="mgr-table-wrap"><table class="mgr-table">
            <thead><tr><th>Artist</th><th>Sent</th><th>Sold</th><th>Returned</th><th>Revenue</th></tr></thead>
            <tbody>${storeStat.artistStats.map(ar => `<tr>
              <td><strong>${esc(ar.artist)}</strong></td>
              <td>${ar.sent}</td>
              <td><strong>${ar.sold}</strong></td>
              <td>${ar.returned}</td>
              <td>${money(ar.revenue)}</td>
            </tr>`).join('')}</tbody>
          </table></div>` : '<p class="mgr-muted">No artist performance recorded here yet.</p>'}
        </section>
      </div>
    </div>

    <section class="mgr-panel">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:6px">
        <div>
          <h2>Sent batches &amp; unsold-return reconciliation (${batches.length})</h2>
          <p class="mgr-muted">Request return on a sent batch, check off the unsold Ref #s that arrive back, and all remaining pieces auto-mark Sold.</p>
        </div>
      </div>
      ${batches.length ? batches.map(b => {
        const hasActive = b.activeItems.length > 0;
        return `<div class="mgr-batch-card">
          <div class="mgr-batch-head">
            <div>
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <code style="font-weight:600">${esc(b.batchCode)}</code>
                <span class="mgr-pill is-${esc(b.status || (hasActive ? 'active' : 'reconciled'))}">${b.status === 'return_requested' ? 'Return requested' : hasActive ? 'Active at café' : 'Reconciled'}</span>
                ${hasActive ? agePillMarkup(b.ageDays) : ''}
              </div>
              <div class="mgr-muted" style="margin-top:3px">${esc(b.batchLabel || 'Consignment batch')} · Sent ${fmtDate(b.sentAt || b.sentAtMs)} · ${b.items.length} pcs (${b.activeItems.length} shelf · ${b.soldItems.length} sold · ${b.returnedItems.length} returned)</div>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              ${hasActive && b.status !== 'return_requested' ? `<button type="button" class="mgr-btn outline small" data-action="batch-request-return" data-cafe="${esc(cafe.id)}" data-batch="${esc(b.id)}">Request return</button>` : ''}
              ${hasActive ? `<button type="button" class="mgr-btn accent small" data-action="open-reconcile-modal" data-cafe="${esc(cafe.id)}" data-batch="${esc(b.id)}">Reconcile returned stock →</button>` : ''}
              ${b.activeItems.length ? `<button type="button" class="mgr-btn outline small" data-action="print-handover-challan" data-id="${esc(cafe.id)}" data-batch="${esc(b.id)}">Batch PDF</button>` : ''}
            </div>
          </div>
          <div class="mgr-batch-refs">
            ${b.items.map(s => `<div style="display:inline-flex;align-items:center;gap:5px;padding:3px 7px;border:1px solid var(--line);border-radius:6px;background:var(--surface-soft);font-size:11.5px">
              ${refPillMarkup(s.refNumber, findArtIdByRef(s.refNumber, s.title))}
              <span>${esc(s.title)}</span>
              <span class="mgr-muted">${s.status === 'sold_at_cafe' ? `Sold ${money(s.salePrice || s.price)}` : s.status === 'returned_to_studio' ? 'Returned' : money(s.price)}</span>
            </div>`).join('')}
          </div>
        </div>`;
      }).join('') : '<p class="mgr-muted">No batches dispatched to this café yet.</p>'}
    </section>`;
}

function renderCafesTab(isAdmin) {
  if (isAdmin && state.activeCafeId) {
    const activeCafe = state.cafes.find(c => c.id === state.activeCafeId);
    if (activeCafe) return renderCafeDetailView(activeCafe);
  }

  const activeStock = state.cafeStock.filter(s => ['at_cafe', 'return_requested'].includes(s.status));
  const pastStock = state.cafeStock.filter(s => ['sold_at_cafe', 'returned_to_studio'].includes(s.status));
  const assignableArts = state.artworks.filter(a => !['at_cafe', 'sold'].includes(a.stage));
  const cafeStatsById = new Map((state.analytics?.cafeBreakdown || []).map(c => [c.cafeId, c]));

  if (!isAdmin) {
    return `<div class="mgr-head">
        <div><p class="mgr-eyebrow">Your Café Consignments</p><h1>Partner cafés</h1></div>
        <div class="mgr-head-actions"><button type="button" class="mgr-btn outline small" data-action="refresh-all">Refresh ↻</button></div>
      </div>
      <section class="mgr-panel">
        <h2>Your pieces currently at cafés (${activeStock.length})</h2>
        ${activeStock.length ? `<div class="mgr-table-wrap"><table class="mgr-table">
          <thead><tr><th>Ref #</th><th>Café</th><th>Artwork</th><th>Price</th><th>Shelf age</th><th>Status</th></tr></thead>
          <tbody>${activeStock.map(s => `<tr>
            <td>${refPillMarkup(s.refNumber, findArtIdByRef(s.refNumber, s.title))}</td>
            <td><strong>${esc(s.cafeName)}</strong><br><small class="mgr-muted">${esc(s.city || '')}</small></td>
            <td><strong>${esc(s.title)}</strong><br><small class="mgr-muted">${esc(s.genre)}</small></td>
            <td>${s.price > 0 ? money(s.price) : 'TBD'}</td>
            <td>${agePillMarkup(daysBetween(s.assignedAt || s.assignedAtMs))}</td>
            <td><span class="mgr-pill is-${esc(s.status)}">${s.status === 'return_requested' ? 'Return requested' : 'At café'}</span></td>
          </tr>`).join('')}</tbody>
        </table></div>` : '<p class="mgr-muted">None of your pieces are currently placed at partner cafés.</p>'}
      </section>
      <section class="mgr-panel">
        <h2>Completed café sales &amp; returns (${pastStock.length})</h2>
        ${pastStock.length ? `<div class="mgr-table-wrap"><table class="mgr-table">
          <thead><tr><th>Outcome</th><th>Ref #</th><th>Artwork</th><th>Café</th><th>Days held</th><th>Note</th></tr></thead>
          <tbody>${pastStock.slice(0, 30).map(s => `<tr>
            <td><span class="mgr-pill is-${esc(s.status)}">${s.status === 'sold_at_cafe' ? 'Sold at café' : 'Returned unsold'}</span></td>
            <td>${refPillMarkup(s.refNumber, findArtIdByRef(s.refNumber, s.title))}</td>
            <td><strong>${esc(s.title)}</strong></td>
            <td>${esc(s.cafeName)}</td>
            <td>${Number(s.daysAtCafe) || 0}d</td>
            <td>${s.status === 'sold_at_cafe' ? money(s.price) : esc(s.returnReason || 'Unsold')}</td>
          </tr>`).join('')}</tbody>
        </table></div>` : '<p class="mgr-muted">No completed café sales or returns yet.</p>'}
      </section>`;
  }

  const returnReqCount = activeStock.filter(s => s.status === 'return_requested').length;
  return `<div class="mgr-head">
      <div>
        <p class="mgr-eyebrow">Store Intelligence &amp; Batch Reconciliation</p>
        <h1>Partner cafés</h1>
      </div>
      <div class="mgr-head-actions">
        <button type="button" class="mgr-btn" data-action="open-cafe-modal">+ Add partner café</button>
        ${state.cafes.length && assignableArts.length ? `<button type="button" class="mgr-btn accent" data-action="open-assign-cafe-modal">Send batch to café →</button>` : ''}
        ${(state.cafes.length || activeStock.length || pastStock.length) ? `<button type="button" class="mgr-btn danger outline small" data-action="clear-all-cafes">Clear all café data</button>` : ''}
        <button type="button" class="mgr-btn outline small" data-action="refresh-all">Refresh ↻</button>
      </div>
    </div>

    <div class="mgr-kpi-grid">
      <div class="mgr-kpi"><span>Active partner cafés</span><strong>${state.cafes.filter(c => c.active !== false).length}</strong><small>${state.cafes.length} total stores</small></div>
      <div class="mgr-kpi"><span>Live shelf inventory</span><strong>${activeStock.length}</strong><small>Across partner cafés</small></div>
      <div class="mgr-kpi"><span>Return requested</span><strong>${returnReqCount}</strong><small>Awaiting box back to studio</small></div>
      <div class="mgr-kpi"><span>Reconciled sales</span><strong>${pastStock.filter(s => s.status === 'sold_at_cafe').length}</strong><small>${pastStock.filter(s => s.status === 'returned_to_studio').length} returned unsold</small></div>
    </div>

    ${state.cafes.length ? `<div class="mgr-cafe-grid">${state.cafes.map(c => {
      const stat = cafeStatsById.get(c.id) || { activeStock: 0, oldestActiveDays: 0, soldUnits: 0, returnedUnits: 0, soldRevenue: 0, sellThroughPct: 0 };
      const cActive = activeStock.filter(s => s.cafeId === c.id).length;
      return `<article class="mgr-cafe-card">
        <div class="mgr-cafe-card-top">
          <div>
            <h2 style="font-size:15.5px">${esc(c.name)}</h2>
            <div class="mgr-muted">${esc([c.area, c.city].filter(Boolean).join(', ') || 'Location TBD')} · ${Number(c.commissionPct) || 0}% fee</div>
          </div>
          ${cActive ? agePillMarkup(stat.oldestActiveDays) : '<span class="mgr-pill">Clear</span>'}
        </div>
        <div class="mgr-cafe-stats-row">
          <div><span>On shelf</span><strong>${cActive}</strong></div>
          <div><span>Sold</span><strong>${stat.soldUnits || 0}</strong></div>
          <div><span>Returned</span><strong>${stat.returnedUnits || 0}</strong></div>
          <div><span>Sell-thru</span><strong>${stat.sellThroughPct || 0}%</strong></div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
          <span class="mgr-muted">Sales: <strong style="color:var(--ink)">${money(stat.soldRevenue)}</strong></span>
          <div style="display:flex;gap:6px">
            <button type="button" class="mgr-btn outline small" data-action="open-cafe-modal" data-id="${esc(c.id)}">Edit</button>
            <button type="button" class="mgr-btn small" data-action="open-cafe-detail" data-id="${esc(c.id)}">Batches &amp; stats →</button>
          </div>
        </div>
      </article>`;
    }).join('')}</div>` : '<div class="mgr-panel"><p class="mgr-muted">Add your first partner café above.</p></div>'}

    <section class="mgr-panel">
      <h2>Active shelf inventory across cafés (${activeStock.length})</h2>
      ${activeStock.length ? `<div class="mgr-table-wrap"><table class="mgr-table">
        <thead><tr><th>Ref #</th><th>Café</th><th>Batch</th><th>Artwork</th><th>Age</th><th>Status</th><th>Quick action</th></tr></thead>
        <tbody>${activeStock.map(s => `<tr>
          <td>${refPillMarkup(s.refNumber, findArtIdByRef(s.refNumber, s.title))}</td>
          <td><button type="button" class="mgr-link" style="font-weight:600;color:var(--ink)" data-action="open-cafe-detail" data-id="${esc(s.cafeId)}">${esc(s.cafeName)}</button></td>
          <td><code style="font-size:11px">${esc(s.batchCode || 'LEGACY')}</code></td>
          <td><strong>${esc(s.title)}</strong><br><small class="mgr-muted">${esc(s.artistName)} · ${money(s.price)}</small></td>
          <td>${agePillMarkup(daysBetween(s.assignedAt || s.assignedAtMs))}</td>
          <td><span class="mgr-pill is-${esc(s.status)}">${s.status === 'return_requested' ? 'Return requested' : 'At café'}</span></td>
          <td style="display:flex;gap:5px;flex-wrap:wrap">
            <button type="button" class="mgr-btn accent small" data-action="open-reconcile-modal" data-cafe="${esc(s.cafeId)}" data-batch="${esc(s.batchId || 'legacy')}">Reconcile batch</button>
            <button type="button" class="mgr-btn outline small" data-action="cafe-mark-sold" data-id="${esc(s.id)}">Sold</button>
          </td>
        </tr>`).join('')}</tbody>
      </table></div>` : '<p class="mgr-muted">No active stock sitting at cafés right now.</p>'}
    </section>`;
}

/* Payouts & Users Tabs */
function renderPayoutsTab(isAdmin) {
  const data = state.payoutData;
  if (!data) return `<div class="mgr-panel"><p class="mgr-muted">${state.loadingData ? 'Loading payout ledger…' : 'No payout data available.'}</p></div>`;
  const summaries = data.summaries || [];
  const payouts = data.payouts || [];

  if (!isAdmin) {
    const mine = summaries[0] || { commissionPct: state.me.commissionPct ?? 60, earnedOnline: 0, earnedCafe: 0, totalEarned: 0, totalPaid: 0, balanceDue: 0 };
    return `<div class="mgr-head">
        <div><p class="mgr-eyebrow">Commission Ledger · ${esc(mine.commissionPct)}% Share</p><h1>Your earnings &amp; payouts</h1></div>
        <div class="mgr-head-actions">
          <button type="button" class="mgr-btn" data-action="print-artist-settlement" data-artist="${esc(mine.artist)}">Settlement PDF ↗</button>
          <button type="button" class="mgr-btn outline small" data-action="refresh-all">Refresh ↻</button>
        </div>
      </div>
      <div class="mgr-kpi-grid">
        <div class="mgr-kpi"><span>Your balance due</span><strong style="color:${mine.balanceDue > 0 ? 'var(--warn-ink)' : 'var(--accent)'}">${money(mine.balanceDue)}</strong><small>Rate ${mine.commissionPct}%</small></div>
        <div class="mgr-kpi"><span>Total earned</span><strong>${money(mine.totalEarned)}</strong><small>Online ${money(mine.earnedOnline)} + Café ${money(mine.earnedCafe)}</small></div>
        <div class="mgr-kpi"><span>Paid to date</span><strong>${money(mine.totalPaid)}</strong><small>${payouts.length} settlements</small></div>
      </div>
      <section class="mgr-panel">
        <h2>Payout receipts (${payouts.length})</h2>
        ${payouts.length ? `<div class="mgr-table-wrap"><table class="mgr-table">
          <thead><tr><th>Date</th><th>Method</th><th>UTR / Reference</th><th>Period</th><th>Note</th><th>Amount</th></tr></thead>
          <tbody>${payouts.map(p => `<tr>
            <td>${fmtDate(p.paidAt)}</td>
            <td><strong>${esc(String(p.method || 'UPI').toUpperCase())}</strong></td>
            <td><code>${esc(p.reference || '—')}</code></td>
            <td>${esc(p.periodLabel || '—')}</td>
            <td>${esc(p.note || '—')}</td>
            <td><strong>${money(p.amount)}</strong></td>
          </tr>`).join('')}</tbody>
        </table></div>` : '<p class="mgr-muted">No payouts recorded yet.</p>'}
      </section>`;
  }

  const totalDue = summaries.reduce((n, r) => n + (r.balanceDue || 0), 0);
  return `<div class="mgr-head">
      <div><p class="mgr-eyebrow">Commission Splits &amp; Settlement Ledger</p><h1>Artist payouts</h1></div>
      <div class="mgr-head-actions">
        <button type="button" class="mgr-btn" data-action="open-payout-modal">+ Record payout</button>
        <button type="button" class="mgr-btn outline small" data-action="refresh-all">Refresh ↻</button>
      </div>
    </div>
    <div class="mgr-kpi-grid">
      <div class="mgr-kpi"><span>Total balance due</span><strong style="color:${totalDue > 0 ? 'var(--warn-ink)' : 'var(--accent)'}">${money(totalDue)}</strong><small>Across ${summaries.length} artists</small></div>
      <div class="mgr-kpi"><span>Studio net margin</span><strong>${money(data.studioNetTotal)}</strong><small>After artist split &amp; café fees</small></div>
      <div class="mgr-kpi"><span>Café commissions</span><strong>${money(data.totalCafeCommission)}</strong><small>Store fee total</small></div>
    </div>
    <section class="mgr-panel">
      <h2>Artist settlement balances</h2>
      ${summaries.length ? `<div class="mgr-table-wrap"><table class="mgr-table">
        <thead><tr><th>Artist</th><th>Rate</th><th>Online</th><th>Café</th><th>Earned</th><th>Paid</th><th>Due</th><th>Actions</th></tr></thead>
        <tbody>${summaries.map(r => `<tr>
          <td><strong>${esc(r.artist)}</strong></td>
          <td>${r.commissionPct}%</td>
          <td>${money(r.earnedOnline)}</td>
          <td>${money(r.earnedCafe)}</td>
          <td><strong>${money(r.totalEarned)}</strong></td>
          <td>${money(r.totalPaid)}</td>
          <td><span class="mgr-due-pill ${r.balanceDue > 0 ? '' : 'is-settled'}">${money(r.balanceDue)}</span></td>
          <td style="display:flex;gap:6px;flex-wrap:wrap">
            <button type="button" class="mgr-btn accent small" data-action="open-payout-modal" data-artist="${esc(r.artist)}" data-due="${r.balanceDue}">Mark paid</button>
            <button type="button" class="mgr-btn outline small" data-action="print-artist-settlement" data-artist="${esc(r.artist)}">Statement PDF</button>
          </td>
        </tr>`).join('')}</tbody>
      </table></div>` : '<p class="mgr-muted">No artist earnings recorded yet.</p>'}
    </section>
    <section class="mgr-panel">
      <h2>Recorded payout ledger (${payouts.length})</h2>
      ${payouts.length ? `<div class="mgr-table-wrap"><table class="mgr-table">
        <thead><tr><th>Paid date</th><th>Artist</th><th>Method</th><th>UTR / Reference</th><th>Period / Note</th><th>Amount</th><th></th></tr></thead>
        <tbody>${payouts.map(p => `<tr>
          <td>${fmtDate(p.paidAt)}</td>
          <td><strong>${esc(p.artistName)}</strong></td>
          <td>${esc(String(p.method || 'UPI').toUpperCase())}</td>
          <td><code>${esc(p.reference || '—')}</code></td>
          <td>${esc([p.periodLabel, p.note].filter(Boolean).join(' · ') || '—')}</td>
          <td><strong>${money(p.amount)}</strong></td>
          <td><button type="button" class="mgr-link" style="color:var(--danger)" data-action="confirm-delete-payout" data-id="${esc(p.id)}" data-artist="${esc(p.artistName)}" data-amount="${p.amount}">Remove</button></td>
        </tr>`).join('')}</tbody>
      </table></div>` : '<p class="mgr-muted">No payouts recorded yet.</p>'}
    </section>`;
}

function renderUsersTab() {
  return `<div class="mgr-head">
      <div><p class="mgr-eyebrow">One-Time Approval &amp; Commission Rules</p><h1>Team &amp; artist access</h1></div>
      <div class="mgr-head-actions"><button type="button" class="mgr-btn outline small" data-action="refresh-all">Refresh ↻</button></div>
    </div>
    <section class="mgr-panel">
      <h2>Pre-approve a Google account</h2>
      <p class="mgr-muted" style="margin-bottom:12px">Grant an artist one-time access by Google email and configure their custom split percentage.</p>
      <form id="mgr-preapprove-form" class="mgr-form-grid">
        <label class="mgr-field">Google email address<input name="email" type="email" required placeholder="artist@gmail.com"></label>
        <label class="mgr-field">Artist display name (must match artworks)<input name="artistName" required minlength="2" maxlength="120" placeholder="e.g. Suprita Chatterjee"></label>
        <label class="mgr-field">Role<select name="role"><option value="artist">Artist (own artworks, bins &amp; payouts)</option><option value="admin">Admin (full studio &amp; café chain)</option></select></label>
        <label class="mgr-field">Artist commission (%)<input name="commissionPct" type="number" min="0" max="100" step="0.5" value="60"></label>
        <div class="mgr-field wide" style="display:flex;justify-content:flex-end"><button type="submit" class="mgr-btn">Approve Google access →</button></div>
      </form>
    </section>
    <section class="mgr-panel">
      <h2>Registered team members (${state.users.length})</h2>
      ${state.users.length ? `<div class="mgr-table-wrap"><table class="mgr-table">
        <thead><tr><th>Google email</th><th>Status</th><th>Role</th><th>Artist name</th><th>Split %</th><th>Actions</th></tr></thead>
        <tbody>${state.users.map(u => `<tr>
          <td><strong>${esc(u.email)}</strong><br><small class="mgr-muted">${esc(u.name || '')}</small></td>
          <td><span class="mgr-pill is-${esc(u.status || 'pending')}">${esc(u.status || 'pending')}</span></td>
          <td>${esc(u.role || 'artist')}</td>
          <td>${esc(u.artistName || u.requestedArtistName || '—')}</td>
          <td>${u.role === 'admin' ? '—' : `${u.commissionPct ?? 60}%`}</td>
          <td style="display:flex;gap:6px;flex-wrap:wrap">
            <button type="button" class="mgr-btn outline small" data-action="edit-user-modal" data-email="${esc(u.email)}">${u.status === 'pending' ? 'Approve / Edit' : 'Edit'}</button>
            ${u.status !== 'revoked' ? `<button type="button" class="mgr-btn danger small" data-action="confirm-revoke-user" data-email="${esc(u.email)}">Revoke</button>` : ''}
          </td>
        </tr>`).join('')}</tbody>
      </table></div>` : '<p class="mgr-muted">No pending or approved artists yet.</p>'}
    </section>`;
}

/* Main Shell & Topbar */
function renderActiveTabBody(isAdmin) {
  if (state.dataError) {
    return `<div class="mgr-panel"><p style="color:var(--danger)">${esc(state.dataError)}</p><button type="button" class="mgr-btn outline small" data-action="refresh-all">Try again</button></div>`;
  }
  if (state.tab === 'traffic' && isAdmin) return renderTrafficTab();
  if (state.tab === 'artworks') return renderArtworksTab(isAdmin);
  if (state.tab === 'site' && isAdmin) return renderSiteStockTab();
  if (state.tab === 'customers' && isAdmin) return renderCustomersTab();
  if (state.tab === 'bins') return renderBinsTab(isAdmin);
  if (state.tab === 'cafes') return renderCafesTab(isAdmin);
  if (state.tab === 'payouts') return renderPayoutsTab(isAdmin);
  if (state.tab === 'users' && isAdmin) return renderUsersTab();
  return renderAnalyticsTab(isAdmin);
}

function render() {
  const root = $('manager-app');
  if (!root) return;
  if (!state.authReady || state.loadingMe) {
    trafficGlobeController?.destroy();
    trafficGlobeController = null;
    syncManagerLivePolling();
    root.innerHTML = '<div class="mgr-boot">Checking authorization…</div>';
    renderDrawer();
    return;
  }
  if (!state.googleUser) {
    trafficGlobeController?.destroy();
    trafficGlobeController = null;
    syncManagerLivePolling();
    root.innerHTML = renderSignInGate();
    renderDrawer();
    return;
  }
  if (state.me?.status !== 'approved') {
    trafficGlobeController?.destroy();
    trafficGlobeController = null;
    syncManagerLivePolling();
    root.innerHTML = renderApprovalGate();
    renderDrawer();
    return;
  }
  const isAdmin = state.me.role === 'admin';
  const navItems = getNavItems(isAdmin);
  trafficSectionHtml.clear();
  const bodyHtml = renderActiveTabBody(isAdmin);

  root.innerHTML = `<div class="mgr-workspace">
    <aside class="mgr-sidebar">
      <div class="mgr-brand">
        <p class="mgr-eyebrow">Private Chain Workspace</p>
        <strong>hehe.cafe Ops</strong>
        <span class="mgr-role-pill">${isAdmin ? 'Admin · Full chain' : `Artist · ${esc(state.me.artistName)}`}</span>
      </div>
      <nav class="mgr-nav" aria-label="Manager sections">
        ${navItems.map(([id, label, count]) => `<button type="button" class="mgr-nav-btn ${state.tab === id ? 'is-active' : ''}" data-action="nav-tab" data-tab="${id}">
          <span class="mgr-nav-label"><svg viewBox="0 0 24 24" aria-hidden="true">${NAV_ICONS[id] || ''}</svg><span>${esc(label)}</span></span>
          ${count !== null && count !== undefined
            ? `<span class="mgr-nav-count" data-nav-badge="${esc(id)}" ${count > 0 || id === 'artworks' || id === 'site' || id === 'bins' || id === 'cafes' ? '' : 'hidden'}>${count > 0 || id === 'artworks' || id === 'site' || id === 'bins' || id === 'cafes' ? count : ''}</span>`
            : ''}
        </button>`).join('')}
      </nav>
      <div class="mgr-sidebar-foot">
        <span style="overflow:hidden;text-overflow:ellipsis">${esc(state.me.email)}</span>
        <button type="button" class="mgr-btn outline small" data-action="mgr-signout">Sign out</button>
      </div>
    </aside>
    <div class="mgr-content-col">
      <header class="mgr-topbar">
        <div class="mgr-lookup-wrap">
          <svg class="mgr-lookup-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input id="mgr-global-lookup" class="mgr-lookup-input" type="search" autocomplete="off" value="${esc(state.lookupQuery)}" placeholder="Jump to #Ref, artwork, artist, café, buyer, or order…">
          <kbd id="mgr-lookup-kbd-hint" class="mgr-lookup-kbd" ${state.lookupQuery ? 'hidden' : ''}>/</kbd>
          <button id="mgr-lookup-clear-btn" type="button" class="mgr-lookup-clear" data-action="clear-lookup" aria-label="Clear search" ${state.lookupQuery ? '' : 'hidden'}>×</button>
          <div id="mgr-lookup-results">${renderLookupPopoverHtml()}</div>
        </div>
        <div class="mgr-topbar-right">
          ${isAdmin ? `<button type="button" class="mgr-btn small outline" data-action="quick-upload">+ Intake piece</button>` : ''}
        </div>
        <div id="mgr-busy-bar" class="mgr-busy-bar" ${state.busy ? '' : 'hidden'}></div>
      </header>
      <main class="mgr-main">${bodyHtml}</main>
    </div>
  </div>
  <nav class="mgr-bottom-nav" aria-label="Mobile sections">
    ${navItems.map(([id, label, count]) => `<button type="button" class="mgr-bottom-btn ${state.tab === id ? 'is-active' : ''}" data-action="nav-tab" data-tab="${id}">
      <svg viewBox="0 0 24 24" aria-hidden="true">${NAV_ICONS[id] || ''}</svg>
      <span>${esc(label)}</span>
      ${count !== null && count !== undefined
        ? `<span class="mgr-bnav-dot" data-nav-badge="${esc(id)}" ${count > 0 ? '' : 'hidden'}>${count > 0 ? count : ''}</span>`
        : ''}
    </button>`).join('')}
  </nav>`;
  syncTrafficGlobe();
  syncManagerLivePolling();
  renderDrawer();
}

/* Site Stock & Warehouse Rotation Tab */
function filterSiteProducts(list = []) {
  const q = state.siteSearch.trim().toLowerCase().replace(/^#/, '');
  return list.filter(p => {
    if (state.siteFilter === 'available' && !(p.visible && !p.realSold)) return false;
    if (state.siteFilter === 'real_sold' && !p.realSold) return false;
    if (state.siteFilter === 'hidden' && (p.visible || p.realSold)) return false;
    if (!q) return true;
    return `${p.refNumber || ''} ${p.title} ${p.artist} ${p.productType} ${p.managerStage || ''} ${p.buyer?.name || ''} ${p.buyer?.email || ''} ${p.buyer?.phone || ''} ${p.buyer?.city || ''} ${p.buyer?.orderRef || ''}`.toLowerCase().includes(q);
  });
}

function fmtMgrCountdown(ms) {
  const sec = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = n => String(n).padStart(2, '0');
  return d > 0 ? `${d}d ${pad(h)}h ${pad(m)}m ${pad(s)}s` : `${pad(h)}h ${pad(m)}m ${pad(s)}s`;
}

function updateMgrScheduleClock() {
  const clock = document.querySelector('[data-mgr-schedule-clock]');
  const sched = state.siteStockData?.stockSchedule;
  if (!clock || !sched) return;
  if (sched.paused) {
    clock.textContent = `Paused · ${fmtMgrCountdown(sched.pausedRemainingMs || (sched.intervalHours || 18) * 3600000)} left`;
    return;
  }
  if (!sched.autoRefreshEnabled) {
    clock.textContent = 'Auto-refresh off';
    return;
  }
  const rem = (Number(sched.nextRefreshAt) || 0) - Date.now();
  clock.textContent = rem > 0 ? `Next refresh in ${fmtMgrCountdown(rem)}` : 'Due now — refreshing…';
}
if (typeof window !== 'undefined') {
  setInterval(updateMgrScheduleClock, 1000);
}

function renderStockSchedulePanel(rawSched) {
  const s = {
    autoRefreshEnabled: rawSched?.autoRefreshEnabled === true,
    showTimerOnSite: rawSched?.showTimerOnSite === true,
    paused: rawSched?.paused === true,
    pausedRemainingMs: Number(rawSched?.pausedRemainingMs) || 0,
    intervalHours: Number(rawSched?.intervalHours) || 18,
    pickCount: Number(rawSched?.pickCount) || 20,
    fakeSoldCount: Number.isInteger(Number(rawSched?.fakeSoldCount)) ? Number(rawSched.fakeSoldCount) : 3,
    defaultPrice: Number(rawSched?.defaultPrice) || 250,
    nextRefreshAt: Number(rawSched?.nextRefreshAt) || 0,
    lastRefreshAt: Number(rawSched?.lastRefreshAt) || 0,
    lastRefreshSummary: rawSched?.lastRefreshSummary || ''
  };
  const remMs = s.nextRefreshAt > 0 ? Math.max(0, s.nextRefreshAt - Date.now()) : 0;
  const clockLabel = s.paused
    ? `Paused · ${fmtMgrCountdown(s.pausedRemainingMs || s.intervalHours * 3600000)} left`
    : s.autoRefreshEnabled
      ? (remMs > 0 ? `Next refresh in ${fmtMgrCountdown(remMs)}` : 'Due now')
      : 'Auto-refresh off';
  const statusPill = s.paused
    ? '<span class="mgr-pill is-pending">Auto-refresh paused</span>'
    : s.autoRefreshEnabled
      ? '<span class="mgr-pill is-live_online">Auto-refresh active</span>'
      : '<span class="mgr-pill">Auto-refresh off</span>';
  const timerPill = s.showTimerOnSite
    ? '<span class="mgr-pill is-active">Site timer: Visible</span>'
    : '<span class="mgr-pill">Site timer: Hidden</span>';

  return `<section class="mgr-panel mgr-schedule-panel">
      <div class="mgr-schedule-top">
        <div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:5px">
            <strong>Automatic Stock Refresh &amp; Countdown Timer</strong>
            ${statusPill}
            ${timerPill}
          </div>
          <div class="mgr-muted">
            Every <strong>${s.intervalHours}h</strong> picks <strong>${s.pickCount}</strong> warehouse artworks (${s.fakeSoldCount} fake-sold).
            ${s.lastRefreshAt ? ` Last run: ${fmtDateTime(s.lastRefreshAt)}${s.lastRefreshSummary ? ` (${esc(s.lastRefreshSummary)})` : ''}` : ''}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span class="mgr-schedule-clock" data-mgr-schedule-clock>${esc(clockLabel)}</span>
          ${s.autoRefreshEnabled && !s.paused
            ? '<button type="button" class="mgr-btn outline small" data-action="schedule-pause">Pause refresh</button>'
            : `<button type="button" class="mgr-btn accent small" data-action="schedule-resume">${s.paused ? 'Resume refresh' : 'Start auto-refresh'}</button>`}
          <button type="button" class="mgr-btn outline small" data-action="schedule-toggle-timer" data-show="${s.showTimerOnSite ? '0' : '1'}">${s.showTimerOnSite ? 'Hide timer on site' : 'Show timer on site'}</button>
        </div>
      </div>
      <form id="mgr-schedule-form" class="mgr-schedule-form">
        <label class="mgr-field">Every (hours)<input name="intervalHours" type="number" min="1" max="720" step="0.5" value="${s.intervalHours}" required></label>
        <label class="mgr-field">Artworks / drop<input name="pickCount" type="number" min="1" max="50" value="${s.pickCount}" required></label>
        <label class="mgr-field">Fake-sold<input name="fakeSoldCount" type="number" min="0" max="50" value="${s.fakeSoldCount}" required></label>
        <label class="mgr-field">Default ₹<input name="defaultPrice" type="number" min="1" max="500000" value="${s.defaultPrice}" required></label>
        <label class="mgr-select-box" style="min-height:36px"><input type="checkbox" name="autoRefreshEnabled" ${s.autoRefreshEnabled ? 'checked' : ''}><span>Auto-refresh on</span></label>
        <label class="mgr-select-box" style="min-height:36px"><input type="checkbox" name="showTimerOnSite" ${s.showTimerOnSite ? 'checked' : ''}><span>Show timer on site</span></label>
        <div style="display:flex;gap:6px;flex-wrap:wrap;grid-column:1 / -1;justify-content:flex-end">
          <button type="submit" class="mgr-btn outline small" data-reset-timer="1">Save &amp; reset countdown</button>
          <button type="submit" class="mgr-btn small">Save schedule →</button>
        </div>
      </form>
    </section>`;
}

function renderSiteStockTab() {
  const data = state.siteStockData;
  if (!data) {
    return `<div class="mgr-head"><div><p class="mgr-eyebrow">hehe.cafe ↔ Chain Manager</p><h1>Site Stock &amp; Warehouse Rotation</h1></div><div class="mgr-head-actions"><button type="button" class="mgr-btn outline small" data-action="refresh-all">Reload ↻</button></div></div>
    <div class="mgr-panel"><p class="mgr-muted">${state.loadingData ? 'Loading hehe.cafe site stock…' : 'Could not load site stock yet. Tap Reload to sync.'}</p></div>`;
  }
  const summary = data.summary || {};
  const allSite = data.siteProducts || [];
  const filtered = filterSiteProducts(allSite);
  const warehouseCount = summary.warehouseReadyCount ?? (data.warehouseArtworks || []).length;
  const liveInStock = summary.liveInStock ?? ((summary.liveAvailable || 0) + (summary.liveFakeSold || 0));
  const liveRealSoldCount = allSite.filter(p => p.realSold).length;
  const chips = [
    ['all', 'All site records', allSite.length],
    ['available', 'In stock', allSite.filter(p => p.visible && !p.realSold).length],
    ['real_sold', 'Sold', liveRealSoldCount],
    ['hidden', 'Off site / Warehouse', allSite.filter(p => !p.visible && !p.realSold).length]
  ];

  return `<div class="mgr-head">
      <div>
        <p class="mgr-eyebrow">hehe.cafe ↔ Chain Manager Sync</p>
        <h1>Site Stock &amp; Warehouse Rotation</h1>
      </div>
      <div class="mgr-head-actions">
        <button type="button" class="mgr-btn accent" data-action="open-refresh-site-modal">↻ Refresh site stock (20)</button>
        <button type="button" class="mgr-btn" data-action="open-import-site-modal">+ Import from warehouse (${warehouseCount})</button>
        <button type="button" class="mgr-btn outline small" data-action="sync-from-site">Sync from site</button>
        <button type="button" class="mgr-btn outline small" data-action="refresh-all">Reload</button>
      </div>
    </div>

    ${renderStockSchedulePanel(data.stockSchedule)}

    <div class="mgr-kpi-grid">
      <div class="mgr-kpi"><span>Live on site</span><strong>${summary.totalOnSite || 0}</strong><small>${liveInStock} in stock · ${liveRealSoldCount} sold</small></div>
      <div class="mgr-kpi"><span>In stock (Site)</span><strong>${liveInStock}</strong><small>Unsold artworks ready for buyers</small></div>
      <div class="mgr-kpi"><span>Sold artworks</span><strong>${liveRealSoldCount}</strong><small>Actually bought · excluded from rotations</small></div>
      <div class="mgr-kpi"><span>Warehouse ready</span><strong>${warehouseCount}</strong><small>${summary.unlinkedSiteProducts || 0} unlinked site items</small></div>
      <div class="mgr-kpi"><span>Total cycles tracked</span><strong>${summary.totalCyclesCompleted || 0}</strong><small>Site → Warehouse rotations</small></div>
    </div>

    <div class="mgr-chips">
      ${chips.map(([k, label, count]) => `<button type="button" class="mgr-chip ${state.siteFilter === k ? 'is-active' : ''}" data-action="set-site-filter" data-filter="${k}">${esc(label)} (${count})</button>`).join('')}
    </div>

    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:12px">
      <input id="mgr-site-search" type="search" value="${esc(state.siteSearch)}" placeholder="Search site stock by #Ref, title, artist, or buyer…" style="width:100%;max-width:380px;padding:7px 12px;border-radius:8px;border:1px solid var(--line-strong);background:var(--surface)">
      <span class="mgr-muted">Showing ${filtered.length} of ${allSite.length} site records</span>
    </div>

    <section class="mgr-panel">
      ${filtered.length ? `<div class="mgr-table-wrap"><table class="mgr-table">
        <thead><tr><th>Artwork</th><th>Ref #</th><th>Price</th><th>Site status</th><th>Buyer</th><th>Cycles</th><th>Actions</th></tr></thead>
        <tbody>${filtered.map(p => {
          const statusBadge = p.realSold
            ? '<span class="mgr-pill is-sold">Sold</span>'
            : p.visible
              ? '<span class="mgr-pill is-live_online">In stock</span>'
              : '<span class="mgr-pill is-curated">Warehouse / Hidden</span>';
          const buyerHtml = p.realSold
            ? (p.buyer ? buyerDetailsMarkup(p.buyer, { compact: true }) : '<span class="mgr-muted">Manual / studio sale</span>')
            : '<span class="mgr-muted">—</span>';
          const imgSrc = p.backupImages?.[0] || p.images?.[0] || '';
          return `<tr>
            <td>
              <div style="display:flex;align-items:center;gap:10px;min-width:190px">
                ${imgSrc ? `<img src="${esc(imgSrc)}" alt="" style="width:42px;height:42px;border-radius:7px;object-fit:cover;border:1px solid var(--line);flex-shrink:0">` : ''}
                <div>
                  <strong>${esc(p.title)}</strong>
                  <div class="mgr-art-meta">${esc(p.artist)} · ${esc(p.productType)}</div>
                </div>
              </div>
            </td>
            <td>${refPillMarkup(p.refNumber, p.managerArtworkId || '')}</td>
            <td><strong>${p.price > 0 ? money(p.price) : '—'}</strong></td>
            <td>${statusBadge}</td>
            <td>${buyerHtml}</td>
            <td><span class="mgr-cycle-pill">${p.siteCycleCount || 0} cycles</span><div class="mgr-art-meta">${p.siteDropCount || 0} drops</div></td>
            <td>
              <div style="display:flex;gap:5px;flex-wrap:wrap">
                ${!p.realSold ? `<button type="button" class="mgr-btn danger small" data-action="site-mark-sold" data-id="${esc(p.id)}" data-art="${esc(p.managerArtworkId || '')}" data-title="${esc(p.title)}">Mark sold</button>` : ''}
                ${p.visible && !p.realSold ? `<button type="button" class="mgr-btn outline small" data-action="site-toggle-fake-sold" data-id="${esc(p.id)}" data-art="${esc(p.managerArtworkId || '')}" data-fake="${p.fakeSold ? '0' : '1'}" title="Toggle storefront sold-out scarcity display only">${p.fakeSold ? 'Site display: Sold' : 'Site display: Available'}</button>` : ''}
                ${p.realSold ? `<button type="button" class="mgr-btn outline small" data-action="site-mark-available" data-id="${esc(p.id)}" data-art="${esc(p.managerArtworkId || '')}">Mark in stock</button>` : ''}
              </div>
            </td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>` : '<p class="mgr-muted">No site stock records match this filter. Click "Sync from site" or "+ Import from warehouse" above.</p>'}
    </section>`;
}

function fmtIdleDuration(mins) {
  const m = Math.max(0, Math.round(Number(mins) || 0));
  if (m < 2) return 'Active just now';
  if (m < 60) return `${m}m idle`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h < 24) return `${h}h ${rem}m idle`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h idle`;
}

function renderCustomersTab() {
  const data = state.customerBagsData;
  if (!data) {
    return `<div class="mgr-head"><div><p class="mgr-eyebrow">Customer Tracking · Bags &amp; Buyers</p><h1>Customer Bags &amp; Buyers</h1></div><div class="mgr-head-actions"><button type="button" class="mgr-btn outline small" data-action="refresh-all">Reload ↻</button></div></div>
    <div class="mgr-panel"><p class="mgr-muted">${state.loadingData ? 'Loading customer bags and buyer records…' : 'Could not load customer tracking yet. Tap Reload.'}</p></div>`;
  }
  const bags = Array.isArray(data.bags) ? data.bags : [];
  const buyers = Array.isArray(data.buyers) ? data.buyers : [];
  const s = data.summary || {};
  const q = state.customerSearch.trim().toLowerCase().replace(/^#/, '');

  const inBagBags = bags.filter(b => b.liveStatus === 'active' || b.liveStatus === 'abandoned');
  const abandonedBags = bags.filter(b => b.liveStatus === 'abandoned');
  const contactableBags = inBagBags.filter(b => b.hasContact);
  const convertedBags = bags.filter(b => b.liveStatus === 'converted');

  const chips = [
    ['in_bag', 'In bag (active + abandoned)', inBagBags.length],
    ['abandoned', 'Abandoned (30m+)', abandonedBags.length],
    ['contactable', 'With email / phone', contactableBags.length],
    ['converted', 'Checked out', convertedBags.length],
    ['buyers', 'All buyers', buyers.length]
  ];

  let contentHtml = '';
  if (state.customerFilter === 'buyers') {
    const filteredBuyers = buyers.filter(b => {
      if (!q) return true;
      const itemsText = (b.items || []).map(i => `${i.title || ''} ${i.refNumber || ''} ${i.orderRef || ''}`).join(' ');
      return `${b.name || ''} ${b.email || ''} ${b.phone || ''} ${b.city || ''} ${b.address || ''} ${itemsText}`.toLowerCase().includes(q);
    });
    contentHtml = `<section class="mgr-panel">
      ${filteredBuyers.length ? `<div class="mgr-table-wrap"><table class="mgr-table">
        <thead><tr><th>Buyer</th><th>Contact</th><th>Shipping location</th><th>Orders</th><th>Total spent</th><th>Purchased artworks</th></tr></thead>
        <tbody>${filteredBuyers.map(b => {
          const wa = waPhoneHref(b.phone);
          return `<tr>
            <td><strong>${esc(b.name || 'Customer')}</strong><div class="mgr-art-meta">Last order ${fmtDateTime(b.lastOrderAt)}</div></td>
            <td>
              <div class="mgr-contact-links" style="display:grid;gap:2px">
                ${b.phone ? `<a href="tel:${esc(b.phone)}">${esc(b.phone)}</a>` : ''}
                ${wa ? `<a href="${esc(wa)}" target="_blank" rel="noopener">WhatsApp ↗</a>` : ''}
                ${b.email ? `<a href="mailto:${esc(b.email)}">${esc(b.email)}</a>` : ''}
                ${!b.phone && !b.email ? '<span class="mgr-muted">—</span>' : ''}
              </div>
            </td>
            <td><div>${esc(b.city || '—')}</div>${b.address || b.postalCode ? `<small class="mgr-muted">${esc([b.address, b.postalCode].filter(Boolean).join(', '))}</small>` : ''}</td>
            <td><strong>${b.orderCount || 0}</strong></td>
            <td><strong>${money(b.totalSpent || 0)}</strong></td>
            <td>
              <div style="display:flex;flex-wrap:wrap;gap:5px">${(b.items || []).map(it => `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 6px;border:1px solid var(--line);border-radius:6px;background:var(--surface-soft);font-size:11.5px">${refPillMarkup(it.refNumber, findArtIdByRef(it.refNumber, it.title))}<span>${esc(it.title)}</span></span>`).join('')}</div>
            </td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>` : '<p class="mgr-muted">No recorded buyers match this search yet.</p>'}
    </section>`;
  } else {
    const baseList = state.customerFilter === 'abandoned'
      ? abandonedBags
      : state.customerFilter === 'contactable'
        ? contactableBags
        : state.customerFilter === 'converted'
          ? convertedBags
          : inBagBags;
    const filteredBags = baseList.filter(b => {
      if (!q) return true;
      const itemHay = (b.items || []).map(i => `${i.title || ''} ${i.refNumber || ''}`).join(' ');
      return `${b.name || ''} ${b.email || ''} ${b.phone || ''} ${b.city || ''} ${b.state || ''} ${itemHay}`.toLowerCase().includes(q);
    });
    const stageLabels = { browsing: 'Browsing', bag_open: 'Opened bag', checkout: 'Started checkout', ordered: 'Ordered' };
    contentHtml = filteredBags.length
      ? `<div class="mgr-bag-grid">${filteredBags.map(b => {
          const wa = waPhoneHref(b.phone);
          const statusCls = b.liveStatus === 'abandoned' ? 'is-abandoned' : b.liveStatus === 'active' ? 'is-active' : 'is-converted';
          const statusText = b.liveStatus === 'abandoned'
            ? `Abandoned · ${fmtIdleDuration(b.minutesIdle)}`
            : b.liveStatus === 'active'
              ? `In bag · ${fmtIdleDuration(b.minutesIdle)}`
              : 'Checked out';
          return `<article class="mgr-bag-card ${b.liveStatus === 'abandoned' ? 'is-abandoned' : ''}">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
              <div>
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px">
                  <span class="mgr-pill ${statusCls}">${esc(statusText)}</span>
                  <span class="mgr-dest-tag">${b.customerType === 'member' ? 'Signed-in' : 'Guest'} · ${esc(stageLabels[b.stage] || b.stage)}</span>
                </div>
                <strong style="font-size:15px">${esc(b.name || b.email || 'Guest shopper')}</strong>
                <div class="mgr-art-meta">Updated ${fmtDateTime(b.updatedAt)}${b.city || b.state ? ` · ${esc([b.city, b.state].filter(Boolean).join(', '))}` : ''}</div>
              </div>
              <button type="button" class="mgr-link" data-action="dismiss-customer-bag" data-id="${esc(b.id)}" title="Remove tracked bag">Dismiss</button>
            </div>

            ${(b.email || b.phone) ? `<div class="mgr-contact-links">
              ${b.phone ? `<a href="tel:${esc(b.phone)}">${esc(b.phone)}</a>` : ''}
              ${wa ? `<a href="${esc(wa)}" target="_blank" rel="noopener">WhatsApp ↗</a>` : ''}
              ${b.email ? `<a href="mailto:${esc(b.email)}">${esc(b.email)}</a>` : ''}
            </div>` : '<p class="mgr-muted" style="font-size:12px">No contact info entered yet (still browsing with items in bag).</p>'}

            ${(b.items || []).length ? `<div class="mgr-bag-items">${b.items.map(it => `<div class="mgr-bag-item-chip">
              ${it.image ? `<img src="${esc(it.image)}" alt="">` : ''}
              <div style="flex:1;min-width:0">
                <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap">
                  ${refPillMarkup(it.refNumber, findArtIdByRef(it.refNumber, it.title))}
                  <strong style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(it.title)}</strong>
                </div>
                <div class="mgr-art-meta">Qty ${it.quantity} · ${money(it.price)}${!it.stillInStock ? ' · <span style="color:var(--danger)">Now sold out</span>' : ' · <span style="color:var(--accent)">In stock</span>'}</div>
              </div>
            </div>`).join('')}</div>` : ''}

            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding-top:6px;border-top:1px solid #f0f0f0;font-size:12.5px">
              <span>Bag value: <strong>${money(b.totalValue || 0)}</strong> (${b.itemCount || 0} ${b.itemCount === 1 ? 'piece' : 'pieces'})</span>
              ${b.promoCode ? `<span class="mgr-cycle-pill">Code: ${esc(b.promoCode)}</span>` : ''}
              ${b.convertedOrderId ? `<span class="mgr-pill is-sold">Order #${esc(String(b.convertedOrderId).slice(-8).toUpperCase())}</span>` : ''}
            </div>
          </article>`;
        }).join('')}</div>`
      : '<div class="mgr-panel"><p class="mgr-muted">No tracked bags match this filter yet. Live storefront visitors who add items to their bag will appear here automatically.</p></div>';
  }

  return `<div class="mgr-head">
      <div>
        <p class="mgr-eyebrow">Customer Tracking · Bags &amp; Buyers</p>
        <h1>Customer Bags &amp; Buyers</h1>
      </div>
      <div class="mgr-head-actions">
        <button type="button" class="mgr-btn outline small" data-action="refresh-all">Refresh ↻</button>
      </div>
    </div>

    <div class="mgr-kpi-grid">
      <div class="mgr-kpi"><span>In bag now</span><strong>${s.inBagCount || 0}</strong><small>${s.activeCount || 0} active · ${s.abandonedCount || 0} abandoned</small></div>
      <div class="mgr-kpi"><span>Abandoned bags (30m+)</span><strong style="color:${(s.abandonedCount || 0) > 0 ? 'var(--danger)' : 'var(--ink)'}">${s.abandonedCount || 0}</strong><small>Left items without checking out</small></div>
      <div class="mgr-kpi"><span>Potential bag value</span><strong>${money(s.potentialValue || 0)}</strong><small>Waiting inside customer bags</small></div>
      <div class="mgr-kpi"><span>With contact info</span><strong>${s.withContactCount || 0}</strong><small>Ready for WhatsApp / email follow-up</small></div>
      <div class="mgr-kpi"><span>Real buyers</span><strong>${s.buyersCount || 0}</strong><small>${s.convertedCount || 0} tracked bag conversions</small></div>
    </div>

    <div class="mgr-chips">
      ${chips.map(([k, label, count]) => `<button type="button" class="mgr-chip ${state.customerFilter === k ? 'is-active' : ''}" data-action="set-customer-filter" data-filter="${k}">${esc(label)} (${count})</button>`).join('')}
    </div>

    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:12px">
      <input id="mgr-customer-search" type="search" value="${esc(state.customerSearch)}" placeholder="Search by customer name, email, phone, city, #Ref, or artwork…" style="width:100%;max-width:420px;padding:7px 12px;border-radius:8px;border:1px solid var(--line-strong);background:var(--surface)">
    </div>

    ${contentHtml}`;
}

/* Modals */
function renderImportSiteModalListHtml(q = '') {
  const clean = String(q || '').trim().toLowerCase().replace(/^#/, '');
  const list = (state.siteStockData?.warehouseArtworks || []).filter(a => {
    if (!clean) return true;
    return `${a.refNumber || ''} ${a.title} ${a.artistName} ${a.genre}`.toLowerCase().includes(clean);
  });
  if (!list.length) return '<p class="mgr-muted" style="padding:10px;font-size:12px">No eligible warehouse artworks match right now.</p>';
  return list.map(a => `<label class="mgr-order-opt" style="align-items:center">
    <input type="checkbox" name="importArtworkIds" value="${esc(a.id)}">
    ${a.images?.[0] ? artImgTag(a, 0, 'alt="" style="width:36px;height:36px;border-radius:6px;object-fit:cover;flex-shrink:0"') : ''}
    <div style="flex:1;min-width:0">
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <span class="mgr-ref-pill">#${esc(getRefCode(a) || '—')}</span>
        <strong>${esc(a.title)}</strong>
        ${(a.siteCycleCount || 0) > 0 ? `<span class="mgr-cycle-pill">Cycles: ${a.siteCycleCount}</span>` : ''}
      </div>
      <div class="mgr-art-meta">${esc(a.artistName)} · ${esc(a.genre)} · ${esc(STAGE_LABEL[a.stage] || a.stage)}</div>
    </div>
    <strong>${a.price > 0 ? money(a.price) : '<small class="mgr-muted">Uses default ₹</small>'}</strong>
  </label>`).join('');
}

function openImportSiteModal() {
  state.importSearch = '';
  const dlg = $('mgr-dialog');
  const count = (state.siteStockData?.warehouseArtworks || []).length;
  dlg.innerHTML = `<div class="mgr-dialog-head">
      <div><p class="mgr-eyebrow">Warehouse → Site Stock</p><h2>Import artworks to hehe.cafe (${count} ready)</h2></div>
      <button type="button" class="mgr-btn outline small" data-action="close-modal">Close</button>
    </div>
    <p id="mgr-modal-alert" class="mgr-modal-alert" role="alert" hidden></p>
    <form id="mgr-import-site-form" style="display:grid;gap:12px">
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">
        <label class="mgr-field" style="flex:1;min-width:190px">Search warehouse<input id="mgr-import-search" type="search" placeholder="Filter by #Ref, title, or artist…"></label>
        <label class="mgr-field" style="width:150px">Default price if TBD (₹)<input name="defaultPrice" type="number" min="1" step="1" value="250"></label>
      </div>
      <div style="display:flex;gap:12px;align-items:center">
        <button type="button" class="mgr-link" data-action="import-select-all">Select all visible</button>
        <button type="button" class="mgr-link" data-action="import-select-none">Clear</button>
      </div>
      <div id="mgr-import-list" class="mgr-order-pick-list" style="max-height:280px">${renderImportSiteModalListHtml('')}</div>
      <div style="display:flex;justify-content:flex-end;gap:8px">
        <button type="submit" class="mgr-btn accent">Import selected to live site →</button>
      </div>
    </form>`;
  dlg.showModal();
}

function openRefreshSiteModal() {
  const dlg = $('mgr-dialog');
  const summary = state.siteStockData?.summary || {};
  dlg.innerHTML = `<div class="mgr-dialog-head">
      <div><p class="mgr-eyebrow">Warehouse ↔ Site Stock Cycle</p><h2>Refresh live site stock</h2></div>
      <button type="button" class="mgr-btn outline small" data-action="close-modal">Close</button>
    </div>
    <p id="mgr-modal-alert" class="mgr-modal-alert" role="alert" hidden></p>
    <p class="mgr-muted" style="margin-bottom:12px">This rotates the storefront automatically:</p>
    <ol class="mgr-muted" style="margin:0 0 14px;padding-left:18px;display:grid;gap:4px">
      <li>All current unsold &amp; display-sold site stock (<strong>${(summary.liveAvailable || 0) + (summary.liveFakeSold || 0)}</strong> pcs) moves back into the <strong>Warehouse</strong> and increments each piece's <strong>Cycle</strong> count.</li>
      <li>Genuinely sold items remain marked <strong>Sold</strong> and are excluded.</li>
      <li>Picks <strong>20 random artworks</strong> from Warehouse and puts them live on <strong>hehe.cafe</strong>.</li>
      <li>Marks <strong>3 random pieces</strong> out of the 20 as <strong>Sold on site only</strong> (fake scarcity order — still tracked as available in Warehouse).</li>
    </ol>
    <form id="mgr-refresh-site-form" class="mgr-form-grid">
      <label class="mgr-field">Random pieces to put on site<input name="pickCount" type="number" min="1" max="50" value="20" required></label>
      <label class="mgr-field">Random fake-sold on site<input name="fakeSoldCount" type="number" min="0" max="50" value="3" required></label>
      <label class="mgr-field wide">Default price (₹) for unpriced warehouse pieces<input name="defaultPrice" type="number" min="1" max="500000" value="250" required></label>
      <div class="mgr-field wide" style="display:flex;justify-content:flex-end;gap:8px;padding-top:6px">
        <button type="button" class="mgr-btn outline small" data-action="close-modal">Cancel</button>
        <button type="submit" class="mgr-btn accent">↻ Refresh site stock now →</button>
      </div>
    </form>`;
  dlg.showModal();
}

/* Modals */
function openCurationModal(artworkId) {
  const art = state.artworks.find(a => a.id === artworkId);
  if (!art) return;
  state.curateImages = Array.isArray(art.images) ? [...art.images] : [];
  state.curateBackups = Array.isArray(art.backupImages) ? [...art.backupImages] : [];
  renderCurationModalBody(art);
  $('mgr-dialog').showModal();
}

function renderCurationModalBody(art) {
  const dlg = $('mgr-dialog');
  dlg.innerHTML = `<div class="mgr-dialog-head">
      <div><p class="mgr-eyebrow">Admin Curation · #${esc(getRefCode(art) || '—')}</p><h2>${esc(art.title)}</h2></div>
      <button type="button" class="mgr-btn outline small" data-action="close-modal">Close</button>
    </div>
    <p id="mgr-modal-alert" class="mgr-modal-alert" role="alert" hidden></p>
    <form id="mgr-curate-form" data-id="${esc(art.id)}" class="mgr-form-grid">
      <div class="mgr-field wide">
        <span>Artwork photos (Freeimage.host HD + Firebase Base64 backup)</span>
        <div class="mgr-preview-imgs" style="margin-bottom:6px">
          ${state.curateImages.map((src, i) => `<div class="mgr-preview-thumb"><img src="${esc(src)}" ${state.curateBackups[i] && state.curateBackups[i] !== src ? `data-fallback-src="${esc(state.curateBackups[i])}"` : ''} alt="">${i === 0 ? '<span class="mgr-cover-tag">COVER</span>' : ''}${state.curateImages.length > 1 ? `<button type="button" class="mgr-thumb-del" data-action="remove-curate-thumb" data-id="${esc(art.id)}" data-idx="${i}">×</button>` : ''}</div>`).join('')}
        </div>
        <div class="mgr-photo-bar">
          <label class="mgr-btn accent small mgr-camera-btn ${state.uploadingPhotosText ? 'is-disabled' : ''}">
            <span>📷 ${state.uploadingPhotosText ? 'Uploading…' : 'Take photo'}</span>
            <input id="mgr-curate-camera" data-id="${esc(art.id)}" type="file" accept="image/*" capture="environment" ${state.uploadingPhotosText ? 'disabled' : ''}>
          </label>
          <label class="mgr-dropzone ${state.uploadingPhotosText ? 'is-disabled' : ''}">
            <strong>+ Choose from gallery (HD + Base64 backup)</strong>
            <input id="mgr-curate-files" data-id="${esc(art.id)}" type="file" accept="image/jpeg,image/png,image/webp" multiple ${state.uploadingPhotosText ? 'disabled' : ''}>
          </label>
        </div>
        ${state.uploadingPhotosText ? `<div class="mgr-upload-progress" role="status">${esc(state.uploadingPhotosText)}</div>` : ''}
      </div>
      <label class="mgr-field">Title (optional)<input name="title" maxlength="120" value="${esc(art.title)}"></label>
      <label class="mgr-field">Artist<input name="artistName" required maxlength="120" value="${esc(art.artistName)}"></label>
      <label class="mgr-field">Genre / product type<input name="genre" required maxlength="60" value="${esc(art.genre)}"></label>
      <label class="mgr-field">Selling price (₹)<input id="mgr-curate-price" name="price" type="number" min="0" step="0.01" value="${art.price || 0}"></label>
      <label class="mgr-field">Pipeline stage<select name="stage">${STAGES.filter(([k]) => k !== 'all').map(([k, label]) => `<option value="${k}" ${art.stage === k ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></label>
      <label class="mgr-field">1-of-1 availability<select name="stock"><option value="1" ${art.stock !== 0 ? 'selected' : ''}>Available (1-of-1)</option><option value="0" ${art.stock === 0 ? 'selected' : ''}>Sold out (0)</option></select></label>
      <label class="mgr-field">Assigned pickup bin artist<input name="assignedBinArtist" maxlength="120" value="${esc(art.assignedBinArtist || art.artistName)}"></label>
      <label class="mgr-field">Pickup batch / tag<input name="binBatch" maxlength="60" value="${esc(art.binBatch || '')}" placeholder="e.g. Nov Pickup #2"></label>
      <label class="mgr-field">Material<input name="material" maxlength="150" value="${esc(art.material || '')}"></label>
      <label class="mgr-field">Dimensions<input name="dimensions" maxlength="150" value="${esc(art.dimensions || '')}"></label>
      <label class="mgr-field wide">Store description &amp; story<textarea name="description" maxlength="3000" placeholder="Full description used when adding to hehe.cafe Artworks…">${esc(art.description || art.artistNotes || '')}</textarea></label>
      <label class="mgr-field">Badge (optional)<input name="tag" maxlength="60" value="${esc(art.tag || '')}"></label>
      <label class="mgr-field">Care / bin note<input name="binNote" maxlength="300" value="${esc(art.binNote || art.care || '')}" placeholder="Pickup or packaging instructions"></label>
      <div class="mgr-field wide" style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;padding-top:6px">
        <button type="button" class="mgr-btn danger small" data-action="confirm-delete-art" data-id="${esc(art.id)}">Remove piece</button>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button type="button" class="mgr-btn outline small" data-action="open-bin-modal" data-id="${esc(art.id)}">Bin destination…</button>
          <button type="submit" class="mgr-btn outline">Save curation</button>
          <button type="button" class="mgr-btn accent" data-action="publish-from-modal" data-id="${esc(art.id)}">${art.storeProductId ? 'Sync hehe.cafe Artworks ↻' : 'Add to hehe.cafe Artworks →'}</button>
        </div>
      </div>
    </form>`;
}

function renderOrderPickerListHtml(bm) {
  const q = String(bm.orderQuery || '').trim().toLowerCase().replace(/^#/, '');
  const selectedRefs = new Set(bm.artworkIds.map(id => {
    const a = state.artworks.find(x => x.id === id);
    return a ? getRefCode(a) : '';
  }).filter(Boolean));
  const selectedProdIds = new Set(bm.artworkIds.map(id => {
    const a = state.artworks.find(x => x.id === id);
    return a?.storeProductId || '';
  }).filter(Boolean));

  const ranked = state.orders
    .map(o => {
      const matched = (o.items || []).some(it => (it.refNumber && selectedRefs.has(it.refNumber)) || (it.productId && selectedProdIds.has(it.productId)));
      return { o, matched };
    })
    .filter(({ o }) => {
      if (!q) return true;
      const itemRefs = (o.items || []).map(i => `${i.refNumber || ''} ${i.title || ''}`).join(' ');
      return `${o.orderRef} ${o.customerName} ${o.city} ${o.notes} ${itemRefs}`.toLowerCase().includes(q);
    })
    .sort((a, b) => Number(b.matched) - Number(a.matched) || ((Number(b.o.createdAt) || 0) - (Number(a.o.createdAt) || 0)));

  if (!ranked.length) return '<p class="mgr-muted" style="padding:10px;font-size:12px">No matching hehe.cafe orders found.</p>';
  return ranked.map(({ o, matched }) => {
    const refs = (o.items || []).map(i => i.refNumber ? `#${i.refNumber} ${i.title}` : i.title).join(', ');
    return `<label class="mgr-order-opt">
      <input type="radio" name="binTargetOrderId" value="${esc(o.id)}" ${bm.binTargetOrderId === o.id ? 'checked' : ''}>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap">
          <div><code style="font-weight:600">#${esc(o.orderRef)}</code> <strong>${esc(o.customerName)}</strong> ${matched ? '<span class="mgr-vel-badge is-fast">Ref match</span>' : ''}</div>
          <span class="mgr-muted">${money(o.totalAmount)} · ${esc(o.city || 'India')}</span>
        </div>
        <div class="mgr-art-meta">${esc(refs || 'Order items')}</div>
        ${o.notes ? `<div class="mgr-art-meta" style="color:var(--ink-2)">Note: ${esc(o.notes)}</div>` : ''}
      </div>
    </label>`;
  }).join('');
}

function renderBinDestinationModalBody() {
  const bm = state.binModal;
  if (!bm) return;
  const dlg = $('mgr-dialog');
  const arts = bm.artworkIds.map(id => state.artworks.find(a => a.id === id)).filter(Boolean);
  const firstArt = arts[0];
  const single = arts.length === 1;
  const activeCafes = state.cafes.filter(c => c.active !== false);

  dlg.innerHTML = `<div class="mgr-dialog-head">
      <div><p class="mgr-eyebrow">Pickup Delivery Bin Assignment</p><h2>${single ? esc(firstArt?.title || 'Artwork') : `Assign ${arts.length} artworks to pickup bin`}</h2></div>
      <button type="button" class="mgr-btn outline small" data-action="close-modal">Close</button>
    </div>
    <p id="mgr-modal-alert" class="mgr-modal-alert" role="alert" hidden></p>
    <form id="mgr-bin-dest-form" style="display:grid;gap:12px">
      <div style="display:flex;flex-wrap:wrap;gap:5px">
        ${arts.map(a => `<span class="mgr-ref-pill">#${esc(getRefCode(a) || '—')} ${esc(a.title)}</span>`).join('')}
      </div>
      <div class="mgr-field">Destination for this pickup
        <div class="mgr-seg-tabs" style="margin-top:4px">
          <button type="button" class="mgr-seg-btn ${bm.binTargetType === 'customer' ? 'is-active' : ''}" data-action="bin-dest-tab" data-type="customer">Customer Order</button>
          <button type="button" class="mgr-seg-btn ${bm.binTargetType === 'cafe' ? 'is-active' : ''}" data-action="bin-dest-tab" data-type="cafe">Partner Café</button>
          <button type="button" class="mgr-seg-btn ${bm.binTargetType === 'studio' ? 'is-active' : ''}" data-action="bin-dest-tab" data-type="studio">Studio Stock</button>
        </div>
      </div>

      ${bm.binTargetType === 'customer' ? `<div class="mgr-field">Select hehe.cafe customer order (artists will see Customer Name, Order Ref, Artwork #Ref &amp; Notes)
        <input id="mgr-bin-order-search" type="search" value="${esc(bm.orderQuery)}" placeholder="Search by #Order Ref, Artwork #Ref, customer name, or city…" style="margin-bottom:6px">
        <div id="mgr-bin-order-list" class="mgr-order-pick-list">${renderOrderPickerListHtml(bm)}</div>
      </div>` : ''}

      ${bm.binTargetType === 'cafe' ? `<label class="mgr-field">Select destination partner café
        <select name="binTargetCafeId" required>
          <option value="">Choose a partner café…</option>
          ${activeCafes.map(c => `<option value="${esc(c.id)}" ${bm.binTargetCafeId === c.id ? 'selected' : ''}>${esc(c.name)} (${esc(c.city || 'India')})</option>`).join('')}
        </select>
      </label>` : ''}

      <div class="mgr-form-grid">
        ${single ? `<label class="mgr-field">Assigned artist bin<input name="assignedBinArtist" maxlength="120" value="${esc(bm.assignedBinArtist || firstArt?.artistName || '')}"></label>` : '<div class="mgr-field"><span>Assigned artist bins</span><span class="mgr-muted">Auto-routed to each artwork’s artist</span></div>'}
        <label class="mgr-field">Pickup batch / label<input name="binBatch" maxlength="60" value="${esc(bm.binBatch)}" placeholder="e.g. Nov Pickup #2"></label>
      </div>
      <label class="mgr-field">Packing / courier note for artist<input name="binNote" maxlength="300" value="${esc(bm.binNote)}" placeholder="e.g. Bubble wrap frame + include #Ref sticker"></label>
      <div style="display:flex;justify-content:flex-end;gap:8px">
        <button type="submit" class="mgr-btn accent">Save to Pickup Bin →</button>
      </div>
    </form>`;
}

function openBinDestinationModal(artworkIds) {
  const ids = [...new Set(artworkIds)].filter(Boolean);
  if (!ids.length) return;
  const first = state.artworks.find(a => a.id === ids[0]) || {};
  const firstRef = getRefCode(first);
  const autoMatchedOrder = state.orders.find(o => (o.items || []).some(i => (firstRef && i.refNumber === firstRef) || (first.storeProductId && i.productId === first.storeProductId)));

  state.binModal = {
    artworkIds: ids,
    binTargetType: first.binTargetType || (autoMatchedOrder ? 'customer' : state.cafes.length ? 'cafe' : 'studio'),
    binTargetCafeId: first.binTargetCafeId || state.cafes.find(c => c.active !== false)?.id || '',
    binTargetOrderId: first.binTargetOrderId || autoMatchedOrder?.id || '',
    orderQuery: '',
    assignedBinArtist: ids.length === 1 ? (first.assignedBinArtist || first.artistName || '') : '',
    binBatch: first.binBatch || '',
    binNote: first.binNote || ''
  };
  renderBinDestinationModalBody();
  $('mgr-dialog').showModal();
}

function openCafeModal(cafeId = '') {
  const cafe = cafeId ? state.cafes.find(c => c.id === cafeId) : null;
  const dlg = $('mgr-dialog');
  dlg.innerHTML = `<div class="mgr-dialog-head">
      <div><p class="mgr-eyebrow">Partner Café Network</p><h2>${cafe ? `Edit ${esc(cafe.name)}` : 'Add partner café'}</h2></div>
      <button type="button" class="mgr-btn outline small" data-action="close-modal">Close</button>
    </div>
    <p id="mgr-modal-alert" class="mgr-modal-alert" role="alert" hidden></p>
    <form id="mgr-cafe-form" data-id="${esc(cafe?.id || '')}" class="mgr-form-grid">
      <label class="mgr-field">Café name<input name="name" required maxlength="100" value="${esc(cafe?.name || '')}" placeholder="e.g. Third Wave Coffee Indiranagar"></label>
      <label class="mgr-field">City<input name="city" maxlength="80" value="${esc(cafe?.city || '')}" placeholder="e.g. Bengaluru"></label>
      <label class="mgr-field">Neighbourhood / Area<input name="area" maxlength="80" value="${esc(cafe?.area || '')}"></label>
      <label class="mgr-field">Café commission (%)<input name="commissionPct" type="number" min="0" max="60" step="0.5" value="${cafe?.commissionPct ?? 15}"></label>
      <label class="mgr-field">Owner / manager name<input name="contactName" maxlength="100" value="${esc(cafe?.contactName || '')}"></label>
      <label class="mgr-field">Phone<input name="phone" maxlength="20" value="${esc(cafe?.phone || '')}"></label>
      <label class="mgr-field wide">Notes<textarea name="notes" maxlength="500">${esc(cafe?.notes || '')}</textarea></label>
      <label class="mgr-field wide" style="display:flex;align-items:center;gap:8px;flex-direction:row"><input type="checkbox" name="active" style="width:auto" ${cafe?.active !== false ? 'checked' : ''}><span>Active partner café</span></label>
      <div class="mgr-field wide" style="display:flex;justify-content:flex-end"><button type="submit" class="mgr-btn">Save café →</button></div>
    </form>`;
  dlg.showModal();
}

function openAssignCafeModal(preselectedIds = null, preselectedCafeId = '') {
  const activeCafes = state.cafes.filter(c => c.active !== false);
  const assignable = preselectedIds
    ? state.artworks.filter(a => preselectedIds.includes(a.id) && !['at_cafe', 'sold'].includes(a.stage))
    : state.artworks.filter(a => !['at_cafe', 'sold'].includes(a.stage));
  if (!activeCafes.length) return toast('Add an active partner café first.');
  if (!assignable.length) return toast('No eligible (unplaced / unsold) artworks to assign.');
  const dlg = $('mgr-dialog');
  dlg.innerHTML = `<div class="mgr-dialog-head">
      <div><p class="mgr-eyebrow">Consignment Batch Dispatch</p><h2>Send batch to partner café</h2></div>
      <button type="button" class="mgr-btn outline small" data-action="close-modal">Close</button>
    </div>
    <p id="mgr-modal-alert" class="mgr-modal-alert" role="alert" hidden></p>
    <form id="mgr-assign-cafe-form" style="display:grid;gap:12px">
      <div class="mgr-form-grid">
        <label class="mgr-field">Choose partner café<select name="cafeId" required>${activeCafes.map(c => `<option value="${esc(c.id)}" ${preselectedCafeId === c.id ? 'selected' : ''}>${esc(c.name)} (${esc(c.city || 'India')} · ${Number(c.commissionPct) || 0}% fee)</option>`).join('')}</select></label>
        <label class="mgr-field">Batch label<input name="batchLabel" maxlength="80" placeholder="e.g. Nov Shelf Drop"></label>
      </div>
      <div class="mgr-field">Select 1-of-1 artworks in this batch:
        <div class="mgr-recon-list" style="max-height:220px">
          ${assignable.map(a => `<label style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:#fff;border:1px solid var(--line);border-radius:6px;cursor:pointer">
            <input type="checkbox" name="artworkIds" value="${esc(a.id)}" style="width:auto" ${preselectedIds ? 'checked' : ''}>
            <span class="mgr-ref-pill">#${esc(getRefCode(a) || '—')}</span>
            <span style="flex:1"><strong>${esc(a.title)}</strong> <small class="mgr-muted">· ${esc(a.genre)} · ${esc(a.artistName)}</small></span>
            <strong>${a.price > 0 ? money(a.price) : 'TBD'}</strong>
          </label>`).join('')}
        </div>
      </div>
      <label class="mgr-field">Dispatch note (optional)<input name="notes" maxlength="300" placeholder="e.g. Weekend counter display"></label>
      <button type="submit" class="mgr-btn accent">Dispatch batch &amp; generate Batch Code →</button>
    </form>`;
  dlg.showModal();
}

function renderReconcileModalBody() {
  const rm = state.reconModal;
  if (!rm) return;
  const dlg = $('mgr-dialog');
  const cafe = state.cafes.find(c => c.id === rm.cafeId) || { name: 'Partner Café', commissionPct: 0 };
  const items = state.cafeStock.filter(s => s.cafeId === rm.cafeId && ['at_cafe', 'return_requested'].includes(s.status) && (rm.batchId === 'legacy' ? !s.batchId : s.batchId === rm.batchId));
  const batchObj = state.batches.find(b => b.id === rm.batchId);
  const returnedCount = items.filter(s => rm.returnedIds.has(s.id)).length;
  const soldItems = items.filter(s => !rm.returnedIds.has(s.id));
  const estGross = soldItems.reduce((sum, s) => sum + (Number(rm.priceOverrides[s.id] ?? s.price) || 0), 0);
  const feePct = Number(cafe.commissionPct) || 0;
  const estFee = Math.round(estGross * feePct) / 100;

  dlg.innerHTML = `<div class="mgr-dialog-head">
      <div>
        <p class="mgr-eyebrow">Unsold Return Reconciliation · ${esc(batchObj?.batchCode || 'LEGACY-UNBATCHED')}</p>
        <h2>${esc(cafe.name)}</h2>
      </div>
      <button type="button" class="mgr-btn outline small" data-action="close-modal">Close</button>
    </div>
    <p id="mgr-modal-alert" class="mgr-modal-alert" role="alert" hidden></p>
    <p class="mgr-muted" style="margin-bottom:10px">Check or scan every piece that came back <strong>unsold</strong>. Unchecked pieces in this batch will automatically be inferred and logged as <strong>Sold at Café</strong>.</p>
    <form id="mgr-reconcile-form" style="display:grid;gap:12px">
      <div class="mgr-field">Quick #Ref return check (type 6-digit #Ref and press Enter to toggle Returned)
        <input id="mgr-recon-scan" type="text" autocomplete="off" value="${esc(rm.scanQuery || '')}" placeholder="e.g. 104529 → press Enter">
      </div>
      <div class="mgr-recon-list">
        ${items.map(s => {
          const isRet = rm.returnedIds.has(s.id);
          const priceVal = rm.priceOverrides[s.id] ?? s.price ?? 0;
          return `<div class="mgr-recon-row ${isRet ? 'is-returning' : 'is-inferred-sold'}">
            <label style="display:flex;align-items:center;gap:8px;flex:1;min-width:190px;cursor:pointer">
              <input type="checkbox" data-recon-toggle="${esc(s.id)}" style="width:16px;height:16px;accent-color:var(--danger)" ${isRet ? 'checked' : ''}>
              <span class="mgr-ref-pill">#${esc(s.refNumber || '—')}</span>
              <span><strong>${esc(s.title)}</strong><br><small class="mgr-muted">${esc(s.artistName)} · ${esc(s.genre)}</small></span>
            </label>
            ${isRet
              ? '<span class="mgr-pill is-returned">Returning unsold</span>'
              : `<div style="display:flex;align-items:center;gap:6px"><span class="mgr-pill is-live_online">Auto-Sold</span><input type="number" min="1" step="0.01" data-recon-price="${esc(s.id)}" value="${priceVal}" style="width:90px;padding:5px 7px;border:1px solid var(--line-strong);border-radius:6px;font:500 12px Inter,sans-serif" title="Final sale price (₹)"></div>`}
          </div>`;
        }).join('')}
      </div>
      <label class="mgr-field">Return note / reason<input name="returnReason" maxlength="250" value="${esc(rm.returnReason || 'Unsold batch rotation')}"></label>
      <div class="mgr-recon-summary">
        <span>Returning unsold: <strong style="color:var(--danger)">${returnedCount} pcs</strong></span>
        <span>Auto-marked Sold: <strong style="color:var(--accent)">${soldItems.length} pcs</strong></span>
        <span>Gross: <strong>${money(estGross)}</strong> · Café fee (${feePct}%): <strong>${money(estFee)}</strong></span>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px">
        <button type="submit" class="mgr-btn accent">Confirm Reconciliation →</button>
      </div>
    </form>`;
}

function openReconcileModal(cafeId, batchId) {
  const items = state.cafeStock.filter(s => s.cafeId === cafeId && ['at_cafe', 'return_requested'].includes(s.status) && (batchId === 'legacy' ? !s.batchId : s.batchId === batchId));
  if (!items.length) return toast('No active pieces remain in this batch.');
  state.reconModal = {
    cafeId,
    batchId,
    returnedIds: new Set(),
    priceOverrides: {},
    scanQuery: '',
    returnReason: 'Unsold batch rotation'
  };
  renderReconcileModalBody();
  $('mgr-dialog').showModal();
}

function openBatchReturnRequestModal(cafeId, batchId) {
  const cafe = state.cafes.find(c => c.id === cafeId);
  const dlg = $('mgr-dialog');
  dlg.innerHTML = `<div class="mgr-dialog-head">
      <div><p class="mgr-eyebrow">Partner Café Return Call</p><h2>Request unsold return · ${esc(cafe?.name || 'Café')}</h2></div>
      <button type="button" class="mgr-btn outline small" data-action="close-modal">Close</button>
    </div>
    <p id="mgr-modal-alert" class="mgr-modal-alert" role="alert" hidden></p>
    <form id="mgr-req-return-form" data-cafe="${esc(cafeId)}" data-batch="${esc(batchId)}" style="display:grid;gap:12px">
      <p class="mgr-muted">Marks every active artwork in this batch as <strong>Return requested</strong> until the box arrives back at the studio for reconciliation.</p>
      <label class="mgr-field">Return note<input name="note" maxlength="250" value="Unsold stock rotation"></label>
      <div style="display:flex;justify-content:flex-end;gap:8px">
        <button type="submit" class="mgr-btn">Mark return requested →</button>
      </div>
    </form>`;
  dlg.showModal();
}

function openBinReceiveModal(artworkId) {
  const art = state.artworks.find(a => a.id === artworkId);
  if (!art) return;
  const dlg = $('mgr-dialog');
  dlg.innerHTML = `<div class="mgr-dialog-head">
      <div><p class="mgr-eyebrow">Pickup Bin Check-In · #${esc(getRefCode(art) || '—')}</p><h2>${esc(art.title)}</h2></div>
      <button type="button" class="mgr-btn outline small" data-action="close-modal">Close</button>
    </div>
    <p id="mgr-modal-alert" class="mgr-modal-alert" role="alert" hidden></p>
    <p class="mgr-muted" style="margin-bottom:14px">Confirm how to update this artwork after physical hand-off to the studio.</p>
    <div style="display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap">
      <button type="button" class="mgr-btn outline" data-action="bin-receive-exec" data-id="${esc(artworkId)}" data-curated="0">Keep in bin (Received)</button>
      <button type="button" class="mgr-btn accent" data-action="bin-receive-exec" data-id="${esc(artworkId)}" data-curated="1">Received &amp; move to Curated →</button>
    </div>`;
  dlg.showModal();
}

function openCafeSaleModal(stock) {
  const dlg = $('mgr-dialog');
  const defaultComm = Number(stock.commissionPct) || 0;
  const userMatch = state.users.find(u => normKey(u.artistName) === normKey(stock.artistName));
  const artistComm = userMatch ? (Number(userMatch.commissionPct) || 60) : 60;
  dlg.innerHTML = `<div class="mgr-dialog-head">
      <div><p class="mgr-eyebrow">Log Single Café Sale · ${esc(stock.cafeName)}</p><h2>${esc(stock.title)}</h2></div>
      <button type="button" class="mgr-btn outline small" data-action="close-modal">Close</button>
    </div>
    <p id="mgr-modal-alert" class="mgr-modal-alert" role="alert" hidden></p>
    <form id="mgr-cafe-sale-form" data-id="${esc(stock.id)}" class="mgr-form-grid">
      <label class="mgr-field">Final sale price (₹)<input id="sale-price-in" name="salePrice" type="number" required min="1" step="0.01" value="${stock.price > 0 ? stock.price : ''}"></label>
      <label class="mgr-field">Café commission (%)<input id="sale-comm-in" name="commissionPct" type="number" min="0" max="60" step="0.5" value="${defaultComm}"></label>
      <div class="mgr-split-preview mgr-field wide" id="sale-split-preview"></div>
      <div class="mgr-field wide" style="display:flex;justify-content:flex-end"><button type="submit" class="mgr-btn accent">Confirm sale &amp; mark sold →</button></div>
    </form>`;
  const updatePreview = () => {
    const p = Number($('sale-price-in')?.value) || 0;
    const cc = Number($('sale-comm-in')?.value) || 0;
    const cafeCut = Math.round(p * cc) / 100;
    const artistCut = Math.min(Math.max(0, p - cafeCut), Math.round(p * artistComm) / 100);
    const studioNet = Math.max(0, p - cafeCut - artistCut);
    const box = $('sale-split-preview');
    if (box) {
      box.innerHTML = `<strong>Live Commission Split (${esc(stock.artistName)} at ${artistComm}%)</strong>
        <span>Sale: <strong>${money(p)}</strong> − Café (${cc}%): <strong>${money(cafeCut)}</strong> − Artist (${artistComm}%): <strong>${money(artistCut)}</strong> = Studio Net: <strong>${money(studioNet)}</strong></span>`;
    }
  };
  dlg.querySelector('#sale-price-in').oninput = updatePreview;
  dlg.querySelector('#sale-comm-in').oninput = updatePreview;
  updatePreview();
  dlg.showModal();
}

function openPayoutModal(artistName = '', dueAmount = '') {
  const summaries = state.payoutData?.summaries || [];
  const options = [...new Set([artistName, ...summaries.map(s => s.artist)].filter(Boolean))];
  const dlg = $('mgr-dialog');
  dlg.innerHTML = `<div class="mgr-dialog-head">
      <div><p class="mgr-eyebrow">Artist Settlement</p><h2>Record artist payout</h2></div>
      <button type="button" class="mgr-btn outline small" data-action="close-modal">Close</button>
    </div>
    <p id="mgr-modal-alert" class="mgr-modal-alert" role="alert" hidden></p>
    <form id="mgr-payout-form" class="mgr-form-grid">
      <label class="mgr-field wide">Artist<input name="artistName" list="mgr-payout-artists" required maxlength="120" value="${esc(artistName)}" placeholder="Select or type artist name"><datalist id="mgr-payout-artists">${options.map(a => `<option value="${esc(a)}">`).join('')}</datalist></label>
      <label class="mgr-field">Amount paid (₹)<input name="amount" type="number" required min="1" step="0.01" value="${dueAmount > 0 ? Number(dueAmount).toFixed(2) : ''}"></label>
      <label class="mgr-field">Method<select name="method"><option value="upi">UPI</option><option value="bank_transfer">Bank transfer / NEFT</option><option value="cash">Cash</option><option value="other">Other</option></select></label>
      <label class="mgr-field">UTR / Reference<input name="reference" maxlength="100" placeholder="UPI ID or bank ref"></label>
      <label class="mgr-field">Period label<input name="periodLabel" maxlength="80" placeholder="e.g. Nov 2026"></label>
      <label class="mgr-field wide">Note (optional)<input name="note" maxlength="300" placeholder="Optional settlement remarks"></label>
      <div class="mgr-field wide" style="display:flex;justify-content:flex-end"><button type="submit" class="mgr-btn accent">Record payout &amp; update ledger →</button></div>
    </form>`;
  dlg.showModal();
}

function openEditUserModal(u) {
  const dlg = $('mgr-dialog');
  dlg.innerHTML = `<div class="mgr-dialog-head">
      <div><p class="mgr-eyebrow">Team Member</p><h2>${esc(u.email)}</h2></div>
      <button type="button" class="mgr-btn outline small" data-action="close-modal">Close</button>
    </div>
    <p id="mgr-modal-alert" class="mgr-modal-alert" role="alert" hidden></p>
    <form id="mgr-edit-user-form" data-email="${esc(u.email)}" class="mgr-form-grid">
      <label class="mgr-field">Status<select name="status"><option value="approved" ${(u.status === 'approved' || u.status === 'pending') ? 'selected' : ''}>Approved</option><option value="pending">Pending</option><option value="revoked" ${u.status === 'revoked' ? 'selected' : ''}>Revoked</option></select></label>
      <label class="mgr-field">Role<select name="role"><option value="artist" ${u.role !== 'admin' ? 'selected' : ''}>Artist</option><option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option></select></label>
      <label class="mgr-field">Mapped artist name<input name="artistName" maxlength="120" value="${esc(u.artistName || u.requestedArtistName || '')}" placeholder="Must match artwork artist name"></label>
      <label class="mgr-field">Artist commission (%)<input name="commissionPct" type="number" min="0" max="100" step="0.5" value="${u.commissionPct ?? 60}"></label>
      <div class="mgr-field wide" style="display:flex;justify-content:flex-end"><button type="submit" class="mgr-btn">Save member settings →</button></div>
    </form>`;
  dlg.showModal();
}

function openConfirmModal({ eyebrow = 'Confirm action', title, message, confirmLabel = 'Confirm', danger = false, onConfirmAction, dataAttrs = '' }) {
  const dlg = $('mgr-dialog');
  dlg.innerHTML = `<div class="mgr-dialog-head">
      <div><p class="mgr-eyebrow">${esc(eyebrow)}</p><h2>${esc(title)}</h2></div>
      <button type="button" class="mgr-btn outline small" data-action="close-modal">Cancel</button>
    </div>
    <p id="mgr-modal-alert" class="mgr-modal-alert" role="alert" hidden></p>
    <p class="mgr-muted" style="margin-bottom:16px">${esc(message)}</p>
    <div style="display:flex;justify-content:flex-end;gap:8px">
      <button type="button" class="mgr-btn outline small" data-action="close-modal">Cancel</button>
      <button type="button" class="mgr-btn ${danger ? 'danger' : 'accent'}" data-action="${esc(onConfirmAction)}" ${dataAttrs}>${esc(confirmLabel)}</button>
    </div>`;
  dlg.showModal();
}

/* Events */
document.addEventListener('keydown', event => {
  if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) && !$('mgr-dialog')?.open) {
    const inp = $('mgr-global-lookup');
    if (inp) { event.preventDefault(); inp.focus(); }
  } else if (event.key === 'Escape') {
    let changed = false;
    if (state.lookupQuery) { state.lookupQuery = ''; updateLookupResultsOnly(); changed = true; }
    if (state.drawerArtworkId) { state.drawerArtworkId = ''; renderDrawer(); changed = true; }
    if (changed) event.preventDefault();
  } else if (event.key === 'Enter' && event.target.id === 'mgr-recon-scan' && state.reconModal) {
    event.preventDefault();
    const q = event.target.value.trim().replace(/^#/, '');
    if (!q) return;
    const match = state.cafeStock.find(s =>
      s.cafeId === state.reconModal.cafeId
      && ['at_cafe', 'return_requested'].includes(s.status)
      && (state.reconModal.batchId === 'legacy' ? !s.batchId : s.batchId === state.reconModal.batchId)
      && (s.refNumber === q || String(s.refNumber || '').endsWith(q))
    );
    if (!match) return toast(`No piece with Ref #${q} found in this batch.`, { isError: true });
    if (state.reconModal.returnedIds.has(match.id)) state.reconModal.returnedIds.delete(match.id);
    else state.reconModal.returnedIds.add(match.id);
    state.reconModal.scanQuery = '';
    renderReconcileModalBody();
    $('mgr-recon-scan')?.focus();
  }
});

document.addEventListener('click', async event => {
  if (!event.target.closest('.mgr-lookup-wrap') && state.lookupQuery) {
    state.lookupQuery = '';
    updateLookupResultsOnly();
  }
  const pilotBtn = event.target.closest('[data-pilot-action]');
  if (pilotBtn) {
    const pa = pilotBtn.dataset.pilotAction;
    if (pa === 'set-quick') {
      const b = quickRangeBounds(pilotBtn.dataset.quick || 'today');
      state.trafficPreset = 'custom';
      state.trafficFromMs = b.fromMs;
      state.trafficToMs = b.toMs;
      state.trafficFromLocal = b.fromLocal;
      state.trafficToLocal = b.toLocal;
    } else if (pa === 'set-preset') {
      state.trafficPreset = pilotBtn.dataset.preset || 'all';
      if (state.trafficPreset !== 'custom') { state.trafficFromMs = 0; state.trafficToMs = 0; }
    } else if (pa === 'set-device') {
      state.trafficDevice = pilotBtn.dataset.device || 'all';
    }
    const ctrlHost = $('mgr-traffic-controls');
    if (ctrlHost) {
      ctrlHost.innerHTML = pilotControlsMarkup({
        preset: state.trafficPreset,
        device: state.trafficDevice,
        fromLocal: state.trafficFromLocal || toDatetimeLocalValue(Date.now() - 3600000),
        toLocal: state.trafficToLocal || toDatetimeLocalValue(Date.now()),
        rangeText: state.siteTraffic?.window?.rangeText || '',
        showHeatmapBtn: true,
        heatmapHref: 'https://hehe.cafe/#home?heatmap=1'
      });
    }
    void pollActiveTabLive({ manual: true });
    return;
  }
  const btn = event.target.closest('[data-action]');
  if (!btn || btn.disabled) return;
  const action = btn.dataset.action;
  const id = btn.dataset.id;
  const origText = btn.textContent;
  try {
    if (action === 'google-signin' || action === 'google-signin-redirect') {
      btn.disabled = true;
      await signInWithGoogle({ redirect: action === 'google-signin-redirect' });
    } else if (action === 'mgr-signout') {
      await signOutManager();
    } else if (action === 'recheck-access' || action === 'refresh-all') {
      btn.disabled = true;
      await refreshAccess();
    } else if (action === 'nav-tab') {
      state.tab = btn.dataset.tab || 'analytics';
      if (state.tab !== 'cafes') state.activeCafeId = '';
      syncManagerLivePolling();
      render();
      void pollActiveTabLive({ manual: true });
    } else if (action === 'quick-upload') {
      state.tab = 'artworks';
      state.uploadPanelOpen = true;
      render();
    } else if (action === 'clear-lookup') {
      state.lookupQuery = '';
      const inp = $('mgr-global-lookup');
      if (inp) inp.value = '';
      updateLookupResultsOnly();
    } else if (action === 'lookup-pick' || action === 'open-drawer') {
      state.lookupQuery = '';
      state.drawerArtworkId = id;
      updateLookupResultsOnly();
      renderDrawer();
    } else if (action === 'close-drawer') {
      state.drawerArtworkId = '';
      renderDrawer();
    } else if (action === 'set-range') {
      state.range = btn.dataset.range || 'all';
      await loadWorkspaceData();
    } else if (action === 'set-art-view') {
      state.artView = btn.dataset.view === 'grid' ? 'grid' : 'kanban';
      render();
    } else if (action === 'toggle-upload-panel') {
      state.uploadPanelOpen = !state.uploadPanelOpen;
      render();
    } else if (action === 'pick-upload-genre') {
      state.uploadGenreDraft = btn.dataset.genre || '';
      const inp = $('mgr-upload-genre');
      if (inp) inp.value = state.uploadGenreDraft;
      document.querySelectorAll('[data-action="pick-upload-genre"]').forEach(c => c.classList.toggle('is-active', c.dataset.genre === state.uploadGenreDraft));
    } else if (action === 'remove-upload-thumb') {
      const idx = Number(btn.dataset.idx);
      state.selectedUploadImages.splice(idx, 1);
      state.selectedUploadBackups.splice(idx, 1);
      render();
    } else if (action === 'remove-curate-thumb') {
      const idx = Number(btn.dataset.idx);
      state.curateImages.splice(idx, 1);
      state.curateBackups.splice(idx, 1);
      const art = state.artworks.find(a => a.id === id);
      if (art) renderCurationModalBody(art);
    } else if (action === 'set-stage-filter') {
      state.stageFilter = btn.dataset.stage || 'all';
      render();
    } else if (action === 'set-site-filter') {
      state.siteFilter = btn.dataset.filter || 'all';
      render();
    } else if (action === 'set-customer-filter') {
      state.customerFilter = btn.dataset.filter || 'in_bag';
      render();
    } else if (action === 'dismiss-customer-bag') {
      btn.disabled = true;
      setBusy(true);
      await callManager('managerDismissCustomerBag', { bagId: id });
      toast('Removed customer bag record.');
      await loadWorkspaceData();
    } else if (action === 'set-demand-sort') {
      state.itemDemandSort = btn.dataset.sort === 'carts' ? 'carts' : 'clicks';
      const lowerEl = $('mgr-traffic-lower');
      if (lowerEl) lowerEl.innerHTML = renderTrafficLowerMarkup();
      else render();
    } else if (action === 'toggle-traffic-live') {
      state.trafficLivePaused = !state.trafficLivePaused;
      syncManagerLivePolling();
      const pill = $('mgr-traffic-live-pill');
      const label = $('mgr-traffic-live-label');
      const toggleBtn = $('mgr-traffic-toggle-btn');
      if (pill) pill.classList.toggle('is-paused', state.trafficLivePaused);
      if (label) label.textContent = state.trafficLivePaused ? 'Paused' : 'Live · 5s';
      if (toggleBtn) toggleBtn.textContent = state.trafficLivePaused ? 'Resume live' : 'Pause live';
      if (!state.trafficLivePaused) void pollActiveTabLive({ manual: true });
    } else if (action === 'refresh-traffic-now') {
      btn.disabled = true;
      await pollActiveTabLive({ manual: true });
    } else if (action === 'set-globe-mode') {
      state.trafficGlobeMode = btn.dataset.mode === 'live' ? 'live' : 'all';
      document.querySelectorAll('[data-action="set-globe-mode"]').forEach(b => {
        b.classList.toggle('is-active', b.dataset.mode === state.trafficGlobeMode);
      });
      const distEl = $('mgr-traffic-dist-list');
      if (distEl) distEl.innerHTML = renderTrafficDistributionListMarkup();
      syncTrafficGlobe();
    } else if (action === 'reset-globe') {
      state.trafficFocusedLocKey = '';
      document.querySelectorAll('#mgr-traffic-dist-list .mgr-dist-row').forEach(el => el.classList.remove('is-active'));
      trafficGlobeController?.resetView();
    } else if (action === 'focus-globe-loc') {
      const locKey = btn.dataset.locKey || '';
      const loc = (state.siteTraffic?.topLocations || []).find(l => `${l.label}|${l.country}` === locKey);
      const coords = loc ? resolveLocationCoords(loc) : null;
      state.trafficFocusedLocKey = locKey;
      document.querySelectorAll('#mgr-traffic-dist-list .mgr-dist-row').forEach(el => {
        el.classList.toggle('is-active', el.dataset.locKey === locKey);
      });
      if (coords) trafficGlobeController?.focusLocation(coords.lat, coords.lng, locKey);
    } else if (action === 'schedule-pause' || action === 'schedule-resume' || action === 'schedule-toggle-timer') {
      btn.disabled = true;
      setBusy(true);
      const schedAction = action === 'schedule-pause' ? 'pause' : action === 'schedule-resume' ? 'resume' : 'toggle_timer';
      const nextSched = await callManager('managerUpdateStockSchedule', {
        action: schedAction,
        ...(schedAction === 'toggle_timer' ? { showTimerOnSite: btn.dataset.show === '1' } : {})
      });
      if (state.siteStockData) state.siteStockData.stockSchedule = nextSched;
      toast(schedAction === 'pause' ? 'Auto-refresh paused.' : schedAction === 'resume' ? 'Auto-refresh active!' : (nextSched.showTimerOnSite ? 'Countdown timer shown on hehe.cafe.' : 'Countdown timer hidden from visitors.'));
      render();
    } else if (action === 'open-import-site-modal') {
      openImportSiteModal();
    } else if (action === 'open-refresh-site-modal') {
      openRefreshSiteModal();
    } else if (action === 'import-select-all' || action === 'import-select-none') {
      const checked = action === 'import-select-all';
      $('mgr-import-list')?.querySelectorAll('input[name="importArtworkIds"]').forEach(cb => { cb.checked = checked; });
    } else if (action === 'sync-from-site') {
      btn.disabled = true;
      btn.textContent = 'Syncing…';
      setBusy(true);
      const res = await callManager('managerSyncFromSite');
      toast(`Synced from hehe.cafe: ${res.importedCount} imported, ${res.markedSoldCount} sold.`);
      await loadWorkspaceData();
    } else if (action === 'site-mark-sold') {
      openConfirmModal({
        eyebrow: 'Site Stock · Mark Sold',
        title: `Mark "${btn.dataset.title || 'Artwork'}" as sold?`,
        message: 'This sets stock to 0 on hehe.cafe and marks the artwork Sold in Manager (excluded from future rotations).',
        confirmLabel: 'Mark sold',
        danger: true,
        onConfirmAction: 'exec-site-mark-sold',
        dataAttrs: `data-id="${esc(id || '')}" data-art="${esc(btn.dataset.art || '')}"`
      });
    } else if (action === 'exec-site-mark-sold') {
      btn.disabled = true;
      btn.textContent = 'Updating…';
      setBusy(true);
      await callManager('managerMarkSiteProductSold', { productId: id || '', artworkId: btn.dataset.art || '', sold: true, fakeOnly: false });
      $('mgr-dialog')?.close();
      toast('Marked artwork as sold on site and in Manager.');
      await loadWorkspaceData();
    } else if (action === 'drawer-mark-sold') {
      openConfirmModal({
        eyebrow: 'Mark Artwork Sold',
        title: 'Mark this artwork as sold?',
        message: 'Marks stage Sold (stock 0) in Manager and sets stock to 0 on hehe.cafe if linked.',
        confirmLabel: 'Mark sold',
        danger: true,
        onConfirmAction: 'exec-drawer-mark-sold',
        dataAttrs: `data-id="${esc(id || '')}"`
      });
    } else if (action === 'exec-drawer-mark-sold') {
      btn.disabled = true;
      btn.textContent = 'Updating…';
      setBusy(true);
      await callManager('managerMarkSiteProductSold', { artworkId: id, sold: true, fakeOnly: false });
      $('mgr-dialog')?.close();
      toast('Artwork marked sold.');
      await loadWorkspaceData();
    } else if (action === 'site-toggle-fake-sold') {
      const fake = btn.dataset.fake === '1';
      btn.disabled = true;
      setBusy(true);
      await callManager('managerMarkSiteProductSold', { productId: id || '', artworkId: btn.dataset.art || '', sold: fake, fakeOnly: fake });
      toast(fake ? 'Marked fake-sold on site (still kept available in Warehouse).' : 'Cleared fake-sold flag — artwork is live in stock.');
      await loadWorkspaceData();
    } else if (action === 'site-mark-available') {
      btn.disabled = true;
      setBusy(true);
      await callManager('managerMarkSiteProductSold', { productId: id || '', artworkId: btn.dataset.art || '', sold: false });
      toast('Artwork marked back in stock on site and Manager.');
      await loadWorkspaceData();
    } else if (action === 'select-all-shown') {
      filterArtworks().forEach(a => state.selectedArtIds.add(a.id));
      render();
    } else if (action === 'clear-art-selection') {
      state.selectedArtIds.clear();
      render();
    } else if (action === 'open-bin-modal') {
      openBinDestinationModal([id]);
    } else if (action === 'bulk-assign-bin') {
      openBinDestinationModal([...state.selectedArtIds]);
    } else if (action === 'bin-dest-tab' && state.binModal) {
      state.binModal.binTargetType = btn.dataset.type || 'studio';
      renderBinDestinationModalBody();
    } else if (action === 'send-one-cafe') {
      openAssignCafeModal([id]);
    } else if (action === 'bulk-assign-cafe') {
      openAssignCafeModal([...state.selectedArtIds]);
    } else if (action === 'bulk-publish-store') {
      const ids = [...state.selectedArtIds];
      const readyCount = ids.filter(x => (state.artworks.find(a => a.id === x)?.price || 0) > 0).length;
      openConfirmModal({
        eyebrow: 'Bulk Add to hehe.cafe Artworks',
        title: `Add ${readyCount} priced piece(s) to hehe.cafe Artworks?`,
        message: `Pieces are added to the hehe.cafe Admin Artworks section (hidden from homepage until Admin enables them). ${ids.length - readyCount} unpriced piece(s) will be skipped.`,
        confirmLabel: 'Add to Artworks →',
        onConfirmAction: 'exec-bulk-publish'
      });
    } else if (action === 'exec-bulk-publish') {
      btn.disabled = true;
      btn.textContent = 'Adding to hehe.cafe…';
      setBusy(true);
      const ids = [...state.selectedArtIds];
      const res = await callManager('managerBulkUpdateArtworks', { artworkIds: ids, action: 'publish_store' });
      state.selectedArtIds.clear();
      $('mgr-dialog')?.close();
      toast(`Added ${res.updatedCount} piece(s) to hehe.cafe Artworks${res.skippedCount ? ` (${res.skippedCount} skipped)` : ''}.`);
      await loadWorkspaceData();
    } else if (action === 'close-modal') {
      $('mgr-dialog')?.close();
    } else if (action === 'edit-mgr-art') {
      openCurationModal(id);
    } else if (action === 'confirm-delete-art') {
      const art = state.artworks.find(a => a.id === id);
      openConfirmModal({
        eyebrow: 'Remove Artwork',
        title: `Remove "${art?.title || 'artwork'}"?`,
        message: 'This permanently deletes the intake record from the studio manager.',
        confirmLabel: 'Remove piece',
        danger: true,
        onConfirmAction: 'exec-delete-art',
        dataAttrs: `data-id="${esc(id)}"`
      });
    } else if (action === 'exec-delete-art') {
      btn.disabled = true;
      btn.textContent = 'Removing…';
      setBusy(true);
      await callManager('managerDeleteArtwork', { artworkId: id });
      $('mgr-dialog')?.close();
      if (state.drawerArtworkId === id) state.drawerArtworkId = '';
      toast('Artwork removed.');
      await loadWorkspaceData();
    } else if (action === 'publish-mgr-art' || action === 'publish-from-modal') {
      const art = state.artworks.find(a => a.id === id);
      if (action === 'publish-from-modal') {
        const form = $('mgr-curate-form');
        const fd = new FormData(form);
        const priceVal = Number(fd.get('price') || 0);
        if (!Number.isFinite(priceVal) || priceVal <= 0) {
          showModalError('Enter a selling price greater than ₹0 before adding to hehe.cafe Artworks.');
          $('mgr-curate-price')?.focus();
          return;
        }
        showModalError('');
        btn.disabled = true;
        btn.textContent = art?.storeProductId ? 'Syncing to hehe.cafe…' : 'Adding to hehe.cafe…';
        setBusy(true);
        await callManager('managerUpdateArtwork', {
          artworkId: id,
          patch: {
            title: fd.get('title'),
            artistName: fd.get('artistName'),
            genre: fd.get('genre'),
            price: priceVal,
            stage: fd.get('stage'),
            stock: Number(fd.get('stock') ?? 1),
            assignedBinArtist: fd.get('assignedBinArtist'),
            binBatch: fd.get('binBatch'),
            binNote: fd.get('binNote'),
            material: fd.get('material'),
            dimensions: fd.get('dimensions'),
            tag: fd.get('tag'),
            description: fd.get('description'),
            images: state.curateImages,
            backupImages: state.curateBackups
          }
        });
      } else {
        if (!art || !(art.price > 0)) {
          openCurationModal(id);
          showModalError('Set a selling price (> ₹0) and description, then click "Add to hehe.cafe Artworks →".');
          $('mgr-curate-price')?.focus();
          return;
        }
        btn.disabled = true;
        btn.textContent = art.storeProductId ? 'Syncing…' : 'Adding…';
        setBusy(true);
      }
      const res = await callManager('managerPublishToStore', { artworkId: id });
      $('mgr-dialog')?.close();
      toast(`Added #${res.refNumber} to hehe.cafe Artworks (off homepage until Admin enables it).`);
      await loadWorkspaceData();
    } else if (action === 'bin-step') {
      btn.disabled = true;
      btn.textContent = 'Updating…';
      setBusy(true);
      await callManager('managerUpdateBinStatus', { artworkId: id, binStatus: btn.dataset.status });
      toast(`Marked ${btn.dataset.status.replace('_', ' ')}!`);
      await loadWorkspaceData();
    } else if (action === 'bin-receive-modal') {
      openBinReceiveModal(id);
    } else if (action === 'bin-receive-exec') {
      btn.disabled = true;
      btn.textContent = 'Confirming…';
      setBusy(true);
      const moveToCurated = btn.dataset.curated === '1';
      await callManager('managerUpdateBinStatus', { artworkId: id, binStatus: 'received_at_studio', moveToCurated });
      $('mgr-dialog')?.close();
      toast(moveToCurated ? 'Received at studio & moved to Curated!' : 'Confirmed received at studio.');
      await loadWorkspaceData();
    } else if (action === 'open-cafe-modal') {
      openCafeModal(id || '');
    } else if (action === 'open-cafe-detail') {
      state.tab = 'cafes';
      state.activeCafeId = id;
      render();
    } else if (action === 'close-cafe-detail') {
      state.activeCafeId = '';
      render();
    } else if (action === 'open-assign-cafe-modal') {
      openAssignCafeModal(null, btn.dataset.cafe || state.activeCafeId || '');
    } else if (action === 'batch-request-return') {
      openBatchReturnRequestModal(btn.dataset.cafe, btn.dataset.batch);
    } else if (action === 'open-reconcile-modal') {
      openReconcileModal(btn.dataset.cafe, btn.dataset.batch);
    } else if (action === 'cafe-mark-sold') {
      const stock = state.cafeStock.find(s => s.id === id);
      if (stock) openCafeSaleModal(stock);
    } else if (action === 'print-handover-challan' || action === 'print-return-challan') {
      const cafe = state.cafes.find(c => c.id === id);
      const isReturn = action === 'print-return-challan';
      const batchId = btn.dataset.batch || '';
      const batchObj = batchId ? state.batches.find(b => b.id === batchId) : null;
      const items = state.cafeStock.filter(s => s.cafeId === id && (!batchId || (batchId === 'legacy' ? !s.batchId : s.batchId === batchId)) && (isReturn ? s.status === 'returned_to_studio' : ['at_cafe', 'return_requested'].includes(s.status)));
      if (!openPrintableChallan({ type: isReturn ? 'return' : 'handover', cafe, items, batchCode: batchObj?.batchCode || '' })) {
        toast('Allow popups to open the printable challan.');
      }
    } else if (action === 'open-payout-modal') {
      openPayoutModal(btn.dataset.artist || '', btn.dataset.due || '');
    } else if (action === 'confirm-delete-payout') {
      openConfirmModal({
        eyebrow: 'Payout Ledger',
        title: `Remove ${money(btn.dataset.amount)} payout?`,
        message: `Removes this recorded payout for ${btn.dataset.artist} and restores the due balance.`,
        confirmLabel: 'Remove payout',
        danger: true,
        onConfirmAction: 'exec-delete-payout',
        dataAttrs: `data-id="${esc(id)}"`
      });
    } else if (action === 'exec-delete-payout') {
      btn.disabled = true;
      btn.textContent = 'Removing…';
      setBusy(true);
      await callManager('managerDeletePayout', { payoutId: id });
      $('mgr-dialog')?.close();
      toast('Payout record removed.');
      await loadWorkspaceData();
    } else if (action === 'print-artist-settlement') {
      const targetArtist = btn.dataset.artist || state.me.artistName || 'Artist';
      const summary = (state.payoutData?.summaries || []).find(s => normKey(s.artist) === normKey(targetArtist)) || {};
      const payouts = (state.payoutData?.payouts || []).filter(p => normKey(p.artistName) === normKey(targetArtist));
      const sales = state.payoutData?.mySales || [];
      if (!openPrintableSettlement({ artistName: summary.artist || targetArtist, commissionPct: summary.commissionPct ?? 60, sales, payouts, summary })) {
        toast('Allow popups to open the settlement statement.');
      }
    } else if (action === 'edit-user-modal') {
      const u = state.users.find(x => x.email === btn.dataset.email);
      if (u) openEditUserModal(u);
    } else if (action === 'confirm-revoke-user') {
      const email = btn.dataset.email;
      openConfirmModal({
        eyebrow: 'Revoke Access',
        title: `Revoke access for ${email}?`,
        message: 'They will immediately be blocked from entering the Chain Manager until re-approved.',
        confirmLabel: 'Revoke access',
        danger: true,
        onConfirmAction: 'exec-revoke-user',
        dataAttrs: `data-email="${esc(email)}"`
      });
    } else if (action === 'exec-revoke-user') {
      btn.disabled = true;
      btn.textContent = 'Revoking…';
      setBusy(true);
      const email = btn.dataset.email;
      await callManager('managerApproveUser', { email, status: 'revoked', role: 'artist' });
      $('mgr-dialog')?.close();
      toast(`Revoked access for ${email}.`);
      await loadWorkspaceData();
    } else if (action === 'clear-all-cafes') {
      openConfirmModal({
        eyebrow: 'Partner Cafés · Cleanup',
        title: 'Clear all Partner Café data?',
        message: 'Permanently removes all partner cafés, café shelf stock, batches, and café sales records, and resets any artwork references back to Studio Stock. Online orders and sales are NOT touched.',
        confirmLabel: 'Clear café data',
        danger: true,
        onConfirmAction: 'exec-clear-all-cafes'
      });
    } else if (action === 'exec-clear-all-cafes') {
      btn.disabled = true;
      btn.textContent = 'Clearing…';
      setBusy(true);
      const clearRes = await callManager('managerClearAllCafes', { confirm: 'CLEAR ALL CAFES' });
      const cleared = clearRes?.cleared || clearRes || {};
      $('mgr-dialog')?.close();
      state.activeCafeId = '';
      toast(`Cleared cafés (${cleared?.cafes || 0} cafés, ${cleared?.stock || 0} shelf items).`);
      await loadWorkspaceData();
    }
  } catch (error) {
    toast(error?.message || 'Action failed.', { isError: true });
  } finally {
    setBusy(false);
    if (btn.isConnected) {
      btn.disabled = false;
      btn.textContent = origText;
    }
  }
});

$('mgr-drawer-backdrop')?.addEventListener('click', () => {
  state.drawerArtworkId = '';
  renderDrawer();
});

/* Drag & Drop */
document.addEventListener('dragstart', event => {
  const card = event.target.closest('[data-drag-art]');
  if (!card) return;
  const artId = card.dataset.dragArt;
  state.dragArtId = artId;
  card.classList.add('is-dragging');
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', artId);
  }
});

document.addEventListener('dragend', () => {
  state.dragArtId = '';
  document.querySelectorAll('.is-dragging').forEach(el => el.classList.remove('is-dragging'));
  document.querySelectorAll('.is-drag-over').forEach(el => el.classList.remove('is-drag-over'));
});

document.addEventListener('dragover', event => {
  const zone = event.target.closest('[data-drop-stage], [data-drop-cafe], [data-drop-target]');
  if (!zone) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  zone.classList.add('is-drag-over');
});

document.addEventListener('dragleave', event => {
  const zone = event.target.closest('[data-drop-stage], [data-drop-cafe], [data-drop-target]');
  if (zone && (!event.relatedTarget || !zone.contains(event.relatedTarget))) {
    zone.classList.remove('is-drag-over');
  }
});

document.addEventListener('drop', async event => {
  const zone = event.target.closest('[data-drop-stage], [data-drop-cafe], [data-drop-target]');
  if (!zone) return;
  event.preventDefault();
  zone.classList.remove('is-drag-over');
  const artId = event.dataTransfer?.getData('text/plain') || state.dragArtId;
  if (!artId) return;
  const art = state.artworks.find(a => a.id === artId);
  if (!art) return;

  try {
    if (zone.dataset.dropCafe) {
      openAssignCafeModal([artId], zone.dataset.dropCafe);
    } else if (zone.dataset.dropTarget === 'pickup_bin' || zone.dataset.dropStage === 'delivery_bin') {
      openBinDestinationModal([artId]);
    } else if (zone.dataset.dropStage === 'at_cafe') {
      openAssignCafeModal([artId]);
    } else if (zone.dataset.dropTarget === 'live_online' || zone.dataset.dropStage === 'live_online') {
      if (art.price > 0 && art.stage !== 'sold') {
        setBusy(true);
        const res = await callManager('managerPublishToStore', { artworkId: artId });
        toast(`Added #${res.refNumber} to hehe.cafe Artworks (off homepage until Admin enables it).`);
        await loadWorkspaceData();
      } else {
        openCurationModal(artId);
        showModalError('Set a selling price (> ₹0), then click "Add to hehe.cafe Artworks →".');
      }
    } else if (zone.dataset.dropStage) {
      const targetStage = zone.dataset.dropStage;
      if (art.stage === targetStage) return;
      setBusy(true);
      await callManager('managerUpdateArtwork', { artworkId: artId, patch: { stage: targetStage } });
      toast(`Moved #${getRefCode(art)} to ${STAGE_LABEL[targetStage] || targetStage}.`);
      await loadWorkspaceData();
    }
  } catch (error) {
    toast(error?.message || 'Drop action failed.', { isError: true });
  } finally {
    setBusy(false);
  }
});

document.addEventListener('change', async event => {
  if (event.target.id === 'mgr-upload-files' || event.target.id === 'mgr-upload-camera') {
    try {
      setBusy(true);
      const res = await uploadArtworkFiles(event.target.files, text => {
        state.uploadingPhotosText = text;
        render();
      });
      state.selectedUploadImages = [...state.selectedUploadImages, ...res.images].slice(0, 4);
      state.selectedUploadBackups = [...state.selectedUploadBackups, ...res.backupImages].slice(0, 4);
      state.uploadingPhotosText = '';
      if (res.fallbackUsed) {
        toast('Uploaded using Firebase Base64 backup (configure FREEIMAGE_API_KEY on Worker for HD links).');
      } else if (res.hostedCount) {
        toast(`Uploaded ${res.hostedCount} HD photo(s) + Firebase Base64 backup.`);
      }
      render();
    } catch (error) {
      state.uploadingPhotosText = '';
      render();
      toast(error?.message || 'Could not process image.', { isError: true });
    } finally {
      event.target.value = '';
      setBusy(false);
    }
  } else if (event.target.id === 'mgr-curate-files' || event.target.id === 'mgr-curate-camera') {
    const artId = event.target.dataset.id;
    const art = state.artworks.find(a => a.id === artId);
    if (!art) return;
    try {
      setBusy(true);
      const res = await uploadArtworkFiles(event.target.files, text => {
        state.uploadingPhotosText = text;
        renderCurationModalBody(art);
      });
      state.curateImages = [...state.curateImages, ...res.images].slice(0, 4);
      state.curateBackups = [...state.curateBackups, ...res.backupImages].slice(0, 4);
      state.uploadingPhotosText = '';
      renderCurationModalBody(art);
      toast(res.fallbackUsed ? 'Photo saved with Firebase Base64 backup.' : 'Uploaded HD photo + Base64 backup.');
    } catch (error) {
      state.uploadingPhotosText = '';
      renderCurationModalBody(art);
      toast(error?.message || 'Could not upload photo.', { isError: true });
    } finally {
      event.target.value = '';
      setBusy(false);
    }
  } else if (event.target.dataset?.selectArt) {
    const id = event.target.dataset.selectArt;
    if (event.target.checked) state.selectedArtIds.add(id);
    else state.selectedArtIds.delete(id);
    render();
  } else if (event.target.dataset?.reconToggle && state.reconModal) {
    const sid = event.target.dataset.reconToggle;
    if (event.target.checked) state.reconModal.returnedIds.add(sid);
    else state.reconModal.returnedIds.delete(sid);
    renderReconcileModalBody();
  } else if (event.target.name === 'binTargetOrderId' && state.binModal) {
    state.binModal.binTargetOrderId = event.target.value;
  }
});

document.addEventListener('input', event => {
  if (event.target.id === 'mgr-global-lookup') {
    state.lookupQuery = event.target.value;
    updateLookupResultsOnly();
  } else if (event.target.id === 'mgr-art-search') {
    state.artSearch = event.target.value;
    const pos = event.target.selectionStart;
    render();
    const input = $('mgr-art-search');
    if (input) { input.focus(); input.setSelectionRange(pos, pos); }
  } else if (event.target.id === 'mgr-site-search') {
    state.siteSearch = event.target.value;
    const pos = event.target.selectionStart;
    render();
    const input = $('mgr-site-search');
    if (input) { input.focus(); input.setSelectionRange(pos, pos); }
  } else if (event.target.id === 'mgr-customer-search') {
    state.customerSearch = event.target.value;
    const pos = event.target.selectionStart;
    render();
    const input = $('mgr-customer-search');
    if (input) { input.focus(); input.setSelectionRange(pos, pos); }
  } else if (event.target.id === 'mgr-import-search') {
    state.importSearch = event.target.value;
    const list = $('mgr-import-list');
    if (list) list.innerHTML = renderImportSiteModalListHtml(state.importSearch);
  } else if (event.target.id === 'mgr-bin-order-search' && state.binModal) {
    state.binModal.orderQuery = event.target.value;
    const list = $('mgr-bin-order-list');
    if (list) list.innerHTML = renderOrderPickerListHtml(state.binModal);
  } else if (event.target.id === 'mgr-recon-scan' && state.reconModal) {
    state.reconModal.scanQuery = event.target.value;
  } else if (event.target.dataset?.reconPrice && state.reconModal) {
    state.reconModal.priceOverrides[event.target.dataset.reconPrice] = Number(event.target.value) || 0;
  } else if (event.target.closest?.('[data-pilot-custom-form]')) {
    const form = event.target.closest('[data-pilot-custom-form]');
    if (event.target.name === 'from') state.trafficFromLocal = String(event.target.value || '');
    if (event.target.name === 'to') state.trafficToLocal = String(event.target.value || '');
    const prevEl = document.querySelector('[data-pilot-range-preview]');
    if (prevEl) prevEl.textContent = describeCustomRangePreview(form.elements.from?.value || state.trafficFromLocal, form.elements.to?.value || state.trafficToLocal);
    const msgEl = document.querySelector('[data-pilot-range-msg]');
    if (msgEl) { msgEl.textContent = ''; msgEl.hidden = true; }
  }
});

document.addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.target;
  if (form.matches?.('[data-pilot-custom-form]')) {
    const fromStr = String(form.elements.from?.value || '');
    const toStr = String(form.elements.to?.value || '');
    const fromMs = parseDatetimeLocalValue(fromStr);
    let toMs = parseDatetimeLocalValue(toStr);
    const setErr = msg => {
      const msgEl = document.querySelector('[data-pilot-range-msg]');
      if (msgEl) { msgEl.textContent = msg; msgEl.hidden = !msg; }
      if (msg) toast(msg, { isError: true });
    };
    if (!fromMs || !toMs) {
      setErr('Select both a valid From and To date/time first.');
      return;
    }
    if (toMs < fromMs) {
      setErr('End time (To) must be after Start time (From).');
      return;
    }
    if (toMs === fromMs) toMs = fromMs + 60000;
    setErr('');
    state.trafficPreset = 'custom';
    state.trafficFromMs = fromMs;
    state.trafficToMs = toMs;
    state.trafficFromLocal = fromStr;
    state.trafficToLocal = toStr;
    const ctrlHost = $('mgr-traffic-controls');
    if (ctrlHost) {
      ctrlHost.innerHTML = pilotControlsMarkup({
        preset: state.trafficPreset,
        device: state.trafficDevice,
        fromLocal: state.trafficFromLocal,
        toLocal: state.trafficToLocal,
        rangeText: 'Loading selected range…',
        loading: true,
        showHeatmapBtn: true,
        heatmapHref: 'https://hehe.cafe/#home?heatmap=1'
      });
    }
    await pollActiveTabLive({ manual: true });
    return;
  }
  const submitBtn = form.querySelector('button[type="submit"]');
  const origLabel = submitBtn ? submitBtn.textContent : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';
  }
  showModalError('');
  setBusy(true);
  try {
    const fd = new FormData(form);
    if (form.id === 'mgr-request-access-form') {
      await callManager('managerRequestAccess', { artistName: fd.get('artistName'), note: fd.get('note') });
      toast('Access request submitted for one-time Admin approval.');
      await refreshAccess();
    } else if (form.id === 'mgr-upload-form') {
      if (!state.selectedUploadImages.length) throw new Error('Select 1 to 4 photos first.');
      const up = await callManager('managerUploadArtwork', {
        title: fd.get('title'),
        genre: fd.get('genre'),
        artistName: fd.get('artistName'),
        material: fd.get('material'),
        dimensions: fd.get('dimensions'),
        notes: fd.get('notes'),
        images: state.selectedUploadImages,
        backupImages: state.selectedUploadBackups
      });
      state.selectedUploadImages = [];
      state.selectedUploadBackups = [];
      state.uploadPanelOpen = false;
      toast(`Uploaded to intake · Ref #${up.refNumber || up.artwork?.refNumber || ''}`);
      await loadWorkspaceData();
    } else if (form.id === 'mgr-curate-form') {
      await callManager('managerUpdateArtwork', {
        artworkId: form.dataset.id,
        patch: {
          title: fd.get('title'),
          artistName: fd.get('artistName'),
          genre: fd.get('genre'),
          price: Number(fd.get('price') || 0),
          stage: fd.get('stage'),
          stock: Number(fd.get('stock') ?? 1),
          assignedBinArtist: fd.get('assignedBinArtist'),
          binBatch: fd.get('binBatch'),
          binNote: fd.get('binNote'),
          material: fd.get('material'),
          dimensions: fd.get('dimensions'),
          tag: fd.get('tag'),
          description: fd.get('description'),
          images: state.curateImages,
          backupImages: state.curateBackups
        }
      });
      $('mgr-dialog')?.close();
      toast('Curation saved.');
      await loadWorkspaceData();
    } else if (form.id === 'mgr-bin-dest-form' && state.binModal) {
      const bm = state.binModal;
      const targetType = bm.binTargetType;
      const orderId = targetType === 'customer' ? (fd.get('binTargetOrderId') || bm.binTargetOrderId) : '';
      const cafeId = targetType === 'cafe' ? fd.get('binTargetCafeId') : '';
      const res = await callManager('managerBulkUpdateArtworks', {
        artworkIds: bm.artworkIds,
        action: 'assign_bin',
        assignedBinArtist: bm.artworkIds.length === 1 ? fd.get('assignedBinArtist') : undefined,
        binBatch: fd.get('binBatch'),
        binNote: fd.get('binNote'),
        binTargetType: targetType,
        binTargetCafeId: cafeId,
        binTargetOrderId: orderId
      });
      state.selectedArtIds.clear();
      state.binModal = null;
      $('mgr-dialog')?.close();
      toast(`Moved ${res.updatedCount} piece(s) to Pickup Bin!`);
      await loadWorkspaceData();
    } else if (form.id === 'mgr-cafe-form') {
      await callManager('managerSaveCafe', {
        cafeId: form.dataset.id || undefined,
        name: fd.get('name'),
        city: fd.get('city'),
        area: fd.get('area'),
        commissionPct: Number(fd.get('commissionPct') || 0),
        contactName: fd.get('contactName'),
        phone: fd.get('phone'),
        notes: fd.get('notes'),
        active: form.elements.active?.checked !== false
      });
      $('mgr-dialog')?.close();
      toast('Partner café saved.');
      await loadWorkspaceData();
    } else if (form.id === 'mgr-assign-cafe-form') {
      const artworkIds = fd.getAll('artworkIds');
      if (!artworkIds.length) throw new Error('Select at least one artwork.');
      const res = await callManager('managerAssignCafeStock', {
        cafeId: fd.get('cafeId'),
        batchLabel: fd.get('batchLabel'),
        artworkIds,
        notes: fd.get('notes')
      });
      state.selectedArtIds.clear();
      $('mgr-dialog')?.close();
      toast(`Dispatched ${res.batchCode || 'batch'} (${artworkIds.length} pieces) to café.`);
      await loadWorkspaceData();
    } else if (form.id === 'mgr-req-return-form') {
      await callManager('managerRequestBatchReturn', {
        cafeId: form.dataset.cafe,
        batchId: form.dataset.batch,
        note: fd.get('note')
      });
      $('mgr-dialog')?.close();
      toast('Batch marked Return Requested.');
      await loadWorkspaceData();
    } else if (form.id === 'mgr-reconcile-form' && state.reconModal) {
      const rm = state.reconModal;
      const res = await callManager('managerReconcileCafeBatch', {
        cafeId: rm.cafeId,
        batchId: rm.batchId,
        returnedStockIds: [...rm.returnedIds],
        priceOverrides: rm.priceOverrides,
        returnReason: fd.get('returnReason')
      });
      state.reconModal = null;
      $('mgr-dialog')?.close();
      toast(`Reconciled: ${res.returnedCount} returned unsold · ${res.soldCount} marked sold (${money(res.soldRevenue)})`);
      await loadWorkspaceData();
    } else if (form.id === 'mgr-cafe-sale-form') {
      await callManager('managerUpdateCafeStock', {
        stockId: form.dataset.id,
        action: 'mark_sold',
        salePrice: Number(fd.get('salePrice')),
        commissionPct: Number(fd.get('commissionPct') || 0)
      });
      $('mgr-dialog')?.close();
      toast('Café sale logged & split ledger updated.');
      await loadWorkspaceData();
    } else if (form.id === 'mgr-payout-form') {
      await callManager('managerRecordPayout', {
        artistName: fd.get('artistName'),
        amount: Number(fd.get('amount')),
        method: fd.get('method'),
        reference: fd.get('reference'),
        periodLabel: fd.get('periodLabel'),
        note: fd.get('note')
      });
      $('mgr-dialog')?.close();
      toast('Payout recorded!');
      await loadWorkspaceData();
    } else if (form.id === 'mgr-preapprove-form') {
      await callManager('managerApproveUser', {
        email: fd.get('email'),
        artistName: fd.get('artistName'),
        role: fd.get('role'),
        commissionPct: Number(fd.get('commissionPct') ?? 60),
        status: 'approved'
      });
      toast(`Approved ${fd.get('email')}.`);
      await loadWorkspaceData();
    } else if (form.id === 'mgr-import-site-form') {
      const artworkIds = fd.getAll('importArtworkIds');
      if (!artworkIds.length) throw new Error('Select at least one artwork to import to Site Stock.');
      const res = await callManager('managerImportToSiteStock', {
        artworkIds,
        visible: true,
        defaultPrice: Number(fd.get('defaultPrice') || 250)
      });
      $('mgr-dialog')?.close();
      toast(`Imported ${res.importedCount} artwork(s) into live Site Stock${res.skippedCount ? ` (${res.skippedCount} skipped)` : ''}.`);
      await loadWorkspaceData();
    } else if (form.id === 'mgr-refresh-site-form') {
      const res = await callManager('managerRefreshSiteStock', {
        pickCount: Number(fd.get('pickCount') || 20),
        fakeSoldCount: Number(fd.get('fakeSoldCount') ?? 3),
        defaultPrice: Number(fd.get('defaultPrice') || 250)
      });
      $('mgr-dialog')?.close();
      toast(`Site refreshed: ${res.movedToWarehouse} returned to warehouse · ${res.selectedForSite} live (${res.fakeSoldCount} fake-sold).`);
      await loadWorkspaceData();
    } else if (form.id === 'mgr-schedule-form') {
      const resetTimer = event.submitter?.dataset?.resetTimer === '1';
      const nextSched = await callManager('managerUpdateStockSchedule', {
        action: 'save',
        autoRefreshEnabled: form.elements.autoRefreshEnabled?.checked === true,
        showTimerOnSite: form.elements.showTimerOnSite?.checked === true,
        intervalHours: Number(fd.get('intervalHours') || 18),
        pickCount: Number(fd.get('pickCount') || 20),
        fakeSoldCount: Number(fd.get('fakeSoldCount') ?? 3),
        defaultPrice: Number(fd.get('defaultPrice') || 250),
        resetTimer
      });
      if (state.siteStockData) state.siteStockData.stockSchedule = nextSched;
      toast(resetTimer ? 'Schedule saved and countdown reset!' : 'Auto-refresh schedule saved.');
      render();
    } else if (form.id === 'mgr-edit-user-form') {
      await callManager('managerApproveUser', {
        email: form.dataset.email,
        status: fd.get('status'),
        role: fd.get('role'),
        artistName: fd.get('artistName'),
        commissionPct: Number(fd.get('commissionPct') ?? 60)
      });
      $('mgr-dialog')?.close();
      toast('Team member updated.');
      await loadWorkspaceData();
    }
  } catch (error) {
    toast(error?.message || 'Could not save changes.', { isError: true });
  } finally {
    setBusy(false);
    if (submitBtn?.isConnected) {
      submitBtn.disabled = false;
      submitBtn.textContent = origLabel;
    }
  }
});

observeGoogleAuth((googleUser, rawUser) => {
  state.authReady = true;
  state.googleUser = googleUser;
  state.rawNonGoogleUser = rawUser;
  void refreshAccess();
}).catch(err => {
  state.authReady = true;
  state.meError = err?.message || 'Could not initialize Google sign-in.';
  render();
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !state.trafficLivePaused) {
    void pollActiveTabLive();
  }
});

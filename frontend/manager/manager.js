import {
  observeGoogleAuth,
  signInWithGoogle,
  signOutManager,
  callManager,
  compressArtworkFiles
} from './manager-store.js';
import {
  revenueTrendChartMarkup,
  genreVelocityMatrixMarkup,
  cafeComparisonChartMarkup,
  openPrintableChallan,
  openPrintableSettlement
} from './manager-charts.js';

const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => '₹' + (Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const fmtDate = ts => ts ? new Date(Number(ts)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const normKey = v => String(v || '').trim().replace(/\s+/g, ' ').toLowerCase();

const googleSvg = `<svg viewBox="0 0 256 262" aria-hidden="true"><path fill="#4285F4" d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622 38.755 30.023 2.685.268c24.659-22.774 38.875-56.282 38.875-96.027"/><path fill="#34A853" d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055-34.523 0-63.824-22.773-74.269-54.25l-1.531.13-40.298 31.187-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1"/><path fill="#FBBC05" d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82 0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602l42.356-32.782"/><path fill="#EB4335" d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0 79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251"/></svg>`;

const STAGES = [
  ['all', 'All'],
  ['intake', 'Intake'],
  ['curated', 'Curated'],
  ['delivery_bin', 'Pickup bin'],
  ['at_cafe', 'At café'],
  ['live_online', 'Live on site'],
  ['sold', 'Sold'],
  ['returned', 'Returned']
];
const STAGE_LABEL = Object.fromEntries(STAGES.filter(([k]) => k !== 'all'));

const KANBAN_COLUMNS = [
  ['intake', 'Intake'],
  ['curated', 'Curated'],
  ['delivery_bin', 'Pickup Bin'],
  ['at_cafe', 'At Café'],
  ['live_online', 'On Site'],
  ['returned', 'Returned'],
  ['sold', 'Sold']
];

const BIN_STEP_LABELS = [
  ['selected', 'Selected'],
  ['packed', 'Packed'],
  ['handed_over', 'Handed over'],
  ['received_at_studio', 'Received']
];

const GENRE_PRESETS = ['Fridge Magnet', 'Clay Frame', 'Original Painting', 'Coaster', 'Keychain', 'Ceramic Study'];

const NAV_ICONS = {
  analytics: '<path d="M3 3v18h18"/><path d="M7 15v-4"/><path d="M12 15V8"/><path d="M17 15v-6"/>',
  artworks: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
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
  dataError: '',
  analytics: null,
  payoutData: null,
  artworks: [],
  cafes: [],
  cafeStock: [],
  users: [],
  stageFilter: 'all',
  artSearch: '',
  artView: typeof window !== 'undefined' && window.innerWidth >= 900 ? 'kanban' : 'grid',
  selectedArtIds: new Set(),
  selectedUploadImages: [],
  uploadPanelOpen: false,
  uploadGenreDraft: 'Fridge Magnet'
};

let toastTimer = null;
function toast(msg) {
  const el = $('mgr-toast');
  if (!el) return;
  clearTimeout(toastTimer);
  el.textContent = msg;
  el.hidden = false;
  toastTimer = setTimeout(() => { el.hidden = true; }, 4500);
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

async function loadWorkspaceData() {
  if (state.me?.status !== 'approved') return;
  state.loadingData = true;
  state.dataError = '';
  render();
  try {
    const isAdmin = state.me.role === 'admin';
    const [analytics, artworks, cafeData, payoutData, users] = await Promise.all([
      callManager('managerAnalytics', { range: state.range }),
      callManager('managerListArtworks'),
      callManager('managerListCafes'),
      callManager('managerListPayouts'),
      isAdmin ? callManager('managerListUsers') : Promise.resolve([])
    ]);
    state.analytics = analytics || null;
    state.artworks = Array.isArray(artworks) ? artworks : [];
    state.cafes = Array.isArray(cafeData?.cafes) ? cafeData.cafes : [];
    state.cafeStock = Array.isArray(cafeData?.stock) ? cafeData.stock : [];
    state.payoutData = payoutData || null;
    state.users = Array.isArray(users) ? users : [];
    // Keep only still-existing IDs selected
    const valid = new Set(state.artworks.map(a => a.id));
    for (const sid of [...state.selectedArtIds]) {
      if (!valid.has(sid)) state.selectedArtIds.delete(sid);
    }
  } catch (error) {
    state.dataError = error?.message || 'Failed to load workspace data.';
  } finally {
    state.loadingData = false;
    render();
  }
}

function renderSignInGate() {
  const wrongProvider = state.rawNonGoogleUser && !state.googleUser;
  return `<div class="mgr-gate-wrap"><section class="mgr-gate-card">
    <p class="mgr-eyebrow">Private Studio Operations</p>
    <h1>Chain Manager</h1>
    <p class="mgr-muted">Invite-only workspace for 1-of-1 artwork curation, artist pickup bins, partner café stock tracking, commission settlements, and sales velocity analytics.</p>
    ${wrongProvider ? `<p class="mgr-pill is-pending">Signed in as ${esc(state.rawNonGoogleUser.email || 'non-Google user')} — Google Sign-In is required here.</p>` : ''}
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
            <p class="mgr-muted" style="margin-top:8px">Requested artist profile: <strong>${esc(m.requestedArtistName || 'Artist')}</strong>. Once an administrator approves this Google account, you will enter your private workspace directly.</p>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button type="button" class="mgr-btn" data-action="recheck-access">Check approval status</button>
            <button type="button" class="mgr-btn outline" data-action="mgr-signout">Sign out</button>
          </div>`
        : `<form id="mgr-request-access-form" style="display:grid;gap:12px">
            <p class="mgr-muted">New artists require a one-time approval from the studio admin before viewing or uploading anything.</p>
            <label class="mgr-field">Your artist / studio name (shown on your works)<input name="artistName" required minlength="2" maxlength="120" value="${esc(m.name || '')}" placeholder="e.g. Suprita Chatterjee"></label>
            <label class="mgr-field">Optional note for Admin<textarea name="note" maxlength="500" placeholder="Artworks you create or studio notes…"></textarea></label>
            <button type="submit" class="mgr-btn">Request one-time approval →</button>
          </form>
          <button type="button" class="mgr-link" data-action="mgr-signout">Switch Google account</button>`}
    ${isRevoked ? `<button type="button" class="mgr-btn outline" data-action="mgr-signout">Sign out</button>` : ''}
  </section></div>`;
}

function renderAnalyticsTab(isAdmin) {
  const a = state.analytics;
  if (!a) return `<div class="mgr-panel"><p class="mgr-muted">${state.loadingData ? 'Loading analytics…' : 'No analytics available yet.'}</p></div>`;
  const s = a.summary || {};
  const myPay = a.myPayout || {};
  const genres = a.genreBreakdown || [];
  const ranges = [['all', 'All time'], ['month', 'This month'], ['30d', 'Last 30 days'], ['90d', 'Last 90 days']];

  const kpisHtml = isAdmin
    ? `<div class="mgr-kpi-grid">
        <div class="mgr-kpi"><span>Combined gross sales</span><strong>${money(s.totalRevenue)}</strong><small>Online ${money(s.siteRevenue)} + Café ${money(s.cafeRevenue)}</small></div>
        <div class="mgr-kpi"><span>Studio net margin</span><strong>${money(s.studioNetRevenue)}</strong><small>After artist split &amp; café fee (${money(s.totalCafeCommission)})</small></div>
        <div class="mgr-kpi"><span>Artist payouts due</span><strong style="color:${(s.totalPayoutDue || 0) > 0 ? 'var(--terracotta)' : 'var(--accent)'}">${money(s.totalPayoutDue)}</strong><small>Earned ${money(s.totalArtistEarned)} · Paid ${money(s.totalArtistPaid)}</small></div>
        <div class="mgr-kpi"><span>Units sold (1-of-1)</span><strong>${s.totalUnitsSold || 0}</strong><small>${s.siteUnitsSold || 0} online · ${s.cafeUnitsSold || 0} at cafés</small></div>
        <div class="mgr-kpi"><span>At partner cafés</span><strong>${s.activeCafeStockCount || 0}</strong><small>${s.returnedUnsoldCount || 0} returned unsold</small></div>
        <div class="mgr-kpi"><span>Pickup bin queue</span><strong>${s.deliveryBinCount || 0}</strong><small>${s.binPackedCount || 0} packed · ${s.binHandedOverCount || 0} handed over</small></div>
      </div>`
    : `<div class="mgr-kpi-grid">
        <div class="mgr-kpi"><span>Your balance due</span><strong style="color:${(myPay.balanceDue || 0) > 0 ? 'var(--terracotta)' : 'var(--accent)'}">${money(myPay.balanceDue)}</strong><small>Rate ${myPay.commissionPct ?? 60}% · Paid ${money(myPay.totalPaid)}</small></div>
        <div class="mgr-kpi"><span>Your total earned</span><strong>${money(myPay.totalEarned)}</strong><small>Online ${money(myPay.earnedOnline)} + Café ${money(myPay.earnedCafe)}</small></div>
        <div class="mgr-kpi"><span>Your pieces sold</span><strong>${s.totalUnitsSold || 0}</strong><small>${s.siteUnitsSold || 0} online · ${s.cafeUnitsSold || 0} at cafés</small></div>
        <div class="mgr-kpi"><span>Your active café stock</span><strong>${s.activeCafeStockCount || 0}</strong><small>${s.returnedUnsoldCount || 0} returned unsold</small></div>
        <div class="mgr-kpi"><span>In your pickup bin</span><strong>${s.deliveryBinCount || 0}</strong><small>${s.binSelectedCount || 0} waiting pack · ${s.intakeCount || 0} in intake</small></div>
      </div>`;

  return `<div class="mgr-head">
      <div>
        <p class="mgr-eyebrow">${isAdmin ? 'Full Chain Performance' : `Artist Studio · ${esc(state.me.artistName)}`}</p>
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
        ${genreVelocityMatrixMarkup(genres)}
      </section>
    </div>

    ${isAdmin ? `<div class="mgr-split">
      <section class="mgr-panel">
        <h2>Partner café sell-through vs return rate</h2>
        ${cafeComparisonChartMarkup(a.cafeBreakdown)}
      </section>
      <section class="mgr-panel">
        <h2>Artist earnings &amp; payout status</h2>
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
          <thead><tr><th>Date</th><th>Artwork</th><th>Genre</th><th>Location</th><th>Sale</th></tr></thead>
          <tbody>${a.recentSales.slice(0, 15).map(r => `<tr>
            <td>${fmtDate(r.at)}</td>
            <td><strong>${esc(r.title)}</strong>${isAdmin ? `<br><small class="mgr-muted">${esc(r.artistName)}</small>` : ''}</td>
            <td>${esc(r.genre)}</td>
            <td><span class="mgr-pill ${r.channel === 'cafe' ? 'is-at_cafe' : 'is-live_online'}">${esc(r.location || r.channel)}</span></td>
            <td><strong>${money(r.revenue)}</strong></td>
          </tr>`).join('')}</tbody>
        </table></div>` : '<p class="mgr-muted">No completed sales recorded in this range.</p>'}
      </section>
      <section class="mgr-panel">
        <h2>Unsold returns insight</h2>
        ${(a.returnedStock || []).length ? `<div class="mgr-table-wrap"><table class="mgr-table">
          <thead><tr><th>Artwork</th><th>Genre</th><th>Café</th><th>Days</th><th>Reason</th></tr></thead>
          <tbody>${a.returnedStock.slice(0, 15).map(r => `<tr>
            <td><strong>${esc(r.title)}</strong></td>
            <td>${esc(r.genre)}</td>
            <td>${esc(r.cafeName)}</td>
            <td>${r.daysAtCafe}d</td>
            <td>${esc(r.returnReason || 'Unsold')}</td>
          </tr>`).join('')}</tbody>
        </table></div>` : '<p class="mgr-muted">No unsold café returns in this range.</p>'}
      </section>
    </div>`;
}

function filterArtworks() {
  const q = state.artSearch.trim().toLowerCase();
  return state.artworks.filter(a => {
    if (state.artView !== 'kanban' && state.stageFilter !== 'all' && a.stage !== state.stageFilter) return false;
    if (!q) return true;
    return `${a.title} ${a.artistName} ${a.genre} ${a.storeRefNumber || ''}`.toLowerCase().includes(q);
  });
}

function renderArtworksTab(isAdmin) {
  const filtered = filterArtworks();
  const isKanban = isAdmin && state.artView === 'kanban';
  const selCount = state.selectedArtIds.size;

  const uploaderHtml = state.uploadPanelOpen ? `<section class="mgr-panel">
      <h2>Upload 1-of-1 artwork to studio intake</h2>
      <p class="mgr-muted" style="margin-bottom:14px">${isAdmin ? 'Add raw pieces for curation, pickup bin selection, or publishing to hehe.cafe.' : `Uploading 1-of-1 piece under your profile: <strong>${esc(state.me.artistName)}</strong>.`}</p>
      <form id="mgr-upload-form" class="mgr-form-grid">
        <label class="mgr-field wide">1–4 photos (tap to open camera or gallery · photo #1 becomes Cover)
          <label class="mgr-dropzone">
            <strong>Tap to choose or capture artwork photos</strong>
            <span class="mgr-muted">JPG, PNG, or WebP · automatically resized</span>
            <input id="mgr-upload-files" type="file" accept="image/jpeg,image/png,image/webp" multiple>
          </label>
        </label>
        ${state.selectedUploadImages.length ? `<div class="mgr-preview-imgs mgr-field wide" id="mgr-upload-preview">${state.selectedUploadImages.map((src, i) => `<div class="mgr-preview-thumb"><img src="${esc(src)}" alt="Preview ${i + 1}">${i === 0 ? '<span class="mgr-cover-tag">COVER</span>' : ''}<button type="button" class="mgr-thumb-del" data-action="remove-upload-thumb" data-idx="${i}" aria-label="Remove photo ${i + 1}">×</button></div>`).join('')}</div>` : '<div id="mgr-upload-preview"></div>'}
        <label class="mgr-field">Artwork title<input name="title" required minlength="2" maxlength="120" placeholder="e.g. Rainy Chai Magnet"></label>
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
          <button type="submit" class="mgr-btn">Upload 1-of-1 piece →</button>
        </div>
      </form>
    </section>` : '';

  const boardHtml = isKanban
    ? `<div class="mgr-kanban">${KANBAN_COLUMNS.map(([stage, label]) => {
        const colItems = filtered.filter(a => a.stage === stage);
        return `<section class="mgr-kanban-col">
          <div class="mgr-kanban-col-head"><span>${esc(label)}</span><span>${colItems.length}</span></div>
          ${colItems.map(a => {
            const checked = state.selectedArtIds.has(a.id);
            return `<article class="mgr-kcard ${checked ? 'is-selected' : ''}">
              <div class="mgr-kcard-top">
                ${a.images?.[0] ? `<img src="${esc(a.images[0])}" alt="" loading="lazy">` : ''}
                <div style="min-width:0;flex:1">
                  <div class="mgr-kcard-title">${esc(a.title)}</div>
                  <div class="mgr-art-meta">${esc(a.artistName)} · ${esc(a.genre)}</div>
                  <div class="mgr-art-meta">${a.price > 0 ? `<strong>${money(a.price)}</strong>` : 'Price TBD'}${a.binStatus && stage === 'delivery_bin' ? ` · ${esc(a.binStatus.replace('_', ' '))}` : ''}${a.assignedCafeName ? ` · ${esc(a.assignedCafeName)}` : ''}</div>
                </div>
              </div>
              <div class="mgr-kcard-foot">
                <label class="mgr-select-box"><input type="checkbox" data-select-art="${esc(a.id)}" ${checked ? 'checked' : ''}><span>Select</span></label>
                <div style="display:flex;gap:6px">
                  <button type="button" class="mgr-btn outline small" data-action="edit-mgr-art" data-id="${esc(a.id)}">Curate</button>
                  ${a.price > 0 && stage !== 'sold' ? `<button type="button" class="mgr-btn accent small" data-action="publish-mgr-art" data-id="${esc(a.id)}">${a.storeProductId ? 'Sync' : 'Publish'}</button>` : ''}
                </div>
              </div>
            </article>`;
          }).join('') || '<p class="mgr-muted" style="font-size:12px;margin:4px 0">Empty</p>'}
        </section>`;
      }).join('')}</div>`
    : (filtered.length
      ? `<div class="mgr-art-grid">${filtered.map(a => {
          const checked = state.selectedArtIds.has(a.id);
          return `<article class="mgr-art-card ${checked ? 'is-selected' : ''}">
            <div class="mgr-art-thumb">
              ${a.images?.[0] ? `<img src="${esc(a.images[0])}" alt="${esc(a.title)}" loading="lazy">` : ''}
              ${isAdmin ? `<label class="mgr-card-check"><input type="checkbox" data-select-art="${esc(a.id)}" ${checked ? 'checked' : ''}><span>Select</span></label>` : ''}
            </div>
            <div class="mgr-art-body">
              <div class="mgr-art-top">
                <span class="mgr-pill is-${esc(a.stage || 'intake')}">${esc(STAGE_LABEL[a.stage] || a.stage)}</span>
                ${a.price > 0 ? `<strong>${money(a.price)}</strong>` : '<small class="mgr-muted">Price TBD</small>'}
              </div>
              <h3>${esc(a.title)}</h3>
              <div class="mgr-art-meta">${esc(a.genre)} · ${esc(a.artistName)}${a.assignedBinArtist ? `<br>Pickup bin: <strong>${esc(a.assignedBinArtist)}</strong> (${esc((a.binStatus || 'selected').replace(/_/g, ' '))})` : ''}${a.assignedCafeName ? `<br>At café: <strong>${esc(a.assignedCafeName)}</strong>` : ''}${a.storeRefNumber ? `<br><span class="mono">Ref ${esc(a.storeRefNumber)} (on hehe.cafe)</span>` : ''}</div>
              ${isAdmin ? `<div class="mgr-art-actions">
                <button type="button" class="mgr-btn outline small" data-action="edit-mgr-art" data-id="${esc(a.id)}">Curate / bin</button>
                ${a.price > 0 && a.stage !== 'sold' ? `<button type="button" class="mgr-btn accent small" data-action="publish-mgr-art" data-id="${esc(a.id)}">${a.storeProductId ? 'Sync hehe.cafe ↻' : 'Send to hehe.cafe →'}</button>` : ''}
              </div>` : ''}
            </div>
          </article>`;
        }).join('')}</div>`
      : '<div class="mgr-panel"><p class="mgr-muted">No artworks match this filter yet.</p></div>');

  const bulkBarHtml = isAdmin && selCount > 0
    ? `<div class="mgr-bulk-bar" role="region" aria-label="Bulk artwork actions">
        <div><strong>${selCount} selected</strong> <button type="button" class="mgr-link" style="color:#f8e57e;margin-left:8px" data-action="clear-art-selection">Clear</button></div>
        <div class="mgr-bulk-actions">
          <button type="button" class="mgr-btn small" style="background:#f8e57e;color:#181715;border-color:#f8e57e" data-action="bulk-assign-bin">Put in Pickup Bin</button>
          ${state.cafes.length ? `<button type="button" class="mgr-btn accent small" data-action="bulk-assign-cafe">Send to Café →</button>` : ''}
          <button type="button" class="mgr-btn outline small" data-action="bulk-publish-store">Publish to hehe.cafe ↗</button>
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
    ${!isKanban ? `<div class="mgr-chips">
      ${STAGES.map(([k, label]) => {
        const count = k === 'all' ? state.artworks.length : state.artworks.filter(a => a.stage === k).length;
        return `<button type="button" class="mgr-chip ${state.stageFilter === k ? 'is-active' : ''}" data-action="set-stage-filter" data-stage="${k}">${esc(label)} (${count})</button>`;
      }).join('')}
    </div>` : ''}
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:14px">
      <input id="mgr-art-search" type="search" value="${esc(state.artSearch)}" placeholder="Search title, genre, artist, or Ref…" style="width:100%;max-width:380px;padding:9px 14px;border-radius:999px;border:1.5px solid #d8d0c1;background:#fff">
      ${isAdmin && filtered.length ? `<div style="display:flex;gap:12px"><button type="button" class="mgr-link" data-action="select-all-shown">Select all shown (${filtered.length})</button>${selCount ? `<button type="button" class="mgr-link" data-action="clear-art-selection">Clear selection</button>` : ''}</div>` : ''}
    </div>
    ${boardHtml}
    ${bulkBarHtml}`;
}

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
        <p class="mgr-eyebrow">Studio Pickup Workflow · Selected → Packed → Handed Over → Received</p>
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
        return `<div class="mgr-bin-item">
          <div class="mgr-bin-row">
            ${item.images?.[0] ? `<img src="${esc(item.images[0])}" alt="">` : ''}
            <div style="flex:1;min-width:0">
              <strong>${esc(item.title)}</strong>
              <div class="mgr-art-meta">${esc(item.genre)} · ${item.price > 0 ? money(item.price) : 'Price TBD'}${item.binBatch ? ` · Batch: ${esc(item.binBatch)}` : ''}${item.binNote ? `<br>${esc(item.binNote)}` : ''}</div>
            </div>
          </div>
          <div class="mgr-bin-steps" aria-label="Pickup bin progress">
            ${BIN_STEP_LABELS.map(([k, lbl], idx) => `<span class="mgr-bin-step ${idx < curIdx ? 'is-done' : idx === curIdx ? 'is-cur' : ''}">${esc(lbl)}</span>`).join('')}
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${curStep === 'selected' ? `<button type="button" class="mgr-btn outline small" data-action="bin-step" data-id="${esc(item.id)}" data-status="packed">Mark packed ✓</button>` : ''}
            ${['selected', 'packed'].includes(curStep) ? `<button type="button" class="mgr-btn small" data-action="bin-step" data-id="${esc(item.id)}" data-status="handed_over">Mark handed over →</button>` : ''}
            ${isAdmin && curStep !== 'received_at_studio' ? `<button type="button" class="mgr-btn accent small" data-action="bin-receive" data-id="${esc(item.id)}">Confirm received at studio →</button>` : ''}
            ${isAdmin ? `<button type="button" class="mgr-btn outline small" data-action="edit-mgr-art" data-id="${esc(item.id)}">Curate</button>` : ''}
          </div>
        </div>`;
      }).join('')}
    </section>`).join('')}</div>` : '<div class="mgr-panel"><p class="mgr-muted">No artworks queued in pickup bins yet. Admins can select uploaded pieces in Artworks Pipeline and put them into an artist’s Pickup Bin.</p></div>'}`;
}

function renderCafesTab(isAdmin) {
  const activeStock = state.cafeStock.filter(s => ['at_cafe', 'return_requested'].includes(s.status));
  const pastStock = state.cafeStock.filter(s => ['sold_at_cafe', 'returned_to_studio'].includes(s.status));
  const assignableArts = state.artworks.filter(a => !['at_cafe', 'sold'].includes(a.stage));
  const daysSince = s => {
    const ms = Number(s.assignedAt || s.assignedAtMs);
    return Number.isFinite(ms) && ms > 0 ? Math.max(0, Math.round((Date.now() - ms) / 86400000)) : 0;
  };

  return `<div class="mgr-head">
      <div>
        <p class="mgr-eyebrow">Admin Consignment &amp; Unsold Return Tracking</p>
        <h1>Partner cafés &amp; returns</h1>
      </div>
      <div class="mgr-head-actions">
        ${isAdmin ? `<button type="button" class="mgr-btn" data-action="open-cafe-modal">+ Add partner café</button>` : ''}
        ${isAdmin && state.cafes.length && assignableArts.length ? `<button type="button" class="mgr-btn accent" data-action="open-assign-cafe-modal">Send stock to café →</button>` : ''}
        <button type="button" class="mgr-btn outline small" data-action="refresh-all">Refresh ↻</button>
      </div>
    </div>

    <section class="mgr-panel">
      <h2>Live café inventory (${activeStock.length})</h2>
      <p class="mgr-muted" style="margin-bottom:12px">Track 1-of-1 pieces placed at partner cafés, log café sales with split breakdown, and record unsold returns.</p>
      ${activeStock.length ? `<div class="mgr-table-wrap"><table class="mgr-table">
        <thead><tr><th>Café</th><th>Artwork</th><th>Genre</th><th>Price</th><th>Days held</th><th>Status</th>${isAdmin ? '<th>Actions</th>' : ''}</tr></thead>
        <tbody>${activeStock.map(s => `<tr>
          <td><strong>${esc(s.cafeName)}</strong><br><small class="mgr-muted">${esc(s.city || '')}</small></td>
          <td><strong>${esc(s.title)}</strong>${isAdmin ? `<br><small class="mgr-muted">${esc(s.artistName)}</small>` : ''}</td>
          <td>${esc(s.genre)}</td>
          <td>${s.price > 0 ? money(s.price) : 'TBD'}</td>
          <td>${daysSince(s)}d</td>
          <td><span class="mgr-pill is-${esc(s.status)}">${s.status === 'return_requested' ? 'Return requested' : 'At café'}</span></td>
          ${isAdmin ? `<td style="display:flex;gap:6px;flex-wrap:wrap">
            <button type="button" class="mgr-btn accent small" data-action="cafe-mark-sold" data-id="${esc(s.id)}">Mark sold</button>
            ${s.status === 'at_cafe' ? `<button type="button" class="mgr-btn outline small" data-action="cafe-request-return" data-id="${esc(s.id)}">Ask return</button>` : ''}
            <button type="button" class="mgr-btn danger small" data-action="cafe-mark-returned" data-id="${esc(s.id)}">Returned unsold</button>
          </td>` : ''}
        </tr>`).join('')}</tbody>
      </table></div>` : '<p class="mgr-muted">No stock currently placed at partner cafés.</p>'}
    </section>

    ${isAdmin ? `<section class="mgr-panel">
      <h2>Partner café directory &amp; printable challans (${state.cafes.length})</h2>
      ${state.cafes.length ? `<div class="mgr-table-wrap"><table class="mgr-table">
        <thead><tr><th>Café</th><th>City / Area</th><th>Contact</th><th>Café cut</th><th>Active</th><th>Challans</th><th></th></tr></thead>
        <tbody>${state.cafes.map(c => {
          const cActive = activeStock.filter(s => s.cafeId === c.id).length;
          const cReturned = pastStock.filter(s => s.cafeId === c.id && s.status === 'returned_to_studio').length;
          return `<tr>
            <td><strong>${esc(c.name)}</strong></td>
            <td>${esc(c.city || '—')}${c.area ? ` · ${esc(c.area)}` : ''}</td>
            <td>${esc(c.contactName || '—')} ${c.phone ? `· ${esc(c.phone)}` : ''}</td>
            <td>${Number(c.commissionPct) || 0}%</td>
            <td>${cActive} pcs</td>
            <td style="display:flex;gap:6px;flex-wrap:wrap">
              <button type="button" class="mgr-btn outline small" data-action="print-handover-challan" data-id="${esc(c.id)}" ${cActive ? '' : 'disabled'}>Handover PDF</button>
              <button type="button" class="mgr-btn outline small" data-action="print-return-challan" data-id="${esc(c.id)}" ${cReturned ? '' : 'disabled'}>Return PDF</button>
            </td>
            <td><button type="button" class="mgr-link" data-action="open-cafe-modal" data-id="${esc(c.id)}">Edit</button></td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>` : '<p class="mgr-muted">Add your first partner café above.</p>'}
    </section>` : ''}

    <section class="mgr-panel">
      <h2>Café sales &amp; returned stock log (${pastStock.length})</h2>
      ${pastStock.length ? `<div class="mgr-table-wrap"><table class="mgr-table">
        <thead><tr><th>Outcome</th><th>Artwork</th><th>Genre</th><th>Café</th><th>Days held</th><th>Details</th></tr></thead>
        <tbody>${pastStock.slice(0, 35).map(s => `<tr>
          <td><span class="mgr-pill is-${esc(s.status)}">${s.status === 'sold_at_cafe' ? 'Sold at café' : 'Returned unsold'}</span></td>
          <td><strong>${esc(s.title)}</strong></td>
          <td>${esc(s.genre)}</td>
          <td>${esc(s.cafeName)}</td>
          <td>${Number(s.daysAtCafe) || 0}d</td>
          <td>${s.status === 'sold_at_cafe' ? `${money(s.salePrice || s.price)} (Café fee ${money(s.commissionAmount || 0)})` : esc(s.returnReason || 'Unsold')}</td>
        </tr>`).join('')}</tbody>
      </table></div>` : '<p class="mgr-muted">No completed café sales or returns logged yet.</p>'}
    </section>`;
}

function renderPayoutsTab(isAdmin) {
  const data = state.payoutData;
  if (!data) return `<div class="mgr-panel"><p class="mgr-muted">${state.loadingData ? 'Loading payout ledger…' : 'No payout data available.'}</p></div>`;
  const summaries = data.summaries || [];
  const payouts = data.payouts || [];

  if (!isAdmin) {
    const mine = summaries[0] || { commissionPct: state.me.commissionPct ?? 60, earnedOnline: 0, earnedCafe: 0, totalEarned: 0, totalPaid: 0, balanceDue: 0 };
    return `<div class="mgr-head">
        <div>
          <p class="mgr-eyebrow">Artist Commission Ledger · ${esc(mine.commissionPct)}% Share</p>
          <h1>Your earnings &amp; payouts</h1>
        </div>
        <div class="mgr-head-actions">
          <button type="button" class="mgr-btn" data-action="print-artist-settlement" data-artist="${esc(mine.artist)}">Settlement statement PDF ↗</button>
          <button type="button" class="mgr-btn outline small" data-action="refresh-all">Refresh ↻</button>
        </div>
      </div>
      <div class="mgr-kpi-grid">
        <div class="mgr-kpi"><span>Your balance due</span><strong style="color:${mine.balanceDue > 0 ? 'var(--terracotta)' : 'var(--accent)'}">${money(mine.balanceDue)}</strong><small>Commission rate ${mine.commissionPct}%</small></div>
        <div class="mgr-kpi"><span>Total earned</span><strong>${money(mine.totalEarned)}</strong><small>Online ${money(mine.earnedOnline)} + Café ${money(mine.earnedCafe)}</small></div>
        <div class="mgr-kpi"><span>Paid to date</span><strong>${money(mine.totalPaid)}</strong><small>${payouts.length} recorded settlements</small></div>
      </div>
      <section class="mgr-panel">
        <h2>Payout receipts (${payouts.length})</h2>
        ${payouts.length ? `<div class="mgr-table-wrap"><table class="mgr-table">
          <thead><tr><th>Date</th><th>Method</th><th>Reference / UTR</th><th>Period</th><th>Note</th><th>Amount</th></tr></thead>
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
      <div>
        <p class="mgr-eyebrow">Commission Splits &amp; Settlement Ledger</p>
        <h1>Artist payouts</h1>
      </div>
      <div class="mgr-head-actions">
        <button type="button" class="mgr-btn" data-action="open-payout-modal">+ Record payout</button>
        <button type="button" class="mgr-btn outline small" data-action="refresh-all">Refresh ↻</button>
      </div>
    </div>
    <div class="mgr-kpi-grid">
      <div class="mgr-kpi"><span>Total payout balance due</span><strong style="color:${totalDue > 0 ? 'var(--terracotta)' : 'var(--accent)'}">${money(totalDue)}</strong><small>Across ${summaries.length} artists</small></div>
      <div class="mgr-kpi"><span>Studio net earnings</span><strong>${money(data.studioNetTotal)}</strong><small>After artist split &amp; café fees</small></div>
      <div class="mgr-kpi"><span>Total café commissions</span><strong>${money(data.totalCafeCommission)}</strong><small>Deducted before studio net</small></div>
    </div>

    <section class="mgr-panel">
      <h2>Artist settlement balances</h2>
      ${summaries.length ? `<div class="mgr-table-wrap"><table class="mgr-table">
        <thead><tr><th>Artist</th><th>Rate</th><th>Online share</th><th>Café share</th><th>Total earned</th><th>Paid</th><th>Balance due</th><th>Actions</th></tr></thead>
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
          <td><button type="button" class="mgr-link" style="color:var(--danger)" data-action="delete-payout" data-id="${esc(p.id)}">Remove</button></td>
        </tr>`).join('')}</tbody>
      </table></div>` : '<p class="mgr-muted">No payouts recorded yet.</p>'}
    </section>`;
}

function renderUsersTab() {
  return `<div class="mgr-head">
      <div>
        <p class="mgr-eyebrow">One-Time Approval &amp; Commission Rules</p>
        <h1>Team &amp; artist access</h1>
      </div>
      <div class="mgr-head-actions">
        <button type="button" class="mgr-btn outline small" data-action="refresh-all">Refresh ↻</button>
      </div>
    </div>
    <section class="mgr-panel">
      <h2>Pre-approve a Google account</h2>
      <p class="mgr-muted" style="margin-bottom:12px">Grant an artist one-time access by Google email and configure their custom commission percentage.</p>
      <form id="mgr-preapprove-form" class="mgr-form-grid">
        <label class="mgr-field">Google email address<input name="email" type="email" required placeholder="artist@gmail.com"></label>
        <label class="mgr-field">Artist display name (must match their artworks)<input name="artistName" required minlength="2" maxlength="120" placeholder="e.g. Suprita Chatterjee"></label>
        <label class="mgr-field">Role<select name="role"><option value="artist">Artist (own artworks, pickup bin &amp; payouts)</option><option value="admin">Admin (full studio &amp; café chain)</option></select></label>
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
            <button type="button" class="mgr-btn outline small" data-action="edit-user-modal" data-email="${esc(u.email)}">Edit</button>
            ${u.status !== 'approved' ? `<button type="button" class="mgr-btn accent small" data-action="approve-user" data-email="${esc(u.email)}" data-artist="${esc(u.artistName || u.requestedArtistName || '')}" data-role="${esc(u.role || 'artist')}" data-comm="${u.commissionPct ?? 60}">Approve</button>` : ''}
            ${u.status !== 'revoked' ? `<button type="button" class="mgr-btn danger small" data-action="revoke-user" data-email="${esc(u.email)}">Revoke</button>` : ''}
          </td>
        </tr>`).join('')}</tbody>
      </table></div>` : '<p class="mgr-muted">No pending or approved artists yet.</p>'}
    </section>`;
}

function render() {
  const root = $('manager-app');
  if (!root) return;
  if (!state.authReady || state.loadingMe) {
    root.innerHTML = '<div class="mgr-boot">Checking authorization…</div>';
    return;
  }
  if (!state.googleUser) {
    root.innerHTML = renderSignInGate();
    return;
  }
  if (state.me?.status !== 'approved') {
    root.innerHTML = renderApprovalGate();
    return;
  }
  const isAdmin = state.me.role === 'admin';
  const pendingUsersCount = isAdmin ? state.users.filter(u => u.status === 'pending').length : 0;
  const dueCount = (state.payoutData?.summaries || []).filter(r => r.balanceDue > 0).length;
  const navItems = [
    ['analytics', 'Analytics', null],
    ['artworks', 'Artworks', state.artworks.length],
    ['bins', 'Pickup bin', state.artworks.filter(a => a.stage === 'delivery_bin').length],
    ['cafes', 'Cafés', state.cafeStock.filter(s => ['at_cafe', 'return_requested'].includes(s.status)).length],
    ['payouts', 'Payouts', dueCount || null]
  ];
  if (isAdmin) navItems.push(['users', 'Team access', pendingUsersCount || null]);

  let bodyHtml = '';
  if (state.dataError) {
    bodyHtml = `<div class="mgr-panel"><p style="color:var(--danger)">${esc(state.dataError)}</p><button type="button" class="mgr-btn outline small" data-action="refresh-all">Try again</button></div>`;
  } else if (state.tab === 'artworks') {
    bodyHtml = renderArtworksTab(isAdmin);
  } else if (state.tab === 'bins') {
    bodyHtml = renderBinsTab(isAdmin);
  } else if (state.tab === 'cafes') {
    bodyHtml = renderCafesTab(isAdmin);
  } else if (state.tab === 'payouts') {
    bodyHtml = renderPayoutsTab(isAdmin);
  } else if (state.tab === 'users' && isAdmin) {
    bodyHtml = renderUsersTab();
  } else {
    bodyHtml = renderAnalyticsTab(isAdmin);
  }

  root.innerHTML = `<div class="mgr-workspace">
    <aside class="mgr-sidebar">
      <div class="mgr-brand">
        <p class="mgr-eyebrow">Private Chain Workspace</p>
        <strong>hehe.cafe Ops</strong>
        <span class="mgr-role-pill">${isAdmin ? 'Admin · Full chain' : `Artist · ${esc(state.me.artistName)}`}</span>
      </div>
      <nav class="mgr-nav" aria-label="Manager sections">
        ${navItems.map(([id, label, count]) => `<button type="button" class="mgr-nav-btn ${state.tab === id ? 'is-active' : ''}" data-action="nav-tab" data-tab="${id}"><span>${esc(label)}</span>${count !== null && count !== undefined ? `<span class="mgr-nav-count">${count}</span>` : ''}</button>`).join('')}
      </nav>
      <div class="mgr-sidebar-foot">
        <span>${esc(state.me.email)}</span>
        <button type="button" class="mgr-btn outline small" data-action="mgr-signout">Sign out</button>
      </div>
    </aside>
    <main class="mgr-main">${bodyHtml}</main>
  </div>
  <nav class="mgr-bottom-nav" aria-label="Mobile sections">
    ${navItems.map(([id, label, count]) => `<button type="button" class="mgr-bottom-btn ${state.tab === id ? 'is-active' : ''}" data-action="nav-tab" data-tab="${id}">
      <svg viewBox="0 0 24 24" aria-hidden="true">${NAV_ICONS[id] || ''}</svg>
      <span>${esc(label)}</span>
      ${count ? `<span class="mgr-bnav-dot">${count}</span>` : ''}
    </button>`).join('')}
  </nav>`;
}

function openCurationModal(artworkId) {
  const art = state.artworks.find(a => a.id === artworkId);
  if (!art) return;
  const dlg = $('mgr-dialog');
  dlg.innerHTML = `<div class="mgr-dialog-head">
      <div><p class="mgr-eyebrow">Admin Curation &amp; Pickup Bin Assignment</p><h2>${esc(art.title)}</h2></div>
      <button type="button" class="mgr-btn outline small" data-action="close-modal">Close</button>
    </div>
    <form id="mgr-curate-form" data-id="${esc(art.id)}" class="mgr-form-grid">
      <label class="mgr-field">Title<input name="title" required maxlength="120" value="${esc(art.title)}"></label>
      <label class="mgr-field">Artist<input name="artistName" required maxlength="120" value="${esc(art.artistName)}"></label>
      <label class="mgr-field">Genre / product type<input name="genre" required maxlength="60" value="${esc(art.genre)}"></label>
      <label class="mgr-field">Selling price (₹)<input name="price" type="number" min="0" step="0.01" value="${art.price || 0}"></label>
      <label class="mgr-field">Pipeline stage<select name="stage">${STAGES.filter(([k]) => k !== 'all').map(([k, label]) => `<option value="${k}" ${art.stage === k ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></label>
      <label class="mgr-field">1-of-1 availability<select name="stock"><option value="1" ${art.stock !== 0 ? 'selected' : ''}>Available (1-of-1)</option><option value="0" ${art.stock === 0 ? 'selected' : ''}>Sold out (0)</option></select></label>
      <label class="mgr-field">Assigned pickup bin artist<input name="assignedBinArtist" maxlength="120" value="${esc(art.assignedBinArtist || art.artistName)}"></label>
      <label class="mgr-field">Pickup batch / tag<input name="binBatch" maxlength="60" value="${esc(art.binBatch || '')}" placeholder="e.g. Nov Pickup #2"></label>
      <label class="mgr-field">Material<input name="material" maxlength="150" value="${esc(art.material || '')}"></label>
      <label class="mgr-field">Dimensions<input name="dimensions" maxlength="150" value="${esc(art.dimensions || '')}"></label>
      <label class="mgr-field wide">Store description &amp; story<textarea name="description" maxlength="3000" placeholder="Full description used when publishing to hehe.cafe…">${esc(art.description || art.artistNotes || '')}</textarea></label>
      <label class="mgr-field">Badge (optional)<input name="tag" maxlength="60" value="${esc(art.tag || '')}"></label>
      <label class="mgr-field">Care / bin note<input name="binNote" maxlength="300" value="${esc(art.binNote || art.care || '')}" placeholder="Pickup or packaging instructions"></label>
      <div class="mgr-field wide" style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;padding-top:6px">
        <button type="button" class="mgr-btn danger small" data-action="delete-mgr-art" data-id="${esc(art.id)}">Remove piece</button>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button type="submit" class="mgr-btn outline">Save curation details</button>
          <button type="button" class="mgr-btn accent" data-action="publish-from-modal" data-id="${esc(art.id)}">${art.storeProductId ? 'Update on hehe.cafe ↻' : 'Send to hehe.cafe →'}</button>
        </div>
      </div>
    </form>`;
  dlg.showModal();
}

function openCafeModal(cafeId = '') {
  const cafe = cafeId ? state.cafes.find(c => c.id === cafeId) : null;
  const dlg = $('mgr-dialog');
  dlg.innerHTML = `<div class="mgr-dialog-head">
      <div><p class="mgr-eyebrow">Partner Café Network</p><h2>${cafe ? `Edit ${esc(cafe.name)}` : 'Add partner café'}</h2></div>
      <button type="button" class="mgr-btn outline small" data-action="close-modal">Close</button>
    </div>
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

function openAssignCafeModal(preselectedIds = null) {
  const activeCafes = state.cafes.filter(c => c.active !== false);
  const assignable = preselectedIds
    ? state.artworks.filter(a => preselectedIds.includes(a.id) && !['at_cafe', 'sold'].includes(a.stage))
    : state.artworks.filter(a => !['at_cafe', 'sold'].includes(a.stage));
  if (!activeCafes.length) return toast('Add an active partner café first.');
  if (!assignable.length) return toast('No eligible (unplaced / unsold) artworks to assign.');
  const dlg = $('mgr-dialog');
  dlg.innerHTML = `<div class="mgr-dialog-head">
      <div><p class="mgr-eyebrow">Consignment Dispatch</p><h2>Send 1-of-1 stock to partner café</h2></div>
      <button type="button" class="mgr-btn outline small" data-action="close-modal">Close</button>
    </div>
    <form id="mgr-assign-cafe-form" style="display:grid;gap:14px">
      <label class="mgr-field">Choose partner café<select name="cafeId" required>${activeCafes.map(c => `<option value="${esc(c.id)}">${esc(c.name)} (${esc(c.city || 'India')} · ${Number(c.commissionPct) || 0}% fee)</option>`).join('')}</select></label>
      <div class="mgr-field">Select 1-of-1 artworks to place:
        <div style="max-height:240px;overflow:auto;border:1px solid var(--line);border-radius:12px;padding:10px;display:grid;gap:8px">
          ${assignable.map(a => `<label style="display:flex;align-items:center;gap:8px;font-weight:500"><input type="checkbox" name="artworkIds" value="${esc(a.id)}" style="width:auto" ${preselectedIds ? 'checked' : ''}><span><strong>${esc(a.title)}</strong> · ${esc(a.genre)} · ${esc(a.artistName)} (${a.price > 0 ? money(a.price) : 'Price TBD'})</span></label>`).join('')}
        </div>
      </div>
      <label class="mgr-field">Dispatch note (optional)<input name="notes" maxlength="300" placeholder="e.g. Weekend display shelf batch"></label>
      <button type="submit" class="mgr-btn accent">Assign selected stock to café →</button>
    </form>`;
  dlg.showModal();
}

function openCafeSaleModal(stock) {
  const dlg = $('mgr-dialog');
  const defaultComm = Number(stock.commissionPct) || 0;
  const userMatch = state.users.find(u => normKey(u.artistName) === normKey(stock.artistName));
  const artistComm = userMatch ? (Number(userMatch.commissionPct) || 60) : 60;
  dlg.innerHTML = `<div class="mgr-dialog-head">
      <div><p class="mgr-eyebrow">Log Café Sale · ${esc(stock.cafeName)}</p><h2>${esc(stock.title)}</h2></div>
      <button type="button" class="mgr-btn outline small" data-action="close-modal">Close</button>
    </div>
    <form id="mgr-cafe-sale-form" data-id="${esc(stock.id)}" data-artist-comm="${artistComm}" class="mgr-form-grid">
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
    <form id="mgr-edit-user-form" data-email="${esc(u.email)}" class="mgr-form-grid">
      <label class="mgr-field">Status<select name="status"><option value="approved" ${u.status === 'approved' ? 'selected' : ''}>Approved</option><option value="pending" ${u.status === 'pending' ? 'selected' : ''}>Pending</option><option value="revoked" ${u.status === 'revoked' ? 'selected' : ''}>Revoked</option></select></label>
      <label class="mgr-field">Role<select name="role"><option value="artist" ${u.role !== 'admin' ? 'selected' : ''}>Artist</option><option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option></select></label>
      <label class="mgr-field">Mapped artist name<input name="artistName" maxlength="120" value="${esc(u.artistName || u.requestedArtistName || '')}"></label>
      <label class="mgr-field">Artist commission (%)<input name="commissionPct" type="number" min="0" max="100" step="0.5" value="${u.commissionPct ?? 60}"></label>
      <div class="mgr-field wide" style="display:flex;justify-content:flex-end"><button type="submit" class="mgr-btn">Save member settings →</button></div>
    </form>`;
  dlg.showModal();
}

document.addEventListener('click', async event => {
  const btn = event.target.closest('[data-action]');
  if (!btn || btn.disabled) return;
  const action = btn.dataset.action;
  const id = btn.dataset.id;
  try {
    if (action === 'google-signin' || action === 'google-signin-redirect') {
      btn.disabled = true;
      await signInWithGoogle({ redirect: action === 'google-signin-redirect' });
    } else if (action === 'mgr-signout') {
      await signOutManager();
    } else if (action === 'recheck-access' || action === 'refresh-all') {
      await refreshAccess();
    } else if (action === 'nav-tab') {
      state.tab = btn.dataset.tab || 'analytics';
      render();
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
      state.selectedUploadImages.splice(Number(btn.dataset.idx), 1);
      render();
    } else if (action === 'set-stage-filter') {
      state.stageFilter = btn.dataset.stage || 'all';
      render();
    } else if (action === 'select-all-shown') {
      filterArtworks().forEach(a => state.selectedArtIds.add(a.id));
      render();
    } else if (action === 'clear-art-selection') {
      state.selectedArtIds.clear();
      render();
    } else if (action === 'bulk-assign-bin') {
      const ids = [...state.selectedArtIds];
      const batch = window.prompt('Optional pickup batch / note (leave blank for default):', '') ?? '';
      const res = await callManager('managerBulkUpdateArtworks', { artworkIds: ids, action: 'assign_bin', binBatch: batch });
      state.selectedArtIds.clear();
      toast(`Moved ${res.updatedCount} piece(s) to Pickup Bins${res.skippedCount ? ` (${res.skippedCount} skipped)` : ''}.`);
      await loadWorkspaceData();
    } else if (action === 'bulk-assign-cafe') {
      openAssignCafeModal([...state.selectedArtIds]);
    } else if (action === 'bulk-publish-store') {
      const ids = [...state.selectedArtIds];
      if (!window.confirm(`Publish ${ids.length} selected piece(s) to hehe.cafe? Pieces without a price will be skipped.`)) return;
      const res = await callManager('managerBulkUpdateArtworks', { artworkIds: ids, action: 'publish_store' });
      state.selectedArtIds.clear();
      toast(`Published ${res.updatedCount} piece(s) to hehe.cafe${res.skippedCount ? ` (${res.skippedCount} skipped)` : ''}.`);
      await loadWorkspaceData();
    } else if (action === 'close-modal') {
      $('mgr-dialog')?.close();
    } else if (action === 'edit-mgr-art') {
      openCurationModal(id);
    } else if (action === 'delete-mgr-art') {
      if (!window.confirm('Remove this artwork from the studio manager?')) return;
      await callManager('managerDeleteArtwork', { artworkId: id });
      $('mgr-dialog')?.close();
      toast('Artwork removed.');
      await loadWorkspaceData();
    } else if (action === 'publish-mgr-art' || action === 'publish-from-modal') {
      if (action === 'publish-from-modal') {
        const form = $('mgr-curate-form');
        const fd = new FormData(form);
        await callManager('managerUpdateArtwork', {
          artworkId: id,
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
            description: fd.get('description')
          }
        });
      }
      const res = await callManager('managerPublishToStore', { artworkId: id, visible: true, inBanner: true });
      $('mgr-dialog')?.close();
      toast(`Live on hehe.cafe! Ref ${res.refNumber}`);
      await loadWorkspaceData();
    } else if (action === 'bin-step') {
      await callManager('managerUpdateBinStatus', { artworkId: id, binStatus: btn.dataset.status });
      toast(`Marked ${btn.dataset.status.replace('_', ' ')}!`);
      await loadWorkspaceData();
    } else if (action === 'bin-receive') {
      const moveToCurated = window.confirm('Confirm received at studio and move directly to Curated stage? (Cancel = keep in Pickup Bin as Received)');
      await callManager('managerUpdateBinStatus', { artworkId: id, binStatus: 'received_at_studio', moveToCurated });
      toast(moveToCurated ? 'Received at studio & moved to Curated!' : 'Confirmed received at studio.');
      await loadWorkspaceData();
    } else if (action === 'open-cafe-modal') {
      openCafeModal(id || '');
    } else if (action === 'open-assign-cafe-modal') {
      openAssignCafeModal();
    } else if (action === 'cafe-mark-sold') {
      const stock = state.cafeStock.find(s => s.id === id);
      if (stock) openCafeSaleModal(stock);
    } else if (action === 'cafe-request-return') {
      const reason = window.prompt('Note / reason for return request:', 'Unsold rotation') ?? '';
      await callManager('managerUpdateCafeStock', { stockId: id, action: 'request_return', returnReason: reason });
      toast('Marked return requested.');
      await loadWorkspaceData();
    } else if (action === 'cafe-mark-returned') {
      const reason = window.prompt('Why was this item returned unsold?', 'Unsold rotation') ?? '';
      await callManager('managerUpdateCafeStock', { stockId: id, action: 'mark_returned', returnReason: reason });
      toast('Returned unsold stock logged back to studio.');
      await loadWorkspaceData();
    } else if (action === 'print-handover-challan' || action === 'print-return-challan') {
      const cafe = state.cafes.find(c => c.id === id);
      const isReturn = action === 'print-return-challan';
      const items = state.cafeStock.filter(s => s.cafeId === id && (isReturn ? s.status === 'returned_to_studio' : ['at_cafe', 'return_requested'].includes(s.status)));
      if (!openPrintableChallan({ type: isReturn ? 'return' : 'handover', cafe, items })) {
        toast('Allow popups to open the printable challan.');
      }
    } else if (action === 'open-payout-modal') {
      openPayoutModal(btn.dataset.artist || '', btn.dataset.due || '');
    } else if (action === 'delete-payout') {
      if (!window.confirm('Delete this payout record from the ledger?')) return;
      await callManager('managerDeletePayout', { payoutId: id });
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
    } else if (action === 'approve-user') {
      const email = btn.dataset.email;
      const defaultArtist = btn.dataset.artist || '';
      const artistName = window.prompt(`Artist display name for ${email} (used to scope their analytics & pickup bin):`, defaultArtist);
      if (!artistName || !artistName.trim()) return;
      await callManager('managerApproveUser', { email, status: 'approved', role: btn.dataset.role || 'artist', artistName: artistName.trim(), commissionPct: Number(btn.dataset.comm || 60) });
      toast(`Approved ${email}.`);
      await loadWorkspaceData();
    } else if (action === 'revoke-user') {
      const email = btn.dataset.email;
      if (!window.confirm(`Revoke Chain Manager access for ${email}?`)) return;
      await callManager('managerApproveUser', { email, status: 'revoked', role: 'artist' });
      toast(`Revoked access for ${email}.`);
      await loadWorkspaceData();
    }
  } catch (error) {
    toast(error?.message || 'Action failed.');
  } finally {
    if (btn.isConnected) btn.disabled = false;
  }
});

document.addEventListener('change', async event => {
  if (event.target.id === 'mgr-upload-files') {
    try {
      const next = await compressArtworkFiles(event.target.files);
      state.selectedUploadImages = [...state.selectedUploadImages, ...next].slice(0, 4);
      render();
    } catch (error) {
      toast(error?.message || 'Could not process image.');
    }
  } else if (event.target.dataset?.selectArt) {
    const id = event.target.dataset.selectArt;
    if (event.target.checked) state.selectedArtIds.add(id);
    else state.selectedArtIds.delete(id);
    render();
  }
});

document.addEventListener('input', event => {
  if (event.target.id === 'mgr-art-search') {
    state.artSearch = event.target.value;
    const pos = event.target.selectionStart;
    render();
    const input = $('mgr-art-search');
    if (input) { input.focus(); input.setSelectionRange(pos, pos); }
  }
});

document.addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.target;
  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;
  try {
    const fd = new FormData(form);
    if (form.id === 'mgr-request-access-form') {
      await callManager('managerRequestAccess', { artistName: fd.get('artistName'), note: fd.get('note') });
      toast('Access request submitted for one-time Admin approval.');
      await refreshAccess();
    } else if (form.id === 'mgr-upload-form') {
      if (!state.selectedUploadImages.length) throw new Error('Select 1 to 4 photos first.');
      await callManager('managerUploadArtwork', {
        title: fd.get('title'),
        genre: fd.get('genre'),
        artistName: fd.get('artistName'),
        material: fd.get('material'),
        dimensions: fd.get('dimensions'),
        notes: fd.get('notes'),
        images: state.selectedUploadImages
      });
      state.selectedUploadImages = [];
      state.uploadPanelOpen = false;
      toast('Uploaded 1-of-1 artwork to intake!');
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
          description: fd.get('description')
        }
      });
      $('mgr-dialog')?.close();
      toast('Curation saved.');
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
      await callManager('managerAssignCafeStock', { cafeId: fd.get('cafeId'), artworkIds, notes: fd.get('notes') });
      state.selectedArtIds.clear();
      $('mgr-dialog')?.close();
      toast(`Assigned ${artworkIds.length} 1-of-1 artwork(s) to café.`);
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
    toast(error?.message || 'Could not save changes.');
  } finally {
    if (submitBtn?.isConnected) submitBtn.disabled = false;
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

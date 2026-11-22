import {
  observeGoogleAuth,
  signInWithGoogle,
  signOutManager,
  callManager,
  compressArtworkFiles
} from './manager-store.js';

const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => '₹' + (Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const fmtDate = ts => ts ? new Date(Number(ts)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const googleSvg = `<svg viewBox="0 0 256 262" aria-hidden="true"><path fill="#4285F4" d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622 38.755 30.023 2.685.268c24.659-22.774 38.875-56.282 38.875-96.027"/><path fill="#34A853" d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055-34.523 0-63.824-22.773-74.269-54.25l-1.531.13-40.298 31.187-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1"/><path fill="#FBBC05" d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82 0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602l42.356-32.782"/><path fill="#EB4335" d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0 79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251"/></svg>`;

const STAGES = [
  ['all', 'All'],
  ['intake', 'Intake'],
  ['curated', 'Curated'],
  ['delivery_bin', 'Delivery bin'],
  ['at_cafe', 'At café'],
  ['live_online', 'Live on site'],
  ['sold', 'Sold'],
  ['returned', 'Returned']
];

const STAGE_LABEL = Object.fromEntries(STAGES.filter(([k]) => k !== 'all'));

const state = {
  authReady: false,
  googleUser: null,
  rawNonGoogleUser: null,
  me: null,
  loadingMe: false,
  meError: '',
  tab: 'analytics',
  loadingData: false,
  dataError: '',
  analytics: null,
  artworks: [],
  cafes: [],
  cafeStock: [],
  users: [],
  stageFilter: 'all',
  artSearch: '',
  selectedUploadImages: [],
  uploadPanelOpen: false
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
    const [analytics, artworks, cafeData, users] = await Promise.all([
      callManager('managerAnalytics'),
      callManager('managerListArtworks'),
      callManager('managerListCafes'),
      isAdmin ? callManager('managerListUsers') : Promise.resolve([])
    ]);
    state.analytics = analytics || null;
    state.artworks = Array.isArray(artworks) ? artworks : [];
    state.cafes = Array.isArray(cafeData?.cafes) ? cafeData.cafes : [];
    state.cafeStock = Array.isArray(cafeData?.stock) ? cafeData.stock : [];
    state.users = Array.isArray(users) ? users : [];
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
    <p class="mgr-muted">Invite-only workspace for studio curation, artist artwork intake, delivery bins, partner café stock tracking, and sales velocity analytics.</p>
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
            <label class="mgr-field">Optional note for Admin<textarea name="note" maxlength="500" placeholder="Artworks you create or partner location…"></textarea></label>
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
  const genres = a.genreBreakdown || [];
  const maxGenreUnits = Math.max(1, ...genres.map(g => g.totalUnits || 0));

  return `<div class="mgr-head">
      <div>
        <p class="mgr-eyebrow">${isAdmin ? 'Full Chain Performance' : `Artist Analytics · ${esc(state.me.artistName)}`}</p>
        <h1>Sales &amp; Genre Velocity</h1>
      </div>
      <div class="mgr-head-actions">
        <button type="button" class="mgr-btn outline small" data-action="refresh-all">Refresh data ↻</button>
      </div>
    </div>
    <div class="mgr-kpi-grid">
      <div class="mgr-kpi"><span>Combined revenue</span><strong>${money(s.totalRevenue)}</strong><small>Online ${money(s.siteRevenue)} + Café ${money(s.cafeRevenue)}</small></div>
      <div class="mgr-kpi"><span>Total units sold</span><strong>${s.totalUnitsSold || 0}</strong><small>${s.siteUnitsSold || 0} online · ${s.cafeUnitsSold || 0} at cafés</small></div>
      <div class="mgr-kpi"><span>Active café stock</span><strong>${s.activeCafeStockCount || 0}</strong><small>${s.returnedUnsoldCount || 0} returned unsold</small></div>
      <div class="mgr-kpi"><span>In delivery bins</span><strong>${s.deliveryBinCount || 0}</strong><small>${s.intakeCount || 0} awaiting curation</small></div>
    </div>

    <section class="mgr-panel">
      <h2>Fast-moving genres &amp; styles</h2>
      <p class="mgr-muted" style="margin-bottom:14px">Ranked by combined units sold (online + cafés) alongside active café shelf count and unsold returns.</p>
      ${genres.length ? `<div class="mgr-table-wrap"><table class="mgr-table">
        <thead><tr><th>Genre / Category</th><th>Velocity</th><th>Online sold</th><th>Café sold</th><th>Revenue</th><th>At cafés</th><th>Returned unsold</th><th>Sell-through</th><th>Avg café days</th></tr></thead>
        <tbody>${genres.map(g => `<tr>
          <td><strong>${esc(g.genre)}</strong></td>
          <td><div class="mgr-bar-wrap"><div class="mgr-bar-track"><div class="mgr-bar-fill" style="width:${Math.round(((g.totalUnits || 0) / maxGenreUnits) * 100)}%"></div></div><strong>${g.totalUnits}</strong></div></td>
          <td>${g.siteUnits}</td>
          <td>${g.cafeUnits}</td>
          <td><strong>${money(g.totalRevenue)}</strong></td>
          <td>${g.activeCafeUnits}</td>
          <td>${g.returnedUnits ? `<span class="mgr-pill is-returned">${g.returnedUnits}</span>` : '0'}</td>
          <td>${g.sellThroughPct}%</td>
          <td>${g.avgDaysAtCafe !== null && g.avgDaysAtCafe !== undefined ? `${g.avgDaysAtCafe}d` : '—'}</td>
        </tr>`).join('')}</tbody>
      </table></div>` : '<p class="mgr-muted">No genre sales recorded yet.</p>'}
    </section>

    ${isAdmin ? `<div class="mgr-split">
      <section class="mgr-panel">
        <h2>Partner café performance</h2>
        ${(a.cafeBreakdown || []).length ? `<div class="mgr-table-wrap"><table class="mgr-table">
          <thead><tr><th>Café</th><th>Active stock</th><th>Sold</th><th>Revenue</th><th>Unsold returns</th><th>Return rate</th></tr></thead>
          <tbody>${a.cafeBreakdown.map(c => `<tr>
            <td><strong>${esc(c.cafeName)}</strong><br><small class="mgr-muted">${esc(c.city || '')}</small></td>
            <td>${c.activeStock}</td>
            <td>${c.soldUnits}</td>
            <td><strong>${money(c.soldRevenue)}</strong></td>
            <td>${c.returnedUnits}</td>
            <td>${c.returnRatePct}%</td>
          </tr>`).join('')}</tbody>
        </table></div>` : '<p class="mgr-muted">Add partner cafés and assign stock to track café velocity.</p>'}
      </section>
      <section class="mgr-panel">
        <h2>Artist breakdown</h2>
        ${(a.artistBreakdown || []).length ? `<div class="mgr-table-wrap"><table class="mgr-table">
          <thead><tr><th>Artist</th><th>Online</th><th>Café</th><th>Revenue</th><th>Returned</th></tr></thead>
          <tbody>${a.artistBreakdown.map(ar => `<tr>
            <td><strong>${esc(ar.artist)}</strong></td>
            <td>${ar.siteUnits}</td>
            <td>${ar.cafeUnits}</td>
            <td><strong>${money(ar.totalRevenue)}</strong></td>
            <td>${ar.returnedUnits}</td>
          </tr>`).join('')}</tbody>
        </table></div>` : '<p class="mgr-muted">No artist sales data yet.</p>'}
      </section>
    </div>` : ''}

    <div class="mgr-split">
      <section class="mgr-panel">
        <h2>Recent sales (${isAdmin ? 'All channels' : 'Your artworks'})</h2>
        ${(a.recentSales || []).length ? `<div class="mgr-table-wrap"><table class="mgr-table">
          <thead><tr><th>Date</th><th>Artwork</th><th>Genre</th><th>Channel / Location</th><th>Revenue</th></tr></thead>
          <tbody>${a.recentSales.slice(0, 15).map(r => `<tr>
            <td>${fmtDate(r.at)}</td>
            <td><strong>${esc(r.title)}</strong>${isAdmin ? `<br><small class="mgr-muted">${esc(r.artistName)}</small>` : ''}</td>
            <td>${esc(r.genre)}</td>
            <td><span class="mgr-pill ${r.channel === 'cafe' ? 'is-at_cafe' : 'is-live_online'}">${esc(r.location || r.channel)}</span></td>
            <td><strong>${money(r.revenue)}</strong></td>
          </tr>`).join('')}</tbody>
        </table></div>` : '<p class="mgr-muted">No completed sales recorded yet.</p>'}
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
        </table></div>` : '<p class="mgr-muted">No unsold café returns yet. Pieces returned from cafés appear here so you can spot slow-moving styles.</p>'}
      </section>
    </div>`;
}

function renderArtworksTab(isAdmin) {
  const q = state.artSearch.trim().toLowerCase();
  const filtered = state.artworks.filter(a => {
    if (state.stageFilter !== 'all' && a.stage !== state.stageFilter) return false;
    if (!q) return true;
    return `${a.title} ${a.artistName} ${a.genre} ${a.storeRefNumber || ''}`.toLowerCase().includes(q);
  });

  return `<div class="mgr-head">
      <div>
        <p class="mgr-eyebrow">Studio Intake &amp; Curation</p>
        <h1>Artworks pipeline</h1>
      </div>
      <div class="mgr-head-actions">
        <button type="button" class="mgr-btn" data-action="toggle-upload-panel">${state.uploadPanelOpen ? 'Close upload form' : '+ Upload artwork'}</button>
        <button type="button" class="mgr-btn outline small" data-action="refresh-all">Refresh ↻</button>
      </div>
    </div>

    ${state.uploadPanelOpen ? `<section class="mgr-panel">
      <h2>Upload artwork photos to studio intake</h2>
      <p class="mgr-muted" style="margin-bottom:14px">${isAdmin ? 'Add raw pieces for curation, delivery bin assignment, or publishing to hehe.cafe.' : `Uploading under your approved artist profile: <strong>${esc(state.me.artistName)}</strong>.`}</p>
      <form id="mgr-upload-form" class="mgr-form-grid">
        <label class="mgr-field">Artwork title<input name="title" required minlength="2" maxlength="120" placeholder="e.g. Rainy Chai Magnets"></label>
        <label class="mgr-field">Genre / type<input name="genre" list="mgr-genre-list" required maxlength="60" placeholder="e.g. Fridge Magnet"><datalist id="mgr-genre-list"><option value="Fridge Magnet"><option value="Clay Frame"><option value="Original Painting"><option value="Coaster"><option value="Keychain"></datalist></label>
        ${isAdmin ? `<label class="mgr-field">Artist name<input name="artistName" required maxlength="120" value="Suprita Chatterjee"></label>` : ''}
        <label class="mgr-field">Material (optional)<input name="material" maxlength="150" placeholder="e.g. Air-dry clay & acrylic"></label>
        <label class="mgr-field">Dimensions (optional)<input name="dimensions" maxlength="150" placeholder="e.g. 6 × 6 cm"></label>
        <label class="mgr-field wide">Artist notes (optional story, colours, finishing)<textarea name="notes" maxlength="1000" placeholder="Tell the admin any story, batch note, or pricing suggestion…"></textarea></label>
        <label class="mgr-field wide">Artwork photos (1–4 images · JPG, PNG or WebP · automatically compressed)<input id="mgr-upload-files" type="file" accept="image/jpeg,image/png,image/webp" multiple required></label>
        <div class="mgr-preview-imgs mgr-field wide" id="mgr-upload-preview">${state.selectedUploadImages.map(src => `<img src="${esc(src)}" alt="Preview">`).join('')}</div>
        <div class="mgr-field wide" style="display:flex;justify-content:flex-end;gap:10px">
          <button type="submit" class="mgr-btn">Upload to studio intake →</button>
        </div>
      </form>
    </section>` : ''}

    <div class="mgr-chips">
      ${STAGES.map(([k, label]) => {
        const count = k === 'all' ? state.artworks.length : state.artworks.filter(a => a.stage === k).length;
        return `<button type="button" class="mgr-chip ${state.stageFilter === k ? 'is-active' : ''}" data-action="set-stage-filter" data-stage="${k}">${esc(label)} (${count})</button>`;
      }).join('')}
    </div>
    <div style="margin-bottom:16px">
      <input id="mgr-art-search" type="search" value="${esc(state.artSearch)}" placeholder="Search title, genre, artist, or Ref…" style="width:100%;max-width:420px;padding:9px 14px;border-radius:999px;border:1.5px solid #d8d0c1;background:#fff">
    </div>

    ${filtered.length ? `<div class="mgr-art-grid">${filtered.map(a => `<article class="mgr-art-card">
      <div class="mgr-art-thumb">${a.images?.[0] ? `<img src="${esc(a.images[0])}" alt="${esc(a.title)}" loading="lazy">` : ''}</div>
      <div class="mgr-art-body">
        <div class="mgr-art-top">
          <span class="mgr-pill is-${esc(a.stage || 'intake')}">${esc(STAGE_LABEL[a.stage] || a.stage)}</span>
          ${a.price > 0 ? `<strong>${money(a.price)}</strong>` : '<small class="mgr-muted">Price TBD</small>'}
        </div>
        <h3>${esc(a.title)}</h3>
        <div class="mgr-art-meta">${esc(a.genre)} · ${esc(a.artistName)}${a.assignedBinArtist ? `<br>Delivery bin: <strong>${esc(a.assignedBinArtist)}</strong>` : ''}${a.assignedCafeName ? `<br>At café: <strong>${esc(a.assignedCafeName)}</strong>` : ''}${a.storeRefNumber ? `<br><span class="mono">Ref ${esc(a.storeRefNumber)} (live on site)</span>` : ''}</div>
        ${isAdmin ? `<div class="mgr-art-actions">
          <button type="button" class="mgr-btn outline small" data-action="edit-mgr-art" data-id="${esc(a.id)}">Curate / bin</button>
          ${a.price > 0 ? `<button type="button" class="mgr-btn accent small" data-action="publish-mgr-art" data-id="${esc(a.id)}">${a.storeProductId ? 'Sync hehe.cafe ↻' : 'Send to hehe.cafe →'}</button>` : ''}
        </div>` : ''}
      </div>
    </article>`).join('')}</div>` : '<div class="mgr-panel"><p class="mgr-muted">No artworks match this filter yet.</p></div>'}`;
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
        <p class="mgr-eyebrow">Dispatch Packing &amp; Artist Allocations</p>
        <h1>Delivery bins</h1>
      </div>
      <div class="mgr-head-actions"><button type="button" class="mgr-btn outline small" data-action="refresh-all">Refresh ↻</button></div>
    </div>
    ${groups.length ? `<div class="mgr-bins-grid">${groups.map(([artist, items]) => `<section class="mgr-panel">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <h2>${esc(artist)}</h2>
        <span class="mgr-pill is-delivery_bin">${items.length} ${items.length === 1 ? 'piece' : 'pieces'}</span>
      </div>
      ${items.map(item => `<div class="mgr-bin-item">
        ${item.images?.[0] ? `<img src="${esc(item.images[0])}" alt="">` : ''}
        <div>
          <strong>${esc(item.title)}</strong>
          <div class="mgr-art-meta">${esc(item.genre)} · ${item.price > 0 ? money(item.price) : 'Price TBD'}${item.binNote ? ` · ${esc(item.binNote)}` : ''}</div>
        </div>
        ${isAdmin ? `<div style="display:flex;gap:6px;flex-wrap:wrap">
          <button type="button" class="mgr-btn outline small" data-action="edit-mgr-art" data-id="${esc(item.id)}">Edit</button>
          ${item.price > 0 ? `<button type="button" class="mgr-btn accent small" data-action="publish-mgr-art" data-id="${esc(item.id)}">To site ↗</button>` : ''}
        </div>` : ''}
      </div>`).join('')}
    </section>`).join('')}</div>` : '<div class="mgr-panel"><p class="mgr-muted">No artworks currently queued in delivery bins. Curate pieces in Artworks pipeline and set stage to "Delivery bin".</p></div>'}`;
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
        <p class="mgr-eyebrow">Retail Chain Consignment</p>
        <h1>Partner cafés &amp; stock returns</h1>
      </div>
      <div class="mgr-head-actions">
        ${isAdmin ? `<button type="button" class="mgr-btn" data-action="open-cafe-modal">+ Add partner café</button>` : ''}
        ${isAdmin && state.cafes.length && assignableArts.length ? `<button type="button" class="mgr-btn accent" data-action="open-assign-cafe-modal">Send stock to café →</button>` : ''}
        <button type="button" class="mgr-btn outline small" data-action="refresh-all">Refresh ↻</button>
      </div>
    </div>

    <section class="mgr-panel">
      <h2>Live café inventory (${activeStock.length})</h2>
      <p class="mgr-muted" style="margin-bottom:12px">Track pieces sitting in partner cafés, log in-café sales, or request/receive unsold returns back to studio.</p>
      ${activeStock.length ? `<div class="mgr-table-wrap"><table class="mgr-table">
        <thead><tr><th>Café</th><th>Artwork</th><th>Genre</th><th>Price</th><th>At café</th><th>Status</th>${isAdmin ? '<th>Actions</th>' : ''}</tr></thead>
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
      <h2>Partner café directory (${state.cafes.length})</h2>
      ${state.cafes.length ? `<div class="mgr-table-wrap"><table class="mgr-table">
        <thead><tr><th>Café</th><th>City / Area</th><th>Contact</th><th>Commission</th><th>Status</th><th></th></tr></thead>
        <tbody>${state.cafes.map(c => `<tr>
          <td><strong>${esc(c.name)}</strong></td>
          <td>${esc(c.city || '—')}${c.area ? ` · ${esc(c.area)}` : ''}</td>
          <td>${esc(c.contactName || '—')} ${c.phone ? `· ${esc(c.phone)}` : ''}</td>
          <td>${Number(c.commissionPct) || 0}%</td>
          <td><span class="mgr-pill ${c.active !== false ? 'is-live_online' : 'is-revoked'}">${c.active !== false ? 'Active' : 'Paused'}</span></td>
          <td><button type="button" class="mgr-btn outline small" data-action="open-cafe-modal" data-id="${esc(c.id)}">Edit</button></td>
        </tr>`).join('')}</tbody>
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
          <td>${s.status === 'sold_at_cafe' ? `${money(s.salePrice || s.price)}` : esc(s.returnReason || 'Unsold')}</td>
        </tr>`).join('')}</tbody>
      </table></div>` : '<p class="mgr-muted">No completed café sales or returns logged yet.</p>'}
    </section>`;
}

function renderUsersTab() {
  return `<div class="mgr-head">
      <div>
        <p class="mgr-eyebrow">One-Time Approval &amp; Access Control</p>
        <h1>Team &amp; artist access</h1>
      </div>
      <div class="mgr-head-actions">
        <button type="button" class="mgr-btn outline small" data-action="refresh-all">Refresh ↻</button>
      </div>
    </div>
    <section class="mgr-panel">
      <h2>Pre-approve a Google account</h2>
      <p class="mgr-muted" style="margin-bottom:12px">Grant an artist one-time access by Google email before they open this manager link, or approve pending requests below.</p>
      <form id="mgr-preapprove-form" class="mgr-form-grid">
        <label class="mgr-field">Google email address<input name="email" type="email" required placeholder="artist@gmail.com"></label>
        <label class="mgr-field">Artist display name (must match their artworks)<input name="artistName" required minlength="2" maxlength="120" placeholder="e.g. Suprita Chatterjee"></label>
        <label class="mgr-field">Role<select name="role"><option value="artist">Artist (own artworks &amp; analytics only)</option><option value="admin">Admin (full studio &amp; café chain)</option></select></label>
        <div class="mgr-field" style="align-self:end"><button type="submit" class="mgr-btn">Approve Google access →</button></div>
      </form>
    </section>
    <section class="mgr-panel">
      <h2>Registered team members (${state.users.length})</h2>
      ${state.users.length ? `<div class="mgr-table-wrap"><table class="mgr-table">
        <thead><tr><th>Google email</th><th>Status</th><th>Role</th><th>Mapped artist name</th><th>Note</th><th>Actions</th></tr></thead>
        <tbody>${state.users.map(u => `<tr>
          <td><strong>${esc(u.email)}</strong><br><small class="mgr-muted">${esc(u.name || '')}</small></td>
          <td><span class="mgr-pill is-${esc(u.status || 'pending')}">${esc(u.status || 'pending')}</span></td>
          <td>${esc(u.role || 'artist')}</td>
          <td>${esc(u.artistName || u.requestedArtistName || '—')}</td>
          <td>${esc(u.note || '—')}</td>
          <td style="display:flex;gap:6px;flex-wrap:wrap">
            ${u.status !== 'approved' ? `<button type="button" class="mgr-btn accent small" data-action="approve-user" data-email="${esc(u.email)}" data-artist="${esc(u.artistName || u.requestedArtistName || '')}" data-role="${esc(u.role || 'artist')}">Approve</button>` : ''}
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
  const navItems = [
    ['analytics', 'Analytics & genres', null],
    ['artworks', 'Artworks & intake', state.artworks.length],
    ['bins', 'Delivery bins', state.artworks.filter(a => a.stage === 'delivery_bin').length],
    ['cafes', 'Partner cafés & returns', state.cafeStock.filter(s => ['at_cafe', 'return_requested'].includes(s.status)).length]
  ];
  if (isAdmin) navItems.push(['users', 'Access & approvals', pendingUsersCount || null]);

  let bodyHtml = '';
  if (state.dataError) {
    bodyHtml = `<div class="mgr-panel"><p style="color:var(--danger)">${esc(state.dataError)}</p><button type="button" class="mgr-btn outline small" data-action="refresh-all">Try again</button></div>`;
  } else if (state.tab === 'artworks') {
    bodyHtml = renderArtworksTab(isAdmin);
  } else if (state.tab === 'bins') {
    bodyHtml = renderBinsTab(isAdmin);
  } else if (state.tab === 'cafes') {
    bodyHtml = renderCafesTab(isAdmin);
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
  </div>`;
}

function openCurationModal(artworkId) {
  const art = state.artworks.find(a => a.id === artworkId);
  if (!art) return;
  const dlg = $('mgr-dialog');
  dlg.innerHTML = `<div class="mgr-dialog-head">
      <div><p class="mgr-eyebrow">Admin Curation &amp; Bin Assignment</p><h2>${esc(art.title)}</h2></div>
      <button type="button" class="mgr-btn outline small" data-action="close-modal">Close</button>
    </div>
    <form id="mgr-curate-form" data-id="${esc(art.id)}" class="mgr-form-grid">
      <label class="mgr-field">Title<input name="title" required maxlength="120" value="${esc(art.title)}"></label>
      <label class="mgr-field">Artist<input name="artistName" required maxlength="120" value="${esc(art.artistName)}"></label>
      <label class="mgr-field">Genre / product type<input name="genre" required maxlength="60" value="${esc(art.genre)}"></label>
      <label class="mgr-field">Selling price (₹)<input name="price" type="number" min="0" step="0.01" value="${art.price || 0}"></label>
      <label class="mgr-field">Pipeline stage<select name="stage">${STAGES.filter(([k]) => k !== 'all').map(([k, label]) => `<option value="${k}" ${art.stage === k ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></label>
      <label class="mgr-field">Assigned delivery bin (artist)<input name="assignedBinArtist" maxlength="120" value="${esc(art.assignedBinArtist || art.artistName)}"></label>
      <label class="mgr-field">Material<input name="material" maxlength="150" value="${esc(art.material || '')}"></label>
      <label class="mgr-field">Dimensions<input name="dimensions" maxlength="150" value="${esc(art.dimensions || '')}"></label>
      <label class="mgr-field">Tag / badge (optional)<input name="tag" maxlength="60" value="${esc(art.tag || '')}"></label>
      <label class="mgr-field">Stock<input name="stock" type="number" min="0" max="10000" value="${art.stock ?? 1}"></label>
      <label class="mgr-field wide">Store description &amp; story<textarea name="description" maxlength="3000" placeholder="Full description used when publishing to hehe.cafe…">${esc(art.description || art.artistNotes || '')}</textarea></label>
      <label class="mgr-field wide">Care notes / bin note<input name="care" maxlength="500" value="${esc(art.care || '')}" placeholder="Packing, framing or display instructions"></label>
      <div class="mgr-field wide" style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;padding-top:6px">
        <button type="button" class="mgr-btn danger small" data-action="delete-mgr-art" data-id="${esc(art.id)}">Remove artwork</button>
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
      <label class="mgr-field">Commission (%)<input name="commissionPct" type="number" min="0" max="60" step="0.5" value="${cafe?.commissionPct ?? 15}"></label>
      <label class="mgr-field">Owner / manager name<input name="contactName" maxlength="100" value="${esc(cafe?.contactName || '')}"></label>
      <label class="mgr-field">Phone<input name="phone" maxlength="20" value="${esc(cafe?.phone || '')}"></label>
      <label class="mgr-field wide">Notes<textarea name="notes" maxlength="500">${esc(cafe?.notes || '')}</textarea></label>
      <label class="mgr-field wide" style="display:flex;align-items:center;gap:8px;flex-direction:row"><input type="checkbox" name="active" style="width:auto" ${cafe?.active !== false ? 'checked' : ''}><span>Active partner café</span></label>
      <div class="mgr-field wide" style="display:flex;justify-content:flex-end"><button type="submit" class="mgr-btn">Save café →</button></div>
    </form>`;
  dlg.showModal();
}

function openAssignCafeModal() {
  const activeCafes = state.cafes.filter(c => c.active !== false);
  const assignable = state.artworks.filter(a => !['at_cafe', 'sold'].includes(a.stage));
  const dlg = $('mgr-dialog');
  dlg.innerHTML = `<div class="mgr-dialog-head">
      <div><p class="mgr-eyebrow">Consignment Dispatch</p><h2>Send artworks to partner café</h2></div>
      <button type="button" class="mgr-btn outline small" data-action="close-modal">Close</button>
    </div>
    <form id="mgr-assign-cafe-form" style="display:grid;gap:14px">
      <label class="mgr-field">Choose partner café<select name="cafeId" required>${activeCafes.map(c => `<option value="${esc(c.id)}">${esc(c.name)} (${esc(c.city || 'India')})</option>`).join('')}</select></label>
      <div class="mgr-field">Select artworks to place at this café:
        <div style="max-height:240px;overflow:auto;border:1px solid var(--line);border-radius:12px;padding:10px;display:grid;gap:8px">
          ${assignable.map(a => `<label style="display:flex;align-items:center;gap:8px;font-weight:500"><input type="checkbox" name="artworkIds" value="${esc(a.id)}" style="width:auto"><span><strong>${esc(a.title)}</strong> · ${esc(a.genre)} · ${esc(a.artistName)} (${a.price > 0 ? money(a.price) : 'Price TBD'})</span></label>`).join('')}
        </div>
      </div>
      <label class="mgr-field">Dispatch note (optional)<input name="notes" maxlength="300" placeholder="e.g. Weekend display shelf batch"></label>
      <button type="submit" class="mgr-btn accent">Assign selected stock to café →</button>
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
    } else if (action === 'toggle-upload-panel') {
      state.uploadPanelOpen = !state.uploadPanelOpen;
      render();
    } else if (action === 'set-stage-filter') {
      state.stageFilter = btn.dataset.stage || 'all';
      render();
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
            assignedBinArtist: fd.get('assignedBinArtist'),
            material: fd.get('material'),
            dimensions: fd.get('dimensions'),
            tag: fd.get('tag'),
            stock: Number(fd.get('stock') || 1),
            description: fd.get('description'),
            care: fd.get('care')
          }
        });
      }
      const res = await callManager('managerPublishToStore', { artworkId: id, visible: true, inBanner: true });
      $('mgr-dialog')?.close();
      toast(`Live on hehe.cafe! Ref ${res.refNumber}`);
      await loadWorkspaceData();
    } else if (action === 'open-cafe-modal') {
      openCafeModal(id || '');
    } else if (action === 'open-assign-cafe-modal') {
      openAssignCafeModal();
    } else if (action === 'cafe-mark-sold') {
      const stock = state.cafeStock.find(s => s.id === id);
      const raw = window.prompt('Enter final café sale price (₹):', String(stock?.price || ''));
      if (raw === null) return;
      const salePrice = Number(raw);
      if (!Number.isFinite(salePrice) || salePrice <= 0) return toast('Enter a valid positive price.');
      await callManager('managerUpdateCafeStock', { stockId: id, action: 'mark_sold', salePrice });
      toast('Café sale logged & online stock synced.');
      await loadWorkspaceData();
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
    } else if (action === 'approve-user') {
      const email = btn.dataset.email;
      const defaultArtist = btn.dataset.artist || '';
      const artistName = window.prompt(`Artist display name for ${email} (used to scope their analytics & bins):`, defaultArtist);
      if (!artistName || !artistName.trim()) return;
      await callManager('managerApproveUser', { email, status: 'approved', role: btn.dataset.role || 'artist', artistName: artistName.trim() });
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
      state.selectedUploadImages = await compressArtworkFiles(event.target.files);
      const preview = $('mgr-upload-preview');
      if (preview) preview.innerHTML = state.selectedUploadImages.map(src => `<img src="${esc(src)}" alt="Preview">`).join('');
    } catch (error) {
      toast(error?.message || 'Could not process image.');
    }
  }
});

document.addEventListener('input', event => {
  if (event.target.id === 'mgr-art-search') {
    state.artSearch = event.target.value;
    const activeElId = event.target.id;
    const pos = event.target.selectionStart;
    render();
    const input = $(activeElId);
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
      toast('Uploaded artwork to intake!');
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
          assignedBinArtist: fd.get('assignedBinArtist'),
          material: fd.get('material'),
          dimensions: fd.get('dimensions'),
          tag: fd.get('tag'),
          stock: Number(fd.get('stock') || 1),
          description: fd.get('description'),
          care: fd.get('care')
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
      await callManager('managerAssignCafeStock', {
        cafeId: fd.get('cafeId'),
        artworkIds,
        notes: fd.get('notes')
      });
      $('mgr-dialog')?.close();
      toast(`Assigned ${artworkIds.length} artwork(s) to café.`);
      await loadWorkspaceData();
    } else if (form.id === 'mgr-preapprove-form') {
      await callManager('managerApproveUser', {
        email: fd.get('email'),
        artistName: fd.get('artistName'),
        role: fd.get('role'),
        status: 'approved'
      });
      toast(`Pre-approved ${fd.get('email')}.`);
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

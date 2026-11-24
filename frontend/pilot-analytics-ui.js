// Shared detailed Pilot & Network Analytics UI components (used in both Chain Manager Ops and Main Storefront #admin).

const escHtml = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const TRAFFIC_TIME_PRESETS = [
  ['1h', 'Past 1 hr'],
  ['5h', 'Past 5 hrs'],
  ['24h', 'Past 24 hrs'],
  ['7d', 'Past 7 days'],
  ['30d', 'Past 30 days'],
  ['all', 'All time']
];

export function formatDurationSec(totalSec) {
  const s = Math.max(0, Math.round(Number(totalSec) || 0));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return rem ? `${m}m ${rem}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function toDatetimeLocalValue(ms) {
  if (!Number.isFinite(Number(ms)) || ms <= 0) return '';
  const d = new Date(Number(ms) - new Date().getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}

export function pilotControlsMarkup({
  preset = '24h',
  device = 'all',
  fromLocal = '',
  toLocal = '',
  showHeatmapBtn = false,
  heatmapHref = '#home?heatmap=1'
} = {}) {
  const fromVal = fromLocal || toDatetimeLocalValue(Date.now() - 3600000);
  const toVal = toLocal || toDatetimeLocalValue(Date.now());
  return `<div class="pilot-filter-bar">
    <div class="pilot-preset-row">
      <div class="pilot-chip-group" role="group" aria-label="Timeframe presets">
        ${TRAFFIC_TIME_PRESETS.map(([key, label]) => `<button type="button" class="pilot-chip ${preset === key ? 'is-active' : ''}" data-pilot-action="set-preset" data-preset="${escHtml(key)}">${escHtml(label)}</button>`).join('')}
      </div>
      <div class="pilot-chip-group" role="group" aria-label="Device filter">
        ${[['all', 'All devices'], ['Mobile', 'Mobile'], ['Desktop', 'Desktop']].map(([key, label]) => `<button type="button" class="pilot-chip ${device === key ? 'is-active' : ''}" data-pilot-action="set-device" data-device="${escHtml(key)}">${escHtml(label)}</button>`).join('')}
      </div>
      ${showHeatmapBtn ? (heatmapHref.startsWith('http')
        ? `<a class="pilot-chip is-heatmap-btn" href="${escHtml(heatmapHref)}" target="_blank" rel="noopener">Open Site Heatmap ↗</a>`
        : `<button type="button" class="pilot-chip is-heatmap-btn" data-pilot-action="open-heatmap">Open Live Site Heatmap ↗</button>`) : ''}
    </div>
    <form class="pilot-custom-range" data-pilot-custom-form>
      <label class="pilot-range-field"><span>From</span><input type="datetime-local" name="from" value="${escHtml(fromVal)}"></label>
      <label class="pilot-range-field"><span>To</span><input type="datetime-local" name="to" value="${escHtml(toVal)}"></label>
      <button type="submit" class="pilot-chip ${preset === 'custom' ? 'is-active' : ''}">Apply custom range</button>
    </form>
  </div>`;
}

export function pilotTimelineSvgMarkup(timeline = [], windowInfo = {}) {
  const list = Array.isArray(timeline) ? timeline : [];
  if (!list.length) return '<p class="mgr-muted muted small">No timeline buckets yet.</p>';
  const maxVal = Math.max(1, ...list.map(b => Math.max(b.visitors || 0, b.clicks || 0)));
  const w = 680;
  const h = 160;
  const padL = 28;
  const padR = 12;
  const padT = 14;
  const padB = 28;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const slot = plotW / list.length;
  const barW = Math.max(4, Math.min(18, slot * 0.42));

  const labelStep = Math.max(1, Math.ceil(list.length / 8));
  const bars = list.map((b, idx) => {
    const cx = padL + idx * slot + slot / 2;
    const vH = Math.round(((b.visitors || 0) / maxVal) * plotH);
    const cH = Math.round(((b.clicks || 0) / maxVal) * plotH);
    const showLabel = idx % labelStep === 0 || idx === list.length - 1;
    const tip = `${b.label}: ${b.visitors} visitors, ${b.clicks} clicks, avg scroll ${b.avgScrollPct || 0}%`;
    return `<g>
      <title>${escHtml(tip)}</title>
      <rect x="${(cx - barW - 1).toFixed(1)}" y="${(padT + plotH - vH).toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(1, vH)}" rx="2.5" fill="#181715"/>
      <rect x="${(cx + 1).toFixed(1)}" y="${(padT + plotH - cH).toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(1, cH)}" rx="2.5" fill="#1d5fe6"/>
      ${showLabel ? `<text x="${cx.toFixed(1)}" y="${h - 8}" text-anchor="middle" font-size="10" fill="#737373" font-family="JetBrains Mono, monospace">${escHtml(b.label)}</text>` : ''}
    </g>`;
  }).join('');

  return `<div class="pilot-chart-wrap">
    <div class="pilot-chart-legend">
      <span><strong>${escHtml(windowInfo.label || 'Timeline')}</strong></span>
      <span class="pilot-legend-items">
        <span><i style="background:#181715"></i>Visitors</span>
        <span><i style="background:#1d5fe6"></i>Clicks</span>
      </span>
    </div>
    <svg class="pilot-timeline-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Visitors and clicks over selected time window">
      <line x1="${padL}" y1="${padT + plotH}" x2="${w - padR}" y2="${padT + plotH}" stroke="#e5e5e5" stroke-width="1"/>
      <line x1="${padL}" y1="${padT}" x2="${w - padR}" y2="${padT}" stroke="#f0f0f0" stroke-dasharray="3 3" stroke-width="1"/>
      <text x="4" y="${padT + 4}" font-size="10" fill="#737373" font-family="JetBrains Mono, monospace">${maxVal}</text>
      <text x="4" y="${padT + plotH}" font-size="10" fill="#737373" font-family="JetBrains Mono, monospace">0</text>
      ${bars}
    </svg>
  </div>`;
}

export function pilotEngagementMarkup(traffic = {}) {
  const eng = traffic.engagement || {};
  const funnel = eng.scrollFunnel || {};
  const dwell = Array.isArray(eng.sectionDwell) ? eng.sectionDwell : [];
  const targets = Array.isArray(eng.topClickedTargets) ? eng.topClickedTargets : [];
  const maxSecDwell = Math.max(1, ...dwell.map(d => d.avgSec || 0));
  const maxTargetClicks = Math.max(1, ...targets.map(t => t.clicks || 0));

  return `<div class="pilot-detail-grid">
    <section class="pilot-card">
      <h3>Scroll Depth Funnel &amp; Session Behavior</h3>
      <p class="pilot-sub">How deeply shoppers scroll down hehe.cafe (${funnel.totalSampled || 0} sampled sessions).</p>
      <div class="pilot-kpis-mini">
        <div><span>Avg Time on Site</span><strong>${escHtml(formatDurationSec(eng.avgTimeOnSiteSec || 0))}</strong></div>
        <div><span>Median Dwell</span><strong>${escHtml(formatDurationSec(eng.medianTimeOnSiteSec || 0))}</strong></div>
        <div><span>Avg Max Scroll</span><strong>${eng.avgMaxScrollPct || 0}%</strong></div>
        <div><span>Click Engage Rate</span><strong>${eng.clickRatePct || 0}%</strong></div>
        <div><span>Bag Conversion Rate</span><strong>${eng.bagRatePct || 0}%</strong></div>
        <div><span>Quick Exit (&lt;10s)</span><strong>${eng.quickExitPct || 0}%</strong></div>
      </div>
      <div class="pilot-bars-list">
        ${[
          ['Reached 25% of page', funnel.reached25 || 0],
          ['Reached 50% (Artworks)', funnel.reached50 || 0],
          ['Reached 75% (Story / Reviews)', funnel.reached75 || 0],
          ['Reached 90%+ (Footer)', funnel.reached90 || 0]
        ].map(([label, pct]) => `<div class="pilot-bar-row">
          <div class="pilot-bar-head"><span>${escHtml(label)}</span><strong>${pct}%</strong></div>
          <div class="pilot-bar-track"><div class="pilot-bar-fill" style="width:${pct}%"></div></div>
        </div>`).join('')}
      </div>
    </section>

    <section class="pilot-card">
      <h3>Where Visitors Spend Time (Section Dwell)</h3>
      <p class="pilot-sub">Average &amp; total active attention spent per storefront section.</p>
      ${dwell.length ? `<div class="pilot-bars-list">${dwell.map(d => `<div class="pilot-bar-row">
        <div class="pilot-bar-head"><span><strong>${escHtml(d.label)}</strong> <small class="pilot-muted">(${d.viewers} ${d.viewers === 1 ? 'viewer' : 'viewers'})</small></span><strong>avg ${escHtml(formatDurationSec(d.avgSec))} · ${escHtml(formatDurationSec(d.totalSec))}</strong></div>
        <div class="pilot-bar-track"><div class="pilot-bar-fill is-blue" style="width:${Math.max(4, Math.round((d.avgSec / maxSecDwell) * 100))}%"></div></div>
      </div>`).join('')}</div>` : '<p class="pilot-muted">Waiting for section dwell events…</p>'}
    </section>

    <section class="pilot-card">
      <h3>Exact Clicked Elements &amp; Friction Hotspots</h3>
      <p class="pilot-sub">Every button, artwork link, and control shoppers actually click.</p>
      ${targets.length ? `<div class="pilot-bars-list">${targets.slice(0, 12).map(t => `<div class="pilot-bar-row">
        <div class="pilot-bar-head"><span><strong>${escHtml(t.label)}</strong> <small class="pilot-muted">(${escHtml(t.section)} · #${escHtml(t.page)})</small></span><strong>${t.clicks}</strong></div>
        <div class="pilot-bar-track"><div class="pilot-bar-fill" style="width:${Math.max(4, Math.round((t.clicks / maxTargetClicks) * 100))}%"></div></div>
      </div>`).join('')}</div>` : '<p class="pilot-muted">No element click hotspots recorded in this window yet.</p>'}
    </section>
  </div>`;
}

export function pilotVisitorsLogMarkup(visitorsLog = []) {
  const rows = Array.isArray(visitorsLog) ? visitorsLog : [];
  if (!rows.length) return '<p class="pilot-muted">No visitors recorded in this selected time window.</p>';
  const fmtTime = ts => ts ? new Date(Number(ts)).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
  return `<div class="mgr-table-wrap table-wrap"><table class="mgr-table pilot-log-table">
    <thead><tr><th>Location</th><th>Device</th><th>Source</th><th>Time spent</th><th>Scroll</th><th>Clicks</th><th>Top section</th><th>Last page</th><th>Last seen</th></tr></thead>
    <tbody>${rows.map(v => {
      const loc = [v.city, v.region, v.country].filter(Boolean).join(', ') || 'Unknown';
      return `<tr>
        <td><strong>${escHtml(loc)}</strong>${v.colo ? ` <small class="pilot-muted">(${escHtml(v.colo)})</small>` : ''}${v.isActive ? ' <span class="pilot-active-badge">LIVE</span>' : ''}</td>
        <td>${escHtml(v.device || 'Desktop')}</td>
        <td>${escHtml(v.referrer || 'Direct')}</td>
        <td><strong>${escHtml(formatDurationSec(v.totalTimeSec || 0))}</strong></td>
        <td>${v.maxScrollPct || 0}%</td>
        <td>${v.clickCount || 0}</td>
        <td>${escHtml(v.topSection || '—')}</td>
        <td><code>${escHtml(v.lastPath || '#home')}</code></td>
        <td class="pilot-muted">${escHtml(fmtTime(v.lastSeenAt))}</td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

export function mountNetworkAnalyticsPanel(root, { loadTraffic, mountGlobeFn, resolveCoordsFn, onOpenHeatmap } = {}) {
  if (!root) return { destroy() {} };
  let preset = 'all';
  let device = 'all';
  let fromMs = 0;
  let toMs = 0;
  let fromLocal = toDatetimeLocalValue(Date.now() - 3600000);
  let toLocal = toDatetimeLocalValue(Date.now());
  let paused = false;
  let itemSort = 'clicks';
  let focusedKey = '';
  let data = null;
  let errorMsg = '';
  let inFlight = false;
  let timer = null;
  let globe = null;
  let disposed = false;
  let backoffUntil = 0;

  const esc = escHtml;
  const moneyInr = n => '₹' + (Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

  function renderFrame() {
    if (disposed || !root.isConnected) return;
    const controls = pilotControlsMarkup({ preset, device, fromLocal, toLocal, showHeatmapBtn: true });
    if (!data) {
      root.innerHTML = `<div class="admin-title"><div><p class="eyebrow">Pilot Telemetry · Network &amp; Behavior</p><h1>Network &amp; Pilot Analytics</h1><p>Real-time visitors, Cloudflare globe, scroll depth, section dwell time, item clicks &amp; on-site heatmaps.</p></div></div>${controls}<div class="settings-note">${errorMsg ? `<p class="notice">${esc(errorMsg)}</p>` : '<p class="muted">Loading network &amp; behavioral analytics…</p>'}</div>`;
      bindEvents();
      return;
    }

    const s = data.summary || {};
    const locs = Array.isArray(data.topLocations) ? data.topLocations : [];
    const maxLoc = Math.max(1, ...locs.map(l => l.count || 0));
    const maxRef = Math.max(1, ...(data.topReferrers || []).map(r => r.count || 0));
    const sortedDemand = [...(data.itemDemand || [])].sort((a, b) => itemSort === 'carts'
      ? ((b.inCartCount - a.inCartCount) || (b.clicks - a.clicks))
      : ((b.clicks - a.clicks) || (b.inCartCount - a.inCartCount)));

    root.innerHTML = `<div class="admin-title">
      <div>
        <p class="eyebrow">Pilot Telemetry · Network &amp; Behavior</p>
        <h1>Network &amp; Pilot Analytics</h1>
        <p>Understand where visitors come from, where they click, how deep they scroll, and reduce friction before full launch.</p>
      </div>
      <div class="admin-title-actions">
        <button type="button" class="button outline small" data-na-toggle-live>${paused ? 'Resume live (5s)' : 'Live · 5s (Pause)'}</button>
        <button type="button" class="button outline small" data-na-refresh>Refresh ↻</button>
      </div>
    </div>

    ${controls}

    <div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(145px,1fr));margin-bottom:16px">
      <div class="stat"><span>Active visitors now</span><strong>${s.activeNow || 0}</strong></div>
      <div class="stat"><span>Visitors (${esc(data.window?.label || 'Window')})</span><strong>${s.windowVisitors ?? s.totalVisitors ?? 0}</strong></div>
      <div class="stat"><span>Clicks (${esc(data.window?.label || 'Window')})</span><strong>${s.windowClicks ?? s.totalProductClicks ?? 0}</strong></div>
      <div class="stat"><span>Today (IST)</span><strong>${s.todayVisitors || 0}</strong></div>
      <div class="stat"><span>Yesterday</span><strong>${s.yesterdayVisitors || 0}</strong></div>
      <div class="stat"><span>All-time visitors</span><strong>${s.lifetimeVisitors ?? s.totalVisitors ?? 0}</strong></div>
    </div>

    <section class="settings-note">${pilotTimelineSvgMarkup(data.timeline, data.window)}</section>

    <section class="settings-note admin-analytics-globe-card">
      <div class="pilot-globe-head">
        <div>
          <h2>Visitor Distribution Globe</h2>
          <p class="small muted">Edge geo-location detected automatically · Click any city to focus.</p>
        </div>
        <button type="button" class="button outline small" data-na-reset-globe>Reset globe</button>
      </div>
      <div class="mgr-globe-layout">
        <div id="admin-traffic-globe-host" class="mgr-globe-host"></div>
        <div class="mgr-globe-list-col">
          ${locs.length ? locs.map(l => {
            const key = `${l.label}|${l.country}`;
            return `<button type="button" class="mgr-dist-row ${focusedKey === key ? 'is-active' : ''}" data-na-focus-loc="${esc(key)}">
              <span class="mgr-dist-label"><span class="mgr-dist-name">${esc(l.label)}, ${esc(l.country)}${l.colo ? ` (${esc(l.colo)})` : ''}</span>${l.activeNow > 0 ? ` <small class="pilot-active-badge">${l.activeNow} live</small>` : ''}</span>
              <span class="mgr-bar-track"><span class="mgr-bar-fill is-cf" style="display:block;width:${Math.max(5, Math.round(((l.count || 0) / maxLoc) * 100))}%"></span></span>
              <span class="mgr-dist-count">${l.count || 0}</span>
            </button>`;
          }).join('') : '<p class="muted">No visitor locations recorded in this window.</p>'}
        </div>
      </div>
    </section>

    ${pilotEngagementMarkup(data)}

    <section class="settings-note" style="margin-top:16px">
      <h2>Traffic Sources</h2>
      ${(data.topReferrers || []).length ? `<div class="pilot-bars-list" style="margin-top:10px">${data.topReferrers.map(r => `<div class="pilot-bar-row">
        <div class="pilot-bar-head"><span><strong>${esc(r.source)}</strong></span><strong>${r.count}</strong></div>
        <div class="pilot-bar-track"><div class="pilot-bar-fill is-blue" style="width:${Math.max(4, Math.round((r.count / maxRef) * 100))}%"></div></div>
      </div>`).join('')}</div>` : '<p class="muted">No referrer data in this window.</p>'}
    </section>

    <section class="settings-note">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:10px">
        <div>
          <h2>Most Clicked Artworks &amp; Bags Demand</h2>
          <p class="small muted">Sorted by clicks or how many customers currently have each piece in their bag.</p>
        </div>
        <div class="pilot-chip-group">
          <button type="button" class="pilot-chip ${itemSort === 'clicks' ? 'is-active' : ''}" data-na-demand-sort="clicks">Most clicked</button>
          <button type="button" class="pilot-chip ${itemSort === 'carts' ? 'is-active' : ''}" data-na-demand-sort="carts">Most in bags</button>
        </div>
      </div>
      ${sortedDemand.length ? `<div class="table-wrap"><table class="admin-products-table">
        <thead><tr><th>#</th><th>Artwork</th><th>Clicks</th><th>In bags</th><th>Price</th></tr></thead>
        <tbody>${sortedDemand.slice(0, 20).map((it, idx) => `<tr>
          <td>${idx + 1}</td>
          <td><strong>${esc(it.title)}</strong> <small class="muted">${esc(it.artist)}</small></td>
          <td><strong>${it.clicks}</strong></td>
          <td>${it.inCartCount || 0}</td>
          <td>${esc(moneyInr(it.price))}</td>
        </tr>`).join('')}</tbody>
      </table></div>` : '<p class="muted">No product demand recorded yet.</p>'}
    </section>

    <section class="settings-note">
      <h2>All Visitors Log (${(data.visitorsLog || []).length})</h2>
      <p class="small muted" style="margin-bottom:10px">Detailed session-by-session breakdown of location, device, referrer, time spent, scroll depth, and clicks.</p>
      ${pilotVisitorsLogMarkup(data.visitorsLog)}
    </section>`;

    bindEvents();
    syncGlobe();
  }

  function syncGlobe() {
    const host = root.querySelector('#admin-traffic-globe-host');
    if (!host || typeof mountGlobeFn !== 'function') { globe?.destroy(); globe = null; return; }
    const locs = Array.isArray(data?.topLocations) ? data.topLocations : [];
    if (!globe || !host.contains(globe.getCanvas())) {
      globe?.destroy();
      globe = mountGlobeFn(host, {
        locations: locs,
        mode: 'all',
        onSelect: loc => { focusedKey = `${loc.label}|${loc.country}`; }
      });
    } else {
      globe.setLocations(locs, { mode: 'all', focusedKey });
    }
  }

  function bindEvents() {
    root.querySelectorAll('[data-pilot-action="set-preset"]').forEach(b => b.addEventListener('click', () => {
      preset = b.dataset.preset || 'all';
      void fetchNow();
    }));
    root.querySelectorAll('[data-pilot-action="set-device"]').forEach(b => b.addEventListener('click', () => {
      device = b.dataset.device || 'all';
      void fetchNow();
    }));
    root.querySelector('[data-pilot-action="open-heatmap"]')?.addEventListener('click', () => onOpenHeatmap?.());
    root.querySelector('[data-pilot-custom-form]')?.addEventListener('submit', e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      fromLocal = String(fd.get('from') || '');
      toLocal = String(fd.get('to') || '');
      const f = fromLocal ? Date.parse(fromLocal) : 0;
      const t = toLocal ? Date.parse(toLocal) : 0;
      if (!Number.isFinite(f) || !Number.isFinite(t) || f <= 0 || t <= f) return;
      preset = 'custom';
      fromMs = f;
      toMs = t;
      void fetchNow();
    });
    root.querySelector('[data-na-toggle-live]')?.addEventListener('click', () => {
      paused = !paused;
      renderFrame();
      if (!paused) void fetchNow();
    });
    root.querySelector('[data-na-refresh]')?.addEventListener('click', () => void fetchNow());
    root.querySelector('[data-na-reset-globe]')?.addEventListener('click', () => { focusedKey = ''; globe?.resetView(); });
    root.querySelectorAll('[data-na-demand-sort]').forEach(b => b.addEventListener('click', () => {
      itemSort = b.dataset.naDemandSort === 'carts' ? 'carts' : 'clicks';
      renderFrame();
    }));
    root.querySelectorAll('[data-na-focus-loc]').forEach(b => b.addEventListener('click', () => {
      const key = b.dataset.naFocusLoc || '';
      const loc = (data?.topLocations || []).find(l => `${l.label}|${l.country}` === key);
      const coords = loc && resolveCoordsFn ? resolveCoordsFn(loc) : null;
      focusedKey = key;
      if (coords) globe?.focusLocation(coords.lat, coords.lng, key);
    }));
  }

  async function fetchNow() {
    if (disposed || inFlight || typeof loadTraffic !== 'function') return;
    if (Date.now() < backoffUntil) return;
    inFlight = true;
    try {
      const next = await loadTraffic({ preset, fromMs, toMs, device });
      if (disposed) return;
      data = next;
      errorMsg = '';
      backoffUntil = 0;
      renderFrame();
    } catch (err) {
      if (err?.status === 429 || err?.code === 'resource-exhausted') {
        backoffUntil = Date.now() + 60000;
        errorMsg = 'Live polling paused briefly due to rate limit — retrying automatically in 60s.';
      } else {
        errorMsg = err?.message || 'Could not load network analytics.';
      }
      if (!data) renderFrame();
    } finally {
      inFlight = false;
    }
  }

  renderFrame();
  void fetchNow();
  timer = setInterval(() => {
    if (!paused && typeof document !== 'undefined' && document.visibilityState === 'visible') void fetchNow();
  }, 8000);

  return {
    destroy() {
      disposed = true;
      clearInterval(timer);
      globe?.destroy();
      globe = null;
    }
  };
}

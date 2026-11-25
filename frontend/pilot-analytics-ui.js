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

export function parseDatetimeLocalValue(str = '') {
  const s = String(str || '').trim();
  if (!s) return 0;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(s);
  if (m) {
    const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] || 0), 0);
    return Number.isFinite(dt.getTime()) ? dt.getTime() : 0;
  }
  const parsed = Date.parse(s);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function quickRangeBounds(kind = 'today', nowMs = Date.now()) {
  const dayMs = 86400000;
  const istOffset = 19800000;
  const istNow = new Date(nowMs + istOffset);
  const startOfTodayIst = Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate()) - istOffset;
  if (kind === 'yesterday') {
    const f = startOfTodayIst - dayMs;
    const t = startOfTodayIst - 60000;
    return { fromMs: f, toMs: t, fromLocal: toDatetimeLocalValue(f), toLocal: toDatetimeLocalValue(t) };
  }
  if (kind === '3h') {
    const f = nowMs - 3 * 3600000;
    return { fromMs: f, toMs: nowMs, fromLocal: toDatetimeLocalValue(f), toLocal: toDatetimeLocalValue(nowMs) };
  }
  return { fromMs: startOfTodayIst, toMs: nowMs, fromLocal: toDatetimeLocalValue(startOfTodayIst), toLocal: toDatetimeLocalValue(nowMs) };
}

export function pilotControlsMarkup({
  preset = '24h',
  device = 'all',
  fromLocal = '',
  toLocal = '',
  rangeText = '',
  rangeError = '',
  loading = false,
  showHeatmapBtn = false,
  heatmapHref = '#home?heatmap=1'
} = {}) {
  const fromVal = fromLocal || toDatetimeLocalValue(Date.now() - 3600000);
  const toVal = toLocal || toDatetimeLocalValue(Date.now());
  return `<div class="pilot-filter-bar">
    <div class="pilot-range-banner" id="na-range-banner">
      <span>Showing: <strong>${escHtml(rangeText || (preset === 'all' ? 'All time' : preset))}</strong> · ${escHtml(device === 'all' ? 'All devices' : device)}</span>
      <span class="pilot-chip-group" role="group" aria-label="Quick date ranges">
        <button type="button" class="pilot-chip" data-pilot-action="set-quick" data-quick="3h">Last 3h</button>
        <button type="button" class="pilot-chip" data-pilot-action="set-quick" data-quick="today">Today</button>
        <button type="button" class="pilot-chip" data-pilot-action="set-quick" data-quick="yesterday">Yesterday</button>
      </span>
    </div>
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
    <form class="pilot-custom-range" data-pilot-custom-form novalidate>
      <label class="pilot-range-field"><span>From</span><input type="datetime-local" name="from" value="${escHtml(fromVal)}"></label>
      <label class="pilot-range-field"><span>To</span><input type="datetime-local" name="to" value="${escHtml(toVal)}"></label>
      <button type="submit" data-pilot-apply-btn class="pilot-chip ${preset === 'custom' ? 'is-active' : ''}">${loading ? 'Applying…' : 'Apply custom range'}</button>
    </form>
    <p class="pilot-range-error" data-pilot-range-msg role="alert" ${rangeError ? '' : 'hidden'}>${escHtml(rangeError)}</p>
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

export function pilotFunnelAndBreakdownsMarkup(traffic = {}) {
  const funnel = Array.isArray(traffic.funnel) ? traffic.funnel : [];
  const bd = traffic.breakdowns || {};
  const eng = traffic.engagement || {};
  const renderMiniBars = (title, items) => {
    const list = Array.isArray(items) ? items : [];
    const maxC = Math.max(1, ...list.map(i => i.count || 0));
    return `<div class="pilot-bd-group">
      <h4>${escHtml(title)}</h4>
      ${list.length ? list.slice(0, 6).map(it => `<div class="pilot-bar-row">
        <div class="pilot-bar-head"><span>${escHtml(it.label || 'Unknown')}</span><strong>${it.count || 0}</strong></div>
        <div class="pilot-bar-track"><div class="pilot-bar-fill is-blue" style="width:${Math.max(4, Math.round(((it.count || 0) / maxC) * 100))}%"></div></div>
      </div>`).join('') : '<p class="pilot-muted">No samples yet.</p>'}
    </div>`;
  };
  return `<div class="pilot-detail-grid">
    <section class="pilot-card">
      <h3>Checkout &amp; Purchase Funnel</h3>
      <p class="pilot-sub">Where shoppers progress or drop off in the selected window.</p>
      <div class="pilot-kpis-mini">
        <div><span>Bounce Rate</span><strong>${eng.bounceRatePct || 0}%</strong></div>
        <div><span>Return Visitors</span><strong>${eng.returnVisitorPct || 0}%</strong></div>
        <div><span>Major Clicks</span><strong>${eng.majorClickCount || 0}</strong></div>
        <div><span>Dead / Rage Clicks</span><strong>${eng.deadClickCount || 0} / ${eng.rageClickCount || 0}</strong></div>
      </div>
      <div class="pilot-bars-list">
        ${funnel.length ? funnel.map(st => `<div class="pilot-bar-row">
          <div class="pilot-bar-head"><span><strong>${escHtml(st.label)}</strong></span><strong>${st.count || 0} (${st.pct || 0}%)</strong></div>
          <div class="pilot-bar-track"><div class="pilot-bar-fill" style="width:${Math.max(st.count ? 4 : 0, st.pct || 0)}%"></div></div>
        </div>`).join('') : '<p class="pilot-muted">No funnel data in this window.</p>'}
      </div>
    </section>
    <section class="pilot-card">
      <h3>Environment, UTMs &amp; Entry/Exit Pages</h3>
      <p class="pilot-sub">Browsers, OS, viewports, campaign UTMs, and top landing/exit routes.</p>
      <div class="pilot-bd-grid">
        ${renderMiniBars('Browsers', bd.browsers)}
        ${renderMiniBars('Operating Systems', bd.os)}
        ${renderMiniBars('Viewports', bd.viewports)}
        ${renderMiniBars('Top Entry Pages', bd.entryPages)}
        ${renderMiniBars('Top Exit Pages', bd.exitPages)}
        ${(bd.utmSources || []).length ? renderMiniBars('UTM Campaigns', bd.utmSources) : ''}
      </div>
    </section>
  </div>`;
}

export function pilotRecentClicksMarkup(recentClicks = []) {
  const rows = Array.isArray(recentClicks) ? recentClicks : [];
  if (!rows.length) return '<p class="pilot-muted">No clicks recorded in this selected time window.</p>';
  const fmtClock = ts => ts ? new Date(Number(ts)).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
  return `<div class="pilot-table-scroll table-wrap mgr-table-wrap"><table class="mgr-table pilot-log-table">
    <thead><tr><th>Time</th><th>IP / City</th><th>Signal</th><th>Target &amp; Action</th><th>Section · Page</th></tr></thead>
    <tbody>${rows.slice(0, 40).map(c => {
      const badges = [
        c.major ? '<span class="pilot-badge-major">MAJOR</span>' : '',
        c.rageClick ? '<span class="pilot-badge-rage">RAGE</span>' : '',
        c.deadClick ? '<span class="pilot-badge-dead">DEAD</span>' : ''
      ].filter(Boolean).join(' ') || '<span class="pilot-muted">click</span>';
      return `<tr>
        <td class="pilot-muted">${escHtml(fmtClock(c.at))}</td>
        <td><code>${escHtml(c.ip || '—')}</code><br><small class="pilot-muted">${escHtml([c.city, c.country].filter(Boolean).join(', ') || c.device)}</small></td>
        <td>${badges}</td>
        <td><strong>${escHtml(c.targetLabel || 'Click')}</strong>${c.action ? ` <small class="pilot-muted">[${escHtml(c.action)}]</small>` : ''}</td>
        <td>${escHtml(c.section || 'other')} · <code>#${escHtml(c.page || 'home')}</code></td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

export function pilotVisitorsLogMarkup(visitorsLog = []) {
  const rows = Array.isArray(visitorsLog) ? visitorsLog : [];
  if (!rows.length) return '<p class="pilot-muted">No visitors recorded in this selected time window.</p>';
  const fmtTime = ts => ts ? new Date(Number(ts)).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
  return `<div class="pilot-table-scroll mgr-table-wrap table-wrap"><table class="mgr-table pilot-log-table">
    <thead><tr><th>IP &amp; Network</th><th>Location</th><th>In Time</th><th>Out Time</th><th>Dwell / Span</th><th>Scroll</th><th>Clicks (Major)</th><th>Tech</th><th>Source / UTM</th><th>Entry → Exit</th></tr></thead>
    <tbody>${rows.map(v => {
      const loc = [v.city, v.region, v.country].filter(Boolean).join(', ') || 'Unknown';
      const tech = `${v.device || 'Desktop'} · ${v.browser || '—'} / ${v.os || '—'}${v.viewport ? ` · ${v.viewport}` : ''}`;
      const src = v.utmSource ? `${v.referrer || 'Direct'} · ${v.utmSource}` : (v.referrer || 'Direct');
      const friction = (v.deadClicks || 0) + (v.rageClicks || 0);
      return `<tr>
        <td><code>${escHtml(v.ip || '—')}</code>${v.isp ? `<br><small class="pilot-muted">${escHtml(v.isp)}</small>` : ''}</td>
        <td><strong>${escHtml(loc)}</strong>${v.colo ? ` <small class="pilot-muted">(${escHtml(v.colo)})</small>` : ''}${v.isActive ? ' <span class="pilot-active-badge">LIVE</span>' : (v.exited ? ' <span class="pilot-badge-exited">EXITED</span>' : '')}</td>
        <td class="pilot-muted">${escHtml(fmtTime(v.inTimeAt || v.firstSeenAt))}</td>
        <td class="pilot-muted">${escHtml(fmtTime(v.outTimeAt || v.lastSeenAt))}</td>
        <td><strong>${escHtml(formatDurationSec(v.totalTimeSec || 0))}</strong>${v.spanSec > (v.totalTimeSec || 0) ? `<br><small class="pilot-muted">span ${escHtml(formatDurationSec(v.spanSec))}</small>` : ''}</td>
        <td>${v.maxScrollPct || 0}%</td>
        <td><strong>${v.clickCount || 0}</strong>${v.majorClicks ? ` <small>(${v.majorClicks} major)</small>` : ''}${friction ? ` <span class="pilot-badge-dead">${friction} fric</span>` : ''}</td>
        <td><small>${escHtml(tech)}</small></td>
        <td>${escHtml(src)}</td>
        <td><code>${escHtml(v.entryPath || '#home')}</code> → <code>${escHtml(v.exitPath || v.lastPath || '#home')}</code></td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

export function mountNetworkAnalyticsPanel(root, { loadTraffic, callBackend, mountGlobeFn, resolveCoordsFn, onOpenHeatmap } = {}) {
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
  let storageStatus = null;
  let storageBusy = false;
  let errorMsg = '';
  let rangeError = '';
  let inFlight = false;
  let fetchSeq = 0;
  let timer = null;
  let globe = null;
  let disposed = false;
  let backoffUntil = 0;
  const slotHtml = new Map();

  const esc = escHtml;
  const moneyInr = n => '₹' + (Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

  function mountShell() {
    root.innerHTML = `<div class="admin-title">
      <div>
        <p class="eyebrow">Pilot Telemetry · Network &amp; Behavior</p>
        <h1>Network &amp; Pilot Analytics</h1>
        <p>Understand where visitors come from, where they click, how deep they scroll, and reduce friction before full launch.</p>
      </div>
      <div class="admin-title-actions">
        <button type="button" class="button outline small" id="na-toggle-live" data-na-toggle-live>${paused ? 'Resume live (8s)' : 'Live · 8s (Pause)'}</button>
        <button type="button" class="button outline small" data-na-refresh>Refresh ↻</button>
      </div>
    </div>

    <div id="na-controls"></div>
    <div id="na-status"></div>
    <div id="na-body" hidden>
      <div id="na-kpis"></div>
      <section class="settings-note" id="na-timeline"></section>
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
          <div id="na-dist-list" class="mgr-globe-list-col"></div>
        </div>
      </section>
      <div id="na-engagement"></div>
      <div id="na-funnel"></div>
      <section class="settings-note" id="na-referrers" style="margin-top:16px"></section>
      <section class="settings-note" id="na-clicks"></section>
      <section class="settings-note" id="na-demand"></section>
      <section class="settings-note" id="na-visitors-log"></section>
      <section class="settings-note pilot-storage-card" id="na-storage"></section>
    </div>`;
    renderControls();
  }

  function renderControls({ loading = false } = {}) {
    const ctrlHost = root.querySelector('#na-controls');
    if (!ctrlHost) return;
    ctrlHost.innerHTML = pilotControlsMarkup({
      preset,
      device,
      fromLocal,
      toLocal,
      rangeText: loading ? 'Loading selected range…' : (data?.window?.rangeText || ''),
      rangeError,
      loading,
      showHeatmapBtn: true
    });
  }

  function showRangeError(msg = '') {
    rangeError = msg;
    const msgEl = root.querySelector('[data-pilot-range-msg]');
    if (msgEl) {
      msgEl.textContent = msg;
      msgEl.hidden = !msg;
    } else {
      renderControls();
    }
  }

  function patchSlot(key, selector, nextHtml) {
    const el = root.querySelector(selector);
    if (!el || slotHtml.get(key) === nextHtml) return;
    if (el.contains(document.activeElement) && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
    const wraps = [...el.querySelectorAll('.table-wrap, .mgr-table-wrap')].map((w, idx) => ({ idx, top: w.scrollTop, left: w.scrollLeft }));
    const selfTop = el.scrollTop;
    const selfLeft = el.scrollLeft;
    const winY = window.scrollY;
    el.innerHTML = nextHtml;
    slotHtml.set(key, nextHtml);
    if (selfTop) el.scrollTop = selfTop;
    if (selfLeft) el.scrollLeft = selfLeft;
    const newWraps = el.querySelectorAll('.table-wrap, .mgr-table-wrap');
    for (const w of wraps) {
      if (newWraps[w.idx]) {
        newWraps[w.idx].scrollTop = w.top;
        newWraps[w.idx].scrollLeft = w.left;
      }
    }
    if (Math.abs(window.scrollY - winY) > 2) window.scrollTo(0, winY);
  }

  function patchDataSlots() {
    if (disposed || !root.isConnected) return;
    const toggleBtn = root.querySelector('#na-toggle-live');
    if (toggleBtn) toggleBtn.textContent = paused ? 'Resume live (8s)' : 'Live · 8s (Pause)';

    const statusHtml = !data
      ? `<div class="settings-note">${errorMsg ? `<p class="notice">${esc(errorMsg)}</p>` : '<p class="muted">Loading network &amp; behavioral analytics…</p>'}</div>`
      : (errorMsg ? `<div class="settings-note" style="margin-bottom:12px"><p class="notice">${esc(errorMsg)}</p></div>` : '');
    patchSlot('status', '#na-status', statusHtml);

    const bodyEl = root.querySelector('#na-body');
    if (!data) {
      if (bodyEl) bodyEl.hidden = true;
      return;
    }
    if (bodyEl) bodyEl.hidden = false;

    const s = data.summary || {};
    const locs = Array.isArray(data.topLocations) ? data.topLocations : [];
    const maxLoc = Math.max(1, ...locs.map(l => l.count || 0));
    const maxRef = Math.max(1, ...(data.topReferrers || []).map(r => r.count || 0));
    const sortedDemand = [...(data.itemDemand || [])].sort((a, b) => itemSort === 'carts'
      ? ((b.inCartCount - a.inCartCount) || (b.clicks - a.clicks))
      : ((b.clicks - a.clicks) || (b.inCartCount - a.inCartCount)));

    patchSlot('kpis', '#na-kpis', `<div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(145px,1fr));margin-bottom:16px">
      <div class="stat"><span>Active visitors now</span><strong>${s.activeNow || 0}</strong></div>
      <div class="stat"><span>Visitors (${esc(data.window?.label || 'Window')})</span><strong>${s.windowVisitors ?? s.totalVisitors ?? 0}</strong></div>
      <div class="stat"><span>Page views (Window)</span><strong>${s.totalPageViews || 0}</strong></div>
      <div class="stat"><span>Clicks (${esc(data.window?.label || 'Window')})</span><strong>${s.windowClicks ?? s.totalProductClicks ?? 0}${s.windowMajorClicks ? ` (${s.windowMajorClicks} major)` : ''}</strong></div>
      <div class="stat"><span>Today / Yesterday (IST)</span><strong>${s.todayVisitors || 0} / ${s.yesterdayVisitors || 0}</strong></div>
      <div class="stat"><span>All-time visitors</span><strong>${s.lifetimeVisitors ?? s.totalVisitors ?? 0}</strong></div>
    </div>`);

    const bannerEl = root.querySelector('#na-range-banner strong');
    if (bannerEl && data.window?.rangeText) bannerEl.textContent = data.window.rangeText;
    const applyBtn = root.querySelector('[data-pilot-apply-btn]');
    if (applyBtn) {
      applyBtn.textContent = 'Apply custom range';
      applyBtn.classList.toggle('is-active', preset === 'custom');
    }

    patchSlot('timeline', '#na-timeline', pilotTimelineSvgMarkup(data.timeline, data.window));

    patchSlot('dist', '#na-dist-list', locs.length ? locs.map(l => {
      const key = `${l.label}|${l.country}`;
      return `<button type="button" class="mgr-dist-row ${focusedKey === key ? 'is-active' : ''}" data-na-focus-loc="${esc(key)}">
        <span class="mgr-dist-label"><span class="mgr-dist-name">${esc(l.label)}, ${esc(l.country)}${l.colo ? ` (${esc(l.colo)})` : ''}</span>${l.activeNow > 0 ? ` <small class="pilot-active-badge">${l.activeNow} live</small>` : ''}</span>
        <span class="mgr-bar-track"><span class="mgr-bar-fill is-cf" style="display:block;width:${Math.max(5, Math.round(((l.count || 0) / maxLoc) * 100))}%"></span></span>
        <span class="mgr-dist-count">${l.count || 0}</span>
      </button>`;
    }).join('') : '<p class="muted">No visitor locations recorded in this window.</p>');

    patchSlot('engagement', '#na-engagement', pilotEngagementMarkup(data));
    patchSlot('funnel', '#na-funnel', pilotFunnelAndBreakdownsMarkup(data));

    patchSlot('referrers', '#na-referrers', `<h2>Traffic Sources</h2>
      ${(data.topReferrers || []).length ? `<div class="pilot-bars-list" style="margin-top:10px">${data.topReferrers.map(r => `<div class="pilot-bar-row">
        <div class="pilot-bar-head"><span><strong>${esc(r.source)}</strong></span><strong>${r.count}</strong></div>
        <div class="pilot-bar-track"><div class="pilot-bar-fill is-blue" style="width:${Math.max(4, Math.round((r.count / maxRef) * 100))}%"></div></div>
      </div>`).join('')}</div>` : '<p class="muted">No referrer data in this window.</p>'}`);

    patchSlot('clicks', '#na-clicks', `<h2>Major &amp; Recent Click Feed (${(data.recentClicks || []).length})</h2>
      <p class="small muted" style="margin-bottom:10px">Real-time shopper interactions, major funnel actions, and dead/rage click friction signals.</p>
      ${pilotRecentClicksMarkup(data.recentClicks)}`);

    patchSlot('demand', '#na-demand', `<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:10px">
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
      </table></div>` : '<p class="muted">No product demand recorded yet.</p>'}`);

    patchSlot('visitorsLog', '#na-visitors-log', `<h2>All Visitors Log (${(data.visitorsLog || []).length})</h2>
      <p class="small muted" style="margin-bottom:10px">Session-by-session IP, location, In/Out time, browser/OS/viewport, scroll depth, clicks, and entry → exit path.</p>
      ${pilotVisitorsLogMarkup(data.visitorsLog)}`);

    renderStorageSlot();
    syncGlobe();
  }

  function renderStorageSlot() {
    if (!callBackend) return;
    if (!storageStatus) {
      patchSlot('storage', '#na-storage', `<h2>Storage &amp; Data Transfer Status</h2><p class="muted">Checking D1 and RTDB transfer counts…</p>`);
      return;
    }
    const st = storageStatus;
    const d1Entries = Object.entries(st.d1Counts || {});
    const rtdbEntries = Object.entries(st.rtdbCounts || {});
    const stHtml = `<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <div>
          <h2>Storage &amp; Data Transfer Status</h2>
          <p class="small muted">Active backend: <strong>${esc(st.storage || (st.d1Bound ? 'd1' : 'firestore'))}</strong>${st.state?.allDone ? ' · Historical transfer complete' : ''}</p>
        </div>
        <div class="pilot-chip-group">
          <button type="button" class="pilot-chip" data-na-storage-refresh ${storageBusy ? 'disabled' : ''}>Check counts</button>
          <button type="button" class="pilot-chip is-active" data-na-storage-run ${storageBusy || !st.d1Bound ? 'disabled' : ''}>Run transfer now</button>
        </div>
      </div>
      ${st.warning ? `<p class="notice" style="margin:8px 0 0">${esc(st.warning)}</p>` : ''}
      <div class="pilot-storage-grid">
        <div><h4>D1 Tables</h4>${d1Entries.length ? d1Entries.map(([k, v]) => `<div><span>${esc(k)}</span><strong>${v}</strong></div>`).join('') : '<p class="pilot-muted">No D1 rows reported yet (D1 binding not active).</p>'}</div>
        <div><h4>RTDB Telemetry &amp; Bags</h4>${rtdbEntries.length ? rtdbEntries.map(([k, v]) => `<div><span>${esc(k)}</span><strong>${v === null ? '—' : v}</strong></div>`).join('') : '<p class="pilot-muted">RTDB unavailable.</p>'}</div>
      </div>`;
    patchSlot('storage', '#na-storage', stHtml);
  }

  async function refreshStorageStatus({ runTransfer = false } = {}) {
    if (!callBackend || storageBusy || disposed) return;
    storageBusy = true;
    renderStorageSlot();
    try {
      storageStatus = await callBackend('migrateToD1', runTransfer ? { mode: 'both', overwrite: false, includeTracking: true, respectState: false } : { mode: 'status' });
      if (runTransfer) storageStatus = await callBackend('migrateToD1', { mode: 'status' });
    } catch (err) {
      storageStatus = { storage: 'unknown', d1Bound: false, d1Counts: {}, rtdbCounts: {}, warning: err?.message || 'Could not inspect transfer status.' };
    } finally {
      storageBusy = false;
      renderStorageSlot();
    }
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

  const onClick = event => {
    const t = event.target;
    if (!t || !root.contains(t)) return;
    const quickBtn = t.closest('[data-pilot-action="set-quick"]');
    if (quickBtn) {
      const b = quickRangeBounds(quickBtn.dataset.quick || 'today');
      rangeError = '';
      preset = 'custom';
      fromMs = b.fromMs;
      toMs = b.toMs;
      fromLocal = b.fromLocal;
      toLocal = b.toLocal;
      renderControls({ loading: true });
      void fetchNow({ manual: true });
      return;
    }
    const presetBtn = t.closest('[data-pilot-action="set-preset"]');
    if (presetBtn) {
      rangeError = '';
      preset = presetBtn.dataset.preset || 'all';
      if (preset !== 'custom') { fromMs = 0; toMs = 0; }
      renderControls({ loading: true });
      void fetchNow({ manual: true });
      return;
    }
    const devBtn = t.closest('[data-pilot-action="set-device"]');
    if (devBtn) {
      rangeError = '';
      device = devBtn.dataset.device || 'all';
      renderControls({ loading: true });
      void fetchNow({ manual: true });
      return;
    }
    if (t.closest('[data-na-storage-refresh]')) {
      void refreshStorageStatus({ runTransfer: false });
      return;
    }
    if (t.closest('[data-na-storage-run]')) {
      void refreshStorageStatus({ runTransfer: true });
      return;
    }
    if (t.closest('[data-pilot-action="open-heatmap"]')) {
      onOpenHeatmap?.();
      return;
    }
    if (t.closest('[data-na-toggle-live]')) {
      paused = !paused;
      const btn = root.querySelector('#na-toggle-live');
      if (btn) btn.textContent = paused ? 'Resume live (8s)' : 'Live · 8s (Pause)';
      if (!paused) void fetchNow({ manual: true });
      return;
    }
    if (t.closest('[data-na-refresh]')) {
      void fetchNow({ manual: true });
      return;
    }
    if (t.closest('[data-na-reset-globe]')) {
      focusedKey = '';
      globe?.resetView();
      return;
    }
    const sortBtn = t.closest('[data-na-demand-sort]');
    if (sortBtn) {
      itemSort = sortBtn.dataset.naDemandSort === 'carts' ? 'carts' : 'clicks';
      patchDataSlots();
      return;
    }
    const locBtn = t.closest('[data-na-focus-loc]');
    if (locBtn) {
      const key = locBtn.dataset.naFocusLoc || '';
      const loc = (data?.topLocations || []).find(l => `${l.label}|${l.country}` === key);
      const coords = loc && resolveCoordsFn ? resolveCoordsFn(loc) : null;
      focusedKey = key;
      root.querySelectorAll('#na-dist-list .mgr-dist-row').forEach(el => el.classList.toggle('is-active', el.dataset.naFocusLoc === key));
      if (coords) globe?.focusLocation(coords.lat, coords.lng, key);
    }
  };

  const onRangeInput = event => {
    const inp = event.target;
    if (!inp?.closest?.('[data-pilot-custom-form]')) return;
    if (inp.name === 'from') fromLocal = String(inp.value || '');
    if (inp.name === 'to') toLocal = String(inp.value || '');
    if (rangeError) showRangeError('');
  };

  const onSubmit = event => {
    const form = event.target?.closest?.('[data-pilot-custom-form]');
    if (!form || !root.contains(form)) return;
    event.preventDefault();
    fromLocal = String(form.elements.from?.value || '');
    toLocal = String(form.elements.to?.value || '');
    const f = parseDatetimeLocalValue(fromLocal);
    let t = parseDatetimeLocalValue(toLocal);
    if (!f || !t) {
      showRangeError('Select both a valid From and To date/time first.');
      return;
    }
    if (t < f) {
      showRangeError('End time (To) must be after Start time (From).');
      return;
    }
    if (t === f) t = f + 60000;
    rangeError = '';
    preset = 'custom';
    fromMs = f;
    toMs = t;
    renderControls({ loading: true });
    void fetchNow({ manual: true });
  };

  async function fetchNow({ manual = false } = {}) {
    if (disposed || typeof loadTraffic !== 'function') return;
    if (!manual && inFlight) return;
    if (!manual && Date.now() < backoffUntil) return;
    if (!manual && root.querySelector('[data-pilot-custom-form]')?.contains(document.activeElement)) return;
    const mySeq = ++fetchSeq;
    inFlight = true;
    try {
      const next = await loadTraffic({ preset, fromMs, toMs, device });
      if (disposed || mySeq !== fetchSeq) return;
      data = next;
      errorMsg = '';
      backoffUntil = 0;
      patchDataSlots();
    } catch (err) {
      if (disposed || mySeq !== fetchSeq) return;
      if (err?.status === 429 || err?.code === 'resource-exhausted') {
        backoffUntil = Date.now() + 60000;
        errorMsg = 'Live polling paused briefly due to rate limit — retrying automatically in 60s.';
      } else {
        errorMsg = err?.message || 'Could not load network analytics.';
      }
      if (!data) patchDataSlots();
    } finally {
      if (mySeq === fetchSeq) {
        inFlight = false;
        const applyBtn = root.querySelector('[data-pilot-apply-btn]');
        if (applyBtn && applyBtn.textContent === 'Applying…') applyBtn.textContent = 'Apply custom range';
      }
    }
  }

  mountShell();
  root.addEventListener('click', onClick);
  root.addEventListener('input', onRangeInput);
  root.addEventListener('change', onRangeInput);
  root.addEventListener('submit', onSubmit);
  patchDataSlots();
  void fetchNow({ manual: true });
  void refreshStorageStatus({ runTransfer: false });
  timer = setInterval(() => {
    if (!paused && typeof document !== 'undefined' && document.visibilityState === 'visible') void fetchNow();
  }, 8000);

  return {
    destroy() {
      disposed = true;
      clearInterval(timer);
      root.removeEventListener('click', onClick);
      root.removeEventListener('input', onRangeInput);
      root.removeEventListener('change', onRangeInput);
      root.removeEventListener('submit', onSubmit);
      globe?.destroy();
      globe = null;
    }
  };
}

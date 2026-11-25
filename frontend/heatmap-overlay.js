// Admin-only live on-site Heatmap Overlay (click density canvas + scroll depth fold lines + section dwell badges).

function buildThermalLut() {
  const stops = [
    [0, 0, 0, 0, 0],
    [0.15, 29, 95, 230, 115],
    [0.4, 16, 185, 129, 155],
    [0.65, 250, 204, 21, 185],
    [0.85, 249, 115, 22, 210],
    [1.0, 225, 29, 72, 235]
  ];
  const lut = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let s0 = stops[0], s1 = stops[stops.length - 1];
    for (let j = 0; j < stops.length - 1; j++) {
      if (t >= stops[j][0] && t <= stops[j + 1][0]) { s0 = stops[j]; s1 = stops[j + 1]; break; }
    }
    const span = Math.max(1e-5, s1[0] - s0[0]);
    const k = (t - s0[0]) / span;
    lut[i * 4] = Math.round(s0[1] + (s1[1] - s0[1]) * k);
    lut[i * 4 + 1] = Math.round(s0[2] + (s1[2] - s0[2]) * k);
    lut[i * 4 + 2] = Math.round(s0[3] + (s1[3] - s0[3]) * k);
    lut[i * 4 + 3] = Math.round(s0[4] + (s1[4] - s0[4]) * k);
  }
  return lut;
}

const HEATMAP_SECTION_ELS = [
  ['hero', '[data-hero-banner]', 'Hero Banner'],
  ['artworks', '#artworks', 'Artworks Grid'],
  ['product', '.product-immersive-hero', 'Artwork Detail'],
  ['checkout', '#checkout-form', 'Checkout'],
  ['story', '.story-block', 'Brand Story'],
  ['reviews', '#reviews, .reviews-section', 'Buyer Reviews'],
  ['footer', '#footer', 'Footer']
];

export function mountHeatmapOverlay({ isAdmin, getRoute, fetchTraffic }) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { isActive: () => false, open() {}, close() {}, sync() {}, destroy() {} };
  }

  let active = false;
  let preset = '7d';
  let device = 'all';
  let showClicks = true;
  let showScroll = true;
  let showSections = true;
  let hudCollapsed = typeof window !== 'undefined' ? window.innerWidth <= 640 : false;
  let trafficData = null;
  let layerRoot = null;
  let toggleBtn = null;
  let hudEl = null;
  let rafDraw = 0;
  const lut = buildThermalLut();

  function pageKey() {
    const r = getRoute?.() || { page: 'home' };
    return r.page || 'home';
  }

  function ensureToggle() {
    if (!isAdmin?.() || pageKey() === 'admin') {
      if (toggleBtn) toggleBtn.hidden = true;
      return;
    }
    if (!toggleBtn || !toggleBtn.isConnected) {
      toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.className = 'heatmap-fab';
      toggleBtn.textContent = 'Heatmap';
      toggleBtn.addEventListener('click', () => {
        if (active) close();
        else void open();
      });
      document.body.append(toggleBtn);
    }
    toggleBtn.hidden = active;
  }

  function drawHeatmapLayer() {
    if (!active || !layerRoot) return;
    layerRoot.innerHTML = '';
    const pg = pageKey();
    const byPage = trafficData?.heatmap?.byPage || {};
    const pageData = byPage[pg] || { totalClicks: 0, clicks: [], scrollDepth: {}, sectionDwell: {} };
    const docEl = document.documentElement;
    const docW = Math.max(docEl?.scrollWidth || 0, window.innerWidth || 1);
    const docH = Math.max(docEl?.scrollHeight || 0, document.body?.scrollHeight || 0, window.innerHeight || 1);
    layerRoot.style.width = `${docW}px`;
    layerRoot.style.height = `${docH}px`;

    if (showClicks) {
      const pts = (pageData.clicks || []).filter(c => device === 'all' || c.device === device);
      if (pts.length) {
        const canvas = document.createElement('canvas');
        canvas.className = 'heatmap-canvas';
        const scale = 0.5;
        const cw = Math.max(160, Math.round(docW * scale));
        const ch = Math.max(160, Math.round(Math.min(12000, docH) * scale));
        canvas.width = cw;
        canvas.height = ch;
        canvas.style.width = `${docW}px`;
        canvas.style.height = `${docH}px`;
        const ctx = canvas.getContext('2d');
        const maxCnt = Math.max(1, ...pts.map(p => p.count || 1));
        const rad = Math.max(18, Math.round(36 * scale));
        for (const pt of pts) {
          const px = (Number(pt.xPct) / 100) * cw;
          const py = (Number(pt.yPct) / 100) * ch;
          const weight = Math.max(0.25, Math.min(1, (pt.count || 1) / Math.max(2, maxCnt)));
          const g = ctx.createRadialGradient(px, py, 0, px, py, rad);
          g.addColorStop(0, `rgba(0,0,0,${weight.toFixed(2)})`);
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(px, py, rad, 0, Math.PI * 2);
          ctx.fill();
        }
        const img = ctx.getImageData(0, 0, cw, ch);
        const pxData = img.data;
        for (let i = 0; i < pxData.length; i += 4) {
          const a = pxData[i + 3];
          if (!a) continue;
          const base = a * 4;
          pxData[i] = lut[base];
          pxData[i + 1] = lut[base + 1];
          pxData[i + 2] = lut[base + 2];
          pxData[i + 3] = lut[base + 3];
        }
        ctx.putImageData(img, 0, 0);
        layerRoot.append(canvas);
      }
    }

    if (showScroll) {
      const sd = pageData.scrollDepth || {};
      for (const [pct, reached] of [[25, sd.r25 || 0], [50, sd.r50 || 0], [75, sd.r75 || 0], [90, sd.r90 || 0]]) {
        const line = document.createElement('div');
        line.className = 'heatmap-fold-line';
        line.style.top = `${Math.round((pct / 100) * docH)}px`;
        line.innerHTML = `<span>${pct}% page depth · <strong>${reached}%</strong> of visitors reached here</span>`;
        layerRoot.append(line);
      }
    }

    if (showSections) {
      const sd = pageData.sectionDwell || {};
      for (const [secKey, sel, title] of HEATMAP_SECTION_ELS) {
        const node = document.querySelector(sel);
        if (!node || node.hidden) continue;
        const rect = node.getBoundingClientRect();
        if (rect.height < 20) continue;
        const stats = sd[secKey] || { avgSec: 0, clicks: 0, viewers: 0 };
        const badge = document.createElement('div');
        badge.className = 'heatmap-section-badge';
        badge.style.top = `${Math.max(8, Math.round(rect.top + (window.scrollY || 0) + 10))}px`;
        badge.style.right = '12px';
        badge.innerHTML = `<strong>${title}</strong><span>Avg ${stats.avgSec || 0}s · ${stats.clicks || 0} clicks</span>`;
        layerRoot.append(badge);
      }
    }
  }

  function renderHud() {
    if (!active) return;
    if (!hudEl || !hudEl.isConnected) {
      hudEl = document.createElement('div');
      hudEl.className = 'heatmap-hud';
      document.body.append(hudEl);
    }
    const pg = pageKey();
    const pageData = trafficData?.heatmap?.byPage?.[pg] || { totalClicks: 0, scrollDepth: {} };
    hudEl.innerHTML = `<div class="heatmap-hud-row">
      <strong class="heatmap-hud-title">Live Heatmap · #${pg} (${pageData.totalClicks || 0} clicks)</strong>
      <div class="heatmap-hud-actions">
        <button type="button" class="heatmap-hud-toggle" data-hm-toggle>${hudCollapsed ? 'Controls ▾' : 'Hide ▴'}</button>
        <button type="button" class="heatmap-hud-close" data-hm-close>Close ×</button>
      </div>
    </div>
    <div class="heatmap-hud-body" ${hudCollapsed ? 'hidden' : ''}>
      <div class="heatmap-hud-controls">
        ${[['1h', '1h'], ['5h', '5h'], ['24h', '24h'], ['7d', '7d'], ['30d', '30d'], ['all', 'All']].map(([k, l]) => `<button type="button" data-hm-preset="${k}" class="${preset === k ? 'is-on' : ''}">${l}</button>`).join('')}
      </div>
      <div class="heatmap-hud-controls">
        ${[['all', 'All'], ['Desktop', 'Desk'], ['Mobile', 'Mob']].map(([k, l]) => `<button type="button" data-hm-device="${k}" class="${device === k ? 'is-on' : ''}">${l}</button>`).join('')}
      </div>
      <div class="heatmap-hud-checks">
        <label><input type="checkbox" data-hm-layer="clicks" ${showClicks ? 'checked' : ''}>Clicks</label>
        <label><input type="checkbox" data-hm-layer="scroll" ${showScroll ? 'checked' : ''}>Scroll</label>
        <label><input type="checkbox" data-hm-layer="sections" ${showSections ? 'checked' : ''}>Sections</label>
      </div>
    </div>`;
    hudEl.querySelector('[data-hm-toggle]')?.addEventListener('click', () => { hudCollapsed = !hudCollapsed; renderHud(); });
    hudEl.querySelectorAll('[data-hm-preset]').forEach(b => b.addEventListener('click', () => { preset = b.dataset.hmPreset; void refresh(); }));
    hudEl.querySelectorAll('[data-hm-device]').forEach(b => b.addEventListener('click', () => { device = b.dataset.hmDevice; void refresh(); }));
    hudEl.querySelectorAll('[data-hm-layer]').forEach(cb => cb.addEventListener('change', () => {
      if (cb.dataset.hmLayer === 'clicks') showClicks = cb.checked;
      if (cb.dataset.hmLayer === 'scroll') showScroll = cb.checked;
      if (cb.dataset.hmLayer === 'sections') showSections = cb.checked;
      drawHeatmapLayer();
    }));
    hudEl.querySelector('[data-hm-close]')?.addEventListener('click', close);
  }

  async function refresh() {
    if (!active || !isAdmin?.()) return;
    renderHud();
    try {
      trafficData = await fetchTraffic?.({ preset, device });
    } catch {}
    drawHeatmapLayer();
    renderHud();
  }

  async function open() {
    if (!isAdmin?.() || pageKey() === 'admin') return;
    active = true;
    if (!layerRoot || !layerRoot.isConnected) {
      layerRoot = document.createElement('div');
      layerRoot.className = 'heatmap-overlay-root';
      document.body.append(layerRoot);
    }
    layerRoot.hidden = false;
    ensureToggle();
    await refresh();
  }

  function close() {
    active = false;
    if (layerRoot) { layerRoot.innerHTML = ''; layerRoot.hidden = true; }
    if (hudEl) { hudEl.remove(); hudEl = null; }
    ensureToggle();
  }

  function scheduleRedraw() {
    if (!active) return;
    cancelAnimationFrame(rafDraw);
    rafDraw = requestAnimationFrame(drawHeatmapLayer);
  }

  window.addEventListener('resize', scheduleRedraw, { passive: true });
  window.addEventListener('hashchange', () => {
    if (pageKey() === 'admin' && active) close();
    else if (active) scheduleRedraw();
    ensureToggle();
  });

  return {
    isActive: () => active,
    open,
    close,
    sync() {
      ensureToggle();
      if (active) { renderHud(); scheduleRedraw(); }
    },
    destroy() {
      close();
      toggleBtn?.remove();
      toggleBtn = null;
      layerRoot?.remove();
      layerRoot = null;
    }
  };
}

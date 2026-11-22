const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => '₹' + (Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const shortMoney = n => {
  const v = Number(n) || 0;
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(1)}k`;
  return `₹${Math.round(v)}`;
};
const fmtDate = ts => ts ? new Date(Number(ts)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export function revenueTrendChartMarkup(monthlyTrend = []) {
  const rows = Array.isArray(monthlyTrend) ? monthlyTrend : [];
  if (!rows.length) {
    return '<p class="mgr-muted">Not enough monthly data yet.</p>';
  }
  const maxVal = Math.max(500, ...rows.map(r => Math.max(Number(r.siteRevenue) || 0, Number(r.cafeRevenue) || 0, (Number(r.siteRevenue) || 0) + (Number(r.cafeRevenue) || 0))));
  const W = 640, H = 224, padL = 56, padR = 16, padT = 16, padB = 34;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const groupW = plotW / rows.length;
  const barW = Math.max(12, Math.min(24, groupW * 0.28));
  const yTicks = [0, 0.25, 0.5, 0.75, 1];

  const gridLines = yTicks.map(t => {
    const val = maxVal * t;
    const y = (padT + plotH - t * plotH).toFixed(1);
    return `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#f0f0f0" stroke-dasharray="${t === 0 ? '' : '3 3'}"/>
      <text x="${padL - 8}" y="${Number(y) + 4}" text-anchor="end" font-size="10" font-family="JetBrains Mono, monospace" fill="#737373">${esc(shortMoney(val))}</text>`;
  }).join('');

  const bars = rows.map((r, i) => {
    const siteRev = Number(r.siteRevenue) || 0;
    const cafeRev = Number(r.cafeRevenue) || 0;
    const cx = padL + groupW * (i + 0.5);
    const siteH = Math.max(siteRev > 0 ? 3 : 0, (siteRev / maxVal) * plotH);
    const cafeH = Math.max(cafeRev > 0 ? 3 : 0, (cafeRev / maxVal) * plotH);
    const siteY = padT + plotH - siteH;
    const cafeY = padT + plotH - cafeH;
    return `<g>
      <rect x="${(cx - barW - 2).toFixed(1)}" y="${siteY.toFixed(1)}" width="${barW}" height="${siteH.toFixed(1)}" rx="4" fill="#059669">
        <title>${esc(r.label)} · Online (hehe.cafe): ${esc(money(siteRev))}</title>
      </rect>
      <rect x="${(cx + 2).toFixed(1)}" y="${cafeY.toFixed(1)}" width="${barW}" height="${cafeH.toFixed(1)}" rx="4" fill="#4f46e5">
        <title>${esc(r.label)} · Partner Cafés: ${esc(money(cafeRev))}</title>
      </rect>
      <text x="${cx.toFixed(1)}" y="${H - 12}" text-anchor="middle" font-size="11" font-family="Inter, sans-serif" font-weight="500" fill="#525252">${esc(r.label)}</text>
    </g>`;
  }).join('');

  return `<div class="mgr-chart-head">
      <div class="mgr-legend">
        <span><i style="background:#059669"></i>Online (hehe.cafe)</span>
        <span><i style="background:#4f46e5"></i>Partner Cafés</span>
      </div>
    </div>
    <svg class="mgr-svg-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="6-month revenue split between hehe.cafe online store and partner cafes">
      ${gridLines}
      ${bars}
    </svg>`;
}

export function genreVelocityMatrixMarkup(genres = []) {
  const list = Array.isArray(genres) ? genres : [];
  if (!list.length) return '<p class="mgr-muted">No genre activity recorded yet.</p>';
  const maxStockMove = Math.max(1, ...list.map(g => (Number(g.totalUnits) || 0) + (Number(g.activeCafeUnits) || 0) + (Number(g.returnedUnits) || 0)));
  return `<div class="mgr-velocity-list">${list.map(g => {
    const sold = Number(g.totalUnits) || 0;
    const active = Number(g.activeCafeUnits) || 0;
    const ret = Number(g.returnedUnits) || 0;
    const tag = g.velocityTag === 'fast'
      ? '<span class="mgr-vel-badge is-fast">Fast mover</span>'
      : g.velocityTag === 'slow'
        ? '<span class="mgr-vel-badge is-slow">Slow / high return</span>'
        : '<span class="mgr-vel-badge">Steady</span>';
    const wSold = (sold / maxStockMove) * 100;
    const wActive = (active / maxStockMove) * 100;
    const wRet = (ret / maxStockMove) * 100;
    return `<div class="mgr-velocity-row">
      <div class="mgr-velocity-title">
        <div><strong>${esc(g.genre)}</strong> ${tag}</div>
        <div class="mgr-velocity-metrics">
          <span><strong>${sold}</strong> sold (${g.siteUnits} online · ${g.cafeUnits} café)</span>
          <span><strong>${money(g.totalRevenue)}</strong></span>
          <span>${active} on shelf</span>
          <span>${ret} returned (${Number(g.returnRatePct) || 0}%)</span>
          <span>Sell-through <strong>${Number(g.sellThroughPct) || 0}%</strong></span>
          ${g.avgDaysAtCafe !== null && g.avgDaysAtCafe !== undefined ? `<span>Avg <strong>${g.avgDaysAtCafe}d</strong> at café</span>` : ''}
        </div>
      </div>
      <div class="mgr-stack-track" title="Sold: ${sold} · At cafés: ${active} · Returned unsold: ${ret}">
        ${sold ? `<span class="is-sold" style="width:${wSold.toFixed(1)}%"></span>` : ''}
        ${active ? `<span class="is-active" style="width:${wActive.toFixed(1)}%"></span>` : ''}
        ${ret ? `<span class="is-ret" style="width:${wRet.toFixed(1)}%"></span>` : ''}
      </div>
    </div>`;
  }).join('')}</div>
  <div class="mgr-legend" style="margin-top:12px">
    <span><i style="background:#059669"></i>Sold</span>
    <span><i style="background:#4f46e5"></i>Active at cafés</span>
    <span><i style="background:#e11d48"></i>Returned unsold</span>
  </div>`;
}

export function cafeComparisonChartMarkup(cafes = []) {
  const list = Array.isArray(cafes) ? cafes : [];
  if (!list.length) return '<p class="mgr-muted">Add partner cafés and assign stock to compare performance.</p>';
  const maxPlaced = Math.max(1, ...list.map(c => (Number(c.totalPlaced) || 0)));
  return `<div class="mgr-velocity-list">${list.map(c => {
    const sold = Number(c.soldUnits) || 0;
    const active = Number(c.activeStock) || 0;
    const ret = Number(c.returnedUnits) || 0;
    return `<div class="mgr-velocity-row">
      <div class="mgr-velocity-title">
        <div>
          <button type="button" class="mgr-link" style="font-weight:600;color:#171717" data-action="open-cafe-detail" data-id="${esc(c.cafeId)}">${esc(c.cafeName)}</button>
          <small class="mgr-muted"> ${esc(c.city || '')} · ${Number(c.commissionPct) || 0}% fee</small>
        </div>
        <div class="mgr-velocity-metrics">
          <span>Sold <strong>${sold}</strong> (${money(c.soldRevenue)})</span>
          <span>On shelf <strong>${active}</strong></span>
          <span>Returned <strong>${ret}</strong> (${Number(c.returnRatePct) || 0}%)</span>
          ${c.avgDaysToSell !== null && c.avgDaysToSell !== undefined ? `<span>Avg sell time <strong>${c.avgDaysToSell}d</strong></span>` : ''}
        </div>
      </div>
      <div class="mgr-stack-track">
        ${sold ? `<span class="is-sold" style="width:${((sold / maxPlaced) * 100).toFixed(1)}%"></span>` : ''}
        ${active ? `<span class="is-active" style="width:${((active / maxPlaced) * 100).toFixed(1)}%"></span>` : ''}
        ${ret ? `<span class="is-ret" style="width:${((ret / maxPlaced) * 100).toFixed(1)}%"></span>` : ''}
      </div>
    </div>`;
  }).join('')}</div>`;
}

export function storeGenreStatsMarkup(genreStats = []) {
  const list = Array.isArray(genreStats) ? genreStats : [];
  if (!list.length) return '<p class="mgr-muted">No stock dispatched to this café yet.</p>';
  const maxSent = Math.max(1, ...list.map(g => Number(g.sent) || 0));
  return `<div class="mgr-velocity-list">${list.map(g => {
    const badge = g.velocityTag === 'fast'
      ? '<span class="mgr-vel-badge is-fast">Top mover</span>'
      : g.velocityTag === 'slow'
        ? '<span class="mgr-vel-badge is-slow">High return</span>'
        : '<span class="mgr-vel-badge">Steady</span>';
    return `<div class="mgr-velocity-row">
      <div class="mgr-velocity-title">
        <div><strong>${esc(g.genre)}</strong> ${badge}</div>
        <div class="mgr-velocity-metrics">
          <span><strong>${g.sold}</strong>/${g.sent} sold (<strong>${g.sellThroughPct}%</strong>)</span>
          <span>${money(g.revenue)}</span>
          <span>${g.active} shelf · ${g.returned} returned</span>
        </div>
      </div>
      <div class="mgr-stack-track">
        ${g.sold ? `<span class="is-sold" style="width:${((g.sold / maxSent) * 100).toFixed(1)}%"></span>` : ''}
        ${g.active ? `<span class="is-active" style="width:${((g.active / maxSent) * 100).toFixed(1)}%"></span>` : ''}
        ${g.returned ? `<span class="is-ret" style="width:${((g.returned / maxSent) * 100).toFixed(1)}%"></span>` : ''}
      </div>
    </div>`;
  }).join('')}</div>`;
}

export function storePriceBandsMarkup(priceBands = []) {
  const bands = Array.isArray(priceBands) ? priceBands : [];
  if (!bands.some(b => (Number(b.sent) || 0) > 0)) return '<p class="mgr-muted">No priced pieces recorded at this café yet.</p>';
  return `<div class="mgr-velocity-list">${bands.map(b => {
    const sent = Number(b.sent) || 0;
    const sold = Number(b.sold) || 0;
    const active = Number(b.active) || 0;
    const ret = Number(b.returned) || 0;
    return `<div class="mgr-velocity-row">
      <div class="mgr-velocity-title">
        <div><strong>${esc(b.label)}</strong></div>
        <div class="mgr-velocity-metrics">
          <span><strong>${sold}</strong>/${sent} sold (<strong>${b.sellThroughPct || 0}%</strong>)</span>
          <span>${active} active · ${ret} returned</span>
        </div>
      </div>
      <div class="mgr-stack-track">
        ${sent ? `
          ${sold ? `<span class="is-sold" style="width:${((sold / sent) * 100).toFixed(1)}%"></span>` : ''}
          ${active ? `<span class="is-active" style="width:${((active / sent) * 100).toFixed(1)}%"></span>` : ''}
          ${ret ? `<span class="is-ret" style="width:${((ret / sent) * 100).toFixed(1)}%"></span>` : ''}
        ` : ''}
      </div>
    </div>`;
  }).join('')}</div>`;
}

function openPrintHtml(title, bodyHtml) {
  const win = typeof window !== 'undefined' ? window.open('', '_blank', 'width=900,height=960') : null;
  if (!win) return false;
  win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${esc(title)}</title>
  <style>
    body{font-family:'Inter',Arial,sans-serif;color:#171717;margin:0;padding:28px 34px;font-size:13px;line-height:1.45}
    .print-bar{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#f5f5f4;border:1px solid #e5e5e5;border-radius:8px;margin-bottom:22px}
    .print-btn{background:#171717;color:#fff;border:0;border-radius:7px;padding:8px 16px;font-weight:600;cursor:pointer}
    header{display:flex;justify-content:space-between;gap:20px;border-bottom:2px solid #171717;padding-bottom:14px;margin-bottom:18px}
    h1{margin:4px 0 0;font-size:20px}
    .eyebrow{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#737373;font-weight:600}
    .meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:18px;background:#fafafa;padding:12px 14px;border-radius:8px;border:1px solid #e5e5e5}
    .kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:18px}
    .kpi{border:1px solid #e5e5e5;border-radius:8px;padding:10px}
    .kpi span{display:block;font-size:11px;color:#737373}
    .kpi strong{display:block;font-size:15px;margin-top:4px}
    table{width:100%;border-collapse:collapse;margin-bottom:20px}
    th,td{padding:8px 10px;border-bottom:1px solid #e5e5e5;text-align:left}
    th{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#737373;background:#fafafa}
    code{font-family:monospace;font-size:12px;background:#f5f5f4;padding:2px 5px;border-radius:4px}
    .signatures{display:grid;grid-template-columns:1fr 1fr;gap:36px;margin-top:34px}
    .sig-line{border-top:1px solid #171717;padding-top:6px;margin-top:40px;font-size:12px}
    @media print{.print-bar{display:none!important}body{padding:14px}}
  </style>
</head>
<body>
  <div class="print-bar">
    <span>Print preview · Ready for physical challan or Save as PDF</span>
    <button class="print-btn" onclick="window.print()">Print / Save PDF</button>
  </div>
  ${bodyHtml}
</body>
</html>`);
  win.document.close();
  return true;
}

export function openPrintableChallan({ type = 'handover', cafe = {}, items = [], batchCode = '', studioName = 'hehe.cafe' } = {}) {
  const isReturn = type === 'return';
  const docTitle = isReturn ? 'UNSOLD STOCK RETURN RECEIPT' : 'CONSIGNMENT HANDOVER CHALLAN';
  const refCode = batchCode || `CH-${Date.now().toString(36).toUpperCase().slice(-6)}`;
  const totalValue = items.reduce((n, i) => n + (Number(i.price) || 0), 0);
  const bodyHtml = `<header>
      <div>
        <div class="eyebrow">${esc(studioName)} · Retail Consignment</div>
        <h1>${esc(docTitle)}</h1>
      </div>
      <div style="text-align:right">
        <div><strong>Challan / Batch:</strong> ${esc(refCode)}</div>
        <div><strong>Date:</strong> ${esc(fmtDate(Date.now()))}</div>
      </div>
    </header>
    <div class="meta-grid">
      <div>
        <div class="eyebrow">Partner Café</div>
        <strong>${esc(cafe.name || 'Partner Café')}</strong><br>
        ${esc([cafe.area, cafe.city].filter(Boolean).join(', '))}<br>
        ${cafe.contactName ? `Contact: ${esc(cafe.contactName)}` : ''} ${cafe.phone ? `· ${esc(cafe.phone)}` : ''}
      </div>
      <div>
        <div class="eyebrow">Terms</div>
        <strong>Items:</strong> ${items.length} unique 1-of-1 artworks<br>
        <strong>Total Retail Value:</strong> ${esc(money(totalValue))}<br>
        <strong>Café Commission:</strong> ${Number(cafe.commissionPct) || 0}% on sold pieces
      </div>
    </div>
    <table>
      <thead><tr><th>#</th><th>Ref #</th><th>Artwork Title</th><th>Artist</th><th>Genre</th><th>Status</th><th>Retail Price</th></tr></thead>
      <tbody>${items.map((item, idx) => `<tr>
        <td>${idx + 1}</td>
        <td><code>${esc(item.refNumber ? `#${item.refNumber}` : '—')}</code></td>
        <td><strong>${esc(item.title)}</strong></td>
        <td>${esc(item.artistName)}</td>
        <td>${esc(item.genre)}</td>
        <td>${esc(isReturn ? (item.returnReason || `Returned (${item.daysAtCafe || 0}d)`) : 'Placed on consignment')}</td>
        <td><strong>${esc(money(item.price))}</strong></td>
      </tr>`).join('')}</tbody>
    </table>
    <div class="signatures">
      <div class="sig-line"><strong>Authorized Studio Representative (${esc(studioName)})</strong><br>Signature &amp; Date</div>
      <div class="sig-line"><strong>Partner Café Owner / Manager (${esc(cafe.name || '')})</strong><br>Received / Checked By · Signature &amp; Date</div>
    </div>`;
  return openPrintHtml(`${docTitle} · ${cafe.name || 'Café'}`, bodyHtml);
}

export function openPrintableSettlement({ artistName = 'Artist', commissionPct = 60, sales = [], payouts = [], summary = {}, periodLabel = 'All time' } = {}) {
  const docTitle = `ARTIST SETTLEMENT STATEMENT · ${artistName}`;
  const bodyHtml = `<header>
      <div>
        <div class="eyebrow">hehe.cafe · Artist Commission Ledger</div>
        <h1>Artist Settlement Statement</h1>
        <div>Artist: <strong>${esc(artistName)}</strong> · Share Rate: <strong>${Number(commissionPct) || 0}%</strong> · Period: ${esc(periodLabel)}</div>
      </div>
      <div style="text-align:right">
        <div><strong>Generated:</strong> ${esc(fmtDate(Date.now()))}</div>
      </div>
    </header>
    <div class="kpis">
      <div class="kpi"><span>Earned Online</span><strong>${esc(money(summary.earnedOnline))}</strong></div>
      <div class="kpi"><span>Earned at Cafés</span><strong>${esc(money(summary.earnedCafe))}</strong></div>
      <div class="kpi"><span>Total Earned</span><strong>${esc(money(summary.totalEarned))}</strong></div>
      <div class="kpi"><span>Paid to Date</span><strong>${esc(money(summary.totalPaid))}</strong></div>
      <div class="kpi" style="border-color:#171717"><span>Net Balance Due</span><strong>${esc(money(summary.balanceDue))}</strong></div>
    </div>
    ${sales.length ? `<h2>Sold Pieces Breakdown (${sales.length})</h2>
    <table>
      <thead><tr><th>Date</th><th>Ref #</th><th>Artwork</th><th>Channel / Location</th><th>Sale Price</th><th>Café Cut</th><th>Your Share</th></tr></thead>
      <tbody>${sales.map(s => `<tr>
        <td>${esc(fmtDate(s.at))}</td>
        <td><code>${esc(s.refNumber ? `#${s.refNumber}` : '—')}</code></td>
        <td><strong>${esc(s.title)}</strong> (${esc(s.genre)})</td>
        <td>${esc(s.location)}</td>
        <td>${esc(money(s.salePrice))}</td>
        <td>${s.cafeCommission ? esc(money(s.cafeCommission)) : '—'}</td>
        <td><strong>${esc(money(s.artistShare))}</strong></td>
      </tr>`).join('')}</tbody>
    </table>` : ''}
    <h2>Payout Receipts (${payouts.length})</h2>
    ${payouts.length ? `<table>
      <thead><tr><th>Paid Date</th><th>Method</th><th>UTR / Reference</th><th>Period</th><th>Note</th><th>Amount Paid</th></tr></thead>
      <tbody>${payouts.map(p => `<tr>
        <td>${esc(fmtDate(p.paidAt))}</td>
        <td>${esc(String(p.method || 'UPI').toUpperCase())}</td>
        <td>${esc(p.reference || '—')}</td>
        <td>${esc(p.periodLabel || '—')}</td>
        <td>${esc(p.note || '—')}</td>
        <td><strong>${esc(money(p.amount))}</strong></td>
      </tr>`).join('')}</tbody>
    </table>` : '<p>No payouts recorded yet for this artist.</p>'}
    <div class="signatures">
      <div class="sig-line"><strong>Studio Accounts (hehe.cafe)</strong><br>Authorized Signatory</div>
      <div class="sig-line"><strong>Artist Acknowledgement (${esc(artistName)})</strong><br>Signature &amp; Date</div>
    </div>`;
  return openPrintHtml(docTitle, bodyHtml);
}

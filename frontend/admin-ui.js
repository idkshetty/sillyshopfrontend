import { escapeHTML as e, money } from './commerce.js';

export const POLICY_TABS = [
  ['contact', 'Contact page'],
  ['shipping', 'Shipping policy'],
  ['refunds', 'Cancellation & returns'],
  ['privacy', 'Privacy policy'],
  ['terms', 'Terms of service']
];

export const ADMIN_NAV_GROUPS = [
  {
    label: 'Store',
    items: [
      ['requests', 'Orders'],
      ['orders-map', 'Orders map'],
      ['products', 'Artworks'],
      ['artists', 'Artists'],
      ['promos', 'Promos & bundles'],
      ['reviews', 'Buyer reviews'],
      ['sales', 'Sales'],
      ['analytics', 'Network & analytics'],
      ['audit', 'Activity log'],
      ['backup', 'Backup & export']
    ]
  },
  {
    label: 'Design & pages',
    items: [
      ['content', 'Storefront editor'],
      ['settings', 'Homepage & banners'],
      ['labels', 'Label template'],
      ['policies', 'Pages & policies']
    ]
  }
];

const CORE_ADMIN_TABS = new Set(ADMIN_NAV_GROUPS.flatMap(g => g.items.map(([id]) => id)));
const POLICY_TAB_SET = new Set(POLICY_TABS.map(([id]) => id));

export function normalizeAdminTab(routeId = '') {
  if (POLICY_TAB_SET.has(routeId)) return { tab: 'policies', policyTab: routeId };
  if (CORE_ADMIN_TABS.has(routeId)) return { tab: routeId, policyTab: null };
  return { tab: 'products', policyTab: null };
}

export function countActionableOrders(orders = []) {
  return (Array.isArray(orders) ? orders : []).filter(o =>
    o.status === 'cancel_requested' ||
    o.status === 'details_received' ||
    (o.paymentStatus === 'captured' && ['contacted', 'processing', 'packed'].includes(o.status))
  ).length;
}

export function adminSidebarMarkup({ activeTab, actionableCount = 0, user, logoutHtml }) {
  const navHtml = ADMIN_NAV_GROUPS.map(group => `<div class="admin-nav-group">
      <p class="admin-nav-group-label">${e(group.label)}</p>
      ${group.items.map(([id, label]) => `<button type="button" class="admin-tab ${activeTab === id ? 'active' : ''}" data-action="admin-tab" data-tab="${id}">
        <span>${e(label)}</span>
        ${id === 'requests' ? `<span id="admin-orders-badge" class="admin-nav-badge" ${actionableCount ? '' : 'hidden'}>${actionableCount}</span>` : ''}
      </button>`).join('')}
    </div>`).join('');

  return `<aside class="admin-sidebar">
    <p class="eyebrow">hehe.cafe / Admin</p>
    <nav class="admin-nav" aria-label="Studio navigation">${navHtml}</nav>
    <div class="admin-account-actions">
      <button type="button" class="admin-tab admin-preview-trigger" data-action="open-site-preview"><span>Site preview</span><span aria-hidden="true">👁</span></button>
      <a class="admin-tab" href="#home">View hehe.cafe ↗</a>
      ${logoutHtml}
      <p class="small muted">${e(user?.displayName || 'Administrator')}</p>
    </div>
  </aside>`;
}

export function policySubnavMarkup(activePolicy = 'contact') {
  return `<div class="policy-subnav" role="tablist" aria-label="Policy pages">
    ${POLICY_TABS.map(([id, label]) => `<button type="button" class="policy-subtab ${activePolicy === id ? 'is-active' : ''}" data-action="admin-policy-tab" data-policy="${id}" role="tab" aria-selected="${activePolicy === id ? 'true' : 'false'}">${e(label)}</button>`).join('')}
  </div>`;
}

export function canPrintOrderLabel(o) {
  if (!o) return false;
  if (['cancelled', 'closed'].includes(o.status)) return false;
  if (['failed', 'refunded'].includes(o.paymentStatus)) return false;
  if (o.checkoutPayment && o.paymentStatus !== 'captured') return false;
  return true;
}

export function orderStatusCategory(o) {
  if (['cancelled', 'cancel_requested', 'closed'].includes(o.status) || o.paymentStatus === 'refunded') return 'cancelled';
  if (['shipped', 'out_for_delivery', 'delivered'].includes(o.status)) return 'shipped';
  if (o.paymentStatus === 'captured') return 'to-ship';
  return 'unpaid';
}

export function orderFilterCounts(orders = []) {
  const counts = { all: orders.length, 'to-ship': 0, unpaid: 0, shipped: 0, cancelled: 0, unprinted: 0 };
  for (const o of orders) {
    counts[orderStatusCategory(o)] += 1;
    if (!o.labelPrintedAt && canPrintOrderLabel(o)) counts.unprinted += 1;
  }
  return counts;
}

export function filterOrders(orders = [], { query = '', status = 'all' } = {}) {
  const q = String(query || '').trim().toLowerCase();
  return (Array.isArray(orders) ? orders : []).filter(o => {
    if (status === 'unprinted') {
      if (o.labelPrintedAt || !canPrintOrderLabel(o)) return false;
    } else if (status && status !== 'all' && orderStatusCategory(o) !== status) {
      return false;
    }
    if (!q) return true;
    const c = o.customer || {};
    const haystack = [
      o.id,
      o.id?.slice(0, 8),
      c.firstName,
      c.lastName,
      `${c.firstName || ''} ${c.lastName || ''}`,
      c.email,
      c.phone,
      c.city,
      c.state,
      c.postalCode,
      c.address,
      ...(o.items || []).flatMap(i => [i.title, i.refNumber])
    ].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(q);
  });
}

export function thermalPrinterDockMarkup(printerState = {}, { unprintedCount = 0, unprintedPaidCount = 0, expanded = false } = {}) {
  const connected = Boolean(printerState.connected);
  const protocol = printerState.protocol || 'tspl';
  const baudRate = Number(printerState.baudRate) === 115200 ? 115200 : 9600;
  const autoPrint = Boolean(printerState.autoPrint);
  const autoPaidOnly = printerState.autoPrintPaidOnly !== false;
  const showBody = connected || expanded;
  const statusLabel = connected
    ? `Connected (${printerState.transport === 'serial' ? 'Serial' : 'USB'}): ${printerState.deviceName || 'Thermal printer'}`
    : protocol === 'browser-2in'
      ? 'Browser 2" label driver (50×75 mm · SEZNIK Josh)'
      : protocol === 'browser'
        ? 'Browser thermal driver (100×150 mm)'
        : 'Thermal printer disconnected';
  const targetUnprinted = autoPaidOnly ? unprintedPaidCount : unprintedCount;
  const queueNote = printerState.busy
    ? `Printing now (${printerState.queuedCount || 1} in queue)…`
    : autoPrint
      ? (connected
        ? `Continuous auto-print ON · watching every 5s (${autoPaidOnly ? 'paid' : 'all active'} unprinted)`
        : 'Auto-print alert ON · connect USB/Serial for hands-free printing, or print unprinted batch in one click')
      : (printerState.lastPrintedId
        ? `Last printed #${String(printerState.lastPrintedId).slice(0, 8).toUpperCase()}`
        : 'Connect USB/Serial thermal printer for direct 1-click or continuous auto-printing, or use the browser driver.');

  return `<section class="thermal-dock ${showBody ? '' : 'is-collapsed'}" aria-label="Thermal label printer controls">
    <div class="thermal-dock-head">
      <div class="thermal-dock-status-col">
        <span class="thermal-status-pill ${connected ? 'is-connected' : ''}">${e(statusLabel)}</span>
        <p class="small muted thermal-dock-note" ${showBody ? '' : 'hidden'}>${e(printerState.lastError || queueNote)}</p>
      </div>
      <div class="thermal-dock-right">
        <div class="thermal-dock-unprinted">
          <button type="button" class="button small" data-action="print-unprinted-labels" ${unprintedCount ? '' : 'disabled'}>${autoPaidOnly ? `Print paid unprinted (${unprintedPaidCount})` : `Print all unprinted (${unprintedCount})`}</button>
          ${showBody && autoPaidOnly && unprintedCount > unprintedPaidCount ? `<span class="small muted">${unprintedCount} total active unprinted</span>` : ''}
        </div>
        ${!connected ? `<button type="button" class="button outline small" data-action="toggle-thermal-dock" aria-expanded="${showBody ? 'true' : 'false'}">${showBody ? 'Hide setup ▴' : 'Printer setup ▾'}</button>` : ''}
      </div>
    </div>
    <div class="thermal-controls-row" ${showBody ? '' : 'hidden'}>
      <label class="thermal-select-field">
        <span>Printer language</span>
        <select id="thermal-protocol" aria-label="Thermal printer protocol">
          <option value="tspl-2in" ${protocol === 'tspl-2in' ? 'selected' : ''}>TSPL 2×3" (50×75mm · SEZNIK / 2-inch USB)</option>
          <option value="escpos" ${protocol === 'escpos' ? 'selected' : ''}>ESC/POS 2" / 58mm roll (USB / Serial)</option>
          <option value="browser-2in" ${protocol === 'browser-2in' ? 'selected' : ''}>Browser print 2×3" (50×75mm · SEZNIK Josh)</option>
          <option value="tspl" ${protocol === 'tspl' ? 'selected' : ''}>TSPL 4×6" (100×150mm · Xprinter / TSC / Rollo)</option>
          <option value="zpl" ${protocol === 'zpl' ? 'selected' : ''}>ZPL 4×6" (Zebra / compatible)</option>
          <option value="browser" ${protocol === 'browser' ? 'selected' : ''}>Browser print 4×6" (100×150mm)</option>
        </select>
      </label>
      <label class="thermal-select-field is-baud">
        <span>Serial baud</span>
        <select id="thermal-baud" aria-label="Serial baud rate">
          <option value="9600" ${baudRate === 9600 ? 'selected' : ''}>9600</option>
          <option value="115200" ${baudRate === 115200 ? 'selected' : ''}>115200</option>
        </select>
      </label>
      <div class="thermal-hw-buttons">
        <button type="button" class="button outline small" data-action="thermal-connect-usb" ${printerState.webUsbSupported === false ? 'disabled' : ''}>Connect USB printer</button>
        <button type="button" class="button outline small" data-action="thermal-connect-serial" ${printerState.webSerialSupported === false ? 'disabled' : ''}>Connect Serial / BT</button>
        ${connected ? `<button type="button" class="button outline small" data-action="thermal-test-print">Test print</button><button type="button" class="text-link" data-action="thermal-disconnect">Disconnect</button>` : ''}
      </div>
    </div>
    <div class="thermal-toggles-row" ${showBody ? '' : 'hidden'}>
      <label class="thermal-toggle"><input type="checkbox" id="thermal-autoprint" ${autoPrint ? 'checked' : ''}><span>Auto-print new orders continuously</span></label>
      <label class="thermal-toggle"><input type="checkbox" id="thermal-autoprint-paid" ${autoPaidOnly ? 'checked' : ''}><span>Paid orders only</span></label>
      <span class="small muted">${targetUnprinted} eligible waiting</span>
    </div>
  </section>`;
}

export function ordersToolbarMarkup({ counts, query = '', status = 'all', selectedCount = 0 }) {
  const chips = [
    ['all', 'All', counts.all],
    ['unprinted', 'Unprinted', counts.unprinted || 0],
    ['to-ship', 'Paid · To ship', counts['to-ship']],
    ['unpaid', 'Unpaid / pending', counts.unpaid],
    ['shipped', 'Shipped', counts.shipped],
    ['cancelled', 'Cancelled / closed', counts.cancelled]
  ];
  return `<div class="orders-filter-bar">
      <div class="orders-search-row">
        <input id="admin-orders-search" type="search" aria-label="Search orders" placeholder="Search by order #, customer name, phone, city, PIN or artwork…" value="${e(query)}">
      </div>
      <div class="orders-filter-chips" role="group" aria-label="Filter orders by status">
        ${chips.map(([key, label, count]) => `<button type="button" class="orders-filter-chip ${status === key ? 'is-active' : ''}" data-action="set-order-filter" data-status="${key}" aria-pressed="${status === key}">${e(label)} <span>${count}</span></button>`).join('')}
      </div>
    </div>
    <div class="batch-label-bar ${selectedCount ? 'is-has-selection' : 'is-empty'}">
      <div class="batch-label-info">
        <strong id="batch-label-count">${selectedCount ? `${selectedCount} ${selectedCount === 1 ? 'order' : 'orders'} selected` : 'Select orders to print batch labels'}</strong>
        <div class="batch-label-picks">
          <button type="button" class="text-link" data-action="select-labels-four">Select up to 4</button>
          <button type="button" class="text-link" data-action="select-labels-all">Select shown</button>
          <button type="button" class="text-link" data-action="select-labels-clear" ${selectedCount ? '' : 'disabled'}>Clear</button>
        </div>
      </div>
      <div class="batch-label-actions">
        <button type="button" class="button small" data-action="print-batch-a4" ${selectedCount ? '' : 'disabled'}>Print A4 4-in-1${selectedCount ? ` (${selectedCount})` : ''} ↗</button>
        <button type="button" class="button outline small" data-action="print-batch-2in" ${selectedCount ? '' : 'disabled'}>Print 2" label${selectedCount ? ` (${selectedCount})` : ''} ↗</button>
        <button type="button" class="button outline small" data-action="print-batch-thermal" ${selectedCount ? '' : 'disabled'}>Print 4×6" thermal${selectedCount ? ` (${selectedCount})` : ''} ↗</button>
      </div>
    </div>`;
}

const STAGE_LABELS = {
  details_received: 'Received',
  reviewed: 'Reviewed',
  contacted: 'Confirmed',
  processing: 'Preparing',
  packed: 'Packed',
  shipped: 'Shipped',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancel_requested: 'Cancel requested',
  cancelled: 'Cancelled',
  closed: 'Closed'
};

export function orderCardMarkup(o, {
  selected = false,
  open = false,
  highlighted = false,
  manualPaymentHtml = '',
  statusOptionsHtml = '',
  statusSelectDisabled = false,
  statusHelpText = '',
  locationUrl = '',
  hasPin = false,
  shippingNote = '',
  isMasterAdmin = false,
  refByProductId = {}
} = {}) {
  const c = o.customer || {};
  const ref = o.id.slice(0, 8).toUpperCase();
  const fullName = `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Customer';
  const itemCount = (o.items || []).reduce((n, i) => n + (i.quantity || 1), 0);
  const isClosedOrFailed = o.paymentStatus === 'failed' || ['cancelled', 'closed'].includes(o.status);
  const paidLabel = o.paymentStatus === 'captured' ? 'Payment successful' : o.paymentStatus === 'refunded' ? 'Payment refunded' : (isClosedOrFailed && (o.paymentStatus === 'failed' || o.checkoutPayment || o.razorpayOrderId)) ? 'Payment failed' : (o.checkoutPayment || o.razorpayOrderId) ? 'Payment pending' : 'Unpaid';
  const paidCls = o.paymentStatus === 'captured' ? 'is-paid' : o.paymentStatus === 'refunded' ? 'is-refunded' : 'is-unpaid';
  const shipStatusLabel = o.shippingPaymentStatus === 'captured' ? 'Payment successful' : o.shippingPaymentStatus === 'refunded' ? 'Payment refunded' : o.shippingPaymentStatus === 'failed' ? 'Payment failed' : o.shippingPaymentStatus === 'not_required' ? 'No charge' : (o.shippingRazorpayOrderId && isClosedOrFailed) ? 'Payment failed' : o.shippingRazorpayOrderId ? 'Payment pending' : 'Unpaid';
  const stageLabel = STAGE_LABELS[o.status] || o.status || 'Received';
  const isPrinted = Boolean(o.labelPrintedAt);
  const printable = canPrintOrderLabel(o);
  const printBadge = isPrinted
    ? `<span class="order-print-pill is-printed" title="Printed${o.labelPrintCount > 1 ? ` (${o.labelPrintCount}×)` : ''}">Printed</span>`
    : (printable ? '<span class="order-print-pill is-unprinted">Unprinted</span>' : '');
  const canDownloadInvoice = ['captured', 'refunded'].includes(o.paymentStatus);
  const canRazorpayRefund = o.paymentStatus === 'captured' && o.paymentMethod !== 'manual' && Math.max(0, (Number(o.quote?.amount) || 0) - (Number(o.refundedAmount) || 0)) >= 100;
  const refundDue = canRazorpayRefund && o.refundStatus === 'required';
  const canCancel = ['details_received', 'reviewed', 'contacted', 'processing'].includes(o.status);
  const canUncancel = o.status === 'cancelled' && o.paymentStatus !== 'refunded';
  const shippingIncluded = Boolean(o.quote?.shipping > 0 || o.quote?.freeShipping);
  const canSetQuote = o.checkoutPayment
    ? (!shippingIncluded && !o.shippingQuote && ['details_received', 'reviewed', 'contacted', 'processing'].includes(o.status))
    : (!o.quote && ['details_received', 'reviewed', 'contacted'].includes(o.status));

  return `<article class="order-card ${selected ? 'is-label-selected' : ''} ${highlighted ? 'is-highlighted' : ''} ${open ? 'is-open' : ''}" data-order-id="${e(o.id)}">
    <div class="order-card-summary">
      <div class="order-summary-main">
        ${printable ? `<label class="order-select-check"><input type="checkbox" data-select-label-order="${e(o.id)}" ${selected ? 'checked' : ''}><span>Select</span></label>` : ''}
        <button type="button" class="order-expand-btn" data-action="toggle-order-card" data-id="${e(o.id)}" aria-expanded="${open ? 'true' : 'false'}">
          <strong class="order-summary-id">#${e(ref)}</strong>
          <span class="order-summary-customer">${e(fullName)} · ${e(c.city || '')} ${e(c.postalCode || '')}</span>
        </button>
      </div>
      <div class="order-summary-right">
        <span class="order-summary-meta">${itemCount} ${itemCount === 1 ? 'item' : 'items'} · <strong>${money(o.quote?.amount ? o.quote.amount / 100 : o.estimatedSubtotal)}</strong></span>
        <span class="status-pill ${paidCls}">${paidLabel}</span>
        <span class="status-pill order-stage-pill">${e(stageLabel)}</span>
        ${printBadge}
        ${printable ? `<button type="button" class="button outline small order-summary-print" data-action="print-label" data-id="${e(o.id)}">Print label ↗</button>` : ''}
        ${canUncancel && o.paymentStatus === 'captured' ? `<button type="button" class="button outline small order-summary-uncancel" data-action="uncancel-order" data-id="${e(o.id)}">Un-cancel</button>` : ''}
        ${canRazorpayRefund ? `<button type="button" class="button outline small danger-button order-summary-refund" data-action="open-razorpay-refund" data-id="${e(o.id)}">${refundDue ? 'Refund due · Issue refund' : 'Refund ↩'}</button>` : ''}
        <button type="button" class="icon-button order-expand-chevron" data-action="toggle-order-card" data-id="${e(o.id)}" aria-expanded="${open ? 'true' : 'false'}" aria-label="${open ? 'Collapse order details' : 'Expand order details'}"><svg viewBox="0 0 24 24" class="ui-chevron" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
      </div>
    </div>
    <div class="order-card-body" ${open ? '' : 'hidden'}>
      <div class="order-head">
        <h2>Order #${e(ref)}</h2>
        <select ${statusSelectDisabled ? 'disabled' : ''} data-request-status="${e(o.id)}" aria-label="Status for ${e(o.id.slice(0, 8))}">${statusOptionsHtml}</select>
      </div>
      ${statusHelpText ? `<p class="small muted">${e(statusHelpText)}</p>` : ''}
      <p><strong>${e(c.firstName || '')} ${e(c.lastName || '')}</strong><br>${e(c.email || '')} · ${e(c.phone || '')}</p>
      <p>${e(c.address || '')}${c.apartment ? `, ${e(c.apartment)}` : ''}<br>${e(c.city || '')}, ${e(c.state || '')} ${e(c.postalCode || '')} · ${e(c.country || 'India')}</p>
      <div class="order-lines">${(o.items || []).map(item => {const artRef=item.refNumber||refByProductId[item.productId];const attachTxt=item.attachmentLabel?` <small class="order-attach-pill">Backing: ${e(item.attachmentLabel)}${Number(item.attachmentPrice)>0?` (+${money(item.attachmentPrice)})`:''}</small>`:'';return `<span>${e(item.quantity)} × ${e(item.title)}${/^[1-9][0-9]{5}$/.test(String(artRef||''))?` <small class="artwork-ref">Ref ${e(artRef)}</small>`:''}${attachTxt} — ${money(item.unitPrice * item.quantity)}</span>`;}).join('')}</div>
      <button type="button" class="text-link" data-action="request-customizations" data-id="${e(o.id)}">View product notes &amp; images</button>
      <div id="request-custom-${e(o.id)}" class="request-customizations"></div>
      <p>Estimated subtotal: <strong>${money(o.estimatedSubtotal)}</strong>${shippingNote}</p>
      ${c.notes ? `<p><strong>Note:</strong> ${e(c.notes)}</p>` : ''}
      <div class="order-label-actions">
        ${canDownloadInvoice ? `<button type="button" class="button outline small" data-action="download-invoice" data-id="${e(o.id)}">Download invoice</button>` : ''}
        ${printable ? `<button type="button" class="button outline small" data-action="print-label" data-id="${e(o.id)}">Print label ↗</button>` : ''}
        ${canRazorpayRefund ? `<button type="button" class="button outline small danger-button" data-action="open-razorpay-refund" data-id="${e(o.id)}">Issue Razorpay refund</button>` : ''}
        ${canUncancel ? `<button type="button" class="button outline small" data-action="uncancel-order" data-id="${e(o.id)}">Un-cancel order</button>` : ''}
        ${isPrinted && printable ? `<button type="button" class="text-link" data-action="reset-label-printed" data-id="${e(o.id)}">Mark unprinted</button>` : ''}
        <a class="text-link" href="${e(locationUrl)}" target="_blank" rel="noopener">${hasPin ? 'View delivery pin ↗' : 'Search address ↗'}</a>
      </div>
      ${!['cancelled', 'closed'].includes(o.status) ? `<form class="order-tracking-editor" data-tracking-form="${e(o.id)}">
        <label class="field">Courier<input name="courier" maxlength="60" value="${e(o.tracking?.courier || 'India Post')}" placeholder="India Post"></label>
        <label class="field">Tracking ID<input name="trackingNumber" maxlength="60" value="${e(o.tracking?.number || '')}" placeholder="e.g. EK123456789IN"></label>
        <button type="submit" class="button outline small">Save tracking</button>
        ${o.tracking?.number ? `<a class="text-link" href="${e(o.tracking.url || 'https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx')}" target="_blank" rel="noopener">Track ↗</a>` : ''}
      </form>` : ''}
      ${manualPaymentHtml}
      ${o.paymentStatus === 'captured' && o.paymentMethod !== 'manual' ? `<div class="order-refund-controls"><button type="button" class="button outline small danger-button" data-action="open-razorpay-refund" data-id="${e(o.id)}">Issue Razorpay refund</button>${o.refundedAmount > 0 ? `<span class="small muted">Refunded to date: ${money(o.refundedAmount / 100)}</span>` : ''}</div>` : ''}
      ${canCancel ? `<button type="button" class="text-link" data-action="resolve-cancellation" data-id="${e(o.id)}" data-approve="true">${canRazorpayRefund ? 'Cancel order, release stock & auto-refund' : o.inventoryReserved ? 'Cancel order & release stock' : 'Cancel request'}</button>` : ''}
      ${o.status === 'cancel_requested' ? `<div class="order-tools"><button type="button" class="button small" data-action="resolve-cancellation" data-id="${e(o.id)}" data-approve="true">${canRazorpayRefund ? 'Approve cancellation & auto-refund' : 'Approve cancellation'}</button><button type="button" class="button outline small" data-action="resolve-cancellation" data-id="${e(o.id)}" data-approve="false">Decline cancellation</button></div>` : ''}
      ${canSetQuote ? `<button type="button" class="text-link" data-action="approve-quote" data-id="${e(o.id)}">Set quote / shipping charge →</button>` : ''}
      ${o.quote ? `<p class="payment-info">${o.checkoutPayment && !shippingIncluded ? 'Item subtotal' : o.paymentStatus === 'captured' ? 'Total paid' : 'Confirmed total'}: ${money(o.quote.amount / 100)}${o.quote.shipping > 0 ? ` (includes ${money(o.quote.shipping / 100)} shipping)` : o.quote.freeShipping ? ' (free shipping)' : ''} · ${e(o.refundStatus === 'required' ? (o.paymentMethod === 'manual' ? 'Offline refund due — return funds through the original method, then record it below.' : 'Refund due — issue it in Razorpay; the webhook updates this request.') : paidLabel)}</p>${o.shippingQuote ? `<p class="small">Shipping charge: ${money(o.shippingQuote.amount / 100)} - ${e(shipStatusLabel)}</p>` : ''}` : ''}
      <div class="order-card-footer-meta">
        <p class="small muted">Received ${new Date(o.createdAt?.seconds ? o.createdAt.seconds * 1000 : o.createdAt).toLocaleString('en-IN')}</p>
        ${isMasterAdmin ? `<button type="button" class="danger-link" data-action="delete-order" data-id="${e(o.id)}">Delete order</button>` : ''}
      </div>
    </div>
  </article>`;
}

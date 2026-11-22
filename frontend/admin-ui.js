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
      ['sales', 'Sales'],
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

export function orderStatusCategory(o) {
  if (['cancelled', 'cancel_requested', 'closed'].includes(o.status) || o.paymentStatus === 'refunded') return 'cancelled';
  if (['shipped', 'out_for_delivery', 'delivered'].includes(o.status)) return 'shipped';
  if (o.paymentStatus === 'captured') return 'to-ship';
  return 'unpaid';
}

export function orderFilterCounts(orders = []) {
  const counts = { all: orders.length, 'to-ship': 0, unpaid: 0, shipped: 0, cancelled: 0 };
  for (const o of orders) counts[orderStatusCategory(o)] += 1;
  return counts;
}

export function filterOrders(orders = [], { query = '', status = 'all' } = {}) {
  const q = String(query || '').trim().toLowerCase();
  return (Array.isArray(orders) ? orders : []).filter(o => {
    if (status && status !== 'all' && orderStatusCategory(o) !== status) return false;
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
      ...(o.items || []).map(i => i.title)
    ].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(q);
  });
}

export function ordersToolbarMarkup({ counts, query = '', status = 'all', selectedCount = 0 }) {
  const chips = [
    ['all', 'All', counts.all],
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
    <div class="batch-label-bar">
      <div class="batch-label-info">
        <strong id="batch-label-count">${selectedCount ? `${selectedCount} ${selectedCount === 1 ? 'order' : 'orders'} selected` : 'Select orders to print labels (4-in-1 A4 or thermal)'}</strong>
        <div class="batch-label-picks">
          <button type="button" class="text-link" data-action="select-labels-four">Select up to 4</button>
          <button type="button" class="text-link" data-action="select-labels-all">Select shown</button>
          <button type="button" class="text-link" data-action="select-labels-clear" ${selectedCount ? '' : 'disabled'}>Clear</button>
        </div>
      </div>
      <div class="batch-label-actions">
        <button type="button" class="button small" data-action="print-batch-a4" ${selectedCount ? '' : 'disabled'}>Print A4 4-in-1${selectedCount ? ` (${selectedCount})` : ''} ↗</button>
        <button type="button" class="button outline small" data-action="print-batch-thermal" ${selectedCount ? '' : 'disabled'}>Print thermal${selectedCount ? ` (${selectedCount})` : ''} ↗</button>
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
  shippingNote = ''
}) {
  const c = o.customer || {};
  const ref = o.id.slice(0, 8).toUpperCase();
  const fullName = `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Customer';
  const itemCount = (o.items || []).reduce((n, i) => n + (i.quantity || 1), 0);
  const paidLabel = o.paymentStatus === 'captured' ? 'Paid' : o.paymentStatus === 'refunded' ? 'Refunded' : 'Unpaid';
  const paidCls = o.paymentStatus === 'captured' ? 'is-paid' : o.paymentStatus === 'refunded' ? 'is-refunded' : 'is-unpaid';
  const stageLabel = STAGE_LABELS[o.status] || o.status || 'Received';
  const canDownloadInvoice = ['captured', 'refunded'].includes(o.paymentStatus);
  const canCancel = ['details_received', 'reviewed', 'contacted', 'processing'].includes(o.status);
  const canSetQuote = o.checkoutPayment
    ? (!o.shippingQuote && ['details_received', 'reviewed', 'contacted', 'processing'].includes(o.status))
    : (!o.quote && ['details_received', 'reviewed', 'contacted'].includes(o.status));

  return `<article class="order-card ${selected ? 'is-label-selected' : ''} ${highlighted ? 'is-highlighted' : ''} ${open ? 'is-open' : ''}" data-order-id="${e(o.id)}">
    <div class="order-card-summary">
      <div class="order-summary-main">
        <label class="order-select-check"><input type="checkbox" data-select-label-order="${e(o.id)}" ${selected ? 'checked' : ''}><span>Select</span></label>
        <button type="button" class="order-expand-btn" data-action="toggle-order-card" data-id="${e(o.id)}" aria-expanded="${open ? 'true' : 'false'}">
          <strong class="order-summary-id">#${e(ref)}</strong>
          <span class="order-summary-customer">${e(fullName)} · ${e(c.city || '')} ${e(c.postalCode || '')}</span>
        </button>
      </div>
      <div class="order-summary-right">
        <span class="order-summary-meta">${itemCount} ${itemCount === 1 ? 'item' : 'items'} · <strong>${money(o.estimatedSubtotal)}</strong></span>
        <span class="status-pill ${paidCls}">${paidLabel}</span>
        <span class="status-pill order-stage-pill">${e(stageLabel)}</span>
        <button type="button" class="button outline small order-summary-print" data-action="print-label" data-id="${e(o.id)}">Print label ↗</button>
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
      <div class="order-lines">${(o.items || []).map(item => `<span>${e(item.quantity)} × ${e(item.title)} — ${money(item.unitPrice * item.quantity)}</span>`).join('')}</div>
      <button type="button" class="text-link" data-action="request-customizations" data-id="${e(o.id)}">View product notes &amp; images</button>
      <div id="request-custom-${e(o.id)}" class="request-customizations"></div>
      <p>Estimated subtotal: <strong>${money(o.estimatedSubtotal)}</strong>${shippingNote}</p>
      ${c.notes ? `<p><strong>Note:</strong> ${e(c.notes)}</p>` : ''}
      <div class="order-label-actions">
        ${canDownloadInvoice ? `<button type="button" class="button outline small" data-action="download-invoice" data-id="${e(o.id)}">Download invoice</button>` : ''}
        <button type="button" class="button outline small" data-action="print-label" data-id="${e(o.id)}">Print label ↗</button>
        <a class="text-link" href="${e(locationUrl)}" target="_blank" rel="noopener">${hasPin ? 'View delivery pin ↗' : 'Search address ↗'}</a>
      </div>
      ${manualPaymentHtml}
      ${canCancel ? `<button type="button" class="text-link" data-action="resolve-cancellation" data-id="${e(o.id)}" data-approve="true">${o.inventoryReserved ? 'Cancel order & release stock' : 'Cancel request'}</button>` : ''}
      ${o.status === 'cancel_requested' ? `<div class="order-tools"><button type="button" class="button small" data-action="resolve-cancellation" data-id="${e(o.id)}" data-approve="true">Approve cancellation</button><button type="button" class="button outline small" data-action="resolve-cancellation" data-id="${e(o.id)}" data-approve="false">Decline cancellation</button></div>` : ''}
      ${canSetQuote ? `<button type="button" class="text-link" data-action="approve-quote" data-id="${e(o.id)}">Set quote / shipping charge →</button>` : ''}
      ${o.quote ? `<p class="payment-info">${o.checkoutPayment ? 'Item subtotal' : 'Confirmed total'}: ${money(o.quote.amount / 100)} · ${e(o.refundStatus === 'required' ? (o.paymentMethod === 'manual' ? 'Offline refund due — return funds through the original method, then record it below.' : 'Refund due — issue it in Razorpay; the webhook updates this request.') : o.paymentStatus)}</p>${o.shippingQuote ? `<p class="small">Shipping charge: ${money(o.shippingQuote.amount / 100)} - ${e(o.shippingPaymentStatus || 'awaiting payment')}</p>` : ''}` : ''}
      <p class="small muted">Received ${new Date(o.createdAt?.seconds ? o.createdAt.seconds * 1000 : o.createdAt).toLocaleString('en-IN')}</p>
    </div>
  </article>`;
}

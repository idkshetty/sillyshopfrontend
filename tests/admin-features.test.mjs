import test from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_NAV_GROUPS, normalizeAdminTab, orderCardMarkup, thermalPrinterDockMarkup } from '../frontend/admin-ui.js';
import { ordersListMarkup } from '../frontend/customer-dashboard.js';
import { reviewSection } from '../frontend/shop-effects.js';

test('Admin navigation includes Buyer reviews and Activity log tabs', () => {
  const storeItems = ADMIN_NAV_GROUPS[0].items.map(([id]) => id);
  assert.ok(storeItems.includes('reviews'));
  assert.ok(storeItems.includes('audit'));
  assert.deepEqual(normalizeAdminTab('reviews'), { tab: 'reviews', policyTab: null });
  assert.deepEqual(normalizeAdminTab('audit'), { tab: 'audit', policyTab: null });
});

test('orderCardMarkup renders tracking editor and Razorpay refund button for paid online orders', () => {
  const html = orderCardMarkup({
    id: 'order123456',
    status: 'processing',
    paymentStatus: 'captured',
    paymentMethod: 'razorpay',
    customer: { firstName: 'Asha', lastName: 'K', city: 'Bengaluru', postalCode: '560001' },
    items: [{ productId: 'p1', title: 'Moon Cat', quantity: 1, unitPrice: 300 }],
    quote: { amount: 34000, shipping: 4000 },
    tracking: { courier: 'India Post', number: 'EK99887766IN', url: 'https://www.indiapost.gov.in/' },
    createdAt: Date.now()
  }, { open: true });

  assert.match(html, /data-tracking-form="order123456"/);
  assert.match(html, /EK99887766IN/);
  assert.match(html, /data-action="open-razorpay-refund"/);
});

test('thermalPrinterDockMarkup collapses cleanly when disconnected and expands on demand', () => {
  const collapsed = thermalPrinterDockMarkup({ connected: false }, { unprintedCount: 3, unprintedPaidCount: 2, expanded: false });
  assert.match(collapsed, /is-collapsed/);
  assert.match(collapsed, /data-action="toggle-thermal-dock"/);
  assert.match(collapsed, /<div class="thermal-controls-row" hidden>/);

  const expanded = thermalPrinterDockMarkup({ connected: false }, { unprintedCount: 3, unprintedPaidCount: 2, expanded: true });
  assert.doesNotMatch(expanded, /is-collapsed/);
  assert.match(expanded, /<div class="thermal-controls-row"\s*>/);
});

test('customer dashboard renders India Post tracking card and delivered review form', () => {
  const html = ordersListMarkup([{
    id: 'ord_delivered_1',
    status: 'delivered',
    paymentStatus: 'captured',
    customer: { firstName: 'Neha', lastName: 'S', address: 'MG Road', city: 'Pune', state: 'Maharashtra', postalCode: '411001', phone: '9876543210' },
    items: [{ productId: 'p1', title: 'Rain Cloud Magnet', quantity: 1, unitPrice: 250 }],
    quote: { amount: 29000, shipping: 4000 },
    tracking: { courier: 'India Post', number: 'EK111222333IN' },
    createdAt: Date.now()
  }]);
  assert.match(html, /EK111222333IN/);
  assert.match(html, /data-action="copy-tracking"/);
  assert.match(html, /Track parcel ↗/);
  assert.match(html, /data-review-form="ord_delivered_1"/);
});

test('reviewSection escapes and renders approved buyer collector cards', () => {
  const html = reviewSection([], [{
    authorName: 'Riya <script>',
    rating: 5,
    comment: 'Loved the glaze & packaging!',
    artworkTitles: ['Monsoon Cat']
  }]);
  assert.match(html, /buyer-reviews-grid/);
  assert.match(html, /Riya &lt;script&gt;/);
  assert.match(html, /Monsoon Cat/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_NAV_GROUPS, normalizeAdminTab, orderCardMarkup, thermalPrinterDockMarkup } from '../frontend/admin-ui.js';
import { ordersListMarkup } from '../frontend/customer-dashboard.js';
import { reviewSection } from '../frontend/shop-effects.js';

test('Admin navigation includes Network & analytics, Buyer reviews and Activity log tabs', () => {
  const storeItems = ADMIN_NAV_GROUPS[0].items.map(([id]) => id);
  assert.ok(storeItems.includes('analytics'));
  assert.ok(storeItems.includes('reviews'));
  assert.ok(storeItems.includes('audit'));
  assert.deepEqual(normalizeAdminTab('analytics'), { tab: 'analytics', policyTab: null });
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
  assert.match(html, /Cancel order, release stock &amp; auto-refund|Cancel order, release stock & auto-refund/);
});

test('orderCardMarkup renders un-cancel controls only when not fully refunded', () => {
  const baseOrder = {
    id: 'order_cancelled_1',
    status: 'cancelled',
    paymentStatus: 'captured',
    paymentMethod: 'razorpay',
    customer: { firstName: 'Asha', lastName: 'K', city: 'Bengaluru', postalCode: '560001' },
    items: [{ productId: 'p1', title: 'Moon Cat', quantity: 1, unitPrice: 300 }],
    quote: { amount: 34000, shipping: 4000 },
    createdAt: Date.now()
  };
  const paidCancelled = orderCardMarkup(baseOrder, { open: true });
  assert.match(paidCancelled, /order-summary-uncancel[^>]*data-action="uncancel-order"/);
  assert.match(paidCancelled, /data-action="uncancel-order"[^>]*>Un-cancel order</);

  const refundedCancelled = orderCardMarkup({ ...baseOrder, paymentStatus: 'refunded', refundedAmount: 34000 }, { open: true });
  assert.doesNotMatch(refundedCancelled, /data-action="uncancel-order"/);
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

test('pilot commerce, 1-of-1 artwork pool, search, abandoned recovery, and system health markup render cleanly', async () => {
  const {
    pilotCommerceAnalyticsMarkup,
    pilotArtworkPoolMarkup,
    pilotSearchInsightsMarkup,
    pilotAbandonedRecoveryMarkup,
    pilotSystemHealthMarkup
  } = await import('../frontend/pilot-analytics-ui.js');
  const { sanitizeMetaPixelId, sanitizeGa4Id } = await import('../frontend/marketing-pixels.js');
  const { footerMarkup, DEFAULT_CONTENT } = await import('../frontend/store-content.js');

  assert.equal(sanitizeMetaPixelId('123456789012'), '123456789012');
  assert.equal(sanitizeMetaPixelId('bad<script>'), '');
  assert.equal(sanitizeGa4Id('g-abc12345'), 'G-ABC12345');
  assert.equal(sanitizeGa4Id('UA-123'), '');

  const traffic = {
    commerce: {
      kpis: {
        ordersCount: 4,
        grossRevenueInr: 1200,
        aovInr: 300,
        conversionRatePct: 4.5,
        uniqueBuyers: 3,
        returningBuyers: 1,
        returningBuyerRatePct: 33.3,
        firstTimeRevenueInr: 700,
        returningRevenueInr: 500,
        avgLtvInr: 400,
        lifetimeOrders: 10,
        lifetimeRevenueInr: 3200
      },
      artworkPool: {
        totalArtworks: 25,
        availableCount: 15,
        soldOutCount: 10,
        hiddenAvailableCount: 2,
        sellThroughPct: 40,
        soldLast30d: 6,
        salesPerWeek: 1.4,
        estDaysToSellOut: 75,
        byCategory: [{ name: 'Fridge Magnet', total: 20, available: 12, sold: 8, sellThroughPct: 40 }],
        byArtist: [{ name: 'Suprita', total: 25, available: 15, sold: 10, sellThroughPct: 40 }]
      },
      attributionChannels: [{ channel: 'instagram', sessions: 40, orders: 3, conversionRatePct: 7.5, revenueInr: 900 }],
      searchInsights: {
        totalSearches: 5,
        topQueries: [{ query: 'cat magnet', count: 3, lastResultCount: 2 }],
        zeroResultQueries: [{ query: 'frog bowl', zeroCount: 2 }]
      },
      abandonedCheckouts: [{
        id: 'chk_1',
        kind: 'checkout',
        customerName: 'Asha',
        email: 'asha@example.com',
        phone: '9876543210',
        city: 'Bengaluru',
        itemTitles: ['Moon Cat'],
        amountInr: 290,
        ageMinutes: 35
      }]
    }
  };

  const commerceHtml = pilotCommerceAnalyticsMarkup(traffic);
  assert.match(commerceHtml, /Commerce &amp; Attribution/);
  assert.match(commerceHtml, /instagram/);
  assert.match(commerceHtml, /900/);

  const poolHtml = pilotArtworkPoolMarkup(traffic);
  assert.match(poolHtml, /1-of-1 Artwork Pool/);
  assert.match(poolHtml, /~75 days/);
  assert.match(poolHtml, /40\.0% sell-through/);

  const searchHtml = pilotSearchInsightsMarkup(traffic);
  assert.match(searchHtml, /cat magnet/);
  assert.match(searchHtml, /frog bowl/);

  const abandonedHtml = pilotAbandonedRecoveryMarkup(traffic);
  assert.match(abandonedHtml, /https:\/\/wa\.me\/919876543210/);
  assert.match(abandonedHtml, /data-copy-recovery=/);

  const healthHtml = pilotSystemHealthMarkup({
    status: 'operational',
    overall90dUptime: 99.98,
    runtime: 'Node API',
    checkedAt: '2026-11-26T10:00:00.000Z',
    services: [{ id: 'api', name: 'Core API Gateway', status: 'operational', detail: 'Healthy', latencyMs: 12 }]
  });
  assert.match(healthHtml, /All Systems Operational/);
  assert.match(healthHtml, /99\.98%/);
  assert.match(healthHtml, /status\.html/);

  assert.match(footerMarkup(DEFAULT_CONTENT), /href="status\.html"/);
});

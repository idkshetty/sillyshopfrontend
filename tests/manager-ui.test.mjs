import test from 'node:test';
import assert from 'node:assert/strict';
import {
  revenueTrendChartMarkup,
  genreVelocityMatrixMarkup,
  cafeComparisonChartMarkup,
  storeGenreStatsMarkup,
  storePriceBandsMarkup
} from '../frontend/manager/manager-charts.js';

test('revenueTrendChartMarkup renders clean SVG bars and escapes month labels', () => {
  const html = revenueTrendChartMarkup([
    { label: 'Oct <26>', siteRevenue: 1200, cafeRevenue: 800 },
    { label: 'Nov 26', siteRevenue: 2400, cafeRevenue: 1500 }
  ]);
  assert.match(html, /<svg class="mgr-svg-chart"/);
  assert.match(html, /Oct &lt;26&gt;/);
  assert.match(html, /#059669/);
  assert.match(html, /#4f46e5/);
  assert.match(revenueTrendChartMarkup([]), /Not enough monthly data/);
});

test('genreVelocityMatrixMarkup renders fast/slow velocity badges and sell-through stats', () => {
  const html = genreVelocityMatrixMarkup([
    { genre: 'Fridge Magnet', totalUnits: 5, siteUnits: 3, cafeUnits: 2, totalRevenue: 1750, activeCafeUnits: 2, returnedUnits: 1, returnRatePct: 16.7, sellThroughPct: 62.5, velocityTag: 'fast', avgDaysAtCafe: 9.5 },
    { genre: 'Clay Frame', totalUnits: 1, siteUnits: 0, cafeUnits: 1, totalRevenue: 600, activeCafeUnits: 0, returnedUnits: 3, returnRatePct: 75, sellThroughPct: 25, velocityTag: 'slow', avgDaysAtCafe: 24 }
  ]);
  assert.match(html, /Fast mover/);
  assert.match(html, /Slow \/ high return/);
  assert.match(html, /62.5%/);
  assert.match(html, /Avg <strong>9.5d<\/strong> at café/);
});

test('cafeComparisonChartMarkup renders stacked placement bars and handles empty cafes', () => {
  const html = cafeComparisonChartMarkup([
    { cafeId: 'c1', cafeName: 'Third Wave', city: 'Bengaluru', commissionPct: 15, soldUnits: 4, soldRevenue: 1800, activeStock: 2, returnedUnits: 1, totalPlaced: 7, returnRatePct: 20, avgDaysToSell: 11 }
  ]);
  assert.match(html, /Third Wave/);
  assert.match(html, /15% fee/);
  assert.match(html, /Avg sell time <strong>11d<\/strong>/);
  assert.match(cafeComparisonChartMarkup([]), /Add partner cafés/);
});

test('storeGenreStatsMarkup and storePriceBandsMarkup render store-level analytics', () => {
  const gHtml = storeGenreStatsMarkup([
    { genre: 'Fridge Magnet', sent: 6, sold: 4, active: 1, returned: 1, revenue: 1200, sellThroughPct: 66.7, velocityTag: 'fast' }
  ]);
  assert.match(gHtml, /Fridge Magnet/);
  assert.match(gHtml, /Top mover/);
  assert.match(gHtml, /66.7%/);

  const pHtml = storePriceBandsMarkup([
    { label: 'Under ₹300', sent: 5, sold: 4, active: 1, returned: 0, sellThroughPct: 80 },
    { label: '₹300 – ₹600', sent: 0, sold: 0, active: 0, returned: 0, sellThroughPct: 0 }
  ]);
  assert.match(pHtml, /Under ₹300/);
  assert.match(pHtml, /80%/);
});

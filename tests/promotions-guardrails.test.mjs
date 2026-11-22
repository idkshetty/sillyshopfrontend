import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePromoCode, normalizePromos, isPromoExpired, calculateDiscounts } from '../frontend/promotions.js';

test('normalizePromoCode preserves guardrails and validates expiry dates', () => {
  const valid = normalizePromoCode({
    code: ' fest20 ',
    type: 'percent',
    value: 20,
    maxTotalUses: 50,
    onePerCustomer: true,
    expiresAt: '2026-12-31',
    label: 'Festival 20%'
  });
  assert.deepEqual(valid, {
    code: 'FEST20',
    active: true,
    type: 'percent',
    value: 20,
    minSubtotal: 0,
    maxDiscount: 0,
    maxTotalUses: 50,
    onePerCustomer: true,
    expiresAt: '2026-12-31',
    label: 'Festival 20%'
  });

  const badDate = normalizePromoCode({ code: 'BADDATE', expiresAt: '2026-02-31' });
  assert.equal(badDate.expiresAt, '');
});

test('isPromoExpired evaluates IST calendar date boundaries cleanly', () => {
  const promo = { expiresAt: '2026-11-23' };
  // 2026-11-23 23:00 IST == 2026-11-23 17:30 UTC (still valid)
  assert.equal(isPromoExpired(promo, Date.UTC(2026, 10, 23, 17, 30)), false);
  // 2026-11-24 00:05 IST == 2026-11-23 18:35 UTC (expired)
  assert.equal(isPromoExpired(promo, Date.UTC(2026, 10, 23, 18, 35)), true);
});

test('calculateDiscounts rejects expired promo codes with clear message', () => {
  const promos = normalizePromos({
    codes: [{ code: 'OLD10', type: 'percent', value: 10, expiresAt: '2026-11-20' }]
  });
  const expiredRes = calculateDiscounts({
    subtotalPaise: 50000,
    totalQty: 1,
    shippingPaise: 4000,
    promoCode: 'OLD10',
    promos,
    nowMs: Date.UTC(2026, 10, 23, 12, 0)
  });
  assert.equal(expiredRes.appliedCode, '');
  assert.match(expiredRes.promoError, /expired/i);

  const activeRes = calculateDiscounts({
    subtotalPaise: 50000,
    totalQty: 1,
    shippingPaise: 4000,
    promoCode: 'OLD10',
    promos,
    nowMs: Date.UTC(2026, 10, 20, 12, 0)
  });
  assert.equal(activeRes.appliedCode, 'OLD10');
  assert.equal(activeRes.codeDiscountPaise, 5000);
});

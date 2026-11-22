export const DEFAULT_PROMOS = { codes: [], bundles: [] };

const VALID_CODE_TYPES = new Set(['percent', 'fixed', 'free_shipping']);
const VALID_BUNDLE_TYPES = new Set(['fixed', 'percent']);
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function normalizePromoExpiry(raw) {
  const s = String(raw || '').trim();
  if (!ISO_DATE_RE.test(s)) return '';
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() + 1 !== m || dt.getUTCDate() !== d) return '';
  return s;
}

export function isPromoExpired(promo, nowMs = Date.now()) {
  const expiresAt = normalizePromoExpiry(promo?.expiresAt);
  if (!expiresAt) return false;
  // Calendar date in IST (UTC+05:30).
  const istToday = new Date(nowMs + 19800000).toISOString().slice(0, 10);
  return istToday > expiresAt;
}

export function normalizePromoCode(raw = {}) {
  const code = String(raw.code || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 24);
  if (code.length < 2) return null;
  const type = VALID_CODE_TYPES.has(raw.type) ? raw.type : 'percent';
  let value = Number(raw.value);
  if (type === 'free_shipping') {
    value = 0;
  } else if (type === 'percent') {
    value = Number.isFinite(value) ? Math.max(1, Math.min(90, Math.round(value))) : 10;
  } else {
    value = Number.isFinite(value) ? Math.max(1, Math.min(50000, Math.round(value))) : 50;
  }
  const rawMin = Number(raw.minSubtotal);
  const rawMax = Number(raw.maxDiscount);
  const rawMaxUses = Number(raw.maxTotalUses);
  return {
    code,
    active: raw.active !== false,
    type,
    value,
    minSubtotal: Number.isFinite(rawMin) && rawMin > 0 ? Math.min(500000, Math.round(rawMin)) : 0,
    maxDiscount: type === 'percent' && Number.isFinite(rawMax) && rawMax > 0 ? Math.min(50000, Math.round(rawMax)) : 0,
    maxTotalUses: Number.isFinite(rawMaxUses) && rawMaxUses > 0 ? Math.min(100000, Math.floor(rawMaxUses)) : 0,
    onePerCustomer: Boolean(raw.onePerCustomer),
    expiresAt: normalizePromoExpiry(raw.expiresAt),
    label: String(raw.label || '').trim().slice(0, 100)
  };
}

export function normalizeBundleTier(raw = {}, index = 0) {
  const rawId = String(raw.id || `bundle-${index + 1}`)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || `bundle-${index + 1}`;
  const discountType = VALID_BUNDLE_TYPES.has(raw.discountType) ? raw.discountType : 'fixed';
  const rawMinQty = Math.floor(Number(raw.minQty));
  const minQty = Number.isInteger(rawMinQty) ? Math.max(2, Math.min(20, rawMinQty)) : 3;
  let value = Number(raw.value);
  if (discountType === 'percent') {
    value = Number.isFinite(value) ? Math.max(1, Math.min(90, Math.round(value))) : 10;
  } else {
    value = Number.isFinite(value) ? Math.max(1, Math.min(50000, Math.round(value))) : 50;
  }
  return {
    id: rawId,
    active: raw.active !== false,
    minQty,
    discountType,
    value,
    label: String(raw.label || `Buy ${minQty}+ artworks, save ${discountType === 'percent' ? `${value}%` : `₹${value}`}`)
      .trim()
      .slice(0, 120)
  };
}

export function normalizePromos(raw = {}) {
  const rawCodes = Array.isArray(raw?.codes) ? raw.codes : (raw?.codes && typeof raw.codes === 'object' ? Object.values(raw.codes) : []);
  const rawBundles = Array.isArray(raw?.bundles) ? raw.bundles : (raw?.bundles && typeof raw.bundles === 'object' ? Object.values(raw.bundles) : []);
  const seenCodes = new Set();
  const codes = [];
  for (const item of rawCodes) {
    const clean = normalizePromoCode(item);
    if (!clean || seenCodes.has(clean.code)) continue;
    seenCodes.add(clean.code);
    codes.push(clean);
    if (codes.length >= 25) break;
  }
  const seenBundles = new Set();
  const bundles = [];
  for (const [idx, item] of rawBundles.entries()) {
    if (!item || typeof item !== 'object') continue;
    const clean = normalizeBundleTier(item, idx);
    if (seenBundles.has(clean.id)) continue;
    seenBundles.add(clean.id);
    bundles.push(clean);
    if (bundles.length >= 10) break;
  }
  bundles.sort((a, b) => a.minQty - b.minQty);
  return { codes, bundles };
}

/** Compute bundle savings + promo code discount in integer paise. */
export function calculateDiscounts({
  subtotalPaise = 0,
  totalQty = 0,
  shippingPaise = 4000,
  promoCode = '',
  promos = DEFAULT_PROMOS,
  nowMs = Date.now()
} = {}) {
  const sub = Math.max(0, Math.round(Number(subtotalPaise) || 0));
  const qty = Math.max(0, Math.floor(Number(totalQty) || 0));
  const baseShipping = Math.max(0, Math.round(Number(shippingPaise) || 0));
  const safePromos = normalizePromos(promos);

  let bundleDiscountPaise = 0;
  let bundleLabel = '';
  for (const tier of safePromos.bundles) {
    if (!tier.active || qty < tier.minQty || sub <= 0) continue;
    const rawSave = tier.discountType === 'percent'
      ? Math.round(sub * tier.value / 100)
      : tier.value * 100;
    const cappedSave = Math.min(sub, Math.max(0, rawSave));
    if (cappedSave > bundleDiscountPaise) {
      bundleDiscountPaise = cappedSave;
      bundleLabel = tier.label || `Bundle (${tier.minQty}+ items)`;
    }
  }

  const afterBundle = Math.max(0, sub - bundleDiscountPaise);
  const entered = String(promoCode || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  let appliedCode = '';
  let codeLabel = '';
  let codeDiscountPaise = 0;
  let freeShipping = false;
  let promoError = '';

  if (entered) {
    const match = safePromos.codes.find(c => c.code === entered && c.active);
    if (!match) {
      promoError = 'That promo code is not valid or has expired.';
    } else if (isPromoExpired(match, nowMs)) {
      promoError = 'This promo code has expired.';
    } else if (match.minSubtotal > 0 && sub < match.minSubtotal * 100) {
      const needRupees = Math.ceil((match.minSubtotal * 100 - sub) / 100);
      promoError = `Add ₹${needRupees} more to use ${match.code} (min ₹${match.minSubtotal}).`;
    } else {
      appliedCode = match.code;
      codeLabel = match.label || match.code;
      if (match.type === 'free_shipping') {
        freeShipping = true;
      } else if (match.type === 'percent') {
        codeDiscountPaise = Math.round(afterBundle * match.value / 100);
        if (match.maxDiscount > 0) codeDiscountPaise = Math.min(codeDiscountPaise, match.maxDiscount * 100);
      } else {
        codeDiscountPaise = match.value * 100;
      }
      codeDiscountPaise = Math.min(afterBundle, Math.max(0, codeDiscountPaise));
    }
  }

  const effectiveShippingPaise = freeShipping ? 0 : baseShipping;
  // Keep total payable at least ₹1 (100 paise) whenever cart has priced items.
  const maxAllowedDiscount = sub > 0 ? Math.max(0, sub + effectiveShippingPaise - 100) : 0;
  let totalDiscountPaise = bundleDiscountPaise + codeDiscountPaise;
  if (totalDiscountPaise > maxAllowedDiscount) {
    totalDiscountPaise = maxAllowedDiscount;
    if (bundleDiscountPaise >= maxAllowedDiscount) {
      bundleDiscountPaise = maxAllowedDiscount;
      codeDiscountPaise = 0;
    } else {
      codeDiscountPaise = maxAllowedDiscount - bundleDiscountPaise;
    }
  }
  const totalPaise = sub > 0 ? Math.max(100, sub - totalDiscountPaise + effectiveShippingPaise) : 0;

  return {
    subtotalPaise: sub,
    bundleDiscountPaise,
    bundleLabel,
    codeDiscountPaise,
    appliedCode,
    codeLabel,
    freeShipping,
    shippingPaise: effectiveShippingPaise,
    totalDiscountPaise,
    totalPaise,
    promoError
  };
}

export function nextBundleHint(totalQty = 0, promos = DEFAULT_PROMOS) {
  const safePromos = normalizePromos(promos);
  const next = safePromos.bundles.find(b => b.active && b.minQty > totalQty);
  if (!next) return null;
  return {
    remaining: next.minQty - totalQty,
    minQty: next.minQty,
    label: next.label
  };
}

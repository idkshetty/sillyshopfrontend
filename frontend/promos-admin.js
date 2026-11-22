import { escapeHTML as e } from './commerce.js';
import { normalizePromos, normalizePromoCode, normalizeBundleTier } from './promotions.js';

/** Admin interface for configuring promo/discount codes and automatic bundle tiers. */
export function mountPromosAdmin(root, { getPromos, onSavePromos }) {
  let disposed = false;
  let dirty = false;
  let busy = false;
  let state = normalizePromos(getPromos?.() || {});

  function render() {
    if (disposed) return;
    root.innerHTML = `<div class="admin-title">
        <div>
          <p class="eyebrow">Offers &amp; incentives</p>
          <h1>Promos &amp; bundle pricing</h1>
          <p>Create discount codes and automatic multi-artwork bundle tiers verified securely on the server during checkout.</p>
        </div>
        <div class="admin-title-actions">
          <button type="button" class="button" id="promos-save-btn" ${busy ? 'disabled' : ''}>Save promos &amp; bundles →</button>
        </div>
      </div>
      <div class="promo-admin-status-row">
        <span id="promos-dirty-pill" class="artist-studio-status ${dirty ? 'is-dirty' : ''}">${dirty ? '● Unsaved changes' : '✓ Live on storefront'}</span>
        <p id="promos-notice" class="notice" role="status"></p>
      </div>
      <div class="promos-admin-grid">
        <section class="dashboard-panel promo-admin-card">
          <div class="panel-heading">
            <div>
              <h2>Promo &amp; discount codes (${state.codes.length})</h2>
              <p>Percentage off, flat ₹ off, or free India Post shipping with optional minimum spend &amp; caps.</p>
            </div>
            <button type="button" class="button outline small" id="add-promo-code-btn" ${state.codes.length >= 25 ? 'disabled' : ''}>+ Add code</button>
          </div>
          <div id="promo-codes-list" class="promo-items-stack">
            ${state.codes.length ? state.codes.map((c, idx) => `<article class="promo-rule-card" data-code-idx="${idx}">
              <div class="promo-rule-head">
                <label class="visibility-toggle"><input type="checkbox" data-code-field="active" data-idx="${idx}" ${c.active ? 'checked' : ''}><span>Active</span></label>
                <button type="button" class="text-link danger-link" data-remove-code="${idx}">Remove</button>
              </div>
              <div class="form-grid">
                <label class="field">Code<input data-code-field="code" data-idx="${idx}" maxlength="24" value="${e(c.code)}" placeholder="e.g. HEHE10"></label>
                <label class="field">Discount type<select data-code-field="type" data-idx="${idx}">
                  <option value="percent" ${c.type === 'percent' ? 'selected' : ''}>Percentage off (%)</option>
                  <option value="fixed" ${c.type === 'fixed' ? 'selected' : ''}>Flat amount off (₹)</option>
                  <option value="free_shipping" ${c.type === 'free_shipping' ? 'selected' : ''}>Free shipping (₹40 off)</option>
                </select></label>
                <label class="field">Value ${c.type === 'percent' ? '(%)' : c.type === 'fixed' ? '(₹)' : '(auto)'}<input type="number" data-code-field="value" data-idx="${idx}" min="0" max="50000" value="${c.type === 'free_shipping' ? 0 : c.value}" ${c.type === 'free_shipping' ? 'disabled' : ''}></label>
                <label class="field">Min artworks subtotal (₹)<input type="number" data-code-field="minSubtotal" data-idx="${idx}" min="0" max="500000" value="${c.minSubtotal}"></label>
                ${c.type === 'percent' ? `<label class="field">Max discount cap (₹, 0 = none)<input type="number" data-code-field="maxDiscount" data-idx="${idx}" min="0" max="50000" value="${c.maxDiscount}"></label>` : ''}
                <label class="field wide">Customer label (shown in bag &amp; checkout)<input data-code-field="label" data-idx="${idx}" maxlength="100" value="${e(c.label)}" placeholder="e.g. 10% welcome treat"></label>
              </div>
            </article>`).join('') : '<div class="empty-state"><p>No promo codes yet. Click "+ Add code" to launch a welcome or seasonal discount.</p></div>'}
          </div>
        </section>

        <section class="dashboard-panel promo-admin-card">
          <div class="panel-heading">
            <div>
              <h2>Automatic bundle pricing (${state.bundles.length})</h2>
              <p>Automatically rewards collectors when they add multiple artworks to their bag — no code needed.</p>
            </div>
            <button type="button" class="button outline small" id="add-bundle-btn" ${state.bundles.length >= 10 ? 'disabled' : ''}>+ Add bundle tier</button>
          </div>
          <div id="promo-bundles-list" class="promo-items-stack">
            ${state.bundles.length ? state.bundles.map((b, idx) => `<article class="promo-rule-card" data-bundle-idx="${idx}">
              <div class="promo-rule-head">
                <label class="visibility-toggle"><input type="checkbox" data-bundle-field="active" data-idx="${idx}" ${b.active ? 'checked' : ''}><span>Active</span></label>
                <button type="button" class="text-link danger-link" data-remove-bundle="${idx}">Remove</button>
              </div>
              <div class="form-grid">
                <label class="field">Min artworks in bag<input type="number" data-bundle-field="minQty" data-idx="${idx}" min="2" max="20" step="1" value="${b.minQty}"></label>
                <label class="field">Discount type<select data-bundle-field="discountType" data-idx="${idx}">
                  <option value="fixed" ${b.discountType === 'fixed' ? 'selected' : ''}>Flat amount off (₹)</option>
                  <option value="percent" ${b.discountType === 'percent' ? 'selected' : ''}>Percentage off (%)</option>
                </select></label>
                <label class="field">Discount value ${b.discountType === 'percent' ? '(%)' : '(₹)'}<input type="number" data-bundle-field="value" data-idx="${idx}" min="1" max="50000" value="${b.value}"></label>
                <label class="field wide">Bundle badge copy<input data-bundle-field="label" data-idx="${idx}" maxlength="120" value="${e(b.label)}" placeholder="e.g. Buy 3+ clay magnets, save ₹50"></label>
              </div>
            </article>`).join('') : '<div class="empty-state"><p>No automatic bundles configured yet. Add a tier like "Buy 3+ artworks, save ₹50".</p></div>'}
          </div>
        </section>
      </div>`;

    bindEvents();
  }

  function updateDirtyUI(msg = '', isError = false) {
    const pill = root.querySelector('#promos-dirty-pill');
    if (pill) {
      pill.textContent = dirty ? '● Unsaved changes' : '✓ Live on storefront';
      pill.classList.toggle('is-dirty', dirty);
    }
    const notice = root.querySelector('#promos-notice');
    if (notice && msg !== undefined) {
      notice.textContent = msg;
      notice.classList.toggle('is-error', isError);
    }
  }

  function bindEvents() {
    root.querySelector('#add-promo-code-btn').onclick = () => {
      const n = state.codes.length + 1;
      state.codes.push({ code: `HEHE${n}0`, active: true, type: 'percent', value: 10, minSubtotal: 0, maxDiscount: 0, label: '10% studio treat' });
      dirty = true;
      render();
    };
    root.querySelector('#add-bundle-btn').onclick = () => {
      const nextMin = Math.min(20, (state.bundles.at(-1)?.minQty || 1) + 2);
      state.bundles.push({ id: `bundle-${Date.now().toString(36)}`, active: true, minQty: Math.max(2, nextMin), discountType: 'fixed', value: 50, label: `Buy ${Math.max(2, nextMin)}+ artworks, save ₹50` });
      dirty = true;
      render();
    };
    root.querySelectorAll('[data-remove-code]').forEach(btn => {
      btn.onclick = () => {
        state.codes.splice(Number(btn.dataset.removeCode), 1);
        dirty = true;
        render();
      };
    });
    root.querySelectorAll('[data-remove-bundle]').forEach(btn => {
      btn.onclick = () => {
        state.bundles.splice(Number(btn.dataset.removeBundle), 1);
        dirty = true;
        render();
      };
    });
    root.querySelectorAll('[data-code-field]').forEach(el => {
      const idx = Number(el.dataset.idx);
      const key = el.dataset.codeField;
      const apply = () => {
        if (!state.codes[idx]) return;
        state.codes[idx][key] = key === 'active' ? el.checked : (['value', 'minSubtotal', 'maxDiscount'].includes(key) ? Number(el.value || 0) : el.value);
        dirty = true;
        updateDirtyUI('');
        if (key === 'type') render();
      };
      if (el.type === 'checkbox' || el.tagName === 'SELECT') el.onchange = apply;
      else el.oninput = apply;
    });
    root.querySelectorAll('[data-bundle-field]').forEach(el => {
      const idx = Number(el.dataset.idx);
      const key = el.dataset.bundleField;
      const apply = () => {
        if (!state.bundles[idx]) return;
        state.bundles[idx][key] = key === 'active' ? el.checked : (['minQty', 'value'].includes(key) ? Number(el.value || 0) : el.value);
        dirty = true;
        updateDirtyUI('');
        if (key === 'discountType') render();
      };
      if (el.type === 'checkbox' || el.tagName === 'SELECT') el.onchange = apply;
      else el.oninput = apply;
    });

    root.querySelector('#promos-save-btn').onclick = async () => {
      if (busy) return;
      const cleanedCodes = [];
      for (const raw of state.codes) {
        const clean = normalizePromoCode(raw);
        if (!clean) {
          updateDirtyUI('Each promo code needs 2–24 letters or numbers.', true);
          return;
        }
        cleanedCodes.push(clean);
      }
      const next = {
        codes: cleanedCodes,
        bundles: state.bundles.map((b, i) => normalizeBundleTier(b, i))
      };
      const unique = normalizePromos(next);
      if (unique.codes.length !== cleanedCodes.length) {
        updateDirtyUI('Promo codes must be unique.', true);
        return;
      }
      busy = true;
      updateDirtyUI('Saving promos & bundles…');
      try {
        await onSavePromos(unique);
        if (disposed) return;
        state = unique;
        dirty = false;
        render();
        updateDirtyUI('Saved. Active codes & bundle discounts apply automatically across bag and checkout.');
      } catch (error) {
        updateDirtyUI(error.message || 'Could not save promos.', true);
      } finally {
        busy = false;
      }
    };
  }

  render();

  return {
    isDirty: () => dirty,
    refresh() {
      if (!dirty && !disposed) {
        state = normalizePromos(getPromos?.() || {});
        render();
      }
    },
    destroy() {
      disposed = true;
    }
  };
}

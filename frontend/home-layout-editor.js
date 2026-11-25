import { escapeHTML as e } from './commerce.js';
import { DEFAULT_HOME_SECTIONS, PROMO_THEMES, normalizePromoBlock, normalizeSectionOrder } from './store-settings.js';

const SECTION_META = {
  banner: { label: 'Homepage hero banner', selector: '[data-hero-banner]', hint: 'Rotating artworks & hero headline' },
  artworks: { label: 'Artworks gallery grid', selector: '#artworks', hint: 'Searchable catalogue & filters' },
  story: { label: 'About / studio story', selector: '.story-block', hint: 'hehe.cafe story section' },
  reviews: { label: 'Customer reviews gallery', selector: '#reviews,.reviews-section', hint: 'Shown when reviews toggle is on' }
};

/** Drag-and-drop homepage section reorderer + up to 3 custom promo block editors. */
export function mountHomeLayoutEditor(container, {
  initialOrder = DEFAULT_HOME_SECTIONS,
  initialBlocks = [],
  onUpload,
  onChange = () => {},
  onHighlight = () => {}
}) {
  let blocks = (Array.isArray(initialBlocks) ? initialBlocks : []).map((b, i) => normalizePromoBlock(b, i));
  let order = normalizeSectionOrder(initialOrder, blocks);
  let draggedId = null;

  function emit(highlightSelector = '') {
    onChange({
      homeSectionOrder: [...order],
      promoBlocks: blocks.map((b, i) => normalizePromoBlock(b, i))
    });
    if (highlightSelector) onHighlight(highlightSelector);
  }

  function selectorForId(id) {
    if (SECTION_META[id]) return SECTION_META[id].selector;
    return `[data-promo-block="${id}"]`;
  }

  function labelForId(id) {
    if (SECTION_META[id]) return SECTION_META[id];
    const block = blocks.find(b => b.id === id);
    const title = block?.heading || block?.eyebrow || 'Untitled promo block';
    return {
      label: `Promo: ${title}`,
      selector: `[data-promo-block="${id}"]`,
      hint: block?.enabled === false ? 'Hidden promo block' : 'Custom editorial/promo block'
    };
  }

  function render() {
    container.innerHTML = `<div class="home-layout-editor">
        <div class="home-layout-subhead">
          <div>
            <h3>Homepage section order</h3>
            <p class="small muted">Drag rows or use arrows to reorder homepage sections &amp; promo blocks.</p>
          </div>
        </div>
        <div class="home-order-list" role="list" aria-label="Homepage sections">
          ${order.map((id, idx) => {
            const meta = labelForId(id);
            return `<div class="home-order-row" role="listitem" draggable="true" data-section-id="${e(id)}" data-highlight="${e(meta.selector)}">
              <span class="home-order-handle" aria-hidden="true">⋮⋮</span>
              <div class="home-order-copy">
                <strong>${e(meta.label)}</strong>
                <span>${e(meta.hint)}</span>
              </div>
              <div class="home-order-arrows">
                <button type="button" class="order-move-btn" data-move-section="${e(id)}" data-dir="-1" aria-label="Move ${e(meta.label)} up" ${idx === 0 ? 'disabled' : ''}><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg></button>
                <button type="button" class="order-move-btn" data-move-section="${e(id)}" data-dir="1" aria-label="Move ${e(meta.label)} down" ${idx === order.length - 1 ? 'disabled' : ''}><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg></button>
              </div>
            </div>`;
          }).join('')}
        </div>

        <div class="promo-blocks-editor">
          <div class="promo-blocks-head">
            <div>
              <h3>Custom promo blocks (${blocks.length}/3)</h3>
              <p class="small muted">Add seasonal drops, bundle announcements or studio invites anywhere on the homepage.</p>
            </div>
            <button type="button" class="button outline small" id="add-promo-block-btn" ${blocks.length >= 3 ? 'disabled' : ''}>+ Add promo block</button>
          </div>
          ${blocks.length ? blocks.map((b, idx) => `<div class="promo-editor-card" data-promo-card="${e(b.id)}">
            <div class="promo-editor-head">
              <strong>Block ${idx + 1} · ${e(b.heading || 'Promo block')}</strong>
              <button type="button" class="text-link danger-link" data-remove-promo="${e(b.id)}">Remove</button>
            </div>
            <label class="visibility-toggle"><input type="checkbox" data-promo-field="enabled" data-promo-id="${e(b.id)}" ${b.enabled !== false ? 'checked' : ''}><span>Show this block on homepage</span></label>
            <div class="form-grid">
              <label class="field">Eyebrow (optional)<input data-promo-field="eyebrow" data-promo-id="${e(b.id)}" maxlength="80" value="${e(b.eyebrow || '')}" placeholder="e.g. Limited studio drop"></label>
              <label class="field">Heading<input data-promo-field="heading" data-promo-id="${e(b.id)}" maxlength="120" value="${e(b.heading || '')}" placeholder="e.g. Build a 3-magnet fridge set"></label>
              <label class="field wide">Body copy<textarea data-promo-field="body" data-promo-id="${e(b.id)}" maxlength="600" rows="2" placeholder="Describe the offer, story or seasonal edit…">${e(b.body || '')}</textarea></label>
              <label class="field">Button text (optional)<input data-promo-field="buttonLabel" data-promo-id="${e(b.id)}" maxlength="50" value="${e(b.buttonLabel || '')}" placeholder="e.g. Shop sets"></label>
              <label class="field">Button link<input data-promo-field="buttonLink" data-promo-id="${e(b.id)}" maxlength="500" value="${e(b.buttonLink || '#shop')}" placeholder="#shop"></label>
              <label class="field">Theme<select data-promo-field="theme" data-promo-id="${e(b.id)}">${PROMO_THEMES.map(([id, label]) => `<option value="${e(id)}" ${b.theme === id ? 'selected' : ''}>${e(label)}</option>`).join('')}</select></label>
              <label class="field">Alignment<select data-promo-field="align" data-promo-id="${e(b.id)}"><option value="left" ${b.align === 'left' ? 'selected' : ''}>Left aligned</option><option value="center" ${b.align === 'center' ? 'selected' : ''}>Centered</option></select></label>
              <label class="field wide">Optional side/feature image URL<input data-promo-field="image" data-promo-id="${e(b.id)}" maxlength="100000" value="${b.image?.startsWith('data:') ? '' : e(b.image || '')}" placeholder="${b.image?.startsWith('data:') ? 'Uploaded image saved · upload below or paste URL' : 'https://… or upload below'}"></label>
              <div class="field wide settings-image-picker">
                ${b.image ? `<img class="back-attach-admin-thumb" src="${e(b.image)}" alt="Promo block preview">` : ''}
                <div class="settings-image-actions">
                  <label class="settings-upload-btn">Upload photo<input type="file" data-promo-upload="${e(b.id)}" accept="image/jpeg,image/png,image/webp"></label>
                  ${b.image ? `<button type="button" class="text-link" data-promo-clear-image="${e(b.id)}">Remove photo</button>` : ''}
                  <span class="settings-upload-status" data-promo-upload-status="${e(b.id)}" role="status">${b.image?.startsWith('data:') ? 'Uploaded photo saved' : ''}</span>
                </div>
              </div>
            </div>
          </div>`).join('') : '<p class="small muted">No custom promo blocks added yet.</p>'}
        </div>
      </div>`;

    bindEvents();
  }

  function moveSection(id, dir) {
    const idx = order.indexOf(id);
    const nextIdx = idx + dir;
    if (idx < 0 || nextIdx < 0 || nextIdx >= order.length) return;
    const copy = [...order];
    const [moved] = copy.splice(idx, 1);
    copy.splice(nextIdx, 0, moved);
    order = copy;
    render();
    emit(selectorForId(id));
  }

  function bindEvents() {
    container.querySelectorAll('.home-order-row').forEach(row => {
      const id = row.dataset.sectionId;
      row.addEventListener('click', ev => {
        if (ev.target.closest('button')) return;
        onHighlight(row.dataset.highlight);
      });
      row.addEventListener('dragstart', ev => {
        draggedId = id;
        row.classList.add('is-dragging');
        if (ev.dataTransfer) {
          ev.dataTransfer.effectAllowed = 'move';
          ev.dataTransfer.setData('text/plain', id);
        }
      });
      row.addEventListener('dragend', () => {
        draggedId = null;
        container.querySelectorAll('.home-order-row').forEach(r => r.classList.remove('is-dragging', 'is-drop-target'));
      });
      row.addEventListener('dragover', ev => {
        if (!draggedId || draggedId === id) return;
        ev.preventDefault();
        container.querySelectorAll('.home-order-row').forEach(r => r.classList.toggle('is-drop-target', r === row));
      });
      row.addEventListener('drop', ev => {
        ev.preventDefault();
        if (!draggedId || draggedId === id) return;
        const from = order.indexOf(draggedId);
        const to = order.indexOf(id);
        if (from < 0 || to < 0) return;
        const copy = [...order];
        const [moved] = copy.splice(from, 1);
        copy.splice(to, 0, moved);
        order = copy;
        render();
        emit(selectorForId(id));
      });
    });

    container.querySelectorAll('[data-move-section]').forEach(btn => {
      btn.onclick = () => moveSection(btn.dataset.moveSection, Number(btn.dataset.dir) || 0);
    });

    const addBtn = container.querySelector('#add-promo-block-btn');
    if (addBtn) {
      addBtn.onclick = () => {
        if (blocks.length >= 3) return;
        const fresh = normalizePromoBlock({
          id: `promo-${Date.now().toString(36)}`,
          enabled: true,
          eyebrow: 'Studio highlight',
          heading: 'Handmade in small batches',
          body: 'Combine any 3 artworks in your art bag for automatic bundle savings.',
          buttonLabel: 'Explore artworks',
          buttonLink: '#artworks',
          theme: 'warm-paper',
          align: 'left'
        }, blocks.length);
        blocks = [...blocks, fresh];
        order = normalizeSectionOrder([...order, fresh.id], blocks);
        render();
        emit(`[data-promo-block="${fresh.id}"]`);
      };
    }

    container.querySelectorAll('[data-remove-promo]').forEach(btn => {
      btn.onclick = () => {
        const targetId = btn.dataset.removePromo;
        blocks = blocks.filter(b => b.id !== targetId);
        order = normalizeSectionOrder(order, blocks);
        render();
        emit();
      };
    });

    container.querySelectorAll('[data-promo-field]').forEach(el => {
      const id = el.dataset.promoId;
      const key = el.dataset.promoField;
      const updateField = () => {
        blocks = blocks.map(b => b.id === id ? { ...b, [key]: key === 'enabled' ? el.checked : el.value } : b);
        emit(`[data-promo-block="${id}"]`);
      };
      el.addEventListener('focus', () => onHighlight(`[data-promo-block="${id}"]`));
      if (el.type === 'checkbox' || el.tagName === 'SELECT') el.addEventListener('change', updateField);
      else el.addEventListener('input', updateField);
    });

    container.querySelectorAll('[data-promo-clear-image]').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.promoClearImage;
        blocks = blocks.map(b => b.id === id ? { ...b, image: '' } : b);
        render();
        emit(`[data-promo-block="${id}"]`);
      };
    });

    container.querySelectorAll('[data-promo-upload]').forEach(input => {
      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        const id = input.dataset.promoUpload;
        const statusEl = container.querySelector(`[data-promo-upload-status="${CSS.escape(id)}"]`);
        if (!file || !onUpload) return;
        if (statusEl) { statusEl.classList.remove('is-error'); statusEl.textContent = 'Preparing photo…'; }
        try {
          const url = await onUpload(file);
          blocks = blocks.map(b => b.id === id ? { ...b, image: url } : b);
          render();
          emit(`[data-promo-block="${id}"]`);
        } catch (err) {
          if (statusEl) { statusEl.classList.add('is-error'); statusEl.textContent = err?.message || 'Could not upload photo.'; }
        } finally {
          input.value = '';
        }
      });
    });
  }

  render();

  return {
    getValue() {
      return {
        homeSectionOrder: [...order],
        promoBlocks: blocks.map((b, i) => normalizePromoBlock(b, i))
      };
    },
    setBlockField(blockId, key, value) {
      blocks = blocks.map(b => b.id === blockId ? { ...b, [key]: value } : b);
      const input = container.querySelector(`[data-promo-id="${CSS.escape(blockId)}"][data-promo-field="${CSS.escape(key)}"]`);
      if (input) {
        if (input.type === 'checkbox') input.checked = Boolean(value);
        else if (input.value !== String(value)) input.value = String(value);
      }
      if (key === 'heading' || key === 'eyebrow') {
        const idx = blocks.findIndex(b => b.id === blockId);
        const block = blocks[idx];
        const cardTitle = container.querySelector(`[data-promo-card="${CSS.escape(blockId)}"] .promo-editor-head strong`);
        if (cardTitle && block) cardTitle.textContent = `Block ${idx + 1} · ${block.heading || 'Promo block'}`;
        const rowTitle = container.querySelector(`.home-order-row[data-section-id="${CSS.escape(blockId)}"] .home-order-copy strong`);
        if (rowTitle && block) rowTitle.textContent = `Promo: ${block.heading || block.eyebrow || 'Untitled promo block'}`;
      }
      emit();
    },
    destroy() {}
  };
}

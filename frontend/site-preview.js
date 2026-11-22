import { editorPreview, previewPageOptions, hashForPreviewPage } from './content-editor.js';
import { escapeHTML as e } from './commerce.js';
import { mountInlineEditing, readInlinePref, writeInlinePref, inlineToolbarMarkup, inlineHintMarkup } from './inline-edit.js';

/** Mount a responsive sandboxed live preview panel for any storefront route. */
export function mountSitePreviewPanel(container, {
  getContent,
  getProducts,
  getSettings,
  getHeader,
  getArtists,
  initialPage = 'home',
  pageOptions = null,
  compactToggle = false,
  title = 'Live site preview',
  height = 560,
  inlineTargets = null,
  onInlineStart,
  onInlineInput,
  onInlineCommit,
  onInlinePick
}) {
  let page = initialPage || 'home';
  let device = 'desktop';
  let previousPage = page;
  let lastHtml = '';
  let timer = null;
  let disposed = false;
  let activeHighlightSelector = '';
  let pendingHighlightScroll = false;
  let pendingRender = false;
  let commitTimer = null;

  const applyFrameHighlight = (selector = activeHighlightSelector, scroll = false) => {
    const doc = container.querySelector('iframe')?.contentDocument;
    if (!doc) return;
    doc.querySelectorAll('[data-edit-highlight]').forEach(el => el.removeAttribute('data-edit-highlight'));
    if (!selector) return;
    let target = null;
    for (const part of String(selector).split('||')) {
      const sel = part.trim();
      if (!sel) continue;
      target = doc.querySelector(sel);
      if (target) break;
    }
    if (!target) return;
    target.setAttribute('data-edit-highlight', 'true');
    if (scroll) target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  };

  const computeOptions = () => {
    if (Array.isArray(pageOptions)) return pageOptions;
    if (typeof pageOptions === 'function') return pageOptions();
    return previewPageOptions(getArtists?.() || [], getProducts?.() || []);
  };

  const renderControls = opts => {
    if (compactToggle) {
      return `<div class="site-preview-tabs" role="tablist" aria-label="${e(title)}">${opts.map(([id, label]) => `<button type="button" class="site-preview-tab ${id === page ? 'is-active' : ''}" data-preview-tab="${e(id)}" role="tab" aria-selected="${id === page}">${e(label)}</button>`).join('')}</div>`;
    }
    return `<label>${e(title)}<select data-preview-page-select aria-label="Preview page">${opts.map(([id, label]) => `<option value="${e(id)}" ${id === page ? 'selected' : ''}>${e(label)}</option>`).join('')}</select></label>`;
  };

  const initialOpts = computeOptions();
  const inlineAvailable = typeof inlineTargets === 'function';
  const inlineOn = inlineAvailable && readInlinePref();
  container.innerHTML = `<section class="content-preview site-preview-card" aria-label="${e(title)}">
    <div class="content-preview-toolbar">
      <div class="site-preview-switcher">${renderControls(initialOpts)}</div>
      <div class="content-devices-group">
        ${inlineAvailable ? inlineToolbarMarkup(inlineOn) : ''}
        <div class="content-devices" role="group" aria-label="Preview screen size">
          <button type="button" data-device="desktop" aria-pressed="true">Desktop</button>
          <button type="button" data-device="mobile" aria-pressed="false">Mobile</button>
        </div>
        <a class="content-preview-open-link button outline small" data-preview-live-link href="${e(hashForPreviewPage(page, getProducts?.() || []))}" data-action="close-dialog">Open live ↗</a>
      </div>
    </div>
    ${inlineAvailable ? inlineHintMarkup(inlineOn) : ''}
    <div class="content-preview-stage">
      <div class="content-preview-frame"><iframe title="${e(title)}" sandbox="allow-same-origin" tabindex="-1"></iframe></div>
    </div>
  </section>`;

  const switcher = container.querySelector('.site-preview-switcher');
  const stage = container.querySelector('.content-preview-stage');
  const holder = container.querySelector('.content-preview-frame');
  const frame = container.querySelector('iframe');
  const liveLink = container.querySelector('[data-preview-live-link]');

  const inline = inlineAvailable ? mountInlineEditing({
    frame,
    enabled: inlineOn,
    getTargets: () => inlineTargets(page) || [],
    onStart: onInlineStart,
    onInput: onInlineInput,
    onCommit: (target, text, info) => {
      try { onInlineCommit?.(target, text, info); } finally {
        clearTimeout(commitTimer);
        if (!info?.switching && (info?.changed || pendingRender)) {
          commitTimer = setTimeout(() => {
            if (!inline.isEditing()) {
              pendingRender = false;
              renderFrame();
            }
          }, 40);
        }
      }
    },
    onPick: onInlinePick,
    onState: active => container.classList.toggle('is-inline-editing', active)
  }) : null;
  const inlineToggle = container.querySelector('[data-inline-toggle]');
  const inlineHint = container.querySelector('[data-inline-hint]');
  if (inlineToggle && inline) {
    inlineToggle.onclick = () => {
      const next = !inline.isEnabled();
      inline.setEnabled(next);
      writeInlinePref(next);
      inlineToggle.classList.toggle('is-on', next);
      inlineToggle.setAttribute('aria-pressed', String(next));
      if (inlineHint) inlineHint.hidden = !next;
    };
  }

  function size() {
    if (disposed || !stage.isConnected) return;
    const avail = Math.max(240, (stage.clientWidth || 720) - 24);
    const width = device === 'mobile' ? 390 : 1200;
    const scale = Math.min(1, avail / width);
    holder.style.width = `${width}px`;
    holder.style.height = `${height / scale}px`;
    holder.style.transform = `scale(${scale})`;
    stage.style.height = `${height + 24}px`;
  }

  function renderFrame() {
    if (disposed || !frame.isConnected) return;
    if (inline && inline.isEditing()) { pendingRender = true; return; }
    const prods = getProducts?.() || [];
    if (liveLink) liveLink.setAttribute('href', hashForPreviewPage(page, prods));
    const html = editorPreview(
      getContent?.() || {},
      page,
      prods,
      getSettings?.() || {},
      getHeader?.() || '',
      getArtists?.() || []
    );
    if (html !== lastHtml) {
      const scrollTop = page === previousPage ? (frame.contentDocument?.documentElement.scrollTop || 0) : 0;
      previousPage = page;
      lastHtml = html;
      frame.onload = () => {
        frame.contentWindow?.scrollTo(0, scrollTop);
        applyFrameHighlight(activeHighlightSelector, pendingHighlightScroll);
        pendingHighlightScroll = false;
        inline?.bind();
      };
      frame.srcdoc = html;
    } else {
      if (activeHighlightSelector) {
        applyFrameHighlight(activeHighlightSelector, pendingHighlightScroll);
        pendingHighlightScroll = false;
      }
      inline?.refresh();
    }
    size();
  }

  function syncSwitcher() {
    const opts = computeOptions();
    if (!opts.some(([id]) => id === page) && opts[0]) page = opts[0][0];
    if (compactToggle) {
      switcher.innerHTML = renderControls(opts);
      switcher.querySelectorAll('[data-preview-tab]').forEach(btn => {
        btn.onclick = () => { page = btn.dataset.previewTab; syncSwitcher(); renderFrame(); };
      });
    } else {
      const sel = switcher.querySelector('[data-preview-page-select]');
      if (sel) {
        sel.innerHTML = opts.map(([id, label]) => `<option value="${e(id)}" ${id === page ? 'selected' : ''}>${e(label)}</option>`).join('');
        sel.value = page;
        sel.onchange = () => { page = sel.value; renderFrame(); };
      }
    }
  }

  switcher.querySelectorAll('[data-preview-tab]').forEach(btn => {
    btn.onclick = () => { page = btn.dataset.previewTab; syncSwitcher(); renderFrame(); };
  });
  const sel = switcher.querySelector('[data-preview-page-select]');
  if (sel) sel.onchange = () => { page = sel.value; renderFrame(); };

  container.querySelectorAll('[data-device]').forEach(btn => {
    btn.onclick = () => {
      device = btn.dataset.device;
      container.querySelectorAll('[data-device]').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
      size();
    };
  });

  const observer = new ResizeObserver(size);
  observer.observe(stage);
  renderFrame();
  requestAnimationFrame(size);

  return {
    update(nextPage) {
      if (disposed) return;
      if (nextPage) page = nextPage;
      clearTimeout(timer);
      timer = setTimeout(() => {
        syncSwitcher();
        renderFrame();
      }, 120);
    },
    setPage(nextPage) {
      if (disposed || !nextPage) return;
      page = nextPage;
      syncSwitcher();
      renderFrame();
    },
    highlight(selector, { page: targetPage = null, scroll = true } = {}) {
      if (disposed) return;
      activeHighlightSelector = selector || '';
      pendingHighlightScroll = Boolean(scroll && activeHighlightSelector);
      if (targetPage && targetPage !== page) {
        const opts = computeOptions();
        if (opts.some(([id]) => id === targetPage)) {
          page = targetPage;
          syncSwitcher();
          renderFrame();
          return;
        }
      }
      applyFrameHighlight(activeHighlightSelector, pendingHighlightScroll);
      pendingHighlightScroll = false;
    },
    destroy() {
      disposed = true;
      clearTimeout(timer);
      clearTimeout(commitTimer);
      inline?.destroy();
      observer.disconnect();
    }
  };
}

/** Open the global site preview dialog showing any storefront route. */
export function openSitePreviewModal(dialogEl, opts = {}) {
  if (!dialogEl) return { destroy() {} };
  dialogEl.innerHTML = `<div class="drawer-header">
      <div><p class="eyebrow">hehe.cafe / Live preview</p><h2 id="site-preview-title">Site preview</h2></div>
      <button type="button" class="icon-button" data-action="close-dialog" aria-label="Close site preview"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
    </div>
    <div id="site-preview-modal-body"></div>`;
  if (!dialogEl.open) dialogEl.showModal();
  const body = dialogEl.querySelector('#site-preview-modal-body');
  const controller = mountSitePreviewPanel(body, { ...opts, height: 600, title: 'Preview page' });
  const onClose = () => controller.destroy();
  dialogEl.addEventListener('close', onClose, { once: true });
  return controller;
}

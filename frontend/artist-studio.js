import { artistSlug, normalizeArtist, normalizeArtists, mergeArtistsWithProducts, safeArtistLink } from './artists.js';
import { escapeHTML as e, safeImage } from './commerce.js';
import { isInlineImage } from './image-data.js';
import { mountSitePreviewPanel } from './site-preview.js';
import { flashControl } from './inline-edit.js';

const ACCENT_SWATCHES = [
  ['#d96b43', 'Terracotta'],
  ['#2c6e49', 'Forest sage'],
  ['#245a9f', 'Cobalt'],
  ['#6b4c7a', 'Plum iris'],
  ['#b5651d', 'Warm ochre'],
  ['#181715', 'Gallery black']
];

/** Full-freedom Admin Artist Pages Studio with live side-by-side site preview. */
export function mountArtistStudio(root, {
  getArtists,
  getProducts,
  getContent,
  getSettings,
  getHeader,
  onUpload,
  onSaveArtists
}) {
  let disposed = false;
  let dirty = false;
  let busy = false;
  let previewController = null;

  const currentProducts = () => getProducts?.() || [];
  const allSaved = () => normalizeArtists(getArtists?.() || []);
  const allCombined = () => mergeArtistsWithProducts(allSaved(), currentProducts(), { includeHidden: true });

  const initialCombined = allCombined();
  let selectedId = initialCombined[0]?.id || 'suprita-chatterjee';
  let draft = normalizeArtist(initialCombined[0] || {});
  let editingOriginalId = draft.id;
  let slugManuallyEdited = false;

  const buildPreviewArtists = () => {
    const base = allSaved().filter(a => a.id !== editingOriginalId && a.id !== draft.id);
    const active = normalizeArtist(draft);
    return [active, ...base];
  };

  function selectArtistById(id, { force = false } = {}) {
    if (!force && dirty && !window.confirm('You have unsaved changes on this artist page. Switch anyway?')) return;
    const match = allCombined().find(a => a.id === id) || allCombined()[0];
    if (!match) return;
    selectedId = match.id;
    editingOriginalId = match.id;
    draft = normalizeArtist(match);
    dirty = false;
    slugManuallyEdited = false;
    renderWorkspace();
  }

  function createBlankArtist(seed = null) {
    if (dirty && !window.confirm('Discard unsaved edits before creating a new artist page?')) return;
    const existingIds = new Set(allCombined().map(a => a.id));
    let n = 1;
    const baseName = seed ? `${seed.name} (copy)` : 'New Artist';
    let candidate = artistSlug(baseName);
    while (existingIds.has(candidate)) {
      n += 1;
      candidate = `${artistSlug(baseName)}-${n}`;
    }
    draft = normalizeArtist({
      ...(seed ? seed : {}),
      id: candidate,
      name: seed ? baseName : '',
      visible: true,
      featured: false
    });
    selectedId = candidate;
    editingOriginalId = null;
    dirty = true;
    slugManuallyEdited = false;
    renderWorkspace();
  }

  function updateStatusText(msg = '', isError = false) {
    const notice = root.querySelector('#artist-studio-notice');
    if (notice) {
      notice.textContent = msg;
      notice.classList.toggle('is-error', isError);
    }
    const badge = root.querySelector('#artist-studio-dirty');
    if (badge) {
      badge.textContent = dirty ? '● Unsaved draft' : '✓ Saved live';
      badge.classList.toggle('is-dirty', dirty);
    }
  }

  function paintPreview() {
    previewController?.update(`artist:${draft.id || 'artist'}`);
  }

  function renderSectionsHtml() {
    const list = Array.isArray(draft.sections) ? draft.sections : [];
    if (!list.length) {
      return '<p class="small muted">No extra sections yet. Add process notes, exhibition highlights, commissions info or FAQs.</p>';
    }
    return list.map((sec, idx) => `<div class="artist-section-editor-card" data-sec-idx="${idx}">
        <div class="artist-section-editor-head">
          <strong>Section ${idx + 1}</strong>
          <button type="button" class="text-link danger-link" data-remove-section="${idx}">Remove</button>
        </div>
        <label class="field">Section heading<input data-sec-heading="${idx}" maxlength="120" value="${e(sec.heading || '')}" placeholder="e.g. Behind the clay / Commissions"></label>
        <label class="field">Section copy<textarea data-sec-body="${idx}" maxlength="2000" rows="3" placeholder="Write freely about studio process, inspirations or custom orders…">${e(sec.body || '')}</textarea></label>
      </div>`).join('');
  }

  function renderWorkspace() {
    if (disposed) return;
    previewController?.destroy();
    previewController = null;

    const combined = allCombined();
    const isNew = editingOriginalId === null;
    const canDelete = !isNew && allSaved().length > 1 && allSaved().some(a => a.id === editingOriginalId);
    const artCounts = new Map(combined.map(a => [a.id, a.artworkCount || 0]));

    root.innerHTML = `<div class="admin-title">
        <div>
          <h1>Artist pages</h1>
          <p>Add new artists, customize every page URL, banner, accent color, story and custom sections with live site preview.</p>
        </div>
        <div class="artist-studio-header-actions">
          <button type="button" class="button" id="artist-add-btn">+ Add artist page</button>
        </div>
      </div>
      <div class="artist-studio-tabs" role="tablist" aria-label="Choose an artist page to edit">
        ${combined.map(a => `<button type="button" class="artist-studio-pill ${a.id === selectedId ? 'is-active' : ''}" data-pick-artist="${e(a.id)}" role="tab" aria-selected="${a.id === selectedId}">
            <img src="${e(safeImage(a.coverImage || a.photo, 'https://img3.pixhost.to/images/7410/814393231_artwork.jpg'))}" alt="">
            <span>
              <strong>${e(a.name)}</strong>
              <small>${artCounts.get(a.id) || 0} works${a.visible === false ? ' · Hidden' : ''}${a.featured ? ' · Featured' : ''}</small>
            </span>
          </button>`).join('')}
        ${isNew ? `<button type="button" class="artist-studio-pill is-active is-new" role="tab" aria-selected="true"><span><strong>+ ${e(draft.name || 'New Artist')}</strong><small>Unsaved page</small></span></button>` : ''}
      </div>
      <div class="content-workspace artist-studio-workspace">
        <form id="artist-studio-form" class="artist-studio-form">
          <div class="artist-studio-toolbar">
            <span id="artist-studio-dirty" class="artist-studio-status ${dirty ? 'is-dirty' : ''}">${dirty ? '● Unsaved draft' : '✓ Saved live'}</span>
            <div class="artist-studio-toolbar-btns">
              ${!isNew ? `<button type="button" class="button outline small" id="artist-duplicate-btn">Duplicate page</button>` : ''}
              <button type="submit" class="button small" id="artist-save-btn">${isNew ? 'Publish artist page →' : 'Save artist page →'}</button>
            </div>
          </div>
          <p id="artist-studio-notice" class="notice" role="status"></p>

          <details class="content-group" open>
            <summary>Identity, URL &amp; visibility<span>5</span></summary>
            <div class="content-fields">
              <label class="field">Artist name<input name="name" required maxlength="120" value="${e(draft.name)}" placeholder="e.g. Aarav Kapoor"></label>
              <label class="field">Page URL slug (#artist/${e(draft.id || 'name')})<input name="slug" required maxlength="100" value="${e(draft.id)}" placeholder="e.g. aarav-kapoor"></label>
              <label class="field">Signature style pill<input name="style" required maxlength="120" value="${e(draft.style)}" placeholder="e.g. Hand-Sculpted Clay &amp; Watercolour"></label>
              <label class="field">Studio location (optional)<input name="location" maxlength="100" value="${e(draft.location || '')}" placeholder="e.g. Bengaluru, India"></label>
              <label class="visibility-toggle"><input type="checkbox" name="visible" ${draft.visible !== false ? 'checked' : ''}>Show in Artists directory</label>
              <label class="visibility-toggle"><input type="checkbox" name="featured" ${draft.featured ? 'checked' : ''}>Feature artist at top of directory</label>
            </div>
          </details>

          <details class="content-group" open>
            <summary>Page banner, photos &amp; accent theme<span>6</span></summary>
            <div class="content-fields">
              <label class="field">Banner eyebrow (optional)<input name="bannerEyebrow" maxlength="80" value="${e(draft.bannerEyebrow || '')}" placeholder="e.g. hehe.cafe · resident artist"></label>
              <label class="field">Banner heading override (blank uses artist name)<input name="bannerTitle" maxlength="120" value="${e(draft.bannerTitle || '')}" placeholder="${e(draft.name || 'Artist name')}"></label>
              <div class="field">
                <span>Page accent color</span>
                <div class="artist-accent-swatches">
                  ${ACCENT_SWATCHES.map(([hex, label]) => `<button type="button" class="artist-accent-swatch ${(draft.accentColor || '#d96b43') === hex ? 'is-active' : ''}" data-accent="${hex}" title="${label}" aria-label="${label} (${hex})" style="background:${hex}"></button>`).join('')}
                  <input type="color" name="accentColor" value="${e(draft.accentColor || '#d96b43')}" aria-label="Custom accent color">
                  <button type="button" class="text-link" data-accent-reset>Reset</button>
                </div>
              </div>
              <label class="field">Portrait / card photo URL<input name="photo" maxlength="100000" data-saved-photo="${isInlineImage(draft.photo)}" value="${isInlineImage(draft.photo) ? '' : e(draft.photo || '')}" placeholder="${isInlineImage(draft.photo) ? 'Uploaded photo saved · paste URL or upload new below' : 'https://… or upload below'}"></label>
              <div class="content-image-control">
                <img id="artist-photo-thumb" src="${e(safeImage(draft.photo, 'https://img3.pixhost.to/images/7410/814393231_artwork.jpg'))}" alt="Artist portrait preview">
                <label class="content-upload">Upload portrait photo<input type="file" id="artist-upload-photo" accept="image/jpeg,image/png,image/webp"></label>
              </div>
              <label class="field">Banner backdrop photo URL (optional full-bleed header bg)<input name="bannerImage" maxlength="100000" data-saved-banner="${isInlineImage(draft.bannerImage)}" value="${isInlineImage(draft.bannerImage) ? '' : e(draft.bannerImage || '')}" placeholder="${isInlineImage(draft.bannerImage) ? 'Banner photo saved · paste URL or upload new' : 'Optional hero backdrop image URL'}"></label>
              <div class="content-image-control">
                <img id="artist-banner-thumb" src="${e(safeImage(draft.bannerImage, 'https://img3.pixhost.to/images/7410/814393231_artwork.jpg'))}" alt="Banner backdrop preview" ${draft.bannerImage ? '' : 'style="opacity:.35"'}>
                <label class="content-upload">Upload banner backdrop<input type="file" id="artist-upload-banner" accept="image/jpeg,image/png,image/webp"></label>
                ${draft.bannerImage ? '<button type="button" class="text-link" id="artist-clear-banner">Remove banner</button>' : ''}
              </div>
            </div>
          </details>

          <details class="content-group" open>
            <summary>Story, quote &amp; gallery heading<span>4</span></summary>
            <div class="content-fields">
              <label class="field">One-liner for Artists directory card<input name="oneLiner" required maxlength="220" value="${e(draft.oneLiner || '')}" placeholder="Short poetic summary shown on directory cards…"></label>
              <label class="field">About the artist / studio story<textarea name="about" maxlength="4000" rows="6" placeholder="Share background, materials, technique and studio notes…">${e(draft.about || '')}</textarea></label>
              <label class="field">Pull quote (optional blockquote)<input name="quote" maxlength="400" value="${e(draft.quote || '')}" placeholder="e.g. Every tiny imperfection reminds you a real hand shaped this."></label>
              <label class="field">Artworks grid heading override (optional)<input name="worksHeading" maxlength="120" value="${e(draft.worksHeading || '')}" placeholder="Auto: Artworks by ${e(draft.name || 'Artist')}"></label>
            </div>
          </details>

          <details class="content-group">
            <summary>Social links &amp; custom page blocks<span>${2 + (draft.sections?.length || 0)}</span></summary>
            <div class="content-fields">
              <label class="field">Instagram handle or URL (optional)<input name="instagram" maxlength="200" value="${e(draft.instagram || '')}" placeholder="@handle or https://instagram.com/..."></label>
              <label class="field">Website or portfolio HTTPS URL (optional)<input name="website" maxlength="300" value="${e(draft.website || '')}" placeholder="https://…"></label>
              <div class="artist-sections-box">
                <div class="artist-sections-head">
                  <strong>Custom page sections (up to 4)</strong>
                  <button type="button" class="button outline small" id="artist-add-section" ${(draft.sections?.length || 0) >= 4 ? 'disabled' : ''}>+ Add section</button>
                </div>
                <div id="artist-sections-list">${renderSectionsHtml()}</div>
              </div>
            </div>
          </details>

          <div class="editor-actions artist-studio-actions">
            ${canDelete ? `<button type="button" class="danger-link" id="artist-delete-btn">Delete artist page</button>` : '<span></span>'}
            <button type="submit" class="button">${isNew ? 'Publish artist page →' : 'Save artist page →'}</button>
          </div>
        </form>

        <div id="artist-studio-preview-slot"></div>
      </div>`;

    const form = root.querySelector('#artist-studio-form');
    const slugInput = form.elements.slug;

    const captureForm = () => {
      const nameVal = String(form.elements.name.value || '');
      if (!slugManuallyEdited && editingOriginalId === null) {
        slugInput.value = artistSlug(nameVal || 'new-artist');
      }
      const nextSections = (draft.sections || []).map((_, idx) => ({
        heading: root.querySelector(`[data-sec-heading="${idx}"]`)?.value || '',
        body: root.querySelector(`[data-sec-body="${idx}"]`)?.value || ''
      }));
      const typedPhoto = String(form.elements.photo.value || '').trim();
      const typedBanner = String(form.elements.bannerImage.value || '').trim();
      draft = {
        ...draft,
        id: artistSlug(slugInput.value || nameVal),
        name: nameVal,
        style: form.elements.style.value,
        location: form.elements.location.value,
        visible: form.elements.visible.checked,
        featured: form.elements.featured.checked,
        bannerEyebrow: form.elements.bannerEyebrow.value,
        bannerTitle: form.elements.bannerTitle.value,
        accentColor: form.elements.accentColor.value,
        photo: typedPhoto || (form.elements.photo.dataset.savedPhoto === 'true' ? draft.photo : ''),
        bannerImage: typedBanner || (form.elements.bannerImage.dataset.savedBanner === 'true' ? draft.bannerImage : ''),
        oneLiner: form.elements.oneLiner.value,
        about: form.elements.about.value,
        quote: form.elements.quote.value,
        worksHeading: form.elements.worksHeading.value,
        instagram: form.elements.instagram.value,
        website: form.elements.website.value,
        sections: nextSections
      };
      dirty = true;
      updateStatusText();
      paintPreview();
    };

    root.querySelector('#artist-add-btn').onclick = () => createBlankArtist(null);
    const dupBtn = root.querySelector('#artist-duplicate-btn');
    if (dupBtn) dupBtn.onclick = () => createBlankArtist(draft);

    root.querySelectorAll('[data-pick-artist]').forEach(btn => {
      btn.onclick = () => selectArtistById(btn.dataset.pickArtist);
    });

    slugInput.addEventListener('input', () => { slugManuallyEdited = true; });
    form.addEventListener('input', captureForm);
    form.addEventListener('change', event => {
      if (event.target.type === 'file') return;
      captureForm();
    });

    root.querySelectorAll('[data-accent]').forEach(btn => {
      btn.onclick = () => {
        form.elements.accentColor.value = btn.dataset.accent;
        root.querySelectorAll('[data-accent]').forEach(b => b.classList.toggle('is-active', b === btn));
        captureForm();
      };
    });
    root.querySelector('[data-accent-reset]').onclick = () => {
      form.elements.accentColor.value = '#d96b43';
      draft.accentColor = '';
      dirty = true;
      updateStatusText();
      paintPreview();
    };

    const bindUpload = (inputId, targetKey, thumbId) => {
      const input = root.querySelector(inputId);
      if (!input) return;
      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file) return;
        updateStatusText('Uploading image…');
        try {
          const url = await onUpload(file);
          if (disposed || !root.isConnected) return;
          draft[targetKey] = url;
          const textInput = form.elements[targetKey];
          if (textInput) {
            textInput.value = '';
            textInput.dataset[targetKey === 'photo' ? 'savedPhoto' : 'savedBanner'] = 'true';
          }
          const thumb = root.querySelector(thumbId);
          if (thumb) { thumb.src = url; thumb.style.opacity = '1'; }
          dirty = true;
          updateStatusText('Photo ready in preview. Save artist page to publish.');
          paintPreview();
        } catch (error) {
          updateStatusText(error.message || 'Could not upload photo.', true);
        } finally {
          input.value = '';
        }
      });
    };
    bindUpload('#artist-upload-photo', 'photo', '#artist-photo-thumb');
    bindUpload('#artist-upload-banner', 'bannerImage', '#artist-banner-thumb');

    const clearBannerBtn = root.querySelector('#artist-clear-banner');
    if (clearBannerBtn) {
      clearBannerBtn.onclick = () => {
        draft.bannerImage = '';
        form.elements.bannerImage.value = '';
        form.elements.bannerImage.dataset.savedBanner = 'false';
        dirty = true;
        renderWorkspace();
      };
    }

    root.querySelector('#artist-add-section').onclick = () => {
      captureForm();
      if ((draft.sections || []).length >= 4) return;
      draft.sections = [...(draft.sections || []), { heading: '', body: '' }];
      root.querySelector('#artist-sections-list').innerHTML = renderSectionsHtml();
      root.querySelector('#artist-add-section').disabled = draft.sections.length >= 4;
      bindSectionDeletes();
      paintPreview();
    };

    function bindSectionDeletes() {
      root.querySelectorAll('[data-remove-section]').forEach(btn => {
        btn.onclick = () => {
          captureForm();
          const idx = Number(btn.dataset.removeSection);
          draft.sections = (draft.sections || []).filter((_, i) => i !== idx);
          root.querySelector('#artist-sections-list').innerHTML = renderSectionsHtml();
          root.querySelector('#artist-add-section').disabled = draft.sections.length >= 4;
          bindSectionDeletes();
          paintPreview();
        };
      });
    }
    bindSectionDeletes();

    const delBtn = root.querySelector('#artist-delete-btn');
    if (delBtn) {
      delBtn.onclick = async () => {
        if (!window.confirm(`Delete the artist page for "${draft.name}"? Artworks by this artist stay in your catalogue.`)) return;
        const remaining = allSaved().filter(a => a.id !== editingOriginalId);
        if (!remaining.length) return;
        try {
          await onSaveArtists(remaining);
          if (disposed) return;
          dirty = false;
          selectArtistById(remaining[0].id, { force: true });
        } catch (error) {
          updateStatusText(error.message || 'Could not remove artist page.', true);
        }
      };
    }

    form.onsubmit = async event => {
      event.preventDefault();
      if (busy) return;
      captureForm();
      const cleaned = normalizeArtist(draft);
      if (!cleaned.name || !cleaned.style || !cleaned.oneLiner) {
        updateStatusText('Enter the artist name, signature style pill and directory one-liner.', true);
        return;
      }
      if (draft.instagram && !safeArtistLink(draft.instagram, 'instagram')) {
        updateStatusText('Use a valid @handle or HTTPS URL for Instagram.', true);
        return;
      }
      if (draft.website && !safeArtistLink(draft.website, 'website')) {
        updateStatusText('Use a valid HTTPS URL for Website.', true);
        return;
      }
      busy = true;
      const saveBtn = root.querySelector('#artist-save-btn');
      if (saveBtn) saveBtn.disabled = true;
      updateStatusText('Saving artist page…');
      try {
        const nextList = [cleaned, ...allSaved().filter(a => a.id !== editingOriginalId && a.id !== cleaned.id)];
        await onSaveArtists(nextList);
        if (disposed) return;
        dirty = false;
        selectedId = cleaned.id;
        editingOriginalId = cleaned.id;
        draft = normalizeArtist(cleaned);
        renderWorkspace();
        updateStatusText(`Saved artist page for ${cleaned.name}.`);
      } catch (error) {
        updateStatusText(error.message || 'Could not save artist page.', true);
      } finally {
        busy = false;
        if (saveBtn?.isConnected) saveBtn.disabled = false;
      }
    };

    const resolveArtistFormControl = id => {
      if (id.startsWith('secHeading:')) return root.querySelector(`[data-sec-heading="${id.slice(11)}"]`);
      if (id.startsWith('secBody:')) return root.querySelector(`[data-sec-body="${id.slice(8)}"]`);
      return form.elements[id] || null;
    };

    const syncArtistField = (id, text) => {
      const ctrl = resolveArtistFormControl(id);
      if (ctrl && ctrl.value !== text) ctrl.value = text;
      if (id.startsWith('secHeading:') || id.startsWith('secBody:')) {
        const isHead = id.startsWith('secHeading:');
        const idx = Number(id.slice(isHead ? 11 : 8));
        draft.sections = (draft.sections || []).map((s, i) => i === idx ? { ...s, [isHead ? 'heading' : 'body']: text } : s);
      } else if (id === 'name') {
        draft.name = text;
        if (!slugManuallyEdited && editingOriginalId === null) {
          slugInput.value = artistSlug(text || 'new-artist');
          draft.id = artistSlug(slugInput.value || text);
        }
      } else {
        draft[id] = text;
      }
      dirty = true;
      updateStatusText();
    };

    const buildArtistInlineTargets = activePage => {
      const hasBannerHeading = Boolean(String(draft.bannerTitle || '').trim());
      if (activePage === 'artists') {
        const cardSel = `a[href="#artist/${draft.id || 'artist'}"]`;
        return [
          { id: 'name', selector: `${cardSel} h2`, kinds: ['artists'], required: true, max: 120, value: draft.name || '' },
          { id: 'style', selector: `${cardSel} .artist-style-pill`, kinds: ['artists'], required: true, max: 120, value: draft.style || 'Independent Studio Artist' },
          { id: 'location', selector: `${cardSel} .artist-location-pill`, kinds: ['artists'], max: 100, value: draft.location || '' },
          { id: 'oneLiner', selector: `${cardSel} .artist-oneliner`, kinds: ['artists'], required: true, max: 220, value: draft.oneLiner || '' }
        ];
      }
      const list = [
        { id: 'bannerEyebrow', selector: '.artist-banner-eyebrow', kinds: ['artist'], max: 80, value: draft.bannerEyebrow || '' },
        { id: hasBannerHeading ? 'bannerTitle' : 'name', selector: '.artist-banner-copy h1', kinds: ['artist'], required: !hasBannerHeading, max: 120, value: hasBannerHeading ? draft.bannerTitle : (draft.name || '') },
        ...(hasBannerHeading ? [{ id: 'name', selector: '.artist-byline', kinds: ['artist'], required: true, max: 120, value: draft.name || '' }] : []),
        { id: 'style', selector: '.artist-banner-copy .artist-style-pill', kinds: ['artist'], required: true, max: 120, value: draft.style || 'Independent Studio Artist' },
        { id: 'location', selector: '.artist-banner-copy .artist-location-pill', kinds: ['artist'], max: 100, value: draft.location || '' },
        { id: 'about', selector: '.artist-banner-about', kinds: ['artist'], multiline: true, allowMismatch: true, max: 4000 },
        { id: 'quote', selector: '.artist-quote .artist-quote-text', kinds: ['artist'], max: 400, value: draft.quote || '' },
        { id: 'worksHeading', selector: '.artist-works-section .section-heading h2', kinds: ['artist'], allowMismatch: true, max: 120 },
        { id: 'photo', selector: '.artist-lanyard-photo', kinds: ['artist'], type: 'pick' }
      ];
      (draft.sections || []).forEach((sec, idx) => {
        if (sec?.heading) list.push({ id: `secHeading:${idx}`, selector: `[data-artist-sec-idx="${idx}"] h2`, kinds: ['artist'], max: 120, value: sec.heading });
        if (sec?.body) list.push({ id: `secBody:${idx}`, selector: `[data-artist-sec-idx="${idx}"] p`, kinds: ['artist'], multiline: true, max: 2000, value: sec.body });
      });
      return list;
    };

    const previewSlot = root.querySelector('#artist-studio-preview-slot');
    previewController = mountSitePreviewPanel(previewSlot, {
      getContent: () => getContent?.() || {},
      getProducts: currentProducts,
      getSettings: () => getSettings?.() || {},
      getHeader: () => getHeader?.() || '',
      getArtists: buildPreviewArtists,
      initialPage: `artist:${draft.id || 'artist'}`,
      pageOptions: () => [
        [`artist:${draft.id || 'artist'}`, 'Artist page'],
        ['artists', 'Artists directory']
      ],
      compactToggle: true,
      title: 'Live artist preview',
      height: 560,
      inlineTargets: buildArtistInlineTargets,
      onInlineStart: target => flashControl(resolveArtistFormControl(target.id)),
      onInlineInput: (target, text) => syncArtistField(target.id, text),
      onInlineCommit: (target, text) => syncArtistField(target.id, text),
      onInlinePick: target => flashControl(resolveArtistFormControl(target.id), { focus: true })
    });

    const highlightArtistField = target => {
      if (!target || !previewController?.highlight) return;
      const artistPageId = `artist:${draft.id || 'artist'}`;
      const slug = encodeURIComponent(draft.id || '');
      const cardSel = slug ? `a[href="#artist/${slug}"] || .artists-page` : '.artists-page';
      if (target.closest('[data-accent], [data-accent-reset]') || target.name === 'accentColor' || target.name === 'bannerImage' || target.id === 'artist-upload-banner') {
        previewController.highlight('.artist-profile-banner', { page: artistPageId });
        return;
      }
      if (target.closest('.artist-section-editor-card') || target.id === 'artist-add-section') {
        previewController.highlight('.artist-custom-sections || .artist-profile-banner', { page: artistPageId });
        return;
      }
      const name = target.name || (target.id === 'artist-upload-photo' ? 'photo' : '');
      const map = {
        name: { page: artistPageId, selector: '.artist-banner-copy h1 || .artist-profile-banner' },
        slug: { page: artistPageId, selector: '.artist-detail-page .breadcrumbs' },
        style: { page: artistPageId, selector: '.artist-banner-copy .artist-style-pill || .artist-card-pills' },
        location: { page: artistPageId, selector: '.artist-banner-copy .artist-location-pill || .artist-card-pills' },
        visible: { page: 'artists', selector: cardSel },
        featured: { page: 'artists', selector: cardSel },
        bannerEyebrow: { page: artistPageId, selector: '.artist-banner-eyebrow || .artist-banner-copy' },
        bannerTitle: { page: artistPageId, selector: '.artist-banner-copy h1' },
        photo: { page: artistPageId, selector: '.artist-banner-photo' },
        oneLiner: { page: 'artists', selector: `${cardSel}` },
        about: { page: artistPageId, selector: '.artist-banner-about' },
        quote: { page: artistPageId, selector: '.artist-quote || .artist-banner-copy' },
        worksHeading: { page: artistPageId, selector: '.artist-works-section .section-heading' },
        instagram: { page: artistPageId, selector: '.artist-banner-meta' },
        website: { page: artistPageId, selector: '.artist-banner-meta' }
      };
      const hit = map[name];
      if (hit) previewController.highlight(hit.selector, { page: hit.page });
    };
    form.addEventListener('focusin', event => {
      const ctrl = event.target.closest('input,textarea,select');
      if (ctrl) highlightArtistField(ctrl);
    });
    form.addEventListener('click', event => {
      const ctrl = event.target.closest('[data-accent],[data-accent-reset],input[type=checkbox],input[type=file],#artist-add-section');
      if (ctrl) highlightArtistField(ctrl);
    });
  }

  renderWorkspace();

  return {
    isDirty: () => dirty,
    refresh() {
      if (!dirty && !disposed) renderWorkspace();
    },
    destroy() {
      disposed = true;
      previewController?.destroy();
      previewController = null;
    }
  };
}

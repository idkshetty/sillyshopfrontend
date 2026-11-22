import { mountInlineEditing } from './inline-edit.js';
import { contentInlineTargets } from './content-editor.js';
import { CONTENT_SCHEMA, normalizeContent, validateContent } from './store-content.js';
import { normalizeSettings } from './store-settings.js';
import { artistSlug, normalizeArtist, normalizeArtists, mergeArtistsWithProducts } from './artists.js';
import { escapeHTML as e } from './commerce.js';

/** Floating admin toolbar enabling click-to-type editing directly on the live storefront. */
export function mountLiveSiteEditor({
  isAdmin,
  getRoute,
  getContent,
  getSettings,
  getArtists,
  getProducts,
  onSaveContent,
  onSaveSettings,
  onSaveArtists,
  onRefresh
}) {
  let active = false;
  let busy = false;
  let host = null;
  let draftContent = null;
  let draftSettings = null;
  let draftArtists = null;
  const dirtyBuckets = new Set();
  const changedIds = new Set();
  let message = '';
  let messageError = false;
  let jumpInfo = null;

  function ensureHost() {
    if (host && host.isConnected) return host;
    host = document.createElement('div');
    host.className = 'live-site-editor-ui';
    host.hidden = true;
    document.body.append(host);
    host.addEventListener('click', handleHostClick);
    return host;
  }

  function resolvePageKind() {
    const r = getRoute?.() || { page: 'home', id: '' };
    if (r.page === 'info') return r.id || 'contact';
    if (r.page === 'collection' || r.page === 'search') return 'shop';
    return r.page || 'home';
  }

  function snapshotDrafts() {
    draftContent = normalizeContent(getContent?.() || {});
    draftSettings = normalizeSettings(getSettings?.() || {});
    draftArtists = normalizeArtists(getArtists?.() || []);
    dirtyBuckets.clear();
    changedIds.clear();
    jumpInfo = null;
    message = '';
    messageError = false;
  }

  function currentArtistsCombined() {
    return mergeArtistsWithProducts(draftArtists || [], getProducts?.() || [], { includeHidden: true });
  }

  function buildTargets() {
    if (!active || !isAdmin?.()) return [];
    const r = getRoute?.() || { page: 'home', id: '' };
    if (['admin', 'account', 'checkout'].includes(r.page)) return [];
    if (!draftContent) snapshotDrafts();
    const resolved = resolvePageKind();
    const targets = [];

    // 1. Store content targets (excluding goto shortcuts we replace with real live inline targets)
    const rawContent = contentInlineTargets(resolved);
    for (const t of rawContent) {
      if (t.tab) {
        if (['goto:announcement', 'goto:banner', 'goto:promo'].includes(t.id)) continue;
        if (t.id === 'goto:artists' && ['artists', 'artist'].includes(r.page)) continue;
        targets.push(t);
        continue;
      }
      const [sec, key] = String(t.key || '').split('.');
      const schemaField = CONTENT_SCHEMA[sec]?.fields[key];
      if (!schemaField) continue;
      targets.push({
        ...t,
        id: `content:${t.key}`,
        bucket: 'content',
        contentKey: t.key,
        max: schemaField.max,
        value: t.type === 'pick' ? undefined : (draftContent[sec]?.[key] ?? '')
      });
    }

    // 2. Announcement bar & Homepage banner / promo blocks
    targets.push({
      id: 'settings:announcementText',
      bucket: 'settings',
      settingKey: 'announcementText',
      selector: '.announcement .announcement-text, .announcement',
      kinds: null,
      max: 160,
      value: draftSettings.announcementText || ''
    });

    if (r.page === 'home') {
      targets.push(
        { id: 'settings:bannerEyebrow', bucket: 'settings', settingKey: 'bannerEyebrow', selector: '.hero-banner-eyebrow', kinds: ['home'], max: 80, value: draftSettings.bannerEyebrow || '' },
        { id: 'settings:bannerTitle', bucket: 'settings', settingKey: 'bannerTitle', selector: '.hero-banner-heading', kinds: ['home'], max: 100, value: draftSettings.bannerTitle || '' },
        { id: 'settings:bannerText', bucket: 'settings', settingKey: 'bannerText', selector: '.hero-banner-subtext', kinds: ['home'], multiline: true, max: 400, value: draftSettings.bannerText || '' },
        { id: 'settings:bannerArtistLabel', bucket: 'settings', settingKey: 'bannerArtistLabel', selector: '.hero-banner-artist', kinds: ['home'], max: 160, allowMismatch: true },
        { id: 'settings:bannerButton', bucket: 'settings', settingKey: 'bannerButton', selector: '.hero-banner-cta .hero-cta-label', kinds: ['home'], max: 50, allowMismatch: true }
      );
      for (const b of draftSettings.promoBlocks || []) {
        if (!b?.id || b.enabled === false) continue;
        const base = `[data-promo-block="${b.id}"]`;
        if (b.eyebrow) targets.push({ id: `promo:${b.id}:eyebrow`, bucket: 'settings', promoId: b.id, promoKey: 'eyebrow', selector: `${base} .promo-block-copy .eyebrow`, kinds: ['home'], max: 80, value: b.eyebrow });
        if (b.heading) targets.push({ id: `promo:${b.id}:heading`, bucket: 'settings', promoId: b.id, promoKey: 'heading', selector: `${base} .promo-block-copy h2`, kinds: ['home'], max: 120, value: b.heading });
        if (b.body) targets.push({ id: `promo:${b.id}:body`, bucket: 'settings', promoId: b.id, promoKey: 'body', selector: `${base} .promo-block-body`, kinds: ['home'], multiline: true, max: 600, value: b.body });
        if (b.buttonLabel) targets.push({ id: `promo:${b.id}:buttonLabel`, bucket: 'settings', promoId: b.id, promoKey: 'buttonLabel', selector: `${base} .promo-cta-label`, kinds: ['home'], max: 50, value: b.buttonLabel });
      }
    }

    // 3. Artists directory & profile page
    const combinedArtists = currentArtistsCombined();
    if (r.page === 'artists') {
      for (const a of combinedArtists) {
        const cardSel = `a[href="#artist/${a.id}"]`;
        targets.push(
          { id: `artist:${a.id}:name`, bucket: 'artists', artistSlugId: a.id, artistKey: 'name', selector: `${cardSel} h2`, kinds: ['artists'], required: true, max: 120, value: a.name || '' },
          { id: `artist:${a.id}:style`, bucket: 'artists', artistSlugId: a.id, artistKey: 'style', selector: `${cardSel} .artist-style-pill`, kinds: ['artists'], required: true, max: 120, value: a.style || '' },
          { id: `artist:${a.id}:location`, bucket: 'artists', artistSlugId: a.id, artistKey: 'location', selector: `${cardSel} .artist-location-pill`, kinds: ['artists'], max: 100, value: a.location || '' },
          { id: `artist:${a.id}:oneLiner`, bucket: 'artists', artistSlugId: a.id, artistKey: 'oneLiner', selector: `${cardSel} .artist-oneliner`, kinds: ['artists'], required: true, max: 220, value: a.oneLiner || '' }
        );
      }
    } else if (r.page === 'artist') {
      const slug = artistSlug(r.id || '');
      const a = combinedArtists.find(x => x.id === slug);
      if (a) {
        const hasBannerTitle = Boolean(String(a.bannerTitle || '').trim());
        targets.push(
          { id: `artist:${a.id}:bannerEyebrow`, bucket: 'artists', artistSlugId: a.id, artistKey: 'bannerEyebrow', selector: '.artist-banner-eyebrow', kinds: ['artist'], max: 80, value: a.bannerEyebrow || '' },
          { id: `artist:${a.id}:${hasBannerTitle ? 'bannerTitle' : 'name'}`, bucket: 'artists', artistSlugId: a.id, artistKey: hasBannerTitle ? 'bannerTitle' : 'name', selector: '.artist-banner-copy h1', kinds: ['artist'], required: !hasBannerTitle, max: 120, value: hasBannerTitle ? a.bannerTitle : (a.name || '') },
          ...(hasBannerTitle ? [{ id: `artist:${a.id}:name`, bucket: 'artists', artistSlugId: a.id, artistKey: 'name', selector: '.artist-byline', kinds: ['artist'], required: true, max: 120, value: a.name || '' }] : []),
          { id: `artist:${a.id}:style`, bucket: 'artists', artistSlugId: a.id, artistKey: 'style', selector: '.artist-banner-copy .artist-style-pill', kinds: ['artist'], required: true, max: 120, value: a.style || '' },
          { id: `artist:${a.id}:location`, bucket: 'artists', artistSlugId: a.id, artistKey: 'location', selector: '.artist-banner-copy .artist-location-pill', kinds: ['artist'], max: 100, value: a.location || '' },
          { id: `artist:${a.id}:about`, bucket: 'artists', artistSlugId: a.id, artistKey: 'about', selector: '.artist-banner-about', kinds: ['artist'], multiline: true, allowMismatch: true, max: 4000 },
          { id: `artist:${a.id}:quote`, bucket: 'artists', artistSlugId: a.id, artistKey: 'quote', selector: '.artist-quote .artist-quote-text', kinds: ['artist'], max: 400, value: a.quote || '' },
          { id: `artist:${a.id}:worksHeading`, bucket: 'artists', artistSlugId: a.id, artistKey: 'worksHeading', selector: '.artist-works-section .section-heading h2', kinds: ['artist'], allowMismatch: true, max: 120 }
        );
        (a.sections || []).forEach((sec, idx) => {
          if (sec?.heading) targets.push({ id: `artist:${a.id}:secHeading:${idx}`, bucket: 'artists', artistSlugId: a.id, artistKey: `secHeading:${idx}`, selector: `[data-artist-sec-idx="${idx}"] h2`, kinds: ['artist'], max: 120, value: sec.heading });
          if (sec?.body) targets.push({ id: `artist:${a.id}:secBody:${idx}`, bucket: 'artists', artistSlugId: a.id, artistKey: `secBody:${idx}`, selector: `[data-artist-sec-idx="${idx}"] p`, kinds: ['artist'], multiline: true, max: 2000, value: sec.body });
        });
      }
    }

    return targets;
  }

  function applyChange(target, text) {
    if (!target || !target.bucket) return;
    dirtyBuckets.add(target.bucket);
    changedIds.add(target.id);
    message = '';
    messageError = false;
    jumpInfo = null;

    if (target.bucket === 'content' && target.contentKey) {
      const [sec, key] = target.contentKey.split('.');
      if (draftContent?.[sec] && key) draftContent[sec][key] = text;
    } else if (target.bucket === 'settings') {
      if (target.settingKey) {
        draftSettings[target.settingKey] = text;
      } else if (target.promoId && target.promoKey) {
        draftSettings.promoBlocks = (draftSettings.promoBlocks || []).map(b =>
          b.id === target.promoId ? { ...b, [target.promoKey]: text } : b
        );
      }
    } else if (target.bucket === 'artists' && target.artistSlugId) {
      let idx = draftArtists.findIndex(a => a.id === target.artistSlugId);
      if (idx < 0) {
        const seed = currentArtistsCombined().find(a => a.id === target.artistSlugId);
        if (!seed) return;
        draftArtists.push(normalizeArtist(seed));
        idx = draftArtists.length - 1;
      }
      const next = { ...draftArtists[idx] };
      if (target.artistKey.startsWith('secHeading:') || target.artistKey.startsWith('secBody:')) {
        const isHead = target.artistKey.startsWith('secHeading:');
        const secIdx = Number(target.artistKey.slice(isHead ? 11 : 8));
        next.sections = (next.sections || []).map((s, i) => i === secIdx ? { ...s, [isHead ? 'heading' : 'body']: text } : s);
      } else {
        next[target.artistKey] = text;
      }
      draftArtists[idx] = next;
    }
    renderBar();
  }

  const inline = mountInlineEditing({
    doc: document,
    ignoreSelector: '.live-site-editor-ui, dialog, #toast, .admin-layout',
    enabled: false,
    getTargets: buildTargets,
    onStart: () => { jumpInfo = null; renderBar(); },
    onInput: (target, text) => applyChange(target, text),
    onCommit: (target, text, info) => {
      if (info?.changed) applyChange(target, text);
      else renderBar();
    },
    onPick: target => {
      if (target.tab) {
        jumpInfo = { label: target.label || 'This section', href: `#admin/${target.tab}`, tabLabel: target.tabLabel || 'Studio admin' };
      } else if (target.contentKey) {
        const pg = resolvePageKind();
        const isPolicy = target.contentKey.startsWith('pages.');
        jumpInfo = {
          label: 'Long policy body or media',
          href: isPolicy ? `#admin/${pg}` : '#admin/content',
          tabLabel: isPolicy ? 'Pages & policies' : 'Storefront editor'
        };
      }
      renderBar();
    }
  });

  function renderBar() {
    const el = ensureHost();
    const r = getRoute?.() || { page: 'home' };
    const show = Boolean(isAdmin?.()) && !['admin', 'account', 'checkout'].includes(r.page);
    if (!show) {
      if (active) deactivate({ keepChanges: false });
      el.hidden = true;
      return;
    }
    el.hidden = false;
    if (!active) {
      el.className = 'live-site-editor-ui is-idle';
      el.innerHTML = `<button type="button" class="live-edit-fab" data-live-action="enter">✎ Edit this page</button>
        <a class="live-edit-admin-chip" href="#admin" title="Open Admin Studio">Admin ↗</a>`;
      return;
    }
    const dirtyCount = changedIds.size;
    el.className = 'live-site-editor-ui is-active';
    el.innerHTML = `<div class="live-editor-dock" role="region" aria-label="On-site live page editor">
      <div class="live-editor-meta">
        <span class="live-editor-badge">● Editing page live</span>
        <span class="live-editor-hint">${jumpInfo
          ? `${e(jumpInfo.label)} is edited in <a class="text-link" href="${e(jumpInfo.href)}" data-live-action="jump">${e(jumpInfo.tabLabel)} →</a>`
          : (message ? e(message) : (dirtyCount ? `${dirtyCount} unsaved ${dirtyCount === 1 ? 'change' : 'changes'}` : 'Click any highlighted text on this page to type directly'))}</span>
      </div>
      <div class="live-editor-actions">
        <a class="button outline small" href="#admin" data-live-action="jump">Admin ↗</a>
        <button type="button" class="button outline small" data-live-action="discard" ${busy || !dirtyCount ? 'disabled' : ''}>Discard</button>
        <button type="button" class="button small" data-live-action="save" ${busy || !dirtyCount ? 'disabled' : ''}>${busy ? 'Saving…' : 'Save live'}</button>
        <button type="button" class="icon-button live-editor-close" data-live-action="exit" aria-label="Exit live editing" title="Exit live editing"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
      </div>
    </div>`;
    if (messageError) {
      el.querySelector('.live-editor-hint')?.classList.add('is-error');
    }
  }

  function deactivate({ keepChanges = false } = {}) {
    inline.commit();
    active = false;
    inline.setEnabled(false);
    document.body.classList.remove('is-live-site-editing');
    if (!keepChanges && changedIds.size) {
      dirtyBuckets.clear();
      changedIds.clear();
      draftContent = null;
      draftSettings = null;
      draftArtists = null;
      onRefresh?.();
    } else {
      draftContent = null;
      draftSettings = null;
      draftArtists = null;
      dirtyBuckets.clear();
      changedIds.clear();
    }
    renderBar();
  }

  async function saveAll() {
    inline.commit();
    if (!dirtyBuckets.size || busy) return;
    if (dirtyBuckets.has('content')) {
      const err = validateContent(normalizeContent(draftContent));
      if (err) {
        message = err;
        messageError = true;
        renderBar();
        return;
      }
    }
    busy = true;
    message = 'Saving live changes…';
    messageError = false;
    renderBar();
    try {
      if (dirtyBuckets.has('content')) await onSaveContent(normalizeContent(draftContent));
      if (dirtyBuckets.has('settings')) await onSaveSettings(normalizeSettings(draftSettings));
      if (dirtyBuckets.has('artists')) await onSaveArtists(normalizeArtists(draftArtists));
      dirtyBuckets.clear();
      changedIds.clear();
      draftContent = normalizeContent(getContent?.() || {});
      draftSettings = normalizeSettings(getSettings?.() || {});
      draftArtists = normalizeArtists(getArtists?.() || []);
      message = 'Saved live ✓';
      messageError = false;
    } catch (error) {
      message = error.message || 'Could not save live changes.';
      messageError = true;
    } finally {
      busy = false;
      renderBar();
    }
  }

  async function handleHostClick(event) {
    const target = event.target.closest('[data-live-action]');
    if (!target) return;
    const action = target.dataset.liveAction;
    if (action === 'enter') {
      snapshotDrafts();
      active = true;
      document.body.classList.add('is-live-site-editing');
      inline.setEnabled(true);
      inline.bind();
      renderBar();
    } else if (action === 'discard') {
      inline.commit();
      dirtyBuckets.clear();
      changedIds.clear();
      snapshotDrafts();
      onRefresh?.();
      inline.bind();
      renderBar();
    } else if (action === 'save') {
      await saveAll();
    } else if (action === 'exit') {
      if (changedIds.size && !window.confirm('Discard unsaved on-page edits?')) return;
      deactivate({ keepChanges: false });
    } else if (action === 'jump') {
      if (changedIds.size && !window.confirm('Discard unsaved on-page edits before opening Admin?')) {
        event.preventDefault();
        return;
      }
      deactivate({ keepChanges: false });
    }
  }

  return {
    isActive: () => active,
    sync() {
      renderBar();
      if (active) inline.bind();
    },
    destroy() {
      deactivate({ keepChanges: true });
      inline.destroy();
      host?.remove();
      host = null;
    }
  };
}

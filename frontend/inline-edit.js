/**
 * On-page ("click the preview and type") editing for the sandboxed, same-origin preview iframes.
 *
 * The preview documents never run scripts, so everything here is driven from the parent window
 * through `frame.contentDocument`. Hosts describe editable areas as "targets":
 *   { id, selector, kinds?, type?: 'text' | 'pick' | 'goto', multiline?, required?, max?, value?, allowMismatch? }
 * and receive onStart / onInput / onCommit / onPick callbacks. Hosts own the real form controls, so
 * drafts, dirty tracking and publishing keep working exactly as they do for field-by-field editing.
 */
const STYLE_ID = 'hehe-inline-edit-style';
const PREF_KEY = 'hehe-inline-edit-pref-v1';

const FRAME_CSS = `
[data-inline-editable]{pointer-events:auto!important;cursor:text}
[data-inline-editable][data-inline-kind="pick"]{cursor:pointer}
[data-inline-editable]:not([data-inline-editing]):hover{outline:2px dashed #d96b43!important;outline-offset:3px!important;background-color:rgba(217,107,67,.10)!important;border-radius:3px}
[data-inline-editable][data-inline-kind="pick"]:not([data-inline-editing]):hover{outline:2px dotted #2c6e49!important;background-color:rgba(44,110,73,.07)!important}
[data-inline-editing="true"]{outline:2px solid #d96b43!important;outline-offset:3px!important;background:#fffdf9!important;color:#181715!important;-webkit-text-fill-color:#181715!important;text-shadow:none!important;box-shadow:0 0 0 6px rgba(217,107,67,.22)!important;cursor:text;caret-color:#d96b43;min-width:1ch;animation:none!important;border-radius:3px}
`;

export function readInlinePref() {
  try { return localStorage.getItem(PREF_KEY) !== 'off'; } catch { return true; }
}
export function writeInlinePref(on) {
  try { localStorage.setItem(PREF_KEY, on ? 'on' : 'off'); } catch { /* storage unavailable */ }
}
/** Open the control's section, flash it so the eye finds it, and optionally focus it. */
export function flashControl(control, { focus = false, onOpen } = {}) {
  if (!control) return;
  const group = control.closest('details');
  if (group && !group.open) { onOpen?.(); group.open = true; }
  const box = control.closest('.content-field-item, .field, label, .artist-section-editor-card, .promo-editor-card') || control;
  box.classList.add('is-field-flash');
  setTimeout(() => box.classList.remove('is-field-flash'), 1700);
  try { control.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch { /* old browser */ }
  if (focus) { try { control.focus({ preventScroll: true }); } catch { /* not focusable */ } }
}
export function inlineToolbarMarkup(on) {
  return `<button type="button" class="inline-edit-toggle ${on ? 'is-on' : ''}" data-inline-toggle aria-pressed="${on ? 'true' : 'false'}" title="Click text in the preview to edit it right on the page">✎ Edit on page</button>`;
}
export function inlineHintMarkup(on) {
  return `<p class="inline-edit-hint" data-inline-hint ${on ? '' : 'hidden'}>Click any outlined text in the preview to type on the page · Enter confirms · Esc cancels · green outlines jump to the right setting</p>`;
}

const readText = el => String(el.textContent || '').replace(/\u200b/g, '');

/** While typing: keep single-line fields on one line and enforce the length limit. */
export function liveNormalize(target, text) {
  let value = String(text);
  if (!target.multiline) value = value.replace(/\s*[\r\n]+\s*/g, ' ');
  if (target.max && value.length > target.max) value = value.slice(0, target.max);
  return value;
}

/** When committing: trim, collapse whitespace and enforce the length limit. */
export function finalNormalize(target, text) {
  let value = String(text).replace(/\r/g, '');
  value = target.multiline
    ? value.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
    : value.replace(/\s+/g, ' ').trim();
  if (target.max && value.length > target.max) value = value.slice(0, target.max).trimEnd();
  return value;
}

function setCaretEnd(doc, el) {
  try {
    const selection = doc.getSelection?.();
    if (!selection) return;
    const range = doc.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  } catch { /* selection API unavailable */ }
}

function placeCaretAt(doc, el, x, y) {
  try {
    let range = null;
    if (typeof doc.caretRangeFromPoint === 'function') range = doc.caretRangeFromPoint(x, y);
    else if (typeof doc.caretPositionFromPoint === 'function') {
      const position = doc.caretPositionFromPoint(x, y);
      if (position) {
        range = doc.createRange();
        range.setStart(position.offsetNode, position.offset);
        range.collapse(true);
      }
    }
    if (range && el.contains(range.startContainer)) {
      const selection = doc.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
  } catch { /* fall through */ }
  setCaretEnd(doc, el);
}

function insertPlain(doc, el, text) {
  try {
    const selection = doc.getSelection?.();
    if (!selection || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (!el.contains(range.commonAncestorContainer)) return;
    range.deleteContents();
    const node = doc.createTextNode(text);
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    const EventCtor = doc.defaultView?.Event || Event;
    el.dispatchEvent(new EventCtor('input', { bubbles: true }));
  } catch { /* selection API unavailable */ }
}

export function mountInlineEditing({ doc = null, frame = null, ignoreSelector = '.live-site-editor-ui, dialog, #toast', getTargets, onStart, onInput, onCommit, onPick, onState, enabled = true }) {
  let on = Boolean(enabled);
  let disposed = false;
  let editing = null;
  let switchingTo = null;
  let switchTimer = null;
  let targetMap = new WeakMap();
  const bound = new WeakSet();

  const docOf = () => {
    if (doc) return doc;
    try { return frame?.contentDocument || null; } catch { return null; }
  };

  function ensureStyle(doc) {
    if (!doc.head || doc.getElementById(STYLE_ID)) return;
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = FRAME_CSS;
    doc.head.appendChild(style);
  }

  function clearMarks(doc) {
    doc.querySelectorAll('[data-inline-editable]').forEach(el => {
      if (editing && el === editing.el) return;
      el.removeAttribute('data-inline-editable');
      el.removeAttribute('data-inline-kind');
      if (el.hasAttribute('data-inline-titled')) {
        el.removeAttribute('title');
        el.removeAttribute('data-inline-titled');
      }
    });
  }

  function mark() {
    const doc = docOf();
    if (!doc || !doc.body || disposed) return;
    clearMarks(doc);
    targetMap = new WeakMap();
    if (!on) return;
    const kind = doc.body.getAttribute('data-page') || '';
    let targets = [];
    try { targets = getTargets?.() || []; } catch { targets = []; }
    for (const target of targets) {
      if (!target || !target.selector) continue;
      if (Array.isArray(target.kinds) && !target.kinds.includes(kind)) continue;
      let nodes;
      try { nodes = doc.querySelectorAll(target.selector); } catch { continue; }
      const jump = target.type === 'pick' || target.type === 'goto';
      nodes.forEach(el => {
        if (targetMap.has(el)) return;
        if (ignoreSelector && el.closest?.(ignoreSelector)) return;
        if (!jump) {
          if (el.children && el.children.length) return;
          if (!target.allowMismatch && typeof target.value === 'string' && readText(el) !== target.value) return;
        }
        el.setAttribute('data-inline-editable', target.id);
        el.setAttribute('data-inline-kind', jump ? 'pick' : 'text');
        if (!el.hasAttribute('title')) {
          el.setAttribute('title', target.hint || (jump ? 'Click to find where this is edited' : 'Click to edit this text'));
          el.setAttribute('data-inline-titled', '');
        }
        targetMap.set(el, target);
      });
    }
  }

  function mirror(doc, source, target, text) {
    doc.querySelectorAll('[data-inline-editable]').forEach(other => {
      if (other !== source && other.getAttribute('data-inline-editable') === target.id) other.textContent = text;
    });
  }

  function onBlur() { commit(); }

  function startEdit(doc, el, target, x, y) {
    if (editing) commit();
    editing = { el, target, original: readText(el), cancelled: false, whiteSpace: el.style.whiteSpace || '' };
    el.setAttribute('data-inline-editing', 'true');
    el.setAttribute('contenteditable', 'plaintext-only');
    if (!el.isContentEditable) el.setAttribute('contenteditable', 'true');
    el.setAttribute('spellcheck', 'true');
    if (target.multiline) el.style.whiteSpace = 'pre-wrap';
    el.addEventListener('blur', onBlur);
    el.focus?.({ preventScroll: true });
    placeCaretAt(doc, el, x, y);
    onState?.(true);
    onStart?.(target, el);
  }

  function commit() {
    if (!editing) return;
    const { el, target, original, cancelled, whiteSpace } = editing;
    editing = null;
    el.removeEventListener('blur', onBlur);
    el.removeAttribute('contenteditable');
    el.removeAttribute('spellcheck');
    el.removeAttribute('data-inline-editing');
    if (whiteSpace) el.style.whiteSpace = whiteSpace; else el.style.removeProperty?.('white-space');
    if (el.getAttribute('style') === '') el.removeAttribute('style');
    let text = cancelled ? original : finalNormalize(target, readText(el));
    if (target.required && !text) text = original;
    el.textContent = text;
    const doc = el.ownerDocument;
    if (doc) mirror(doc, el, target, text);
    const switching = Boolean(switchingTo);
    switchingTo = null;
    clearTimeout(switchTimer);
    try { onCommit?.(target, text, { changed: text !== original, switching }); } finally { onState?.(false); }
  }

  function cancel() {
    if (!editing) return;
    editing.cancelled = true;
    editing.el.textContent = editing.original;
    commit();
  }

  function bindDoc(targetDoc) {
    if (bound.has(targetDoc)) return;
    bound.add(targetDoc);
    ensureStyle(targetDoc);
    targetDoc.addEventListener('mousedown', event => {
      if (disposed || !on || !editing) return;
      if (ignoreSelector && event.target?.closest?.(ignoreSelector)) { switchingTo = null; return; }
      const next = event.target?.closest?.('[data-inline-editable]');
      if (next && next !== editing.el) {
        switchingTo = next;
        clearTimeout(switchTimer);
        switchTimer = setTimeout(() => { switchingTo = null; }, 450);
      } else {
        switchingTo = null;
      }
    }, true);
    targetDoc.addEventListener('mouseup', () => {
      if (switchingTo) {
        clearTimeout(switchTimer);
        switchTimer = setTimeout(() => { switchingTo = null; }, 0);
      }
    }, true);
    targetDoc.addEventListener('click', event => {
      if (disposed) return;
      if (ignoreSelector && event.target?.closest?.(ignoreSelector)) return;
      const anchor = event.target?.closest?.('a');
      if (anchor && (frame || on)) event.preventDefault();
      if (!on) return;
      const el = event.target?.closest?.('[data-inline-editable]');
      if (!el) { if (editing) commit(); return; }
      const target = targetMap.get(el);
      if (!target) return;
      event.preventDefault();
      event.stopPropagation();
      if (editing && editing.el === el) return;
      if (target.type === 'pick' || target.type === 'goto') {
        commit();
        onPick?.(target, el);
        return;
      }
      startEdit(targetDoc, el, target, event.clientX, event.clientY);
    }, true);
    targetDoc.addEventListener('keydown', event => {
      if (!editing || !editing.el.contains(event.target)) return;
      if (event.key === 'Escape') { event.preventDefault(); cancel(); return; }
      if (event.key === 'Enter') {
        event.preventDefault();
        if (!editing.target.multiline || event.ctrlKey || event.metaKey) { commit(); return; }
        insertPlain(targetDoc, editing.el, '\n');
      }
    }, true);
    targetDoc.addEventListener('input', event => {
      if (!editing || !editing.el.contains(event.target)) return;
      const { el, target } = editing;
      const raw = readText(el);
      const live = liveNormalize(target, raw);
      if (live !== raw) { el.textContent = live; setCaretEnd(targetDoc, el); }
      mirror(targetDoc, el, target, live);
      onInput?.(target, live);
    }, true);
    targetDoc.addEventListener('paste', event => {
      if (!editing || !editing.el.contains(event.target)) return;
      event.preventDefault();
      const text = event.clipboardData?.getData('text/plain') || '';
      if (!text) return;
      insertPlain(targetDoc, editing.el, editing.target.multiline ? text.replace(/\r\n?/g, '\n') : text.replace(/\s*[\r\n]+\s*/g, ' '));
    }, true);
    ['dragover', 'drop'].forEach(name => targetDoc.addEventListener(name, event => {
      if (editing && editing.el.contains(event.target)) event.preventDefault();
    }, true));
    targetDoc.addEventListener('submit', event => {
      if (ignoreSelector && event.target?.closest?.(ignoreSelector)) return;
      if (frame || on) event.preventDefault();
    }, true);
  }

  return {
    /** Call after every iframe (re)load. */
    bind() {
      const doc = docOf();
      if (!doc || !doc.body || disposed) return;
      if (editing && editing.el.ownerDocument !== doc) editing = null;
      bindDoc(doc);
      mark();
    },
    refresh() { if (!editing) mark(); },
    isEditing: () => Boolean(editing),
    isEnabled: () => on,
    setEnabled(value) {
      on = Boolean(value);
      if (!on) commit();
      mark();
    },
    commit,
    destroy() { disposed = true; editing = null; }
  };
}

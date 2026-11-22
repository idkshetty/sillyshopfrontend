import {escapeHTML as e} from './commerce.js';
export function randomId(){
  if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();
  if(globalThis.crypto?.getRandomValues){
    const b=globalThis.crypto.getRandomValues(new Uint8Array(16));
    b[6]=(b[6]&0x0f)|0x40;b[8]=(b[8]&0x3f)|0x80;
    const h=[...b].map(n=>n.toString(16).padStart(2,'0')).join('');
    return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}-${Math.random().toString(36).slice(2,10)}`;
}

// Product notes and private reference images stay in this tab, never localStorage.
const drafts = new Map();
const draft = id => {
  if (!drafts.has(id)) drafts.set(id, {note:'',files:[]});
  return drafts.get(id);
};
export function customizationFields(id, compact = false) {
  const d = draft(id);
  const fields = `<label class="field">A note for this product<textarea data-product-note="${e(id)}" maxlength="1000" placeholder="Names, colours, a gift message, or your idea…">${e(d.note)}</textarea></label><label class="field">Reference images (optional)<input data-reference-files="${e(id)}" type="file" accept="image/jpeg,image/png,image/webp" multiple></label><p class="small muted">Up to 3 images, 6 MB each. Shared privately with the studio when you save checkout. Keep this tab open to retain your notes and images.</p><div class="reference-preview" data-reference-preview="${e(id)}">${referencePreviews(id)}</div>`;
  return compact ? `<details class="product-personalization"><summary>Product notes & images${d.note||d.files.length?' · added':''}</summary>${fields}</details>` : `<div class="product-personalization"><h3>Make it a little more yours.</h3><p class="small muted">Requests will be reviewed by the studio before confirmation.</p>${fields}</div>`;
}
export function referencePreviews(id) {
  return draft(id).files.map(file => `<figure><img src="${e(file.url)}" alt="Reference image"><button type="button" data-action="remove-reference" data-id="${e(id)}" data-file-id="${file.id}" aria-label="Remove reference image">×</button></figure>`).join('');
}
export function setProductNote(id, note) { draft(id).note = note.slice(0,1000); }
export function addReferences(id, files) {
  const d = draft(id), list = [...files];
  if (d.files.length + list.length > 3) throw new Error('Choose up to 3 reference images per product.');
  for (const file of list) {
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 6*1024*1024) throw new Error('Use JPG, PNG or WebP images, no larger than 6 MB each.');
  }
  d.files.push(...list.map(file => ({id:randomId(),file,url:URL.createObjectURL(file)})));
}
export function removeReference(id, fileId) {
  const d = draft(id), found = d.files.find(file => file.id === fileId);
  if (found) URL.revokeObjectURL(found.url);
  d.files = d.files.filter(file => file.id !== fileId);
}
export function refreshReferencePreviews(id) {
  document.querySelectorAll('[data-reference-preview]').forEach(el => {
    if (el.dataset.referencePreview === id) el.innerHTML = referencePreviews(id);
  });
}
export function clearCustomization(id) {
  if (drafts.has(id)) drafts.get(id).files.forEach(file => URL.revokeObjectURL(file.url));
  drafts.delete(id);
}
export function checkoutCustomizations(cart) {
  return cart.map(({id}) => ({productId:id,...draft(id)})).filter(d => d.note.trim() || d.files.length);
}
export function clearCustomizations() { [...drafts.keys()].forEach(clearCustomization); }

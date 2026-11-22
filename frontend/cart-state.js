import {MAX_ITEM_QUANTITY} from './commerce.js';
// Catalogue refreshes must never silently delete a customer's selected items.
export function selectedCartLines(cart,products,remembered=[]){
  return cart.map(item=>{
    const product=products.find(p=>p.id===item.id)||remembered.find(p=>p.id===item.id)||{id:item.id,title:'Unavailable product',category:'paintings',price:0,stock:0,visible:false,images:[]};
    return {product,quantity:item.quantity,total:Math.round(product.price*100)*item.quantity/100};
  });
}
export function cartIssues(cart,products,displayedProducts=[]){
  return cart.flatMap(item=>{
    const product=products.find(p=>p.id===item.id),shown=displayedProducts.find(p=>p.id===item.id),name=product?.title||shown?.title||'An item';
    if(!product||!product.visible||product.archived)return [`${name} is currently unavailable. Your cart is saved; retry or remove the item.`];
    if(product.stock<item.quantity)return [`${name}: ${product.stock} available, ${item.quantity} selected. Adjust the quantity or remove the item.`];
    if(shown&&product.price!==shown.price)return [`The price of ${name} changed. Review the updated cart before saving.`];
    return [];
  });
}

/** Remove unavailable/sold-out cart lines and clamp quantities to available stock, returning user-facing notes. */
export function pruneCart(cart, products, remembered = []) {
  const source = Array.isArray(cart) ? cart : [];
  const nextCart = [];
  const notes = [];
  const removedIds = [];
  const seen = new Set();
  let changed = false;

  for (const item of source) {
    if (!item || typeof item.id !== 'string' || !item.id || seen.has(item.id)) {
      if (item) changed = true;
      continue;
    }
    seen.add(item.id);
    const product = products.find(p => p.id === item.id);
    const fallback = remembered.find(p => p.id === item.id);
    const name = product?.title || fallback?.title || 'An artwork';

    if (!product || !product.visible || product.archived) {
      changed = true;
      removedIds.push(item.id);
      notes.push(`"${name}" is no longer available and was removed from your bag.`);
      continue;
    }
    if (!Number.isInteger(product.stock) || product.stock < 1) {
      changed = true;
      removedIds.push(item.id);
      notes.push(`"${name}" sold out and was removed from your bag.`);
      continue;
    }

    const maxQty = Math.min(MAX_ITEM_QUANTITY, product.stock);
    const rawQty = item.quantity;
    const qty = Number.isInteger(rawQty) && rawQty > 0 ? rawQty : 1;
    if (qty > maxQty) {
      changed = true;
      nextCart.push({ id: item.id, quantity: maxQty });
      notes.push(`"${name}" quantity was adjusted to ${maxQty} (limit ${MAX_ITEM_QUANTITY} per artwork).`);
    } else {
      if (qty !== rawQty) changed = true;
      nextCart.push({ id: item.id, quantity: qty });
    }
  }

  return { cart: nextCart, changed, notes, removedIds };
}

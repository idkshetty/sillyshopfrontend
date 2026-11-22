import { MAP_CONFIG } from './map-config.js';
import { escapeHTML as e, money } from './commerce.js';
import { validLocation, locationLink } from './location-utils.js';
import { loadScript } from './browser-library.js';
import { skeletonMarkup } from './skeletons.js';

function pinMeta(order) {
  if (['cancelled', 'closed'].includes(order.status) || order.paymentStatus === 'refunded') {
    return { key: 'closed', cls: 'is-closed', label: order.paymentStatus === 'refunded' ? 'Refunded' : 'Cancelled / closed' };
  }
  if (['shipped', 'out_for_delivery', 'delivered'].includes(order.status)) {
    const names = { shipped: 'Shipped', out_for_delivery: 'Out for delivery', delivered: 'Delivered' };
    return { key: 'shipped', cls: 'is-shipped', label: names[order.status] || 'Shipped' };
  }
  if (order.paymentStatus === 'captured') {
    return { key: 'to-ship', cls: 'is-ready', label: 'Paid · To ship' };
  }
  return { key: 'unpaid', cls: 'is-unpaid', label: order.status === 'cancel_requested' ? 'Cancel requested' : 'Unpaid / pending' };
}

export function mountOrdersMap(root, { getOrders, onPrintLabel, onViewOrder }) {
  let disposed = false;
  let map = null, satelliteLayer = null, streetLayer = null, markerLayer = null;
  let activeLayer = 'satellite', activeFilter = 'all';
  let allOrders = [];
  const markersById = new Map();

  root.innerHTML = `<div class="admin-title">
      <div>
        <h1>Orders map</h1>
        <p>See every customer delivery pin on satellite imagery, inspect order status and print labels directly.</p>
      </div>
      <div class="orders-map-header-actions">
        <button type="button" class="button outline small" id="orders-map-refresh">Refresh ↻</button>
      </div>
    </div>
    <div class="orders-map-toolbar">
      <div class="orders-filter-chips" role="group" aria-label="Filter map orders">
        <button type="button" class="orders-filter-chip is-active" data-map-filter="all" aria-pressed="true">All pins</button>
        <button type="button" class="orders-filter-chip" data-map-filter="to-ship" aria-pressed="false">To ship</button>
        <button type="button" class="orders-filter-chip" data-map-filter="shipped" aria-pressed="false">Shipped</button>
        <button type="button" class="orders-filter-chip" data-map-filter="unpaid" aria-pressed="false">Unpaid</button>
      </div>
      <div class="orders-map-controls">
        <div class="map-layer-toggle" role="group" aria-label="Map style">
          <button type="button" class="map-layer-btn is-active" data-orders-layer="satellite" aria-pressed="true">Satellite</button>
          <button type="button" class="map-layer-btn" data-orders-layer="street" aria-pressed="false">Street map</button>
        </div>
        <button type="button" class="button outline small" id="orders-map-fit">Fit all pins</button>
      </div>
    </div>
    <div class="orders-map-stats" id="orders-map-stats"></div>
    <div id="admin-orders-map-shell" class="orders-map-shell">
      <div id="admin-orders-map" class="orders-map-stage" aria-label="Customer orders delivery map"></div>
      <div id="orders-map-legend" class="orders-map-legend" aria-hidden="true">
        <span><i class="legend-dot is-ready"></i>Paid · to ship</span>
        <span><i class="legend-dot is-shipped"></i>Shipped / delivered</span>
        <span><i class="legend-dot is-unpaid"></i>Unpaid / pending</span>
        <span><i class="legend-dot is-closed"></i>Closed / cancelled</span>
      </div>
    </div>
    <p id="orders-map-notice" class="notice" role="status"></p>
    <div id="orders-map-directory"></div>
    <div id="orders-map-unpinned"></div>`;

  const notice = root.querySelector('#orders-map-notice');
  const statsEl = root.querySelector('#orders-map-stats');
  const dirEl = root.querySelector('#orders-map-directory');
  const unpinnedEl = root.querySelector('#orders-map-unpinned');
  const mapEl = root.querySelector('#admin-orders-map');

  function filteredOrders() {
    if (activeFilter === 'all') return allOrders;
    return allOrders.filter(o => pinMeta(o).key === activeFilter);
  }

  function popupElementFor(order, meta) {
    const c = order.customer || {};
    const ref = order.id.slice(0, 8).toUpperCase();
    const wrap = document.createElement('div');
    wrap.className = 'order-map-popup';
    wrap.innerHTML = `<div class="order-map-popup-head">
        <strong>#${e(ref)}</strong>
        <span class="order-map-popup-badge ${meta.cls}">${e(meta.label)}</span>
      </div>
      <p class="order-map-popup-name">${e(`${c.firstName || ''} ${c.lastName || ''}`.trim())} · ${e(c.phone || '')}</p>
      <p class="order-map-popup-addr">${e(c.address || '')}${c.apartment ? `, ${e(c.apartment)}` : ''}<br>${e(c.city || '')}, ${e(c.state || '')} ${e(c.postalCode || '')}</p>
      <p class="order-map-popup-items">${(order.items || []).map(i => `${e(i.quantity)} × ${e(i.title)}`).join(', ')} · <strong>${money(order.estimatedSubtotal)}</strong></p>
      <div class="order-map-popup-actions">
        <button type="button" class="button small" data-popup-print>Print label ↗</button>
        <button type="button" class="button outline small" data-popup-open>Open order</button>
        <a class="text-link" href="${e(locationLink(c))}" target="_blank" rel="noopener">Google Maps ↗</a>
      </div>`;
    wrap.querySelector('[data-popup-print]').onclick = () => onPrintLabel?.(order);
    wrap.querySelector('[data-popup-open]').onclick = () => onViewOrder?.(order.id);
    return wrap;
  }

  function fitBoundsToMarkers() {
    if (!map) return;
    const pts = [...markersById.values()].map(m => m.getLatLng());
    if (pts.length === 1) {
      map.setView(pts[0], 16, { animate: true });
    } else if (pts.length > 1) {
      map.fitBounds(pts, { padding: [42, 42], maxZoom: 16 });
    } else {
      map.setView([22.5, 79], 5);
    }
  }

  function paintOrders() {
    const list = filteredOrders();
    const pinned = list.filter(o => validLocation(o.customer?.location));
    const unpinned = list.filter(o => !validLocation(o.customer?.location));
    const readyCount = allOrders.filter(o => pinMeta(o).key === 'to-ship').length;

    statsEl.innerHTML = `<article><span>Pinned on map</span><strong>${pinned.length}</strong></article>
      <article><span>Paid · to ship</span><strong>${readyCount}</strong></article>
      <article><span>Without map pin</span><strong>${unpinned.length}</strong></article>`;

    markersById.clear();
    if (markerLayer) markerLayer.clearLayers();

    if (map && markerLayer) {
      const seenCoords = new Map();
      pinned.forEach(order => {
        const loc = order.customer.location;
        const baseKey = `${loc.latitude.toFixed(5)},${loc.longitude.toFixed(5)}`;
        const count = seenCoords.get(baseKey) || 0;
        seenCoords.set(baseKey, count + 1);
        const angle = count * 2.39996;
        const offset = count === 0 ? 0 : 0.00014 * Math.sqrt(count);
        const lat = loc.latitude + Math.sin(angle) * offset;
        const lng = loc.longitude + Math.cos(angle) * offset;

        const meta = pinMeta(order);
        const marker = window.L.marker([lat, lng], {
          title: `#${order.id.slice(0, 8).toUpperCase()} — ${order.customer.firstName || ''} (${order.customer.city || ''})`,
          icon: window.L.divIcon({
            className: 'order-map-pin-wrap',
            html: `<span class="order-map-pin ${meta.cls}" aria-hidden="true"><span></span></span>`,
            iconSize: [28, 36],
            iconAnchor: [14, 36],
            popupAnchor: [0, -34]
          })
        });
        marker.bindPopup(() => popupElementFor(order, meta), { maxWidth: 290 });
        marker.addTo(markerLayer);
        markersById.set(order.id, marker);
      });
      fitBoundsToMarkers();
    }

    dirEl.innerHTML = pinned.length
      ? `<div class="orders-map-section-head"><h2>Pinned delivery locations (${pinned.length})</h2><p class="small muted">Tap an order below to zoom straight to its delivery pin.</p></div>
        <div class="orders-map-cards">${pinned.map(o => {
          const c = o.customer || {};
          const meta = pinMeta(o);
          return `<article class="orders-map-card">
            <div class="orders-map-card-top">
              <strong>#${e(o.id.slice(0, 8).toUpperCase())}</strong>
              <span class="order-map-popup-badge ${meta.cls}">${e(meta.label)}</span>
            </div>
            <p class="orders-map-card-name">${e(`${c.firstName || ''} ${c.lastName || ''}`.trim())}</p>
            <p class="orders-map-card-addr">${e(c.city || '')}, ${e(c.state || '')} ${e(c.postalCode || '')} · <strong>${money(o.estimatedSubtotal)}</strong></p>
            <div class="orders-map-card-actions">
              <button type="button" class="button outline small" data-focus-order="${e(o.id)}">Focus pin</button>
              <button type="button" class="text-link" data-open-order="${e(o.id)}">Open order →</button>
            </div>
          </article>`;
        }).join('')}</div>`
      : `<div class="empty-state"><h2>No pinned orders in this filter</h2><p>Customers who confirm a map pin during checkout will appear here automatically.</p></div>`;

    unpinnedEl.innerHTML = unpinned.length
      ? `<details class="orders-map-unpinned">
          <summary>${unpinned.length} ${unpinned.length === 1 ? 'order' : 'orders'} without a confirmed map pin</summary>
          <div class="orders-map-cards">${unpinned.map(o => {
            const c = o.customer || {};
            return `<article class="orders-map-card is-unpinned">
              <div class="orders-map-card-top"><strong>#${e(o.id.slice(0, 8).toUpperCase())}</strong><span class="small muted">${money(o.estimatedSubtotal)}</span></div>
              <p class="orders-map-card-name">${e(`${c.firstName || ''} ${c.lastName || ''}`.trim())}</p>
              <p class="orders-map-card-addr">${e(c.address || '')}, ${e(c.city || '')} ${e(c.postalCode || '')}</p>
              <div class="orders-map-card-actions">
                <a class="text-link" href="${e(locationLink(c))}" target="_blank" rel="noopener">Search address ↗</a>
                <button type="button" class="text-link" data-open-order="${e(o.id)}">Open order →</button>
              </div>
            </article>`;
          }).join('')}</div>
        </details>`
      : '';
  }

  function setLayer(nextLayer) {
    if (!map || nextLayer === activeLayer) return;
    if (nextLayer === 'street') {
      map.removeLayer(satelliteLayer);
      streetLayer.addTo(map);
    } else {
      map.removeLayer(streetLayer);
      satelliteLayer.addTo(map);
    }
    activeLayer = nextLayer;
    root.querySelectorAll('[data-orders-layer]').forEach(btn => {
      const active = btn.dataset.ordersLayer === nextLayer;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  root.querySelectorAll('[data-map-filter]').forEach(btn => {
    btn.onclick = () => {
      activeFilter = btn.dataset.mapFilter || 'all';
      root.querySelectorAll('[data-map-filter]').forEach(b => {
        const active = b.dataset.mapFilter === activeFilter;
        b.classList.toggle('is-active', active);
        b.setAttribute('aria-pressed', String(active));
      });
      paintOrders();
    };
  });
  root.querySelectorAll('[data-orders-layer]').forEach(btn => {
    btn.onclick = () => setLayer(btn.dataset.ordersLayer || 'satellite');
  });
  root.querySelector('#orders-map-fit').onclick = fitBoundsToMarkers;
  root.querySelector('#orders-map-refresh').onclick = async () => {
    const btn = root.querySelector('#orders-map-refresh');
    btn.disabled = true;
    notice.textContent = '';
    try {
      allOrders = await getOrders(true);
      if (!disposed) paintOrders();
    } catch (error) {
      if (!disposed) notice.textContent = error.message || 'Could not refresh orders.';
    } finally {
      if (!disposed && btn.isConnected) btn.disabled = false;
    }
  };
  root.addEventListener('click', event => {
    const focusBtn = event.target.closest('[data-focus-order]');
    if (focusBtn && map) {
      const marker = markersById.get(focusBtn.dataset.focusOrder);
      if (marker) {
        mapEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        map.setView(marker.getLatLng(), Math.max(map.getZoom(), 16), { animate: true });
        marker.openPopup();
      }
      return;
    }
    const openBtn = event.target.closest('[data-open-order]');
    if (openBtn) onViewOrder?.(openBtn.dataset.openOrder);
  });

  statsEl.innerHTML = skeletonMarkup('rows', 'Loading delivery pins…');

  (async () => {
    try {
      const [orders] = await Promise.all([getOrders(false), loadScript('assets/vendor/leaflet.js')]);
      if (disposed || !mapEl.isConnected) return;
      allOrders = Array.isArray(orders) ? orders : [];
      map = window.L.map(mapEl, { scrollWheelZoom: true, touchZoom: true, zoomSnap: 0.5 }).setView([22.5, 79], 5);
      const imagery = window.L.tileLayer(MAP_CONFIG.satelliteTiles, { attribution: MAP_CONFIG.satelliteAttribution, maxZoom: 19, maxNativeZoom: 18 });
      const roads = window.L.tileLayer(MAP_CONFIG.roadsTiles, { maxZoom: 19, maxNativeZoom: 18 });
      const labels = window.L.tileLayer(MAP_CONFIG.labelsTiles, { maxZoom: 19, maxNativeZoom: 18 });
      satelliteLayer = window.L.layerGroup([imagery, roads, labels]);
      streetLayer = window.L.tileLayer(MAP_CONFIG.tiles, { attribution: MAP_CONFIG.attribution, maxZoom: 19 });
      satelliteLayer.addTo(map);
      markerLayer = window.L.layerGroup().addTo(map);
      paintOrders();
    } catch (error) {
      if (disposed) return;
      statsEl.innerHTML = '';
      notice.textContent = error.message || 'Could not load the orders map.';
    }
  })();

  return {
    destroy() {
      disposed = true;
      map?.remove();
      map = null;
    }
  };
}

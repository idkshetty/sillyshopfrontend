import { escapeHTML as e, money } from './commerce.js';
import { csvCell, downloadFile } from './downloads.js';

const LAST_BACKUP_KEY = 'hehe-cafe-last-backup-v1';

function toCSV(headers, rows) {
  return '\uFEFF' + [headers, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

function readBackupStamp() {
  try {
    const raw = JSON.parse(localStorage.getItem(LAST_BACKUP_KEY) || 'null');
    return Number.isFinite(raw?.at) ? raw : null;
  } catch {
    return null;
  }
}

function writeBackupStamp(summary) {
  try {
    localStorage.setItem(LAST_BACKUP_KEY, JSON.stringify({ at: Date.now(), summary }));
  } catch {}
}

/** Studio Backup, JSON/CSV Exports & Selective Restore dashboard. */
export function mountBackupExport(root, { getSnapshot, onRestore }) {
  let disposed = false;
  let parsedBackup = null;

  function statusBannerMarkup() {
    const stamp = readBackupStamp();
    if (!stamp) {
      return `<div class="backup-status-banner is-stale"><strong>No local backup recorded yet</strong><span>Download a full studio snapshot below to keep an offline copy of your catalog, orders and copy.</span></div>`;
    }
    const ageDays = Math.floor((Date.now() - stamp.at) / 86400000);
    const when = new Date(stamp.at).toLocaleString('en-IN');
    return `<div class="backup-status-banner ${ageDays >= 7 ? 'is-stale' : 'is-fresh'}"><strong>Last full backup: ${e(when)}</strong><span>${e(stamp.summary || '')}${ageDays >= 7 ? ' · Over 7 days ago — download a fresh copy.' : ''}</span></div>`;
  }

  function renderRestorePreview() {
    const slot = root.querySelector('#backup-restore-preview');
    if (!slot) return;
    if (!parsedBackup) {
      slot.innerHTML = '';
      return;
    }
    const items = [
      ['Storefront copy & pages', 'content', parsedBackup.content ? 'Included' : 'Missing', Boolean(parsedBackup.content)],
      ['Homepage banners & section order', 'settings', parsedBackup.settings ? 'Included' : 'Missing', Boolean(parsedBackup.settings)],
      ['Artist pages', 'artists', Array.isArray(parsedBackup.artists) ? `${parsedBackup.artists.length} profiles` : 'Missing', Array.isArray(parsedBackup.artists)],
      ['Promos & bundle rules', 'promos', parsedBackup.promos ? `${parsedBackup.promos.codes?.length || 0} codes · ${parsedBackup.promos.bundles?.length || 0} bundles` : 'Missing', Boolean(parsedBackup.promos)]
    ];
    slot.innerHTML = `<div class="backup-restore-card">
      <p class="eyebrow">Backup loaded · ${e(parsedBackup.exportedAt ? new Date(parsedBackup.exportedAt).toLocaleString('en-IN') : 'Unknown date')}</p>
      <p class="small muted">Choose which configuration section to restore safely (artworks &amp; orders are never overwritten automatically).</p>
      <div class="backup-restore-actions">
        ${items.map(([label, kind, meta, available]) => `<button type="button" class="button outline small" data-restore-kind="${e(kind)}" ${available ? '' : 'disabled'}>Restore ${e(label)} (${e(meta)})</button>`).join('')}
      </div>
    </div>`;
    slot.querySelectorAll('[data-restore-kind]').forEach(btn => {
      btn.onclick = async () => {
        const kind = btn.dataset.restoreKind;
        if (!window.confirm(`Restore ${kind} from this backup file? This will overwrite your currently published ${kind}.`)) return;
        const notice = root.querySelector('#backup-notice');
        btn.disabled = true;
        try {
          await onRestore(kind, parsedBackup[kind]);
          if (notice) { notice.textContent = `Restored ${kind} from backup.`; notice.classList.add('is-success'); }
        } catch (error) {
          if (notice) { notice.textContent = error.message || 'Could not restore section.'; notice.classList.remove('is-success'); }
        } finally {
          if (!disposed && btn.isConnected) btn.disabled = false;
        }
      };
    });
  }

  function render() {
    root.innerHTML = `<div class="admin-title">
        <div>
          <p class="eyebrow">Safeguard &amp; portability</p>
          <h1>Backup &amp; export</h1>
          <p>Download complete JSON studio snapshots, spreadsheet-safe CSV exports, or restore settings from an earlier backup.</p>
        </div>
      </div>
      ${statusBannerMarkup()}
      <p id="backup-notice" class="notice" role="status"></p>
      <div class="backup-grid">
        <section class="dashboard-panel backup-card">
          <p class="eyebrow">Complete archive</p>
          <h2>Full studio backup (JSON)</h2>
          <p class="small muted">Includes artworks, artist pages, storefront copy &amp; policies, banners, section order, promos, customer orders and verified sales.</p>
          <button type="button" class="button" id="backup-download-json">Download full JSON backup ↓</button>
        </section>

        <section class="dashboard-panel backup-card">
          <p class="eyebrow">Spreadsheets</p>
          <h2>Export CSV tables</h2>
          <p class="small muted">Download clean UTF-8 CSV files ready for Excel, Google Sheets or accounting records.</p>
          <div class="backup-csv-btns">
            <button type="button" class="button outline small" id="export-products-csv">Artworks CSV ↓</button>
            <button type="button" class="button outline small" id="export-orders-csv">Orders CSV ↓</button>
            <button type="button" class="button outline small" id="export-artists-csv">Artists CSV ↓</button>
          </div>
        </section>

        <section class="dashboard-panel backup-card backup-card-wide">
          <p class="eyebrow">Selective recovery</p>
          <h2>Restore configuration from backup</h2>
          <p class="small muted">Select a previously downloaded <code>hehe-cafe-backup-*.json</code> file to preview and restore storefront copy, banners, artists or promos.</p>
          <label class="content-upload">Choose backup JSON file<input type="file" id="backup-restore-file" accept="application/json,.json"></label>
          <div id="backup-restore-preview"></div>
        </section>
      </div>`;

    const setStatus = (msg, ok = true) => {
      const notice = root.querySelector('#backup-notice');
      if (notice) {
        notice.textContent = msg;
        notice.classList.toggle('is-success', ok);
      }
    };

    root.querySelector('#backup-download-json').onclick = async () => {
      const btn = root.querySelector('#backup-download-json');
      btn.disabled = true;
      setStatus('Collecting live studio snapshot…');
      try {
        const snap = await getSnapshot();
        if (disposed) return;
        const payload = { version: 1, exportedAt: new Date().toISOString(), store: 'hehe.cafe', ...snap };
        const dayStr = new Date().toISOString().slice(0, 10);
        const summary = `${snap.products?.length || 0} artworks · ${snap.orders?.length || 0} orders · ${snap.artists?.length || 0} artists`;
        downloadFile(JSON.stringify(payload, null, 2), `hehe-cafe-backup-${dayStr}.json`, 'application/json;charset=utf-8');
        writeBackupStamp(summary);
        render();
        setStatus(`Full backup downloaded (${summary}).`);
      } catch (error) {
        setStatus(error.message || 'Could not generate backup.', false);
      } finally {
        if (!disposed && btn.isConnected) btn.disabled = false;
      }
    };

    root.querySelector('#export-products-csv').onclick = async () => {
      const snap = await getSnapshot();
      const csv = toCSV(
        ['ID', 'Title', 'Artist', 'Category', 'Price (INR)', 'Compare Price', 'Stock', 'Visible', 'In Banner', 'SKU', 'Display Order'],
        (snap.products || []).map(p => [p.id, p.title, p.artist, p.productType, p.price, p.comparePrice || 0, p.stock, p.visible, p.inBanner !== false, p.sku || '', p.displayOrder])
      );
      downloadFile(csv, `hehe-cafe-artworks-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8');
      setStatus(`Exported ${(snap.products || []).length} artworks to CSV.`);
    };

    root.querySelector('#export-orders-csv').onclick = async () => {
      const snap = await getSnapshot();
      const csv = toCSV(
        ['Order ID', 'Status', 'Payment', 'Customer', 'Email', 'Phone', 'City', 'PIN', 'Items', 'Subtotal', 'Created'],
        (snap.orders || []).map(o => [
          o.id,
          o.status,
          o.paymentStatus,
          `${o.customer?.firstName || ''} ${o.customer?.lastName || ''}`.trim(),
          o.customer?.email || '',
          o.customer?.phone || '',
          o.customer?.city || '',
          o.customer?.postalCode || '',
          (o.items || []).map(i => `${i.quantity}x ${i.title}`).join('; '),
          money(o.estimatedSubtotal),
          o.createdAt?.seconds ? new Date(o.createdAt.seconds * 1000).toISOString() : (o.createdAt || '')
        ])
      );
      downloadFile(csv, `hehe-cafe-orders-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8');
      setStatus(`Exported ${(snap.orders || []).length} orders to CSV.`);
    };

    root.querySelector('#export-artists-csv').onclick = async () => {
      const snap = await getSnapshot();
      const csv = toCSV(
        ['Slug', 'Name', 'Style', 'Location', 'Visible', 'Featured', 'Instagram', 'Website'],
        (snap.artists || []).map(a => [a.id, a.name, a.style, a.location || '', a.visible !== false, Boolean(a.featured), a.instagram || '', a.website || ''])
      );
      downloadFile(csv, `hehe-cafe-artists-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8');
      setStatus(`Exported ${(snap.artists || []).length} artists to CSV.`);
    };

    root.querySelector('#backup-restore-file').addEventListener('change', async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data || typeof data !== 'object' || (!data.content && !data.settings && !data.artists && !data.promos)) {
          throw new Error('This JSON file does not contain valid hehe.cafe studio data.');
        }
        parsedBackup = data;
        renderRestorePreview();
        setStatus('Backup file loaded. Select a section below to restore.');
      } catch (error) {
        parsedBackup = null;
        renderRestorePreview();
        setStatus(error.message || 'Could not read backup JSON file.', false);
      } finally {
        event.target.value = '';
      }
    });
  }

  render();

  return {
    destroy() {
      disposed = true;
    }
  };
}

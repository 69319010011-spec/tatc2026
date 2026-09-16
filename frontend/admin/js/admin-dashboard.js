// ---- Auth guard ----
if (!localStorage.getItem('admin_token')) {
  window.location.href = 'login.html';
}

const adminInfo = JSON.parse(localStorage.getItem('admin_info') || '{}');
document.getElementById('admin-name-label').textContent = adminInfo.name || '';

document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_info');
  window.location.href = 'login.html';
});

function refreshLangUI() {
  document.getElementById('lang-th').classList.toggle('active', getLang() === 'th');
  document.getElementById('lang-en').classList.toggle('active', getLang() === 'en');
  applyI18n();
}
document.getElementById('lang-th').addEventListener('click', () => { setLang('th'); refreshLangUI(); loadSectionData(currentSection); });
document.getElementById('lang-en').addEventListener('click', () => { setLang('en'); refreshLangUI(); loadSectionData(currentSection); });
refreshLangUI();

function handleAuthError(err) {
  if (err.status === 401) {
    localStorage.removeItem('admin_token');
    window.location.href = 'login.html';
    return true;
  }
  return false;
}

// ---- Nav switching ----
let currentSection = 'dashboard';
let categoriesCache = [];
let productsCache = [];
let machinesCache = [];

document.querySelectorAll('.nav-item').forEach((el) => {
  el.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach((x) => x.classList.remove('active'));
    el.classList.add('active');
    const section = el.getAttribute('data-section');
    currentSection = section;
    document.querySelectorAll('[id^="section-"]').forEach((s) => (s.style.display = 'none'));
    document.getElementById(`section-${section}`).style.display = '';
    document.getElementById('section-title').textContent = t(`nav_${section}`);
    loadSectionData(section);
  });
});

async function loadSectionData(section) {
  try {
    if (section === 'dashboard') await loadDashboard();
    else if (section === 'products') await loadProducts();
    else if (section === 'slots') await loadSlotsSection();
    else if (section === 'orders') await loadOrders();
    else if (section === 'alerts') await loadAlerts();
    else if (section === 'maintenance') await loadMaintenance();
  } catch (err) {
    console.error(err);
    if (!handleAuthError(err)) alert(err.message);
  }
}

// ---- Dashboard ----
async function loadDashboard() {
  const data = await api.adminDashboard();
  const cards = document.getElementById('stat-cards');
  cards.innerHTML = `
    <div class="stat-card"><div class="label">${t('sales_today')}</div><div class="value">฿${Number(data.sales_today.total).toFixed(2)}</div></div>
    <div class="stat-card"><div class="label">${t('orders_today')}</div><div class="value">${data.sales_today.orders}</div></div>
    <div class="stat-card"><div class="label">${t('open_alerts')}</div><div class="value">${data.open_alerts}</div></div>
    <div class="stat-card"><div class="label">${t('low_stock_slots')}</div><div class="value">${data.low_stock_slots}</div></div>
  `;
  const body = document.getElementById('machines-table-body');
  body.innerHTML = data.machines
    .map((m) => `<tr><td>${m.machine_code}</td><td>${m.location_name}</td><td><span class="badge ${m.status}">${m.status}</span></td></tr>`)
    .join('') || `<tr><td colspan="3">${t('no_data')}</td></tr>`;

  const [daily, byCategory, topProducts] = await Promise.all([
    api.adminSalesDaily(14),
    api.adminSalesByCategory(),
    api.adminTopProducts(8),
  ]);
  renderSalesTrendChart('chart-daily', daily);
  renderCategoryChart('chart-category', byCategory);
  renderTopProductsChart('chart-top-products', topProducts);
}

// ---- Charts ----
function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function formatShortDate(dateStr) {
  const d = new Date(dateStr);
  return getLang() === 'th'
    ? `${d.getDate()}/${d.getMonth() + 1}`
    : d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

function ensureTooltip(container) {
  let tip = container.querySelector('.chart-tooltip');
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'chart-tooltip';
    container.appendChild(tip);
  }
  return tip;
}

function showTooltip(container, tip, x, y, html) {
  tip.innerHTML = html;
  tip.style.left = `${x}px`;
  tip.style.top = `${y}px`;
  tip.classList.add('show');
}

function hideTooltip(tip) {
  tip.classList.remove('show');
}

// Line chart: daily revenue trend, single series.
function renderSalesTrendChart(containerId, rows) {
  const container = document.getElementById(containerId);
  container.querySelectorAll('svg').forEach((el) => el.remove());
  if (!rows || rows.length === 0) {
    container.insertAdjacentHTML('afterbegin', `<div class="chart-empty">${t('no_data')}</div>`);
    return;
  }

  const W = 600, H = 220, padL = 44, padR = 14, padT = 14, padB = 28;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const values = rows.map((r) => Number(r.total));
  const maxVal = Math.max(1, ...values) * 1.15;
  const stepX = rows.length > 1 ? plotW / (rows.length - 1) : 0;
  const xAt = (i) => padL + stepX * i;
  const yAt = (v) => padT + plotH - (v / maxVal) * plotH;

  const gridCount = 4;
  let gridLines = '';
  let gridLabels = '';
  for (let g = 0; g <= gridCount; g++) {
    const v = (maxVal / gridCount) * g;
    const y = yAt(v);
    gridLines += `<line class="chart-gridline" x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" />`;
    gridLabels += `<text class="chart-axis-label" x="${padL - 6}" y="${y + 3}" text-anchor="end">${Math.round(v)}</text>`;
  }

  const points = rows.map((r, i) => `${xAt(i)},${yAt(Number(r.total))}`).join(' ');

  const labelEvery = Math.ceil(rows.length / 7);
  let xLabels = '';
  rows.forEach((r, i) => {
    if (i % labelEvery === 0 || i === rows.length - 1) {
      xLabels += `<text class="chart-axis-label" x="${xAt(i)}" y="${H - 8}" text-anchor="middle">${formatShortDate(r.date)}</text>`;
    }
  });

  let dots = '';
  rows.forEach((r, i) => {
    const x = xAt(i), y = yAt(Number(r.total));
    dots += `<circle class="chart-dot" cx="${x}" cy="${y}" r="3"></circle>`;
    dots += `<circle class="chart-dot-hit" data-i="${i}" cx="${x}" cy="${y}" r="12"></circle>`;
  });

  const svg = `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
      ${gridLines}
      <line class="chart-baseline" x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" />
      ${gridLabels}
      ${xLabels}
      <polyline class="chart-line" points="${points}" />
      ${dots}
    </svg>`;
  container.insertAdjacentHTML('afterbegin', svg);

  const tip = ensureTooltip(container);
  const svgEl = container.querySelector('svg');
  container.querySelectorAll('.chart-dot-hit').forEach((hit) => {
    hit.addEventListener('mouseenter', (e) => {
      const i = parseInt(hit.getAttribute('data-i'), 10);
      const row = rows[i];
      const rect = svgEl.getBoundingClientRect();
      const scale = rect.width / W;
      const px = parseFloat(hit.getAttribute('cx')) * scale;
      const py = parseFloat(hit.getAttribute('cy')) * scale;
      showTooltip(container, tip, px, py, `
        <div class="tt-title">${formatShortDate(row.date)}</div>
        <div>฿${Number(row.total).toFixed(2)} · ${row.orders} ${t('chart_orders_label')}</div>
      `);
    });
    hit.addEventListener('mouseleave', () => hideTooltip(tip));
  });
}

// Vertical bar chart: revenue by category, fixed categorical color order.
function renderCategoryChart(containerId, rows) {
  const container = document.getElementById(containerId);
  container.querySelectorAll('svg, .chart-legend').forEach((el) => el.remove());
  if (!rows || rows.length === 0) {
    container.insertAdjacentHTML('afterbegin', `<div class="chart-empty">${t('no_data')}</div>`);
    return;
  }

  const colors = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)'];
  const W = 420, H = 240, padL = 36, padR = 10, padT = 14, padB = 40;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const values = rows.map((r) => Number(r.revenue));
  const maxVal = Math.max(1, ...values) * 1.2;
  const barGap = 14;
  const barW = (plotW - barGap * (rows.length - 1)) / rows.length;
  const yAt = (v) => padT + plotH - (v / maxVal) * plotH;

  let bars = '';
  let labels = '';
  rows.forEach((r, i) => {
    const x = padL + i * (barW + barGap);
    const v = Number(r.revenue);
    const y = yAt(v);
    const h = padT + plotH - y;
    const color = colors[i % colors.length];
    bars += `<rect class="chart-bar" data-i="${i}" x="${x}" y="${y}" width="${barW}" height="${Math.max(h, 1)}" rx="4" fill="${color}"></rect>`;
    labels += `<text class="chart-bar-value" x="${x + barW / 2}" y="${y - 6}" text-anchor="middle">฿${Math.round(v)}</text>`;
    const name = getLang() === 'th' ? r.name_th : r.name_en;
    labels += `<text class="chart-axis-label" x="${x + barW / 2}" y="${H - 12}" text-anchor="middle">${escapeHtml(name)}</text>`;
  });

  const svg = `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
      <line class="chart-baseline" x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" />
      ${bars}
      ${labels}
    </svg>`;
  container.insertAdjacentHTML('afterbegin', svg);

  const legend = document.createElement('div');
  legend.className = 'chart-legend';
  legend.innerHTML = rows
    .map((r, i) => {
      const name = getLang() === 'th' ? r.name_th : r.name_en;
      return `<span class="chart-legend-item"><span class="chart-legend-swatch" style="background:${colors[i % colors.length]}"></span>${escapeHtml(name)}</span>`;
    })
    .join('');
  container.appendChild(legend);

  const tip = ensureTooltip(container);
  const svgEl = container.querySelector('svg');
  container.querySelectorAll('.chart-bar').forEach((bar) => {
    bar.addEventListener('mouseenter', () => {
      const i = parseInt(bar.getAttribute('data-i'), 10);
      const row = rows[i];
      const rect = svgEl.getBoundingClientRect();
      const scale = rect.width / W;
      const px = (parseFloat(bar.getAttribute('x')) + parseFloat(bar.getAttribute('width')) / 2) * scale;
      const py = parseFloat(bar.getAttribute('y')) * scale;
      const name = getLang() === 'th' ? row.name_th : row.name_en;
      showTooltip(container, tip, px, py, `
        <div class="tt-title">${escapeHtml(name)}</div>
        <div>฿${Number(row.revenue).toFixed(2)}</div>
      `);
    });
    bar.addEventListener('mouseleave', () => hideTooltip(tip));
  });
}

// Horizontal bar chart: top products by units sold, single hue.
function renderTopProductsChart(containerId, rows) {
  const container = document.getElementById(containerId);
  container.querySelectorAll('svg').forEach((el) => el.remove());
  if (!rows || rows.length === 0) {
    container.insertAdjacentHTML('afterbegin', `<div class="chart-empty">${t('no_data')}</div>`);
    return;
  }

  const W = 600;
  const rowH = 30;
  const padL = 10, padR = 50, padT = 10;
  const H = padT + rows.length * rowH + 10;
  const plotW = W - padL - padR;
  const maxVal = Math.max(1, ...rows.map((r) => Number(r.qty_sold)));

  let bars = '';
  rows.forEach((r, i) => {
    const y = padT + i * rowH;
    const w = Math.max(4, (Number(r.qty_sold) / maxVal) * plotW * 0.65);
    const name = getLang() === 'th' ? r.name_th : r.name_en;
    bars += `<rect class="chart-bar" data-i="${i}" x="${padL}" y="${y}" width="${w}" height="16" rx="4" fill="var(--series-1)"></rect>`;
    bars += `<text class="chart-bar-label" x="${padL}" y="${y - 4}">${escapeHtml(name)}</text>`;
    bars += `<text class="chart-bar-value" x="${padL + w + 8}" y="${y + 12}">${r.qty_sold}</text>`;
  });

  const svg = `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
      ${bars}
    </svg>`;
  container.insertAdjacentHTML('afterbegin', svg);

  const tip = ensureTooltip(container);
  const svgEl = container.querySelector('svg');
  container.querySelectorAll('.chart-bar').forEach((bar) => {
    bar.addEventListener('mouseenter', () => {
      const i = parseInt(bar.getAttribute('data-i'), 10);
      const row = rows[i];
      const rect = svgEl.getBoundingClientRect();
      const scale = rect.width / W;
      const px = (parseFloat(bar.getAttribute('x')) + parseFloat(bar.getAttribute('width'))) * scale;
      const py = parseFloat(bar.getAttribute('y')) * scale;
      const name = getLang() === 'th' ? row.name_th : row.name_en;
      showTooltip(container, tip, px, py, `
        <div class="tt-title">${escapeHtml(name)}</div>
        <div>${row.qty_sold} ${t('chart_qty_label')} · ฿${Number(row.revenue).toFixed(2)}</div>
      `);
    });
    bar.addEventListener('mouseleave', () => hideTooltip(tip));
  });
}

// ---- Products ----
async function ensureCategories() {
  if (categoriesCache.length === 0) {
    categoriesCache = await api.adminCategories();
  }
  return categoriesCache;
}

async function loadProducts() {
  await ensureCategories();
  productsCache = await api.adminProducts();
  const body = document.getElementById('products-table-body');
  body.innerHTML = productsCache
    .map((p) => `
      <tr>
        <td>${p.sku || '-'}</td>
        <td>${p.name_th}</td>
        <td>${p.name_en}</td>
        <td>${getLang() === 'th' ? p.category_name_th : p.category_name_en}</td>
        <td>฿${Number(p.base_price).toFixed(2)}</td>
        <td>
          <button class="btn-small secondary" data-edit="${p.product_id}">${t('edit')}</button>
          <button class="btn-small" data-del="${p.product_id}">${t('delete')}</button>
        </td>
      </tr>`)
    .join('') || `<tr><td colspan="6">${t('no_data')}</td></tr>`;

  body.querySelectorAll('[data-edit]').forEach((btn) =>
    btn.addEventListener('click', () => openProductModal(parseInt(btn.getAttribute('data-edit'), 10)))
  );
  body.querySelectorAll('[data-del]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      if (!confirm(t('delete') + '?')) return;
      await api.adminDeleteProduct(btn.getAttribute('data-del'));
      loadProducts();
    })
  );
}

function fillCategorySelect(select) {
  select.innerHTML = categoriesCache
    .map((c) => `<option value="${c.category_id}">${getLang() === 'th' ? c.name_th : c.name_en}</option>`)
    .join('');
}

function openProductModal(productId) {
  fillCategorySelect(document.getElementById('product-category'));
  const modal = document.getElementById('product-modal');
  document.getElementById('product-modal-title').textContent = productId ? t('edit') : t('add_product');
  if (productId) {
    const p = productsCache.find((x) => x.product_id === productId);
    document.getElementById('product-id-input').value = p.product_id;
    document.getElementById('product-sku').value = p.sku || '';
    document.getElementById('product-category').value = p.category_id;
    document.getElementById('product-name-th').value = p.name_th;
    document.getElementById('product-name-en').value = p.name_en;
    document.getElementById('product-price').value = p.base_price;
    document.getElementById('product-calories').value = p.calories || '';
  } else {
    document.getElementById('product-id-input').value = '';
    document.getElementById('product-sku').value = '';
    document.getElementById('product-name-th').value = '';
    document.getElementById('product-name-en').value = '';
    document.getElementById('product-price').value = '';
    document.getElementById('product-calories').value = '';
  }
  modal.classList.add('show');
}

document.getElementById('add-product-btn').addEventListener('click', () => openProductModal(null));
document.getElementById('product-cancel-btn').addEventListener('click', () => document.getElementById('product-modal').classList.remove('show'));

document.getElementById('product-save-btn').addEventListener('click', async () => {
  const id = document.getElementById('product-id-input').value;
  const payload = {
    category_id: parseInt(document.getElementById('product-category').value, 10),
    sku: document.getElementById('product-sku').value || null,
    name_th: document.getElementById('product-name-th').value,
    name_en: document.getElementById('product-name-en').value,
    base_price: parseFloat(document.getElementById('product-price').value),
    calories: document.getElementById('product-calories').value ? parseInt(document.getElementById('product-calories').value, 10) : null,
  };
  try {
    if (id) await api.adminUpdateProduct(id, payload);
    else await api.adminCreateProduct(payload);
    document.getElementById('product-modal').classList.remove('show');
    loadProducts();
  } catch (err) {
    alert(err.message);
  }
});

// ---- Slots ----
async function loadSlotsSection() {
  if (machinesCache.length === 0) machinesCache = await api.adminMachines();
  await ensureCategories();
  if (productsCache.length === 0) productsCache = await api.adminProducts();

  const select = document.getElementById('slot-machine-select');
  if (select.options.length === 0) {
    select.innerHTML = machinesCache.map((m) => `<option value="${m.machine_id}">${m.machine_code} - ${m.location_name}</option>`).join('');
    select.addEventListener('change', loadSlotsTable);
  }
  await loadSlotsTable();
}

let currentSlots = [];

async function loadSlotsTable() {
  const machineId = document.getElementById('slot-machine-select').value;
  if (!machineId) return;
  currentSlots = await api.adminSlots(machineId);
  const body = document.getElementById('slots-table-body');
  body.innerHTML = currentSlots
    .map((s) => `
      <tr data-row="${s.slot_id}">
        <td>${s.slot_code}</td>
        <td>${s.name_th ? (getLang() === 'th' ? s.name_th : s.name_en) : '<em>empty</em>'}</td>
        <td>฿${s.base_price ? Number(s.price_override || s.base_price).toFixed(2) : '-'}</td>
        <td>
          <div class="qty-stepper-admin">
            <button class="qty-btn qty-minus" data-adjust="${s.slot_id}" data-delta="-1">&minus;</button>
            <span class="qty-value" data-stock-for="${s.slot_id}">${s.current_stock} / ${s.capacity}</span>
            <button class="qty-btn qty-plus" data-adjust="${s.slot_id}" data-delta="1">&plus;</button>
          </div>
        </td>
        <td><button class="btn-small secondary" data-slot="${s.slot_id}">${t('restock')}</button></td>
      </tr>`)
    .join('') || `<tr><td colspan="5">${t('no_data')}</td></tr>`;

  body.querySelectorAll('[data-slot]').forEach((btn) =>
    btn.addEventListener('click', () => openSlotModal(parseInt(btn.getAttribute('data-slot'), 10), currentSlots))
  );
  body.querySelectorAll('[data-adjust]').forEach((btn) =>
    btn.addEventListener('click', () => adjustSlotStock(btn))
  );
}

async function adjustSlotStock(btn) {
  const slotId = btn.getAttribute('data-adjust');
  const delta = parseInt(btn.getAttribute('data-delta'), 10);
  btn.disabled = true;
  try {
    const result = await api.adminAdjustStock(slotId, delta);
    const slot = currentSlots.find((s) => String(s.slot_id) === String(slotId));
    if (slot) slot.current_stock = result.current_stock;
    const label = document.querySelector(`[data-stock-for="${slotId}"]`);
    if (label && slot) label.textContent = `${slot.current_stock} / ${slot.capacity}`;
  } catch (err) {
    if (!handleAuthError(err)) alert(err.message);
  } finally {
    btn.disabled = false;
  }
}

function openSlotModal(slotId, slots) {
  const slot = slots.find((s) => s.slot_id === slotId);
  const productSelect = document.getElementById('slot-product-select');
  productSelect.innerHTML =
    `<option value="">-- none --</option>` +
    productsCache.map((p) => `<option value="${p.product_id}">${getLang() === 'th' ? p.name_th : p.name_en}</option>`).join('');
  productSelect.value = slot.product_id || '';
  document.getElementById('slot-id-input').value = slotId;
  document.getElementById('slot-qty-input').value = 0;
  document.getElementById('slot-expiry-input').value = '';
  document.getElementById('slot-batch-input').value = '';
  document.getElementById('slot-modal').classList.add('show');
}

document.getElementById('slot-cancel-btn').addEventListener('click', () => document.getElementById('slot-modal').classList.remove('show'));

document.getElementById('slot-save-btn').addEventListener('click', async () => {
  const slotId = document.getElementById('slot-id-input').value;
  const productId = document.getElementById('slot-product-select').value;
  const qty = parseInt(document.getElementById('slot-qty-input').value, 10) || 0;
  const expiry = document.getElementById('slot-expiry-input').value || null;
  const batch = document.getElementById('slot-batch-input').value || null;
  try {
    await api.adminUpdateSlot(slotId, { product_id: productId ? parseInt(productId, 10) : null });
    if (qty > 0) {
      await api.adminRestock(slotId, { qty_added: qty, expiry_date: expiry, batch_no: batch });
    }
    document.getElementById('slot-modal').classList.remove('show');
    loadSlotsTable();
  } catch (err) {
    alert(err.message);
  }
});

// ---- Orders ----
async function loadOrders() {
  const orders = await api.adminOrders();
  const body = document.getElementById('orders-table-body');
  body.innerHTML = orders
    .map((o) => {
      const items = (o.items || [])
        .map((i) => `${getLang() === 'th' ? i.name_th : i.name_en} x${i.qty}`)
        .join(', ');
      return `<tr>
        <td>#${o.order_id}</td>
        <td>${o.machine_code}</td>
        <td>${items}</td>
        <td>฿${Number(o.total_amount).toFixed(2)}</td>
        <td><span class="badge ${o.payment_status === 'paid' ? 'resolved' : 'open'}">${o.payment_status}</span></td>
        <td>${new Date(o.created_at).toLocaleString()}</td>
      </tr>`;
    })
    .join('') || `<tr><td colspan="6">${t('no_data')}</td></tr>`;
}

// ---- Alerts ----
async function loadAlerts() {
  const alerts = await api.adminAlerts();
  const body = document.getElementById('alerts-table-body');
  body.innerHTML = alerts
    .map((a) => `
      <tr>
        <td>${a.machine_code}</td>
        <td>${a.slot_code || '-'}</td>
        <td>${a.alert_type}</td>
        <td>${a.message || ''}</td>
        <td><span class="badge ${a.status}">${a.status}</span></td>
        <td>
          ${a.status === 'open' ? `<button class="btn-small secondary" data-ack="${a.alert_id}">${t('acknowledge')}</button>` : ''}
          ${a.status !== 'resolved' ? `<button class="btn-small" data-resolve="${a.alert_id}">${t('resolve')}</button>` : ''}
        </td>
      </tr>`)
    .join('') || `<tr><td colspan="6">${t('no_data')}</td></tr>`;

  body.querySelectorAll('[data-ack]').forEach((btn) =>
    btn.addEventListener('click', async () => { await api.adminUpdateAlert(btn.getAttribute('data-ack'), 'acknowledged'); loadAlerts(); })
  );
  body.querySelectorAll('[data-resolve]').forEach((btn) =>
    btn.addEventListener('click', async () => { await api.adminUpdateAlert(btn.getAttribute('data-resolve'), 'resolved'); loadAlerts(); })
  );
}

// ---- Maintenance ----
async function loadMaintenance() {
  const logs = await api.adminMaintenance();
  const body = document.getElementById('maintenance-table-body');
  body.innerHTML = logs
    .map((m) => `
      <tr>
        <td>${m.machine_code}</td>
        <td>${m.issue_type}</td>
        <td>${m.description || ''}</td>
        <td>${new Date(m.reported_at).toLocaleString()}</td>
        <td><span class="badge ${m.resolved_at ? 'resolved' : 'open'}">${m.resolved_at ? 'resolved' : 'open'}</span></td>
        <td>${!m.resolved_at ? `<button class="btn-small" data-resolve-m="${m.maintenance_id}">${t('resolve')}</button>` : ''}</td>
      </tr>`)
    .join('') || `<tr><td colspan="6">${t('no_data')}</td></tr>`;

  body.querySelectorAll('[data-resolve-m]').forEach((btn) =>
    btn.addEventListener('click', async () => { await api.adminResolveMaintenance(btn.getAttribute('data-resolve-m')); loadMaintenance(); })
  );
}

loadSectionData('dashboard');

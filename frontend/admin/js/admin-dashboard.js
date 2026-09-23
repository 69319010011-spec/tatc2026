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

// Mirrors the backend role policy (the server is the real enforcement; this only hides controls).
let currentRole = null;
const PERMS = {
  viewDashboard: ['super_admin'],
  manageProducts: ['super_admin'],
  createMachine: ['super_admin'],
  editMachine: ['super_admin', 'technician'],
  expandSlots: ['super_admin', 'technician'],
  manageSlots: ['super_admin', 'restocker'],
  manageMaintenance: ['super_admin', 'technician'],
  manageAdmins: ['super_admin'],
};
function can(permission) {
  return (PERMS[permission] || []).includes(currentRole);
}

function applyRoleUI() {
  document.querySelector('[data-section="dashboard"]').style.display = can('viewDashboard') ? '' : 'none';
  document.getElementById('nav-admins').style.display = can('manageAdmins') ? '' : 'none';
  document.getElementById('add-product-btn').style.display = can('manageProducts') ? '' : 'none';
  document.getElementById('add-machine-btn').style.display = can('createMachine') ? '' : 'none';
  document.getElementById('add-slots-btn').style.display = can('expandSlots') ? '' : 'none';
}

function showSection(section) {
    if (!currentRole || (section === 'dashboard' && !can('viewDashboard'))) return;
    document.querySelectorAll('.nav-item').forEach((x) => x.classList.remove('active'));
    document.querySelector(`[data-section="${section}"]`).classList.add('active');
    currentSection = section;
    document.querySelectorAll('[id^="section-"]').forEach((s) => (s.style.display = 'none'));
    document.getElementById(`section-${section}`).style.display = '';
    document.getElementById('section-title').textContent = t(`nav_${section}`);
    document.getElementById('section-title').setAttribute('data-i18n', `nav_${section}`);
    loadSectionData(section);
}

document.querySelectorAll('.nav-item').forEach((el) => {
  el.addEventListener('click', () => showSection(el.getAttribute('data-section')));
});

async function loadSectionData(section) {
  if (!currentRole || (section === 'dashboard' && !can('viewDashboard'))) return;
  try {
    if (section === 'dashboard') await loadDashboard();
    else if (section === 'products') await loadProducts();
    else if (section === 'machines') await loadMachinesSection();
    else if (section === 'slots') await loadSlotsSection();
    else if (section === 'orders') await loadOrders();
    else if (section === 'alerts') await loadAlerts();
    else if (section === 'maintenance') await loadMaintenance();
    else if (section === 'admins') await loadAdminsSection();
  } catch (err) {
    console.error(err);
    if (!handleAuthError(err)) alert(err.message);
  }
}

// ---- Dashboard ----
async function loadDashboard() {
  if (!can('viewDashboard')) return;
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
        <td>${p.image_url ? `<img class="product-thumb" src="${mediaUrl(p.image_url)}">` : ''}${p.name_th}</td>
        <td>${p.name_en}</td>
        <td>${getLang() === 'th' ? p.category_name_th : p.category_name_en}</td>
        <td>฿${Number(p.base_price).toFixed(2)}</td>
        <td>${can('manageProducts') ? `
          <button class="btn-small secondary" data-edit="${p.product_id}">${t('edit')}</button>
          <button class="btn-small" data-del="${p.product_id}">${t('delete')}</button>` : ''}
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
  const preview = document.getElementById('product-image-preview');
  const fileInput = document.getElementById('product-image-input');
  const hint = document.getElementById('product-image-hint');
  fileInput.value = '';
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
    if (p.image_url) {
      preview.src = mediaUrl(p.image_url);
      preview.hidden = false;
    } else {
      preview.hidden = true;
    }
    hint.textContent = '';
  } else {
    document.getElementById('product-id-input').value = '';
    document.getElementById('product-sku').value = '';
    document.getElementById('product-name-th').value = '';
    document.getElementById('product-name-en').value = '';
    document.getElementById('product-price').value = '';
    document.getElementById('product-calories').value = '';
    preview.hidden = true;
    hint.textContent = t('image_save_first');
  }
  modal.classList.add('show');
}

document.getElementById('product-image-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  const preview = document.getElementById('product-image-preview');
  if (file) {
    preview.src = URL.createObjectURL(file);
    preview.hidden = false;
  }
});

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
  const imageFile = document.getElementById('product-image-input').files[0];
  const saveBtn = document.getElementById('product-save-btn');
  saveBtn.disabled = true;
  try {
    let product;
    if (id) product = await api.adminUpdateProduct(id, payload);
    else product = await api.adminCreateProduct(payload);

    if (imageFile) {
      try {
        await api.adminUploadProductImage(product.product_id, imageFile);
      } catch (imgErr) {
        alert(`${t('image_upload_failed')}: ${imgErr.message}`);
      }
    }
    document.getElementById('product-modal').classList.remove('show');
    loadProducts();
  } catch (err) {
    alert(err.message);
  } finally {
    saveBtn.disabled = false;
  }
});

// ---- Machines ----
async function loadMachinesSection() {
  machinesCache = await api.adminMachines();
  const body = document.getElementById('machines-manage-table-body');
  body.innerHTML = machinesCache
    .map((m) => `
      <tr>
        <td>${m.machine_code}</td>
        <td>${m.location_name}</td>
        <td>${t('machine_type_' + m.machine_type)}</td>
        <td><span class="badge ${m.status}">${t('status_' + m.status)}</span></td>
        <td>${can('editMachine') ? `<button class="btn-small secondary" data-edit-machine="${m.machine_id}">${t('edit')}</button>` : ''}</td>
      </tr>`)
    .join('') || `<tr><td colspan="5">${t('no_data')}</td></tr>`;

  body.querySelectorAll('[data-edit-machine]').forEach((btn) =>
    btn.addEventListener('click', () => openMachineModal(parseInt(btn.getAttribute('data-edit-machine'), 10)))
  );
}

function openMachineModal(machineId) {
  const modal = document.getElementById('machine-modal');
  const statusField = document.getElementById('machine-status-field');
  const slotsField = document.getElementById('machine-slots-field');
  const codeInput = document.getElementById('machine-code-input');

  if (machineId) {
    const m = machinesCache.find((x) => x.machine_id === machineId);
    document.getElementById('machine-modal-title').textContent = t('edit');
    document.getElementById('machine-id-input').value = m.machine_id;
    codeInput.value = m.machine_code;
    codeInput.disabled = true;
    document.getElementById('machine-location-input').value = m.location_name;
    document.getElementById('machine-type-input').value = m.machine_type;
    document.getElementById('machine-status-input').value = m.status;
    statusField.style.display = '';
    slotsField.style.display = 'none';
  } else {
    document.getElementById('machine-modal-title').textContent = t('add_machine');
    document.getElementById('machine-id-input').value = '';
    codeInput.value = '';
    codeInput.disabled = false;
    document.getElementById('machine-location-input').value = '';
    document.getElementById('machine-type-input').value = 'mixed';
    document.getElementById('machine-slots-input').value = 24;
    statusField.style.display = 'none';
    slotsField.style.display = '';
  }
  modal.classList.add('show');
}

document.getElementById('add-machine-btn').addEventListener('click', () => openMachineModal(null));
document.getElementById('machine-cancel-btn').addEventListener('click', () => document.getElementById('machine-modal').classList.remove('show'));

document.getElementById('machine-save-btn').addEventListener('click', async () => {
  const id = document.getElementById('machine-id-input').value;
  try {
    if (id) {
      await api.adminUpdateMachine(id, {
        location_name: document.getElementById('machine-location-input').value,
        machine_type: document.getElementById('machine-type-input').value,
        status: document.getElementById('machine-status-input').value,
      });
    } else {
      await api.adminCreateMachine({
        machine_code: document.getElementById('machine-code-input').value.trim(),
        location_name: document.getElementById('machine-location-input').value,
        machine_type: document.getElementById('machine-type-input').value,
        total_slots: parseInt(document.getElementById('machine-slots-input').value, 10) || 24,
      });
    }
    document.getElementById('machine-modal').classList.remove('show');
    loadMachinesSection();
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
            ${can('manageSlots') ? `<button class="qty-btn qty-minus" data-adjust="${s.slot_id}" data-delta="-1">&minus;</button>` : ''}
            <span class="qty-value" data-stock-for="${s.slot_id}">${s.current_stock} / ${s.capacity}</span>
            ${can('manageSlots') ? `<button class="qty-btn qty-plus" data-adjust="${s.slot_id}" data-delta="1">&plus;</button>` : ''}
          </div>
        </td>
        <td>${can('manageSlots') ? `<button class="btn-small secondary" data-slot="${s.slot_id}">${t('restock')}</button>` : ''}</td>
      </tr>`)
    .join('') || `<tr><td colspan="5">${t('no_data')}</td></tr>`;

  body.querySelectorAll('[data-slot]').forEach((btn) =>
    btn.addEventListener('click', () => openSlotModal(parseInt(btn.getAttribute('data-slot'), 10), currentSlots))
  );
  body.querySelectorAll('[data-adjust]').forEach((btn) =>
    btn.addEventListener('click', () => adjustSlotStock(btn))
  );

  const hasEmptySlot = currentSlots.some((s) => !s.product_id);
  document.getElementById('slots-full-notice').style.display = hasEmptySlot ? 'none' : '';
}

document.getElementById('add-slots-btn').addEventListener('click', () => {
  document.getElementById('add-slots-count-input').value = 5;
  document.getElementById('add-slots-modal').classList.add('show');
});
document.getElementById('add-slots-cancel-btn').addEventListener('click', () => document.getElementById('add-slots-modal').classList.remove('show'));
document.getElementById('add-slots-save-btn').addEventListener('click', async () => {
  const machineId = document.getElementById('slot-machine-select').value;
  const count = parseInt(document.getElementById('add-slots-count-input').value, 10) || 1;
  const saveBtn = document.getElementById('add-slots-save-btn');
  saveBtn.disabled = true;
  try {
    await api.adminAddSlots(machineId, count);
    document.getElementById('add-slots-modal').classList.remove('show');
    alert(t('slots_added'));
    loadSlotsTable();
  } catch (err) {
    alert(err.message);
  } finally {
    saveBtn.disabled = false;
  }
});

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
        <td>${!m.resolved_at && can('manageMaintenance') ? `<button class="btn-small" data-resolve-m="${m.maintenance_id}">${t('resolve')}</button>` : ''}</td>
      </tr>`)
    .join('') || `<tr><td colspan="6">${t('no_data')}</td></tr>`;

  body.querySelectorAll('[data-resolve-m]').forEach((btn) =>
    btn.addEventListener('click', async () => { await api.adminResolveMaintenance(btn.getAttribute('data-resolve-m')); loadMaintenance(); })
  );
}

// ---- Admin accounts (super_admin only) ----
let adminsCache = [];

async function loadAdminsSection() {
  adminsCache = await api.adminAdmins();
  const body = document.getElementById('admins-table-body');
  body.innerHTML = adminsCache
    .map((a) => `
      <tr>
        <td>${escapeHtml(a.name)} ${a.admin_id === adminInfo.admin_id ? `<small>${t('you_label')}</small>` : ''}</td>
        <td>${escapeHtml(a.username)}</td>
        <td><span class="badge role">${t('role_' + a.role)}</span></td>
        <td><span class="badge ${a.is_active ? 'online' : 'disabled'}">${a.is_active ? t('status_active') : t('status_disabled')}</span></td>
        <td><button class="btn-small secondary" data-edit-admin="${a.admin_id}">${t('edit')}</button></td>
      </tr>`)
    .join('') || `<tr><td colspan="5">${t('no_data')}</td></tr>`;

  body.querySelectorAll('[data-edit-admin]').forEach((btn) =>
    btn.addEventListener('click', () => openAdminModal(parseInt(btn.getAttribute('data-edit-admin'), 10)))
  );
}

function openAdminModal(adminId) {
  const editing = adminId != null;
  const a = editing ? adminsCache.find((x) => x.admin_id === adminId) : null;
  const isSelf = editing && a.admin_id === adminInfo.admin_id;

  document.getElementById('admin-modal-title').textContent = editing ? t('edit') : t('add_admin');
  document.getElementById('admin-id-input').value = editing ? a.admin_id : '';
  document.getElementById('admin-name-input').value = editing ? a.name : '';
  document.getElementById('admin-username-input').value = editing ? a.username : '';
  document.getElementById('admin-username-input').disabled = editing;
  document.getElementById('admin-phone-input').value = editing ? (a.phone || '') : '';
  document.getElementById('admin-role-input').value = editing ? a.role : 'restocker';
  document.getElementById('admin-role-input').disabled = isSelf;
  document.getElementById('admin-password-input').value = '';
  document.getElementById('admin-password-label').textContent = editing ? t('reset_password') : t('password');
  document.getElementById('admin-active-row').style.display = editing && !isSelf ? '' : 'none';
  document.getElementById('admin-active-input').checked = editing ? a.is_active : true;
  document.getElementById('admin-modal').classList.add('show');
}

document.getElementById('add-admin-btn').addEventListener('click', () => openAdminModal(null));
document.getElementById('admin-cancel-btn').addEventListener('click', () => document.getElementById('admin-modal').classList.remove('show'));

document.getElementById('admin-save-btn').addEventListener('click', async () => {
  const id = document.getElementById('admin-id-input').value;
  const password = document.getElementById('admin-password-input').value;
  const saveBtn = document.getElementById('admin-save-btn');
  saveBtn.disabled = true;
  try {
    if (id) {
      const payload = {
        name: document.getElementById('admin-name-input').value,
        phone: document.getElementById('admin-phone-input').value,
      };
      if (!document.getElementById('admin-role-input').disabled) payload.role = document.getElementById('admin-role-input').value;
      if (document.getElementById('admin-active-row').style.display !== 'none') payload.is_active = document.getElementById('admin-active-input').checked;
      if (password) payload.new_password = password;
      await api.adminUpdateAdmin(id, payload);
    } else {
      await api.adminCreateAdmin({
        name: document.getElementById('admin-name-input').value,
        username: document.getElementById('admin-username-input').value,
        phone: document.getElementById('admin-phone-input').value,
        role: document.getElementById('admin-role-input').value,
        password,
      });
    }
    document.getElementById('admin-modal').classList.remove('show');
    loadAdminsSection();
  } catch (err) {
    alert(err.message);
  } finally {
    saveBtn.disabled = false;
  }
});

// ---- Change own password ----
document.getElementById('change-password-btn').addEventListener('click', () => {
  document.getElementById('pw-current-input').value = '';
  document.getElementById('pw-new-input').value = '';
  document.getElementById('password-modal').classList.add('show');
});
document.getElementById('pw-cancel-btn').addEventListener('click', () => document.getElementById('password-modal').classList.remove('show'));
document.getElementById('pw-save-btn').addEventListener('click', async () => {
  const saveBtn = document.getElementById('pw-save-btn');
  saveBtn.disabled = true;
  try {
    await api.adminChangePassword(
      document.getElementById('pw-current-input').value,
      document.getElementById('pw-new-input').value
    );
    document.getElementById('password-modal').classList.remove('show');
    alert(t('password_changed'));
  } catch (err) {
    alert(err.message);
  } finally {
    saveBtn.disabled = false;
  }
});

// ---- Startup: refresh role from the server (it may have changed), then load ----
(async function init() {
  try {
    const me = await api.adminMe();
    currentRole = me.role;
    adminInfo.admin_id = me.admin_id;
    adminInfo.name = me.name;
    adminInfo.role = me.role;
    localStorage.setItem('admin_info', JSON.stringify(adminInfo));
    document.getElementById('admin-name-label').textContent = me.name;
  } catch (err) {
    if (handleAuthError(err)) return;
    alert(err.message);
    return;
  }
  applyRoleUI();
  showSection(can('viewDashboard') ? 'dashboard' : currentRole === 'technician' ? 'maintenance' : 'slots');
})();

const MACHINE_CODE = 'VM-BKK-001';

const CATEGORY_EMOJI = {
  drinks: '🥤',
  snacks: '🍪',
  meals: '🍱',
  general: '🧴',
  healthy: '🥗',
};

const PRODUCT_EMOJI = {
  'D-COKE': '🥤', 'D-PEPSI': '🥤', 'D-WATER': '💧', 'D-SPRITE': '🥤',
  'D-THAITEA': '🧋', 'D-COFFEE': '☕', 'D-MILK': '🥛', 'D-ORANGE': '🧃', 'D-SPORT': '🧉',
  'S-LAYS': '🍟', 'S-HERSHEY': '🍫', 'S-SUNCHIPS': '🌽', 'S-BABYRUTH': '🍫',
  'S-PRETZEL': '🥨', 'S-POPCORN': '🍿', 'S-COOKIE': '🍪', 'S-WAFER': '🧇', 'S-THAICRACKER': '🍘',
  'M-SANDWICH': '🥪', 'M-PIZZA': '🍕', 'M-LUNCHABLE1': '🍕', 'M-LUNCHABLE2': '🧀',
  'M-FRIEDRICE': '🍚', 'M-NOODLE': '🍜', 'M-SUSHI': '🍣', 'M-SPAGHETTI': '🍝', 'M-SALAD': '🥗',
  'G-TISSUE': '🧻', 'G-PAPERTOWEL': '🧻', 'G-DISHSOAP': '🧴', 'G-SUNFLOWEROIL': '🛢️',
  'G-UMBRELLA': '☂️', 'G-TOOTHBRUSH': '🪥', 'G-PHONECHARGER': '🔌', 'G-MASK': '😷', 'G-BATTERY': '🔋',
  'H-BANANA': '🍌', 'H-CLIFPEANUT': '🥜', 'H-CLIFCHOC': '🍫', 'H-GRANOLA': '🌰',
  'H-YOGURT': '🥣', 'H-NUTS': '🥜', 'H-APPLE': '🍎', 'H-BOILEDEGG': '🥚', 'H-FRUITCUP': '🍓',
};

const state = {
  machine: null,
  categories: [],
  slots: [],
  currentCategoryCode: null,
  cart: [], // { slot_id, product_id, name_th, name_en, price, qty, categoryCode }
};

function categoryEmoji(code) {
  return CATEGORY_EMOJI[code] || '📦';
}

function productEmoji(item) {
  return (item.sku && PRODUCT_EMOJI[item.sku]) || categoryEmoji(item.categoryCode || state.currentCategoryCode);
}

function money(n) {
  return Number(n).toFixed(2);
}

async function loadMachine() {
  const data = await api.getMachine(MACHINE_CODE);
  state.machine = data.machine;
  state.categories = data.categories;
  state.slots = data.slots;
  if (!state.currentCategoryCode && state.categories.length) {
    state.currentCategoryCode = state.categories[0].code;
  }
  renderCategories();
  renderProducts();
}

function renderCategories() {
  const rail = document.getElementById('category-rail');
  rail.innerHTML = '';
  state.categories.forEach((cat) => {
    const btn = document.createElement('button');
    btn.className = 'category-btn' + (cat.code === state.currentCategoryCode ? ' active' : '');
    btn.textContent = `${categoryEmoji(cat.code)} ${getLang() === 'th' ? cat.name_th : cat.name_en}`;
    btn.addEventListener('click', () => {
      state.currentCategoryCode = cat.code;
      renderCategories();
      renderProducts();
    });
    rail.appendChild(btn);
  });
}

function slotsForCurrentCategory() {
  const cat = state.categories.find((c) => c.code === state.currentCategoryCode);
  if (!cat) return [];
  return state.slots.filter((s) => s.category_id === cat.category_id);
}

function renderProducts() {
  const title = document.getElementById('category-title');
  const cat = state.categories.find((c) => c.code === state.currentCategoryCode);
  title.textContent = cat ? `${categoryEmoji(cat.code)} ${getLang() === 'th' ? cat.name_th : cat.name_en}` : '';

  const grid = document.getElementById('product-grid');
  grid.innerHTML = '';
  const slots = slotsForCurrentCategory();

  slots.forEach((slot) => {
    if (!slot.product_id) return;
    const card = document.createElement('div');
    const outOfStock = slot.current_stock <= 0;
    card.className = 'product-card' + (outOfStock ? ' disabled' : '');
    card.innerHTML = `
      ${outOfStock ? `<span class="product-stock-badge" data-i18n="out_of_stock">${t('out_of_stock')}</span>` : ''}
      <div class="product-emoji">${productEmoji(slot)}</div>
      <div class="product-name">${localizedName(slot)}</div>
      <div class="product-price">฿${money(slot.price)}</div>
    `;
    if (!outOfStock) {
      card.addEventListener('click', () => addToCart(slot));
    }
    grid.appendChild(card);
  });
}

function addToCart(slot) {
  const existing = state.cart.find((i) => i.slot_id === slot.slot_id);
  const qtyInCart = existing ? existing.qty : 0;
  if (qtyInCart + 1 > slot.current_stock) {
    flashStatus('fail', t('out_of_stock'));
    return;
  }
  if (existing) {
    existing.qty += 1;
  } else {
    state.cart.push({
      slot_id: slot.slot_id,
      product_id: slot.product_id,
      sku: slot.sku,
      name_th: slot.name_th,
      name_en: slot.name_en,
      price: parseFloat(slot.price),
      qty: 1,
      categoryCode: state.currentCategoryCode,
    });
  }
  renderCartBadge();
  bounceCartBtn();
}

function cartTotal() {
  return state.cart.reduce((sum, i) => sum + i.price * i.qty, 0);
}

function decreaseCartQty(idx) {
  const item = state.cart[idx];
  if (!item) return;
  item.qty -= 1;
  if (item.qty <= 0) {
    state.cart.splice(idx, 1);
  }
  renderCartDrawer();
  renderCartBadge();
}

function increaseCartQty(idx) {
  const item = state.cart[idx];
  if (!item) return;
  const slot = state.slots.find((s) => s.slot_id === item.slot_id);
  const maxStock = slot ? slot.current_stock : Infinity;
  if (item.qty + 1 > maxStock) {
    flashStatus('fail', t('out_of_stock'));
    return;
  }
  item.qty += 1;
  renderCartDrawer();
  renderCartBadge();
}

function renderCartBadge() {
  const count = state.cart.reduce((sum, i) => sum + i.qty, 0);
  document.getElementById('cart-count').textContent = count;
  document.getElementById('footer-total').textContent = money(cartTotal());
}

function bounceCartBtn() {
  const btn = document.getElementById('open-cart-btn');
  btn.style.transform = 'scale(1.08)';
  setTimeout(() => (btn.style.transform = 'scale(1)'), 150);
}

function renderCartDrawer() {
  const list = document.getElementById('cart-list');
  list.innerHTML = '';
  if (state.cart.length === 0) {
    list.innerHTML = `<div class="cart-empty" data-i18n="cart_empty">${t('cart_empty')}</div>`;
  } else {
    state.cart.forEach((item, idx) => {
      const row = document.createElement('div');
      row.className = 'cart-item';
      row.innerHTML = `
        <div class="emoji">${productEmoji(item)}</div>
        <div class="info">
          <div class="name">${localizedName(item)}</div>
          <div class="qty-stepper">
            <button class="qty-btn qty-minus" data-idx="${idx}">&minus;</button>
            <span class="qty-value">${item.qty}</span>
            <button class="qty-btn qty-plus" data-idx="${idx}">&plus;</button>
          </div>
        </div>
        <div class="price">฿${money(item.price * item.qty)}</div>
      `;
      row.querySelector('.qty-minus').addEventListener('click', () => decreaseCartQty(idx));
      row.querySelector('.qty-plus').addEventListener('click', () => increaseCartQty(idx));
      list.appendChild(row);
    });
  }
  document.getElementById('drawer-total').textContent = money(cartTotal());
  document.getElementById('pay-btn').disabled = state.cart.length === 0;
}

function flashStatus(kind, message) {
  const overlay = document.getElementById('status-overlay');
  const body = document.getElementById('status-body');
  body.className = `status-view ${kind}`;
  body.innerHTML = `<div class="icon">${kind === 'success' ? '&#10003;' : '&#10007;'}</div><p>${message}</p>`;
  overlay.classList.add('show');
  setTimeout(() => overlay.classList.remove('show'), 1400);
}

function resetKiosk() {
  state.cart = [];
  renderCartBadge();
  renderCartDrawer();
}

function setupLangToggle() {
  function refresh() {
    document.getElementById('lang-th').classList.toggle('active', getLang() === 'th');
    document.getElementById('lang-en').classList.toggle('active', getLang() === 'en');
    applyI18n();
    renderCategories();
    renderProducts();
    renderCartDrawer();
  }
  document.getElementById('lang-th').addEventListener('click', () => { setLang('th'); refresh(); });
  document.getElementById('lang-en').addEventListener('click', () => { setLang('en'); refresh(); });
  refresh();
}

function setupCartOverlay() {
  document.getElementById('open-cart-btn').addEventListener('click', () => {
    renderCartDrawer();
    document.getElementById('cart-overlay').classList.add('show');
  });
  document.getElementById('close-cart-btn').addEventListener('click', () => {
    document.getElementById('cart-overlay').classList.remove('show');
  });
  document.getElementById('pay-btn').addEventListener('click', () => {
    document.getElementById('cart-overlay').classList.remove('show');
    document.getElementById('pay-overlay').classList.add('show');
    selectedPayMethod = null;
    document.querySelectorAll('.pay-method').forEach((el) => el.classList.remove('selected'));
    document.getElementById('confirm-pay-btn').disabled = true;
  });
}

let selectedPayMethod = null;

function setupPayOverlay() {
  document.querySelectorAll('.pay-method').forEach((el) => {
    el.addEventListener('click', () => {
      document.querySelectorAll('.pay-method').forEach((x) => x.classList.remove('selected'));
      el.classList.add('selected');
      selectedPayMethod = el.getAttribute('data-method');
      document.getElementById('confirm-pay-btn').disabled = false;
    });
  });
  document.getElementById('close-pay-btn').addEventListener('click', () => {
    document.getElementById('pay-overlay').classList.remove('show');
  });
  document.getElementById('confirm-pay-btn').addEventListener('click', doCheckout);
}

async function doCheckout() {
  if (!selectedPayMethod || state.cart.length === 0) return;
  document.getElementById('pay-overlay').classList.remove('show');
  const overlay = document.getElementById('status-overlay');
  const body = document.getElementById('status-body');
  body.className = 'status-view';
  body.innerHTML = `<div class="icon">&#8987;</div><p>${t('pay_processing')}</p>`;
  overlay.classList.add('show');

  try {
    const payload = {
      machine_code: MACHINE_CODE,
      payment_method: selectedPayMethod,
      items: state.cart.map((i) => ({ slot_id: i.slot_id, qty: i.qty })),
    };
    await api.checkout(payload);
    body.className = 'status-view success';
    body.innerHTML = `<div class="icon">&#10003;</div><p>${t('pay_success')}</p>`;
    state.cart = [];
    renderCartBadge();
    await loadMachine();
    setTimeout(() => overlay.classList.remove('show'), 1800);
  } catch (err) {
    body.className = 'status-view fail';
    body.innerHTML = `<div class="icon">&#10007;</div><p>${err.message || t('pay_fail')}</p>`;
    setTimeout(() => overlay.classList.remove('show'), 2200);
  }
}

document.getElementById('start-over-btn').addEventListener('click', resetKiosk);
document.getElementById('help-btn').addEventListener('click', () => {
  flashStatus('success', getLang() === 'th'
    ? 'เลือกหมวดหมู่ แล้วแตะสินค้าเพื่อใส่ตะกร้า'
    : 'Pick a category and tap an item to add it to your cart');
});

setupLangToggle();
setupCartOverlay();
setupPayOverlay();
loadMachine().catch((err) => {
  console.error(err);
  document.getElementById('product-grid').innerHTML =
    `<p style="color:#e4002b;">Failed to load machine data: ${err.message}</p>`;
});

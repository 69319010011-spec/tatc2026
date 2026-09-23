const MACHINE_CODE = 'VM-BKK-001';

const CATEGORY_EMOJI = {
  drinks: '🥤',
  snacks: '🍪',
  meals: '🍱',
  general: '🧴',
  healthy: '🥗',
};

// Each category gets its own color identity so the rail and product grid
// read as distinct sections instead of one flat red/white block.
const CATEGORY_COLOR = {
  drinks: { accent: '#2f80ed', deep: '#1c5fc2', soft: '#eaf2fe' },
  snacks: { accent: '#f2994a', deep: '#c8752c', soft: '#fdf1e6' },
  meals: { accent: '#e4002b', deep: '#b8001f', soft: '#fdecee' },
  general: { accent: '#5b6b7c', deep: '#43505d', soft: '#eef1f4' },
  healthy: { accent: '#27ae60', deep: '#1d8a4b', soft: '#e9f8ee' },
};
function categoryColor(code) {
  return CATEGORY_COLOR[code] || CATEGORY_COLOR.meals;
}

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

function productVisualHtml(item, className) {
  if (item.image_url) {
    return `<img class="${className}" src="${mediaUrl(item.image_url)}" alt="">`;
  }
  return `<div class="${className}">${productEmoji(item)}</div>`;
}

function money(n) {
  return Number(n).toFixed(2);
}

function addRipple(el, event, color) {
  const rect = el.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  ripple.style.width = ripple.style.height = `${size}px`;
  if (color) ripple.style.background = color;
  const x = (event.clientX ?? rect.left + rect.width / 2) - rect.left - size / 2;
  const y = (event.clientY ?? rect.top + rect.height / 2) - rect.top - size / 2;
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;
  const prevPosition = getComputedStyle(el).position;
  if (prevPosition === 'static') el.style.position = 'relative';
  el.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove());
}

const SUCCESS_CHECK_SVG = `
  <svg viewBox="0 0 52 52">
    <circle class="check-circle" cx="26" cy="26" r="25"/>
    <path class="check-mark" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
  </svg>`;

const CONFETTI_COLORS = ['#e4002b', '#ff3355', '#ffd166', '#06d6a0', '#118ab2', '#ffffff'];

function launchConfetti(container) {
  const count = 22;
  for (let i = 0; i < count; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    const angle = Math.random() * Math.PI * 2;
    const distance = 60 + Math.random() * 90;
    piece.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
    piece.style.setProperty('--dy', `${Math.sin(angle) * distance}px`);
    piece.style.setProperty('--rot', `${(Math.random() * 720 - 360)}deg`);
    piece.style.background = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    piece.style.animationDelay = `${Math.random() * 80}ms`;
    container.appendChild(piece);
    piece.addEventListener('animationend', () => piece.remove());
  }
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
    const color = categoryColor(cat.code);
    const btn = document.createElement('button');
    btn.className = 'category-btn' + (cat.code === state.currentCategoryCode ? ' active' : '');
    btn.style.setProperty('--cat-accent', color.accent);
    btn.style.setProperty('--cat-deep', color.deep);
    btn.innerHTML = `<span class="cat-icon">${categoryEmoji(cat.code)}</span><span>${getLang() === 'th' ? cat.name_th : cat.name_en}</span>`;
    btn.addEventListener('click', (e) => {
      addRipple(btn, e, 'rgba(255,255,255,0.35)');
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

  const color = categoryColor(state.currentCategoryCode);
  const area = document.getElementById('product-area');
  area.style.setProperty('--cat-accent', color.accent);
  area.style.setProperty('--cat-deep', color.deep);
  area.style.setProperty('--cat-soft', color.soft);

  const grid = document.getElementById('product-grid');
  grid.innerHTML = '';
  const slots = slotsForCurrentCategory();

  let cardIndex = 0;
  slots.forEach((slot) => {
    if (!slot.product_id) return;
    const card = document.createElement('div');
    const outOfStock = slot.current_stock <= 0;
    card.className = 'product-card' + (outOfStock ? ' disabled' : '');
    card.style.setProperty('--i', cardIndex++);
    card.innerHTML = `
      ${outOfStock ? `<span class="product-stock-badge" data-i18n="out_of_stock">${t('out_of_stock')}</span>` : ''}
      ${productVisualHtml(slot, 'product-emoji')}
      <div class="product-name">${localizedName(slot)}</div>
      <div class="product-price">฿${money(slot.price)}</div>
    `;
    if (!outOfStock) {
      card.addEventListener('click', (e) => {
        addRipple(card, e);
        addToCart(slot);
      });
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
      image_url: slot.image_url,
      price: parseFloat(slot.price),
      qty: 1,
      categoryCode: state.currentCategoryCode,
    });
  }
  renderCartBadge();
  pulseCartBtn();
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

function pulseCartBtn() {
  const btn = document.getElementById('open-cart-btn');
  btn.classList.remove('pulse');
  // force reflow so the animation can restart on rapid re-triggers
  void btn.offsetWidth;
  btn.classList.add('pulse');
  btn.addEventListener('animationend', () => btn.classList.remove('pulse'), { once: true });
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
        ${productVisualHtml(item, 'emoji')}
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
  body.innerHTML = kind === 'success'
    ? `${SUCCESS_CHECK_SVG}<p>${message}</p>`
    : `<div class="icon">&#10007;</div><p>${message}</p>`;
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
  document.getElementById('open-cart-btn').addEventListener('click', (e) => {
    addRipple(e.currentTarget, e);
    renderCartDrawer();
    document.getElementById('cart-overlay').classList.add('show');
  });
  document.getElementById('close-cart-btn').addEventListener('click', () => {
    document.getElementById('cart-overlay').classList.remove('show');
  });
  document.getElementById('pay-btn').addEventListener('click', (e) => {
    addRipple(e.currentTarget, e, 'rgba(255,255,255,0.35)');
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
    el.addEventListener('click', (e) => {
      addRipple(el, e);
      document.querySelectorAll('.pay-method').forEach((x) => x.classList.remove('selected'));
      el.classList.add('selected');
      selectedPayMethod = el.getAttribute('data-method');
      document.getElementById('confirm-pay-btn').disabled = false;
    });
  });
  document.getElementById('close-pay-btn').addEventListener('click', () => {
    document.getElementById('pay-overlay').classList.remove('show');
  });
  document.getElementById('confirm-pay-btn').addEventListener('click', (e) => {
    addRipple(e.currentTarget, e, 'rgba(255,255,255,0.35)');
    doCheckout();
  });
}

async function doCheckout() {
  if (!selectedPayMethod || state.cart.length === 0) return;
  document.getElementById('pay-overlay').classList.remove('show');
  const overlay = document.getElementById('status-overlay');
  const body = document.getElementById('status-body');
  body.className = 'status-view';
  body.innerHTML = `
    <div class="vending-drop">
      <div class="drop-machine-slot"></div>
      <div class="drop-bottle">🥤</div>
      <div class="drop-tray"></div>
    </div>
    <p>${t('pay_processing')}</p>`;
  overlay.classList.add('show');

  try {
    const payload = {
      machine_code: MACHINE_CODE,
      payment_method: selectedPayMethod,
      items: state.cart.map((i) => ({ slot_id: i.slot_id, qty: i.qty })),
    };
    await api.checkout(payload);
    body.className = 'status-view success';
    body.innerHTML = `${SUCCESS_CHECK_SVG}<p>${t('pay_success')}</p>`;
    launchConfetti(body);
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

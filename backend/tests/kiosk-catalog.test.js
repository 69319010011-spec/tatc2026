const test = require('node:test');
const assert = require('node:assert/strict');
const catalog = require('../../frontend/kiosk/js/catalog');
const categories = [{ category_id: 1, code: 'drinks' }, { category_id: 2, code: 'meals' }, { category_id: 3, code: 'general' }];
const slots = [
  { slot_id: 1, product_id: 10, name_th: 'ชาไทย', name_en: 'Thai tea', sku: 'D-TEA', category_id: 1, current_stock: 3 },
  { slot_id: 2, product_id: 20, name_th: 'ข้าวผัด', name_en: 'Fried rice', sku: 'M-RICE', category_id: 2, current_stock: 0 },
  { slot_id: 3, product_id: 20, name_th: 'ข้าวผัด', name_en: 'Fried rice', sku: 'M-RICE', category_id: 2, current_stock: 4 },
  { slot_id: 4, product_id: 30, name_th: 'ทิชชู่', category_id: 3, current_stock: 5 },
];
test('search finds Thai, English and SKU across categories, ignoring case and space', () => {
  for (const q of ['ชา', ' THAI  tea ', 'd-tea']) assert.deepEqual(catalog.search(slots, q).map(s => s.product_id), [10]);
  assert.equal(catalog.search(slots, 'ข้าว').length, 2);
  assert.equal(catalog.search(slots, 'missing').length, 0);
  assert.equal(catalog.search(slots, ' ').length, 4);
});
test('carousel preserves sales ranking, deduplicates and skips empty slots and nonfood', () => {
  const result = catalog.featured(slots, categories, [30, 20, 10, 20, 999]);
  assert.equal(result.bestSellers, true);
  assert.deepEqual(result.items.map(s => s.slot_id), [3, 1]);
});
test('no sales uses honestly labelled recommendations; no stock yields no slides', () => {
  assert.equal(catalog.featured(slots, categories, []).bestSellers, false);
  assert.equal(catalog.featured(slots, categories, []).items.length, 2);
  assert.deepEqual(catalog.featured(slots.map(s => ({ ...s, current_stock: 0 })), categories, [10]).items, []);
});

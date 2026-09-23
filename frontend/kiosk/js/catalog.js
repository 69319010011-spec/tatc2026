(function (root) {
  function search(slots, query) {
    const terms = query.normalize('NFC').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return slots.filter((slot) => slot.product_id && terms.every((term) =>
      [slot.name_th, slot.name_en, slot.sku].filter(Boolean).join(' ').normalize('NFC').toLocaleLowerCase().includes(term)
    ));
  }

  function featured(slots, categories, rankedIds) {
    const foodIds = new Set(categories.filter((c) => ['drinks', 'snacks', 'meals', 'healthy'].includes(c.code)).map((c) => c.category_id));
    const available = new Map();
    for (const slot of slots) {
      if (slot.product_id && slot.current_stock > 0 && foodIds.has(slot.category_id) && !available.has(slot.product_id)) {
        available.set(slot.product_id, slot);
      }
    }
    const ranked = [...new Set(rankedIds || [])].map((id) => available.get(id)).filter(Boolean).slice(0, 6);
    return { items: ranked.length ? ranked : [...available.values()].slice(0, 6), bestSellers: ranked.length > 0 };
  }

  const catalog = { search, featured };
  if (typeof module !== 'undefined' && module.exports) module.exports = catalog;
  else root.KioskCatalog = catalog;
})(typeof window !== 'undefined' ? window : globalThis);

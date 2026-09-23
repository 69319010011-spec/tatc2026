const express = require('express');
const pool = require('../db/pool');

const router = express.Router();

// GET /api/kiosk/machines/:machineCode  -> machine info + categories + slots(with product) for the kiosk grid
router.get('/machines/:machineCode', async (req, res) => {
  try {
    const machineRes = await pool.query(
      'SELECT machine_id, machine_code, location_name, status FROM machines WHERE machine_code = $1',
      [req.params.machineCode]
    );
    const machine = machineRes.rows[0];
    if (!machine) return res.status(404).json({ error: 'Machine not found' });

    const categoriesRes = await pool.query(
      'SELECT category_id, code, name_th, name_en, requires_refrigeration FROM categories ORDER BY sort_order, category_id'
    );

    const slotsRes = await pool.query(
      `SELECT s.slot_id, s.slot_code, s.current_stock, s.capacity,
              COALESCE(s.price_override, p.base_price) AS price,
              p.product_id, p.sku, p.name_th, p.name_en, p.image_url, p.calories, p.category_id
       FROM machine_slots s
       LEFT JOIN products p ON p.product_id = s.product_id
       WHERE s.machine_id = $1 AND p.is_active = true
       ORDER BY s.slot_code`,
      [machine.machine_id]
    );

    res.json({
      machine,
      categories: categoriesRes.rows,
      slots: slotsRes.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/kiosk/checkout
// body: { machine_code, payment_method, items: [{slot_id, qty}] }
router.post('/checkout', async (req, res) => {
  const { machine_code, payment_method, items: rawItems } = req.body;
  if (!machine_code || !payment_method || !Array.isArray(rawItems) || rawItems.length === 0) {
    return res.status(400).json({ error: 'machine_code, payment_method and items are required' });
  }

  // Merge duplicate slot_id entries into a single line so each product only
  // ever produces one order_items row (with a combined qty) per order.
  const mergedBySlot = new Map();
  for (const item of rawItems) {
    const qty = Math.max(1, parseInt(item.qty, 10) || 1);
    const existing = mergedBySlot.get(item.slot_id);
    if (existing) existing.qty += qty;
    else mergedBySlot.set(item.slot_id, { slot_id: item.slot_id, qty });
  }
  const items = Array.from(mergedBySlot.values());

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const machineRes = await client.query(
      'SELECT machine_id FROM machines WHERE machine_code = $1',
      [machine_code]
    );
    const machine = machineRes.rows[0];
    if (!machine) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Machine not found' });
    }

    let total = 0;
    const resolvedItems = [];

    for (const item of items) {
      const slotRes = await client.query(
        `SELECT s.slot_id, s.current_stock, s.product_id,
                COALESCE(s.price_override, p.base_price) AS price
         FROM machine_slots s
         JOIN products p ON p.product_id = s.product_id
         WHERE s.slot_id = $1 AND s.machine_id = $2
         FOR UPDATE`,
        [item.slot_id, machine.machine_id]
      );
      const slot = slotRes.rows[0];
      const qty = Math.max(1, parseInt(item.qty, 10) || 1);

      if (!slot) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Slot ${item.slot_id} not found` });
      }
      if (slot.current_stock < qty) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: `Slot ${item.slot_id} is out of stock` });
      }

      const price = parseFloat(slot.price);
      total += price * qty;
      resolvedItems.push({ slot_id: slot.slot_id, product_id: slot.product_id, qty, price });
    }

    const orderRes = await client.query(
      `INSERT INTO orders (machine_id, total_amount, payment_method, payment_status, completed_at)
       VALUES ($1, $2, $3, 'paid', now()) RETURNING order_id, created_at`,
      [machine.machine_id, total.toFixed(2), payment_method]
    );
    const order = orderRes.rows[0];

    for (const item of resolvedItems) {
      await client.query(
        `INSERT INTO order_items (order_id, slot_id, product_id, qty, price_paid)
         VALUES ($1,$2,$3,$4,$5)`,
        [order.order_id, item.slot_id, item.product_id, item.qty, item.price]
      );
      await client.query(
        `UPDATE machine_slots SET current_stock = current_stock - $1 WHERE slot_id = $2`,
        [item.qty, item.slot_id]
      );

      const updatedSlot = await client.query(
        `SELECT current_stock, reorder_level FROM machine_slots WHERE slot_id = $1`,
        [item.slot_id]
      );
      const { current_stock, reorder_level } = updatedSlot.rows[0];
      if (current_stock <= 0) {
        await client.query(
          `INSERT INTO alerts (machine_id, slot_id, alert_type, message)
           VALUES ($1,$2,'out_of_stock','Slot is out of stock')`,
          [machine.machine_id, item.slot_id]
        );
      } else if (current_stock <= reorder_level) {
        await client.query(
          `INSERT INTO alerts (machine_id, slot_id, alert_type, message)
           VALUES ($1,$2,'low_stock','Slot stock is at or below reorder level')`,
          [machine.machine_id, item.slot_id]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json({
      order_id: order.order_id,
      total_amount: total.toFixed(2),
      created_at: order.created_at,
      status: 'paid',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

module.exports = router;

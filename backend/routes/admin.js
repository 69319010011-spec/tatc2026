const express = require('express');
const pool = require('../db/pool');
const { authenticateAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateAdmin);

// Wraps an async route handler so a thrown/rejected error is forwarded to
// Express's error middleware instead of crashing the process (Express 4 does
// not catch async errors on its own).
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---------- Dashboard ----------
router.get('/dashboard', asyncHandler(async (req, res) => {
  const [salesToday, openAlerts, lowStock, machines] = await Promise.all([
    pool.query(
      `SELECT COALESCE(SUM(total_amount),0) AS total, COUNT(*) AS orders
       FROM orders WHERE payment_status = 'paid' AND created_at::date = CURRENT_DATE`
    ),
    pool.query(`SELECT COUNT(*) AS count FROM alerts WHERE status = 'open'`),
    pool.query(
      `SELECT COUNT(*) AS count FROM machine_slots WHERE current_stock <= reorder_level`
    ),
    pool.query(
      `SELECT machine_id, machine_code, location_name, status FROM machines ORDER BY machine_id`
    ),
  ]);
  res.json({
    sales_today: salesToday.rows[0],
    open_alerts: parseInt(openAlerts.rows[0].count, 10),
    low_stock_slots: parseInt(lowStock.rows[0].count, 10),
    machines: machines.rows,
  });
}));

// ---------- Analytics ----------
router.get('/analytics/sales-daily', asyncHandler(async (req, res) => {
  const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 14));
  const r = await pool.query(
    `SELECT gs::date AS date,
            COALESCE(SUM(o.total_amount), 0) AS total,
            COUNT(o.order_id) AS orders
     FROM generate_series(CURRENT_DATE - ($1::int - 1), CURRENT_DATE, interval '1 day') gs
     LEFT JOIN orders o ON o.created_at::date = gs::date AND o.payment_status = 'paid'
     GROUP BY gs
     ORDER BY gs`,
    [days]
  );
  res.json(r.rows);
}));

router.get('/analytics/top-products', asyncHandler(async (req, res) => {
  const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 8));
  const r = await pool.query(
    `SELECT p.product_id, p.name_th, p.name_en,
            SUM(oi.qty) AS qty_sold,
            SUM(oi.qty * oi.price_paid) AS revenue
     FROM order_items oi
     JOIN products p ON p.product_id = oi.product_id
     JOIN orders o ON o.order_id = oi.order_id AND o.payment_status = 'paid'
     GROUP BY p.product_id, p.name_th, p.name_en
     ORDER BY qty_sold DESC
     LIMIT $1`,
    [limit]
  );
  res.json(r.rows);
}));

router.get('/analytics/sales-by-category', asyncHandler(async (req, res) => {
  const r = await pool.query(
    `SELECT c.category_id, c.code, c.name_th, c.name_en,
            COALESCE(SUM(oi.qty * oi.price_paid), 0) AS revenue
     FROM categories c
     LEFT JOIN products p ON p.category_id = c.category_id
     LEFT JOIN order_items oi ON oi.product_id = p.product_id
     LEFT JOIN orders o ON o.order_id = oi.order_id AND o.payment_status = 'paid'
     GROUP BY c.category_id, c.code, c.name_th, c.name_en, c.sort_order
     ORDER BY c.sort_order, c.category_id`
  );
  res.json(r.rows);
}));

// ---------- Categories ----------
router.get('/categories', asyncHandler(async (req, res) => {
  const r = await pool.query('SELECT * FROM categories ORDER BY sort_order, category_id');
  res.json(r.rows);
}));

// ---------- Products ----------
router.get('/products', asyncHandler(async (req, res) => {
  const r = await pool.query(
    `SELECT p.*, c.name_th AS category_name_th, c.name_en AS category_name_en
     FROM products p JOIN categories c ON c.category_id = p.category_id
     ORDER BY p.product_id`
  );
  res.json(r.rows);
}));

router.post('/products', asyncHandler(async (req, res) => {
  const { category_id, sku, name_th, name_en, base_price, calories, shelf_life_days, image_url } = req.body;
  if (!category_id || !name_th || !name_en || base_price == null) {
    return res.status(400).json({ error: 'category_id, name_th, name_en, base_price are required' });
  }
  const r = await pool.query(
    `INSERT INTO products (category_id, sku, name_th, name_en, base_price, calories, shelf_life_days, image_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [category_id, sku || null, name_th, name_en, base_price, calories || null, shelf_life_days || null, image_url || null]
  );
  res.status(201).json(r.rows[0]);
}));

router.put('/products/:id', asyncHandler(async (req, res) => {
  const { category_id, sku, name_th, name_en, base_price, calories, shelf_life_days, image_url, is_active } = req.body;
  const r = await pool.query(
    `UPDATE products SET
      category_id = COALESCE($1, category_id),
      sku = COALESCE($2, sku),
      name_th = COALESCE($3, name_th),
      name_en = COALESCE($4, name_en),
      base_price = COALESCE($5, base_price),
      calories = COALESCE($6, calories),
      shelf_life_days = COALESCE($7, shelf_life_days),
      image_url = COALESCE($8, image_url),
      is_active = COALESCE($9, is_active)
     WHERE product_id = $10 RETURNING *`,
    [category_id, sku, name_th, name_en, base_price, calories, shelf_life_days, image_url, is_active, req.params.id]
  );
  if (!r.rows[0]) return res.status(404).json({ error: 'Product not found' });
  res.json(r.rows[0]);
}));

router.delete('/products/:id', asyncHandler(async (req, res) => {
  await pool.query('UPDATE products SET is_active = false WHERE product_id = $1', [req.params.id]);
  res.status(204).send();
}));

// ---------- Machines ----------
router.get('/machines', asyncHandler(async (req, res) => {
  const r = await pool.query('SELECT * FROM machines ORDER BY machine_id');
  res.json(r.rows);
}));

// ---------- Slots ----------
router.get('/machines/:machineId/slots', asyncHandler(async (req, res) => {
  const r = await pool.query(
    `SELECT s.*, p.name_th, p.name_en, p.base_price
     FROM machine_slots s LEFT JOIN products p ON p.product_id = s.product_id
     WHERE s.machine_id = $1 ORDER BY s.slot_code`,
    [req.params.machineId]
  );
  res.json(r.rows);
}));

router.put('/slots/:slotId', asyncHandler(async (req, res) => {
  const { product_id, price_override, capacity, reorder_level } = req.body;
  const r = await pool.query(
    `UPDATE machine_slots SET
      product_id = $1,
      price_override = $2,
      capacity = COALESCE($3, capacity),
      reorder_level = COALESCE($4, reorder_level)
     WHERE slot_id = $5 RETURNING *`,
    [product_id || null, price_override || null, capacity, reorder_level, req.params.slotId]
  );
  if (!r.rows[0]) return res.status(404).json({ error: 'Slot not found' });
  res.json(r.rows[0]);
}));

// POST /api/admin/slots/:slotId/adjust  { delta }  -- quick +1/-1 stock adjust, no batch tracking
router.post('/slots/:slotId/adjust', asyncHandler(async (req, res) => {
  const delta = parseInt(req.body.delta, 10);
  if (!delta) {
    return res.status(400).json({ error: 'delta must be a non-zero integer' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const slotRes = await client.query(
      'SELECT * FROM machine_slots WHERE slot_id = $1 FOR UPDATE',
      [req.params.slotId]
    );
    const slot = slotRes.rows[0];
    if (!slot) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Slot not found' });
    }
    const newStock = Math.min(slot.capacity, Math.max(0, slot.current_stock + delta));

    await client.query('UPDATE machine_slots SET current_stock = $1 WHERE slot_id = $2', [newStock, req.params.slotId]);

    if (delta > 0 && newStock > slot.reorder_level) {
      await client.query(
        `UPDATE alerts SET status = 'resolved', resolved_at = now()
         WHERE slot_id = $1 AND status = 'open' AND alert_type IN ('low_stock','out_of_stock')`,
        [req.params.slotId]
      );
    } else if (newStock <= 0) {
      await client.query(
        `INSERT INTO alerts (machine_id, slot_id, alert_type, message)
         VALUES ($1,$2,'out_of_stock','Slot is out of stock')`,
        [slot.machine_id, req.params.slotId]
      );
    } else if (newStock <= slot.reorder_level) {
      await client.query(
        `INSERT INTO alerts (machine_id, slot_id, alert_type, message)
         VALUES ($1,$2,'low_stock','Slot stock is at or below reorder level')`,
        [slot.machine_id, req.params.slotId]
      );
    }

    await client.query('COMMIT');
    res.json({ slot_id: req.params.slotId, current_stock: newStock });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

// POST /api/admin/slots/:slotId/restock  { qty_added, expiry_date, batch_no }
router.post('/slots/:slotId/restock', asyncHandler(async (req, res) => {
  const { qty_added, expiry_date, batch_no } = req.body;
  if (!qty_added || qty_added <= 0) {
    return res.status(400).json({ error: 'qty_added must be a positive number' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const slotRes = await client.query(
      'SELECT * FROM machine_slots WHERE slot_id = $1 FOR UPDATE',
      [req.params.slotId]
    );
    const slot = slotRes.rows[0];
    if (!slot) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Slot not found' });
    }
    const newStock = Math.min(slot.capacity, slot.current_stock + parseInt(qty_added, 10));

    await client.query(
      `UPDATE machine_slots SET current_stock = $1, current_expiry_date = COALESCE($2, current_expiry_date) WHERE slot_id = $3`,
      [newStock, expiry_date || null, req.params.slotId]
    );
    await client.query(
      `INSERT INTO restock_logs (slot_id, admin_id, batch_no, qty_added, expiry_date)
       VALUES ($1,$2,$3,$4,$5)`,
      [req.params.slotId, req.admin.admin_id, batch_no || null, qty_added, expiry_date || null]
    );
    await client.query(
      `UPDATE alerts SET status = 'resolved', resolved_at = now()
       WHERE slot_id = $1 AND status = 'open' AND alert_type IN ('low_stock','out_of_stock')`,
      [req.params.slotId]
    );

    await client.query('COMMIT');
    res.json({ slot_id: req.params.slotId, current_stock: newStock });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

// ---------- Orders ----------
router.get('/orders', asyncHandler(async (req, res) => {
  const { machine_id, limit = 50 } = req.query;
  const params = [];
  let where = '';
  if (machine_id) {
    params.push(machine_id);
    where = `WHERE o.machine_id = $${params.length}`;
  }
  params.push(limit);
  const r = await pool.query(
    `SELECT o.*, m.machine_code, m.location_name,
       (SELECT json_agg(json_build_object('product_id', oi.product_id, 'name_th', p.name_th, 'name_en', p.name_en, 'qty', oi.qty, 'price_paid', oi.price_paid))
        FROM order_items oi JOIN products p ON p.product_id = oi.product_id WHERE oi.order_id = o.order_id) AS items
     FROM orders o JOIN machines m ON m.machine_id = o.machine_id
     ${where}
     ORDER BY o.created_at DESC LIMIT $${params.length}`,
    params
  );
  res.json(r.rows);
}));

// ---------- Alerts ----------
router.get('/alerts', asyncHandler(async (req, res) => {
  const { status } = req.query;
  const params = [];
  let where = '';
  if (status) {
    params.push(status);
    where = `WHERE a.status = $1`;
  }
  const r = await pool.query(
    `SELECT a.*, m.machine_code, m.location_name, s.slot_code
     FROM alerts a JOIN machines m ON m.machine_id = a.machine_id
     LEFT JOIN machine_slots s ON s.slot_id = a.slot_id
     ${where}
     ORDER BY a.created_at DESC`,
    params
  );
  res.json(r.rows);
}));

router.put('/alerts/:alertId', asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['acknowledged', 'resolved'].includes(status)) {
    return res.status(400).json({ error: 'status must be acknowledged or resolved' });
  }
  const r = await pool.query(
    `UPDATE alerts SET status = $1::alert_status,
       resolved_at = CASE WHEN $1::text = 'resolved' THEN now() ELSE resolved_at END
     WHERE alert_id = $2 RETURNING *`,
    [status, req.params.alertId]
  );
  if (!r.rows[0]) return res.status(404).json({ error: 'Alert not found' });
  res.json(r.rows[0]);
}));

// ---------- Maintenance ----------
router.get('/maintenance', asyncHandler(async (req, res) => {
  const r = await pool.query(
    `SELECT ml.*, m.machine_code, a.name AS admin_name
     FROM maintenance_logs ml JOIN machines m ON m.machine_id = ml.machine_id
     LEFT JOIN admins a ON a.admin_id = ml.admin_id
     ORDER BY ml.reported_at DESC`
  );
  res.json(r.rows);
}));

router.post('/maintenance', asyncHandler(async (req, res) => {
  const { machine_id, issue_type, description } = req.body;
  if (!machine_id || !issue_type) {
    return res.status(400).json({ error: 'machine_id and issue_type are required' });
  }
  const r = await pool.query(
    `INSERT INTO maintenance_logs (machine_id, admin_id, issue_type, description)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [machine_id, req.admin.admin_id, issue_type, description || null]
  );
  res.status(201).json(r.rows[0]);
}));

router.put('/maintenance/:id/resolve', asyncHandler(async (req, res) => {
  const r = await pool.query(
    `UPDATE maintenance_logs SET resolved_at = now() WHERE maintenance_id = $1 RETURNING *`,
    [req.params.id]
  );
  if (!r.rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(r.rows[0]);
}));

module.exports = router;

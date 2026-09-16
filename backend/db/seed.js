require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./pool');

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Clearing existing data...');
    await client.query(`
      TRUNCATE alerts, temperature_logs, maintenance_logs, order_items, orders,
      restock_logs, machine_slots, products, categories, machines, admins RESTART IDENTITY CASCADE
    `);

    console.log('Seeding admins...');
    const pinHash = await bcrypt.hash('1234', 10);
    const passHash = await bcrypt.hash('admin123', 10);
    await client.query(
      `INSERT INTO admins (name, username, phone, role, pin_code_hash, password_hash)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      ['Super Admin', 'admin', '0800000000', 'super_admin', pinHash, passHash]
    );

    console.log('Seeding machine...');
    const machineRes = await client.query(
      `INSERT INTO machines (machine_code, location_name, machine_type, status, total_slots, last_ping_at)
       VALUES ('VM-BKK-001', 'ตึกเรียน A ชั้น 1', 'mixed', 'online', 45, now()) RETURNING machine_id`
    );
    const machineId = machineRes.rows[0].machine_id;

    console.log('Seeding categories...');
    const categories = [
      ['drinks', 'เครื่องดื่ม', 'Drinks', false],
      ['snacks', 'ขนม', 'Snacks', false],
      ['meals', 'อาหารกล่อง', 'Meals', true],
      ['general', 'ของใช้ทั่วไป', 'General', false],
      ['healthy', 'เพื่อสุขภาพ', 'Healthy', false],
    ];
    const catIds = {};
    for (const [code, th, en, fridge] of categories) {
      const r = await client.query(
        `INSERT INTO categories (code, name_th, name_en, requires_refrigeration) VALUES ($1,$2,$3,$4) RETURNING category_id`,
        [code, th, en, fridge]
      );
      catIds[code] = r.rows[0].category_id;
    }

    console.log('Seeding products...');
    const products = [
      // drinks
      ['drinks', 'D-COKE', 'โค้ก', 'Coca-Cola', 18, 140, null],
      ['drinks', 'D-PEPSI', 'เป๊ปซี่', 'Pepsi', 18, 150, null],
      ['drinks', 'D-WATER', 'น้ำเปล่า', 'Water', 10, 0, null],
      ['drinks', 'D-SPRITE', 'สไปรท์', 'Sprite', 18, 140, null],
      ['drinks', 'D-THAITEA', 'ชาไทย', 'Thai Milk Tea', 25, 180, null],
      ['drinks', 'D-COFFEE', 'กาแฟกระป๋อง', 'Iced Coffee (Canned)', 22, 120, null],
      ['drinks', 'D-MILK', 'นมสด', 'Fresh Milk', 20, 130, null],
      ['drinks', 'D-ORANGE', 'น้ำส้ม', 'Orange Juice', 22, 110, null],
      ['drinks', 'D-SPORT', 'เครื่องดื่มเกลือแร่', 'Sports Drink', 20, 90, null],
      // snacks
      ['snacks', 'S-LAYS', 'เลย์', "Lay's Chips", 20, 160, null],
      ['snacks', 'S-HERSHEY', 'ฮาร์ชี่', "Hershey's", 25, 210, null],
      ['snacks', 'S-SUNCHIPS', 'ซันชิพส์', 'Sun Chips', 22, 150, null],
      ['snacks', 'S-BABYRUTH', 'เบบี้รูธ', 'Baby Ruth', 20, 200, null],
      ['snacks', 'S-PRETZEL', 'พรีตเซล', 'Pretzels', 18, 140, null],
      ['snacks', 'S-POPCORN', 'ป็อปคอร์น', 'Popcorn', 20, 160, null],
      ['snacks', 'S-COOKIE', 'คุกกี้', 'Cookies', 22, 200, null],
      ['snacks', 'S-WAFER', 'เวเฟอร์', 'Wafer', 15, 130, null],
      ['snacks', 'S-THAICRACKER', 'ข้าวเกรียบทอง', 'Thai Rice Cracker', 15, 120, null],
      // meals
      ['meals', 'M-SANDWICH', 'แซนวิช', 'Sandwich', 35, 280, null],
      ['meals', 'M-PIZZA', 'พิซซ่า', 'Pizza', 45, 320, null],
      ['meals', 'M-LUNCHABLE1', 'ลันช์เอเบิ้ล พิซซ่า', 'Lunchables Pizza', 40, 310, null],
      ['meals', 'M-LUNCHABLE2', 'ลันช์เอเบิ้ล แฮมชีส', 'Lunchables Ham & Swiss', 40, 300, null],
      ['meals', 'M-FRIEDRICE', 'ข้าวผัดกล่อง', 'Fried Rice Box', 45, 450, null],
      ['meals', 'M-NOODLE', 'ก๋วยเตี๋ยวกล่อง', 'Noodle Box', 42, 400, null],
      ['meals', 'M-SUSHI', 'ซูชิกล่อง', 'Sushi Box', 55, 350, null],
      ['meals', 'M-SPAGHETTI', 'สปาเก็ตตี้กล่อง', 'Spaghetti Box', 48, 420, null],
      ['meals', 'M-SALAD', 'สลัดผักรวม', 'Garden Salad', 39, 180, null],
      // general
      ['general', 'G-TISSUE', 'กระดาษทิชชู่', 'Tissue Roll', 30, null, null],
      ['general', 'G-PAPERTOWEL', 'กระดาษเช็ดมือ', 'Paper Towel', 35, null, null],
      ['general', 'G-DISHSOAP', 'น้ำยาล้างจาน', 'Dish Soap', 28, null, null],
      ['general', 'G-SUNFLOWEROIL', 'น้ำมันดอกทานตะวัน', 'Sunflower Oil', 45, null, null],
      ['general', 'G-UMBRELLA', 'ร่มพับ', 'Folding Umbrella', 99, null, null],
      ['general', 'G-TOOTHBRUSH', 'แปรงสีฟัน', 'Toothbrush Set', 25, null, null],
      ['general', 'G-PHONECHARGER', 'สายชาร์จโทรศัพท์', 'Phone Charging Cable', 89, null, null],
      ['general', 'G-MASK', 'หน้ากากอนามัย', 'Face Mask (Pack)', 20, null, null],
      ['general', 'G-BATTERY', 'ถ่านไฟฉาย AA', 'AA Batteries', 35, null, null],
      // healthy
      ['healthy', 'H-BANANA', 'กล้วย', 'Banana', 12, 105, null],
      ['healthy', 'H-CLIFPEANUT', 'คลิฟบาร์ ถั่ว', 'Clif Bar Peanut', 32, 250, null],
      ['healthy', 'H-CLIFCHOC', 'คลิฟบาร์ ช็อกโกแลต', 'Clif Bar Chocolate', 32, 260, null],
      ['healthy', 'H-GRANOLA', 'กราโนล่าบาร์', 'Nature Valley Granola', 25, 190, null],
      ['healthy', 'H-YOGURT', 'โยเกิร์ต', 'Yogurt Cup', 25, 120, null],
      ['healthy', 'H-NUTS', 'ถั่วรวมอบ', 'Mixed Nuts', 30, 210, null],
      ['healthy', 'H-APPLE', 'แอปเปิ้ล', 'Apple', 15, 95, null],
      ['healthy', 'H-BOILEDEGG', 'ไข่ต้ม', 'Boiled Egg', 15, 78, null],
      ['healthy', 'H-FRUITCUP', 'ผลไม้รวมตัดชิ้น', 'Mixed Fruit Cup', 35, 90, null],
    ];
    const prodIds = [];
    for (const [catCode, sku, th, en, price, cal, img] of products) {
      const r = await client.query(
        `INSERT INTO products (category_id, sku, name_th, name_en, base_price, calories, image_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING product_id`,
        [catIds[catCode], sku, th, en, price, cal, img]
      );
      prodIds.push(r.rows[0].product_id);
    }

    console.log('Seeding machine slots...');
    const rows = 'ABCDEFGHI'.split('');
    let p = 0;
    const slots = []; // { slot_id, product_id, price }
    for (let r = 0; r < rows.length; r++) {
      for (let c = 1; c <= 5; c++) {
        const slotCode = `${rows[r]}${c}`;
        const productId = prodIds[p] || null;
        const priceInfo = products[p];
        p++;
        const slotRes = await client.query(
          `INSERT INTO machine_slots (machine_id, slot_code, product_id, capacity, current_stock, reorder_level)
           VALUES ($1,$2,$3,10,8,2) RETURNING slot_id`,
          [machineId, slotCode, productId]
        );
        if (productId) {
          slots.push({ slot_id: slotRes.rows[0].slot_id, product_id: productId, price: priceInfo[4] });
        }
      }
    }

    console.log('Seeding demo order history (last 14 days)...');
    const paymentMethods = ['cash', 'qr', 'card'];
    for (let day = 13; day >= 0; day--) {
      const ordersThatDay = 3 + Math.floor(Math.random() * 8); // 3-10 orders/day
      for (let i = 0; i < ordersThatDay; i++) {
        const itemCount = 1 + Math.floor(Math.random() * 3); // 1-3 items
        const chosen = [];
        for (let k = 0; k < itemCount; k++) {
          chosen.push(slots[Math.floor(Math.random() * slots.length)]);
        }
        const total = chosen.reduce((sum, s) => sum + parseFloat(s.price), 0);
        const method = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
        const hour = 7 + Math.floor(Math.random() * 14); // 07:00-21:00
        const minute = Math.floor(Math.random() * 60);

        const orderRes = await client.query(
          `INSERT INTO orders (machine_id, total_amount, payment_method, payment_status, created_at, completed_at)
           VALUES ($1, $2, $3, 'paid',
             (CURRENT_DATE - $4::int) + ($5::int || ' hours')::interval + ($6::int || ' minutes')::interval,
             (CURRENT_DATE - $4::int) + ($5::int || ' hours')::interval + ($6::int || ' minutes')::interval)
           RETURNING order_id`,
          [machineId, total.toFixed(2), method, day, hour, minute]
        );
        const orderId = orderRes.rows[0].order_id;
        for (const s of chosen) {
          await client.query(
            `INSERT INTO order_items (order_id, slot_id, product_id, qty, price_paid) VALUES ($1,$2,$3,1,$4)`,
            [orderId, s.slot_id, s.product_id, s.price]
          );
        }
      }
    }

    await client.query('COMMIT');
    console.log('Seed complete.');
    console.log('Admin login -> username: admin / password: admin123 / kiosk pin: 1234');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();

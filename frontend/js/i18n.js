const I18N = {
  th: {
    app_title: 'ตู้กดอัตโนมัติ',
    help: 'ช่วยเหลือ',
    start_over: 'เริ่มใหม่',
    type_code: 'พิมพ์รหัส 4 หลัก',
    checkout: 'ชำระเงิน',
    total: 'รวม',
    cart_empty: 'ยังไม่มีสินค้าในตะกร้า',
    cart_title: 'ตะกร้าสินค้า',
    add: 'เพิ่ม',
    out_of_stock: 'สินค้าหมด',
    pay_title: 'เลือกวิธีชำระเงิน',
    pay_cash: 'เงินสด',
    pay_qr: 'พร้อมเพย์ / QR',
    pay_card: 'บัตร',
    pay_confirm: 'ยืนยันการชำระเงิน',
    pay_processing: 'กำลังดำเนินการ...',
    pay_success: 'ชำระเงินสำเร็จ ขอบคุณค่ะ',
    pay_fail: 'การชำระเงินล้มเหลว กรุณาลองใหม่',
    close: 'ปิด',
    cancel: 'ยกเลิก',
    remove: 'ลบ',
    invalid_code: 'ไม่พบรหัสสินค้านี้ หรือสินค้าหมด',
    admin_login: 'สำหรับเจ้าหน้าที่',

    // Admin panel
    admin_panel_title: 'ระบบจัดการตู้กด',
    username: 'ชื่อผู้ใช้',
    password: 'รหัสผ่าน',
    login: 'เข้าสู่ระบบ',
    logout: 'ออกจากระบบ',
    login_failed: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',
    nav_dashboard: 'ภาพรวม',
    nav_products: 'สินค้า',
    nav_slots: 'ช่องเก็บสินค้า',
    nav_orders: 'คำสั่งซื้อ',
    nav_alerts: 'แจ้งเตือน',
    nav_maintenance: 'ซ่อมบำรุง',
    sales_today: 'ยอดขายวันนี้',
    orders_today: 'จำนวนออเดอร์วันนี้',
    open_alerts: 'แจ้งเตือนที่ยังไม่แก้ไข',
    low_stock_slots: 'ช่องที่ของใกล้หมด',
    machines_list: 'รายการตู้',
    add_product: 'เพิ่มสินค้า',
    edit: 'แก้ไข',
    save: 'บันทึก',
    delete: 'ลบ',
    category: 'หมวดหมู่',
    price: 'ราคา',
    stock: 'สต็อก',
    restock: 'เติมสินค้า',
    qty_to_add: 'จำนวนที่เติม',
    expiry_date: 'วันหมดอายุ',
    batch_no: 'ล็อตสินค้า',
    assign_product: 'กำหนดสินค้าในช่องนี้',
    status: 'สถานะ',
    acknowledge: 'รับทราบ',
    resolve: 'แก้ไขแล้ว',
    select_machine: 'เลือกตู้',
    no_data: 'ไม่มีข้อมูล',
    chart_sales_trend: 'ยอดขาย 14 วันล่าสุด',
    chart_sales_by_category: 'ยอดขายตามหมวดหมู่',
    chart_top_products: 'สินค้าขายดี (ตามจำนวนที่ขาย)',
    chart_orders_label: 'ออเดอร์',
    chart_revenue_label: 'ยอดขาย',
    chart_qty_label: 'จำนวนที่ขาย',
  },
  en: {
    app_title: 'Vending Machine',
    help: 'Help',
    start_over: 'Start over',
    type_code: 'Type 4-digit code',
    checkout: 'Checkout',
    total: 'Total',
    cart_empty: 'Your cart is empty',
    cart_title: 'Cart',
    add: 'Add',
    out_of_stock: 'Out of stock',
    pay_title: 'Choose payment method',
    pay_cash: 'Cash',
    pay_qr: 'PromptPay / QR',
    pay_card: 'Card',
    pay_confirm: 'Confirm payment',
    pay_processing: 'Processing...',
    pay_success: 'Payment successful, thank you!',
    pay_fail: 'Payment failed, please try again',
    close: 'Close',
    cancel: 'Cancel',
    remove: 'Remove',
    invalid_code: 'Code not found or item out of stock',
    admin_login: 'Staff login',

    // Admin panel
    admin_panel_title: 'Vending Admin Panel',
    username: 'Username',
    password: 'Password',
    login: 'Log in',
    logout: 'Log out',
    login_failed: 'Invalid username or password',
    nav_dashboard: 'Dashboard',
    nav_products: 'Products',
    nav_slots: 'Slots',
    nav_orders: 'Orders',
    nav_alerts: 'Alerts',
    nav_maintenance: 'Maintenance',
    sales_today: "Today's sales",
    orders_today: "Today's orders",
    open_alerts: 'Open alerts',
    low_stock_slots: 'Low stock slots',
    machines_list: 'Machines',
    add_product: 'Add product',
    edit: 'Edit',
    save: 'Save',
    delete: 'Delete',
    category: 'Category',
    price: 'Price',
    stock: 'Stock',
    restock: 'Restock',
    qty_to_add: 'Quantity to add',
    expiry_date: 'Expiry date',
    batch_no: 'Batch no.',
    assign_product: 'Assign product to this slot',
    status: 'Status',
    acknowledge: 'Acknowledge',
    resolve: 'Resolve',
    select_machine: 'Select machine',
    no_data: 'No data',
    chart_sales_trend: 'Sales — last 14 days',
    chart_sales_by_category: 'Sales by category',
    chart_top_products: 'Top-selling products (by units sold)',
    chart_orders_label: 'orders',
    chart_revenue_label: 'revenue',
    chart_qty_label: 'units sold',
  },
};

function getLang() {
  return localStorage.getItem('lang') || 'th';
}

function setLang(lang) {
  localStorage.setItem('lang', lang);
}

function t(key) {
  const lang = getLang();
  return (I18N[lang] && I18N[lang][key]) || key;
}

function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
  });
}

function localizedName(item) {
  return getLang() === 'th' ? item.name_th : item.name_en;
}

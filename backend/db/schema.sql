-- =========================================================
-- Vending Machine POS System — PostgreSQL Schema
-- =========================================================

CREATE TYPE machine_type AS ENUM ('refrigerated', 'ambient', 'mixed');
CREATE TYPE machine_status AS ENUM ('online', 'offline', 'maintenance');
CREATE TYPE payment_method AS ENUM ('cash', 'qr', 'card', 'coin');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'timeout', 'refunded');
CREATE TYPE maintenance_type AS ENUM ('jam', 'payment_error', 'temperature_error', 'cleaning', 'other');
CREATE TYPE alert_type AS ENUM ('low_stock', 'out_of_stock', 'temp_abnormal', 'machine_offline', 'expiry_soon');
CREATE TYPE alert_status AS ENUM ('open', 'acknowledged', 'resolved');
CREATE TYPE admin_role AS ENUM ('super_admin', 'technician', 'restocker');

-- ---------------------------------------------------------
-- Admins (web login: username/password, kiosk unlock: pin_code)
-- ---------------------------------------------------------
CREATE TABLE admins (
  admin_id      SERIAL PRIMARY KEY,
  name          VARCHAR NOT NULL,
  username      VARCHAR UNIQUE NOT NULL,
  phone         VARCHAR,
  role          admin_role NOT NULL DEFAULT 'restocker',
  pin_code_hash VARCHAR NOT NULL,
  password_hash VARCHAR NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------
-- Machines
-- ---------------------------------------------------------
CREATE TABLE machines (
  machine_id    SERIAL PRIMARY KEY,
  machine_code  VARCHAR UNIQUE NOT NULL,
  location_name VARCHAR NOT NULL,
  lat           DECIMAL(10,8),
  lng           DECIMAL(11,8),
  machine_type  machine_type NOT NULL DEFAULT 'mixed',
  status        machine_status NOT NULL DEFAULT 'online',
  total_slots   INTEGER NOT NULL DEFAULT 0,
  last_ping_at  TIMESTAMP,
  created_at    TIMESTAMP NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------
-- Categories (bilingual)
-- ---------------------------------------------------------
CREATE TABLE categories (
  category_id            SERIAL PRIMARY KEY,
  code                   VARCHAR UNIQUE NOT NULL,        -- e.g. 'drinks', 'meals'
  name_th                VARCHAR NOT NULL,
  name_en                VARCHAR NOT NULL,
  requires_refrigeration BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order             INTEGER NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------
-- Products (bilingual)
-- ---------------------------------------------------------
CREATE TABLE products (
  product_id      SERIAL PRIMARY KEY,
  category_id     INTEGER NOT NULL REFERENCES categories(category_id),
  sku             VARCHAR UNIQUE,
  name_th         VARCHAR NOT NULL,
  name_en         VARCHAR NOT NULL,
  base_price      DECIMAL(10,2) NOT NULL,
  calories        INTEGER,
  shelf_life_days INTEGER,
  image_url       VARCHAR,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

-- ---------------------------------------------------------
-- Machine slots
-- ---------------------------------------------------------
CREATE TABLE machine_slots (
  slot_id             SERIAL PRIMARY KEY,
  machine_id          INTEGER NOT NULL REFERENCES machines(machine_id) ON DELETE CASCADE,
  slot_code           VARCHAR NOT NULL,                  -- e.g. A1, B3
  product_id          INTEGER REFERENCES products(product_id),
  price_override      DECIMAL(10,2),
  capacity            INTEGER NOT NULL DEFAULT 10,
  current_stock       INTEGER NOT NULL DEFAULT 0,
  reorder_level       INTEGER NOT NULL DEFAULT 2,
  current_expiry_date DATE,
  UNIQUE (machine_id, slot_code)
);
CREATE INDEX idx_slots_machine_stock ON machine_slots (machine_id, current_stock);

-- ---------------------------------------------------------
-- Restock logs
-- ---------------------------------------------------------
CREATE TABLE restock_logs (
  restock_id   SERIAL PRIMARY KEY,
  slot_id      INTEGER NOT NULL REFERENCES machine_slots(slot_id),
  admin_id     INTEGER NOT NULL REFERENCES admins(admin_id),
  batch_no     VARCHAR,
  qty_added    INTEGER NOT NULL,
  expiry_date  DATE,
  restocked_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_restock_slot_time ON restock_logs (slot_id, restocked_at);

-- ---------------------------------------------------------
-- Orders (one basket / one checkout) + order items
-- ---------------------------------------------------------
CREATE TABLE orders (
  order_id       SERIAL PRIMARY KEY,
  machine_id     INTEGER NOT NULL REFERENCES machines(machine_id),
  total_amount   DECIMAL(10,2) NOT NULL DEFAULT 0,
  payment_method payment_method NOT NULL,
  payment_status payment_status NOT NULL DEFAULT 'pending',
  qr_ref         VARCHAR,
  created_at     TIMESTAMP NOT NULL DEFAULT now(),
  completed_at   TIMESTAMP
);
CREATE INDEX idx_orders_machine_time ON orders (machine_id, created_at);

CREATE TABLE order_items (
  order_item_id SERIAL PRIMARY KEY,
  order_id      INTEGER NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  slot_id       INTEGER NOT NULL REFERENCES machine_slots(slot_id),
  product_id    INTEGER NOT NULL REFERENCES products(product_id),
  qty           INTEGER NOT NULL DEFAULT 1,
  price_paid    DECIMAL(10,2) NOT NULL,
  is_dispensed  BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_order_items_order ON order_items (order_id);

-- ---------------------------------------------------------
-- Maintenance logs
-- ---------------------------------------------------------
CREATE TABLE maintenance_logs (
  maintenance_id SERIAL PRIMARY KEY,
  machine_id     INTEGER NOT NULL REFERENCES machines(machine_id),
  admin_id       INTEGER REFERENCES admins(admin_id),
  issue_type     maintenance_type NOT NULL,
  description    TEXT,
  reported_at    TIMESTAMP NOT NULL DEFAULT now(),
  resolved_at    TIMESTAMP
);

-- ---------------------------------------------------------
-- Temperature logs
-- ---------------------------------------------------------
CREATE TABLE temperature_logs (
  temp_log_id SERIAL PRIMARY KEY,
  machine_id  INTEGER NOT NULL REFERENCES machines(machine_id),
  temperature DECIMAL(4,1) NOT NULL,
  recorded_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_temp_logs_machine_time ON temperature_logs (machine_id, recorded_at);

-- ---------------------------------------------------------
-- Alerts
-- ---------------------------------------------------------
CREATE TABLE alerts (
  alert_id    SERIAL PRIMARY KEY,
  machine_id  INTEGER NOT NULL REFERENCES machines(machine_id),
  slot_id     INTEGER REFERENCES machine_slots(slot_id),
  alert_type  alert_type NOT NULL,
  status      alert_status NOT NULL DEFAULT 'open',
  message     VARCHAR,
  created_at  TIMESTAMP NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP
);
CREATE INDEX idx_alerts_status_machine ON alerts (status, machine_id);

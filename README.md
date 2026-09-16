# Vending Machine POS

ระบบตู้กดอัตโนมัติ: หน้าลูกค้า (kiosk POS, ไทย/อังกฤษ) + หน้าแอดมิน (ซ่อนจากลูกค้า, จัดการสินค้า/สต็อก/คำสั่งซื้อ/แจ้งเตือน)

- `backend/` — Node.js + Express + PostgreSQL API
- `frontend/` — Plain HTML/CSS/JS: `index.html` (customer kiosk), `admin/` (admin panel, not linked from kiosk)

## Setup

### 1. Database

Create a PostgreSQL database, then run the schema and seed data:

```powershell
psql -U postgres -c "CREATE DATABASE vending_pos;"
psql -U postgres -d vending_pos -f backend/db/schema.sql
```

### 2. Backend

```powershell
cd backend
npm install
Copy-Item .env.example .env
# edit .env -> set DATABASE_URL, JWT_SECRET, CORS_ORIGIN (your frontend URL)
npm run seed     # creates sample machine/products/slots + admin login
npm run dev      # or: npm start
```

API runs on `http://localhost:4000` by default.

Seeded admin login: **username `admin` / password `admin123`** (kiosk PIN `1234`, not yet wired to a PIN-unlock screen — the web login uses username/password).

### 3. Frontend

Serve the `frontend/` folder with any static server (e.g. VS Code "Live Server", or `npx serve frontend`). If your API is not on `http://localhost:4000/api`, set `window.API_BASE` before the other scripts load, or edit `frontend/js/api.js`.

- Customer kiosk: `frontend/index.html`
- Admin (hidden — no link from the kiosk, only reachable via direct URL): `frontend/admin/login.html`

## Notes / what to extend later

- Payments are **simulated** — `payment_status` is marked `paid` immediately. Swap in a real PromptPay/QR or card gateway by changing `routes/kiosk.js` checkout logic to create a `pending` order and confirm it via a webhook/callback.
- `machine_code` is hardcoded to `VM-BKK-001` in `frontend/js/kiosk.js` — for a real multi-machine deployment, pass it via URL/query param or device config instead.
- Kiosk PIN unlock (separate from admin web login) is stored (`pin_code_hash`) but has no UI yet — add if you want a lightweight in-store staff unlock screen.

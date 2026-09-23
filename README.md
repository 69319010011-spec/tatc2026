# Vending Machine POS

ระบบตู้กดอัตโนมัติ: หน้าลูกค้า (kiosk POS, ไทย/อังกฤษ) + หน้าแอดมิน (ซ่อนจากลูกค้า, จัดการสินค้า/สต็อก/ตู้/คำสั่งซื้อ/แจ้งเตือน/ผู้ดูแลระบบ)

## Folder map

```
Projiue1/
├── backend/                  Node.js + Express API (port 4000)
│   ├── server.js             จุดเริ่มต้น: ตั้งค่า middleware, routes, static files
│   ├── routes/               auth.js (login) · kiosk.js (หน้าลูกค้า/ชำระเงิน) · admin.js (หลังบ้านทั้งหมด)
│   ├── middleware/           auth.js (JWT + สิทธิ์ตาม role) · upload.js (อัปโหลดรูป)
│   ├── db/                   schema.sql · seed.js (ข้อมูลตัวอย่าง) · pool.js (ต่อ PostgreSQL/Supabase)
│   ├── storage/              ไฟล์ที่ API เสิร์ฟ
│   │   ├── icons/            ไอคอนสินค้า .svg (เสิร์ฟที่ /icons/...)
│   │   └── uploads/          รูปที่แอดมินอัปโหลด (เสิร์ฟที่ /uploads/..., ไม่เข้า git)
│   ├── .env                  ความลับ (DATABASE_URL, JWT_SECRET) — ไม่เข้า git
│   └── .env.example          ตัวอย่างค่าที่ต้องตั้ง
├── frontend/                 HTML/CSS/JS ล้วน (port 5500)
│   ├── kiosk/                หน้าลูกค้า (index.html, css/, js/)
│   ├── admin/                หน้าแอดมิน (login.html, dashboard.html, css/, js/) — ไม่มีลิงก์จากหน้าลูกค้า
│   └── shared/               config.js (เลือก API URL) · api.js (เรียก API) · i18n.js (ข้อความไทย/อังกฤษ) ใช้ร่วมกันทั้งสองหน้า
├── scripts/
│   ├── start-servers.ps1     เปิด backend + frontend เป็น background process
│   └── dev-server.js         static server เล็กๆ สำหรับโฟลเดอร์ frontend
└── logs/                     log ของเซิร์ฟเวอร์ (ไม่เข้า git)
```

## URLs

| หน้า | URL |
|---|---|
| ลูกค้า (kiosk) | http://127.0.0.1:5500/ (redirect ไป `/kiosk/`) |
| แอดมิน | http://127.0.0.1:5500/admin/login.html |
| API | http://localhost:4000/api |

## Setup

### 1. Database

ใช้ PostgreSQL (เครื่องนี้ต่อ Supabase ผ่าน Connection Pooler เพราะ direct connection เป็น IPv6 อย่างเดียว) สร้างตารางด้วย `backend/db/schema.sql`

### 2. Backend

```powershell
cd backend
npm install
Copy-Item .env.example .env
# แก้ .env -> DATABASE_URL, JWT_SECRET, CORS_ORIGIN
npm run seed     # สร้างตู้/สินค้า/ช่อง/ประวัติขายตัวอย่าง + บัญชีแอดมิน (ล้างข้อมูลเดิมทั้งหมด!)
npm start
```

### 3. Frontend

รัน `node scripts/dev-server.js 5500` (หรือใช้ static server ตัวไหนก็ได้ชี้ไปที่โฟลเดอร์ `frontend/`) ถ้า API ไม่ได้อยู่ที่ `http://localhost:4000/api` ให้ตั้ง `window.API_BASE` ก่อนโหลด script หรือแก้ `frontend/shared/api.js`

### รันทั้งสองตัวพร้อมกัน

```powershell
powershell -ExecutionPolicy Bypass -File scripts\start-servers.ps1
```

## บัญชีแอดมินเริ่มต้น

`admin` / `admin123` (จาก seed) — **เปลี่ยนรหัสผ่านทันที** ผ่านปุ่ม "เปลี่ยนรหัสผ่าน" ในหน้าแอดมิน

| Role | ทำอะไรได้ |
|---|---|
| `super_admin` | ทุกอย่าง รวมถึงจัดการสินค้า/ตู้/บัญชีผู้ดูแล |
| `restocker` | ดูข้อมูลทั้งหมด, เติม/ลดสต็อก, จัดสินค้าลงช่อง |
| `technician` | ดูข้อมูลทั้งหมด, แก้สถานะตู้, งานซ่อมบำรุง |

ล็อกอินผิดเกิน 10 ครั้ง/15 นาที (ต่อ IP) จะถูกล็อกชั่วคราว

## Deploy ขึ้นออนไลน์

Backend เป็น Express server ที่รันค้างตลอดเวลา (ไม่ใช่ serverless) เลย deploy แยก 2 ที่:

### Backend → Railway / Render / VPS ใดก็ได้ที่รัน Node.js persistent server ได้

1. สร้างโปรเจกต์ใหม่ ชี้ **Root Directory เป็น `backend`**
2. ตั้ง environment variables ตาม `backend/.env.example` (DATABASE_URL, JWT_SECRET, JWT_EXPIRES_IN, CORS_ORIGIN)
   - `CORS_ORIGIN` ให้ใส่ URL ของ frontend บน Vercel (เช่น `https://xxx.vercel.app`) แทน `*`
3. Start command: `npm start`
4. รัน `npm run seed` ครั้งเดียวหลัง deploy (ผ่าน shell ของบริการนั้น) เพื่อสร้างข้อมูลตัวอย่าง
5. รูปที่แอดมินอัปโหลด (`backend/storage/uploads`) เก็บบนดิสก์ของเซิร์ฟเวอร์ — ถ้าบริการที่ใช้ไม่มี persistent disk (redeploy แล้วไฟล์หาย) ต้องย้ายไปเก็บที่ Supabase Storage/S3 แทนในอนาคต

### Frontend → Vercel

1. New Project → **Root Directory ตั้งเป็น `frontend`**
2. Application Preset: **Other** (ไม่มี build step, ไม่มี framework)
3. แก้ `frontend/shared/config.js` — เปลี่ยน `PRODUCTION_API_BASE` เป็น URL จริงของ backend ที่ deploy ไว้ (เช่น `https://your-app.up.railway.app/api`) แล้ว commit + push ก่อน deploy
4. Deploy — `/` จะ redirect ไป `/kiosk/` อัตโนมัติ (ตั้งไว้ใน `frontend/vercel.json`)

## Notes

- การชำระเงิน **จำลอง**: `payment_status` เป็น `paid` ทันที ถ้าจะใช้จริงให้ต่อ payment gateway ที่ `backend/routes/kiosk.js`
- `machine_code` ตั้งตายตัวเป็น `VM-BKK-001` ใน `frontend/kiosk/js/kiosk.js`
- รูปสินค้า: ถ้าสินค้าไม่มี `image_url` หน้า kiosk จะใช้ emoji แทน

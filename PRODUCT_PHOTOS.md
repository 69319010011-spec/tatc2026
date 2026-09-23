# การใช้รูปสินค้าจริงบนเว็บไซต์

1. เข้าสู่ระบบผู้ดูแลหลัก แล้วเปิดหน้าจัดการสินค้า
2. เลือกแก้ไขสินค้า เลือกรูป JPEG, PNG, WebP หรือ GIF ขนาดไม่เกิน 5 MB แล้วบันทึก
3. เปิดหน้าลูกค้าใหม่เพื่อตรวจสอบรูปของสินค้าที่จัดลงช่องตู้แล้ว

## เก็บรูปถาวรสำหรับเว็บออนไลน์

ใช้ Node.js 18 ขึ้นไป และสร้าง bucket ชื่อ `product-images` ใน Supabase Storage โดยเปิดเป็น Public เพื่อให้ลูกค้าดูรูปได้ กำหนดขนาดไฟล์สูงสุด 5 MB และอนุญาตเฉพาะชนิดรูปที่ระบุข้างต้น ไม่ต้องเปิดสิทธิ์อัปโหลดให้บุคคลทั่วไป

ตั้ง environment variables ที่บริการโฮสต์ backend:

```env
PRODUCT_IMAGE_STORAGE=supabase
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_SIDE_SERVICE_ROLE_KEY
SUPABASE_STORAGE_BUCKET=product-images
```

เก็บ service role key ใน backend เท่านั้น ห้ามใส่ frontend หรือ commit ลง Git จากนั้น deploy backend และ frontend ที่แก้ไขแล้ว

รูปที่อัปโหลดใหม่จะถูกเก็บใน Storage และบันทึก URL ลงสินค้า รูปเดิมที่เป็น `/uploads/...` ไม่ได้ย้ายอัตโนมัติ ต้องอัปโหลดใหม่หลังตั้งค่า

ทดสอบด้วยการอัปโหลดรูปหนึ่งรายการ ตรวจสอบหน้าลูกค้า แล้ว restart backend และตรวจสอบว่ารูปยังแสดง หากอัปโหลดไม่สำเร็จ ฟอร์มจะยังเปิดอยู่ให้ลองบันทึกใหม่โดยไม่สร้างสินค้าซ้ำ

หากยังไม่ตั้งค่า ระบบจะใช้การเก็บรูปในเครื่องแบบเดิม (`PRODUCT_IMAGE_STORAGE=local`)

อ้างอิง: https://supabase.com/docs/guides/storage/uploads/standard-uploads

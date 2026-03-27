# Changelog — Phantom Analytics

## v1.2.0 (2026-03-27)

### Dashboard (packages/dashboard)

#### UI Overhaul — Modal & Cursor
- ทุก action (สร้าง/แก้ไข/ลบ/ยืนยัน) ใช้ modal popup ทั้งหมด
- สร้าง `FormModal` component ใหม่ — reusable form modal พร้อม Escape key + auto-focus
- ปุ่มทุกปุ่มมี `cursor: pointer` อัตโนมัติ ผ่าน global CSS rule
- เปลี่ยนจาก `alert()` เป็น SweetAlert2 ทั้งระบบ — toast แจ้งเตือนสำเร็จ/ล้มเหลว
- ปุ่ม Copy แจ้งเตือนแบบ toast แทน inline text change

#### Select dropdown ปรับสไตล์
- Select ทุกตัวมีสีพื้น + ChevronDown icon ดูแตกต่างจาก input ชัดเจน
- Role select ใน table สีตาม role (admin=ฟ้า, developer=ม่วง, viewer=เทา)
- เปลี่ยน role มี ConfirmDialog ยืนยันก่อน

#### Timezone selector
- TopBar มุมขวาบน แสดงวันที่+เวลา realtime ตาม timezone ที่เลือก
- 22 timezone ให้เลือก, default UTC+7 กรุงเทพฯ
- จำค่าใน localStorage
- เปลี่ยน timezone → ข้อมูล analytics refetch ใหม่ตาม timezone

#### จัดการผู้ใช้
- เพิ่มคอลัมน์ "เว็บไซต์" แสดง site ที่แต่ละ user เข้าถึงได้
- Admin แสดง "ทุกเว็บไซต์"

#### Activity Log (ใหม่)
- หน้า Activity Log สำหรับ admin — ดู log ทุก action ในระบบ
- Track: login/logout/login ล้มเหลว, CRUD sites/users/funnels/click variables, กำหนดเว็บไซต์, สร้างลิงก์
- Filter ตาม action type, entity type, ช่วงเวลา
- Pagination, แสดงเวลาตาม timezone
- Badge สี: สร้าง=เขียว, แก้ไข=น้ำเงิน, ลบ=แดง, login=ม่วง, ล้มเหลว=เหลือง

### API (packages/api)

- เพิ่ม `PUT /api/sites/:id` — แก้ไขชื่อ/โดเมนเว็บไซต์ (admin + developer)
- เพิ่ม `GET /api/activity-logs` — admin only, filter + pagination
- เพิ่ม `tz` query param ในทุก analytics endpoint — date boundary แปลงด้วย `AT TIME ZONE`
- สร้าง `services/activityLog.ts` — fire-and-forget logging ทุก action
- เพิ่ม `logActivity()` ใน auth, sites, users, funnels, clickVariables routes
- สร้างตาราง `activity_logs` + indexes

---

## v1.1.0 (2026-03-26)

### Tracker (packages/tracker)

- **Session persistence**: ใช้ `sessionStorage` เก็บ nonce — refresh หน้าเว็บไม่นับเป็นผู้เข้าชมใหม่
- **Scroll depth**: ส่ง 1 ครั้งตอนออกจากหน้า (ค่า 0-100%) ไม่ส่งถ้าหน้าไม่มี scrollbar, ไม่ส่งถ้ายังไม่เลื่อน (ได้ 0)
- **Time on page**: ส่งทั้งตอนเปลี่ยนหน้า (SPA navigate) และปิดแท็บ
- **Click tracking**: ใส่ `data-pa-click="ชื่อ"` บน HTML element
- **Custom events**: `phantom.track('event_name', { properties })`
- **Next.js support**: รองรับ config ผ่าน `window.__phantom_config` สำหรับ SPA ที่ `document.currentScript` เป็น null
- **Build fix**: ลบ `--global-name` จาก tsup build ที่ทำให้ `window.phantom` เป็น undefined

### Dashboard (packages/dashboard)

#### UI ภาษาไทย
- แปล UI ทั้งหมด 16 ไฟล์เป็นภาษาไทย
- เปลี่ยนศัพท์เทคนิคให้เข้าใจง่าย: "อัตราตีกลับ" → "เข้าแล้วออก", "เซสชันเฉลี่ย" → "อยู่นานเฉลี่ย"
- แสดงเวลาสัมพัทธ์ เช่น "3 นาทีที่แล้ว"
- แปล event type: pageview→เข้าชม, scroll→เลื่อน, click→คลิก

#### หน้าภาพรวม
- ย้าย Realtime มาแสดงในหน้าภาพรวม (ลบหน้าเรียลไทม์แยก)
- เพิ่มการ์ด "ออนไลน์ตอนนี้" พร้อมไฟเขียวกะพริบ
- แสดงหน้าที่ใช้งานอยู่ + เหตุการณ์ล่าสุด
- "เข้าแล้วออก" แสดงจำนวนคนในวงเล็บ เช่น `50% (2)`

#### หน้าการมีส่วนร่วม
- แบ่งเป็น 2 แท็บ: ระดับการเลื่อน / การคลิก
- **ระบบตัวแปรคลิก**: สร้าง/แก้ไข/ลบตัวแปร ตั้งชื่อไทยได้ พร้อมโค้ดให้ copy
- ตารางการคลิกแสดงชื่อไทยแทน ID ดิบ

#### หน้าช่องทาง (Funnel)
- เพิ่มฟิลเตอร์วันที่ (วันนี้ / 7 วัน / 30 วัน / 90 วัน)
- เพิ่ม "โค้ดสำหรับ track ช่องทางนี้" แบบ collapsible พร้อมปุ่มคัดลอกทุก step
- Auto-refresh ทุก 30 วินาที

#### หน้าตั้งค่า
- แก้ไขชื่อ/โดเมนเว็บไซต์ได้
- วิธีติดตั้ง 2 แบบ: HTML ทั่วไป / Next.js
- ตัวอย่างการใช้งาน: click tracking, custom events, funnel tracking
- สิ่งที่ track อัตโนมัติ

#### ปรับปรุงทั่วไป
- ตารางทุกตาราง: คอลัมน์ตรงกัน (`table-layout: fixed` + `colgroup`)
- Pagination ทุกตาราง: หน้าละ 20 รายการ
- URL ภาษาไทย decode ถูกต้อง (`decodeURIComponent`)
- Date presets: spinner loading ตอนเปลี่ยนช่วงเวลา
- ปุ่มสร้าง/ลบ: popup ยืนยันก่อนทำงานเสมอ

### API (packages/api)

- **DB fixes**: เพิ่ม `scroll`/`click` ใน event_type CHECK constraint
- **Sessions**: เพิ่ม UNIQUE constraint `(site_id, session_id)` ให้ session aggregator ทำงาน
- **Funnels**: สร้างตาราง `funnels` + `funnel_events` + แก้ query ให้ match URL จริง
- **Click variables**: ตาราง `click_variables` + CRUD API
- **Sources**: กรอง self-referral (domain ตัวเอง → นับเป็น "เข้าตรง")
- **Realtime SSE**: seed ข้อมูลจาก DB 5 นาทีล่าสุดตอนเปิด connection
- **Overview**: เพิ่ม `bounce_count` ใน response

---

## v1.0.0 (2026-03-25)

- Initial release — 47/47 features complete
- See `features.json` for full feature list

# เอกสารข้อกำหนดผลิตภัณฑ์ (PRD)
## โปรเจค: Phantom Analytics — ระบบวิเคราะห์เว็บแบบ Self-Hosted

**เวอร์ชัน:** 1.1.0
**วันที่:** 2026-03-26
**สถานะ:** Released

---

## 1. วิสัยทัศน์ผลิตภัณฑ์

Phantom Analytics เป็นระบบวิเคราะห์เว็บแบบ self-hosted ที่เน้นความเป็นส่วนตัว ให้นักพัฒนาและทีมผลิตภัณฑ์เป็นเจ้าของข้อมูลเต็มรูปแบบ มอบข้อมูลเชิงลึกหลักของ Google Analytics — การเข้าชม, เซสชัน, เส้นทางผู้ใช้, ช่องทาง (Funnel), และผู้เข้าชม realtime — โดยไม่พึ่งบริการภายนอก ไม่ต้องมี cookie banner และไม่มีการรั่วไหลของข้อมูล

> "ข้อมูลของคุณ เซิร์ฟเวอร์ของคุณ กฎของคุณ"

---

## 2. ปัญหาที่แก้ไข

- Google Analytics 4 ซับซ้อน ไม่โปร่งใส และส่งข้อมูลผู้ใช้ไปยัง server ของ Google
- Cookie consent banner ลด UX และลดอัตรา conversion
- ทีมที่สร้าง SaaS หรือเว็บลูกค้า ต้องการ analytics ที่ embed, white-label หรือต่อยอดได้
- ทางเลือก open-source ที่มีอยู่ (Plausible, Umami) ดีแต่ยังจำกัดเรื่อง funnel และ realtime

---

## 3. กลุ่มผู้ใช้เป้าหมาย

| ประเภทผู้ใช้ | คำอธิบาย |
|-------------|----------|
| นักพัฒนา/เจ้าของ | ติดตั้งระบบบน server ของตัวเอง, ตั้งค่า tracking |
| Product Manager | ดู dashboard, กำหนด funnel, วิเคราะห์เส้นทางผู้ใช้ |
| ลูกค้า (อนาคต) | ฝัง tracking script ผ่าน snippet ที่ได้รับ |

---

## 4. ฟีเจอร์หลัก

### 4.1 Tracker Script (tracker.js)
- ขนาดเล็ก (< 5KB gzipped)
- Auto-track: pageview, เวลาอยู่ในหน้า, ระดับการเลื่อน (scroll depth 0-100%)
- Manual track: custom event (`phantom.track()`), คลิก (`data-pa-click`)
- เซสชันแบบ fingerprint (ไม่ใช้ cookie) + sessionStorage เพื่อไม่นับซ้ำตอน refresh
- เคารพ Do Not Track (DNT) อัตโนมัติ
- รองรับ SPA (React, Vue, Next.js) ผ่าน History API patching
- รองรับ Next.js ผ่าน `window.__phantom_config`

### 4.2 Event Collection API
- REST endpoint: `POST /api/collect`
- รับ event types: pageview, event, session_start, session_end, scroll, click, funnel_step
- ตรวจสอบ schema ด้วย Zod
- Rate limiting ต่อ IP (100 req/นาที)
- กรอง bot/crawler ผ่าน User-Agent
- กรอง self-referral (domain ตัวเอง → นับเป็น "เข้าตรง")
- CORS ตั้งค่าตาม domain ที่อนุญาต

### 4.3 Dashboard แบบ Realtime
- จำนวนผู้เข้าชมออนไลน์ (SSE, อัพเดตทุก 2 วินาที)
- Seed ข้อมูล 5 นาทีล่าสุดจาก DB ตอนเปิด dashboard
- หน้าที่มีคนดูอยู่ตอนนี้
- สตรีมเหตุการณ์ล่าสุด พร้อมเวลาสัมพัทธ์ (เช่น "3 นาทีที่แล้ว")

### 4.4 Analytics ย้อนหลัง
- การเข้าชมตามช่วงเวลา (วันนี้ / 7 วัน / 30 วัน / 90 วัน)
- ผู้เข้าชมไม่ซ้ำ
- หน้ายอดนิยม พร้อม sparkline trend
- แหล่งที่มา (เข้าตรง, ค้นหาทั่วไป, โซเชียล, อีเมล, โฆษณา, ลิงก์อ้างอิง)
- ประเภทอุปกรณ์ (desktop/mobile/tablet)
- เบราว์เซอร์และระบบปฏิบัติการ
- เปรียบเทียบช่วงเวลาก่อนหน้า

### 4.5 เซสชันและเส้นทางผู้ใช้
- ไทม์ไลน์เซสชันต่อผู้ใช้ (anonymous)
- หน้าที่เข้าชมตามลำดับ
- หน้าเข้า (สีน้ำเงิน) และหน้าออก (สีเหลืองอำพัน)
- อัตราเข้าแล้วออก (bounce rate) ต่อหน้า
- เวลาอยู่นานเฉลี่ย
- Pagination หน้าละ 20 รายการ

### 4.6 ช่องทาง (Funnel Analysis)
- กำหนด funnel หลายขั้นตอน (เช่น กดสมัคร → ขอ OTP → ยืนยัน OTP → สมัครสำเร็จ)
- รองรับทั้ง URL หน้า และ custom event
- อัตรา conversion ต่อขั้นตอน
- แสดง % หลุดออกระหว่างขั้นตอน
- ฟิลเตอร์ตามช่วงเวลา
- โค้ดตัวอย่างพร้อม copy ทุก step
- Auto-refresh ทุก 30 วินาที

### 4.7 ตัวแปรคลิก (Click Variables)
- สร้างตัวแปรตั้งชื่อไทยให้กับ click event
- CRUD: สร้าง/แก้ไข/ลบ
- แสดงโค้ด `data-pa-click="..."` ให้ copy
- ตารางการคลิกแสดงชื่อไทยแทน ID ดิบ

### 4.8 รองรับหลายเว็บไซต์ (Multi-Site)
- backend เดียวรองรับหลายเว็บไซต์
- แต่ละเว็บมี `site_id` และ tracking token เฉพาะ
- ข้อมูลแยกกันต่อเว็บ
- สลับเว็บได้จาก sidebar

---

## 5. ข้อกำหนดที่ไม่ใช่ฟังก์ชัน

| หมวด | ข้อกำหนด |
|------|----------|
| ประสิทธิภาพ | API response < 50ms p99, Dashboard โหลด < 2 วินาที |
| รองรับปริมาณ | 10,000 events/นาที ต่อเว็บ |
| ความเป็นส่วนตัว | ไม่เก็บ PII, GDPR-compliant โดยสถาปัตยกรรม |
| ความเสถียร | เป้าหมาย uptime 99.9%, graceful degradation |
| ความปลอดภัย | API token auth, rate limiting, input sanitization |
| การเก็บข้อมูล | ตั้งค่าได้ (ค่าเริ่มต้น: 1 ปีสำหรับ raw data, ไม่จำกัดสำหรับ aggregate) |

---

## 6. นอกขอบเขต (v1.x)

- การ track ระดับผู้ใช้ที่มี login/auth
- A/B testing
- Heatmap / session recording
- รายงานทาง email / แจ้งเตือน
- Mobile SDK (iOS/Android)
- ระบบเรียกเก็บเงิน multi-tenant

---

## 7. ตัวชี้วัดความสำเร็จ

- Tracker script โหลดภายใน < 100ms
- ไม่มี event ตกหล่นภายใต้ load ปกติ
- Dashboard แสดง event ภายใน < 3 วินาทีหลังเกิดขึ้น
- นักพัฒนาสามารถ integrate ได้ภายใน < 10 นาทีด้วย snippet
- ผู้ใช้ทั่วไปเข้าใจ dashboard ได้ทันทีโดยไม่ต้องอ่านคู่มือ (ใช้คำภาษาไทยที่สื่อความหมาย)

---

## 8. ข้อจำกัดทางเทคนิค

- ต้องรันบน VPS เดียวได้ (ขั้นต่ำ 2 CPU, 4GB RAM)
- Deploy ด้วย Docker Compose
- PostgreSQL + TimescaleDB เป็น data store หลัก
- Redis สำหรับ realtime counter และ pub/sub
- Node.js backend (Fastify framework)
- React frontend dashboard
- UI ภาษาไทย (ศัพท์เฉพาะใช้ภาษาอังกฤษ)

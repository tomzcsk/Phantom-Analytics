# Phantom Analytics — คู่มือการใช้งาน

## สารบัญ
1. [การติดตั้ง Tracker](#1-การติดตั้ง-tracker)
2. [Track การคลิก](#2-track-การคลิก)
3. [Track เหตุการณ์](#3-track-เหตุการณ์)
4. [ดูข้อมูลใน Dashboard](#4-ดูข้อมูลใน-dashboard)
5. [สร้างช่องทาง (Funnel)](#5-สร้างช่องทาง-funnel)
6. [ตัวแปรคลิก](#6-ตัวแปรคลิก)
7. [Next.js / React SPA](#7-nextjs--react-spa)
8. [Timezone](#8-timezone)
9. [Activity Log](#9-activity-log)

---

## 1. การติดตั้ง Tracker

### HTML ทั่วไป

เพิ่มใน `<head>` ของทุกหน้า:

```html
<script
  src="http://YOUR_SERVER/tracker.js"
  data-site-id="YOUR_SITE_ID"
  data-token="YOUR_TOKEN"
  data-endpoint="http://YOUR_SERVER/api/collect"
  async
></script>
```

> ดู Site ID และ Token ได้ที่ Dashboard → ตั้งค่า

### สิ่งที่ track อัตโนมัติ (ไม่ต้องเขียนโค้ดเพิ่ม)

| รายการ | รายละเอียด |
|--------|------------|
| การเข้าชมหน้า | ทุกครั้งที่เปิดหน้า / SPA navigate |
| ระดับการเลื่อน | ส่งค่า 0-100% ตอนออกจากหน้า |
| เวลาที่อยู่ในหน้า | คำนวณตอนเปลี่ยนหน้า/ปิดแท็บ |
| เซสชัน | Fingerprint-based, ไม่ใช้ cookie, หมดอายุ 30 นาที |
| Do Not Track | เคารพ browser setting อัตโนมัติ |

---

## 2. Track การคลิก

ใส่ `data-pa-click` บน HTML element ที่ต้องการ track:

```html
<!-- ปุ่ม -->
<button data-pa-click="signup_button">สมัครสมาชิก</button>

<!-- ลิงก์ -->
<a href="/pricing" data-pa-click="pricing_link">ดูราคา</a>

<!-- div — ลูกข้างในคลิกก็ track ให้ -->
<div data-pa-click="hero_banner">
  <img src="banner.jpg" />
  <p>คลิกตรงไหนก็ได้</p>
</div>
```

ข้อมูลดูได้ที่ Dashboard → การมีส่วนร่วม → การคลิก

---

## 3. Track เหตุการณ์

เรียก `phantom.track()` จาก JavaScript:

```js
// เหตุการณ์ทั่วไป
phantom.track('signup')
phantom.track('purchase', { amount: 1990, currency: 'THB' })
phantom.track('video_complete', { video_id: 'intro' })

// TypeScript
;(window as any).phantom.track('signup')
```

### ตัวอย่าง: track ขั้นตอนสมัครสมาชิก

```js
// 1. ตอนกดปุ่มสมัคร
phantom.track('click_register')

// 2. ตอนขอ OTP สำเร็จ
phantom.track('request_otp')

// 3. ตอนยืนยัน OTP สำเร็จ
phantom.track('verify_otp')

// 4. ตอนสมัครเสร็จ
phantom.track('register_success')
```

---

## 4. ดูข้อมูลใน Dashboard

### หน้าภาพรวม

| การ์ด | ความหมาย |
|-------|----------|
| ออนไลน์ตอนนี้ | จำนวนผู้ใช้ที่ active ใน 5 นาทีล่าสุด (realtime) |
| การเข้าชม | จำนวน pageview ทั้งหมด |
| ผู้เข้าชมไม่ซ้ำ | จำนวน session ไม่ซ้ำ |
| อยู่นานเฉลี่ย | เวลาเฉลี่ยที่ผู้ใช้อยู่ในเว็บ |
| เข้าแล้วออก | % ผู้ใช้ที่ดูแค่ 1 หน้าแล้วออก (จำนวนคนในวงเล็บ) |

### ช่วงเวลา

กดเลือก: วันนี้ / 7 วัน / 30 วัน / 90 วัน

ค่า "เทียบช่วงก่อนหน้า" คำนวณโดยเปรียบเทียบกับช่วงเวลาเดียวกันก่อนหน้า:
- เลือก 7 วัน (20-26 มี.ค.) → เทียบกับ 13-20 มี.ค.
- เลือก 30 วัน → เทียบกับ 30 วันก่อนหน้านั้น

### หน้าเว็บ

ตาราง top pages เรียงตาม pageview + แสดง bounce rate, เวลาเฉลี่ย, sparkline trend

### แหล่งที่มา

| ช่องทาง | เงื่อนไข |
|---------|----------|
| เข้าตรง | พิมพ์ URL ตรง / bookmark / ไม่มี referrer |
| ค้นหาทั่วไป | มาจาก Google, Bing, Yahoo ฯลฯ |
| โซเชียล | มาจาก Facebook, Twitter, TikTok ฯลฯ |
| อีเมล | มาจาก Gmail, Outlook ฯลฯ |
| โฆษณา | มี utm_medium=cpc, gclid, fbclid |
| ลิงก์อ้างอิง | เว็บอื่นที่ไม่ตรงกลุ่มข้างบน |

### การมีส่วนร่วม

- **ระดับการเลื่อน**: แต่ละหน้าถูกเลื่อนลงไปกี่ % (0=ไม่เลื่อน, 100=สุดหน้า)
- **การคลิก**: element ที่ใส่ `data-pa-click` ถูกคลิกกี่ครั้ง

### เส้นทาง

คลิกเซสชันเพื่อดูเส้นทางการเข้าชม หน้าเข้า (สีน้ำเงิน) → หน้าออก (สีเหลืองอำพัน)

---

## 5. สร้างช่องทาง (Funnel)

ช่องทาง = ติดตามว่าผู้ใช้ทำตามขั้นตอนครบไหม หลุดตรงไหน

### วิธีสร้าง

1. ไปที่ Dashboard → ช่องทาง → กด **ช่องทางใหม่**
2. ตั้งชื่อ เช่น "ขั้นตอนสมัครสมาชิก"
3. เพิ่มขั้นตอน:
   - **URL หน้า**: ใส่ path เช่น `/register`
   - **เหตุการณ์**: ใส่ชื่อ event เช่น `request_otp`
4. กด **บันทึกช่องทาง**

### วิธีอ่านผล

```
กดสมัคร       6 คน (100%)
              ↘ 33% หลุดออก    ← 2 คนกดแล้วไม่ทำต่อ
ขอ OTP       4 คน (67%)
              ↘ 25% หลุดออก
ยืนยัน OTP   3 คน (50%)
              ↘ 33% หลุดออก
สมัครสำเร็จ   2 คน (33%)       ← Conversion rate
```

### โค้ดตัวอย่าง

กด **"โค้ดสำหรับ track ช่องทางนี้"** ใต้กราฟ จะแสดงโค้ดพร้อมปุ่มคัดลอกทุก step

---

## 6. ตัวแปรคลิก

ตั้งชื่อภาษาไทยให้กับ click event เพื่อให้ดูง่ายใน dashboard

### วิธีสร้าง

1. ไปที่ การมีส่วนร่วม → การคลิก
2. กด **สร้างตัวแปร**
3. กรอก:
   - **คีย์**: `buy_button` (ภาษาอังกฤษ, ใช้ a-z 0-9 _ -)
   - **ชื่อที่แสดง**: `ปุ่มซื้อสินค้า`
4. กด **สร้าง**

ตารางจะแสดงโค้ด `data-pa-click="buy_button"` ให้ copy ไปแปะ

ตารางการคลิกจะแสดง "ปุ่มซื้อสินค้า" แทน `buy_button`

---

## 7. Next.js / React SPA

### ติดตั้งใน _app.tsx

```tsx
import { useEffect } from 'react'

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    if ((window as any).__pa_loaded) return
    ;(window as any).__pa_loaded = true
    ;(window as any).__phantom_config = {
      siteId: 'YOUR_SITE_ID',
      token: 'YOUR_TOKEN',
      endpoint: 'http://YOUR_SERVER/api/collect',
    }
    const s = document.createElement('script')
    s.src = 'http://YOUR_SERVER/tracker.js?v=3'
    document.head.appendChild(s)
  }, [])

  return <Component {...pageProps} />
}
```

### Track events ใน TypeScript

```tsx
// ใน event handler หรือ useEffect
if ((window as any).phantom) {
  ;(window as any).phantom.track('event_name', { key: 'value' })
}
```

### ทดสอบ session ใหม่

```js
// พิมพ์ใน Console แล้ว refresh
sessionStorage.removeItem('__pa_n')
```

---

## 8. Timezone

### เปลี่ยน Timezone

1. กดที่ **นาฬิกามุมขวาบน** ของ Dashboard
2. เลือก timezone ที่ต้องการ (มี 22 ตัวเลือก)
3. ข้อมูล analytics จะ refetch ใหม่ตาม timezone ที่เลือก

- Default: **UTC+7 (กรุงเทพฯ)**
- ค่าจำไว้ใน browser — เปิดใหม่ก็ยังเป็น timezone เดิม
- นาฬิกาอัปเดตแบบ realtime ทุกวินาที

> Timezone มีผลต่อ: ข้อมูลกราฟ, ตาราง, KPI card ทุกหน้า เพราะ date boundary ของ query จะแปลงตาม timezone ที่เลือก

---

## 9. Activity Log

### ใครเห็น
เฉพาะ **admin** เท่านั้น — เมนูอยู่ใน sidebar ใต้ "จัดการผู้ใช้"

### สิ่งที่ track

| Action | ตัวอย่าง |
|--------|----------|
| เข้าสู่ระบบ | login สำเร็จ, login ล้มเหลว |
| สร้าง | สร้างเว็บไซต์, ผู้ใช้, ช่องทาง, ตัวแปรคลิก, ลิงก์เข้าถึง |
| แก้ไข | แก้ไขข้อมูลเว็บ, เปลี่ยน role, กำหนดเว็บไซต์ให้ user |
| ลบ | ลบเว็บไซต์, ผู้ใช้, ช่องทาง, ตัวแปรคลิก |

### Filter

- **ตาม Action**: สร้าง / แก้ไข / ลบ / เข้าสู่ระบบ / ออกจากระบบ / ล้มเหลว
- **ตามประเภท**: เว็บไซต์ / ผู้ใช้ / ช่องทาง / ตัวแปรคลิก / การยืนยันตัวตน
- **ตามช่วงเวลา**: เลือกวันที่เริ่ม-สิ้นสุด
- กด **ล้างตัวกรอง** เพื่อรีเซ็ต

### Badge สี

| สี | Action |
|----|--------|
| เขียว | สร้าง |
| น้ำเงิน | แก้ไข |
| แดง | ลบ |
| ม่วง | เข้าสู่ระบบ |
| เทา | ออกจากระบบ |
| เหลือง | เข้าสู่ระบบล้มเหลว |

---

## FAQ

**Q: รีเฟรชหน้าเว็บ นับเป็นผู้เข้าชมใหม่ไหม?**
ไม่ — ใช้ sessionStorage เก็บ nonce ตลอดจนกว่าปิดแท็บ

**Q: หน้าสั้นไม่มี scrollbar แสดง scroll depth ไหม?**
ไม่ — ข้ามหน้าที่ไม่มี scrollbar

**Q: ใช้ cookie ไหม?**
ไม่ — ใช้ fingerprint + sessionStorage เท่านั้น ไม่ต้องมี cookie consent banner

**Q: เข้าแล้วออก (Bounce) คำนวณยังไง?**
ดู 1 หน้า + อยู่ไม่ถึง 30 วินาที = เข้าแล้วออก

**Q: ข้อมูล realtime ไม่ขึ้นตอนเปิด dashboard?**
ระบบ seed จาก DB 5 นาทีล่าสุดตอนเปิด — ถ้าไม่มีใครเข้าเว็บใน 5 นาทีจะเป็น 0

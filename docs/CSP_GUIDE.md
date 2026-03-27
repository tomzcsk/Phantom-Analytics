# Content-Security-Policy (CSP) — คู่มือสำหรับ Phantom Analytics

คู่มือนี้สำหรับเว็บไซต์ที่ใช้ **Content-Security-Policy** header — อธิบายว่าต้องเพิ่ม directive อะไรบ้างเพื่อให้ Phantom Analytics tracker ทำงานได้

---

## สิ่งที่ tracker ใช้

| ทรัพยากร | ประเภท | CSP Directive |
|----------|--------|---------------|
| `tracker.js` (โหลดจากเซิร์ฟเวอร์ของคุณ) | Script | `script-src` |
| `fetch()` POST ไปยัง `/api/collect` | Network | `connect-src` |
| `navigator.sendBeacon()` ตอนปิดหน้า | Network | `connect-src` |

Phantom Analytics **ไม่ใช้**:
- Inline script (`unsafe-inline` ไม่จำเป็น)
- `eval()` (`unsafe-eval` ไม่จำเป็น)
- Cookie, localStorage, หรือ Web Worker
- รูปภาพ, stylesheet, หรือ font ภายนอก

---

## CSP ขั้นต่ำ

สมมติเซิร์ฟเวอร์ Phantom Analytics อยู่ที่ `https://analytics.example.com`:

```
Content-Security-Policy:
  script-src 'self' https://analytics.example.com;
  connect-src 'self' https://analytics.example.com;
```

### แยกตาม directive

**`script-src`** — อนุญาตโหลด `tracker.js`
```
script-src 'self' https://analytics.example.com;
```

**`connect-src`** — อนุญาต `fetch()` และ `sendBeacon()` ไปยัง API
```
connect-src 'self' https://analytics.example.com;
```

---

## ตัวอย่างเต็ม

### Nginx

```nginx
add_header Content-Security-Policy "
  default-src 'self';
  script-src 'self' https://analytics.example.com;
  connect-src 'self' https://analytics.example.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data:;
  font-src 'self';
" always;
```

### Apache

```apache
Header set Content-Security-Policy "\
  default-src 'self'; \
  script-src 'self' https://analytics.example.com; \
  connect-src 'self' https://analytics.example.com; \
  style-src 'self' 'unsafe-inline'; \
  img-src 'self' data:; \
  font-src 'self';"
```

### HTML meta tag

> **ข้อจำกัด:** meta tag ไม่รองรับ `report-uri`, `report-to`, และ `frame-ancestors` — และไม่สามารถใช้ Report-Only mode ได้ แนะนำใช้ HTTP header แทนถ้าเป็นไปได้

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' https://analytics.example.com;
  connect-src 'self' https://analytics.example.com;
">
```

### Next.js (`next.config.js`)

```javascript
const cspHeader = `
  default-src 'self';
  script-src 'self' https://analytics.example.com;
  connect-src 'self' https://analytics.example.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data:;
  font-src 'self';
`

module.exports = {
  async headers() {
    return [{
      source: '/(.*)',
      headers: [{
        key: 'Content-Security-Policy',
        value: cspHeader.replace(/\n/g, ''),
      }],
    }]
  },
}
```

---

## ใช้ nonce แทน domain (ปลอดภัยกว่า)

หากเว็บของคุณใช้ nonce-based CSP สำหรับ script อยู่แล้ว:

```html
<script
  src="https://analytics.example.com/tracker.js"
  data-site-id="YOUR_SITE_ID"
  data-token="YOUR_TOKEN"
  data-endpoint="https://analytics.example.com/api/collect"
  nonce="RANDOM_NONCE_VALUE"
  async
></script>
```

```
Content-Security-Policy:
  script-src 'self' 'nonce-RANDOM_NONCE_VALUE';
  connect-src 'self' https://analytics.example.com;
```

> **หมายเหตุ:** `connect-src` ยังต้องระบุ domain ของ analytics เซิร์ฟเวอร์ — nonce ใช้ได้เฉพาะ `script-src`

---

## ใช้กับ `strict-dynamic`

หากเว็บของคุณใช้ `strict-dynamic` ใน CSP:

```
Content-Security-Policy:
  script-src 'nonce-RANDOM_NONCE_VALUE' 'strict-dynamic';
  connect-src 'self' https://analytics.example.com;
```

**สิ่งที่ต้องรู้:**
- เมื่อใช้ `strict-dynamic` — domain allowlist ใน `script-src` จะถูก**ละเว้น**โดย browser ที่รองรับ CSP Level 3 ดังนั้น nonce คือสิ่งเดียวที่อนุญาต script
- `connect-src` **ไม่ได้รับผลกระทบ**จาก `strict-dynamic` — ต้องระบุ domain ของ analytics เซิร์ฟเวอร์เสมอ
- ใส่ `nonce` attribute บน `<script>` tag ของ tracker ตามปกติ

---

## ทดสอบ CSP

### 1. Report-Only mode (ทดสอบก่อนบังคับ)

```
Content-Security-Policy-Report-Only:
  script-src 'self' https://analytics.example.com;
  connect-src 'self' https://analytics.example.com;
```

เปิด DevTools → Console — ถ้ามี CSP violation จะแสดงเป็น warning ไม่ block จริง

### 2. ตรวจใน DevTools

1. เปิดหน้าเว็บ → DevTools → **Network** tab
2. ค้นหา `tracker.js` — ต้องโหลดสำเร็จ (200)
3. ค้นหา `/api/collect` — ต้องส่งได้ (202)
4. ดู **Console** — ต้องไม่มี `Refused to load` หรือ `Refused to connect`

### 3. CSP Evaluator

ใช้เครื่องมือจาก Google: ค้นหา "CSP Evaluator" เพื่อตรวจสอบ CSP header ของคุณ

---

## แก้ปัญหา

| อาการ | สาเหตุ | วิธีแก้ |
|-------|--------|---------|
| `Refused to load the script` | `script-src` ไม่มี domain ของ analytics | เพิ่ม `https://analytics.example.com` ใน `script-src` |
| `Refused to connect` | `connect-src` ไม่มี domain ของ analytics | เพิ่ม `https://analytics.example.com` ใน `connect-src` |
| tracker โหลดแต่ไม่ส่งข้อมูล | `connect-src` block `fetch()` | ตรวจ `connect-src` ว่ามี endpoint ครบ |
| ข้อมูลตอนปิดหน้าหาย | `connect-src` block `sendBeacon()` | `sendBeacon` ใช้ `connect-src` เหมือน `fetch` |
| tracker โหลดไม่ขึ้นบนเว็บ HTTPS | Analytics เซิร์ฟเวอร์ใช้ HTTP (mixed content) | ตั้งค่า analytics เซิร์ฟเวอร์ให้ใช้ HTTPS — ไม่ใช่ปัญหา CSP |

---

## สรุป

Phantom Analytics ต้องการ CSP directive แค่ 2 ตัว:

```
script-src  → อนุญาตโหลด tracker.js
connect-src → อนุญาต fetch + sendBeacon ไปยัง /api/collect
```

ไม่ต้องใช้ `unsafe-inline`, `unsafe-eval`, หรือ wildcard — ปลอดภัยและเรียบง่าย

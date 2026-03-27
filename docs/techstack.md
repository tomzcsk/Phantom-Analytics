# Tech Stack — Phantom Analytics

**เวอร์ชัน:** 1.1.0
**อัพเดตล่าสุด:** 2026-03-26

---

## ภาพรวมสถาปัตยกรรม

```
┌─────────────────────────────────────────────────┐
│           เว็บไซต์ลูกค้า (หลายเว็บ)              │
│         tracker.js (< 5KB, vanilla JS)           │
└────────────────────┬────────────────────────────┘
                     │ HTTP POST /api/collect
                     ▼
┌─────────────────────────────────────────────────┐
│           Collector API  (Fastify)               │
│    Validate → Rate Limit → Enrich → Queue        │
└──────────┬──────────────────────┬───────────────┘
           │                      │
           ▼                      ▼
┌──────────────────┐   ┌─────────────────────────┐
│   PostgreSQL     │   │         Redis            │
│  + TimescaleDB   │   │  counters, pub/sub, buf  │
│  (time-series)   │   │                         │
└──────────┬───────┘   └────────────┬────────────┘
           │                        │ SSE
           └──────────┬─────────────┘
                      ▼
┌─────────────────────────────────────────────────┐
│         Analytics API  (Fastify)                 │
│    Query, Aggregate, Stream via SSE              │
└─────────────────────┬───────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│         Dashboard  (React + Vite)                │
│    Recharts, TanStack Query, Tailwind CSS        │
└─────────────────────────────────────────────────┘
```

---

## รายละเอียดแต่ละชั้น

### 1. Tracker Script (`packages/tracker`)

| หัวข้อ | เลือกใช้ | เหตุผล |
|--------|---------|--------|
| ภาษา | Vanilla TypeScript | ไม่มี runtime dependency, bundle เล็กสุด |
| Build | tsup (IIFE format) | สร้าง bundle เร็ว รองรับหลาย format |
| เป้าหมายขนาด | < 5KB gzip | ไม่กระทบความเร็วโหลดหน้า |
| Session ID | Fingerprint (screen+UA+lang+TZ hash) | ไม่ใช้ cookie, GDPR-friendly |
| SPA support | History API patch | รองรับ Next.js, Nuxt, Remix |
| Session persistence | sessionStorage | refresh ไม่นับเป็นคนใหม่ |

**เทคนิคสำคัญ:**
- `navigator.sendBeacon` สำหรับส่ง event ตอนปิดหน้า
- `window.__phantom_config` รองรับ Next.js/SPA ที่ `document.currentScript` เป็น null
- Scroll depth ส่ง 1 ครั้งตอนออกจากหน้า (0-100%)
- Click tracking ผ่าน event delegation บน `document` สำหรับ `data-pa-click`

---

### 2. Backend API (`packages/api`)

| หัวข้อ | เลือกใช้ | เหตุผล |
|--------|---------|--------|
| Runtime | Node.js 20 LTS | เสถียร, ecosystem กว้าง |
| Framework | Fastify 4 | เร็วกว่า Express 3 เท่า, schema-first |
| Schema validation | Zod + @fastify/type-provider-zod | Type-safe ตั้งแต่ต้นจนจบ |
| Authentication | API token (Bearer) | เรียบง่าย ปลอดภัยสำหรับ server use |
| Rate limiting | @fastify/rate-limit | Redis-backed, ต่อ IP |
| Geo IP | maxmind/geoip-lite | ใช้ DB local, ไม่เรียก API ภายนอก |
| Bot detection | ua-parser-js + heuristics | กรอง crawler ที่รู้จัก |
| ORM | Prisma | Type-safe queries, migration ดี |
| Realtime | SSE ผ่าน fastify-sse-v2 | เบา ไม่ต้องใช้ WebSocket |

**API Routes:**
- `POST /api/collect` — รับ event จาก tracker
- `GET /api/analytics/*` — query ข้อมูลย้อนหลัง
- `GET /api/realtime/stream` — SSE stream (seed จาก DB + Redis pub/sub)
- `CRUD /api/sites` — จัดการเว็บไซต์
- `CRUD /api/funnels` — จัดการช่องทาง
- `CRUD /api/click-variables` — จัดการตัวแปรคลิก

**Background services:**
- Buffer flush: Redis List → PostgreSQL batch INSERT ทุก 1 วินาที
- Session aggregator: รวม events เป็น sessions ทุก 60 วินาที

---

### 3. ฐานข้อมูล

#### PostgreSQL 16 + TimescaleDB

| ทำไมเลือก TimescaleDB? | |
|---|---|
| แบ่ง partition อัตโนมัติ | ตาราง events แบ่งตามเวลา ทุก 7 วัน |
| `time_bucket()` function | ทดแทน GROUP BY date ที่ซับซ้อน |
| Compression | ลดพื้นที่เก็บ 90%+ สำหรับข้อมูลเก่า |
| Continuous aggregates | คำนวณ rollup รายชั่วโมง/รายวัน ล่วงหน้า |

**ตารางหลัก:**
```sql
sites             -- เว็บไซต์ที่ลงทะเบียน
events            -- raw event stream (hypertable, แบ่งตามเวลา)
sessions          -- ข้อมูลเซสชันที่รวมแล้ว (UNIQUE: site_id, session_id)
funnels           -- คำจำกัดความช่องทาง
funnel_events     -- ขั้นตอนที่แต่ละเซสชันทำเสร็จ
click_variables   -- ตัวแปรคลิก (คีย์ + ชื่อไทย)
```

**Continuous aggregate views:**
- `pageviews_hourly` — rollup รายชั่วโมง
- `pageviews_daily` — rollup รายวัน

#### Redis 7

| การใช้งาน | วิธี implement |
|-----------|---------------|
| Event buffer | Redis List → batch insert ทุก 1 วินาที |
| SSE pub/sub | Redis Pub/Sub channel ต่อ site (`site_<id>`) |
| Rate limiting | Sliding window counter |

---

### 4. Dashboard Frontend (`packages/dashboard`)

| หัวข้อ | เลือกใช้ | เหตุผล |
|--------|---------|--------|
| Framework | React 19 | มาตรฐาน, ecosystem ใหญ่ |
| Build tool | Vite 6 | HMR ทันที, build เร็ว |
| Styling | Tailwind CSS 4 | Utility-first, design token สม่ำเสมอ |
| Charts | Recharts | สร้างสำหรับ React, composable, responsive |
| Data fetching | TanStack Query v5 | Caching, background refetch, stale-while-revalidate |
| Realtime | EventSource (SSE) | Native browser API, ไม่ต้องใช้ library |
| Routing | React Router v7 | File-based routing |
| วันที่ | date-fns | เบา, tree-shakeable |
| ไอคอน | Lucide React | สะอาด สม่ำเสมอ |
| ภาษา | ไทย | ศัพท์เฉพาะใช้ภาษาอังกฤษ |

**หน้าหลัก:**
- ภาพรวม — KPI cards + trend chart + realtime (ออนไลน์ตอนนี้, หน้าที่ใช้งาน, เหตุการณ์ล่าสุด)
- หน้าเว็บ — ตาราง top pages พร้อม sparkline
- การมีส่วนร่วม — แท็บ: ระดับการเลื่อน / การคลิก (+ ตัวแปรคลิก)
- แหล่งที่มา — แท็บ: แหล่งทราฟฟิก / อุปกรณ์
- ช่องทาง — สร้าง funnel + กราฟ + โค้ดตัวอย่าง
- เส้นทาง — ตารางเซสชัน + ไทม์ไลน์การเข้าชม
- ตั้งค่า — ข้อมูลเว็บ (แก้ไขได้) + วิธีติดตั้ง + ตัวอย่างโค้ด

**UX improvements:**
- Popup ยืนยันก่อนสร้าง/ลบเสมอ
- Spinner loading บนปุ่ม date preset
- Pagination หน้าละ 20 ทุกตาราง
- decodeURIComponent สำหรับ URL ภาษาไทย

---

### 5. Infrastructure & DevOps

| หัวข้อ | เลือกใช้ | เหตุผล |
|--------|---------|--------|
| Containerization | Docker + Docker Compose | Deploy คำสั่งเดียว |
| Reverse proxy | Nginx | TLS termination, serve static files |
| Process management | Docker restart policies | กู้คืนอัตโนมัติ |
| Logging | Pino (structured JSON) | เร็ว, parse ง่าย, ใช้กับ log aggregator ได้ |

---

### 6. โครงสร้าง Monorepo

```
phantom-analytics/
├── packages/
│   ├── tracker/          # tracker.js source
│   ├── api/              # Fastify backend
│   ├── dashboard/        # React frontend (ภาษาไทย)
│   └── shared/           # Shared types
├── docker/
│   ├── docker-compose.yml
│   ├── nginx.conf
│   └── init.sql
├── docs/
│   ├── prd.md            # เอกสารข้อกำหนด (ไทย)
│   ├── techstack.md      # เอกสาร tech stack (ไทย)
│   ├── features.json     # รายการฟีเจอร์
│   ├── UXUI.md           # design system
│   ├── CHANGELOG.md      # บันทึกการเปลี่ยนแปลง
│   └── USER_GUIDE.md     # คู่มือการใช้งาน (ไทย)
├── scripts/
│   ├── setup.sh
│   └── seed.ts
└── CLAUDE.md
```

---

### 7. เครื่องมือพัฒนา

| เครื่องมือ | จุดประสงค์ |
|-----------|-----------|
| yarn workspaces | จัดการ monorepo |
| TypeScript 5 | Type safety ทั้ง stack |
| ESLint + Prettier | คุณภาพและ format โค้ด |
| Vitest | Unit และ integration test |
| Playwright | E2E test dashboard |
| Husky + lint-staged | Pre-commit hooks |

---

## เป้าหมายประสิทธิภาพ

| ตัวชี้วัด | เป้าหมาย |
|----------|----------|
| Tracker script โหลด | < 100ms |
| Event collection API p99 | < 50ms |
| Dashboard โหลดครั้งแรก | < 2 วินาที |
| Realtime update latency | < 3 วินาที |
| SSE connections พร้อมกัน | 1,000+ |
| Events ที่รับได้/นาที | 10,000+ |

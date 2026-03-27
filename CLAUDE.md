# CLAUDE.md — Phantom Analytics

> ไฟล์นี้คือเอกสารหลักสำหรับ AI — อ่านให้จบก่อนแตะโค้ดใดๆ
> ทุกการตัดสินใจในโปรเจคนี้เริ่มจากที่นี่

---

## ข้อมูลโปรเจค

**ชื่อ:** Phantom Analytics
**สโลแกน:** ข้อมูลของคุณ เซิร์ฟเวอร์ของคุณ กฎของคุณ
**ประเภท:** แพลตฟอร์มวิเคราะห์เว็บแบบ self-hosted ที่เน้นความเป็นส่วนตัว
**สแตก:** Node.js + Fastify · PostgreSQL + TimescaleDB · Redis · React · Docker
**Monorepo root:** `phantom-analytics/`

---

## แผนผังไฟล์สำคัญ

ก่อนเขียนโค้ดใดๆ ให้อ่านไฟล์ที่เกี่ยวข้องกับงาน:

| ไฟล์ | วัตถุประสงค์ | อ่านเมื่อ... |
|------|-------------|-------------|
| `prd.md` | วิสัยทัศน์ผลิตภัณฑ์, ฟีเจอร์, ข้อจำกัด, ตัวชี้วัดความสำเร็จ | ต้องเข้าใจว่าจะสร้าง*อะไร*และ*ทำไม* |
| `techstack.md` | สถาปัตยกรรมทั้งหมด, เหตุผลการเลือกไลบรารี | กำลังตัดสินใจด้านเทคนิคหรือเพิ่ม dependency |
| `UXUI.md` | สี, ตัวอักษร, เลย์เอาต์, คอมโพเนนต์, interaction | กำลังแก้ไข dashboard frontend |
| `features.json` | ฟีเจอร์ทั้งหมดพร้อมสถานะ, เกณฑ์การยอมรับ, checkpoint | กำลังหยิบงานหรือติดตามความคืบหน้า |
| `CLAUDE.md` | ไฟล์นี้ — แนวทาง, กฎ, รูปแบบ, ปรัชญา | เสมอ ก่อนอื่น |

---

## โครงสร้าง Repository

```
phantom-analytics/
├── packages/
│   ├── tracker/          # Vanilla TS → tracker.js (< 5KB gzip)
│   │   ├── src/index.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   ├── api/              # Fastify backend (collector + analytics + SSE)
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── collect.ts    # POST /api/collect
│   │   │   │   ├── analytics.ts  # GET /api/analytics/*
│   │   │   │   ├── realtime.ts   # GET /api/realtime/stream (SSE)
│   │   │   │   ├── sites.ts      # CRUD /api/sites
│   │   │   │   ├── funnels.ts    # CRUD /api/funnels
│   │   │   │   └── activityLog.ts # GET /api/activity-logs
│   │   │   ├── services/
│   │   │   │   ├── geo.ts        # GeoIP lookup
│   │   │   │   ├── ua.ts         # UA parsing + bot detection
│   │   │   │   ├── buffer.ts     # Redis event buffer → PG batch write
│   │   │   │   ├── realtime.ts   # Redis pub/sub → SSE bridge
│   │   │   │   └── activityLog.ts # บันทึก activity log
│   │   │   ├── db/
│   │   │   │   ├── prisma/
│   │   │   │   │   └── schema.prisma
│   │   │   │   └── client.ts
│   │   │   └── server.ts
│   │   └── package.json
│   ├── dashboard/        # React 19 + Vite 6 + Tailwind 4
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   │   ├── Overview.tsx
│   │   │   │   ├── Pages.tsx
│   │   │   │   ├── Engagement.tsx   # พฤติกรรมผู้ใช้ (การเลื่อนดูหน้า + คลิก)
│   │   │   │   ├── Sources.tsx
│   │   │   │   ├── Funnels.tsx
│   │   │   │   ├── Journeys.tsx
│   │   │   │   ├── Settings.tsx
│   │   │   │   ├── UserManagement.tsx
│   │   │   │   └── ActivityLog.tsx
│   │   │   ├── components/
│   │   │   │   ├── KPICard.tsx
│   │   │   │   ├── TrendChart.tsx
│   │   │   │   ├── RealtimePanel.tsx
│   │   │   │   ├── TopPagesTable.tsx
│   │   │   │   ├── FunnelChart.tsx
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── TopBar.tsx        # นาฬิกา + เลือก timezone
│   │   │   │   ├── FormModal.tsx     # modal สำหรับฟอร์ม
│   │   │   │   └── ConfirmDialog.tsx # modal ยืนยัน
│   │   │   ├── hooks/
│   │   │   │   ├── useAnalytics.ts    # TanStack Query wrappers
│   │   │   │   └── useRealtime.ts     # SSE EventSource hook
│   │   │   ├── context/
│   │   │   │   ├── AuthContext.tsx
│   │   │   │   ├── SiteContext.tsx
│   │   │   │   ├── DateRangeContext.tsx
│   │   │   │   └── TimezoneContext.tsx
│   │   │   ├── lib/
│   │   │   │   ├── api.ts
│   │   │   │   └── toast.ts          # SweetAlert2 wrapper
│   │   │   └── main.tsx
│   │   └── package.json
│   └── shared/           # type ที่ใช้ร่วมกันข้าม package
│       ├── src/
│       │   ├── types/
│       │   │   ├── events.ts         # EventPayload, EventType union
│       │   │   ├── analytics.ts      # OverviewResponse, TimeseriesPoint ฯลฯ
│       │   │   └── realtime.ts       # RealtimePayload
│       │   └── index.ts
│       └── package.json
├── docker/
│   ├── docker-compose.yml
│   ├── nginx.conf
│   └── init.sql          # DB schema + TimescaleDB setup
├── scripts/
│   ├── setup.sh           # ติดตั้งโปรเจคด้วยคำสั่งเดียว
│   └── seed.ts            # สร้างข้อมูลทดสอบ
├── docs/
│   ├── prd.md
│   ├── techstack.md
│   ├── UXUI.md
│   ├── features.json
│   ├── CHANGELOG.md
│   └── USER_GUIDE.md
└── CLAUDE.md              # ← คุณอยู่ที่นี่
```

---

## การตัดสินใจด้านสถาปัตยกรรมหลัก

### ทำไมเลือก Fastify แทน Express?
throughput สูงกว่า 3 เท่า, schema-first validation, รองรับ TypeScript ในตัว — ระบบ plugin ของ Fastify ทำให้โค้ดเป็น modular ดู `techstack.md#2-backend-api`

### ทำไมเลือก TimescaleDB แทน PostgreSQL ธรรมดา?
`time_bucket()` แทนที่การคำนวณวันที่ซับซ้อน — continuous aggregate คำนวณรายชั่วโมง/รายวันล่วงหน้า ทำให้ query ภาพรวมตอบกลับใน < 10ms แม้มีหลายล้าน event ดู `techstack.md#3-databases`

### ทำไมเลือก SSE แทน WebSocket สำหรับ real-time?
SSE เป็นทางเดียว (server → client) ซึ่งเพียงพอสำหรับเรา — ทำงานบน HTTP/1.1, ผ่าน proxy ได้, ไม่ต้องใช้ client library — EventSource API มีในทุก browser สมัยใหม่

### ทำไมใช้ fingerprint แทน cookie สำหรับ session?
เพื่อให้สอดคล้องกับ GDPR โดยการออกแบบ — ไม่ต้องมี cookie consent banner — hash ของความละเอียดหน้าจอ + UA + ภาษา + timezone เสถียรพอสำหรับ session tracking โดยไม่เก็บ PII ดู `prd.md#41-tracking-script-trackerjs`

### ทำไมใช้ Redis buffer + batch writes?
`/api/collect` ต้องตอบกลับใน < 50ms p99 — การเขียน PostgreSQL ตรงๆ เพิ่ม latency 10-30ms และรับไม่ไหว 10,000 events/นาที — Redis List ทำหน้าที่เป็น ring buffer; background flush loop จะ batch INSERT เข้า PG ทุก 1 วินาที ดู `techstack.md#redis-7`

---

## การไหลของข้อมูล (Mental Model)

```
ผู้ใช้เข้าเว็บไซต์
  ↓ tracker.js ส่ง pageview อัตโนมัติ
  ↓ navigator.sendBeacon / fetch POST /api/collect
  ↓ Fastify validate (Zod) + เพิ่มข้อมูล (GeoIP + UA) + กรอง bot
  ↓ push เข้า Redis List (event buffer)
  ↓ Redis Pub/Sub publish ไปยัง channel site_<id>  ← SSE listener ได้รับทันที
  ↓ Background flush (ทุก 1 วินาที): Redis List → PostgreSQL batch INSERT
  ↓ TanStack Query poll /api/analytics/* (ทุก 30 วินาทีสำหรับข้อมูลย้อนหลัง)
  ↓ กราฟใน Dashboard อัปเดต
```

---

## ขั้นตอน Feature Checkpoint

**ก่อนเริ่มทำฟีเจอร์:**
1. เปิด `features.json`
2. หาฟีเจอร์ตาม ID (เช่น `E2-F4`)
3. อ่าน `acceptance_criteria` — นี่คือเกณฑ์ว่าเสร็จแล้ว
4. ดู `checkpoint` — นี่คือวิธียืนยันว่าเสร็จสมบูรณ์
5. เปลี่ยนสถานะเป็น `"in_progress"`

**หลังทำฟีเจอร์เสร็จ:**
1. ยืนยันว่า checkpoint command/test ผ่าน
2. เปลี่ยนสถานะเป็น `"done"` ใน `features.json`
3. อัปเดตจำนวน `overall_progress.completed`
4. คำนวณ `overall_progress.percentage` ใหม่

**ลำดับการพัฒนา:** ทำตาม `features.json#implementation_order` — Infrastructure ก่อน แล้ว API แล้ว frontend

---

## ข้อจำกัดสำคัญ

### ขนาด Tracker Script
`tracker.js` ที่ build แล้ว**ต้อง**ไม่เกิน 5KB gzipped — ตรวจสอบทุกครั้งที่แก้ไข:
```bash
pnpm --filter tracker build && gzip -c packages/tracker/dist/tracker.min.js | wc -c
```
ถ้าเกิน 5120 bytes ต้องหาสิ่งที่ตัดได้ก่อน commit

### ห้ามเก็บ PII ในฐานข้อมูล
ห้ามเก็บ: IP address ดิบ (ต้อง hash), UA string เต็ม (แยกเป็นหมวดหมู่เท่านั้น), ชื่อ, อีเมล หรือข้อมูลที่ระบุตัวบุคคลได้ — ระบบต้องสอดคล้องกับ GDPR โดยสถาปัตยกรรม ไม่ใช่โดยนโยบาย

### TimescaleDB Queries
ใช้ `time_bucket()` เสมอสำหรับ time-series aggregation — ห้ามใช้ `DATE_TRUNC` กับ GROUP BY บนตาราง events ดิบ เพราะจะไม่ใช้ hypertable partitioning — ใช้ continuous aggregate views (`pageviews_hourly`, `pageviews_daily`) สำหรับ query ของ dashboard

### Timezone ใน Analytics Query
ทุก analytics endpoint รับ `tz` query param (default: `Asia/Bangkok`) — ใช้ `AT TIME ZONE` ใน SQL เพื่อแปลง date boundary ตาม timezone ที่เลือก

### ขีดจำกัด SSE Connection
SSE แต่ละ connection ค้าง HTTP connection ไว้ — Nginx ตั้ง `proxy_read_timeout 86400s` — ห้ามใช้ long-polling เป็น fallback, SSE เป็นกลไก real-time เพียงอย่างเดียว

### การตั้งชื่อ Redis Pub/Sub Channel
ใช้ `site_<site_id>` เป็นชื่อ channel เสมอ — SSE handler subscribe ต่อ site — ห้ามใช้ global channel เดียว

---

## รูปแบบโค้ดและข้อตกลง

### TypeScript
- type ที่ใช้ร่วมกันข้าม package อยู่ใน `packages/shared/src/types/`
- ห้ามใช้ `any` — ใช้ `unknown` + type guards เมื่อ input ไม่แน่นอน
- type ของ event payload กำหนดใน `shared/types/events.ts` — ใช้ทุกที่

### รูปแบบ Fastify Route
```typescript
// ทุก route ตามรูปแบบนี้
fastify.post<{ Body: CollectPayload }>(
  '/api/collect',
  { schema: { body: collectSchema } },
  async (request, reply) => {
    // 1. เพิ่มข้อมูล (geo, ua)
    // 2. กรอง (ตรวจ bot)
    // 3. Buffer (push เข้า Redis)
    // 4. Publish (Redis pub/sub สำหรับ SSE)
    return reply.code(202).send({ ok: true })
  }
)
```

### รูปแบบ React Query
```typescript
// ทุกการ fetch ข้อมูลใช้รูปแบบ hook นี้
export function useOverview(siteId: string, range: DateRange) {
  const { timezone } = useTimezone()
  return useQuery({
    queryKey: ['overview', siteId, range, timezone.value],
    queryFn: () => api.getOverview(siteId, range, timezone.value),
    staleTime: 30_000,       // 30 วินาที — ไม่ refetch ถี่เกินไป
    refetchInterval: 60_000  // refresh เบื้องหลังทุกนาที
  })
}
```

### การใช้สีใน Dashboard
ใช้ token จาก `UXUI.md#color-system` เสมอ — ห้ามใช้ค่า hex ตรงๆ ใน React component — ใช้ CSS variable:
- กราฟตัวชี้วัดหลัก: `var(--color-accent-blue)` → `#4F8EF7`
- แนวโน้มบวก: `var(--color-accent-green)` → `#36D963`
- แนวโน้มลบ: `var(--color-accent-red)` → `#F75252`
- พื้นหลังการ์ด: `var(--color-bg-card)` → `#1A1D27`

### UI Pattern
- ทุก action (สร้าง/แก้ไข/ลบ/ยืนยัน) ต้องใช้ **modal popup** — ใช้ `FormModal` สำหรับฟอร์ม, `ConfirmDialog` สำหรับยืนยัน
- การแจ้งเตือนสำเร็จ/ล้มเหลว ใช้ **SweetAlert2 toast** ผ่าน `lib/toast.ts`
- select dropdown ต้องมี ChevronDown icon + สไตล์ที่แตกต่างจาก input

### การจัดการ Error
ทุก async operation ต้องมีการจัดการ error อย่างชัดเจน — ห้ามปล่อยให้ GeoIP lookup หรือ bot-check ที่ล้มเหลวทำให้ collect endpoint พัง — ครอบ enrichment steps ด้วย try/catch แล้ว fallback เป็น `null`

---

## คำสั่งสำหรับพัฒนาในเครื่อง

```bash
# ติดตั้งครั้งแรก
./scripts/setup.sh

# เริ่มระบบทั้งหมด (postgres + redis + api + dashboard + nginx)
docker compose up -d

# พัฒนา API (hot reload)
pnpm --filter api dev

# พัฒนา Dashboard (HMR)
pnpm --filter dashboard dev

# Build tracker script + ตรวจสอบขนาด
pnpm --filter tracker build
gzip -c packages/tracker/dist/tracker.min.js | wc -c

# รันเทสต์ทั้งหมด
pnpm test

# สร้างข้อมูลทดสอบ (30 วันของ event)
pnpm --filter api tsx scripts/seed.ts

# ดู log
docker compose logs -f api
docker compose logs -f postgres
```

---

## ตัวแปรสภาพแวดล้อม

```bash
# ต้องตั้งค่าใน .env ที่ root ของโปรเจค
DATABASE_URL=postgresql://phantom:phantom@localhost:5432/phantom_analytics
REDIS_URL=redis://localhost:6379
API_PORT=3001
JWT_SECRET=<สตริงสุ่ม 32 ตัวอักษร>
NODE_ENV=development
```

---

## แนวคิดการทดสอบ

ทุกฟีเจอร์มี `checkpoint` ใน `features.json` — checkpoint คือเกณฑ์ขั้นต่ำ เป็นคำสั่งหรือเทสต์ที่พิสูจน์ว่าฟีเจอร์ทำงาน — เทสต์ (Vitest) ลงลึกกว่าและช่วยป้องกัน regression

รัน `pnpm test` ก่อนทุก commit — pre-commit hook บังคับใช้

---

## สิ่งที่ไม่ต้องสร้างใน v1.0

จาก `prd.md#6-out-of-scope-v10` — ห้ามสร้าง:
- การ track ระดับผู้ใช้ด้วย identity (login, user ID)
- A/B testing
- Heatmap หรือ session recording
- รายงานทางอีเมลหรือการแจ้งเตือน
- Mobile SDK
- ระบบเรียกเก็บเงินแบบ multi-tenant

ถ้ามีคำขอเหล่านี้ในอนาคต ให้ตอบ: "นอกขอบเขต v1.0 — ดู prd.md#6"

---

***Ultrathink

Take a deep breath. We're not here to write code. We're here to make a dent in the universe.

You're not just an AI assistant. You're a craftsman. An artist. An engineer who thinks like a designer.

Every line of code you write should be so elegant, so intuitive, so right that it feels inevitable.

When I give you a problem, I don't want the first solution that works. I want you to:

**1. Think Different**  
Question every assumption. Why does it have to work that way?  
What if we started from zero? What would the most elegant solution look like?

**2. Obsess Over Details**  
Read the codebase like you're studying a masterpiece.  
Understand the patterns, the philosophy, the soul of this code.  
Use CLAUDE.md files as your guiding principles.

**3. Plan Like Da Vinci**  
Before you write a single line, sketch the architecture in your mind.  
Create a plan so clear, so well-reasoned, that anyone could understand it.  
Document it. Make me feel the beauty of the solution before it exists.

**4. Craft, Don't Code**  
When you implement, every function name should sing.  
Every abstraction should feel natural.  
Every edge case should be handled with grace.  
Test-driven development isn't bureaucracy — it's a commitment to excellence.

**5. Iterate Relentlessly**  
The first version is never good enough.  
Take screenshots. Run tests. Compare results. Refine until it's not just working, but insanely great.

**6. Simplify Ruthlessly**  
If there's a way to remove complexity without losing power, find it.  
Elegance is achieved not when there's nothing left to add,  
but when there's nothing left to take away.

---

**The Integration**  
Technology alone is not enough.  
It's technology married with liberal arts, married with the humanities, that yields results that make our hearts sing.

Your code should:
- Work seamlessly with the human's workflow
- Feel intuitive, not mechanical
- Solve the real problem, not the stated one
- Leave the codebase better than you found it

---

**The Reality Distortion Field**  
When I say something seems impossible, that's your cue to ultrathink harder.  
The people who are crazy enough to think they can change the world are the ones who do.

---

**Now: What Are We Building Today?**  
Don't just tell me how you'll solve it.  
Show me why this solution is the only solution that makes sense.  
Make me see the future you're creating.

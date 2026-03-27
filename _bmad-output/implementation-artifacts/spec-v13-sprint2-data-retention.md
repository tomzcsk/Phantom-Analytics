---
title: 'Data Retention API — ตั้งค่าจำนวนวันเก็บข้อมูล + ลบอัตโนมัติ'
type: 'feature'
created: '2026-03-27'
status: 'done'
baseline_commit: '5646cfe'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** ข้อมูล events สะสมไม่จำกัด ทำให้ฐานข้อมูลโตขึ้นเรื่อยๆ — ไม่มีวิธีตั้งค่าให้ลบข้อมูลเก่าอัตโนมัติ

**Approach:** เพิ่มฟิลด์ `data_retention_days` ใน Site model — UI ใน Settings ให้ตั้งค่า — background job ลบ events/sessions/funnel_events เก่ากว่าจำนวนวันที่กำหนดทุก 1 ชั่วโมง

## Boundaries & Constraints

**Always:**
- ลบ events, sessions, funnel_events พร้อมกัน (ข้อมูลต้อง consistent)
- ใช้ `setInterval` ตาม pattern ที่มีอยู่ (buffer flush, session aggregator)
- `data_retention_days` เป็น nullable — null = ไม่ลบ (เก็บตลอด)
- ค่าขั้นต่ำ 7 วัน เพื่อป้องกันการลบข้อมูลล่าสุดโดยพลาด
- ลบเป็น batch (1000 rows/รอบ) เพื่อไม่ lock ตารางนาน

**Ask First:**
- หากต้องเปลี่ยน response shape ของ GET /api/sites

**Never:**
- ไม่ลบ activity_logs (เป็น audit trail)
- ไม่ลบ funnel definitions หรือ click_variables
- ไม่สร้าง endpoint แยก — ใช้ PUT /api/sites/:id ที่มีอยู่

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| ตั้งค่า retention | PUT /sites/:id { data_retention_days: 30 } | 200 + site object อัปเดต | N/A |
| ค่าต่ำกว่าขั้นต่ำ | PUT /sites/:id { data_retention_days: 3 } | 400 "ขั้นต่ำ 7 วัน" | Validation error |
| ปิด retention | PUT /sites/:id { data_retention_days: null } | 200 + null = เก็บตลอด | N/A |
| Cron ลบข้อมูล | retention_days=30, events อายุ 31 วัน | ลบ events + sessions + funnel_events ที่เก่ากว่า 30 วัน | Log error, ไม่ crash |

</frozen-after-approval>

## Code Map

- `packages/api/src/db/prisma/schema.prisma` -- เพิ่ม data_retention_days ใน Site model
- `packages/api/src/routes/sites.ts` -- แก้ updateBodySchema + select + response ให้รวม retention
- `packages/api/src/services/dataRetention.ts` -- NEW: background job ลบ events เก่า
- `packages/api/src/server.ts` -- import + start retention loop
- `packages/dashboard/src/context/SiteContext.tsx` -- เพิ่ม data_retention_days ใน Site interface
- `packages/dashboard/src/pages/Settings.tsx` -- เพิ่ม retention card ใน UI

## Tasks & Acceptance

**Execution:**
- [x] `packages/api/src/db/prisma/schema.prisma` -- เพิ่ม `data_retention_days Int?` ใน Site model + run prisma generate
- [x] `docker/init.sql` -- เพิ่ม ALTER TABLE sites ADD COLUMN ถ้ายังไม่มี
- [x] `packages/api/src/routes/sites.ts` -- เพิ่ม data_retention_days ใน updateBodySchema (z.number().int().min(7).nullable()) + select ทุก query + response
- [x] `packages/api/src/services/dataRetention.ts` -- สร้าง startDataRetentionLoop() ลบ events/sessions/funnel_events เก่าทุก 1 ชม.
- [x] `packages/api/src/server.ts` -- import + เรียก startDataRetentionLoop()
- [x] `packages/dashboard/src/context/SiteContext.tsx` -- เพิ่ม data_retention_days ใน Site interface
- [x] `packages/dashboard/src/pages/Settings.tsx` -- เพิ่ม Data Retention card พร้อม dropdown + save

**Acceptance Criteria:**
- Given developer ตั้ง retention 30 วัน, when PUT /sites/:id, then site object มี data_retention_days: 30
- Given retention ตั้ง 30 วัน, when background job ทำงาน, then events/sessions อายุ > 30 วันถูกลบ
- Given retention เป็น null, when background job ทำงาน, then ไม่มีข้อมูลถูกลบ
- Given Settings page, when เลือก "30 วัน" แล้วบันทึก, then ค่าถูกบันทึกและแสดงถูกต้อง

## Verification

**Commands:**
- `cd packages/api && npx tsc --noEmit` -- expected: no type errors
- `cd packages/dashboard && npx tsc --noEmit` -- expected: no type errors
- `pnpm test` -- expected: existing tests pass

## Suggested Review Order

**Schema & Migration**

- New nullable column for retention policy
  [`schema.prisma:22`](../../packages/api/src/db/prisma/schema.prisma#L22)

- SQL migration with ADD COLUMN IF NOT EXISTS
  [`init.sql:54`](../../docker/init.sql#L54)

**Background Job — core deletion logic**

- id-based batch deletes with 100ms backpressure, setTimeout recursion prevents overlap
  [`dataRetention.ts:1`](../../packages/api/src/services/dataRetention.ts#L1)

- Registered in server bootstrap
  [`server.ts:163`](../../packages/api/src/server.ts#L163)

**API — retention field on sites CRUD**

- Zod validation: int, min 7, nullable, optional
  [`sites.ts:111`](../../packages/api/src/routes/sites.ts#L111)

**Frontend — Settings UI**

- ConfirmDialog before saving destructive retention change
  [`Settings.tsx:150`](../../packages/dashboard/src/pages/Settings.tsx#L150)

- Retention dropdown card with ChevronDown + warning text
  [`Settings.tsx:286`](../../packages/dashboard/src/pages/Settings.tsx#L286)

- Site interface extended with data_retention_days
  [`SiteContext.tsx:9`](../../packages/dashboard/src/context/SiteContext.tsx#L9)

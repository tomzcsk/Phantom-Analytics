---
title: 'v2.0 Sprint 7 — Goal Tracking + Event Explorer'
type: 'feature'
created: '2026-03-28'
status: 'done'
baseline_commit: '16d0741'
context: ['docs/UXUI.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** ผู้ใช้ไม่สามารถตั้งเป้าหมาย conversion ได้ (เช่น "สมัครสำเร็จ 100 คน/สัปดาห์") และไม่มีหน้าดู raw events เพื่อ debug หรือ drilldown

**Approach:** (1) Goals: CRUD API + DB table สำหรับเป้าหมาย → dashboard page แสดง progress bar ต่อเป้า (2) Event Explorer: หน้าดู raw events พร้อม filter ตาม event_type/url/session → pagination + drilldown

## Boundaries & Constraints

**Always:**
- Goal ผูกกับ event_type หรือ custom_name — นับจำนวน events ที่ตรงเงื่อนไขในช่วงเวลา
- Goal มี target_value (จำนวนเป้า) + period (daily/weekly/monthly)
- Event Explorer ใช้ pagination (50 rows/page) กับ filter ฝั่ง server
- Event Explorer แสดง: timestamp, event_type, url, session_id (truncated), country, device

**Ask First:**
- หากต้อง real-time goal progress (ตอนนี้ใช้ poll ทุก 30 วินาที)

**Never:**
- ไม่แสดง raw IP หรือ PII ใน Event Explorer
- ไม่เก็บ goal history (แสดงเฉพาะ progress ปัจจุบัน)

</frozen-after-approval>

## Code Map

- `packages/api/src/db/prisma/schema.prisma` -- เพิ่ม Goal model
- `docker/init.sql` -- เพิ่ม goals table
- `packages/api/src/routes/goals.ts` -- NEW: CRUD goals + GET progress
- `packages/api/src/routes/events.ts` -- NEW: GET /api/events (paginated raw events)
- `packages/api/src/server.ts` -- register routes
- `packages/dashboard/src/pages/Goals.tsx` -- NEW: goals dashboard page
- `packages/dashboard/src/pages/EventExplorer.tsx` -- NEW: raw events table
- `packages/dashboard/src/components/Sidebar.tsx` -- เพิ่ม 2 menu items
- `packages/dashboard/src/App.tsx` -- เพิ่ม routes

## Tasks & Acceptance

**Execution:**
- [x] `packages/api/src/db/prisma/schema.prisma` + `docker/init.sql` -- Goal model (id, site_id, name, event_match, target_value, period, created_at)
- [x] `packages/api/src/routes/goals.ts` -- POST/GET/DELETE goals + GET /api/goals/:id/progress (count matching events in current period)
- [x] `packages/api/src/routes/events.ts` -- GET /api/events?site_id&from&to&event_type&url&session_id&page&limit (paginated, max 50)
- [x] `packages/api/src/server.ts` -- register routes
- [x] `packages/dashboard/src/pages/Goals.tsx` -- goal list + progress bars + create/delete modal
- [x] `packages/dashboard/src/pages/EventExplorer.tsx` -- table + filters + pagination
- [x] `packages/dashboard/src/components/Sidebar.tsx` + `packages/dashboard/src/App.tsx` -- เพิ่ม menu + routes

**Acceptance Criteria:**
- Given สร้าง goal "สมัคร 100 คน/สัปดาห์" match event "signup", when มี 45 signup events สัปดาห์นี้, then แสดง progress 45/100 (45%)
- Given Event Explorer, when filter event_type=pageview, then แสดงเฉพาะ pageview events พร้อม pagination
- Given Event Explorer, when คลิก session_id, then filter ดู events ใน session นั้น

## Verification

**Commands:**
- `cd packages/api && npx tsc --noEmit` -- expected: no type errors (excluding tests)
- `cd packages/dashboard && npx tsc --noEmit` -- expected: no type errors
- `pnpm test` -- expected: existing tests pass

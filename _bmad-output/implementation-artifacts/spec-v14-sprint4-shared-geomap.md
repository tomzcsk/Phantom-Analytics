---
title: 'v1.4 Sprint 4 — Shared Dashboard + Geo Map'
type: 'feature'
created: '2026-03-27'
status: 'done'
baseline_commit: '5fbdb0e'
context: ['docs/UXUI.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** ผู้ใช้ไม่สามารถแชร์ข้อมูล analytics ให้คนอื่นดูได้โดยไม่ต้องให้ login และหน้า Geography แสดงเป็นรายการ text ไม่มี map ให้เห็นภาพรวม

**Approach:** (1) สร้าง share_links table + CRUD API + public route แสดง overview read-only ไม่ต้อง login (2) เพิ่ม SVG world map component ในหน้า Geography แสดงสีตามจำนวนผู้เข้าชม (ใช้ inline SVG ไม่ต้องเพิ่ม dependency)

## Boundaries & Constraints

**Always:**
- Share link ใช้ random token (crypto) — ไม่ใช่ JWT — expire หลัง 30 วัน default
- Public route (/public/:token) แสดง overview KPIs + trend chart เท่านั้น — ไม่แสดง settings, sessions, หรือ raw data
- Geo map ใช้ inline SVG (world-110m simplified) — ไม่เพิ่ม external map library
- Share link CRUD เข้าถึงได้เฉพาะ developer/admin

**Ask First:**
- หากต้องเปลี่ยน response shape ของ overview API

**Never:**
- ไม่แสดง tracking token หรือ site ID ในหน้า public
- ไม่ให้ public route เข้าถึง API อื่นนอกจาก overview + timeseries
- ไม่ใช้ leaflet, mapbox หรือ map library ภายนอก

</frozen-after-approval>

## Code Map

- `packages/api/src/db/prisma/schema.prisma` -- เพิ่ม ShareLink model
- `docker/init.sql` -- เพิ่ม share_links table
- `packages/api/src/routes/shareLinks.ts` -- NEW: CRUD share links + public data endpoint
- `packages/api/src/server.ts` -- register shareLinks route
- `packages/dashboard/src/pages/Settings.tsx` -- เพิ่ม Share Links management card
- `packages/dashboard/src/pages/PublicDashboard.tsx` -- NEW: read-only public view
- `packages/dashboard/src/App.tsx` -- เพิ่ม /public/:token route
- `packages/dashboard/src/components/WorldMap.tsx` -- NEW: SVG choropleth map
- `packages/dashboard/src/pages/Sources.tsx` -- เพิ่ม WorldMap ในหน้า Geography tab

## Tasks & Acceptance

**Execution:**
- [x] `packages/api/src/db/prisma/schema.prisma` + `docker/init.sql` -- เพิ่ม share_links table (id, site_id, token, label, expires_at, created_at)
- [x] `packages/api/src/routes/shareLinks.ts` -- POST /api/share-links (create) + GET /api/share-links (list) + DELETE /api/share-links/:id + GET /api/public/:token (return overview+timeseries ไม่ต้อง auth)
- [x] `packages/api/src/server.ts` -- register route
- [x] `packages/dashboard/src/pages/Settings.tsx` -- Share Links card: สร้าง/ลบ/copy link
- [x] `packages/dashboard/src/pages/PublicDashboard.tsx` -- read-only KPIs + TrendChart
- [x] `packages/dashboard/src/App.tsx` -- เพิ่ม /public/:token route (no AuthGuard)
- [x] `packages/dashboard/src/components/WorldMap.tsx` -- SVG world map choropleth จาก GeoStat[]
- [x] `packages/dashboard/src/pages/Sources.tsx` -- เพิ่ม WorldMap component ใน geo tab

**Acceptance Criteria:**
- Given developer สร้าง share link, when เปิด link ใน browser อื่น (ไม่ login), then เห็น overview KPIs + chart read-only
- Given share link หมดอายุ, when เปิด link, then แสดง "ลิงก์หมดอายุ"
- Given Geography tab มีข้อมูลประเทศ, when ดูหน้า, then แสดงแผนที่โลก SVG สีตามจำนวนผู้เข้าชม

## Verification

**Commands:**
- `cd packages/api && npx tsc --noEmit` -- expected: no type errors (excluding tests)
- `cd packages/dashboard && npx tsc --noEmit` -- expected: no type errors
- `pnpm test` -- expected: existing tests pass

## Suggested Review Order

**Share Links — backend**

- ShareLink model + DB migration
  [`schema.prisma:173`](../../packages/api/src/db/prisma/schema.prisma#L173)

- CRUD + public endpoint (token validation, overview query)
  [`shareLinks.ts:1`](../../packages/api/src/routes/shareLinks.ts#L1)

- Registered in server bootstrap
  [`server.ts:25`](../../packages/api/src/server.ts#L25)

**Share Links — frontend**

- ShareLinksCard: create/delete/copy URL
  [`Settings.tsx:22`](../../packages/dashboard/src/pages/Settings.tsx#L22)

- PublicDashboard: read-only KPIs + chart (no auth)
  [`PublicDashboard.tsx:1`](../../packages/dashboard/src/pages/PublicDashboard.tsx#L1)

- Route: /public/:token outside AuthGuard
  [`App.tsx:130`](../../packages/dashboard/src/App.tsx#L130)

**Geo Map**

- SVG world map choropleth (50 countries, hover tooltip, legend)
  [`WorldMap.tsx:1`](../../packages/dashboard/src/components/WorldMap.tsx#L1)

- Integrated above country list in Geography tab
  [`Sources.tsx:468`](../../packages/dashboard/src/pages/Sources.tsx#L468)

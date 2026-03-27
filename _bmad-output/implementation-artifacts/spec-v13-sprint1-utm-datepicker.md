---
title: 'v1.3 Sprint 1 — UTM Parameter Tracking + Custom Date Range Picker'
type: 'feature'
created: '2026-03-27'
status: 'done'
baseline_commit: 'a175e6e'
context: ['docs/techstack.md', 'docs/UXUI.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Sources page แสดงแค่ traffic source category (direct/organic/social/paid/referral) แต่ไม่เก็บ UTM params จริง — marketer ดูไม่ได้ว่า campaign ไหนพา traffic มา นอกจากนี้ date range รองรับแค่ preset (1d/7d/30d/90d) เลือกช่วงเวลาเองไม่ได้

**Approach:** (1) tracker.js แยก utm_source/medium/campaign จาก URL query string → ส่งใน payload → API เก็บลง 3 คอลัมน์ใหม่ → Sources page เพิ่ม UTM breakdown tab (2) สร้าง DateRangePicker component ใน TopBar → DateRangeContext รองรับ custom from/to → ทุก analytics query ใช้ range จาก context

## Boundaries & Constraints

**Always:**
- tracker.js gzipped ต้อง < 5KB หลังเพิ่ม UTM parsing
- UTM params เก็บเป็น lowercase, trim whitespace
- Date picker ใช้ native input[type=date] เพื่อไม่เพิ่ม dependency
- ทุก analytics endpoint ที่มีอยู่ต้องทำงานเหมือนเดิมเมื่อไม่มี UTM data

**Ask First:**
- หากต้องเพิ่ม dependency ใหม่ให้ dashboard (date picker library)

**Never:**
- ห้ามเก็บ utm_content หรือ utm_term ใน v1.3 (เกินขอบเขต)
- ห้ามเปลี่ยน source category logic ที่มีอยู่ (direct/organic/social/paid/referral)
- ห้าม breaking change กับ collect endpoint (fields ใหม่ต้อง optional)

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| UTM ครบ 3 fields | URL มี ?utm_source=google&utm_medium=cpc&utm_campaign=spring | payload ส่ง 3 fields, DB เก็บ lowercase | N/A |
| UTM บางส่วน | URL มีแค่ utm_source=newsletter | เก็บ utm_source, medium+campaign เป็น null | N/A |
| ไม่มี UTM | URL ปกติไม่มี utm params | fields ไม่ส่ง, DB columns เป็น null | N/A |
| UTM มี space/ตัวพิมพ์ใหญ่ | utm_source= Google Ads | เก็บเป็น "google ads" (lowercase+trim) | N/A |
| Custom date range | user เลือก from=2026-01-01 to=2026-01-31 | ทุก analytics query ใช้ from/to ที่เลือก | N/A |
| from > to | user เลือก from หลัง to | ป้องกันที่ UI — from ต้อง <= to | แสดง validation ไม่ให้ submit |
| to > วันนี้ | user เลือกวันอนาคต | จำกัด to ไม่เกินวันนี้ | N/A |

</frozen-after-approval>

## Code Map

- `packages/tracker/src/index.ts` -- เพิ่ม UTM extraction จาก window.location.search
- `packages/shared/src/types/events.ts` -- เพิ่ม utm_source/medium/campaign ใน EventPayload + EnrichedEvent
- `packages/api/src/routes/collect.ts` -- เพิ่ม utm fields ใน Zod schema (optional)
- `packages/api/src/services/buffer.ts` -- ตรวจว่า utm fields ถูก pass ไปกับ batch insert
- `docker/init.sql` -- เพิ่ม 3 คอลัมน์ + index
- `packages/api/src/db/prisma/schema.prisma` -- เพิ่ม 3 fields ใน Event model
- `packages/api/src/routes/analytics.ts` -- เพิ่ม /sources/utm endpoint
- `packages/dashboard/src/pages/Sources.tsx` -- เพิ่ม UTM breakdown tab
- `packages/dashboard/src/hooks/useAnalytics.ts` -- เพิ่ม useUtmSources hook
- `packages/dashboard/src/context/DateRangeContext.tsx` -- รองรับ custom range
- `packages/dashboard/src/components/TopBar.tsx` -- เพิ่ม DateRangePicker
- `packages/dashboard/src/components/DateRangePicker.tsx` -- component ใหม่

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/types/events.ts` -- เพิ่ม utm_source?, utm_medium?, utm_campaign? ใน EventPayload + EnrichedEvent
- [x] `packages/tracker/src/index.ts` -- เพิ่ม extractUtmParams() อ่าน URLSearchParams แล้วใส่ใน payload
- [x] `docker/init.sql` -- เพิ่ม ALTER TABLE events ADD COLUMN utm_source/utm_medium/utm_campaign VARCHAR(255) + composite index
- [x] `packages/api/src/db/prisma/schema.prisma` -- เพิ่ม 3 optional String fields ใน Event model
- [x] `packages/api/src/routes/collect.ts` -- เพิ่ม utm fields ใน Zod schema (optional, lowercase+trim transform)
- [x] `packages/api/src/services/buffer.ts` -- ตรวจว่า utm fields ถูก include ใน Redis buffer + batch insert
- [x] `packages/api/src/routes/analytics.ts` -- เพิ่ม GET /analytics/sources/utm endpoint ที่ group by utm_source/medium/campaign
- [x] `packages/dashboard/src/hooks/useAnalytics.ts` -- เพิ่ม useUtmSources hook
- [x] `packages/dashboard/src/pages/Sources.tsx` -- เพิ่ม UTM tab แสดงตาราง utm_source/medium/campaign + จำนวน visitors
- [x] `packages/dashboard/src/context/DateRangeContext.tsx` -- เพิ่ม setCustomRange(from, to) + preset 'custom'
- [x] `packages/dashboard/src/components/DateRangePicker.tsx` -- สร้าง component ใหม่ — 2 input[type=date] + ปุ่ม Apply
- [x] `packages/dashboard/src/components/TopBar.tsx` -- รวม DateRangePicker เข้า TopBar ข้าง timezone picker

**Acceptance Criteria:**
- Given URL มี utm_source=newsletter&utm_medium=email&utm_campaign=march, when pageview ถูก track, then DB row มี 3 UTM columns ครบ (lowercase)
- Given Sources page, when คลิก UTM tab, then แสดงตาราง breakdown ตาม utm_source พร้อมจำนวน visitors
- Given TopBar, when คลิก date picker แล้วเลือก custom range, then ทุกหน้า dashboard แสดงข้อมูลตาม range ที่เลือก
- Given custom date range เลือก from > to, then UI ป้องกันไม่ให้ submit

## Verification

**Commands:**
- `pnpm --filter tracker build && gzip -c packages/tracker/dist/tracker.min.js | wc -c` -- expected: < 5120 bytes
- `pnpm test` -- expected: all tests pass
- `docker compose up -d && pnpm --filter api dev` -- expected: API starts without errors

**Manual checks:**
- เปิด Sources page → คลิก UTM tab → ต้องแสดงตาราง (อาจว่างถ้ายังไม่มี data)
- เปิด TopBar → date picker → เลือก custom range → KPI cards + charts ต้อง update ตาม range

## Suggested Review Order

**UTM Tracking — Data Flow (tracker → API → DB → dashboard)**

- Entry point: tracker extracts UTM from URL query string, lowercased+trimmed
  [`index.ts:184`](../../packages/tracker/src/index.ts#L184)

- Shared types define utm_source/medium/campaign as optional fields
  [`events.ts:59`](../../packages/shared/src/types/events.ts#L59)

- Zod schema validates + transforms empty strings to undefined
  [`collect.ts:61`](../../packages/api/src/routes/collect.ts#L61)

- Buffer includes UTM fields in Redis → PG batch insert
  [`buffer.ts:68`](../../packages/api/src/services/buffer.ts#L68)

- DB schema: 3 VARCHAR(255) columns + partial composite index
  [`init.sql:100`](../../docker/init.sql#L100)

- Prisma model mirrors DB columns
  [`schema.prisma:63`](../../packages/api/src/db/prisma/schema.prisma#L63)

**UTM Tracking — Analytics Endpoint + UI**

- API endpoint groups by utm_source/medium/campaign, counts distinct sessions
  [`analytics.ts:452`](../../packages/api/src/routes/analytics.ts#L452)

- UtmStat type defines API response shape
  [`analytics.ts:313`](../../packages/shared/src/types/analytics.ts#L313)

- React Query hook wraps the endpoint
  [`useAnalytics.ts:114`](../../packages/dashboard/src/hooks/useAnalytics.ts#L114)

- Sources page: UTM tab with breakdown table
  [`Sources.tsx:285`](../../packages/dashboard/src/pages/Sources.tsx#L285)

**Custom Date Range Picker**

- Context extended with 'custom' preset + setCustomRange()
  [`DateRangeContext.tsx:22`](../../packages/dashboard/src/context/DateRangeContext.tsx#L22)

- DateRangePicker: 2x date inputs + validation + click-outside close
  [`DateRangePicker.tsx:7`](../../packages/dashboard/src/components/DateRangePicker.tsx#L7)

- TopBar integrates the picker next to timezone selector
  [`TopBar.tsx:37`](../../packages/dashboard/src/components/TopBar.tsx#L37)

- DatePresets updated to work with new Exclude<DatePreset, 'custom'> type
  [`DatePresets.tsx:6`](../../packages/dashboard/src/components/DatePresets.tsx#L6)

- Overview.tsx fallback calculates rangedays from custom range dates
  [`Overview.tsx:123`](../../packages/dashboard/src/pages/Overview.tsx#L123)

---
title: 'Export CSV — ปุ่ม Export ในแต่ละหน้า dashboard'
type: 'feature'
created: '2026-03-27'
status: 'done'
baseline_commit: 'eecf5dd'
context: ['docs/UXUI.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** ผู้ใช้ไม่สามารถ export ข้อมูลที่แสดงบน dashboard ออกมาใช้ต่อภายนอกได้ — ต้อง copy-paste ทีละแถว หรือเขียน query เอง

**Approach:** เพิ่ม ExportButton component + CSV utility ฝั่ง client — ปุ่มวางในแต่ละหน้าที่มีข้อมูลตาราง กดแล้ว download CSV จากข้อมูลที่โหลดอยู่แล้ว ไม่ต้องเรียก API เพิ่ม

## Boundaries & Constraints

**Always:**
- ใช้ข้อมูลจาก React Query cache ที่โหลดอยู่แล้ว — ไม่สร้าง API endpoint ใหม่
- CSV ใช้ UTF-8 with BOM (Excel compatibility)
- ชื่อไฟล์: `{page}-{site}-{dateRange}.csv`
- ปุ่ม Export ใช้ icon Download จาก lucide-react ตามสไตล์ CopyButton/RefreshButton

**Ask First:**
- หากต้องเปลี่ยน layout ของหน้าที่ไม่มีพื้นที่วางปุ่ม

**Never:**
- ไม่ export ข้อมูล realtime (active visitors, recent events)
- ไม่สร้าง server-side export endpoint
- ไม่เพิ่ม dependency ภายนอกสำหรับ CSV generation

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Happy path | ข้อมูลโหลดแล้ว กดปุ่ม Export | Download CSV ไฟล์ทันที | N/A |
| Loading state | ข้อมูลยังโหลดอยู่ | ปุ่ม disabled + spinner | N/A |
| Empty data | ไม่มีข้อมูลในช่วงเวลาที่เลือก | ปุ่ม disabled | N/A |
| Multi-tab page | Sources มีหลาย tab (sources/utm/devices/geo) | Export เฉพาะ tab ที่กำลังแสดง | N/A |
| Special chars | URL หรือ referrer มีเครื่องหมายจุลภาค | Escape ด้วย double-quote ตาม RFC 4180 | N/A |

</frozen-after-approval>

## Code Map

- `packages/dashboard/src/lib/csv.ts` -- NEW: CSV generation utility (arrayToCSV, downloadCSV)
- `packages/dashboard/src/components/ExportButton.tsx` -- NEW: Reusable export button component
- `packages/dashboard/src/pages/Overview.tsx` -- เพิ่ม ExportButton สำหรับ timeseries data
- `packages/dashboard/src/pages/Pages.tsx` -- เพิ่ม ExportButton สำหรับ page stats table
- `packages/dashboard/src/pages/Sources.tsx` -- เพิ่ม ExportButton per active tab
- `packages/dashboard/src/pages/Engagement.tsx` -- เพิ่ม ExportButton per active tab
- `packages/dashboard/src/pages/Funnels.tsx` -- เพิ่ม ExportButton สำหรับ funnel steps
- `packages/dashboard/src/pages/Journeys.tsx` -- เพิ่ม ExportButton สำหรับ sessions table

## Tasks & Acceptance

**Execution:**
- [x] `packages/dashboard/src/lib/csv.ts` -- สร้าง utility: `arrayToCSV(headers, rows)` return CSV string + `downloadCSV(csv, filename)` trigger download ด้วย Blob + anchor click
- [x] `packages/dashboard/src/components/ExportButton.tsx` -- สร้าง component รับ props: `data`, `headers`, `filename`, `disabled` — ใช้สไตล์เดียวกับ RefreshButton + icon Download
- [x] `packages/dashboard/src/pages/Pages.tsx` -- เพิ่ม ExportButton ส่ง page stats data
- [x] `packages/dashboard/src/pages/Sources.tsx` -- เพิ่ม ExportButton แต่ละ tab ส่งข้อมูล tab ที่ active
- [x] `packages/dashboard/src/pages/Engagement.tsx` -- เพิ่ม ExportButton แต่ละ tab
- [x] `packages/dashboard/src/pages/Funnels.tsx` -- เพิ่ม ExportButton ส่ง funnel step data
- [x] `packages/dashboard/src/pages/Journeys.tsx` -- เพิ่ม ExportButton ส่ง sessions data
- [x] `packages/dashboard/src/pages/Overview.tsx` -- เพิ่ม ExportButton ส่ง timeseries data

**Acceptance Criteria:**
- Given หน้า Pages มีข้อมูล, when กด Export, then browser download ไฟล์ CSV ที่เปิดใน Excel ได้ถูกต้อง
- Given หน้า Sources อยู่ tab UTM, when กด Export, then CSV มีเฉพาะข้อมูล UTM ไม่ปนข้อมูล tab อื่น
- Given ข้อมูลยังโหลดอยู่, when ดูปุ่ม Export, then ปุ่ม disabled ไม่กดได้
- Given referrer URL มีเครื่องหมายจุลภาค, when export, then CSV escape ถูกต้องตาม RFC 4180

## Verification

**Commands:**
- `pnpm --filter dashboard build` -- expected: build สำเร็จไม่มี type error
- `pnpm test` -- expected: test ที่มีอยู่ยังผ่านทุกตัว

**Manual checks:**
- กด Export ในหน้า Pages → เปิด CSV ใน text editor → ตรวจ UTF-8 BOM + comma-separated + quoted fields

## Suggested Review Order

**CSV Core — utility + component**

- RFC 4180 escape + CSV injection guard + sanitizeFilename — the heart of the feature
  [`csv.ts:1`](../../packages/dashboard/src/lib/csv.ts#L1)

- ExportButton component — reusable button matching RefreshButton pattern
  [`ExportButton.tsx:1`](../../packages/dashboard/src/components/ExportButton.tsx#L1)

**Page integrations — tab-aware export**

- Sources page — tab-aware getExportData switch for 4 data types
  [`Sources.tsx:135`](../../packages/dashboard/src/pages/Sources.tsx#L135)

- Engagement page — scroll vs clicks tab switching
  [`Engagement.tsx:327`](../../packages/dashboard/src/pages/Engagement.tsx#L327)

**Page integrations — single-data export**

- Pages — page stats table export
  [`Pages.tsx:23`](../../packages/dashboard/src/pages/Pages.tsx#L23)

- Funnels — per-funnel step data export inside FunnelView
  [`Funnels.tsx:343`](../../packages/dashboard/src/pages/Funnels.tsx#L343)

- Journeys — sessions table export
  [`Journeys.tsx:195`](../../packages/dashboard/src/pages/Journeys.tsx#L195)

- Overview — timeseries data export
  [`Overview.tsx:59`](../../packages/dashboard/src/pages/Overview.tsx#L59)

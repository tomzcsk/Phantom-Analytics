---
title: 'v1.4 Sprint 3 — Landing/Exit Pages + Date Comparison'
type: 'feature'
created: '2026-03-27'
status: 'done'
baseline_commit: 'bb849c6'
context: ['docs/UXUI.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** ผู้ใช้ไม่รู้ว่าคนเข้าเว็บจากหน้าไหนบ่อยสุด/ออกจากหน้าไหนบ่อยสุด และไม่สามารถเปรียบเทียบแนวโน้มกับช่วงก่อนหน้าได้

**Approach:** (1) สร้าง API + UI แสดง Landing/Exit pages จาก sessions table เป็น tab ใหม่ในหน้า Pages (2) แก้ timeseries API ให้ส่ง previous period data + TrendChart แสดง 2 เส้นเปรียบเทียบ

## Boundaries & Constraints

**Always:**
- Landing/Exit query ใช้ sessions table (entry_page, exit_page) ไม่ใช่ events
- Timeseries comparison ใช้ `previousPeriod()` helper ที่มีอยู่แล้ว
- เส้นเปรียบเทียบใช้ dashed stroke + สีจาง เพื่อแยกออกจากเส้นหลัก
- TrendChart comparison เป็น toggle (ปิดเป็นค่าเริ่มต้น)

**Ask First:**
- หากต้องเปลี่ยน response shape ของ timeseries endpoint (breaking change)

**Never:**
- ไม่สร้าง page ใหม่ — ใช้ tab ใน Pages.tsx
- ไม่แก้ existing TimeseriesPoint type — เพิ่ม field ใหม่หรือ wrapper

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Landing pages | sessions มี entry_page | ตาราง: URL, จำนวน sessions, % | N/A |
| Exit pages | sessions มี exit_page | ตาราง: URL, จำนวน sessions, % | N/A |
| No sessions | ไม่มี session ในช่วง | แสดง empty state | N/A |
| null entry/exit | session ไม่มี entry_page | ไม่รวมใน result | N/A |
| Comparison on | toggle เปิด | กราฟแสดง 2 เส้น + tooltip ทั้ง 2 ค่า | N/A |
| Comparison off | toggle ปิด (default) | กราฟแสดงเส้นเดียวเหมือนเดิม | N/A |
| 1-day range | range = 1 วัน, comparison = 1 วันก่อนหน้า | previous period = วันก่อน | N/A |

</frozen-after-approval>

## Code Map

- `packages/api/src/routes/analytics.ts` -- เพิ่ม GET /analytics/entry-exit-pages + แก้ timeseries ให้รองรับ compare
- `packages/shared/src/types/analytics.ts` -- เพิ่ม EntryExitStat type + TimeseriesResponse wrapper
- `packages/dashboard/src/hooks/useAnalytics.ts` -- เพิ่ม useEntryExitPages hook + แก้ useTimeseries
- `packages/dashboard/src/pages/Pages.tsx` -- เพิ่ม tab Landing/Exit + ตาราง
- `packages/dashboard/src/components/TrendChart.tsx` -- รองรับ comparisonData prop + toggle + 2 เส้น

## Tasks & Acceptance

**Execution:**
- [x] `packages/shared/src/types/analytics.ts` -- เพิ่ม EntryExitStat { url, sessions, percentage } + TimseriesResponse { current, previous? }
- [x] `packages/api/src/routes/analytics.ts` -- เพิ่ม GET /analytics/entry-exit-pages (query sessions GROUP BY entry_page/exit_page) + แก้ timeseries endpoint ส่ง { current, previous } เมื่อมี compare=true
- [x] `packages/dashboard/src/hooks/useAnalytics.ts` -- เพิ่ม useEntryExitPages + แก้ useTimeseries รับ compare param
- [x] `packages/dashboard/src/components/TrendChart.tsx` -- เพิ่ม comparisonData prop + toggle ปุ่ม "เปรียบเทียบ" + เส้น dashed
- [x] `packages/dashboard/src/pages/Pages.tsx` -- เพิ่ม tab switcher (หน้าเว็บ/หน้าเข้า/หน้าออก) + ตารางสำหรับ entry/exit
- [x] `packages/dashboard/src/pages/Overview.tsx` -- ส่ง compare param ไปยัง useTimeseries + ส่ง comparisonData ไป TrendChart

**Acceptance Criteria:**
- Given sessions มีข้อมูล, when เลือก tab "หน้าเข้า", then แสดงตาราง landing pages เรียงตาม sessions มากสุด พร้อม %
- Given เปิด toggle เปรียบเทียบ, when ดูกราฟ, then แสดง 2 เส้น (ปัจจุบัน solid + ก่อนหน้า dashed) พร้อม tooltip ทั้ง 2 ค่า
- Given toggle เปรียบเทียบปิด (default), when ดูกราฟ, then แสดงเส้นเดียวเหมือนเดิม

## Verification

**Commands:**
- `cd packages/api && npx tsc --noEmit` -- expected: no type errors
- `cd packages/dashboard && npx tsc --noEmit` -- expected: no type errors
- `pnpm test` -- expected: existing tests pass

## Suggested Review Order

**Shared types — data contracts**

- New types: EntryExitStat, EntryExitPagesResponse, TimeseriesResponse
  [`analytics.ts:326`](../../packages/shared/src/types/analytics.ts#L326)

**API — new endpoint + timeseries refactor**

- Entry/exit pages endpoint: sessions GROUP BY entry_page/exit_page
  [`analytics.ts:860`](../../packages/api/src/routes/analytics.ts#L860)

- Timeseries refactored into fetchTimeseries() + compare param
  [`analytics.ts:211`](../../packages/api/src/routes/analytics.ts#L211)

**Dashboard — chart comparison**

- TrendChart: ComposedChart with Area + dashed Line, toggle button
  [`TrendChart.tsx:80`](../../packages/dashboard/src/components/TrendChart.tsx#L80)

- Overview passes compare=true + comparisonData to TrendChart
  [`Overview.tsx:41`](../../packages/dashboard/src/pages/Overview.tsx#L41)

**Dashboard — landing/exit pages**

- Pages.tsx: tab switcher + EntryExitTable component
  [`Pages.tsx:13`](../../packages/dashboard/src/pages/Pages.tsx#L13)

- Hooks: useEntryExitPages + useTimeseries with compare
  [`useAnalytics.ts:35`](../../packages/dashboard/src/hooks/useAnalytics.ts#L35)

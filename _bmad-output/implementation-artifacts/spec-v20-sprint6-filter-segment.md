---
title: 'v2.0 Sprint 6 — Filter & Segment'
type: 'feature'
created: '2026-03-27'
status: 'done'
baseline_commit: 'd5a976a'
context: ['docs/UXUI.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** ผู้ใช้ดูข้อมูลได้แค่ aggregate ทั้งหมด — ไม่สามารถกรองดูเฉพาะ mobile, เฉพาะประเทศไทย, หรือเฉพาะ organic traffic ได้

**Approach:** สร้าง FilterContext + FilterBar component — เลือก country/device/source → ทุก analytics hook ส่ง filter params → API เพิ่ม WHERE conditions ตาม filter

## Boundaries & Constraints

**Always:**
- Filter เก็บใน URL query params (เพื่อ shareable links + back button ทำงาน)
- ทุก analytics endpoint รองรับ optional filter params: country_code, device_type, source
- FilterBar แสดงด้านบนใน TopBar (ถัดจาก DatePresets)
- Filter chips แสดงให้เห็นว่ากำลังกรองอะไรอยู่ กดลบได้
- Clear all filters ปุ่มเดียว

**Ask First:**
- หากต้องเปลี่ยน TopBar layout อย่างมาก

**Never:**
- ไม่เก็บ filter ใน localStorage (URL params only)
- ไม่สร้าง saved segments (v2 scope — filter เท่านั้น)

</frozen-after-approval>

## Code Map

- `packages/api/src/routes/analytics.ts` -- เพิ่ม filter params ใน schema + WHERE clauses ทุก endpoint
- `packages/dashboard/src/context/FilterContext.tsx` -- NEW: filter state จาก URL params
- `packages/dashboard/src/components/FilterBar.tsx` -- NEW: dropdown selectors + active chips
- `packages/dashboard/src/components/TopBar.tsx` -- เพิ่ม FilterBar
- `packages/dashboard/src/hooks/useAnalytics.ts` -- ทุก hook ส่ง filter params

## Tasks & Acceptance

**Execution:**
- [x] `packages/api/src/routes/analytics.ts` -- เพิ่ม country_code?, device_type?, source? ใน siteRangeSchema + เพิ่ม WHERE conditions ใน overview, timeseries, pages, sources, devices, geo, scroll-depth, clicks, entry-exit endpoints
- [x] `packages/dashboard/src/context/FilterContext.tsx` -- FilterProvider อ่าน/เขียน URL search params (country, device, source)
- [x] `packages/dashboard/src/components/FilterBar.tsx` -- 3 dropdowns (ประเทศ/อุปกรณ์/แหล่งที่มา) + active chips + clear all
- [x] `packages/dashboard/src/components/TopBar.tsx` -- เพิ่ม FilterBar component
- [x] `packages/dashboard/src/hooks/useAnalytics.ts` -- แก้ rangeParams ให้รวม filters + ทุก hook ใช้ useFilter

**Acceptance Criteria:**
- Given เลือก filter country=TH, when ดู Overview, then KPIs + chart แสดงเฉพาะ traffic จากไทย
- Given เลือก filter device=mobile, when ดูหน้า Pages, then แสดงเฉพาะ page stats จาก mobile
- Given มี filter active, when ดู FilterBar, then แสดง chip "ไทย" กด X ลบได้
- Given กด "ล้างทั้งหมด", when ดู dashboard, then กลับมาแสดงข้อมูลทั้งหมด

## Verification

**Commands:**
- `cd packages/api && npx tsc --noEmit` -- expected: no type errors (excluding tests)
- `cd packages/dashboard && npx tsc --noEmit` -- expected: no type errors
- `pnpm test` -- expected: existing tests pass

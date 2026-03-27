# Deferred Work — v1.3 Sprint 2

## Deferred from: Export CSV spec (2026-03-27)

- **Data Retention API** — API + UI ตั้งค่าจำนวนวันเก็บข้อมูล → cron job ลบ events เก่า
- ~~**CSP Guide**~~ — done (docs/CSP_GUIDE.md)

## Deferred from: Data Retention spec (2026-03-27)

- **Soft-deleted site cleanup** — sites ที่ถูก soft-delete ยังมีข้อมูลค้างอยู่ ควร cleanup อัตโนมัติหลัง 30 วัน

## Deferred from: Sprint 4 review (2026-03-27)

- **Refactor query helpers** — tzBounds/previousPeriod/pctChange duplicated between analytics.ts and shareLinks.ts → extract to shared utility
- **Expired share links cleanup** — เพิ่มลบ expired share_links ใน data retention loop
- **Public endpoint query optimization** — overview query ใน shareLinks.ts ใช้ JOIN events+sessions ซึ่งหนัก ควร refactor ใช้ sessions table ตรงๆ

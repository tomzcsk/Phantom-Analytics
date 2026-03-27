---
title: 'v1.4 Sprint 5b — Password Reset + Account Lockout'
type: 'feature'
created: '2026-03-27'
status: 'done'
baseline_commit: '2cf9a3a'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** ผู้ใช้ที่ลืม password ต้องให้ admin reset ให้ — ไม่มีระบบ self-service และไม่มี brute-force protection ถ้าใครลอง login ผิดซ้ำๆ ก็ไม่ถูกล็อค

**Approach:** (1) Password reset ผ่าน token — admin สร้าง reset link ให้ผู้ใช้ (self-hosted ไม่มี email) ผู้ใช้เปิด link ตั้ง password ใหม่ (2) Account lockout — ล็อคบัญชี 15 นาทีหลัง login ผิด 5 ครั้ง reset counter เมื่อ login สำเร็จ

## Boundaries & Constraints

**Always:**
- Reset token ใช้ crypto random (32 bytes hex) หมดอายุ 1 ชั่วโมง
- Admin สร้าง reset link ผ่าน User Management page (ไม่มี email — self-hosted)
- Lockout ใช้ field บน User model (failed_login_attempts + locked_until)
- Reset counter เมื่อ login สำเร็จ หรือเมื่อหมดเวลา lockout
- แสดงเวลาที่เหลือเมื่อบัญชีถูกล็อค

**Ask First:**
- หากต้องเพิ่ม email system สำหรับส่ง reset link

**Never:**
- ไม่บอกว่า username ถูกต้องหรือไม่ตอน login fail (ป้องกัน user enumeration)
- ไม่ล็อค admin account ถาวร — ต้อง auto-unlock หลัง 15 นาที

</frozen-after-approval>

## Code Map

- `packages/api/src/db/prisma/schema.prisma` -- เพิ่ม failed_login_attempts, locked_until, password_reset_token, password_reset_expires
- `docker/init.sql` -- ALTER TABLE users ADD COLUMN
- `packages/api/src/routes/auth.ts` -- แก้ login (lockout check + increment) + POST /auth/reset-password/request + POST /auth/reset-password/confirm
- `packages/dashboard/src/pages/UserManagement.tsx` -- เพิ่มปุ่ม "สร้าง Reset Link" per user
- `packages/dashboard/src/pages/ResetPassword.tsx` -- NEW: หน้า public ตั้ง password ใหม่
- `packages/dashboard/src/App.tsx` -- เพิ่ม /reset-password route

## Tasks & Acceptance

**Execution:**
- [x] `packages/api/src/db/prisma/schema.prisma` + `docker/init.sql` -- เพิ่ม 4 fields ใน User model
- [x] `packages/api/src/routes/auth.ts` -- login: check locked_until → increment failed_attempts → lock after 5 → reset on success + POST /auth/reset-password/request (admin-only, return token+link) + POST /auth/reset-password/confirm (public, set new password)
- [x] `packages/dashboard/src/pages/UserManagement.tsx` -- ปุ่ม "Reset Password" per user → แสดง link ใน modal
- [x] `packages/dashboard/src/pages/ResetPassword.tsx` -- หน้า public: กรอก password ใหม่ 2 ครั้ง
- [x] `packages/dashboard/src/App.tsx` -- เพิ่ม /reset-password route (no AuthGuard)

**Acceptance Criteria:**
- Given login ผิด 5 ครั้ง, when ลอง login ครั้งที่ 6, then ได้ error "บัญชีถูกล็อค" พร้อมเวลาที่เหลือ
- Given บัญชีถูกล็อค 15 นาที, when รอ 15 นาทีแล้ว login ถูก, then เข้าได้ + counter reset
- Given admin สร้าง reset link, when ผู้ใช้เปิด link, then เห็นฟอร์มตั้ง password ใหม่
- Given reset token หมดอายุ, when เปิด link, then แสดง "ลิงก์หมดอายุ"

## Verification

**Commands:**
- `cd packages/api && npx tsc --noEmit` -- expected: no type errors (excluding tests)
- `cd packages/dashboard && npx tsc --noEmit` -- expected: no type errors
- `pnpm test` -- expected: existing tests pass

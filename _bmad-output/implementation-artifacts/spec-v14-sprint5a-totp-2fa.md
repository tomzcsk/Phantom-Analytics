---
title: 'v1.4 Sprint 5a — Two-Factor Authentication (TOTP)'
type: 'feature'
created: '2026-03-27'
status: 'done'
baseline_commit: '59ee946'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Dashboard ไม่มี 2FA — ถ้า password หลุด ใครก็เข้าได้ทันที

**Approach:** เพิ่ม TOTP 2FA (Google Authenticator / Authy) — ตอน login ถ้าเปิด 2FA ไว้ ต้องกรอก code 6 หลักก่อนได้ JWT — Settings เพิ่ม card เปิด/ปิด 2FA พร้อม QR code + backup codes

## Boundaries & Constraints

**Always:**
- ใช้ `otplib` สำหรับ TOTP (lighter than speakeasy)
- login flow: password correct + 2FA enabled → 202 + temporary token → verify TOTP → full JWT
- Backup codes (8 ตัว) เก็บเป็น hashed array สำหรับ recovery
- QR code generate ฝั่ง client จาก otpauth URI (ไม่ต้อง qrcode library บน server)

**Ask First:**
- หากต้องเปลี่ยน JWT payload structure

**Never:**
- ไม่เก็บ TOTP secret เป็น plaintext ใน API response หลัง setup เสร็จ
- ไม่บังคับ 2FA ทุกคน — เป็น opt-in per user

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Login + 2FA off | username + password ถูก | 200 + JWT (เหมือนเดิม) | N/A |
| Login + 2FA on | username + password ถูก | 202 + { requires_totp, temp_token } | N/A |
| Verify TOTP | temp_token + code 6 หลัก ถูก | 200 + JWT | N/A |
| Wrong TOTP | temp_token + code ผิด | 401 "รหัสไม่ถูกต้อง" | N/A |
| Expired temp_token | temp_token หมดอายุ (5 นาที) | 401 "token หมดอายุ" | N/A |
| Use backup code | temp_token + backup code | 200 + JWT, backup code ถูกใช้แล้ว | N/A |
| Enable 2FA | POST /auth/2fa/setup | { secret, otpauth_uri, backup_codes } | N/A |
| Confirm 2FA | POST /auth/2fa/confirm + code | 200, totp_enabled = true | 400 if code wrong |
| Disable 2FA | DELETE /auth/2fa + password | 200, totp_enabled = false | 401 if password wrong |

</frozen-after-approval>

## Code Map

- `packages/api/src/db/prisma/schema.prisma` -- เพิ่ม totp_secret, totp_enabled, backup_codes ใน User
- `docker/init.sql` -- ALTER TABLE users ADD COLUMN
- `packages/api/src/routes/auth.ts` -- แก้ login flow + เพิ่ม verify-totp, 2fa/setup, 2fa/confirm, 2fa (DELETE)
- `packages/dashboard/src/pages/Login.tsx` -- เพิ่ม TOTP input step หลัง password
- `packages/dashboard/src/context/AuthContext.tsx` -- handle 202 response + verify flow
- `packages/dashboard/src/pages/Settings.tsx` -- เพิ่ม 2FA card (enable/disable + QR code)

## Tasks & Acceptance

**Execution:**
- [x] Install `otplib` dependency ใน packages/api
- [x] `packages/api/src/db/prisma/schema.prisma` + `docker/init.sql` -- เพิ่ม totp_secret, totp_enabled, backup_codes fields
- [x] `packages/api/src/routes/auth.ts` -- แก้ login: return 202 if 2FA on + POST /auth/verify-totp + POST /auth/2fa/setup + POST /auth/2fa/confirm + DELETE /auth/2fa
- [x] `packages/dashboard/src/context/AuthContext.tsx` -- handle 202 + tempToken state + verifyTotp function
- [x] `packages/dashboard/src/pages/Login.tsx` -- เพิ่ม TOTP code input step
- [x] `packages/dashboard/src/pages/Settings.tsx` -- เพิ่ม TwoFactorCard (setup QR + backup codes + disable)

**Acceptance Criteria:**
- Given user เปิด 2FA แล้ว, when login ด้วย password ถูก, then ต้องกรอก TOTP code ก่อนเข้า dashboard
- Given TOTP code ถูก, when verify, then ได้ JWT เข้า dashboard ได้
- Given user ไม่เปิด 2FA, when login, then เข้าได้เลยเหมือนเดิม
- Given Settings, when กด "เปิด 2FA", then เห็น QR code + backup codes

## Verification

**Commands:**
- `cd packages/api && npx tsc --noEmit` -- expected: no type errors (excluding tests)
- `cd packages/dashboard && npx tsc --noEmit` -- expected: no type errors
- `pnpm test` -- expected: existing tests pass

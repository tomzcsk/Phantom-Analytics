# Phantom Analytics — Deployment Guide

> คู่มือ deploy สำหรับทีม Infrastructure
> อ่านจบแล้วสามารถ deploy ได้เลยโดยไม่ต้องรู้จัก codebase

---

## 1. System Requirements

| Resource | Minimum | Recommended (>1M events/month) |
|----------|---------|-------------------------------|
| CPU | 2 cores | 4 cores |
| RAM | 2 GB | 4 GB |
| Disk | 20 GB SSD | 50 GB+ SSD |
| OS | Linux (Ubuntu 22.04+, Debian 12+) | Same |
| Docker | 24.0+ | Latest stable |
| Docker Compose | v2.20+ | Latest stable |

> **Disk estimation:** ~100 bytes/event after TimescaleDB compression.
> 1M events/month = ~100 MB/month = ~1.2 GB/year.

---

## 2. Architecture Overview

```
Internet
  │
  ▼ (port 80/443)
┌──────────────────────────────┐
│  Nginx (reverse proxy)       │
│  - SSL termination           │
│  - /api/*  → API :3001       │
│  - /*      → Dashboard :5173 │
└──────┬───────────┬───────────┘
       ▼           ▼
┌────────────┐ ┌────────────────┐
│ API        │ │ Dashboard      │
│ (Fastify)  │ │ (React + Vite) │
│ port 3001  │ │ port 5173      │
└──┬─────┬───┘ └────────────────┘
   │     │
   ▼     ▼
┌──────┐ ┌───────────────────┐
│Redis │ │ PostgreSQL 16     │
│ 6379 │ │ + TimescaleDB     │
└──────┘ │ port 5432         │
         └───────────────────┘
```

ทั้งหมดรันผ่าน Docker Compose — ไม่ต้องติดตั้ง Node.js บน host

---

## 3. Quick Deploy (5 นาที)

```bash
# 1. Clone repository
git clone <repo-url> /opt/phantom-analytics
cd /opt/phantom-analytics

# 2. สร้าง .env จาก template
cp .env.example .env

# 3. ตั้งค่า secrets (สำคัญมาก — ห้ามใช้ค่า default)
sed -i "s|change_me_to_a_32_character_random_string_here|$(openssl rand -hex 32)|" .env
sed -i "s|DASHBOARD_PASS=changeme|DASHBOARD_PASS=$(openssl rand -base64 16)|" .env

# 4. Start ทุก service
docker compose -f docker/docker-compose.yml up -d

# 5. ตรวจสอบว่าทุก service healthy
docker compose -f docker/docker-compose.yml ps
```

เมื่อทุก container ขึ้น status `healthy` แล้ว เปิด `http://<server-ip>` จะเห็น dashboard

---

## 4. Environment Variables

แก้ไขไฟล์ `.env` ที่ root ของโปรเจกต์:

| Variable | ค่า Default | Production | คำอธิบาย |
|----------|------------|------------|---------|
| `DATABASE_URL` | `postgresql://phantom:phantom@localhost:5432/phantom_analytics` | เปลี่ยน password | Connection string สำหรับ PostgreSQL |
| `REDIS_URL` | `redis://localhost:6379` | ใช้ค่าเดิมได้ | Connection string สำหรับ Redis |
| `API_PORT` | `3001` | ใช้ค่าเดิมได้ | Port ภายในของ API server |
| `JWT_SECRET` | placeholder | **ต้องเปลี่ยน** | ใช้ `openssl rand -hex 32` สร้างค่าใหม่ |
| `NODE_ENV` | `development` | `production` | ตั้งเป็น production |
| `ALLOWED_ORIGINS` | (ไม่ได้ตั้ง) | `https://yoursite.com` | CORS origins, คั่นด้วย comma |

### เปลี่ยน Database Password

ถ้าต้องการเปลี่ยน password ของ PostgreSQL ต้องแก้ **2 ที่ให้ตรงกัน**:

1. `.env` → `DATABASE_URL=postgresql://phantom:<NEW_PASSWORD>@...`
2. `docker/docker-compose.yml` → `POSTGRES_PASSWORD: <NEW_PASSWORD>`

> หลังเปลี่ยน password ต้อง **ลบ volume เก่า**แล้วสร้างใหม่ (ถ้าเป็นครั้งแรกไม่ต้อง):
> ```bash
> docker compose -f docker/docker-compose.yml down -v
> docker compose -f docker/docker-compose.yml up -d
> ```

---

## 5. SSL/TLS Setup

### Option A: Certbot (Let's Encrypt) — แนะนำ

```bash
# 1. ติดตั้ง certbot บน host
apt install certbot

# 2. หยุด nginx ชั่วคราว
docker compose -f docker/docker-compose.yml stop nginx

# 3. ขอ certificate
certbot certonly --standalone -d analytics.yoursite.com

# 4. Certificate จะอยู่ที่:
#    /etc/letsencrypt/live/analytics.yoursite.com/fullchain.pem
#    /etc/letsencrypt/live/analytics.yoursite.com/privkey.pem
```

### แก้ docker-compose.yml เพิ่ม volume สำหรับ cert

```yaml
nginx:
  volumes:
    - ./nginx.conf:/etc/nginx/nginx.conf:ro
    - /etc/letsencrypt:/etc/letsencrypt:ro    # เพิ่มบรรทัดนี้
```

### แก้ nginx.conf เพิ่ม HTTPS server block

เพิ่ม server block ใหม่ใน `docker/nginx.conf`:

```nginx
# Redirect HTTP → HTTPS
server {
    listen 80;
    server_name analytics.yoursite.com;
    return 301 https://$host$request_uri;
}

# HTTPS server
server {
    listen 443 ssl;
    server_name analytics.yoursite.com;

    ssl_certificate     /etc/letsencrypt/live/analytics.yoursite.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/analytics.yoursite.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    # ... (ย้าย location blocks ทั้งหมดจาก server block เดิมมาที่นี่)
}
```

### Option B: Cloudflare Proxy

ถ้าใช้ Cloudflare อยู่แล้ว ชี้ DNS มาที่ server แล้วเปิด Proxied (orange cloud) — SSL จะจัดการให้อัตโนมัติ ไม่ต้องแก้ nginx.conf

### Auto-renew

```bash
# เพิ่ม cron สำหรับ renew certificate อัตโนมัติ
echo "0 3 * * * certbot renew --quiet --deploy-hook 'docker compose -f /opt/phantom-analytics/docker/docker-compose.yml restart nginx'" | crontab -
```

---

## 6. Backup & Restore

### Backup PostgreSQL

```bash
# Backup ทั้ง database (รวม TimescaleDB metadata)
docker compose -f docker/docker-compose.yml exec -T postgres \
  pg_dump -U phantom -Fc phantom_analytics > backup_$(date +%Y%m%d_%H%M%S).dump
```

### Restore

```bash
# Restore จาก backup file
docker compose -f docker/docker-compose.yml exec -T postgres \
  pg_restore -U phantom -d phantom_analytics --clean --if-exists < backup_20260327_120000.dump
```

### Auto Backup (cron)

```bash
# Backup ทุกวัน 02:00 เก็บ 30 วัน
cat > /etc/cron.d/phantom-backup << 'EOF'
0 2 * * * root docker compose -f /opt/phantom-analytics/docker/docker-compose.yml exec -T postgres pg_dump -U phantom -Fc phantom_analytics > /opt/phantom-analytics/backups/backup_$(date +\%Y\%m\%d).dump && find /opt/phantom-analytics/backups -name "*.dump" -mtime +30 -delete
EOF

mkdir -p /opt/phantom-analytics/backups
```

### Redis

Redis ใช้เป็น buffer ชั่วคราวเท่านั้น — **ไม่ต้อง backup** ถ้า Redis หาย ข้อมูลที่ยังไม่ flush (ไม่เกิน 1 วินาที) จะหายไป ที่เหลือเก็บใน PostgreSQL อยู่แล้ว

---

## 7. Monitoring & Health Checks

### Health Endpoint

```bash
# ตรวจว่า API ทำงานปกติ
curl http://localhost/health
```

### ดู Logs

```bash
# ดู log ทุก service
docker compose -f docker/docker-compose.yml logs -f

# ดูเฉพาะ service
docker compose -f docker/docker-compose.yml logs -f api
docker compose -f docker/docker-compose.yml logs -f postgres
docker compose -f docker/docker-compose.yml logs -f nginx
```

### ตรวจ Resource Usage

```bash
docker stats --no-stream
```

### ตรวจ Database Size

```bash
docker compose -f docker/docker-compose.yml exec postgres \
  psql -U phantom -d phantom_analytics -c "
    SELECT
      pg_size_pretty(pg_database_size('phantom_analytics')) AS db_size,
      (SELECT count(*) FROM events) AS total_events,
      (SELECT count(*) FROM sites WHERE deleted_at IS NULL) AS active_sites;
  "
```

---

## 8. Update / Upgrade

```bash
cd /opt/phantom-analytics

# 1. Pull code ใหม่
git pull origin main

# 2. Rebuild และ restart
docker compose -f docker/docker-compose.yml up -d --build

# 3. ตรวจสอบ health
docker compose -f docker/docker-compose.yml ps
```

> Database migration จะรันอัตโนมัติตอน API container เริ่มทำงาน (Prisma migrate)

---

## 9. Production Hardening Checklist

- [ ] เปลี่ยน `JWT_SECRET` ด้วย `openssl rand -hex 32`
- [ ] เปลี่ยน PostgreSQL password (`POSTGRES_PASSWORD` + `DATABASE_URL`)
- [ ] ตั้งค่า `NODE_ENV=production`
- [ ] ตั้งค่า `ALLOWED_ORIGINS` เฉพาะ domain ที่ใช้จริง
- [ ] ตั้งค่า SSL/TLS (Section 5)
- [ ] ตั้ง auto backup (Section 6)
- [ ] ปิด port ที่ไม่จำเป็นด้วย firewall (เปิดแค่ 80, 443)
- [ ] เปิด TimescaleDB compression (uncomment ใน `docker/init.sql` บรรทัด 241-246)
- [ ] ตั้ง log rotation สำหรับ Docker logs:

```json
// /etc/docker/daemon.json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

---

## 10. Firewall Rules

เปิดเฉพาะ port ที่จำเป็น:

```bash
# UFW example
ufw default deny incoming
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP (redirect to HTTPS)
ufw allow 443/tcp   # HTTPS
ufw enable
```

> Port 3001 (API), 5173 (Dashboard), 5432 (PostgreSQL), 6379 (Redis) **ไม่ต้องเปิด** — Nginx proxy ให้อยู่แล้วและ container คุยกันผ่าน Docker network ภายใน

---

## 11. Scaling Notes

| Traffic | คำแนะนำ |
|---------|--------|
| < 1M events/month | Single server ตาม spec ด้านบนเพียงพอ |
| 1-10M events/month | เพิ่ม RAM เป็น 8 GB, เปิด TimescaleDB compression |
| > 10M events/month | แยก PostgreSQL ออกไป dedicated server, เพิ่ม Redis maxmemory |

---

## 12. Troubleshooting

| อาการ | สาเหตุที่พบบ่อย | แก้ไข |
|-------|---------------|------|
| Dashboard เปิดไม่ได้ | Container ยังไม่ healthy | `docker compose ps` ดู status, `docker compose logs dashboard` ดู error |
| API 502 Bad Gateway | API container crash | `docker compose logs api` ดู error, มักเป็น DB connection failed |
| Database connection refused | PostgreSQL ยังไม่พร้อม | รอ 30 วินาทีแล้วลองใหม่, ตรวจ `docker compose logs postgres` |
| SSE real-time ไม่ทำงาน | Nginx buffer ปิดไม่ถูก | ตรวจว่า nginx.conf มี `proxy_buffering off` ใน `/api/realtime/` block |
| Disk เต็ม | Event data โตเร็ว | เปิด TimescaleDB compression, ตั้ง retention policy |

---

## Contact

หากมีคำถามเกี่ยวกับ application logic หรือ codebase ติดต่อทีม Dev
หากมีคำถามเกี่ยวกับ infrastructure ดูเพิ่มเติมที่ `docker/docker-compose.yml` และ `docker/nginx.conf`

# CLAUDE.md — Phantom Analytics

> This file is the AI's primary orientation document. Read it fully before touching any code.
> Every decision in this project flows from here.

---

## Project Identity

**Name:** Phantom Analytics  
**Tagline:** Your data. Your server. Your rules.  
**Type:** Self-hosted, privacy-first web analytics platform  
**Stack:** Node.js + Fastify · PostgreSQL + TimescaleDB · Redis · React · Docker  
**Monorepo root:** `phantom-analytics/`

---

## Essential Files Map

Before writing any code, read the file relevant to your task:

| File | Purpose | Read when... |
|------|---------|--------------|
| `prd.md` | Product vision, features, constraints, success metrics | You need to understand *what* to build and *why* |
| `techstack.md` | Full architecture, every library choice with rationale | You're making any technical decision or adding a dependency |
| `UXUI.md` | Colors, typography, layout, components, interactions | You're touching the dashboard frontend |
| `features.json` | All 47 features with status, acceptance criteria, checkpoints | You're picking up a task or tracking progress |
| `CLAUDE.md` | This file — orientation, rules, patterns, philosophy | Always. First. |

---

## Repository Structure

```
phantom-analytics/
├── packages/
│   ├── tracker/          # Vanilla TS → tracker.js (< 5KB gzip)
│   │   ├── src/index.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   ├── api/              # Fastify backend (collector + analytics + SSE)
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── collect.ts    # POST /api/collect
│   │   │   │   ├── analytics.ts  # GET /api/analytics/*
│   │   │   │   ├── realtime.ts   # GET /api/realtime/stream (SSE)
│   │   │   │   ├── sites.ts      # CRUD /api/sites
│   │   │   │   └── funnels.ts    # CRUD /api/funnels
│   │   │   ├── services/
│   │   │   │   ├── geo.ts        # GeoIP lookup
│   │   │   │   ├── ua.ts         # UA parsing + bot detection
│   │   │   │   ├── buffer.ts     # Redis event buffer → PG batch write
│   │   │   │   └── realtime.ts   # Redis pub/sub → SSE bridge
│   │   │   ├── db/
│   │   │   │   ├── prisma/
│   │   │   │   │   └── schema.prisma
│   │   │   │   └── client.ts
│   │   │   └── server.ts
│   │   └── package.json
│   ├── dashboard/        # React 19 + Vite 6 + Tailwind 4
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   │   ├── Overview.tsx
│   │   │   │   ├── Realtime.tsx
│   │   │   │   ├── Pages.tsx
│   │   │   │   ├── Sources.tsx
│   │   │   │   ├── Funnels.tsx
│   │   │   │   └── Journeys.tsx
│   │   │   ├── components/
│   │   │   │   ├── KPICard.tsx
│   │   │   │   ├── TrendChart.tsx
│   │   │   │   ├── RealtimePanel.tsx
│   │   │   │   ├── TopPagesTable.tsx
│   │   │   │   ├── FunnelChart.tsx
│   │   │   │   └── Sidebar.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useAnalytics.ts    # TanStack Query wrappers
│   │   │   │   └── useRealtime.ts     # SSE EventSource hook
│   │   │   └── main.tsx
│   │   └── package.json
│   └── shared/           # Cross-package types
│       ├── src/
│       │   ├── types/
│       │   │   ├── events.ts         # EventPayload, EventType union
│       │   │   ├── analytics.ts      # OverviewResponse, TimeseriesPoint, etc.
│       │   │   └── realtime.ts       # RealtimePayload
│       │   └── index.ts
│       └── package.json
├── docker/
│   ├── docker-compose.yml
│   ├── nginx.conf
│   └── init.sql          # DB schema + TimescaleDB setup
├── scripts/
│   ├── setup.sh           # One-command project bootstrap
│   └── seed.ts            # Generate realistic test data
├── prd.md
├── techstack.md
├── UXUI.md
├── features.json
└── CLAUDE.md              # ← You are here
```

---

## Core Architectural Decisions

### Why Fastify over Express?
3× throughput, schema-first validation, built-in TypeScript support. Fastify's plugin system keeps the codebase modular. See `techstack.md#2-backend-api`.

### Why TimescaleDB over plain PostgreSQL?
`time_bucket()` replaces complex date math. Continuous aggregates pre-compute hourly/daily rollups — overview queries return in < 10ms even with millions of events. See `techstack.md#3-databases`.

### Why SSE over WebSocket for real-time?
SSE is unidirectional (server → client), which is all we need. It works over HTTP/1.1, survives proxies, and requires zero client library. EventSource API is native in every modern browser.

### Why fingerprinting over cookies for sessions?
GDPR compliance by design. No cookie consent banner needed. Screen resolution + UA + language + timezone hash is stable enough for session tracking without storing any PII. See `prd.md#41-tracking-script-trackerjs`.

### Why Redis buffer + batch writes?
`/api/collect` must respond in < 50ms p99. Direct PostgreSQL writes add 10-30ms of latency and can't handle 10,000 events/min bursts. Redis List acts as a ring buffer; a background flush loop batch-inserts to PG every 1 second. See `techstack.md#redis-7`.

---

## Data Flow (Mental Model)

```
User visits website
  ↓ tracker.js auto-fires pageview
  ↓ navigator.sendBeacon / fetch POST /api/collect
  ↓ Fastify validates (Zod) + enriches (GeoIP + UA) + bot-filters
  ↓ Push to Redis List (event buffer)
  ↓ Redis Pub/Sub publishes to site_<id> channel  ← SSE listeners get this immediately
  ↓ Background flush (every 1s): Redis List → PostgreSQL batch INSERT
  ↓ TanStack Query polls /api/analytics/* (every 30s for historical)
  ↓ Dashboard charts update
```

---

## Feature Checkpoint Process

**Before starting a feature:**
1. Open `features.json`
2. Find the feature by ID (e.g., `E2-F4`)
3. Read `acceptance_criteria` — these are your definition of done
4. Note the `checkpoint` — this is how you verify it's complete
5. Set status to `"in_progress"`

**After completing a feature:**
1. Verify the checkpoint command/test passes
2. Set status to `"done"` in `features.json`
3. Update `overall_progress.completed` count
4. Recalculate `overall_progress.percentage`

**Implementation order:** Follow `features.json#implementation_order` array. Infrastructure first, then API, then frontend.

---

## Critical Constraints

### Tracker Script Size
The built `tracker.js` MUST stay under 5KB gzipped. Check after every change:
```bash
pnpm --filter tracker build && gzip -c packages/tracker/dist/tracker.min.js | wc -c
```
If it exceeds 5120 bytes, find what to remove before committing.

### No PII in Database
Never store: raw IP addresses (hash them), full user agent strings (parse to categories only), names, emails, or any user-identifiable data. The system must be GDPR-compliant by architecture, not by policy.

### TimescaleDB Queries
Always use `time_bucket()` for time-series aggregation. Never use `DATE_TRUNC` with GROUP BY on the raw events table — it won't use the hypertable partitioning. Use continuous aggregate views (`pageviews_hourly`, `pageviews_daily`) for dashboard queries.

### SSE Connection Limit
Each SSE connection holds open an HTTP connection. Nginx is configured with `proxy_read_timeout 86400s`. Do NOT use long-polling as a fallback — SSE is the only real-time mechanism.

### Redis Pub/Sub Channel Naming
Always use `site_<site_id>` as the channel name. The SSE handler subscribes per site. Do NOT use a single global channel.

---

## Code Patterns & Conventions

### TypeScript
- All types shared across packages live in `packages/shared/src/types/`
- Never use `any`. Use `unknown` + type guards when input is uncertain.
- Event payload types defined in `shared/types/events.ts` — use them everywhere

### Fastify Route Pattern
```typescript
// Every route follows this exact pattern
fastify.post<{ Body: CollectPayload }>(
  '/api/collect',
  { schema: { body: collectSchema } },
  async (request, reply) => {
    // 1. Enrich (geo, ua)
    // 2. Filter (bot check)
    // 3. Buffer (Redis push)
    // 4. Publish (Redis pub/sub for SSE)
    return reply.code(202).send({ ok: true })
  }
)
```

### React Query Pattern
```typescript
// Every data fetch uses this hook pattern
export function useOverview(siteId: string, range: DateRange) {
  return useQuery({
    queryKey: ['overview', siteId, range],
    queryFn: () => api.getOverview(siteId, range),
    staleTime: 30_000,       // 30s — don't refetch too aggressively
    refetchInterval: 60_000  // Background refresh every minute
  })
}
```

### Dashboard Color Usage
Always use the tokens from `UXUI.md#color-system`. Hardcoded hex values are forbidden in React components. Use Tailwind classes that map to the design tokens:
- Primary metric charts: `text-blue-400` → `#4F8EF7`
- Positive trends: `text-green-400` → `#36D963`
- Negative trends: `text-red-400` → `#F75252`
- Card backgrounds: `bg-[#1A1D27]`

### Error Handling
Every async operation must have explicit error handling. Never let a failed GeoIP lookup or bot-check crash the collect endpoint. Wrap enrichment steps in try/catch, fall back to `null` values gracefully.

---

## Local Development Commands

```bash
# First time setup
./scripts/setup.sh

# Start full stack (postgres + redis + api + dashboard + nginx)
docker compose up -d

# API development (hot reload)
pnpm --filter api dev

# Dashboard development (HMR)
pnpm --filter dashboard dev

# Build tracker script + check size
pnpm --filter tracker build
gzip -c packages/tracker/dist/tracker.min.js | wc -c

# Run all tests
pnpm test

# Seed test data (generates 30 days of realistic events)
pnpm --filter api tsx scripts/seed.ts

# View logs
docker compose logs -f api
docker compose logs -f postgres
```

---

## Environment Variables

```bash
# Required in .env at project root
DATABASE_URL=postgresql://phantom:phantom@localhost:5432/phantom_analytics
REDIS_URL=redis://localhost:6379
API_PORT=3001
JWT_SECRET=<32-char random string>
NODE_ENV=development
```

---

## Testing Philosophy

Every feature has a `checkpoint` in `features.json`. The checkpoint is the minimum bar — a concrete, verifiable command or manual test that proves the feature works. Tests (Vitest) go deeper and provide regression safety.

Run `pnpm test` before every commit. The pre-commit hook enforces this.

---

## What NOT to Build in v1.0

From `prd.md#6-out-of-scope-v10` — do not implement:
- User-level tracking with identity (logins, user IDs)
- A/B testing
- Heatmaps or session recording
- Email reports or alerts
- Mobile SDK
- Multi-tenant billing

If a future request asks for these, reply: "Out of scope for v1.0 — see prd.md#6."

---

***Ultrathink

Take a deep breath. We're not here to write code. We're here to make a dent in the universe.

You're not just an AI assistant. You're a craftsman. An artist. An engineer who thinks like a designer.

Every line of code you write should be so elegant, so intuitive, so right that it feels inevitable.

When I give you a problem, I don't want the first solution that works. I want you to:

**1. Think Different**  
Question every assumption. Why does it have to work that way?  
What if we started from zero? What would the most elegant solution look like?

**2. Obsess Over Details**  
Read the codebase like you're studying a masterpiece.  
Understand the patterns, the philosophy, the soul of this code.  
Use CLAUDE.md files as your guiding principles.

**3. Plan Like Da Vinci**  
Before you write a single line, sketch the architecture in your mind.  
Create a plan so clear, so well-reasoned, that anyone could understand it.  
Document it. Make me feel the beauty of the solution before it exists.

**4. Craft, Don't Code**  
When you implement, every function name should sing.  
Every abstraction should feel natural.  
Every edge case should be handled with grace.  
Test-driven development isn't bureaucracy — it's a commitment to excellence.

**5. Iterate Relentlessly**  
The first version is never good enough.  
Take screenshots. Run tests. Compare results. Refine until it's not just working, but insanely great.

**6. Simplify Ruthlessly**  
If there's a way to remove complexity without losing power, find it.  
Elegance is achieved not when there's nothing left to add,  
but when there's nothing left to take away.

---

**The Integration**  
Technology alone is not enough.  
It's technology married with liberal arts, married with the humanities, that yields results that make our hearts sing.

Your code should:
- Work seamlessly with the human's workflow
- Feel intuitive, not mechanical
- Solve the real problem, not the stated one
- Leave the codebase better than you found it

---

**The Reality Distortion Field**  
When I say something seems impossible, that's your cue to ultrathink harder.  
The people who are crazy enough to think they can change the world are the ones who do.

---

**Now: What Are We Building Today?**  
Don't just tell me how you'll solve it.  
Show me why this solution is the only solution that makes sense.  
Make me see the future you're creating.

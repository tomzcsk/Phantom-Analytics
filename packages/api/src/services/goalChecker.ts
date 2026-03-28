import { prisma } from '../db/client.js'

/**
 * Goal Checker — background job running every 5 minutes.
 *
 * 1. Check each goal → create notifications when:
 *    - goal_reached: percentage >= 100%
 *    - goal_exceeded: percentage >= 150%
 *    - goal_warning: period almost over but < 70%
 *
 * 2. Snapshot completed periods (period rolled over since last check).
 */

function n(v: unknown): number { return Number(v ?? 0) }

function periodStart(period: string, date = new Date()): Date {
  if (period === 'daily') {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate())
  }
  if (period === 'weekly') {
    const day = date.getDay()
    const diff = date.getDate() - day + (day === 0 ? -6 : 1)
    return new Date(date.getFullYear(), date.getMonth(), diff)
  }
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function periodEnd(period: string, start: Date): Date {
  if (period === 'daily') {
    const d = new Date(start)
    d.setDate(d.getDate() + 1)
    return d
  }
  if (period === 'weekly') {
    const d = new Date(start)
    d.setDate(d.getDate() + 7)
    return d
  }
  return new Date(start.getFullYear(), start.getMonth() + 1, 1)
}

function previousPeriodStart(period: string, currentStart: Date): Date {
  if (period === 'daily') {
    const d = new Date(currentStart)
    d.setDate(d.getDate() - 1)
    return d
  }
  if (period === 'weekly') {
    const d = new Date(currentStart)
    d.setDate(d.getDate() - 7)
    return d
  }
  return new Date(currentStart.getFullYear(), currentStart.getMonth() - 1, 1)
}

function shouldWarn(period: string, percentage: number): boolean {
  const now = new Date()
  if (percentage >= 70) return false

  if (period === 'daily') {
    return now.getHours() >= 18 // after 6 PM
  }
  if (period === 'weekly') {
    return now.getDay() >= 5 // Friday or later
  }
  // monthly: after 25th
  return now.getDate() >= 25
}

async function countEvents(siteId: string, eventMatch: string, from: Date, to: Date): Promise<number> {
  const [row] = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*)::bigint AS count
    FROM events
    WHERE site_id = ${siteId}::uuid
      AND timestamp >= ${from}
      AND timestamp < ${to}
      AND (event_type = ${eventMatch} OR custom_name = ${eventMatch})
  `
  return n(row?.count)
}

async function checkGoals() {
  const goals = await prisma.goal.findMany({
    include: { site: { select: { id: true, deleted_at: true } } },
  })

  for (const goal of goals) {
    if (goal.site.deleted_at) continue

    try {
      const start = periodStart(goal.period)
      const end = periodEnd(goal.period, start)
      const current = await countEvents(goal.site_id, goal.event_match, start, end)
      const pct = goal.target_value > 0 ? (current / goal.target_value) * 100 : 0
      const periodStartDate = start.toISOString().slice(0, 10)

      // ── Notifications ──────────────────────────────────────────────

      // Reached (100-149%)
      if (pct >= 100 && pct < 150) {
        await prisma.notification.upsert({
          where: { goal_id_type_period_start: { goal_id: goal.id, type: 'goal_reached', period_start: new Date(periodStartDate) } },
          update: {},
          create: {
            site_id: goal.site_id,
            goal_id: goal.id,
            type: 'goal_reached',
            title: `${goal.name} — ถึงเป้า ${Math.round(pct)}%!`,
            period_start: new Date(periodStartDate),
          },
        })
      }

      // Exceeded (>= 150%)
      if (pct >= 150) {
        await prisma.notification.upsert({
          where: { goal_id_type_period_start: { goal_id: goal.id, type: 'goal_exceeded', period_start: new Date(periodStartDate) } },
          update: {},
          create: {
            site_id: goal.site_id,
            goal_id: goal.id,
            type: 'goal_exceeded',
            title: `${goal.name} — เกินเป้า ${Math.round(pct)}%!`,
            period_start: new Date(periodStartDate),
          },
        })
      }

      // Warning (near deadline but < 70%)
      if (shouldWarn(goal.period, pct)) {
        await prisma.notification.upsert({
          where: { goal_id_type_period_start: { goal_id: goal.id, type: 'goal_warning', period_start: new Date(periodStartDate) } },
          update: {},
          create: {
            site_id: goal.site_id,
            goal_id: goal.id,
            type: 'goal_warning',
            title: `${goal.name} — ใกล้หมดเวลา แต่ได้แค่ ${Math.round(pct)}%`,
            period_start: new Date(periodStartDate),
          },
        })
      }

      // ── Snapshot previous period (if not yet saved) ─────────────────

      const prevStart = previousPeriodStart(goal.period, start)
      const prevEnd = start // previous period ends where current starts

      const existing = await prisma.goalSnapshot.findUnique({
        where: { goal_id_period_start: { goal_id: goal.id, period_start: prevStart } },
      })

      if (!existing) {
        const prevCount = await countEvents(goal.site_id, goal.event_match, prevStart, prevEnd)
        const prevPct = goal.target_value > 0 ? Math.round((prevCount / goal.target_value) * 100) : 0

        await prisma.goalSnapshot.create({
          data: {
            goal_id: goal.id,
            period_start: prevStart,
            period_end: new Date(prevEnd.toISOString().slice(0, 10)),
            actual_value: prevCount,
            target_value: goal.target_value,
            percentage: prevPct,
          },
        }).catch(() => {}) // ignore unique constraint race
      }
    } catch {
      // Individual goal failure shouldn't crash the loop
    }
  }
}

const INTERVAL = 5 * 60 * 1000 // 5 minutes

export function startGoalChecker() {
  // Initial check after 30s (let server warm up)
  setTimeout(() => {
    void checkGoals()
    setInterval(() => void checkGoals(), INTERVAL)
  }, 30_000)
}

// Export for use in goals route (pace calculation)
export { periodStart, periodEnd, previousPeriodStart, countEvents }

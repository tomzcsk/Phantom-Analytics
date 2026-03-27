import { prisma } from '../db/client.js'

const INTERVAL_MS = 60 * 60 * 1000 // 1 hour
const BATCH_SIZE = 1000
const BATCH_DELAY_MS = 100

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * Delete old events, sessions, and funnel_events for sites with data_retention_days set.
 * Uses id-based batching (not ctid) for hypertable compatibility.
 * Adds backpressure (100ms delay) between batches to avoid starving the DB.
 */
async function cleanupRetainedData(): Promise<void> {
  const sites = await prisma.site.findMany({
    where: {
      deleted_at: null,
      data_retention_days: { not: null },
    },
    select: { id: true, name: true, data_retention_days: true },
  })

  for (const site of sites) {
    if (!site.data_retention_days) continue

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - site.data_retention_days)

    try {
      // Delete funnel_events first
      let deletedFunnelEvents = 0
      while (true) { // eslint-disable-line no-constant-condition
        const result = await prisma.$executeRaw`
          DELETE FROM funnel_events
          WHERE id IN (
            SELECT fe.id FROM funnel_events fe
            JOIN funnels f ON fe.funnel_id = f.id
            WHERE f.site_id = ${site.id}::uuid
              AND fe.completed_at < ${cutoff}
            LIMIT ${BATCH_SIZE}
          )
        `
        deletedFunnelEvents += result
        if (result < BATCH_SIZE) break
        await delay(BATCH_DELAY_MS)
      }

      // Delete sessions
      let deletedSessions = 0
      while (true) { // eslint-disable-line no-constant-condition
        const result = await prisma.$executeRaw`
          DELETE FROM sessions
          WHERE id IN (
            SELECT id FROM sessions
            WHERE site_id = ${site.id}::uuid
              AND started_at < ${cutoff}
            LIMIT ${BATCH_SIZE}
          )
        `
        deletedSessions += result
        if (result < BATCH_SIZE) break
        await delay(BATCH_DELAY_MS)
      }

      // Delete events (hypertable — must use id, not ctid)
      let deletedEvents = 0
      while (true) { // eslint-disable-line no-constant-condition
        const result = await prisma.$executeRaw`
          DELETE FROM events
          WHERE id IN (
            SELECT id FROM events
            WHERE site_id = ${site.id}::uuid
              AND timestamp < ${cutoff}
            LIMIT ${BATCH_SIZE}
          )
        `
        deletedEvents += result
        if (result < BATCH_SIZE) break
        await delay(BATCH_DELAY_MS)
      }

      if (deletedEvents > 0 || deletedSessions > 0 || deletedFunnelEvents > 0) {
        console.log(
          `[data-retention] ${site.name}: deleted ${deletedEvents} events, ${deletedSessions} sessions, ${deletedFunnelEvents} funnel_events (cutoff: ${cutoff.toISOString()})`,
        )
      }
    } catch (err) {
      console.error(`[data-retention] Error cleaning site ${site.name} (${site.id}):`, err)
    }
  }
}

/** Schedule retention cleanup — uses setTimeout recursion to prevent overlapping runs. */
export function startDataRetentionLoop(): void {
  console.log('[data-retention] Cleanup loop started (interval: 1h)')
  async function loop() {
    try {
      await cleanupRetainedData()
    } catch (err) {
      console.error('[data-retention] Unhandled error in cleanup loop:', err)
    }
    setTimeout(loop, INTERVAL_MS)
  }
  setTimeout(loop, INTERVAL_MS)
}

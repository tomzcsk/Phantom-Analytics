/**
 * Phantom Analytics — Realistic Test Data Seed
 *
 * Generates 30 days of realistic pageview and event data.
 *
 * Usage:
 *   pnpm --filter api tsx ../../scripts/seed.ts
 */

import { PrismaClient } from '@prisma/client'
import type { EnrichedEvent } from '../packages/shared/src/types/events.js'

const prisma = new PrismaClient()

// ── Config ──────────────────────────────────────────────────────────────

const DAYS = 30
const BASE_DAILY_EVENTS = 200  // realistic baseline for a small site
const PAGES = [
  '/', '/features', '/pricing', '/blog', '/about', '/docs',
  '/blog/getting-started', '/blog/privacy-analytics', '/contact',
]
const COUNTRIES = ['US', 'GB', 'DE', 'FR', 'CA', 'AU', 'NL', 'JP', 'BR', 'IN']
const DEVICES = ['desktop', 'mobile', 'tablet'] as const
const BROWSERS = ['Chrome', 'Firefox', 'Safari', 'Edge']
const OSS = ['Windows', 'macOS', 'iOS', 'Android', 'Linux']
const REFERRERS = [
  '', // direct
  'https://google.com', 'https://twitter.com', 'https://linkedin.com',
  'https://news.ycombinator.com', 'https://github.com',
]

// ── Helpers ──────────────────────────────────────────────────────────────

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function generateSessionId(): string {
  return Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('')
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

// ── Seed ─────────────────────────────────────────────────────────────────

async function seed(): Promise<void> {
  console.log('Phantom Analytics — Seeding test data...\n')

  // Get or create dev site
  let site = await prisma.site.findFirst({
    where: { deleted_at: null },
    orderBy: { created_at: 'asc' },
  })

  if (!site) {
    site = await prisma.site.create({
      data: { name: 'Local Dev Site', domain: 'localhost' }
    })
    console.log(`Created site: ${site.id}`)
  } else {
    console.log(`Using existing site: ${site.id} (${site.domain})`)
  }

  const now = new Date()
  const startDate = addDays(now, -DAYS)

  let totalEvents = 0
  const BATCH_SIZE = 500

  for (let day = 0; day < DAYS; day++) {
    const dayDate = addDays(startDate, day)

    // Simulate realistic weekly patterns (more traffic on weekdays)
    const dayOfWeek = dayDate.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    const multiplier = isWeekend ? 0.6 : 1.0 + (Math.random() * 0.4)

    // Simulate growth trend over 30 days
    const growthFactor = 1 + (day / DAYS) * 0.3
    const eventCount = Math.round(BASE_DAILY_EVENTS * multiplier * growthFactor)

    const batch: Omit<EnrichedEvent, 'custom_properties'> & {
      siteId: string
      customProperties?: Record<string, unknown>
      timestamp: Date
    }[] = []

    for (let i = 0; i < eventCount; i++) {
      const sessionId = generateSessionId()
      const url = `http://localhost${randomChoice(PAGES)}`
      const hourOffset = randomInt(0, 86400) // random second within the day
      const timestamp = new Date(dayDate.getTime() + hourOffset * 1000)

      batch.push({
        siteId: site.id,
        sessionId: sessionId,
        eventType: 'pageview',
        url,
        referrer: randomChoice(REFERRERS) || undefined,
        title: url.split('/').pop() ?? 'Home',
        countryCode: randomChoice(COUNTRIES),
        region: null,
        deviceType: randomChoice(DEVICES),
        browser: randomChoice(BROWSERS),
        os: randomChoice(OSS),
        screenWidth: randomChoice([1920, 1440, 1280, 1024, 390, 414]),
        screenHeight: randomChoice([1080, 900, 800, 768, 844, 896]),
        language: randomChoice(['en-US', 'en-GB', 'de-DE', 'fr-FR', 'ja-JP']),
        timezone: randomChoice(['America/New_York', 'Europe/London', 'Europe/Berlin', 'Asia/Tokyo']),
        timeOnPage: randomInt(5, 300),
        timestamp,
      })

      // Flush batch
      if (batch.length >= BATCH_SIZE) {
        await prisma.event.createMany({
          data: batch.map((e) => ({
            site_id: e.siteId,
            session_id: e.sessionId,
            event_type: e.eventType,
            url: e.url,
            referrer: e.referrer,
            title: e.title,
            country_code: e.countryCode,
            region: e.region,
            device_type: e.deviceType,
            browser: e.browser,
            os: e.os,
            screen_width: e.screenWidth,
            screen_height: e.screenHeight,
            language: e.language,
            timezone: e.timezone,
            time_on_page: e.timeOnPage,
            timestamp: e.timestamp,
          })),
        })
        totalEvents += batch.length
        batch.length = 0
      }
    }

    // Flush remaining
    if (batch.length > 0) {
      await prisma.event.createMany({
        data: batch.map((e) => ({
          site_id: e.siteId,
          session_id: e.sessionId,
          event_type: e.eventType,
          url: e.url,
          referrer: e.referrer,
          title: e.title,
          country_code: e.countryCode,
          region: e.region,
          device_type: e.deviceType,
          browser: e.browser,
          os: e.os,
          screen_width: e.screenWidth,
          screen_height: e.screenHeight,
          language: e.language,
          timezone: e.timezone,
          time_on_page: e.timeOnPage,
          timestamp: e.timestamp,
        })),
      })
      totalEvents += batch.length
    }

    if (day % 5 === 0) {
      console.log(`  Day ${day + 1}/${DAYS} — ${totalEvents.toLocaleString()} events so far`)
    }
  }

  console.log(`\n  Done! Seeded ${totalEvents.toLocaleString()} events over ${DAYS} days.`)
  console.log(`  Site ID: ${site.id}`)
  console.log(`  Tracking Token: ${site.tracking_token}`)
}

seed()
  .catch((e: unknown) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(() => {
    void prisma.$disconnect()
  })

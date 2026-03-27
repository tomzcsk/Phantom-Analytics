import UAParser from 'ua-parser-js'
import { isbot } from 'isbot'

/**
 * User-Agent parsing and bot detection service (E3-F4, E3-F5)
 *
 * - ua-parser-js: extracts device type, browser name/version, OS name/version
 * - isbot: detects Googlebot, Bingbot, crawlers, headless Chrome, etc.
 *
 * Per CLAUDE.md: Never store the raw UA string — only parsed categories.
 * A missing or empty UA string is treated as an unknown desktop (not a bot).
 */

export interface UAResult {
  device_type: 'desktop' | 'mobile' | 'tablet' | null
  browser_name: string | null
  browser_version: string | null
  os_name: string | null
  os_version: string | null
  is_bot: boolean
}

/**
 * Parse a User-Agent string into structured device/browser/OS data.
 *
 * Bot detection runs first — if the UA is a known bot, parsing is skipped
 * and is_bot=true is returned with null device fields (bots aren't stored).
 */
export function parseUA(userAgent: string): UAResult {
  // E3-F5: Bot detection — silent rejection, not an error
  if (isbot(userAgent)) {
    return {
      device_type: null,
      browser_name: null,
      browser_version: null,
      os_name: null,
      os_version: null,
      is_bot: true,
    }
  }

  // E3-F4: Parse device/browser/OS categories
  const parser = new UAParser(userAgent)
  const result = parser.getResult()

  // ua-parser-js returns 'mobile' | 'tablet' | 'smarttv' | etc.
  // We collapse everything that isn't mobile/tablet to 'desktop'.
  const rawType = result.device.type
  let device_type: 'desktop' | 'mobile' | 'tablet' | null
  if (rawType === 'mobile') device_type = 'mobile'
  else if (rawType === 'tablet') device_type = 'tablet'
  else if (userAgent === '') device_type = null
  else device_type = 'desktop'

  return {
    device_type,
    browser_name: result.browser.name ?? null,
    browser_version: result.browser.major ?? result.browser.version ?? null,
    os_name: result.os.name ?? null,
    os_version: result.os.version ?? null,
    is_bot: false,
  }
}

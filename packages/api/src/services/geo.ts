import geoip from 'geoip-lite'

/**
 * GeoIP enrichment service (E3-F3)
 *
 * Uses geoip-lite with a local MaxMind GeoLite2 DB — zero external API calls.
 * Per CLAUDE.md: Never store raw IP addresses. This service only extracts
 * the country/region and discards the IP entirely.
 */

export interface GeoResult {
  country_code: string | null
  region: string | null
}

/**
 * Look up geographic information for an IP address.
 * Returns null fields for private ranges, IPv6-only addresses, or any
 * lookup failure — never throws.
 */
export function lookupGeo(ip: string): GeoResult {
  try {
    const geo = geoip.lookup(ip)
    if (!geo) return { country_code: null, region: null }
    return {
      country_code: geo.country ?? null,
      region: geo.region || null, // empty string → null
    }
  } catch {
    return { country_code: null, region: null }
  }
}

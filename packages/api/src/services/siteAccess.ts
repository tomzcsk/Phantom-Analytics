import { prisma } from '../db/client.js'

/**
 * Returns accessible site IDs for a user.
 * - Admin: returns null (all sites accessible)
 * - Viewer: returns array of assigned site_ids
 */
export async function getAccessibleSiteIds(userId: string, role: string): Promise<string[] | null> {
  if (role === 'admin') return null

  const assignments = await prisma.userSite.findMany({
    where: { user_id: userId },
    select: { site_id: true },
  })
  return assignments.map((a) => a.site_id)
}

/**
 * Check if user has access to a specific site.
 */
export async function canAccessSite(userId: string, role: string, siteId: string): Promise<boolean> {
  if (role === 'admin') return true

  const assignment = await prisma.userSite.findUnique({
    where: { user_id_site_id: { user_id: userId, site_id: siteId } },
  })
  return assignment !== null
}

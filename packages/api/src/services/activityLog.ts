import { Prisma } from '@prisma/client'
import { prisma } from '../db/client.js'

interface LogParams {
  userId: string
  userName: string
  action: 'create' | 'update' | 'delete' | 'login' | 'logout' | 'login_failed'
  entityType: 'site' | 'user' | 'funnel' | 'click_variable' | 'auth' | 'share_link'
  entityId?: string
  description: string
  metadata?: Record<string, unknown>
  siteId?: string | undefined
}

export function logActivity(params: LogParams): void {
  // Fire-and-forget — never block the request
  prisma.activityLog
    .create({
      data: {
        user_id: params.userId,
        user_name: params.userName,
        action: params.action,
        entity_type: params.entityType,
        entity_id: params.entityId ?? null,
        description: params.description,
        metadata: params.metadata ? (params.metadata as Prisma.InputJsonValue) : Prisma.DbNull,
        site_id: params.siteId ?? null,
      },
    })
    .catch(() => {
      // Silently fail — logging should never crash the app
    })
}

import { PrismaClient } from '@prisma/client'

/**
 * Singleton Prisma client instance.
 *
 * In development, Next.js/tsx hot-reload can create multiple instances,
 * so we attach to globalThis to reuse across reloads.
 */

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env['NODE_ENV'] === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma
}

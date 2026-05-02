import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function buildClient(): PrismaClient {
  // Supabase via Vercel Marketplace exposes POSTGRES_PRISMA_URL (PgBouncer/6543).
  // Fall back to DATABASE_URL for local docker-compose development.
  const url = process.env.POSTGRES_PRISMA_URL ?? process.env.DATABASE_URL
  return new PrismaClient(url ? { datasourceUrl: url } : undefined)
}

export const prisma = globalForPrisma.prisma ?? buildClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

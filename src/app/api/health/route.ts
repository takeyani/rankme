import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

function getAiServiceUrl(): string {
  const url = process.env.AI_SERVICE_URL
  if (url) return url
  if (process.env.NODE_ENV === "production") {
    throw new Error("AI_SERVICE_URL is required in production")
  }
  return "http://localhost:8000"
}

export async function GET() {
  let dbHealthy = false
  let aiHealthy = false

  // --- Check DB connection ---
  try {
    await prisma.$queryRaw`SELECT 1`
    dbHealthy = true
  } catch {
    dbHealthy = false
  }

  // --- Check AI service health ---
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    try {
      const response = await fetch(`${getAiServiceUrl()}/health`, {
        method: "GET",
        signal: controller.signal,
      })
      aiHealthy = response.ok
    } finally {
      clearTimeout(timeoutId)
    }
  } catch {
    aiHealthy = false
  }

  // --- Determine overall status ---
  const status = dbHealthy && aiHealthy ? "healthy" : "degraded"
  const httpStatus = dbHealthy ? 200 : 503

  return NextResponse.json(
    {
      status,
      db: dbHealthy,
      ai: aiHealthy,
    },
    { status: httpStatus }
  )
}

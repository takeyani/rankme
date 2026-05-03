import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

/**
 * GET /api/learning-summary
 *
 * Public aggregate stats for the model learning dashboard. Returns counts only,
 * never individual records / personal info. Safe to expose without auth.
 */
export async function GET() {
  try {
    const [labelsTotal, labelsByRank, diagTotal, corrected] = await Promise.all([
      prisma.trainingLabel.count(),
      prisma.trainingLabel.groupBy({
        by: ["rank"],
        _count: { _all: true },
      }),
      prisma.diagnosis.count(),
      prisma.diagnosis.findMany({
        where: { correctedRank: { not: null } },
        select: { rank: true, correctedRank: true, correctedAt: true },
      }),
    ])

    // labels by rank (1〜10)
    const labelsByRankMap: Record<number, number> = {}
    for (let r = 1; r <= 10; r++) labelsByRankMap[r] = 0
    for (const row of labelsByRank) {
      labelsByRankMap[row.rank] = row._count._all
    }

    // corrections breakdown
    const correctionsTotal = corrected.length
    const totalAbsDelta = corrected.reduce(
      (sum, d) => sum + Math.abs((d.correctedRank ?? d.rank) - d.rank),
      0,
    )
    const meanAbsoluteDelta =
      correctionsTotal > 0 ? Number((totalAbsDelta / correctionsTotal).toFixed(2)) : 0

    // delta distribution (-9..+9)
    const deltaDistribution: Record<number, number> = {}
    for (const d of corrected) {
      const delta = (d.correctedRank ?? d.rank) - d.rank
      deltaDistribution[delta] = (deltaDistribution[delta] ?? 0) + 1
    }

    // recent corrections this week / month
    const now = Date.now()
    const week = 7 * 24 * 60 * 60 * 1000
    const month = 30 * 24 * 60 * 60 * 1000
    const lastWeek = corrected.filter(
      (d) => d.correctedAt && now - d.correctedAt.getTime() < week,
    ).length
    const lastMonth = corrected.filter(
      (d) => d.correctedAt && now - d.correctedAt.getTime() < month,
    ).length

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      trainingLabels: {
        total: labelsTotal,
        byRank: labelsByRankMap,
      },
      diagnoses: {
        total: diagTotal,
      },
      corrections: {
        total: correctionsTotal,
        meanAbsoluteDelta,
        deltaDistribution,
        lastWeek,
        lastMonth,
      },
    })
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: "DB_ERROR",
          message: err instanceof Error ? err.message : "DBエラー",
        },
      },
      { status: 500 },
    )
  }
}

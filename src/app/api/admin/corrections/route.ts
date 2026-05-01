import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Admin endpoint: aggregate corrected diagnoses for offline retraining.
 *
 * Auth: gated by `x-admin-token` header matching `ADMIN_TOKEN` env var.
 * Without ADMIN_TOKEN configured, the endpoint returns 503 (disabled).
 *
 * Output formats:
 *   GET /api/admin/corrections          → JSON
 *   GET /api/admin/corrections?format=csv → CSV (id,original_rank,corrected_rank,delta,note,created_at,corrected_at)
 */
export async function GET(req: NextRequest) {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: { code: "DISABLED", message: "ADMIN_TOKEN env var is not configured" } },
      { status: 503 },
    );
  }
  const provided = req.headers.get("x-admin-token");
  if (provided !== expected) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "invalid admin token" } },
      { status: 401 },
    );
  }

  const rows = await prisma.diagnosis.findMany({
    where: { correctedRank: { not: null } },
    orderBy: { correctedAt: "desc" },
    select: {
      id: true,
      rank: true,
      correctedRank: true,
      correctionNote: true,
      engineType: true,
      createdAt: true,
      correctedAt: true,
    },
  });

  const total = rows.length;
  const totalDelta = rows.reduce(
    (sum, r) => sum + Math.abs((r.correctedRank ?? r.rank) - r.rank),
    0,
  );
  const meanAbsDelta = total > 0 ? totalDelta / total : 0;

  const format = req.nextUrl.searchParams.get("format");
  if (format === "csv") {
    const header = "id,original_rank,corrected_rank,delta,engine,note,created_at,corrected_at";
    const lines = rows.map((r) => {
      const delta = (r.correctedRank ?? r.rank) - r.rank;
      const escapedNote = r.correctionNote
        ? `"${r.correctionNote.replace(/"/g, '""')}"`
        : "";
      return [
        r.id,
        r.rank,
        r.correctedRank ?? "",
        delta,
        r.engineType,
        escapedNote,
        r.createdAt.toISOString(),
        r.correctedAt?.toISOString() ?? "",
      ].join(",");
    });
    return new NextResponse([header, ...lines].join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="corrections.csv"',
      },
    });
  }

  return NextResponse.json({
    summary: {
      totalCorrections: total,
      meanAbsoluteDelta: Number(meanAbsDelta.toFixed(2)),
    },
    items: rows.map((r) => ({
      diagnosisId: r.id,
      originalRank: r.rank,
      correctedRank: r.correctedRank,
      delta: (r.correctedRank ?? r.rank) - r.rank,
      engineType: r.engineType,
      note: r.correctionNote,
      createdAt: r.createdAt.toISOString(),
      correctedAt: r.correctedAt?.toISOString() ?? null,
    })),
  });
}

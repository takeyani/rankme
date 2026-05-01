import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const Body = z.object({
  correctedRank: z.number().int().min(1).max(10),
  note: z.string().max(500).optional(),
});

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(
  req: NextRequest,
  ctx: { params: { id: string } },
) {
  const body = await req.json().catch(() => null);
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return errorResponse("INVALID_BODY", "正しいランク（1〜10）を指定してください", 400);
  }

  const diagnosis = await prisma.diagnosis.findUnique({
    where: { id: ctx.params.id },
    select: { id: true, rank: true, correctedRank: true },
  });
  if (!diagnosis) {
    return errorResponse("NOT_FOUND", "診断が見つかりません", 404);
  }

  const updated = await prisma.diagnosis.update({
    where: { id: diagnosis.id },
    data: {
      correctedRank: parsed.data.correctedRank,
      correctionNote: parsed.data.note?.trim() || null,
      correctedAt: new Date(),
    },
    select: {
      id: true,
      rank: true,
      correctedRank: true,
      correctedAt: true,
    },
  });

  return NextResponse.json({
    diagnosisId: updated.id,
    originalRank: updated.rank,
    correctedRank: updated.correctedRank,
    correctedAt: updated.correctedAt?.toISOString(),
    message: "ご協力ありがとうございました。次回以降の判定精度向上に使われます。",
  });
}

export async function GET(
  _req: NextRequest,
  ctx: { params: { id: string } },
) {
  const d = await prisma.diagnosis.findUnique({
    where: { id: ctx.params.id },
    select: {
      id: true,
      rank: true,
      correctedRank: true,
      correctionNote: true,
      correctedAt: true,
    },
  });
  if (!d) {
    return errorResponse("NOT_FOUND", "診断が見つかりません", 404);
  }
  return NextResponse.json({
    diagnosisId: d.id,
    originalRank: d.rank,
    correctedRank: d.correctedRank,
    correctionNote: d.correctionNote,
    correctedAt: d.correctedAt?.toISOString() ?? null,
  });
}

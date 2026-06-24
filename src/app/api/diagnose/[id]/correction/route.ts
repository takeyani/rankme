import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getBucketProgress } from "@/lib/agi/bias";

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
    // aiRawRank も読む。bias 集計は AI 生ランクのバケットで管理する。
    select: { id: true, rank: true, aiRawRank: true, correctedRank: true },
  });
  if (!diagnosis) {
    return errorResponse("NOT_FOUND", "診断が見つかりません", 404);
  }

  // この diagnosis の AI 生ランクのバケットがアップデート後に何件になるか調べる。
  // 次回以降の同一 AI 生ランクの予測に対し、このフィードバックがどれだけ
  // 効くかを返すために必要。
  const aiBucket = diagnosis.aiRawRank ?? diagnosis.rank;
  const wasUncorrected = diagnosis.correctedRank == null;

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
      aiRawRank: true,
      correctedRank: true,
      correctedAt: true,
    },
  });

  // bias.ts と同じ集計条件で「このバケットに何件あるか」を取る。
  // aiRawRank が NULL の古いレコードは rank をフォールバックに含める。
  const bucketCount = await prisma.diagnosis.count({
    where: {
      correctedRank: { not: null },
      OR: [
        { aiRawRank: aiBucket },
        { aiRawRank: null, rank: aiBucket },
      ],
    },
  });

  const progress = getBucketProgress(bucketCount);

  // ユーザー向けメッセージは「効きが見えるか」で出し分けると体感が良い。
  let message: string;
  if (progress.phase === "active") {
    message = wasUncorrected
      ? "ご協力ありがとうございました。次回以降、同じランク帯の判定にしっかり反映されます。"
      : "フィードバックを更新しました。次回以降の判定に反映されます。";
  } else if (progress.phase === "partial") {
    message = `現在 ${bucketCount} 件集まりました。次回以降の判定に控えめに反映されます (あと ${progress.samplesUntilActive} 件で本格的に反映)。`;
  } else {
    message = `ご協力ありがとうございました。あと ${progress.samplesUntilPartial} 件で同ランク帯の判定への反映が始まります。`;
  }

  return NextResponse.json({
    diagnosisId: updated.id,
    originalRank: updated.rank,
    correctedRank: updated.correctedRank,
    correctedAt: updated.correctedAt?.toISOString(),
    message,
    // 次回以降の判定への反映状況。UI から「いまどの段階か」を見せたい時に使う。
    nextImpact: {
      aiBucket,
      bucketSampleCount: bucketCount,
      phase: progress.phase,
      samplesUntilPartial: progress.samplesUntilPartial,
      samplesUntilActive: progress.samplesUntilActive,
    },
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

import { prisma } from "@/lib/prisma"

/**
 * Online learning bias.
 *
 * 過去にユーザーが「AIランクXは間違いで本来Yだった」と修正したフィードバックを集計し、
 * AI生スコアごとの平均偏差（バイアス）を算出する。次回判定時にこのバイアスを加算して、
 * AIの傾向を学習補正する。
 *
 * 例: AIが「5」と出した過去20件のうち、ユーザー修正の平均が+1.3 → AIが「5」を返したら
 * 学習補正後は約6.3 → 6にクリップ。
 *
 * 補正は ±1.5 にクリップ（暴走防止）、1件でもサンプルがあればそのランクに反映する。
 */

// 1件でもフィードバックがあれば参考に補正をかける（少サンプル時の過適合は MAX_BIAS のクリップで抑制）
const MIN_SAMPLES_PER_RANK = 1
const MAX_BIAS = 1.5

export type BiasMap = Record<number, { bias: number; samples: number }>

/**
 * 全修正フィードバックから AI生ランクごとの平均バイアスを計算する。
 *
 * 注: aiRawRank が NULL（過去のレコード）の場合は rank をフォールバックに使う。
 */
export async function computeBiasMap(): Promise<BiasMap> {
  const corrections = await prisma.diagnosis.findMany({
    where: { correctedRank: { not: null } },
    select: { rank: true, aiRawRank: true, correctedRank: true },
  })

  const grouped: Record<number, number[]> = {}
  for (const c of corrections) {
    const aiRank = c.aiRawRank ?? c.rank
    if (c.correctedRank == null) continue
    const delta = c.correctedRank - aiRank
    grouped[aiRank] = grouped[aiRank] ?? []
    grouped[aiRank].push(delta)
  }

  const map: BiasMap = {}
  for (let r = 1; r <= 10; r++) {
    const samples = grouped[r] ?? []
    if (samples.length < MIN_SAMPLES_PER_RANK) {
      map[r] = { bias: 0, samples: samples.length }
      continue
    }
    const avg = samples.reduce((s, v) => s + v, 0) / samples.length
    const clamped = Math.max(-MAX_BIAS, Math.min(MAX_BIAS, avg))
    map[r] = { bias: Number(clamped.toFixed(2)), samples: samples.length }
  }
  return map
}

/**
 * AI生ランクにバイアスを適用して最終ランク（1-10、整数）を返す。
 */
export function applyBias(
  aiRank: number,
  biasMap: BiasMap,
): { adjusted: number; bias: number } {
  const entry = biasMap[aiRank] ?? { bias: 0, samples: 0 }
  const raw = aiRank + entry.bias
  const clamped = Math.max(1, Math.min(10, Math.round(raw)))
  return { adjusted: clamped, bias: entry.bias }
}

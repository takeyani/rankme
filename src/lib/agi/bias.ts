import { prisma } from "@/lib/prisma"

/**
 * Stage-based online learning bias.
 *
 * 過去にユーザーが「AIランクXは間違いで本来Yだった」と修正したフィードバックを
 * AI生ランクごとに集計し、次回判定で AI 生ランクに加算する補正バイアスを算出する。
 *
 * バケット (= AI生ランクごとの集計単位) は集まったサンプル数に応じて3段階で動く:
 *
 *   off       (< 5件)   : bias=0。まだ反映しない。
 *   partial   (5〜19件) : 控えめに反映 (±MAX_BIAS_PARTIAL)。
 *                        体感ゼロを避けつつ、少サンプル平均の暴走を抑える。
 *   active    (≧ 20件)  : 本格的に反映 (±MAX_BIAS_ACTIVE)。
 *
 * `noisy` チェック (std > MAX_NOISE_STD) は、フィードバックの方向がばらばらな
 * バケットを bias=0 に落とす。ノイジーな delta を1つの bias 値に潰しても精度
 * 識別力が下がるだけなので無補正にした方が安全という判断 (旧版 MIN_SAMPLES=1 /
 * MAX_BIAS=1.5 は実測で Spearman を悪化させていた; rankme-accuracy-investigation.md)。
 *
 * 旧コードからの互換性: `applyBias` の戻り値は { adjusted, bias } を保持しつつ
 * confidence / phase を追加するだけなので、呼び出し側はそのまま動く。
 */

const STAGE_PARTIAL_MIN = 5
const STAGE_ACTIVE_MIN = 20
const MAX_BIAS_PARTIAL = 0.5
const MAX_BIAS_ACTIVE = 1.5
const MAX_NOISE_STD = 2.0

export type BiasPhase = "off" | "partial" | "active" | "suppressed"

export type BiasEntry = {
  bias: number
  samples: number
  std: number
  /** 0-1. 件数とノイズの両方から算出した「この補正をどれだけ信用するか」 */
  confidence: number
  phase: BiasPhase
}
export type BiasMap = Record<number, BiasEntry>

/**
 * 全修正フィードバックから AI生ランクごとのバイアスエントリを計算する。
 *
 * aiRawRank が NULL (古いレコード) の場合は rank をフォールバックに使う。
 * 当時 bias が無効化されていた時代の Diagnosis.rank は AI生ランクに等しいため、
 * これでも統計は概ね正しい。
 */
export async function computeBiasMap(): Promise<BiasMap> {
  const corrections = await prisma.diagnosis.findMany({
    where: { correctedRank: { not: null } },
    select: { rank: true, aiRawRank: true, correctedRank: true },
  })

  const grouped: Record<number, number[]> = {}
  for (const c of corrections) {
    if (c.correctedRank == null) continue
    const aiRank = c.aiRawRank ?? c.rank
    const delta = c.correctedRank - aiRank
    grouped[aiRank] = grouped[aiRank] ?? []
    grouped[aiRank].push(delta)
  }

  const map: BiasMap = {}
  for (let r = 1; r <= 10; r++) {
    map[r] = computeEntry(grouped[r] ?? [])
  }
  return map
}

function computeEntry(samples: number[]): BiasEntry {
  const n = samples.length

  if (n < STAGE_PARTIAL_MIN) {
    return { bias: 0, samples: n, std: 0, confidence: 0, phase: "off" }
  }

  const mean = samples.reduce((s, v) => s + v, 0) / n
  const variance = samples.reduce((s, v) => s + (v - mean) ** 2, 0) / n
  const std = Math.sqrt(variance)

  if (std > MAX_NOISE_STD) {
    return { bias: 0, samples: n, std: round2(std), confidence: 0, phase: "suppressed" }
  }

  const isActive = n >= STAGE_ACTIVE_MIN
  const maxBias = isActive ? MAX_BIAS_ACTIVE : MAX_BIAS_PARTIAL
  const clamped = Math.max(-maxBias, Math.min(maxBias, mean))

  // confidence: 件数が増えるほど & ノイズが小さいほど高い。
  // partial 段階では 0.3〜0.6、active 段階では n に応じて 0.6〜1.0 をベースに、
  // ノイズ品質 (1 - std/MAX_NOISE_STD) で減衰させる。
  const sampleStrength = isActive
    ? Math.min(1, n / 100)
    : 0.3 + ((n - STAGE_PARTIAL_MIN) / (STAGE_ACTIVE_MIN - STAGE_PARTIAL_MIN)) * 0.3
  const noiseQuality = Math.max(0, 1 - std / MAX_NOISE_STD)
  const confidence = round2(sampleStrength * noiseQuality)

  return {
    bias: round2(clamped),
    samples: n,
    std: round2(std),
    confidence,
    phase: isActive ? "active" : "partial",
  }
}

/**
 * AI生ランクにバイアスを適用して最終ランク (1-10、整数) を返す。
 *
 * confidence と phase も併せて返す。phase="off" / "suppressed" のときは
 * bias=0 なので結果として AI 生ランクがそのまま返る。
 */
export function applyBias(
  aiRank: number,
  biasMap: BiasMap,
): { adjusted: number; bias: number; confidence: number; phase: BiasPhase } {
  const entry =
    biasMap[aiRank] ??
    ({ bias: 0, samples: 0, std: 0, confidence: 0, phase: "off" } as BiasEntry)
  const raw = aiRank + entry.bias
  const clamped = Math.max(1, Math.min(10, Math.round(raw)))
  return {
    adjusted: clamped,
    bias: entry.bias,
    confidence: entry.confidence,
    phase: entry.phase,
  }
}

/**
 * あるバケットの集積進捗。フィードバック送信直後にユーザーに「次回判定への効き」
 * を返す用途。
 *
 * - phase: 現在のフェーズ ("off" / "partial" / "active")
 * - samplesUntilPartial: partial に到達するまでに必要な追加件数
 * - samplesUntilActive: active に到達するまでに必要な追加件数
 */
export function getBucketProgress(samples: number): {
  phase: BiasPhase
  samplesUntilPartial: number
  samplesUntilActive: number
} {
  let phase: BiasPhase
  if (samples >= STAGE_ACTIVE_MIN) phase = "active"
  else if (samples >= STAGE_PARTIAL_MIN) phase = "partial"
  else phase = "off"

  return {
    phase,
    samplesUntilPartial: Math.max(0, STAGE_PARTIAL_MIN - samples),
    samplesUntilActive: Math.max(0, STAGE_ACTIVE_MIN - samples),
  }
}

function round2(x: number): number {
  return Number(x.toFixed(2))
}

// 外部から閾値の現在値を参照したいケース (UIで「あと N 件で active」のN等) のため公開する。
// プログラマブルに変更したい場合は src/lib/agi/config.ts 等への移譲を検討する。
export const BIAS_STAGE_PARTIAL_MIN = STAGE_PARTIAL_MIN
export const BIAS_STAGE_ACTIVE_MIN = STAGE_ACTIVE_MIN

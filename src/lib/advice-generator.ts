/**
 * Advice Generation Utility
 *
 * Generates improvement advice based on rank and AI service features.
 * Maps improvement_areas keys to Japanese advice text.
 */

export interface AdviceItem {
  id: number
  title: string
  text: string
}

export interface AdviceContext {
  nearest_upper_rank?: number
  improvement_areas?: string[]
  similarity_scores?: Record<string, number>
  feature_analysis?: Record<string, number>
}

/**
 * Mapping of improvement area keys to advice templates.
 * Each key maps to { title, description } for structured advice.
 */
const IMPROVEMENT_MAP: Record<string, { title: string; description: string }> = {
  eyebrow_shape: {
    title: "眉の形を整える",
    description: "上位ランクの方は眉のアーチが整っている傾向があります。サロンでの眉カットや、自分の骨格に合った眉デザインを試してみてください。",
  },
  skin_tone_uniformity: {
    title: "肌トーンの均一化",
    description: "くすみやムラのない均一な肌トーンが高評価の傾向です。下地やコンシーラーで色味を整え、ファンデーションは薄づきで仕上げるのがポイントです。",
  },
  hair_balance: {
    title: "髪型のバランスを見直す",
    description: "顔型に合ったヘアスタイルが印象を大きく左右します。前髪の分量、サイドのボリューム、全体のシルエットを美容師に相談してみてください。",
  },
  face_symmetry: {
    title: "左右対称性を意識したメイク",
    description: "メイクで左右の目の大きさや眉の高さを揃えることで、全体のバランスが整います。鏡を離して全体を確認しながらメイクするのがコツです。",
  },
  facial_proportion: {
    title: "顔のプロポーションを活かす",
    description: "ハイライトとシェーディングで立体感を出すことで、顔のプロポーションがより整って見えます。Tゾーンと頬骨のハイライトが効果的です。",
  },
  skin_quality: {
    title: "肌質ケアの強化",
    description: "高ランクの方は肌のキメが整っている傾向があります。クレンジング・保湿・日焼け止めの基本ステップを見直し、定期的な角質ケアも取り入れてみてください。",
  },
  eye_impression: {
    title: "目元の印象アップ",
    description: "まつげのカールやアイラインの引き方で目元の印象が変わります。自分の目の形に合ったアイメイクを研究してみてください。カラコンも効果的です。",
  },
  overall_grooming: {
    title: "全体的な清潔感・手入れ",
    description: "上位ランクの共通点は「手入れが行き届いている」印象です。肌・髪・眉・唇のケアをトータルで底上げすることが最も効果的です。",
  },
  lip_shape: {
    title: "口元のケアとメイク",
    description: "唇の保湿を徹底し、リップライナーで輪郭を整えると清潔感が上がります。自分の肌トーンに合ったリップカラーを選ぶのがポイントです。",
  },
  jawline: {
    title: "フェイスラインの引き締め",
    description: "シェーディングでフェイスラインをシャープに見せることで、小顔効果と洗練された印象が得られます。顎下から耳に向かって自然にぼかすのがコツです。",
  },
  nose_shape: {
    title: "鼻筋の立体感",
    description: "ノーズシャドウとハイライトで鼻筋を通すと、顔全体の立体感が増します。やりすぎず、自然な影を意識してください。",
  },
  forehead: {
    title: "おでこ・生え際のバランス",
    description: "前髪のスタイリングでおでこの露出量を調整すると、顔全体のバランスが変わります。自分の顔型に合った前髪デザインを試してみてください。",
  },
}

/** Advice for rank 10 (maintenance-oriented) */
const RANK_10_ADVICE: { title: string; description: string }[] = [
  {
    title: "トップクラスの維持",
    description:
      "最高評価ランクです。現在のスキンケア・ヘアケア・メイクのルーティンを継続してください。変えないことも大切な戦略です。",
  },
  {
    title: "季節に合わせたケア",
    description:
      "夏は紫外線対策と皮脂コントロール、冬は保湿強化。季節ごとの微調整で年間を通じて安定した状態を維持できます。",
  },
  {
    title: "写真映りの最適化",
    description:
      "自然光での撮影、斜め45度のアングル、あごを少し引く姿勢など、写真映りのテクニックでさらに良い印象を与えられます。",
  },
]

/** Generic fallback advice for when improvement_areas are not provided */
const GENERIC_ADVICE: { title: string; description: string }[] = [
  {
    title: "ベースメイクの見直し",
    description: "上位ランクの傾向として、素肌感のある均一な肌が共通しています。厚塗りを避け、下地とコンシーラーで気になる部分だけカバーするのが効果的です。",
  },
  {
    title: "顔型に合ったヘアスタイル",
    description:
      "髪型は印象の50%を左右します。丸顔ならサイドにボリューム、面長なら前髪で縦幅を抑えるなど、顔型に合わせた選択が重要です。",
  },
  {
    title: "写真の撮り方を工夫",
    description: "自然光（窓際）で撮影し、カメラは目の高さかやや上から。あごを軽く引いて、少し斜めを向くと立体感が出て評価が上がりやすくなります。",
  },
  {
    title: "眉・まつげの手入れ",
    description:
      "眉の形とまつげのカールは、顔全体の印象を左右する最もコスパの良いポイントです。プロの眉カットを一度試してみてください。",
  },
  {
    title: "トータルバランスの意識",
    description: "一つのパーツにこだわるよりも、肌・髪・眉・唇をまんべんなくケアする方が全体の印象は上がります。まずは清潔感を最優先にしてください。",
  },
]

/**
 * Determine the number of advice items based on rank.
 * - Rank 1-3: 5 items (more general improvement suggestions)
 * - Rank 4-6: 4 items
 * - Rank 7-9: 3 items (more specific advice)
 * - Rank 10:  3 items (maintenance-oriented)
 */
function getAdviceCount(rank: number): number {
  if (rank <= 3) return 5
  if (rank <= 6) return 4
  return 3
}

/**
 * Generate improvement advice based on rank and features from AI service.
 *
 * @param rank - The diagnosis rank (1-10)
 * @param features - The advice_context object from AI service (optional)
 * @returns Array of advice items with title and description
 */
export function generateAdvice(
  rank: number,
  features?: AdviceContext | null
): { title: string; description: string }[] {
  const count = getAdviceCount(rank)

  // Rank 10: maintenance-oriented advice
  if (rank === 10) {
    return RANK_10_ADVICE.slice(0, count)
  }

  const adviceItems: { title: string; description: string }[] = []

  // Map improvement_areas to advice text if available
  // Sanitize improvement_areas: only accept allowlisted keys (defense in depth)
  const VALID_AREAS = new Set(Object.keys(IMPROVEMENT_MAP))
  if (features?.improvement_areas && Array.isArray(features.improvement_areas)) {
    for (const area of features.improvement_areas) {
      if (adviceItems.length >= count) break
      if (typeof area !== "string" || !VALID_AREAS.has(area)) continue
      const mapped = IMPROVEMENT_MAP[area]
      if (mapped) {
        adviceItems.push(mapped)
      }
    }
  }

  // Fill remaining slots with generic advice
  if (adviceItems.length < count) {
    for (const generic of GENERIC_ADVICE) {
      if (adviceItems.length >= count) break
      // Avoid duplicating titles
      if (!adviceItems.some((a) => a.title === generic.title)) {
        adviceItems.push(generic)
      }
    }
  }

  return adviceItems.slice(0, count)
}

/**
 * Convert advice items to the format stored in DB and returned to frontend.
 * Each item gets a sequential id.
 */
export function formatAdviceForResponse(
  adviceItems: { title: string; description: string }[]
): AdviceItem[] {
  return adviceItems.map((item, index) => ({
    id: index + 1,
    title: item.title,
    text: item.description,
  }))
}

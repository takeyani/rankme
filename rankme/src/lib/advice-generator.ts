/**
 * Advice Generation Utility
 *
 * Generates improvement advice based on rank and AI service features.
 * Maps improvement_areas keys to Japanese advice text.
 */

export interface AdviceItem {
  id: number
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
    title: "眉の形",
    description: "眉の形を整えることで、上位ランクの傾向に近づけます。",
  },
  skin_tone_uniformity: {
    title: "肌のトーン",
    description: "肌のトーンを均一にすることで、印象が大きく改善されます。",
  },
  hair_balance: {
    title: "髪型のバランス",
    description: "髪型のバランスを調整することで、全体的な印象が向上します。",
  },
  face_symmetry: {
    title: "左右対称性",
    description:
      "左右対称性を意識したメイクアップで、バランスが向上します。",
  },
  facial_proportion: {
    title: "顔のプロポーション",
    description:
      "顔のプロポーションを活かしたヘアスタイルで印象が変わります。",
  },
  skin_quality: {
    title: "肌質の改善",
    description: "スキンケアの見直しにより、肌質の改善が期待できます。",
  },
  eye_impression: {
    title: "目元の印象",
    description: "目元の印象を強調することで、評価ポイントが向上します。",
  },
  overall_grooming: {
    title: "全体的な手入れ",
    description:
      "全体的な手入れの行き届いた印象が、上位ランクの特徴です。",
  },
  lip_shape: {
    title: "口元のケア",
    description: "口元の保湿やケアを行うことで、清潔感がアップします。",
  },
  jawline: {
    title: "フェイスライン",
    description:
      "フェイスラインを引き締めるケアで、シャープな印象を演出できます。",
  },
  nose_shape: {
    title: "鼻筋のバランス",
    description:
      "メイクやノーズシャドウで鼻筋を整えると、立体感が増します。",
  },
  forehead: {
    title: "おでこ・生え際",
    description:
      "前髪のスタイリングでおでこのバランスを調整すると印象が変わります。",
  },
}

/** Advice for rank 10 (maintenance-oriented) */
const RANK_10_ADVICE: { title: string; description: string }[] = [
  {
    title: "現在の状態を維持",
    description:
      "現在のケアルーティンを継続することで、高い評価を維持できます。",
  },
  {
    title: "季節ごとの微調整",
    description:
      "季節の変化に合わせたスキンケアの微調整で、より安定した状態を保てます。",
  },
  {
    title: "バランスの維持",
    description:
      "全体的なバランスが非常に良好です。定期的なメンテナンスを心がけましょう。",
  },
]

/** Generic fallback advice for when improvement_areas are not provided */
const GENERIC_ADVICE: { title: string; description: string }[] = [
  {
    title: "スキンケアの見直し",
    description: "日々のスキンケアルーティンを見直すことで、肌質が改善されます。",
  },
  {
    title: "ヘアスタイルの工夫",
    description:
      "自分に合ったヘアスタイルを見つけることで、全体的な印象が向上します。",
  },
  {
    title: "表情の豊かさ",
    description: "自然な笑顔を心がけることで、好印象につながります。",
  },
  {
    title: "全体的な清潔感",
    description:
      "清潔感のある身だしなみが、第一印象を大きく左右します。",
  },
  {
    title: "姿勢とバランス",
    description: "姿勢を正すことで、顔全体の見え方も改善されます。",
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
  if (features?.improvement_areas && features.improvement_areas.length > 0) {
    for (const area of features.improvement_areas) {
      if (adviceItems.length >= count) break
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
    text: item.description,
  }))
}

import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import {
  generateAdvice,
  formatAdviceForResponse,
  type AdviceContext,
} from "@/lib/advice-generator"

function getAiServiceUrl(): string {
  const url = process.env.AI_SERVICE_URL
  if (url) return url
  if (process.env.NODE_ENV === "production") {
    throw new Error("AI_SERVICE_URL is required in production")
  }
  return "http://localhost:8000"
}
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png"]
const AI_TIMEOUT_MS = 30_000 // 30 seconds hard timeout

interface AIServiceResponse {
  rank: number
  confidence: number
  engine?: string
  features?: {
    improvement_areas?: string[]
    predicted_wage?: number
    top_similarity?: number
    neighbors?: Record<string, unknown>[]
    [key: string]: unknown
  }
  advice_context?: AdviceContext
  processing_time_ms?: number
}

function errorResponse(
  code: string,
  message: string,
  status: number,
  details?: Record<string, unknown>
) {
  return NextResponse.json(
    { error: { code, message, ...(details ? { details } : {}) } },
    { status }
  )
}

export async function POST(request: NextRequest) {
  // --- 1. Parse multipart form data ---
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return errorResponse(
      "NO_FILE_PROVIDED",
      "画像ファイルが指定されていません",
      400
    )
  }

  const file = formData.get("image")
  if (!file || !(file instanceof File)) {
    return errorResponse(
      "NO_FILE_PROVIDED",
      "画像ファイルが指定されていません",
      400
    )
  }

  // --- 2. Validate file type ---
  if (!ALLOWED_TYPES.includes(file.type)) {
    return errorResponse(
      "INVALID_FILE_TYPE",
      "JPEG または PNG 形式の画像を選択してください",
      400
    )
  }

  // --- 3. Validate file size ---
  if (file.size > MAX_FILE_SIZE) {
    return errorResponse(
      "FILE_TOO_LARGE",
      "ファイルサイズは 5MB 以下にしてください",
      400
    )
  }

  // --- 4. Forward image to AI service ---
  let aiResponse: AIServiceResponse
  try {
    const aiFormData = new FormData()
    aiFormData.append("image", file)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)

    let response: Response
    try {
      response = await fetch(`${getAiServiceUrl()}/predict`, {
        method: "POST",
        body: aiFormData,
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeoutId)
    }

    if (!response.ok) {
      const statusCode = response.status

      // Attempt to parse error body from AI service
      let aiError: { detail?: string } | undefined
      try {
        aiError = await response.json()
      } catch {
        // ignore parse errors
      }

      if (statusCode === 400 && aiError?.detail) {
        return errorResponse(
          "INVALID_IMAGE",
          aiError.detail,
          400
        )
      }

      if (statusCode === 503) {
        return errorResponse(
          "AI_SERVICE_UNAVAILABLE",
          "AI推論サービスに接続できません。しばらく経ってからお試しください",
          503
        )
      }

      return errorResponse(
        "AI_INFERENCE_FAILED",
        "AI推論中にエラーが発生しました",
        500,
        aiError ? { upstream: aiError } : undefined
      )
    }

    aiResponse = await response.json()
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      return errorResponse(
        "AI_TIMEOUT",
        "AI推論がタイムアウトしました。もう一度お試しください",
        504
      )
    }

    // Connection refused or network error
    return errorResponse(
      "AI_SERVICE_UNAVAILABLE",
      "AI推論サービスに接続できません。しばらく経ってからお試しください",
      503
    )
  }

  // --- 5. Generate improvement advice ---
  const adviceContext: AdviceContext = aiResponse.advice_context ?? {
    improvement_areas: aiResponse.features?.improvement_areas,
  }
  const adviceItems = generateAdvice(aiResponse.rank, adviceContext)
  const formattedAdvice = formatAdviceForResponse(adviceItems)

  // --- 6. Save diagnosis to DB ---
  let diagnosis
  try {
    diagnosis = await prisma.diagnosis.create({
      data: {
        rank: aiResponse.rank,
        advice: formattedAdvice as unknown as Prisma.InputJsonValue,
        engineType: aiResponse.engine ?? "similarity_v1",
        features: (aiResponse.features ?? aiResponse.advice_context ?? null) as unknown as Prisma.InputJsonValue,
        processingTimeMs: aiResponse.processing_time_ms ?? null,
      },
    })
  } catch {
    return errorResponse(
      "DB_SAVE_FAILED",
      "診断結果の保存に失敗しました",
      500
    )
  }

  // --- 7. Return response ---
  return NextResponse.json(
    {
      diagnosisId: diagnosis.id,
      rank: diagnosis.rank,
      advice: formattedAdvice,
      engineType: diagnosis.engineType,
      createdAt: diagnosis.createdAt.toISOString(),
    },
    { status: 200 }
  )
}

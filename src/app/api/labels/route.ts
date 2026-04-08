import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

function errorResponse(
  code: string,
  message: string,
  status: number
) {
  return NextResponse.json(
    { error: { code, message } },
    { status }
  )
}

/**
 * GET /api/labels
 * Fetch training labels with optional rank filter and cursor-based pagination.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const rankParam = searchParams.get("rank")
  const cursor = searchParams.get("cursor")
  const limitParam = searchParams.get("limit")

  // --- Validate rank filter ---
  let rankFilter: number | undefined
  if (rankParam !== null) {
    const parsed = parseInt(rankParam, 10)
    if (isNaN(parsed) || parsed < 1 || parsed > 10) {
      return errorResponse(
        "INVALID_RANK",
        "ランクは 1〜10 の範囲で指定してください",
        400
      )
    }
    rankFilter = parsed
  }

  // --- Validate limit ---
  let limit = DEFAULT_LIMIT
  if (limitParam !== null) {
    const parsed = parseInt(limitParam, 10)
    if (isNaN(parsed) || parsed < 1 || parsed > MAX_LIMIT) {
      return errorResponse(
        "INVALID_LIMIT",
        "取得件数の指定が不正です（1〜100の範囲で指定してください）",
        400
      )
    }
    limit = parsed
  }

  // --- Validate cursor ---
  if (cursor !== null && cursor.trim() === "") {
    return errorResponse(
      "INVALID_CURSOR",
      "ページ情報が不正です",
      400
    )
  }

  try {
    const whereClause = rankFilter !== undefined ? { rank: rankFilter } : {}

    // Fetch one extra to determine if there's a next page
    const items = await prisma.trainingLabel.findMany({
      take: limit + 1,
      ...(cursor
        ? {
            skip: 1,
            cursor: { id: cursor },
          }
        : {}),
      where: whereClause,
      orderBy: { createdAt: "desc" },
    })

    const hasMore = items.length > limit
    const resultItems = hasMore ? items.slice(0, limit) : items
    const nextCursor = hasMore
      ? resultItems[resultItems.length - 1]?.id ?? null
      : null

    const totalCount = await prisma.trainingLabel.count({
      where: whereClause,
    })

    return NextResponse.json({
      items: resultItems.map((item) => ({
        id: item.id,
        imageUrl: item.imageUrl,
        rank: item.rank,
        labeledBy: item.labeledBy,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
      pagination: {
        nextCursor,
        hasMore,
        totalCount,
      },
    })
  } catch {
    return errorResponse(
      "DB_CONNECTION_ERROR",
      "データベースに接続できません",
      500
    )
  }
}

/**
 * POST /api/labels
 * Create a new training label.
 * Accepts FormData with: image (File), rank (string), labeledBy? (string)
 * OR JSON body: { imageUrl, rank, labeledBy? }
 */
export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? ""

  let imageUrl: string
  let rankNum: number
  let labeledBy: string | null = null

  if (contentType.includes("multipart/form-data")) {
    // Handle FormData (from frontend modal)
    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return errorResponse("INVALID_REQUEST", "リクエストのパースに失敗しました", 400)
    }

    const file = formData.get("image")
    if (!file || !(file instanceof File)) {
      return errorResponse("NO_FILE_PROVIDED", "画像ファイルが指定されていません", 400)
    }

    // Store as data URL for simplicity (no external storage configured)
    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString("base64")
    imageUrl = `data:${file.type};base64,${base64}`

    const rankStr = formData.get("rank")
    if (!rankStr || typeof rankStr !== "string") {
      return errorResponse("INVALID_RANK", "ランクは 1〜10 の範囲で指定してください", 400)
    }
    rankNum = parseInt(rankStr, 10)

    const labeledByStr = formData.get("labeledBy")
    if (labeledByStr && typeof labeledByStr === "string") {
      labeledBy = labeledByStr.trim() || null
    }
  } else {
    // Handle JSON body
    let body: { imageUrl?: string; rank?: number; labeledBy?: string }
    try {
      body = await request.json()
    } catch {
      return errorResponse("INVALID_REQUEST", "リクエストボディのパースに失敗しました", 400)
    }

    if (!body.imageUrl || typeof body.imageUrl !== "string" || body.imageUrl.trim() === "") {
      return errorResponse("NO_FILE_PROVIDED", "画像URLが指定されていません", 400)
    }
    imageUrl = body.imageUrl.trim()

    if (body.rank === undefined || body.rank === null) {
      return errorResponse("INVALID_RANK", "ランクは 1〜10 の範囲で指定してください", 400)
    }
    rankNum = typeof body.rank === "string" ? parseInt(body.rank, 10) : body.rank
    labeledBy = body.labeledBy?.trim() || null
  }

  if (!Number.isInteger(rankNum) || rankNum < 1 || rankNum > 10) {
    return errorResponse("INVALID_RANK", "ランクは 1〜10 の範囲で指定してください", 400)
  }

  try {
    const label = await prisma.trainingLabel.create({
      data: {
        imageUrl,
        rank: rankNum,
        labeledBy,
      },
    })

    return NextResponse.json(
      {
        id: label.id,
        imageUrl: label.imageUrl,
        rank: label.rank,
        labeledBy: label.labeledBy,
        createdAt: label.createdAt.toISOString(),
        updatedAt: label.updatedAt.toISOString(),
      },
      { status: 201 }
    )
  } catch {
    return errorResponse("DB_SAVE_FAILED", "データの保存に失敗しました", 500)
  }
}

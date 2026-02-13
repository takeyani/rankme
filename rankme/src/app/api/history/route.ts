import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const DEFAULT_LIMIT = 20
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

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const cursor = searchParams.get("cursor")
  const limitParam = searchParams.get("limit")

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

  // --- Validate cursor (if provided, check it's a non-empty string) ---
  if (cursor !== null && cursor.trim() === "") {
    return errorResponse(
      "INVALID_CURSOR",
      "ページ情報が不正です",
      400
    )
  }

  try {
    // Fetch one extra to determine if there's a next page
    const items = await prisma.diagnosis.findMany({
      take: limit + 1,
      ...(cursor
        ? {
            skip: 1,
            cursor: { id: cursor },
          }
        : {}),
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        rank: true,
        createdAt: true,
      },
    })

    const hasMore = items.length > limit
    const resultItems = hasMore ? items.slice(0, limit) : items
    const nextCursor = hasMore
      ? resultItems[resultItems.length - 1]?.id ?? null
      : null

    // Get total count
    const totalCount = await prisma.diagnosis.count()

    return NextResponse.json({
      items: resultItems.map((item) => ({
        diagnosisId: item.id,
        rank: item.rank,
        createdAt: item.createdAt.toISOString(),
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

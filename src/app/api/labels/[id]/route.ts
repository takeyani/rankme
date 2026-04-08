import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

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
 * PUT /api/labels/[id]
 * Update an existing training label's rank and/or labeledBy.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  let body: { rank?: number; labeledBy?: string }
  try {
    body = await request.json()
  } catch {
    return errorResponse(
      "INVALID_REQUEST",
      "リクエストボディのパースに失敗しました",
      400
    )
  }

  const { rank, labeledBy } = body

  // --- Validate rank ---
  if (rank !== undefined && rank !== null) {
    const rankNum = typeof rank === "string" ? parseInt(rank as string, 10) : rank
    if (!Number.isInteger(rankNum) || rankNum < 1 || rankNum > 10) {
      return errorResponse(
        "INVALID_RANK",
        "ランクは 1〜10 の範囲で指定してください",
        400
      )
    }
  }

  try {
    // Check if label exists
    const existing = await prisma.trainingLabel.findUnique({
      where: { id },
    })

    if (!existing) {
      return errorResponse(
        "LABEL_NOT_FOUND",
        "指定されたラベルが見つかりません",
        404
      )
    }

    // Build update data
    const updateData: { rank?: number; labeledBy?: string } = {}
    if (rank !== undefined && rank !== null) {
      updateData.rank = typeof rank === "string" ? parseInt(rank as string, 10) : rank
    }
    if (labeledBy !== undefined) {
      updateData.labeledBy = labeledBy?.trim() || undefined
    }

    const updated = await prisma.trainingLabel.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({
      id: updated.id,
      imageUrl: updated.imageUrl,
      rank: updated.rank,
      labeledBy: updated.labeledBy,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    })
  } catch (error: unknown) {
    // Prisma P2025: Record not found
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2025"
    ) {
      return errorResponse(
        "LABEL_NOT_FOUND",
        "指定されたラベルが見つかりません",
        404
      )
    }

    return errorResponse(
      "DB_SAVE_FAILED",
      "データの更新に失敗しました",
      500
    )
  }
}

/**
 * DELETE /api/labels/[id]
 * Delete a training label by ID.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    // Check if label exists
    const existing = await prisma.trainingLabel.findUnique({
      where: { id },
    })

    if (!existing) {
      return errorResponse(
        "LABEL_NOT_FOUND",
        "指定されたラベルが見つかりません",
        404
      )
    }

    await prisma.trainingLabel.delete({
      where: { id },
    })

    return new NextResponse(null, { status: 204 })
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2025"
    ) {
      return errorResponse(
        "LABEL_NOT_FOUND",
        "指定されたラベルが見つかりません",
        404
      )
    }

    return errorResponse(
      "DELETE_FAILED",
      "削除処理に失敗しました",
      500
    )
  }
}

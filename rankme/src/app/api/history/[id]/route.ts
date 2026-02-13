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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const diagnosis = await prisma.diagnosis.findUnique({
      where: { id },
    })

    if (!diagnosis) {
      return errorResponse(
        "DIAGNOSIS_NOT_FOUND",
        "指定された診断結果が見つかりません",
        404
      )
    }

    return NextResponse.json({
      diagnosisId: diagnosis.id,
      rank: diagnosis.rank,
      advice: diagnosis.advice,
      engineType: diagnosis.engineType,
      createdAt: diagnosis.createdAt.toISOString(),
    })
  } catch {
    return errorResponse(
      "DB_CONNECTION_ERROR",
      "データベースに接続できません",
      500
    )
  }
}

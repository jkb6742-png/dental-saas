// =============================================================================
// Set Default API Integration - 기본 API 통합 설정
// =============================================================================

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"

/**
 * POST /api/admin/api-integrations/[id]/set-default
 *
 * 특정 API 통합을 기본값으로 설정
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. 인증 및 권한 확인
    const session = await auth()
    if (!session?.user || (session.user as any).role !== "MASTER") {
      return NextResponse.json({ error: "MASTER 권한이 필요합니다." }, { status: 403 })
    }

    // 2. 파라미터 추출
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: "API 통합 ID가 필요합니다." }, { status: 400 })
    }

    // 3. API 통합 존재 및 활성화 확인
    const { prisma } = await import('@/lib/db')

    const integration = await prisma.apiIntegration.findUnique({
      where: { id }
    })

    if (!integration) {
      return NextResponse.json({ error: "API 통합을 찾을 수 없습니다." }, { status: 404 })
    }

    if (!integration.isEnabled) {
      return NextResponse.json({
        error: "비활성화된 API 통합은 기본값으로 설정할 수 없습니다.",
        hint: "먼저 API 통합을 활성화해주세요."
      }, { status: 400 })
    }

    // 4. 이미 기본값인 경우
    if (integration.isDefault) {
      return NextResponse.json({
        success: true,
        message: "이미 기본 API 통합으로 설정되어 있습니다.",
        integration: {
          id: integration.id,
          provider: integration.provider,
          name: integration.name,
          isDefault: true
        }
      })
    }

    // 5. 트랜잭션으로 기본값 변경
    const result = await prisma.$transaction(async (tx) => {
      // 기존 기본값 해제
      await tx.apiIntegration.updateMany({
        where: { isDefault: true },
        data: { isDefault: false }
      })

      // 새로운 기본값 설정
      const updatedIntegration = await tx.apiIntegration.update({
        where: { id },
        data: { isDefault: true }
      })

      return updatedIntegration
    })

    // 6. 성공 응답
    console.log(`⭐ 기본 API 설정: ${result.provider} - ${result.name}`)

    return NextResponse.json({
      success: true,
      message: `'${result.name}'이 기본 API 통합으로 설정되었습니다.`,
      integration: {
        id: result.id,
        provider: result.provider,
        name: result.name,
        model: result.model,
        isDefault: result.isDefault,
        isEnabled: result.isEnabled,
        updatedAt: result.updatedAt
      }
    })

  } catch (error) {
    console.error("기본 API 설정 오류:", error)

    return NextResponse.json({
      error: "기본 API 통합 설정 중 오류가 발생했습니다.",
      details: error instanceof Error ? error.message : "알 수 없는 오류"
    }, { status: 500 })
  }
}
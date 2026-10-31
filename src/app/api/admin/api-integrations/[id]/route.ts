// =============================================================================
// Individual API Integration Management - 개별 API 통합 관리
// =============================================================================

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { encryptText, decryptText, maskApiKey } from "@/lib/security/encryption"

/**
 * PATCH /api/admin/api-integrations/[id]
 *
 * API 통합 수정
 */
export async function PATCH(
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

    // 3. 요청 데이터 추출
    const updates = await request.json()
    const {
      name,
      apiKey,
      model,
      isEnabled,
      setAsDefault = false
    } = updates

    // 4. 기존 통합 조회
    const { prisma } = await import('@/lib/db')

    const existingIntegration = await prisma.apiIntegration.findUnique({
      where: { id }
    })

    if (!existingIntegration) {
      return NextResponse.json({ error: "API 통합을 찾을 수 없습니다." }, { status: 404 })
    }

    // 5. 업데이트 데이터 구성
    const updateData: any = {}

    if (name !== undefined) updateData.name = name
    if (model !== undefined) updateData.model = model
    if (isEnabled !== undefined) updateData.isEnabled = isEnabled

    // API Key 변경된 경우 암호화
    if (apiKey) {
      updateData.encryptedApiKey = encryptText(apiKey)
    }

    // 6. 기본 설정 처리
    if (setAsDefault) {
      // 기존 기본값 해제
      await prisma.apiIntegration.updateMany({
        where: { isDefault: true },
        data: { isDefault: false }
      })
      updateData.isDefault = true
    }

    // 7. DB 업데이트
    const updatedIntegration = await prisma.apiIntegration.update({
      where: { id },
      data: updateData
    })

    // 8. 성공 응답
    console.log(`📝 API 통합 수정: ${updatedIntegration.provider} - ${updatedIntegration.name}`)

    return NextResponse.json({
      success: true,
      message: "API 통합이 수정되었습니다.",
      integration: {
        id: updatedIntegration.id,
        provider: updatedIntegration.provider,
        name: updatedIntegration.name,
        maskedApiKey: apiKey ? maskApiKey(apiKey) : '변경되지 않음',
        model: updatedIntegration.model,
        isEnabled: updatedIntegration.isEnabled,
        isDefault: updatedIntegration.isDefault,
        updatedAt: updatedIntegration.updatedAt
      }
    })

  } catch (error) {
    console.error("API 통합 수정 오류:", error)

    return NextResponse.json({
      error: "API 통합 수정 중 오류가 발생했습니다.",
      details: error instanceof Error ? error.message : "알 수 없는 오류"
    }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/api-integrations/[id]
 *
 * API 통합 삭제
 */
export async function DELETE(
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

    // 3. 기존 통합 조회 및 삭제
    const { prisma } = await import('@/lib/db')

    const deletedIntegration = await prisma.apiIntegration.delete({
      where: { id }
    })

    // 4. 기본 통합이 삭제된 경우 다른 활성화된 통합을 기본으로 설정
    if (deletedIntegration.isDefault) {
      const nextIntegration = await prisma.apiIntegration.findFirst({
        where: { isEnabled: true },
        orderBy: { createdAt: 'desc' }
      })

      if (nextIntegration) {
        await prisma.apiIntegration.update({
          where: { id: nextIntegration.id },
          data: { isDefault: true }
        })
      }
    }

    // 5. 성공 응답
    console.log(`🗑️ API 통합 삭제: ${deletedIntegration.provider} - ${deletedIntegration.name}`)

    return NextResponse.json({
      success: true,
      message: `API 통합 '${deletedIntegration.name}'이 삭제되었습니다.`,
      deletedIntegration: {
        id: deletedIntegration.id,
        provider: deletedIntegration.provider,
        name: deletedIntegration.name
      }
    })

  } catch (error) {
    console.error("API 통합 삭제 오류:", error)

    if (error instanceof Error && error.message.includes('Record to delete does not exist')) {
      return NextResponse.json({
        error: "삭제하려는 API 통합을 찾을 수 없습니다.",
        id
      }, { status: 404 })
    }

    return NextResponse.json({
      error: "API 통합 삭제 중 오류가 발생했습니다.",
      details: error instanceof Error ? error.message : "알 수 없는 오류"
    }, { status: 500 })
  }
}
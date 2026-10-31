// =============================================================================
// API Integrations Management - GPT API 설정 관리
// =============================================================================

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { encryptText, maskApiKey } from "@/lib/security/encryption"

/**
 * GET /api/admin/api-integrations
 *
 * API 통합 목록 조회 (MASTER만 접근 가능)
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 인증 및 권한 확인
    const session = await auth()
    if (!session?.user || (session.user as any).role !== "MASTER") {
      return NextResponse.json({ error: "MASTER 권한이 필요합니다." }, { status: 403 })
    }

    // 2. API 통합 목록 조회
    const { prisma } = await import('@/lib/db')

    const integrations = await prisma.apiIntegration.findMany({
      orderBy: [
        { isDefault: 'desc' },
        { isEnabled: 'desc' },
        { createdAt: 'desc' }
      ]
    })

    // 3. 응답 데이터 구성 (API Key 마스킹)
    const safeIntegrations = integrations.map(integration => ({
      id: integration.id,
      provider: integration.provider,
      name: integration.name,
      maskedApiKey: maskApiKey(integration.encryptedApiKey), // 실제로는 복호화 후 마스킹해야 함
      model: integration.model,
      isEnabled: integration.isEnabled,
      isDefault: integration.isDefault,
      lastTestedAt: integration.lastTestedAt,
      lastTestStatus: integration.lastTestStatus,
      lastTestMessage: integration.lastTestMessage,
      createdAt: integration.createdAt,
      updatedAt: integration.updatedAt
    }))

    return NextResponse.json({
      success: true,
      integrations: safeIntegrations,
      total: integrations.length,
      enabledCount: integrations.filter(i => i.isEnabled).length
    })

  } catch (error) {
    console.error("API 통합 조회 오류:", error)

    return NextResponse.json({
      error: "API 통합 목록을 조회할 수 없습니다.",
      details: error instanceof Error ? error.message : "알 수 없는 오류"
    }, { status: 500 })
  }
}

/**
 * POST /api/admin/api-integrations
 *
 * 새로운 API 통합 생성
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 인증 및 권한 확인
    const session = await auth()
    if (!session?.user || (session.user as any).role !== "MASTER") {
      return NextResponse.json({ error: "MASTER 권한이 필요합니다." }, { status: 403 })
    }

    // 2. 요청 데이터 추출
    const {
      provider,
      name,
      apiKey,
      model,
      isEnabled = true,
      setAsDefault = false
    } = await request.json()

    // 3. 필수 필드 검증
    if (!provider || !name || !apiKey) {
      return NextResponse.json({
        error: "필수 필드가 누락되었습니다.",
        required: ["provider", "name", "apiKey"]
      }, { status: 400 })
    }

    // 4. Provider 검증
    const validProviders = ["OPENAI", "ANTHROPIC", "GOOGLE", "CUSTOM"]
    if (!validProviders.includes(provider)) {
      return NextResponse.json({
        error: "지원하지 않는 Provider입니다.",
        supportedProviders: validProviders
      }, { status: 400 })
    }

    // 5. API Key 암호화
    const encryptedApiKey = encryptText(apiKey)

    // 6. DB 저장
    const { prisma } = await import('@/lib/db')

    // 기본 설정으로 지정하는 경우 기존 기본값 해제
    if (setAsDefault) {
      await prisma.apiIntegration.updateMany({
        where: { isDefault: true },
        data: { isDefault: false }
      })
    }

    const integration = await prisma.apiIntegration.create({
      data: {
        provider,
        name,
        encryptedApiKey,
        model: model || getDefaultModel(provider),
        isEnabled,
        isDefault: setAsDefault,
        createdBy: session.user.id
      }
    })

    // 7. 성공 응답 (API Key 마스킹)
    console.log(`📝 API 통합 생성: ${provider} - ${name}`)

    return NextResponse.json({
      success: true,
      message: `${provider} API 통합이 생성되었습니다.`,
      integration: {
        id: integration.id,
        provider: integration.provider,
        name: integration.name,
        maskedApiKey: maskApiKey(apiKey),
        model: integration.model,
        isEnabled: integration.isEnabled,
        isDefault: integration.isDefault,
        createdAt: integration.createdAt
      }
    })

  } catch (error) {
    console.error("API 통합 생성 오류:", error)

    return NextResponse.json({
      error: "API 통합 생성 중 오류가 발생했습니다.",
      details: error instanceof Error ? error.message : "알 수 없는 오류"
    }, { status: 500 })
  }
}

/**
 * Provider별 기본 모델 반환
 */
function getDefaultModel(provider: string): string {
  switch (provider) {
    case "OPENAI":
      return "gpt-4o"
    case "ANTHROPIC":
      return "claude-3-5-sonnet-20241022"
    case "GOOGLE":
      return "gemini-1.5-pro"
    default:
      return ""
  }
}
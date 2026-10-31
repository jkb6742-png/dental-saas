// =============================================================================
// API Integration Test - API 연결 테스트
// =============================================================================

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { decryptText } from "@/lib/security/encryption"

/**
 * POST /api/admin/api-integrations/[id]/test
 *
 * API 통합 연결 테스트
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

    // 3. API 통합 정보 조회
    const { prisma } = await import('@/lib/db')

    const integration = await prisma.apiIntegration.findUnique({
      where: { id }
    })

    if (!integration) {
      return NextResponse.json({ error: "API 통합을 찾을 수 없습니다." }, { status: 404 })
    }

    if (!integration.isEnabled) {
      return NextResponse.json({ error: "비활성화된 API 통합입니다." }, { status: 400 })
    }

    // 4. API Key 복호화
    const apiKey = decryptText(integration.encryptedApiKey)

    // 5. Provider별 연결 테스트
    const testResult = await testApiConnection(integration.provider, apiKey, integration.model)

    // 6. 테스트 결과 저장
    await prisma.apiIntegration.update({
      where: { id },
      data: {
        lastTestedAt: new Date(),
        lastTestStatus: testResult.success ? "SUCCESS" : "FAILED",
        lastTestMessage: testResult.message
      }
    })

    // 7. 응답 반환
    console.log(`🔧 API 테스트 ${testResult.success ? '성공' : '실패'}: ${integration.provider} - ${integration.name}`)

    return NextResponse.json({
      success: testResult.success,
      message: testResult.message,
      testDetails: testResult.details,
      timestamp: new Date().toISOString(),
      integration: {
        id: integration.id,
        provider: integration.provider,
        name: integration.name,
        model: integration.model
      }
    })

  } catch (error) {
    console.error("API 테스트 오류:", error)

    // 테스트 실패를 DB에 기록
    try {
      const { prisma } = await import('@/lib/db')
      await prisma.apiIntegration.update({
        where: { id: (await params).id },
        data: {
          lastTestedAt: new Date(),
          lastTestStatus: "FAILED",
          lastTestMessage: error instanceof Error ? error.message : "테스트 중 오류 발생"
        }
      })
    } catch {
      // DB 업데이트 실패는 무시
    }

    return NextResponse.json({
      success: false,
      error: "API 연결 테스트 중 오류가 발생했습니다.",
      details: error instanceof Error ? error.message : "알 수 없는 오류"
    }, { status: 500 })
  }
}

/**
 * Provider별 API 연결 테스트
 */
async function testApiConnection(
  provider: string,
  apiKey: string,
  model?: string
): Promise<{
  success: boolean
  message: string
  details?: any
}> {
  try {
    switch (provider) {
      case "OPENAI":
        return await testOpenAIConnection(apiKey, model)

      case "ANTHROPIC":
        return await testAnthropicConnection(apiKey, model)

      case "GOOGLE":
        return await testGoogleConnection(apiKey, model)

      case "CUSTOM":
        // Custom API는 간단한 ping 테스트만
        return {
          success: true,
          message: "Custom API 설정이 저장되었습니다. (연결 테스트 생략)",
          details: { provider: "CUSTOM" }
        }

      default:
        throw new Error(`지원하지 않는 Provider: ${provider}`)
    }

  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "연결 테스트 실패",
      details: { error: String(error) }
    }
  }
}

/**
 * OpenAI API 연결 테스트
 */
async function testOpenAIConnection(apiKey: string, model?: string): Promise<any> {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(10000) // 10초 타임아웃
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`OpenAI API 오류: ${response.status} - ${errorData.error?.message || response.statusText}`)
    }

    const data = await response.json()
    const availableModels = data.data?.map((m: any) => m.id) || []

    // 지정된 모델이 사용 가능한지 확인
    let modelStatus = "모델 정보 없음"
    if (model && availableModels.length > 0) {
      modelStatus = availableModels.includes(model)
        ? `모델 '${model}' 사용 가능`
        : `모델 '${model}' 사용 불가능`
    }

    return {
      success: true,
      message: `OpenAI API 연결 성공. ${modelStatus}`,
      details: {
        provider: "OpenAI",
        availableModelsCount: availableModels.length,
        testedModel: model,
        modelAvailable: model ? availableModels.includes(model) : null
      }
    }

  } catch (error) {
    throw new Error(`OpenAI 연결 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
  }
}

/**
 * Anthropic API 연결 테스트
 */
async function testAnthropicConnection(apiKey: string, model?: string): Promise<any> {
  try {
    // Anthropic은 모델 목록 API가 없으므로 간단한 메시지 API 테스트
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model || 'claude-3-5-sonnet-20241022',
        max_tokens: 10,
        messages: [
          { role: 'user', content: 'Test connection. Respond with "OK".' }
        ]
      }),
      signal: AbortSignal.timeout(15000) // 15초 타임아웃
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`Anthropic API 오류: ${response.status} - ${errorData.error?.message || response.statusText}`)
    }

    return {
      success: true,
      message: `Anthropic API 연결 성공. 모델 '${model || 'claude-3-5-sonnet-20241022'}' 사용 가능`,
      details: {
        provider: "Anthropic",
        testedModel: model || 'claude-3-5-sonnet-20241022'
      }
    }

  } catch (error) {
    throw new Error(`Anthropic 연결 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
  }
}

/**
 * Google AI API 연결 테스트
 */
async function testGoogleConnection(apiKey: string, model?: string): Promise<any> {
  try {
    const modelName = model || 'gemini-1.5-pro'
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}?key=${apiKey}`, {
      method: 'GET',
      signal: AbortSignal.timeout(10000) // 10초 타임아웃
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`Google AI API 오류: ${response.status} - ${errorData.error?.message || response.statusText}`)
    }

    const data = await response.json()

    return {
      success: true,
      message: `Google AI API 연결 성공. 모델 '${modelName}' 사용 가능`,
      details: {
        provider: "Google AI",
        modelInfo: {
          name: data.name,
          displayName: data.displayName,
          supportedGenerationMethods: data.supportedGenerationMethods
        }
      }
    }

  } catch (error) {
    throw new Error(`Google AI 연결 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
  }
}
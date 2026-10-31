import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    console.log(`[ULTRA-SIMPLE] 초간단 API 호출됨`)

    // 아무 검증도 하지 않고 그냥 성공 반환
    return NextResponse.json({
      success: true,
      message: "초간단 API 테스트 성공!",
      created: 123,
      processedTypes: ["TEST"]
    })

  } catch (error) {
    console.log(`[ULTRA-SIMPLE] 오류:`, error)
    return NextResponse.json({
      success: false,
      error: `오류: ${error}`
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: "초간단 API가 동작합니다!"
  })
}
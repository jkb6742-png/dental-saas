import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { extractSheetId, testSheetConnection } from "@/lib/googleSheets"

export async function GET(req: NextRequest) {
  try {
    console.log('🔍 DEBUG: prisma instance:', !!prisma)
    console.log('🔍 DEBUG: prisma.peiSheetConfig:', !!prisma?.peiSheetConfig)

    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const clinicId = searchParams.get('clinicId')

    if (!clinicId) {
      return NextResponse.json({ error: "clinicId가 필요합니다" }, { status: 400 })
    }

    // 해당 치과의 시트 설정 조회
    const sheetConfig = await prisma.peiSheetConfig.findUnique({
      where: { clinicId },
      include: {
        clinic: {
          select: { name: true }
        },
        creator: {
          select: { name: true, email: true }
        }
      }
    })

    if (!sheetConfig) {
      return NextResponse.json({
        hasConfig: false,
        message: "설정된 구글 시트가 없습니다"
      })
    }

    return NextResponse.json({
      hasConfig: true,
      config: {
        id: sheetConfig.id,
        sheetUrl: sheetConfig.sheetUrl,
        sheetId: sheetConfig.sheetId,
        sheetName: sheetConfig.sheetName,
        isActive: sheetConfig.isActive,
        lastSyncAt: sheetConfig.lastSyncAt,
        createdAt: sheetConfig.createdAt,
        createdBy: sheetConfig.creator.name,
        clinicName: sheetConfig.clinic.name
      }
    })

  } catch (error) {
    console.error("시트 설정 조회 실패:", error)
    return NextResponse.json({ error: "시트 설정 조회 중 오류가 발생했습니다" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 })
    }

    const { clinicId, sheetUrl, sheetName } = await req.json()

    if (!clinicId || !sheetUrl) {
      return NextResponse.json({
        error: "clinicId와 sheetUrl이 필요합니다"
      }, { status: 400 })
    }

    // 시트 URL에서 ID 추출
    const sheetId = extractSheetId(sheetUrl)
    if (!sheetId) {
      return NextResponse.json({
        error: "유효하지 않은 구글 시트 URL입니다"
      }, { status: 400 })
    }

    // 시트 연결 테스트 (구글 서비스 계정 키가 없으면 스킵)
    let connectionTest = { success: false, message: "연결 테스트를 건너뜀" }
    try {
      connectionTest = await testSheetConnection(sheetId)
    } catch (error: any) {
      if (error.message?.includes('GOOGLE_SERVICE_ACCOUNT_KEY')) {
        console.log('⚠️ 구글 서비스 계정 키가 설정되지 않아 연결 테스트를 건너뜁니다.')
        connectionTest = {
          success: true,
          message: "구글 서비스 계정 키 설정 필요 (시트 URL은 저장됨)"
        }
      } else {
        return NextResponse.json({
          error: error.message || "연결 테스트 실패"
        }, { status: 400 })
      }
    }

    // 기존 설정이 있는지 확인
    const existingConfig = await prisma.peiSheetConfig.findUnique({
      where: { clinicId }
    })

    let sheetConfig

    if (existingConfig) {
      // 기존 설정 업데이트
      sheetConfig = await prisma.peiSheetConfig.update({
        where: { clinicId },
        data: {
          sheetUrl,
          sheetId,
          sheetName: sheetName || 'Sheet1',
          isActive: true,
          lastSyncAt: new Date()
        }
      })
    } else {
      // 새 설정 생성
      sheetConfig = await prisma.peiSheetConfig.create({
        data: {
          clinicId,
          sheetUrl,
          sheetId,
          sheetName: sheetName || 'Sheet1',
          isActive: true,
          createdBy: (session.user as any).id,
          lastSyncAt: new Date()
        }
      })
    }

    return NextResponse.json({
      success: true,
      message: "구글 시트 연동이 성공적으로 설정되었습니다",
      config: {
        id: sheetConfig.id,
        sheetUrl: sheetConfig.sheetUrl,
        sheetId: sheetConfig.sheetId,
        sheetName: sheetConfig.sheetName,
        isActive: sheetConfig.isActive,
        lastSyncAt: sheetConfig.lastSyncAt
      },
      connectionTest
    })

  } catch (error) {
    console.error("시트 설정 생성 실패:", error)
    return NextResponse.json({
      error: "시트 설정 중 오류가 발생했습니다"
    }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 })
    }

    const { clinicId, sheetUrl, sheetName, isActive } = await req.json()

    if (!clinicId) {
      return NextResponse.json({ error: "clinicId가 필요합니다" }, { status: 400 })
    }

    // 기존 설정 조회
    const existingConfig = await prisma.peiSheetConfig.findUnique({
      where: { clinicId }
    })

    if (!existingConfig) {
      return NextResponse.json({
        error: "설정된 구글 시트가 없습니다"
      }, { status: 404 })
    }

    const updateData: any = { updatedAt: new Date() }

    // sheetUrl이 변경된 경우
    if (sheetUrl && sheetUrl !== existingConfig.sheetUrl) {
      const sheetId = extractSheetId(sheetUrl)
      if (!sheetId) {
        return NextResponse.json({
          error: "유효하지 않은 구글 시트 URL입니다"
        }, { status: 400 })
      }

      // 새 시트 연결 테스트
      const connectionTest = await testSheetConnection(sheetId)
      if (!connectionTest.success) {
        return NextResponse.json({
          error: connectionTest.message
        }, { status: 400 })
      }

      updateData.sheetUrl = sheetUrl
      updateData.sheetId = sheetId
      updateData.lastSyncAt = new Date()
    }

    // 기타 필드 업데이트
    if (sheetName !== undefined) updateData.sheetName = sheetName
    if (isActive !== undefined) updateData.isActive = isActive

    const updatedConfig = await prisma.peiSheetConfig.update({
      where: { clinicId },
      data: updateData
    })

    return NextResponse.json({
      success: true,
      message: "설정이 성공적으로 업데이트되었습니다",
      config: {
        id: updatedConfig.id,
        sheetUrl: updatedConfig.sheetUrl,
        sheetId: updatedConfig.sheetId,
        sheetName: updatedConfig.sheetName,
        isActive: updatedConfig.isActive,
        lastSyncAt: updatedConfig.lastSyncAt
      }
    })

  } catch (error) {
    console.error("시트 설정 업데이트 실패:", error)
    return NextResponse.json({
      error: "설정 업데이트 중 오류가 발생했습니다"
    }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const clinicId = searchParams.get('clinicId')

    if (!clinicId) {
      return NextResponse.json({ error: "clinicId가 필요합니다" }, { status: 400 })
    }

    // 기존 설정 조회
    const existingConfig = await prisma.peiSheetConfig.findUnique({
      where: { clinicId }
    })

    if (!existingConfig) {
      return NextResponse.json({
        error: "설정된 구글 시트가 없습니다"
      }, { status: 404 })
    }

    // 설정 삭제 (관련 보고서도 함께 삭제될 수 있음)
    await prisma.peiSheetConfig.delete({
      where: { clinicId }
    })

    return NextResponse.json({
      success: true,
      message: "구글 시트 연동 설정이 삭제되었습니다"
    })

  } catch (error) {
    console.error("시트 설정 삭제 실패:", error)
    return NextResponse.json({
      error: "설정 삭제 중 오류가 발생했습니다"
    }, { status: 500 })
  }
}
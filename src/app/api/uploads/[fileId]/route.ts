import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { unlink } from 'fs/promises'
import { prisma } from '@/lib/db'

interface Props {
  params: Promise<{ fileId: string }>
}

export async function DELETE(request: NextRequest, { params }: Props) {
  try {
    const { fileId } = await params

    // 파일 정보 조회
    const fileUpload = await prisma.fileUpload.findUnique({
      where: { id: fileId }
    })

    if (!fileUpload) {
      return NextResponse.json({ error: '파일을 찾을 수 없습니다.' }, { status: 404 })
    }

    // 파일 시스템에서 파일 삭제 (안전한 처리)
    if (fileUpload.filePath) {
      try {
        await unlink(fileUpload.filePath)
        console.log(`   📁 파일 시스템에서 삭제 완료: ${fileUpload.filePath}`)
      } catch (fsError) {
        console.warn('   ⚠️ 파일 시스템에서 파일 삭제 실패 (파일이 없거나 권한 문제):', fsError)
        // 파일이 이미 삭제되었거나 없어도 계속 진행
      }
    } else {
      console.warn('   ⚠️ 파일 경로가 없어서 물리적 파일 삭제 건너뜀')
    }

    // 🔥 파일과 관련된 데이터도 함께 삭제
    console.log(`🗑️ 파일 삭제: ${fileUpload.fileName} (${fileUpload.category})`)

    // 카테고리별 관련 데이터 삭제
    switch (fileUpload.category) {
      case 'ANNUAL_LEDGER':
        // 연간장부 삭제 시 monthlySummary 삭제
        const deletedSummary = await prisma.monthlySummary.deleteMany({
          where: {
            clinicId: fileUpload.clinicId,
            year: fileUpload.year
          }
        })
        console.log(`   📊 monthlySummary 삭제: ${deletedSummary.count}건`)
        break

      case 'COMPREHENSIVE_PATIENTS':
        // 전체접수수납 삭제 시 해당 클리닉의 모든 receptionRecord 삭제
        const deletedRecords = await prisma.receptionRecord.deleteMany({
          where: {
            clinicId: fileUpload.clinicId
          }
        })
        console.log(`   🏥 receptionRecord 삭제: ${deletedRecords.count}건`)

        // 관련 monthlySummary도 삭제 (재계산이 필요하므로)
        const deletedMonthlySummary = await prisma.monthlySummary.deleteMany({
          where: {
            clinicId: fileUpload.clinicId
          }
        })
        console.log(`   📊 monthlySummary 삭제: ${deletedMonthlySummary.count}건`)
        break

      case 'MONTHLY_LEDGER':
        // 월간장부 삭제 시 dailyLedger 삭제
        const deletedDaily = await prisma.dailyLedger.deleteMany({
          where: {
            clinicId: fileUpload.clinicId,
            year: fileUpload.year,
            month: fileUpload.month
          }
        })
        console.log(`   📅 dailyLedger 삭제: ${deletedDaily.count}건`)
        break
    }

    // 데이터베이스에서 파일 정보 삭제
    await prisma.fileUpload.delete({
      where: { id: fileId }
    })

    // 삭제 로그 기록
    await prisma.uploadLog.create({
      data: {
        clinicId: fileUpload.clinicId,
        action: 'DELETE',
        fileName: fileUpload.fileName,
        category: fileUpload.category,
        year: fileUpload.year,
        month: fileUpload.month,
        status: 'SUCCESS',
        message: '파일 삭제 완료'
      }
    })

    // 캐시 무효화
    revalidatePath(`/dashboard/${fileUpload.clinicId}/uploads`, "page")

    return NextResponse.json({
      success: true,
      message: '파일이 성공적으로 삭제되었습니다.'
    })

  } catch (error) {
    console.error('파일 삭제 오류:', error)
    return NextResponse.json({
      error: '파일 삭제 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest, { params }: Props) {
  try {
    const { fileId } = await params

    const fileUpload = await prisma.fileUpload.findUnique({
      where: { id: fileId }
    })

    if (!fileUpload) {
      return NextResponse.json({ error: '파일을 찾을 수 없습니다.' }, { status: 404 })
    }

    return NextResponse.json({ file: fileUpload })

  } catch (error) {
    console.error('파일 정보 조회 오류:', error)
    return NextResponse.json({
      error: '파일 정보 조회 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}
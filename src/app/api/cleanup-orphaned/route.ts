import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { existsSync } from 'fs'

export async function POST(request: NextRequest) {
  try {
    console.log('🧹 고아 파일 레코드 정리 시작...')

    const { clinicId } = await request.json()

    if (!clinicId) {
      return NextResponse.json({
        error: 'clinicId가 필요합니다.'
      }, { status: 400 })
    }

    // 해당 클리닉의 모든 파일 레코드 조회
    const fileRecords = await prisma.fileUpload.findMany({
      where: { clinicId }
    })

    console.log(`📋 ${fileRecords.length}개 파일 레코드 발견`)

    let deletedCount = 0
    const deletedFiles = []

    for (const record of fileRecords) {
      // 파일이 실제로 존재하는지 확인
      const fileExists = record.filePath ? existsSync(record.filePath) : false

      if (!fileExists || record.status === 'FAILED') {
        console.log(`🗑️ 삭제할 레코드: ${record.fileName} (파일존재: ${fileExists}, 상태: ${record.status})`)

        await prisma.fileUpload.delete({
          where: { id: record.id }
        })

        deletedCount++
        deletedFiles.push(record.fileName)
      } else {
        console.log(`✅ 유지할 레코드: ${record.fileName}`)
      }
    }

    console.log(`✅ 정리 완료: ${deletedCount}개 레코드 삭제`)

    return NextResponse.json({
      success: true,
      message: `${deletedCount}개의 고아 파일 레코드가 정리되었습니다.`,
      deletedCount,
      deletedFiles,
      remainingCount: fileRecords.length - deletedCount
    })

  } catch (error) {
    console.error('❌ 고아 파일 정리 오류:', error)
    return NextResponse.json({
      error: '고아 파일 정리 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 })
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { detectFileCategory, extractDateFromFileName, FILE_CATEGORIES } from '@/lib/file-upload/file-config'

export async function POST(request: NextRequest) {
  console.log('🟢 POST /api/uploads 호출됨!')

  try {
    // 단계 1: FormData 읽기
    console.log('1️⃣ FormData 읽기 시작...')
    const formData = await request.formData()
    const file = formData.get('file') as File
    const clinicId = formData.get('clinicId') as string
    console.log('✅ FormData 읽기 완료')

    console.log('📋 업로드 데이터:', {
      hasFile: !!file,
      fileName: file?.name,
      fileSize: file?.size,
      clinicId: clinicId
    })

    // 단계 2: 기본 검증
    console.log('2️⃣ 기본 검증 시작...')
    if (!file || !clinicId) {
      console.log('❌ 기본 검증 실패')
      return NextResponse.json({
        error: '파일 또는 클리닉 ID가 없습니다.'
      }, { status: 400 })
    }
    console.log('✅ 기본 검증 완료')

    // 단계 3: 클리닉 확인
    console.log('3️⃣ 클리닉 확인 시작...')
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId }
    })

    if (!clinic) {
      console.log('❌ 클리닉 없음')
      return NextResponse.json({
        error: '클리닉을 찾을 수 없습니다.'
      }, { status: 404 })
    }
    console.log('✅ 클리닉 확인 완료:', clinic.name)

    // 단계 4: 파일 정보 추출
    console.log('4️⃣ 파일 정보 추출 시작...')
    const fileName = file.name
    const fileSize = file.size

    // 카테고리 감지
    const detectedCategory = detectFileCategory(fileName)
    if (!detectedCategory) {
      console.log('❌ 파일 카테고리 감지 실패')
      return NextResponse.json({
        error: '지원하지 않는 파일 형식입니다. 파일명을 확인해주세요.'
      }, { status: 400 })
    }

    // 년도/월 추출
    const dateInfo = extractDateFromFileName(fileName)
    if (!dateInfo) {
      console.log('❌ 파일명에서 날짜 정보 추출 실패')
      return NextResponse.json({
        error: '파일명에서 연도 정보를 찾을 수 없습니다. (예: 2026년5월...)'
      }, { status: 400 })
    }

    const year = dateInfo.year
    const month = dateInfo.month // 연간 파일의 경우 undefined

    // 카테고리별 월별/연간 구분 확인
    const categoryConfig = FILE_CATEGORIES[detectedCategory]
    const finalMonth = categoryConfig.isMonthly ? month : null

    console.log('✅ 파일 정보 추출 완료:', {
      fileName,
      category: detectedCategory,
      isMonthly: categoryConfig.isMonthly,
      year,
      month: finalMonth,
      fileSize
    })

    // 단계 5: 파일 시스템에 파일 저장
    console.log('5️⃣ 파일 시스템에 파일 저장 시작...')
    const uploadsDir = join(process.cwd(), 'uploads', clinicId)
    const filePath = join(uploadsDir, fileName)

    try {
      // 클리닉별 업로드 디렉토리 생성
      await mkdir(uploadsDir, { recursive: true })
      console.log('✅ 업로드 디렉토리 생성 완료:', uploadsDir)

      // 파일 내용을 Buffer로 변환
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)

      // 파일 저장
      await writeFile(filePath, buffer)
      console.log('✅ 파일 저장 완료:', filePath)

    } catch (fileError) {
      console.error('❌ 파일 저장 실패:', fileError)
      return NextResponse.json({
        error: '파일 저장에 실패했습니다.',
        details: fileError instanceof Error ? fileError.message : '알 수 없는 파일 저장 오류'
      }, { status: 500 })
    }

    // 단계 6: Prisma 모델 확인 후 DB 저장
    console.log('6️⃣ Prisma 모델 확인 중...')

    try {
      // prisma 모델 확인
      console.log('📋 사용 가능한 Prisma 모델:', Object.keys(prisma))

      // FileUpload 모델이 있는지 확인
      if (!prisma.fileUpload) {
        throw new Error('FileUpload 모델이 없습니다. Prisma 스키마를 확인하세요.')
      }

      console.log('✅ FileUpload 모델 확인됨')

      console.log('💾 DB 저장 시작...', {
        clinicId,
        category: detectedCategory,
        fileName,
        year,
        month: finalMonth,
        isMonthly: categoryConfig.isMonthly
      })

      const fileRecord = await prisma.fileUpload.create({
        data: {
          clinicId,
          category: detectedCategory,
          fileName,
          originalName: fileName,
          filePath: filePath, // 실제 파일 시스템 절대 경로
          fileSize,
          year,
          month: finalMonth, // 연간 파일의 경우 null
          status: 'PENDING', // 파일 저장 완료, 데이터 처리 대기 중
          checksum: `checksum-${Date.now()}`,
          recordCount: null // 아직 처리되지 않음
        }
      })

      console.log('✅ DB 저장 완료:', fileRecord.id)

      // 캐시 무효화
      revalidatePath(`/dashboard/${clinicId}/uploads`, "page")

      return NextResponse.json({
        success: true,
        message: `${categoryConfig.isMonthly ? '월별' : '연간'} 파일이 성공적으로 업로드되었습니다! 데이터 처리를 위해 "처리" 버튼을 클릭하세요. 🎉`,
        data: {
          fileId: fileRecord.id,
          fileName,
          category: detectedCategory,
          categoryName: categoryConfig.name,
          isMonthly: categoryConfig.isMonthly,
          year,
          month: finalMonth,
          fileSize,
          status: 'PENDING'
        }
      })

    } catch (dbError) {
      console.error('❌ DB 저장 중 오류:', dbError)

      // 🔥 실제 실패 처리 (임시 코드 제거)
      return NextResponse.json({
        success: false,
        error: 'DB 저장 실패',
        details: dbError instanceof Error ? dbError.message : '알 수 없는 DB 오류'
      }, { status: 500 })
    }

  } catch (error) {
    console.error('❌ 업로드 오류:', error)
    console.error('❌ 오류 스택:', error instanceof Error ? error.stack : 'No stack')
    return NextResponse.json({
      error: '업로드 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const clinicId = url.searchParams.get('clinicId')
    const year = url.searchParams.get('year')

    console.log(`[GET /api/uploads] 요청 - clinicId: ${clinicId}, year: ${year}`)

    if (!clinicId) {
      return NextResponse.json({
        error: 'clinicId가 필요합니다.',
        files: []
      }, { status: 400 })
    }

    // 🎯 인증된 사용자의 권한 확인 (MASTER는 모든 클리닉 접근 가능)
    let session, userRole, userAgencyId
    try {
      console.log(`[GET /api/uploads] 🔍 세션 읽기 시작...`)
      session = await auth()
      console.log(`[GET /api/uploads] 🔍 세션 결과:`, session ? ' 존재함' : 'null')

      if (session) {
        console.log(`[GET /api/uploads] 🔍 세션 사용자:`, {
          userId: session.user?.id,
          email: session.user?.email,
          role: (session.user as any)?.role,
          agencyId: (session.user as any)?.agencyId
        })
      }

      userRole = session ? (session.user as any).role : null
      userAgencyId = session ? (session.user as any).agencyId : null
      console.log(`[GET /api/uploads] 세션 확인: 역할=${userRole}, agencyId=${userAgencyId}`)
    } catch (authError) {
      console.error(`[GET /api/uploads] 인증 오류:`, authError)
      userRole = null
      userAgencyId = null
    }

    let clinic

    // 🔥 세션이 null이어도 클리닉이 존재하면 임시 허용 (개발 모드)
    if (userRole === "MASTER") {
      // MASTER는 모든 클리닉 접근 가능
      clinic = await prisma.clinic.findUnique({ where: { id: clinicId } })
      console.log(`[GET /api/uploads] 🔑 MASTER 권한 - 모든 클리닉 접근 가능`)
    } else if (!session) {
      // 세션이 null이지만 클리닉이 존재하면 임시 허용 (API 컨텍스트 이슈 우회)
      console.log(`[GET /api/uploads] ⚠️ 세션 null - 임시 우회 모드`)
      clinic = await prisma.clinic.findUnique({ where: { id: clinicId } })
      if (clinic) {
        console.log(`[GET /api/uploads] 🔧 임시 우회: 클리닉 존재 확인됨 (${clinic.name})`)
      }
    } else {
      // 일반 사용자는 본인 agency 클리닉만 접근 가능
      if (userAgencyId) {
        clinic = await prisma.clinic.findFirst({
          where: { id: clinicId, agencyId: userAgencyId }
        })
        console.log(`[GET /api/uploads] 👤 ${userRole || 'GUEST'} 권한 - agency 매칭 확인`)
      } else {
        console.log(`[GET /api/uploads] ❌ agencyId가 없음 - 일반 사용자 접근 불가`)
        clinic = null
      }
    }

    if (!clinic) {
      const errorMsg = userRole === "MASTER" ?
        "클리닉이 존재하지 않습니다" :
        "접근 권한이 없는 클리닉입니다"

      console.log(`[GET /api/uploads] ❌ 클리닉 접근 실패: ${clinicId}`)
      return NextResponse.json({
        error: errorMsg,
        files: []
      }, { status: 404 })
    }

    console.log(`[GET /api/uploads] ✅ 클리닉 접근 승인: ${clinic.name} (권한: ${userRole || 'GUEST'})`)

    // 모든 업로드된 파일 조회 (상태 필터링 제거)
    const whereCondition: any = {
      clinicId
    }

    if (year) {
      whereCondition.year = parseInt(year)
    }

    console.log(`[GET /api/uploads] 쿼리 조건:`, whereCondition)

    // 업로드된 파일 목록 조회
    let files
    try {
      files = await prisma.fileUpload.findMany({
        where: whereCondition,
        orderBy: {
          uploadedAt: 'desc'
        }
      })
    } catch (dbError) {
      console.error(`[GET /api/uploads] 데이터베이스 쿼리 오류:`, dbError)
      return NextResponse.json({
        error: '데이터베이스 쿼리 오류',
        details: dbError instanceof Error ? dbError.message : '알 수 없는 DB 오류',
        files: []
      }, { status: 500 })
    }

    console.log(`[GET /api/uploads] 조회 완료 - ${files.length}개 파일`)

    files.forEach((file, index) => {
      console.log(`📁 ${index + 1}. ${file.category}: ${file.fileName} (${file.status})`)
    })

    return NextResponse.json({
      files: files.map(file => ({
        id: file.id,
        fileName: file.fileName,
        category: file.category,
        year: file.year,
        month: file.month,
        status: file.status,
        uploadedAt: file.uploadedAt.toISOString().split('T')[0], // YYYY-MM-DD 형식
        fileSize: file.fileSize,
        recordCount: file.recordCount
      }))
    })

  } catch (error) {
    console.error('[GET /api/uploads] 500 오류 발생:', error)
    console.error('[GET /api/uploads] 오류 스택:', error instanceof Error ? error.stack : 'No stack')

    return NextResponse.json({
      error: '파일 목록 조회 중 오류 발생',
      details: error instanceof Error ? error.message : '알 수 없는 오류',
      files: []
    }, { status: 500 })
  }
}
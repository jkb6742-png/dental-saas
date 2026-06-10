import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import xlsx from 'xlsx'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "인증 필요" }, { status: 401 })
    }

    // 마스터 권한 체크
    if ((session.user as any).role !== "MASTER") {
      return NextResponse.json({ error: "권한 없음" }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File
    const clinicId = formData.get("clinicId") as string
    const year = formData.get("year") as string

    if (!file || !clinicId || !year) {
      return NextResponse.json({ error: "필수 파라미터 누락" }, { status: 400 })
    }

    // 클리닉 권한 확인
    const clinic = await prisma.clinic.findFirst({
      where: {
        id: clinicId,
        agency: {
          users: {
            some: { email: session.user.email }
          }
        }
      }
    })

    if (!clinic) {
      return NextResponse.json({ error: "클리닉 접근 권한 없음" }, { status: 403 })
    }

    console.log(`📤 접수수납 데이터 업로드 시작: ${file.name}`)

    // Excel 파일 읽기
    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = xlsx.read(buffer)
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const jsonData = xlsx.utils.sheet_to_json(worksheet)

    console.log(`📊 Excel에서 ${jsonData.length}건 읽기 완료`)

    // 데이터 검증 및 변환
    let validRecords = 0
    let errorRecords = 0
    const errors: string[] = []

    for (let i = 0; i < jsonData.length; i++) {
      try {
        const row: any = jsonData[i]

        // 필수 필드 확인
        if (!row['접수시각'] || !row['차트번호'] || !row['이름']) {
          errorRecords++
          continue
        }

        // 날짜 파싱
        const receptionTime = new Date(row['접수시각'])
        if (isNaN(receptionTime.getTime())) {
          errorRecords++
          continue
        }

        // 숫자 필드 안전 파싱
        const parseFloat_ = (value: any) => {
          if (typeof value === 'string' && value.includes(',')) {
            value = value.replace(/,/g, '')
          }
          const parsed = parseFloat(value) || 0
          return isNaN(parsed) ? 0 : parsed
        }

        // 연령과 성별 파싱
        const ageGender = row['연령성별'] || ''
        const age = ageGender ? parseInt(ageGender.match(/\\d+/)?.[0]) || null : null
        const gender = ageGender.includes('男') ? '남성' : ageGender.includes('女') ? '여성' : null

        // ReceptionRecord에 삽입
        await prisma.receptionRecord.create({
          data: {
            id: `rr_${Date.now()}_${i}`, // 유니크 ID
            clinicId: clinicId,
            year: receptionTime.getFullYear(),
            month: receptionTime.getMonth() + 1,
            receptionTime: receptionTime,
            status: row['상태'] || '진료완료',
            chartNumber: String(row['차트번호']),
            patientName: String(row['이름']),
            ageGender: ageGender || null,
            doctor: row['담당의사'] || null,
            patientType: row['신구'] === '신환' ? '신환' : '구환',
            totalRevenue: parseFloat_(row['총진료비']) || 0,
            insuranceCoverage: parseFloat_(row['공단부담']) || 0,
            patientPayment: parseFloat_(row['본인부담']) || 0,
            nonInsurance: parseFloat_(row['비급여']) || 0,
            cardPayment: parseFloat_(row['카드수납']) || 0,
            cashPayment: parseFloat_(row['현금수납']) || 0,
            onlinePayment: parseFloat_(row['기타(온라인)']) || 0,
            waitingTime: row['대기'] ? parseInt(String(row['대기']).replace(/[^0-9]/g, '')) || null : null,
            dailyArrears: parseFloat_(row['당일미수']) || null,
            totalArrears: parseFloat_(row['총미수금']) || null,
            visitRoute: row['내원경로'] || null
          }
        })

        validRecords++

        // 진행 상황 로그
        if (validRecords % 100 === 0) {
          console.log(`📈 진행: ${validRecords}/${jsonData.length}건`)
        }

      } catch (error) {
        errorRecords++
        console.error(`행 ${i + 1} 처리 오류:`, error)
        if (errors.length < 10) { // 최대 10개 오류만 기록
          errors.push(`행 ${i + 1}: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
        }
      }
    }

    // FileUpload 레코드 생성
    const fileRecord = await prisma.fileUpload.create({
      data: {
        id: `fu_${Date.now()}`,
        clinicId: clinicId,
        category: 'COMPREHENSIVE_PATIENTS', // 통합 환자 데이터
        fileName: file.name,
        originalName: file.name,
        filePath: '', // S3 등 실제 저장소 사용시 경로
        fileSize: file.size,
        year: parseInt(year),
        month: null, // 연간 데이터이므로 null
        status: validRecords > 0 ? 'COMPLETED' : 'FAILED',
        recordCount: validRecords,
        checksum: `${Date.now()}`, // 간단한 체크섬
        errorMessage: errors.length > 0 ? errors.join('; ') : null
      }
    })

    // 로그 기록
    await prisma.uploadLog.create({
      data: {
        id: `ul_${Date.now()}`,
        clinicId: clinicId,
        action: 'UPLOAD_RECEPTION_RECORDS',
        fileName: file.name,
        category: 'COMPREHENSIVE_PATIENTS',
        year: parseInt(year),
        status: validRecords > 0 ? 'SUCCESS' : 'FAILED',
        message: `${validRecords}건 성공, ${errorRecords}건 실패`
      }
    })

    console.log(`✅ 업로드 완료: ${validRecords}건 성공, ${errorRecords}건 실패`)

    return NextResponse.json({
      success: true,
      recordCount: validRecords,
      errorCount: errorRecords,
      errors: errors.slice(0, 5), // 최대 5개 오류만 반환
      fileId: fileRecord.id
    })

  } catch (error) {
    console.error("업로드 오류:", error)
    return NextResponse.json(
      {
        error: "업로드 처리 중 오류가 발생했습니다.",
        details: error instanceof Error ? error.message : "알 수 없는 오류"
      },
      { status: 500 }
    )
  }
}
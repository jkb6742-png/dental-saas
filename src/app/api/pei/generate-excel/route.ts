import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { PeiExcelParser } from '@/lib/pei/excel-parser'
import { PeiDataAnalyzer } from '@/lib/pei/data-analyzer'
import { PeiReportGenerator } from '@/lib/pei/report-generator'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    // 마스터 권한 확인
    const userRole = (session.user as any).role
    if (userRole !== 'MASTER') {
      return NextResponse.json({ error: 'PEI 보고서 생성은 마스터 계정만 가능합니다' }, { status: 403 })
    }

    // FormData 파싱
    const formData = await request.formData()
    const file = formData.get('file') as File
    const clinicId = formData.get('clinicId') as string
    const year = parseInt(formData.get('year') as string)
    const month = parseInt(formData.get('month') as string)
    const title = formData.get('title') as string || `${year}년 ${month}월 PEI 보고서`
    const clinicName = formData.get('clinicName') as string || ''
    const doctorSpecialties = formData.get('doctorSpecialties') as string || ''

    // 입력 검증
    if (!file) {
      return NextResponse.json({ error: '엑셀 파일이 필요합니다' }, { status: 400 })
    }

    if (!clinicId || !year || !month) {
      return NextResponse.json({ error: '치과ID, 연도, 월 정보가 필요합니다' }, { status: 400 })
    }

    // 파일 형식 검증
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      return NextResponse.json({ error: '엑셀 파일(.xlsx, .xls)만 업로드 가능합니다' }, { status: 400 })
    }

    console.log(`🔄 PEI 보고서 생성 시작: ${clinicName} ${year}년 ${month}월`)

    // 치과 정보 확인
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      include: { agency: { select: { name: true } } }
    })

    if (!clinic) {
      return NextResponse.json({ error: '치과 정보를 찾을 수 없습니다' }, { status: 404 })
    }

    const actualClinicName = clinicName || clinic.name

    // 1단계: 엑셀 파일 파싱
    console.log('📊 1단계: 엑셀 파일 파싱 중...')
    const buffer = Buffer.from(await file.arrayBuffer())
    const parser = new PeiExcelParser()
    await parser.loadExcel(buffer)

    const allRows = parser.parseAllRows()
    console.log(`✅ 총 ${allRows.length}개 응답 파싱 완료`)
    console.log(`📋 매핑된 항목: ${parser.getMappings().length}개`)

    if (allRows.length === 0) {
      return NextResponse.json({ error: '엑셀 파일에서 유효한 데이터를 찾을 수 없습니다' }, { status: 400 })
    }

    // 2단계: 데이터 분석
    console.log('🔍 2단계: 데이터 분석 중...')

    // 이전 월 데이터도 함께 전달 (전월 비교용)
    const analyzer = new PeiDataAnalyzer(allRows, year, month, allRows)
    const analysisResult = analyzer.analyze()

    console.log(`✅ 분석 완료: 종합 점수 ${analysisResult.overallScore.toFixed(2)}점`)

    // 3단계: HTML 보고서 생성
    console.log('📝 3단계: HTML 보고서 생성 중...')

    const reportMetadata = {
      clinicName: actualClinicName,
      year,
      month,
      reportDate: new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    }

    const generator = new PeiReportGenerator(analysisResult, reportMetadata)
    const htmlContent = generator.generateHTML()

    // 4단계: 파일 저장
    console.log('💾 4단계: 파일 저장 중...')

    const reportsDir = join(process.cwd(), 'public', 'pei-reports')
    await mkdir(reportsDir, { recursive: true })

    const fileName = `${year}년${month}월_PEI보고서_${actualClinicName}.html`
    const filePath = join(reportsDir, fileName)
    await writeFile(filePath, htmlContent, 'utf8')

    const fileUrl = `/pei-reports/${fileName}`

    // 5단계: 데이터베이스 저장
    console.log('🗃️ 5단계: 데이터베이스 저장 중...')

    // 기존 보고서가 있는지 확인
    const existingReport = await prisma.peiReport.findFirst({
      where: {
        clinicId,
        year,
        month
      }
    })

    // 의사 전문분야 파싱
    const specialtiesMap: { [key: string]: string } = {}
    if (doctorSpecialties) {
      doctorSpecialties.split(',').forEach(item => {
        const [name, specialty] = item.split(':').map(s => s.trim())
        if (name && specialty) {
          specialtiesMap[name] = specialty
        }
      })
    }

    // 분석 결과를 의사 전문분야와 함께 업데이트
    const updatedDoctorComments = analysisResult.doctorComments.map(doctor => ({
      ...doctor,
      specialty: specialtiesMap[doctor.name] || '치과의사'
    }))

    const peiReportData = {
      clinicId,
      year,
      month,
      title,
      summary: `응답 ${analysisResult.responseCount}명, 평균 ${analysisResult.overallScore.toFixed(2)}점`,
      insights: {
        itemScores: analysisResult.itemScores,
        statusBadge: analysisResult.statusBadge,
        genderDistribution: analysisResult.genderDistribution,
        ageDistribution: analysisResult.ageDistribution
      },
      recommendations: {
        topAreas: Object.entries(analysisResult.itemScores)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 3)
          .map(([key, score]) => ({ key, score })),
        improvementAreas: Object.entries(analysisResult.itemScores)
          .sort(([,a], [,b]) => a - b)
          .slice(0, 3)
          .map(([key, score]) => ({ key, score }))
      },
      rawData: {
        responseCount: analysisResult.responseCount,
        doctorComments: updatedDoctorComments,
        staffComments: analysisResult.staffComments,
        facilityComments: analysisResult.facilityComments,
        namedStaffMembers: analysisResult.namedStaffMembers
      },
      peiScore: analysisResult.overallScore,
      categoryScores: analysisResult.itemScores,
      content: htmlContent,
      pdfUrl: fileUrl,
      status: 'COMPLETED',
      generatedAt: new Date(),
      generatedBy: (session.user as any).id
    }

    let savedReport
    if (existingReport) {
      // 기존 보고서 업데이트
      savedReport = await prisma.peiReport.update({
        where: { id: existingReport.id },
        data: peiReportData
      })
      console.log(`✅ 기존 보고서 업데이트 완료: ${savedReport.id}`)
    } else {
      // 새 보고서 생성
      savedReport = await prisma.peiReport.create({
        data: peiReportData
      })
      console.log(`✅ 새 보고서 생성 완료: ${savedReport.id}`)
    }

    // 6단계: 성공 응답
    console.log(`🎉 PEI 보고서 생성 완료!`)

    return NextResponse.json({
      success: true,
      report: {
        id: savedReport.id,
        title: savedReport.title,
        year: savedReport.year,
        month: savedReport.month,
        peiScore: savedReport.peiScore,
        responseCount: analysisResult.responseCount,
        fileUrl: fileUrl,
        summary: savedReport.summary
      },
      analysis: {
        overallScore: analysisResult.overallScore,
        statusBadge: analysisResult.statusBadge,
        responseCount: analysisResult.responseCount,
        itemScores: analysisResult.itemScores,
        hasComparison: !!analysisResult.previousMonthComparison
      }
    })

  } catch (error) {
    console.error('❌ PEI 보고서 생성 실패:', error)

    return NextResponse.json({
      error: '보고서 생성 중 오류가 발생했습니다',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

// GET: 특정 치과의 PEI 보고서 목록 조회
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const clinicId = searchParams.get('clinicId')

    if (!clinicId) {
      return NextResponse.json({ error: 'clinicId가 필요합니다' }, { status: 400 })
    }

    const reports = await prisma.peiReport.findMany({
      where: { clinicId },
      orderBy: [
        { year: 'desc' },
        { month: 'desc' }
      ],
      select: {
        id: true,
        title: true,
        year: true,
        month: true,
        peiScore: true,
        summary: true,
        status: true,
        generatedAt: true,
        pdfUrl: true
      }
    })

    return NextResponse.json({ reports })

  } catch (error) {
    console.error('❌ PEI 보고서 목록 조회 실패:', error)
    return NextResponse.json({ error: '보고서 목록 조회 중 오류가 발생했습니다' }, { status: 500 })
  }
}
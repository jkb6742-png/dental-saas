import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { prisma } from '@/lib/db'
import { parseExcelFile } from '@/lib/file-upload/file-utils'
import { parseExcel, FileType } from '@/lib/excel/parser'
import { FileCategory, FileStatus } from '@/lib/file-upload/file-config'

interface Props {
  params: Promise<{ fileId: string }>
}

export async function POST(request: NextRequest, { params }: Props) {
  try {
    const { fileId } = await params

    // 파일 정보 조회
    const fileUpload = await prisma.fileUpload.findUnique({
      where: { id: fileId }
    })

    if (!fileUpload) {
      return NextResponse.json({ error: '파일을 찾을 수 없습니다.' }, { status: 404 })
    }

    if (fileUpload.status === FileStatus.PROCESSING) {
      return NextResponse.json({ error: '이미 처리 중인 파일입니다.' }, { status: 400 })
    }

    // 파일 상태 업데이트
    await prisma.fileUpload.update({
      where: { id: fileId },
      data: { status: FileStatus.PROCESSING }
    })

    try {
      // 파일 읽기
      const buffer = await readFile(fileUpload.filePath)
      const parseResult = parseExcelFile(buffer)

      if (!parseResult.success) {
        throw new Error(`파일 파싱 실패: ${parseResult.error}`)
      }

      const { data, columns } = parseResult

      // 카테고리별 데이터 처리
      let processedCount = 0

      switch (fileUpload.category) {
        case FileCategory.MONTHLY_LEDGER:
          processedCount = await processMonthlyLedgerData(fileUpload, data!, columns!)
          break

        case FileCategory.COMPREHENSIVE_PATIENTS:
          processedCount = await processComprehensivePatientData(fileUpload, data!, columns!)
          break

        case FileCategory.TREATMENT_STATS:
          processedCount = await processTreatmentStatsData(fileUpload, data!, columns!)
          break

        case FileCategory.AGE_DISTRIBUTION:
          processedCount = await processAgeDistributionDataAdvanced(fileUpload, buffer)
          break

        case FileCategory.REGION_DISTRIBUTION:
          processedCount = await processRegionDistributionDataAdvanced(fileUpload, buffer)
          break

        case FileCategory.DAILY_PATIENTS:
          processedCount = await processDailyPatientsData(fileUpload, data!, columns!)
          break

        case FileCategory.VISIT_ROUTES:
          processedCount = await processVisitRoutesData(fileUpload, data!, columns!)
          break

        case FileCategory.IMPLANT_STATS:
          processedCount = await processImplantStatsData(fileUpload, data!, columns!)
          break

        case FileCategory.ANNUAL_LEDGER:
          processedCount = await processAnnualLedgerData(fileUpload, buffer)
          break

        default:
          throw new Error(`지원하지 않는 파일 카테고리입니다: ${fileUpload.category}`)
      }

      // 처리 완료 상태 업데이트
      await prisma.fileUpload.update({
        where: { id: fileId },
        data: {
          status: FileStatus.COMPLETED,
          processedAt: new Date(),
          recordCount: processedCount,
          errorMessage: null
        }
      })

      // 성공 로그 기록
      await prisma.uploadLog.create({
        data: {
          clinicId: fileUpload.clinicId,
          action: 'REPROCESS',
          fileName: fileUpload.fileName,
          category: fileUpload.category,
          year: fileUpload.year,
          month: fileUpload.month,
          status: 'SUCCESS',
          message: `데이터 처리 완료 (${processedCount}개 행)`
        }
      })

      return NextResponse.json({
        success: true,
        message: '데이터가 성공적으로 처리되었습니다.',
        processedCount
      })

    } catch (error) {
      // 실패 상태 업데이트
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'

      await prisma.fileUpload.update({
        where: { id: fileId },
        data: {
          status: FileStatus.FAILED,
          errorMessage
        }
      })

      // 실패 로그 기록
      await prisma.uploadLog.create({
        data: {
          clinicId: fileUpload.clinicId,
          action: 'REPROCESS',
          fileName: fileUpload.fileName,
          category: fileUpload.category,
          year: fileUpload.year,
          month: fileUpload.month,
          status: 'FAILED',
          message: errorMessage
        }
      })

      throw error
    }

  } catch (error) {
    console.error('데이터 처리 오류:', error)
    return NextResponse.json({
      error: '데이터 처리 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 })
  }
}

// 월간장부 데이터 처리
async function processMonthlyLedgerData(fileUpload: any, data: any[][], columns: string[]): Promise<number> {
  let processedCount = 0

  // 기존 데이터 삭제
  await prisma.dailyLedger.deleteMany({
    where: {
      clinicId: fileUpload.clinicId,
      year: fileUpload.year,
      month: fileUpload.month
    }
  })

  for (let i = 0; i < data.length; i++) {
    const row = data[i]
    if (!row || row.length === 0) continue

    try {
      const date = parseDate(row[0])
      if (!date) continue

      const cashIncome = parseFloat(row[1]) || 0
      const cardIncome = parseFloat(row[2]) || 0
      const onlineIncome = parseFloat(row[3]) || 0
      const insuranceClaim = parseFloat(row[4]) || 0
      const cashExpense = parseFloat(row[5]) || 0
      const cardExpense = parseFloat(row[6]) || 0

      await prisma.dailyLedger.create({
        data: {
          clinicId: fileUpload.clinicId,
          date,
          year: fileUpload.year,
          month: fileUpload.month,
          cashIncome,
          cardIncome,
          onlineIncome,
          insuranceClaim,
          cashExpense,
          cardExpense,
          totalIncome: cashIncome + cardIncome + onlineIncome,
          totalExpense: cashExpense + cardExpense,
          netTotal: (cashIncome + cardIncome + onlineIncome) - (cashExpense + cardExpense)
        }
      })

      processedCount++
    } catch (error) {
      console.warn(`월간장부 ${i + 2}행 처리 실패:`, error)
    }
  }

  return processedCount
}

// 통합 환자 데이터 처리 (신환+구환)
async function processComprehensivePatientData(fileUpload: any, data: any[][], columns: string[]): Promise<number> {
  let processedCount = 0

  console.log(`🚀🚀🚀 [통합환자데이터] 처리 시작 - 총 ${data.length}행 🚀🚀🚀`)
  console.log(`🚀🚀🚀 [통합환자데이터] 컬럼 수: ${columns.length} 🚀🚀🚀`)
  console.log(`🚀🚀🚀 [통합환자데이터] 헤더:`, columns.slice(0, 10).join(' | '))

  // 대기시간 컬럼 찾기
  const waitingTimeColumnIndex = findWaitingTimeColumnIndex(columns)
  console.log(`🔍 대기시간 컬럼 위치: ${waitingTimeColumnIndex} (컬럼명: "${columns[waitingTimeColumnIndex] || 'N/A'}")`)

  // 신구 컬럼 찾기
  const patientTypeColumnIndex = findPatientTypeColumnIndex(columns)
  console.log(`🔍 신구 컬럼 위치: ${patientTypeColumnIndex} (컬럼명: "${columns[patientTypeColumnIndex] || 'N/A'}")`)

  // 기존 데이터 삭제 (연간 데이터이므로 month는 null)
  await prisma.receptionRecord.deleteMany({
    where: {
      clinicId: fileUpload.clinicId,
      year: fileUpload.year
    }
  })

  // 전체 데이터 처리
  console.log(`🚀 [COMPREHENSIVE_PATIENTS] 전체 ${data.length}행 처리 시작`);

  for (let i = 0; i < data.length; i++) {
    const row = data[i]
    if (!row || row.length === 0) continue

    try {
      // 새로운 엑셀 구조에 맞춘 매핑
      // 헤더: 접수시각, 상태, 차트번호, 이름, 연령성별, 보험구분, 신구, ...
      console.log(`🔥🔥🔥 ROW ${i + 2} 원본 데이터: "${row[0]}" (타입: ${typeof row[0]}) 🔥🔥🔥`);
      const receptionTime = parseDate(row[0]) // 접수시각
      if (!receptionTime) {
        console.log(`❌❌❌ ROW ${i + 2} 시간 파싱 실패! 원본: "${row[0]}" ❌❌❌`);
        continue;
      }
      console.log(`✅✅✅ ROW ${i + 2} 시간 파싱 성공: ${receptionTime.getHours()}:${receptionTime.getMinutes()} ✅✅✅`);

      // 처음 5개만 매우 상세하게 로깅
      if (i < 5) {
        console.log(`📋📋📋 ROW ${i + 2} 전체 행 데이터:`, row.slice(0, 10));
      }

      // 신구 컬럼 동적으로 읽기
      let patientType = ''
      if (patientTypeColumnIndex >= 0) {
        patientType = String(row[patientTypeColumnIndex] || '').trim()
      }

      // 신환/구환 정규화
      if (patientType.includes('신환') || patientType === '신' || patientType.toLowerCase() === 'new') {
        patientType = '신환'
      } else if (patientType.includes('구환') || patientType === '구' || patientType.toLowerCase() === 'returning') {
        patientType = '구환'
      }

      // 대기시간 동적으로 읽기 ("31분" → 31)
      let waitingTime = 0
      if (waitingTimeColumnIndex >= 0) {
        waitingTime = parseWaitingTime(row[waitingTimeColumnIndex])
      }

      // 디버깅 로그 추가
      console.log(`[데이터파싱] ${i + 2}행 데이터 확인:`);
      console.log(`  - 접수시각 원본: "${row[0]}" (타입: ${typeof row[0]})`);
      console.log(`  - 신구 원본: "${row[patientTypeColumnIndex]}" → 정규화: "${patientType}"`);
      console.log(`  - 대기시간 원본: "${row[waitingTimeColumnIndex]}" → 파싱: ${waitingTime}분`);

      const visitRoute = String(row[35] || '') // 내원경로 컬럼

      console.log(`  - 파싱된 접수시각: ${receptionTime}`);
      console.log(`  - 시간 세부정보: ${receptionTime.getHours()}시 ${receptionTime.getMinutes()}분 ${receptionTime.getSeconds()}초`);
      console.log(`  - 파싱된 대기시간: ${waitingTime}분`);
      console.log(`  - 데이터베이스 저장 준비 완료`);

      // 첫 10행만 상세 로그
      if (i < 10) {
        console.log(`  - 전체 row[0~10]:`, row.slice(0, 11));
      }

      await prisma.receptionRecord.create({
        data: {
          clinicId: fileUpload.clinicId,
          year: fileUpload.year,
          month: receptionTime.getMonth() + 1, // 접수시각에서 월 추출
          receptionTime,
          status: String(row[1] || ''), // 상태
          chartNumber: String(row[2] || ''), // 차트번호
          patientName: String(row[3] || ''), // 이름
          ageGender: String(row[4] || ''), // 연령성별
          insuranceType: String(row[5] || ''), // 보험구분
          patientType, // 신구
          waitingTime, // 대기시간
          doctor: String(row[12] || ''), // 담당의사
          totalRevenue: parseFloat(row[20]) || 0, // 총진료비
          insuranceCoverage: parseFloat(row[21]) || 0, // 공단부담
          patientPayment: parseFloat(row[22]) || 0, // 본인부담
          nonInsurance: parseFloat(row[23]) || 0, // 비급여
          cardPayment: parseFloat(row[26]) || 0, // 카드수납
          cashPayment: parseFloat(row[27]) || 0, // 현금수납
          onlinePayment: parseFloat(row[28]) || 0, // 기타(온라인)
          dailyArrears: parseFloat(row[31]) || 0, // 당일미수
          totalArrears: parseFloat(row[32]) || 0, // 총미수금
          visitRoute // 내원경로
        }
      })

      processedCount++
      console.log(`  ✅ 데이터베이스 저장 완료 (${processedCount}/${maxRows})`);

      // 첫 3개 레코드는 저장 후 다시 조회해서 확인
      if (i < 3) {
        try {
          const savedRecord = await prisma.receptionRecord.findFirst({
            where: {
              clinicId: fileUpload.clinicId,
              patientName: String(row[3] || '')
            },
            orderBy: {
              createdAt: 'desc'
            }
          });

          if (savedRecord) {
            const savedDate = new Date(savedRecord.receptionTime);
            console.log(`  🔍 저장된 데이터 확인: ${savedDate.getHours()}시 ${savedDate.getMinutes()}분`);
          }
        } catch (checkError) {
          console.log(`  ⚠️ 저장 확인 오류:`, checkError);
        }
      }

      // 진행상황 로깅 (100행마다)
      if (processedCount % 100 === 0) {
        console.log(`[통합환자데이터] 처리 진행: ${processedCount}행 완료`)
      }

    } catch (error) {
      console.warn(`[통합환자데이터] ${i + 2}행 처리 실패:`, error)
    }
  }

  console.log(`[통합환자데이터] 처리 완료 - 총 ${processedCount}행 처리됨`)
  return processedCount
}

// 기존 환자 데이터 처리 함수 (호환성을 위해 유지)
async function processPatientData(fileUpload: any, data: any[][], columns: string[]): Promise<number> {
  // 새로운 통합 처리 함수로 리다이렉트
  return processComprehensivePatientData(fileUpload, data, columns)
}

// 진료통계 데이터 처리
async function processTreatmentStatsData(fileUpload: any, data: any[][], columns: string[]): Promise<number> {
  let processedCount = 0

  // 기존 데이터 삭제
  await prisma.treatmentStat.deleteMany({
    where: {
      clinicId: fileUpload.clinicId,
      year: fileUpload.year,
      month: fileUpload.month
    }
  })

  for (let i = 0; i < data.length; i++) {
    const row = data[i]
    if (!row || row.length === 0) continue

    const itemName = String(row[0] || '').trim()
    if (!itemName) continue

    try {
      await prisma.treatmentStat.create({
        data: {
          clinicId: fileUpload.clinicId,
          year: fileUpload.year,
          month: fileUpload.month,
          itemName,
          category: 'INSURANCE', // 기본값, 실제로는 분류 로직 필요
          patientCount: parseFloat(row[1]) || 0,
          visitCount: parseFloat(row[2]) || 0,
          revenue: parseFloat(row[3]) || 0,
          visitRatio: parseFloat(row[4]) || 0,
          revenueRatio: parseFloat(row[5]) || 0
        }
      })

      processedCount++
    } catch (error) {
      console.warn(`진료통계 ${i + 2}행 처리 실패:`, error)
    }
  }

  return processedCount
}

// 연령별 분포 데이터 처리 (기존 - 고정 컬럼 순서)
async function processAgeDistributionData(fileUpload: any, data: any[][], columns: string[]): Promise<number> {
  let processedCount = 0

  // 기존 데이터 삭제
  const deleteWhere: any = {
    clinicId: fileUpload.clinicId,
    year: fileUpload.year
  }

  if (fileUpload.month !== null && fileUpload.month !== undefined) {
    deleteWhere.month = fileUpload.month
  }

  await prisma.ageDist.deleteMany({
    where: deleteWhere
  })

  for (let i = 0; i < data.length; i++) {
    const row = data[i]
    if (!row || row.length === 0) continue

    const ageGroup = String(row[0] || '').trim()
    if (!ageGroup) continue

    try {
      const createData: any = {
        clinic: {
          connect: { id: fileUpload.clinicId }
        },
        year: fileUpload.year,
        ageGroup,
        totalPatients: parseFloat(row[1]) || 0,
        returningPatients: parseFloat(row[2]) || 0,
        newPatients: parseFloat(row[3]) || 0,
        avgRevenue: parseFloat(row[4]) || 0
      }

      if (fileUpload.month !== null && fileUpload.month !== undefined) {
        createData.month = fileUpload.month
      }

      await prisma.ageDist.create({
        data: createData
      })

      processedCount++
    } catch (error) {
      console.warn(`연령별 분포 ${i + 2}행 처리 실패:`, error)
    }
  }

  return processedCount
}

// 연령별 분포 데이터 처리 (고급 - 동적 컬럼명 매핑)
async function processAgeDistributionDataAdvanced(fileUpload: any, buffer: Buffer): Promise<number> {
  console.log(`[연령별분포] 고급 파서 시작 - 파일: ${fileUpload.fileName}`)

  try {
    // 정교한 파서 사용
    const parseResult = parseExcel(buffer, fileUpload.fileName)
    console.log(`[연령별분포] 파싱 결과 타입: ${parseResult.type}`)
    console.log(`[연령별분포] 파싱된 행 수: ${parseResult.rows.length}`)

    if (parseResult.type !== 'age_dist') {
      console.warn(`[연령별분포] 예상과 다른 파일 타입: ${parseResult.type}`)
    }

    // 기존 데이터 삭제
    const deleteWhere: any = {
      clinicId: fileUpload.clinicId,
      year: fileUpload.year
    }

    if (fileUpload.month !== null && fileUpload.month !== undefined) {
      deleteWhere.month = fileUpload.month
    }

    await prisma.ageDist.deleteMany({
      where: deleteWhere
    })

    let processedCount = 0

    for (const row of parseResult.rows) {
      if (row._type === 'age_dist' || parseResult.type === 'age_dist') {
        try {
          console.log(`[연령별분포] 처리 중인 행:`, JSON.stringify(row))

          const createData: any = {
            clinic: {
              connect: { id: fileUpload.clinicId }
            },
            year: fileUpload.year,
            ageGroup: String(row.ageGroup || ''),
            totalPatients: Number(row.totalPatients) || 0,
            returningPatients: Number(row.returningPatients) || 0,
            newPatients: Number(row.newPatients) || 0,
            avgRevenue: Number(row.avgRevenue) || 0
          }

          if (fileUpload.month !== null && fileUpload.month !== undefined) {
            createData.month = fileUpload.month
          }

          await prisma.ageDist.create({
            data: createData
          })

          processedCount++
          console.log(`[연령별분포] ${processedCount}번째 행 처리 완료`)
        } catch (error) {
          console.error(`[연령별분포] 행 처리 실패:`, error)
          console.error(`[연령별분포] 문제가 된 행:`, JSON.stringify(row))
        }
      }
    }

    console.log(`[연령별분포] 고급 파서 완료 - 처리된 행: ${processedCount}`)
    return processedCount

  } catch (error) {
    console.error(`[연령별분포] 고급 파서 실패:`, error)

    // 폴백: 기본 파서 사용
    console.log(`[연령별분포] 폴백으로 기본 파서 시도`)
    const parseResult = parseExcelFile(buffer)

    if (!parseResult.success) {
      throw new Error(`기본 파서도 실패: ${parseResult.error}`)
    }

    return await processAgeDistributionData(fileUpload, parseResult.data!, parseResult.columns!)
  }
}

// 지역별 분포 데이터 처리 (기존 - 고정 컬럼 순서)
async function processRegionDistributionData(fileUpload: any, data: any[][], columns: string[]): Promise<number> {
  let processedCount = 0

  // 기존 데이터 삭제
  const deleteWhere: any = {
    clinicId: fileUpload.clinicId,
    year: fileUpload.year
  }

  if (fileUpload.month !== null && fileUpload.month !== undefined) {
    deleteWhere.month = fileUpload.month
  }

  await prisma.regionDist.deleteMany({
    where: deleteWhere
  })

  for (let i = 0; i < data.length; i++) {
    const row = data[i]
    if (!row || row.length === 0) continue

    const region = String(row[0] || '').trim()
    if (!region) continue

    try {
      const createData: any = {
        clinicId: fileUpload.clinicId,
        year: fileUpload.year,
        region,
        totalPatients: parseFloat(row[1]) || 0,
        returningPatients: parseFloat(row[2]) || 0,
        newPatients: parseFloat(row[3]) || 0,
        totalVisits: parseFloat(row[4]) || 0,
        avgRevenue: parseFloat(row[5]) || 0
      }

      if (fileUpload.month !== null && fileUpload.month !== undefined) {
        createData.month = fileUpload.month
      }

      await prisma.regionDist.create({
        data: createData
      })

      processedCount++
    } catch (error) {
      console.warn(`지역별 분포 ${i + 2}행 처리 실패:`, error)
    }
  }

  return processedCount
}

// 지역별 분포 데이터 처리 (고급 - 동적 컬럼명 매핑)
async function processRegionDistributionDataAdvanced(fileUpload: any, buffer: Buffer): Promise<number> {
  console.log(`[지역별분포] 고급 파서 시작 - 파일: ${fileUpload.fileName}`)

  try {
    // 정교한 파서 사용
    const parseResult = parseExcel(buffer, fileUpload.fileName)
    console.log(`[지역별분포] 파싱 결과 타입: ${parseResult.type}`)
    console.log(`[지역별분포] 파싱된 행 수: ${parseResult.rows.length}`)

    if (parseResult.type !== 'region_dist') {
      console.warn(`[지역별분포] 예상과 다른 파일 타입: ${parseResult.type}`)
      // 그래도 시도해보기 위해 계속 진행
    }

    // 기존 데이터 삭제
    const deleteWhere: any = {
      clinicId: fileUpload.clinicId,
      year: fileUpload.year
    }

    if (fileUpload.month !== null && fileUpload.month !== undefined) {
      deleteWhere.month = fileUpload.month
    }

    await prisma.regionDist.deleteMany({
      where: deleteWhere
    })

    let processedCount = 0

    for (const row of parseResult.rows) {
      if (row._type === 'region_dist' || parseResult.type === 'region_dist') {
        try {
          console.log(`[지역별분포] 처리 중인 행:`, JSON.stringify(row))

          const createData: any = {
            clinicId: fileUpload.clinicId,
            year: fileUpload.year,
            region: String(row.region || ''),
            totalPatients: Number(row.totalPatients) || 0,
            returningPatients: Number(row.returningPatients) || 0,
            newPatients: Number(row.newPatients) || 0,
            totalVisits: Number(row.totalVisits) || 0,
            avgRevenue: Number(row.avgRevenue) || 0
          }

          if (fileUpload.month !== null && fileUpload.month !== undefined) {
            createData.month = fileUpload.month
          }

          await prisma.regionDist.create({
            data: createData
          })

          processedCount++
          console.log(`[지역별분포] ${processedCount}번째 행 처리 완료`)
        } catch (error) {
          console.error(`[지역별분포] 행 처리 실패:`, error)
          console.error(`[지역별분포] 문제가 된 행:`, JSON.stringify(row))
        }
      }
    }

    console.log(`[지역별분포] 고급 파서 완료 - 처리된 행: ${processedCount}`)
    return processedCount

  } catch (error) {
    console.error(`[지역별분포] 고급 파서 실패:`, error)

    // 폴백: 기본 파서 사용
    console.log(`[지역별분포] 폴백으로 기본 파서 시도`)
    const parseResult = parseExcelFile(buffer)

    if (!parseResult.success) {
      throw new Error(`기본 파서도 실패: ${parseResult.error}`)
    }

    return await processRegionDistributionData(fileUpload, parseResult.data!, parseResult.columns!)
  }
}

// 일별 환자수 데이터 처리
async function processDailyPatientsData(fileUpload: any, data: any[][], columns: string[]): Promise<number> {
  let processedCount = 0

  // 기존 데이터 삭제
  await prisma.patientStat.deleteMany({
    where: {
      clinicId: fileUpload.clinicId,
      year: fileUpload.year,
      month: fileUpload.month
    }
  })

  for (let i = 0; i < data.length; i++) {
    const row = data[i]
    if (!row || row.length === 0) continue

    try {
      const date = parseDate(row[0])
      if (!date) continue

      await prisma.patientStat.create({
        data: {
          clinicId: fileUpload.clinicId,
          date,
          year: fileUpload.year,
          month: fileUpload.month,
          workingDays: parseFloat(row[1]) || 0,
          newPatients: parseFloat(row[2]) || 0,
          totalVisits: parseFloat(row[3]) || 0,
          totalAppointments: parseFloat(row[4]) || 0,
          avgDailyNewPatients: parseFloat(row[5]) || 0,
          avgDailyAppointments: parseFloat(row[6]) || 0
        }
      })

      processedCount++
    } catch (error) {
      console.warn(`일별환자수 ${i + 2}행 처리 실패:`, error)
    }
  }

  return processedCount
}

// 내원경로 데이터 처리
async function processVisitRoutesData(fileUpload: any, data: any[][], columns: string[]): Promise<number> {
  let processedCount = 0

  // 기존 데이터 삭제
  await prisma.visitRoute.deleteMany({
    where: {
      clinicId: fileUpload.clinicId,
      year: fileUpload.year,
      month: fileUpload.month
    }
  })

  for (let i = 0; i < data.length; i++) {
    const row = data[i]
    if (!row || row.length === 0) continue

    const routeName = String(row[0] || '').trim()
    if (!routeName) continue

    try {
      await prisma.visitRoute.create({
        data: {
          clinicId: fileUpload.clinicId,
          year: fileUpload.year,
          month: fileUpload.month,
          routeName,
          totalVisitors: parseFloat(row[1]) || 0,
          returningPatients: parseFloat(row[2]) || 0,
          newPatients: parseFloat(row[3]) || 0,
          totalVisits: parseFloat(row[4]) || 0,
          avgRevenue: parseFloat(row[5]) || 0,
          totalRevenue: parseFloat(row[6]) || 0,
          acquisitionCost: parseFloat(row[7]) || 0
        }
      })

      processedCount++
    } catch (error) {
      console.warn(`내원경로 ${i + 2}행 처리 실패:`, error)
    }
  }

  return processedCount
}

// 임플란트 통계 데이터 처리
async function processImplantStatsData(fileUpload: any, data: any[][], columns: string[]): Promise<number> {
  let processedCount = 0

  // 기존 데이터 삭제
  await prisma.implantStat.deleteMany({
    where: {
      clinicId: fileUpload.clinicId,
      year: fileUpload.year,
      month: fileUpload.month
    }
  })

  for (let i = 0; i < data.length; i++) {
    const row = data[i]
    if (!row || row.length === 0) continue

    const fixtureName = String(row[0] || '').trim()
    if (!fixtureName) continue

    try {
      await prisma.implantStat.create({
        data: {
          clinicId: fileUpload.clinicId,
          year: fileUpload.year,
          month: fileUpload.month,
          fixtureName,
          surgeryCount: parseFloat(row[1]) || 0,
          usageCount: parseFloat(row[2]) || 0
        }
      })

      processedCount++
    } catch (error) {
      console.warn(`임플란트 통계 ${i + 2}행 처리 실패:`, error)
    }
  }

  return processedCount
}

// 실제 엑셀 데이터에 최적화된 날짜 파싱 함수
function parseDate(dateValue: any): Date | null {
  if (!dateValue) return null

  console.log(`🔥 [parseDate] 입력: "${dateValue}" (${typeof dateValue})`);

  // 실제 데이터는 문자열 형태: "2026-05-11 16:55:56"
  if (typeof dateValue === 'string') {
    const trimmed = dateValue.trim();

    try {
      // 직접 Date 생성자로 파싱 - 한국 시간 기준
      const result = new Date(trimmed);

      if (!isNaN(result.getTime())) {
        console.log(`✅ 파싱 성공: ${result.getHours()}:${result.getMinutes().toString().padStart(2,'0')}`);
        return result;
      }
    } catch (error) {
      console.error(`❌ 문자열 파싱 오류:`, error);
    }
  }

  // Excel 숫자 형태 (혹시 모를 경우)
  if (typeof dateValue === 'number') {
    try {
      const excelEpoch = new Date(1899, 11, 30);
      const wholeDays = Math.floor(dateValue);
      const timeFraction = dateValue - wholeDays;
      const targetDate = new Date(excelEpoch);
      targetDate.setDate(excelEpoch.getDate() + wholeDays);
      const totalMinutes = Math.round(timeFraction * 24 * 60);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      const result = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), hours, minutes);

      console.log(`✅ Excel 숫자 파싱: ${result.getHours()}:${result.getMinutes().toString().padStart(2,'0')}`);
      return result;
    } catch (error) {
      console.error(`❌ Excel 숫자 파싱 오류:`, error);
    }
  }

  // Date 객체인 경우
  if (dateValue instanceof Date && !isNaN(dateValue.getTime())) {
    console.log(`✅ Date 객체: ${dateValue.getHours()}:${dateValue.getMinutes().toString().padStart(2,'0')}`);
    return dateValue;
  }

  console.log(`❌ 파싱 실패`);
  return null;
}

// 대기시간 컬럼 인덱스 찾기
function findWaitingTimeColumnIndex(columns: string[]): number {
  const waitingTimeKeywords = ['대기시간', '대기', 'waiting', 'wait', '대기분', '대기(분)']

  for (let i = 0; i < columns.length; i++) {
    const column = String(columns[i] || '').toLowerCase().trim()
    if (waitingTimeKeywords.some(keyword => column.includes(keyword.toLowerCase()))) {
      return i
    }
  }

  console.warn('대기시간 컬럼을 찾을 수 없습니다. 사용 가능한 컬럼:', columns.slice(0, 15))
  return -1 // 대기시간 컬럼이 없음
}

// 대기시간 파싱 함수 ("31분" → 31)
function parseWaitingTime(value: any): number {
  if (!value) return 0

  const str = String(value).trim()
  console.log(`🔍 대기시간 파싱: "${str}"`)

  // "31분", "14분" 형태에서 숫자만 추출
  const match = str.match(/(\d+)\s*분?/)
  if (match) {
    const minutes = parseInt(match[1])
    console.log(`✅ 파싱 성공: ${minutes}분`)
    return minutes
  }

  // 순수 숫자인 경우
  const num = parseFloat(str)
  if (!isNaN(num)) {
    console.log(`✅ 숫자 파싱: ${num}분`)
    return num
  }

  console.log(`❌ 파싱 실패: "${str}"`)
  return 0
}

// 신구 컬럼 인덱스 찾기
function findPatientTypeColumnIndex(columns: string[]): number {
  const patientTypeKeywords = ['신구', '환자유형', '신환구환', '신/구', '환자구분']

  for (let i = 0; i < columns.length; i++) {
    const column = String(columns[i] || '').toLowerCase().trim()
    if (patientTypeKeywords.some(keyword => column.includes(keyword.toLowerCase()))) {
      return i
    }
  }

  // 백업: '신환'이 포함된 컬럼 찾기
  for (let i = 0; i < columns.length; i++) {
    const column = String(columns[i] || '').toLowerCase().trim()
    if (column.includes('신') || column.includes('구')) {
      return i
    }
  }

  console.warn('신구 컬럼을 찾을 수 없습니다. 6번째 컬럼을 기본값으로 사용합니다.')
  return 6 // 기본값
}

// 연간장부 데이터 처리
async function processAnnualLedgerData(fileUpload: any, buffer: ArrayBuffer): Promise<number> {
  try {
    console.log(`🏦 [연간장부] 처리 시작 - 클리닉: ${fileUpload.clinicId}`)

    // 연간장부 파서 사용
    const { rows } = parseExcel(buffer, fileUpload.filename)

    if (rows.length === 0) {
      console.log(`⚠️ [연간장부] 파싱된 데이터가 없습니다.`)
      return 0
    }

    console.log(`📊 [연간장부] 파싱된 데이터: ${rows.length}건`)

    // 기존 연간 요약 데이터 삭제 (해당 년도)
    const deletedCount = await prisma.monthlySummary.deleteMany({
      where: {
        clinicId: fileUpload.clinicId,
        year: fileUpload.year
      }
    })

    console.log(`🗑️ [연간장부] 기존 데이터 ${deletedCount.count}건 삭제`)

    let processedCount = 0

    // 각 월별 데이터 저장
    for (const row of rows) {
      if (row._type !== 'monthly_ledger_summary') continue

      try {
        await prisma.monthlySummary.create({
          data: {
            clinicId: fileUpload.clinicId,
            year: fileUpload.year,
            month: row.month as number,

            // 주요 지표 (스키마에 맞게 수정)
            totalRevenue: row.totalIncome as number || 0,
            totalExpense: row.totalExpense as number || 0,
            netProfit: row.netTotal as number || 0,

            // 수입 세분화
            cashIncome: row.cashIncome as number || 0,
            cardIncome: row.cardIncome as number || 0,
            insuranceClaim: row.insuranceClaim as number || 0,

            // 기타 필드들 (있으면 추가)
            nonInsuranceRevenue: (row.cashIncome as number || 0) + (row.cardIncome as number || 0)
          }
        })

        processedCount++
        console.log(`💾 [연간장부] ${row.month}월 데이터 저장 완료`)

      } catch (error) {
        console.error(`❌ [연간장부] ${row.month}월 데이터 저장 실패:`, error)
      }
    }

    console.log(`✅ [연간장부] 처리 완료 - 저장된 데이터: ${processedCount}건`)
    return processedCount

  } catch (error) {
    console.error('❌ [연간장부] 처리 중 오류:', error)
    throw error
  }
}
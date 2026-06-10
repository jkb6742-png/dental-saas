import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import JSZip from "jszip"

export const maxDuration = 120 // 2분 타임아웃
import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { parseExcel } from "@/lib/excel/parser"
import { recalcMonthlySummary } from "@/lib/analytics/monthly"

// ZIP 파일에서 엑셀 파일들 추출
async function extractExcelFilesFromZip(buffer: ArrayBuffer) {
  try {
    const zip = new JSZip()
    const zipFile = await zip.loadAsync(buffer)
    const excelFiles: { name: string; buffer: ArrayBuffer }[] = []

    for (const [filename, file] of Object.entries(zipFile.files)) {
      // 디렉토리나 숨김 파일 제외
      if (file.dir || filename.startsWith('__MACOSX/') || filename.startsWith('.')) continue

      // 엑셀 파일만 추출 (.xlsx, .xls)
      if (filename.match(/\.(xlsx|xls)$/i)) {
        const fileBuffer = await file.async('arraybuffer')
        excelFiles.push({ name: filename, buffer: fileBuffer })
        console.log(`[ZIP] 엑셀 파일 발견: ${filename}`)
      }
    }

    console.log(`[ZIP] 총 ${excelFiles.length}개 엑셀 파일 추출 완료`)
    return excelFiles
  } catch (error) {
    console.error(`[ZIP] 압축 해제 실패:`, error)
    throw new Error(`ZIP 파일 처리 중 오류: ${error}`)
  }
}

function clean(row: Record<string, unknown>) {
  const { _type, ...rest } = row
  return rest
}

function toDate(v: unknown): Date | undefined {
  if (!v || v === "null" || v === "undefined") return undefined
  const d = new Date(v as string)
  return isNaN(d.getTime()) ? undefined : d
}

function num(v: unknown): number | null {
  if (v == null || v === "" || v === "-") return null
  const n = parseFloat(String(v).replace(/,/g, "").replace(/%/g, ""))
  return isNaN(n) ? null : n
}

export async function POST(req: NextRequest) {
  console.log(`🚀🚀🚀 [UPLOAD API] 실제 업로드 API 호출됨!!! - ${new Date().toISOString()} 🚀🚀🚀`)
  console.log(`🔥 요청 URL: ${req.url}`)
  console.log(`🔥 요청 메소드: ${req.method}`)

  const session = await auth()
  console.log(`[UPLOAD API] 세션:`, session ? `사용자: ${session.user?.email}, 역할: ${(session.user as any)?.role}` : '세션 없음')

  if (!session) {
    console.log(`[UPLOAD API] 세션 없음 - Unauthorized`)
    return NextResponse.json({
      error: "로그인이 필요합니다",
      details: "세션을 찾을 수 없습니다. 다시 로그인해주세요."
    }, { status: 401 })
  }

  // 마스터 계정만 접근 가능 (임시로 완화)
  const userRole = (session.user as any).role
  console.log(`[UPLOAD API] 사용자 역할:`, userRole)

  if (userRole !== "MASTER" && userRole !== "ADMIN") {
    console.log(`[UPLOAD API] 권한 없음 - 마스터/관리자 계정 필요`)
    return NextResponse.json({
      error: "권한이 부족합니다",
      details: `현재 역할: ${userRole}, 필요 역할: MASTER 또는 ADMIN`
    }, { status: 403 })
  }

  const agencyId = (session.user as any).agencyId
  const form = await req.formData()
  const file = form.get("file") as File | null
  const clinicId = form.get("clinicId") as string | null

  console.log(`[UPLOAD API] 파라미터 - 파일: ${file?.name}, 크기: ${file?.size}, clinicId: ${clinicId}`)

  if (!file || !clinicId) {
    console.log(`[UPLOAD API] 파라미터 부족`)
    return NextResponse.json({ error: "file과 clinicId가 필요합니다" }, { status: 400 })
  }

  // 🎯 MASTER는 모든 클리닉 접근 가능, 다른 권한은 agency 매칭 확인
  let clinic
  if (userRole === "MASTER") {
    // MASTER는 모든 클리닉 접근 가능
    clinic = await prisma.clinic.findFirst({ where: { id: clinicId } })
    console.log(`[UPLOAD API] 🔑 MASTER 권한 - 모든 클리닉 접근 가능`)
    console.log(`[UPLOAD API] 클리닉 조회:`, clinic ? `✅ ${clinic.name} (${clinic.id})` : '❌ 없음')
  } else {
    // 일반 사용자는 본인 agency 클리닉만 접근 가능
    clinic = await prisma.clinic.findFirst({ where: { id: clinicId, agencyId } })
    console.log(`[UPLOAD API] 👤 ${userRole} 권한 - agency 매칭 확인`)
    console.log(`[UPLOAD API] 클리닉 조회:`, clinic ? `✅ ${clinic.name} (${clinic.id})` : '❌ 매칭 실패')
  }

  if (!clinic) {
    const errorMsg = userRole === "MASTER" ?
      "클리닉이 존재하지 않습니다" :
      "접근 권한이 없는 클리닉입니다"

    console.log(`[UPLOAD API] ❌ 클리닉 조회 실패`)
    return NextResponse.json({
      error: errorMsg,
      details: `클리닉 ID: ${clinicId}, 사용자 권한: ${userRole}`
    }, { status: 404 })
  }

  console.log(`✅ [UPLOAD API] 클리닉 접근 승인: ${clinic.name} (권한: ${userRole})`)

  const buffer = await file.arrayBuffer()
  console.log(`[UPLOAD API] 파일 읽기 완료 - ${buffer.byteLength} bytes`)

  // ZIP 파일인지 확인
  const isZipFile = file.name.toLowerCase().endsWith('.zip')
  console.log(`[UPLOAD API] ZIP 파일 여부:`, isZipFile)

  let allParsedData: { type: string; rows: any[] }[] = []

  if (isZipFile) {
    console.log(`[UPLOAD API] ZIP 파일 처리 시작: ${file.name}`)

    // ZIP 파일에서 엑셀 파일들 추출
    try {
      const excelFiles = await extractExcelFilesFromZip(buffer)
      console.log(`[UPLOAD API] ZIP에서 추출된 엑셀 파일 수:`, excelFiles.length)

      if (excelFiles.length === 0) {
        console.log(`[UPLOAD API] ZIP 파일 내 엑셀 파일 없음`)
        return NextResponse.json({
          error: `ZIP 파일 내에 엑셀 파일(.xlsx, .xls)이 없습니다: ${file.name}`
        }, { status: 400 })
      }

      // 각 엑셀 파일을 개별 파싱
      for (const excelFile of excelFiles) {
        try {
          console.log(`[UPLOAD API] ${excelFile.name} 파싱 시작`)
          const parsedData = parseExcel(excelFile.buffer, excelFile.name)
          allParsedData.push(parsedData)
          console.log(`[UPLOAD API] ${excelFile.name} 파싱 완료: ${parsedData.type}, ${parsedData.rows.length}개 행`)
        } catch (error) {
          console.error(`[UPLOAD API] ${excelFile.name} 파싱 실패:`, error)
          return NextResponse.json({
            error: `ZIP 내 파일 파싱 실패: ${excelFile.name} - ${error}`
          }, { status: 400 })
        }
      }
    } catch (error) {
      console.error(`[UPLOAD API] ZIP 처리 실패:`, error)
      return NextResponse.json({
        error: `ZIP 파일 처리 실패: ${error}`
      }, { status: 400 })
    }
  } else {
    // 단일 엑셀 파일 처리 (기존 로직)
    console.log(`[UPLOAD API] 단일 엑셀 파일 처리 시작: ${file.name}`)
    try {
      const parsedData = parseExcel(buffer, file.name)
      allParsedData.push(parsedData)
      console.log(`[UPLOAD API] 파싱 완료: ${parsedData.type}, ${parsedData.rows.length}개 행`)
    } catch (error) {
      console.error(`[UPLOAD API] 파싱 실패:`, error)
      return NextResponse.json({
        error: `파일 파싱 실패: ${error}`
      }, { status: 400 })
    }
  }

  // 파싱 결과 통합 정보 출력
  const typesSummary = allParsedData.reduce((acc, data) => {
    acc[data.type] = (acc[data.type] || 0) + data.rows.length
    return acc
  }, {} as Record<string, number>)

  console.log(`[UPLOAD] 파싱 완료:`, typesSummary)

  // unknown 타입 체크
  const unknownFiles = allParsedData.filter(data => data.type === "unknown")
  if (unknownFiles.length > 0) {
    return NextResponse.json({
      error: `파일 유형을 판별할 수 없습니다: ${unknownFiles.length}개 파일`
    }, { status: 400 })
  }

  let created = 0
  let skipped = 0
  const errors: string[] = []
  const affectedMonths = new Set<string>()
  const processedTypes = new Set<string>()
  const uploadedFiles: string[] = [] // 업로드 기록을 위한 배열

  try {
    console.log(`🔥🔥🔥 데이터베이스 저장 시작!!! 🔥🔥🔥`)
    console.log(`💾 저장할 데이터 타입 수: ${allParsedData.length}`)

    // 모든 파싱된 데이터 순회 처리
    for (const { type, rows } of allParsedData) {
      console.log(`🔥 [UPLOAD] DB 저장 처리 중: ${type}, ${rows.length}개 행`)
      processedTypes.add(type)

      // 파일명 결정 (ZIP이면 개별 파일명, 아니면 원본 파일명)
      const currentFileName = isZipFile ?
        (allParsedData.find(data => data.type === type) as any)?.fileName || file.name :
        file.name

      if (type === "monthly_ledger") {
      const payloads = rows
        .map((row) => {
          const d = clean(row as any)
          const date = toDate(d.date)
          if (!date) return null
          affectedMonths.add(`${d.year}-${d.month}`)
          return {
            clinicId, date,
            month: d.month as number, year: d.year as number,
            cashIncome: num(d.cashIncome), cardIncome: num(d.cardIncome),
            onlineIncome: num(d.onlineIncome), receiptIssued: num(d.receiptIssued),
            insuranceClaim: num(d.insuranceClaim), cashExpense: num(d.cashExpense),
            cardExpense: num(d.cardExpense), onlineExpense: num(d.onlineExpense),
            cardFee: num(d.cardFee), totalIncome: num(d.totalIncome),
            totalExpense: num(d.totalExpense), netTotal: num(d.netTotal),
          }
        })
        .filter(Boolean) as any[]

      console.log(`💾 monthly_ledger DB 저장 시작: ${payloads.length}개`)
      for (const p of payloads) {
        await prisma.dailyLedger.upsert({
          where: { clinicId_date: { clinicId, date: p.date } },
          create: p, update: p,
        })
        created++
      }
      console.log(`✅ monthly_ledger DB 저장 완료: ${payloads.length}개`)

    } else if (type === "patient_stats") {
      console.log(`[PATIENT_STATS DEBUG] 처리 시작, 총 ${rows.length}개 행`)

      const payloads = rows
        .map((row, index) => {
          const d = clean(row as any)
          console.log(`[PATIENT_STATS DEBUG] 행 ${index + 1} 처리중:`, JSON.stringify(d, null, 2))

          const date = toDate(d.date)
          if (!date) {
            console.log(`[PATIENT_STATS DEBUG] 행 ${index + 1} - 날짜 파싱 실패:`, d.date)
            return null
          }

          affectedMonths.add(`${d.year}-${d.month}`)
          const payload = {
            clinicId, date,
            month: d.month as number, year: d.year as number,
            workingDays: num(d.workingDays), newPatients: num(d.newPatients),
            totalVisits: num(d.totalVisits), totalAppointments: num(d.totalAppointments),
            avgDailyNewPatients: num(d.avgDailyNewPatients), avgDailyAppointments: num(d.avgDailyAppointments),
          }
          console.log(`[PATIENT_STATS DEBUG] 행 ${index + 1} 변환 결과:`, JSON.stringify(payload, null, 2))
          return payload
        })
        .filter(Boolean) as any[]

      console.log(`[PATIENT_STATS DEBUG] 유효한 데이터: ${payloads.length}개`)

      for (const p of payloads) {
        try {
          await prisma.patientStat.upsert({
            where: { clinicId_date: { clinicId, date: p.date } },
            create: p, update: p,
          })
          created++
          console.log(`[PATIENT_STATS DEBUG] DB 저장 성공:`, p.date)
        } catch (error) {
          console.error(`[PATIENT_STATS DEBUG] DB 저장 실패:`, error)
          errors.push(`DB 저장 실패: ${error}`)
        }
      }

    } else if (type === "daily_ledgers" || type === "monthly_ledger" || type === "annual_ledger") {
      console.log(`[DAILY_LEDGER] 일별 매출 데이터 처리 시작: ${rows.length}개 행`)

      const payloads = rows.map((row, index) => {
        const d = clean(row as any)

        // 날짜 파싱
        let date: Date
        try {
          if (d.date) {
            date = new Date(d.date as string)
          } else {
            // 년도/월/일이 따로 있는 경우
            const year = d.year || d.Year || d['연도']
            const month = d.month || d.Month || d['월']
            const day = d.day || d.Day || d.date || d.Date || d['일'] || 1
            date = new Date(Number(year), Number(month) - 1, Number(day))
          }

          if (isNaN(date.getTime())) {
            console.warn(`[DAILY_LEDGER] 잘못된 날짜 형식: 행 ${index + 1}`)
            return null
          }
        } catch (error) {
          console.warn(`[DAILY_LEDGER] 날짜 파싱 실패: 행 ${index + 1}`, error)
          return null
        }

        const year = date.getFullYear()
        const month = date.getMonth() + 1

        affectedMonths.add(`${year}-${month}`)

        const payload = {
          clinicId,
          date,
          month,
          year,
          cashIncome: num(d.cashIncome) || num(d['현금수입']) || num(d['현금매출']),
          cardIncome: num(d.cardIncome) || num(d['카드수입']) || num(d['카드매출']),
          onlineIncome: num(d.onlineIncome) || num(d['온라인수입']) || num(d['온라인매출']),
          receiptIssued: num(d.receiptIssued) || num(d['영수증발행액']),
          insuranceClaim: num(d.insuranceClaim) || num(d['보험청구액']) || num(d['급여매출']),
          cashExpense: num(d.cashExpense) || num(d['현금지출']),
          cardExpense: num(d.cardExpense) || num(d['카드지출']),
          onlineExpense: num(d.onlineExpense) || num(d['온라인지출']),
          cardFee: num(d.cardFee) || num(d['카드수수료']),
          totalIncome: num(d.totalIncome) || num(d['총매출']) || num(d['총수입']),
          totalExpense: num(d.totalExpense) || num(d['총지출']),
          netTotal: num(d.netTotal) || num(d['순매출']) || num(d['순수익'])
        }

        // totalIncome이 없으면 계산
        if (!payload.totalIncome) {
          payload.totalIncome = (payload.cashIncome || 0) + (payload.cardIncome || 0) + (payload.onlineIncome || 0) + (payload.insuranceClaim || 0)
        }

        // netTotal이 없으면 계산
        if (!payload.netTotal && payload.totalIncome && payload.totalExpense) {
          payload.netTotal = payload.totalIncome - payload.totalExpense
        }

        console.log(`[DAILY_LEDGER] 행 ${index + 1} 변환:`, {
          date: date.toISOString().split('T')[0],
          totalIncome: payload.totalIncome,
          totalExpense: payload.totalExpense,
          netTotal: payload.netTotal
        })

        return payload
      }).filter(Boolean) as any[]

      console.log(`[DAILY_LEDGER] 유효한 데이터: ${payloads.length}개`)

      for (const p of payloads) {
        try {
          await prisma.dailyLedger.upsert({
            where: { clinicId_date: { clinicId, date: p.date } },
            create: p,
            update: p,
          })
          created++
          console.log(`[DAILY_LEDGER] DB 저장 성공: ${p.date.toISOString().split('T')[0]}`)
        } catch (error) {
          console.error(`[DAILY_LEDGER] DB 저장 실패:`, error)
          errors.push(`일별매출 저장 실패: ${error}`)
        }
      }

    } else if (type === "treatment_stats") {
      const payloads = rows.map((row) => {
        const d = clean(row as any)
        affectedMonths.add(`${d.year}-${d.month}`)
        return {
          clinicId, year: d.year as number, month: d.month as number,
          itemName: d.itemName as string, category: d.category as any,
          patientCount: num(d.patientCount), visitCount: num(d.visitCount),
          revenue: num(d.revenue), visitRatio: num(d.visitRatio), revenueRatio: num(d.revenueRatio),
        }
      })

      for (const p of payloads) {
        await prisma.treatmentStat.upsert({
          where: { clinicId_year_month_itemName: { clinicId, year: p.year, month: p.month, itemName: p.itemName } },
          create: p, update: p,
        })
        created++
      }

    } else if (type === "visit_routes") {
      const payloads = rows.map((row) => {
        const d = clean(row as any)
        affectedMonths.add(`${d.year}-${d.month}`)
        const newP = num(d.newPatients) ?? 0
        const totalRev = num(d.totalRevenue) ?? 0
        return {
          clinicId, year: d.year as number, month: d.month as number,
          routeName: d.routeName as string,
          totalVisitors: num(d.totalVisitors), returningPatients: num(d.returningPatients),
          newPatients: newP, totalVisits: num(d.totalVisits),
          avgRevenue: num(d.avgRevenue), totalRevenue: totalRev,
          acquisitionCost: newP > 0 ? totalRev / newP : null,
        }
      })

      for (const p of payloads) {
        await prisma.visitRoute.upsert({
          where: { clinicId_year_month_routeName: { clinicId, year: p.year, month: p.month, routeName: p.routeName } },
          create: p, update: p,
        })
        created++
      }

    } else if (type === "treatment_plans") {
      for (const row of rows) {
        const d = clean(row as any)
        await prisma.treatmentPlan.create({
          data: {
            clinicId,
            patientName: d.patientName as string,
            chartNumber: d.chartNumber as string ?? null,
            writtenDate: toDate(d.writtenDate) ?? null,
            lastVisit: toDate(d.lastVisit) ?? null,
            nextAppointment: toDate(d.nextAppointment) ?? null,
            status: d.status as any ?? null,
            paymentStatus: d.paymentStatus as any ?? null,
            doctor: d.doctor as string ?? null,
            counselor: d.counselor as string ?? null,
            planContent: d.planContent as string ?? null,
            contractAmount: num(d.contractAmount), remainingAmount: num(d.remainingAmount),
            month: d.month as number ?? null, year: d.year as number ?? null,
          },
        })
        if (d.year && d.month) affectedMonths.add(`${d.year}-${d.month}`)
        created++
      }

    } else if (type === "implant_stats") {
      const payloads = rows.map((row) => {
        const d = clean(row as any)
        return {
          clinicId, year: d.year as number, month: d.month as number,
          fixtureName: d.fixtureName as string,
          surgeryCount: num(d.surgeryCount), usageCount: num(d.usageCount),
        }
      })
      for (const p of payloads) {
        await prisma.implantStat.upsert({
          where: { clinicId_year_month_fixtureName: { clinicId, year: p.year, month: p.month, fixtureName: p.fixtureName } },
          create: p, update: p,
        })
        created++
      }

    } else if (type === "consultation_stats") {
      const payloads = rows.map((row) => {
        const d = clean(row as any)
        return {
          clinicId, year: d.year as number, month: d.month as number,
          counselorName: d.counselorName as string,
          planCount: num(d.planCount), confirmedCount: num(d.confirmedCount),
          confirmationRate: num(d.confirmationRate), patientCount: num(d.patientCount),
          confirmedPatients: num(d.confirmedPatients), patientConfirmRate: num(d.patientConfirmRate),
          confirmedAmount: num(d.confirmedAmount), avgDiscountRate: num(d.avgDiscountRate),
        }
      })
      for (const p of payloads) {
        await prisma.consultationStat.upsert({
          where: { clinicId_year_month_counselorName: { clinicId, year: p.year, month: p.month, counselorName: p.counselorName } },
          create: p, update: p,
        })
        created++
      }

    } else if (type === "reception_records" || type === "new_patient_records" || type === "all_patient_records") {
      // createMany로 배치 처리 (가장 큰 파일)
      const BATCH = 200
      const payloads = rows.map((row) => {
        const d = clean(row as any)
        if (d.year && d.month) affectedMonths.add(`${d.year}-${d.month}`)
        return {
          clinicId, year: d.year as number, month: d.month as number,
          receptionTime: toDate(d.receptionTime) ?? null,
          status: d.status as string ?? null,
          chartNumber: d.chartNumber as string ?? null,
          patientName: d.patientName as string ?? null,
          ageGender: d.ageGender as string ?? null,
          insuranceType: d.insuranceType as string ?? null,
          patientType: d.patientType as string ?? null,
          doctor: d.doctor as string ?? null,
          totalRevenue: num(d.totalRevenue), insuranceCoverage: num(d.insuranceCoverage),
          patientPayment: num(d.patientPayment), nonInsurance: num(d.nonInsurance),
          cardPayment: num(d.cardPayment), cashPayment: num(d.cashPayment),
          onlinePayment: num(d.onlinePayment), dailyArrears: num(d.dailyArrears),
          totalArrears: num(d.totalArrears), visitRoute: d.visitRoute as string ?? null,
          waitingTime: num(d.waitingTime),
        }
      })

      for (let i = 0; i < payloads.length; i += BATCH) {
        const batch = payloads.slice(i, i + BATCH)
        const result = await prisma.receptionRecord.createMany({ data: batch, skipDuplicates: false })
        created += result.count
      }

    } else if (type === "age_dist") {
      const payloads = rows.map((row) => {
        const d = clean(row as any)
        return {
          clinicId, year: d.year as number, month: d.month as number,
          ageGroup: d.ageGroup as string,
          totalPatients: num(d.totalPatients), returningPatients: num(d.returningPatients),
          newPatients: num(d.newPatients), avgRevenue: num(d.avgRevenue),
        }
      })
      for (const p of payloads) {
        await prisma.ageDist.upsert({
          where: { clinicId_year_month_ageGroup: { clinicId, year: p.year, month: p.month, ageGroup: p.ageGroup } },
          create: p, update: p,
        })
        created++
      }

    } else if (type === "region_dist") {
      const payloads = rows.map((row) => {
        const d = clean(row as any)
        return {
          clinicId, year: d.year as number, month: d.month as number,
          region: d.region as string,
          totalPatients: num(d.totalPatients), returningPatients: num(d.returningPatients),
          newPatients: num(d.newPatients), totalVisits: num(d.totalVisits), avgRevenue: num(d.avgRevenue),
        }
      })
      for (const p of payloads) {
        await prisma.regionDist.upsert({
          where: { clinicId_year_month_region: { clinicId, year: p.year, month: p.month, region: p.region } },
          create: p, update: p,
        })
        created++
      }
    }
    } // for 루프 종료

    // 성공적으로 처리된 파일들을 FileUpload 테이블에 기록
    if (isZipFile) {
      // ZIP 파일의 경우 각 엑셀 파일별로 기록
      for (const data of allParsedData) {
        const fileName = (allParsedData.find(d => d.type === data.type) as any)?.fileName || `${data.type}.xlsx`

        // 파일명에서 년도/월 추출
        const yearMatch = fileName.match(/(\d{4})년/)
        const monthMatch = fileName.match(/(\d{1,2})월/)

        const extractedYear = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear()
        const extractedMonth = monthMatch ? parseInt(monthMatch[1]) : null

        // 🔥 ZIP 내 FileUpload 저장 - 카테고리 매핑 수정
        try {
          console.log(`💾 ZIP FileUpload 저장 시도: ${fileName}`)

          // 동일한 카테고리 매핑 적용
          const categoryMap: Record<string, string> = {
            'age_dist': 'AGE_DISTRIBUTION',
            'region_dist': 'REGION_DISTRIBUTION',
            'monthly_ledger': 'MONTHLY_LEDGER',
            'annual_ledger': 'ANNUAL_LEDGER',
            'treatment_stats': 'TREATMENT_STATS',
            'implant_stats': 'IMPLANT_STATS',
            'reception_records': 'COMPREHENSIVE_PATIENTS',
            'new_patient_records': 'COMPREHENSIVE_PATIENTS',
            'all_patient_records': 'COMPREHENSIVE_PATIENTS',
            'visit_routes': 'VISIT_ROUTES',
            'patient_stats': 'DAILY_PATIENTS'
          }

          const mappedCategory = categoryMap[data.type] || data.type.toUpperCase()
          console.log(`🔄 ZIP 카테고리 매핑: "${data.type}" → "${mappedCategory}"`)

          const fileRecord = await prisma.fileUpload.create({
            data: {
              clinicId,
              fileName,
              originalName: fileName,
              filePath: `/uploads/${fileName}`,
              fileSize: file.size,
              category: mappedCategory as any,
              year: extractedYear,
              month: extractedMonth,
              status: 'COMPLETED',
              checksum: `${fileName}-${Date.now()}`,
              recordCount: data.rows.length,
            }
          })
          console.log(`✅ ZIP FileUpload 저장 성공: ${fileRecord.id}`)
          uploadedFiles.push(fileName)
        } catch (fileUploadError) {
          console.error(`❌ ZIP FileUpload 저장 실패: ${fileName}`, fileUploadError)
          errors.push(`ZIP FileUpload 저장 실패: ${fileName} - ${fileUploadError}`)
        }
      }
    } else {
      // 단일 파일의 경우
      const data = allParsedData[0]

      // 🔥 강화된 년도/월 추출 로직
      const yearMatch = file.name.match(/(\d{4})년?/)
      let monthMatch = file.name.match(/(\d{1,2})월/)

      // 추가 월 패턴들
      if (!monthMatch) {
        monthMatch = file.name.match(/(\d{1,2})월/) ||
                    file.name.match(/^(\d{1,2})월/) ||
                    file.name.match(/_(\d{1,2})월/) ||
                    file.name.match(/(\d{1,2})월_/) ||
                    file.name.match(/month(\d{1,2})/i) ||
                    file.name.match(/m(\d{1,2})/i)
      }

      const extractedYear = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear()
      const extractedMonth = monthMatch ? parseInt(monthMatch[1]) : null

      console.log(`🔥 === 파일명 파싱 상세 ===`)
      console.log(`📄 파일명: "${file.name}"`)
      console.log(`🔍 yearMatch:`, yearMatch)
      console.log(`🔍 monthMatch:`, monthMatch)
      console.log(`📅 추출된 년도: ${extractedYear} (${typeof extractedYear})`)
      console.log(`📅 추출된 월: ${extractedMonth} (${typeof extractedMonth})`)
      console.log(`🔥 === 파싱 완료 ===`)

      // 🔥 FileUpload 저장 - 카테고리 매핑 수정
      try {
        console.log(`💾 FileUpload 저장 시도: ${file.name}`)

        // 파일 타입을 올바른 FileCategory로 매핑
        const categoryMap: Record<string, string> = {
          'age_dist': 'AGE_DISTRIBUTION',
          'region_dist': 'REGION_DISTRIBUTION',
          'monthly_ledger': 'MONTHLY_LEDGER',
          'annual_ledger': 'ANNUAL_LEDGER',
          'treatment_stats': 'TREATMENT_STATS',
          'implant_stats': 'IMPLANT_STATS',
          'reception_records': 'COMPREHENSIVE_PATIENTS',
          'new_patient_records': 'COMPREHENSIVE_PATIENTS',
          'all_patient_records': 'COMPREHENSIVE_PATIENTS',
          'visit_routes': 'VISIT_ROUTES',
          'patient_stats': 'DAILY_PATIENTS'
        }

        const mappedCategory = categoryMap[data.type] || data.type.toUpperCase()
        console.log(`🔄 카테고리 매핑: "${data.type}" → "${mappedCategory}"`)

        const fileRecord = await prisma.fileUpload.create({
          data: {
            clinicId,
            fileName: file.name,
            originalName: file.name,
            filePath: `/uploads/${file.name}`,
            fileSize: file.size,
            category: mappedCategory as any, // 매핑된 카테고리 사용
            year: extractedYear,
            month: extractedMonth,
            status: 'COMPLETED',
            checksum: `${file.name}-${Date.now()}`,
            recordCount: data.rows.length,
          }
        })
        console.log(`✅ FileUpload 저장 성공: ${fileRecord.id}`)
        uploadedFiles.push(file.name)
      } catch (fileUploadError) {
        console.error(`❌ FileUpload 저장 실패: ${file.name}`, fileUploadError)
        errors.push(`FileUpload 저장 실패: ${file.name} - ${fileUploadError}`)
      }
    }

    console.log(`[UPLOAD] FileUpload 기록 저장 완료: ${uploadedFiles.join(', ')}`)

  } catch (e: any) {
    errors.push(String(e?.message ?? e).slice(0, 200))
  }

  // 월간 KPI 재집계
  for (const key of affectedMonths) {
    const [y, m] = key.split("-").map(Number)
    try { await recalcMonthlySummary(clinicId, y, m) }
    catch (e) { errors.push(`집계 오류 (${key}): ${String(e).slice(0, 100)}`) }
  }

  // ReceptionRecord가 업로드된 경우 PatientStat 자동 생성
  if ((processedTypes.has("reception_records") || processedTypes.has("new_patient_records") || processedTypes.has("all_patient_records")) && created > 0) {
    console.log(`[UPLOAD] ReceptionRecord 업로드 완료, PatientStat 자동 생성 시도`)
    try {
      const { generatePatientStatsFromReception } = await import("@/lib/analytics/patient-stats")

      for (const key of affectedMonths) {
        const [y, m] = key.split("-").map(Number)
        console.log(`[UPLOAD] ${y}년 ${m}월 PatientStat 생성 중...`)
        const result = await generatePatientStatsFromReception(clinicId, y, m)
        console.log(`[UPLOAD] ${y}년 ${m}월 PatientStat 생성 완료: ${result.created}개`)
      }
    } catch (e) {
      console.error(`[UPLOAD] PatientStat 자동 생성 오류:`, e)
      errors.push(`환자통계 자동생성 오류: ${String(e).slice(0, 100)}`)
    }
  }

  // 기존 ReceptionRecord가 있는데 PatientStat이 없는 경우에도 생성
  if (!processedTypes.has("reception_records")) {
    try {
      const existingReceptionCount = await prisma.receptionRecord.count({ where: { clinicId } })
      const existingPatientStatCount = await prisma.patientStat.count({ where: { clinicId } })

      if (existingReceptionCount > 0 && existingPatientStatCount === 0) {
        console.log(`[UPLOAD] 기존 ReceptionRecord ${existingReceptionCount}개 발견, PatientStat 생성 시도`)
        const { generatePatientStatsFromReception } = await import("@/lib/analytics/patient-stats")
        const result = await generatePatientStatsFromReception(clinicId)
        console.log(`[UPLOAD] 전체 PatientStat 생성 완료: ${result.created}개`)
      }
    } catch (e) {
      console.error(`[UPLOAD] 기존 데이터 기반 PatientStat 생성 오류:`, e)
    }
  }

  // 더 광범위한 캐시 무효화
  revalidatePath(`/dashboard/${clinicId}`, "layout")
  revalidatePath(`/dashboard/${clinicId}`, "page")
  revalidatePath(`/dashboard/${clinicId}/upload`, "page")
  revalidatePath(`/dashboard/${clinicId}/uploads`, "page") // 업로드 관리 페이지

  // 각 데이터 타입별 페이지도 revalidate
  for (const type of processedTypes) {
    switch(type) {
      case "patient_stats":
        revalidatePath(`/dashboard/${clinicId}/patients`, "page")
        break
      case "treatment_stats":
        revalidatePath(`/dashboard/${clinicId}/treatments`, "page")
        break
      case "daily_ledgers":
      case "monthly_ledger":
      case "annual_ledger":
        revalidatePath(`/dashboard/${clinicId}/revenue`, "page")
        break
    }
  }

  // 처리된 파일들의 총 행 수 계산
  const totalRows = allParsedData.reduce((sum, data) => sum + data.rows.length, 0)

  console.log(`[UPLOAD COMPLETE] 클리닉: ${clinicId}, 파일: ${isZipFile ? 'ZIP' : '단일'}, 타입: ${Array.from(processedTypes).join(', ')}, 생성: ${created}건, 스킵: ${skipped}건`)

  return NextResponse.json({
    fileType: isZipFile ? 'zip' : 'single',
    processedTypes: Array.from(processedTypes),
    filesProcessed: allParsedData.length,
    total: totalRows,
    created,
    skipped,
    errors: errors.slice(0, 10), // ZIP일 때는 에러가 더 많을 수 있으므로 10개까지
    success: true,
    message: `${created}건의 데이터가 성공적으로 업로드되었습니다.`
  })
}

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
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // 마스터 계정만 접근 가능
  const userRole = (session.user as any).role
  if (userRole !== "MASTER") {
    return NextResponse.json({ error: "마스터 계정만 접근할 수 있습니다" }, { status: 403 })
  }

  const agencyId = (session.user as any).agencyId
  const form = await req.formData()
  const file = form.get("file") as File | null
  const clinicId = form.get("clinicId") as string | null

  if (!file || !clinicId)
    return NextResponse.json({ error: "file과 clinicId가 필요합니다" }, { status: 400 })

  const clinic = await prisma.clinic.findFirst({ where: { id: clinicId, agencyId } })
  if (!clinic) return NextResponse.json({ error: "치과를 찾을 수 없습니다" }, { status: 404 })

  const buffer = await file.arrayBuffer()

  // ZIP 파일인지 확인
  const isZipFile = file.name.toLowerCase().endsWith('.zip')

  let allParsedData: { type: string; rows: any[] }[] = []

  if (isZipFile) {
    console.log(`[UPLOAD] ZIP 파일 감지: ${file.name}`)

    // ZIP 파일에서 엑셀 파일들 추출
    const excelFiles = await extractExcelFilesFromZip(buffer)

    if (excelFiles.length === 0) {
      return NextResponse.json({
        error: `ZIP 파일 내에 엑셀 파일(.xlsx, .xls)이 없습니다: ${file.name}`
      }, { status: 400 })
    }

    // 각 엑셀 파일을 개별 파싱
    for (const excelFile of excelFiles) {
      try {
        const parsedData = parseExcel(excelFile.buffer, excelFile.name)
        allParsedData.push(parsedData)
        console.log(`[ZIP] ${excelFile.name} 파싱 완료: ${parsedData.type}, ${parsedData.rows.length}개 행`)
      } catch (error) {
        console.error(`[ZIP] ${excelFile.name} 파싱 실패:`, error)
        return NextResponse.json({
          error: `ZIP 내 파일 파싱 실패: ${excelFile.name} - ${error}`
        }, { status: 400 })
      }
    }
  } else {
    // 단일 엑셀 파일 처리 (기존 로직)
    const parsedData = parseExcel(buffer, file.name)
    allParsedData.push(parsedData)
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

  try {
    // 모든 파싱된 데이터 순회 처리
    for (const { type, rows } of allParsedData) {
      console.log(`[UPLOAD] 처리 중: ${type}, ${rows.length}개 행`)
      processedTypes.add(type)
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

      for (const p of payloads) {
        await prisma.dailyLedger.upsert({
          where: { clinicId_date: { clinicId, date: p.date } },
          create: p, update: p,
        })
        created++
      }

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

    } else if (type === "reception_records") {
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
  if (processedTypes.has("reception_records") && created > 0) {
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

  revalidatePath(`/dashboard/${clinicId}`, "layout")

  // 처리된 파일들의 총 행 수 계산
  const totalRows = allParsedData.reduce((sum, data) => sum + data.rows.length, 0)

  return NextResponse.json({
    fileType: isZipFile ? 'zip' : 'single',
    processedTypes: Array.from(processedTypes),
    filesProcessed: allParsedData.length,
    total: totalRows,
    created,
    skipped,
    errors: errors.slice(0, 10) // ZIP일 때는 에러가 더 많을 수 있으므로 10개까지
  })
}

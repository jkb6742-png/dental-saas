/**
 * 경영지표 폴더 → 로컬 DB 일괄 인제스션 (멱등: 월 단위 replace)
 *
 * 실행:
 *   npx tsx scripts/ingest-folder.ts "<clinic folder>" [clinicId]
 * 예:
 *   npx tsx scripts/ingest-folder.ts "C:/Users/jjang/Desktop/경영지표/THINKLB - 중산사과나무치과" cmqalpa2j0001dflwapu9its8
 *
 * - lib/excel/parser.ts 의 parseExcel(정확한 한글 헤더 매핑) 재사용
 * - 파일명으로 타입 자동판별, _type → 대응 테이블 매핑
 * - 접수수납은 파일명에 "전체" 포함된 것만(신환-only/중복 파일 제외)
 * - 각 파일의 (year,month) 파티션을 지우고 다시 insert → 재실행 안전
 * - 안전장치: DATABASE_URL 이 localhost 아니면 실행 거부
 */
import "dotenv/config"
import * as fs from "fs"
import * as path from "path"
import * as XLSX from "xlsx"
import { PrismaClient } from "@prisma/client"
import { parseExcel, detectFileType } from "../src/lib/excel/parser"

const prisma = new PrismaClient()
const DEFAULT_CLINIC = "cmqalpa2j0001dflwapu9its8" // 중산사과나무치과

function walk(dir: string): string[] {
  const out: string[] = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...walk(p))
    else if (/\.xlsx?$/i.test(e.name) && !e.name.startsWith("~$")) out.push(p)
  }
  return out
}

function readAB(file: string): ArrayBuffer {
  const b = fs.readFileSync(file)
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)
}

function yearFromName(name: string, fallback: number): number {
  const m = name.match(/(20\d{2})/)
  return m ? parseInt(m[1]) : fallback
}

const RECEPTION_TYPES = new Set(["reception_records", "new_patient_records", "all_patient_records"])

// 내원경로 이름이 월마다 다르게 export되는 경우 통합 (같은 경로가 쪼개져 추이가 끊기는 문제 방지)
const ROUTE_ALIAS: Record<string, string> = {
  "지인소개": "지인&가족소개",
  "간판": "간판&가까워서",
  "블로그": "블로그&유튜브",
}

// _type → { model, map(row)->data }. 반환 data 에는 clinicId 제외(공통 주입).
function mapRow(type: string, r: any, fileYear: number): { model: string; data: any } | null {
  switch (r._type) {
    case "daily_ledger":
      if (!r.date || !r.year || !r.month) return null
      return { model: "dailyLedger", data: {
        date: new Date(r.date), year: r.year, month: r.month,
        cashIncome: r.cashIncome, cardIncome: r.cardIncome, onlineIncome: r.onlineIncome,
        receiptIssued: r.receiptIssued, insuranceClaim: r.insuranceClaim,
        cashExpense: r.cashExpense, cardExpense: r.cardExpense, onlineExpense: r.onlineExpense,
        cardFee: r.cardFee, totalIncome: r.totalIncome, totalExpense: r.totalExpense, netTotal: r.netTotal,
      } }
    case "patient_stat":
      if (!r.date) return null
      return { model: "patientStat", data: {
        date: new Date(r.date), year: r.year ?? fileYear, month: r.month,
        workingDays: r.workingDays, newPatients: r.newPatients, totalVisits: r.totalVisits,
        totalAppointments: r.totalAppointments, avgDailyNewPatients: r.avgDailyNewPatients,
        avgDailyAppointments: r.avgDailyAppointments,
      } }
    case "treatment_stat":
      if (!r.month) return null
      return { model: "treatmentStat", data: {
        year: r.year ?? fileYear, month: r.month, itemName: r.itemName, category: r.category,
        patientCount: r.patientCount, visitCount: r.visitCount, revenue: r.revenue,
        visitRatio: r.visitRatio, revenueRatio: r.revenueRatio,
      } }
    case "visit_route":
      if (!r.month) return null
      // 신환·구환·방문 모두 0 인 미사용 경로 항목 제외 (치과 SW가 안 쓰는 경로도 export함)
      if (!r.totalVisitors && !r.newPatients && !r.returningPatients) return null
      return { model: "visitRoute", data: {
        year: r.year ?? fileYear, month: r.month, routeName: ROUTE_ALIAS[r.routeName] ?? r.routeName,
        totalVisitors: r.totalVisitors, returningPatients: r.returningPatients, newPatients: r.newPatients,
        totalVisits: r.totalVisits, avgRevenue: r.avgRevenue, totalRevenue: r.totalRevenue,
        acquisitionCost: r.acquisitionCost,
      } }
    case "implant_stat":
      if (!r.month || !r.fixtureName) return null
      return { model: "implantStat", data: {
        year: r.year ?? fileYear, month: r.month, fixtureName: r.fixtureName,
        surgeryCount: r.surgeryCount, usageCount: r.usageCount,
      } }
    case "consultation_stat":
      if (!r.month || !r.counselorName) return null
      return { model: "consultationStat", data: {
        year: r.year ?? fileYear, month: r.month, counselorName: r.counselorName,
        planCount: r.planCount, confirmedCount: r.confirmedCount, confirmationRate: r.confirmationRate,
        patientCount: r.patientCount, confirmedPatients: r.confirmedPatients,
        patientConfirmRate: r.patientConfirmRate, confirmedAmount: r.confirmedAmount,
        avgDiscountRate: r.avgDiscountRate,
      } }
    case "age_dist":
      if (!r.month || !r.ageGroup) return null
      return { model: "ageDist", data: {
        year: r.year ?? fileYear, month: r.month, ageGroup: r.ageGroup,
        totalPatients: r.totalPatients, returningPatients: r.returningPatients,
        newPatients: r.newPatients, avgRevenue: r.avgRevenue,
      } }
    case "region_dist":
      if (!r.month || !r.region) return null
      return { model: "regionDist", data: {
        year: r.year ?? fileYear, month: r.month, region: r.region,
        totalPatients: r.totalPatients, returningPatients: r.returningPatients,
        newPatients: r.newPatients, totalVisits: r.totalVisits, avgRevenue: r.avgRevenue,
      } }
    case "reception_record": {
      const y = r.year ?? fileYear
      if (!r.month) return null
      const wt = r.waitingTime
      return { model: "receptionRecord", data: {
        year: y, month: r.month,
        receptionTime: r.receptionTime ? new Date(r.receptionTime) : null,
        treatmentStartTime: r.treatmentStartTime ? new Date(r.treatmentStartTime) : null,
        treatmentEndTime: r.treatmentEndTime ? new Date(r.treatmentEndTime) : null,
        reservationTime: r.reservationTime ? new Date(r.reservationTime) : null,
        firstVisitDate: r.firstVisitDate ? new Date(r.firstVisitDate) : null,
        chair: r.chair, treatmentDoctor: r.treatmentDoctor, summaryDoctor: r.summaryDoctor,
        paymentStaff: r.paymentStaff, recallType: r.recallType, vat: r.vat, discountAmount: r.discountAmount,
        status: r.status, chartNumber: r.chartNumber, patientName: r.patientName,
        ageGender: r.ageGender, insuranceType: r.insuranceType, patientType: r.patientType,
        doctor: r.doctor, totalRevenue: r.totalRevenue, insuranceCoverage: r.insuranceCoverage,
        patientPayment: r.patientPayment, nonInsurance: r.nonInsurance,
        cardPayment: r.cardPayment, cashPayment: r.cashPayment, onlinePayment: r.onlinePayment,
        dailyArrears: r.dailyArrears, totalArrears: r.totalArrears, visitRoute: r.visitRoute,
        waitingTime: wt, waitingMinutes: wt != null ? Math.round(wt) : null,
      } }
    }
    default:
      return null
  }
}

function num(v: any): number | null {
  if (v == null || v === "" || v === "-") return null
  const n = parseFloat(String(v).replace(/[^0-9.-]/g, ""))
  return isNaN(n) ? null : n
}

// 일별접수환자수 전용 파서: 날짜가 "06월 01일(월)" 형식(연도 없음)이라 공용 파서로는 안 됨.
// 헤더: 날짜 | 진료일수 | 신환 수 | 접수환자 수 | 총 접수횟수 | 일평균 신환 | 일평균 접수횟수
async function ingestPatientStats(file: string, name: string, clinicId: string, year: number, summary: Record<string, number>) {
  const wb = XLSX.read(new Uint8Array(readAB(file)), { type: "array" })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const aoa: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
  const rows: any[] = []
  const parts = new Set<number>()
  for (const row of aoa.slice(1)) {
    const d = String(row?.[0] ?? "")
    const m = d.match(/(\d{1,2})월\s*(\d{1,2})일/)
    if (!m) continue // 합계/평균/빈 행 스킵
    const month = parseInt(m[1]), day = parseInt(m[2])
    parts.add(month)
    rows.push({
      clinicId, date: new Date(Date.UTC(year, month - 1, day)), year, month,
      workingDays: num(row[1]), newPatients: num(row[2]), totalVisits: num(row[3]),
      totalAppointments: num(row[4]), avgDailyNewPatients: num(row[5]), avgDailyAppointments: num(row[6]),
    })
  }
  if (rows.length === 0) { console.warn(`⚠️ 접수환자수 매핑 0건 ${name}`); return }
  await prisma.$transaction(async (tx) => {
    for (const month of parts) await tx.patientStat.deleteMany({ where: { clinicId, year, month } })
    await tx.patientStat.createMany({ data: rows, skipDuplicates: true })
  }, { timeout: 120000, maxWait: 20000 })
  summary["patientStat"] = (summary["patientStat"] || 0) + rows.length
  console.log(`✅ ${name} → patientStat ${rows.length}건 (${year}-${[...parts].join(",")})`)
}

function chunk<T>(a: T[], n: number): T[][] {
  const o: T[][] = []
  for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n))
  return o
}

async function main() {
  const folder = process.argv[2]
  const clinicId = process.argv[3] || DEFAULT_CLINIC
  if (!folder) throw new Error("사용법: npx tsx scripts/ingest-folder.ts <folder> [clinicId]")
  const url = process.env.DATABASE_URL || ""
  if (!/localhost|127\.0\.0\.1/.test(url)) throw new Error(`안전장치: DATABASE_URL 이 로컬이 아님 → ${url}`)

  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } })
  if (!clinic) throw new Error(`치과 없음: ${clinicId}`)
  console.log(`🏥 대상: ${clinic.name} (${clinicId})`)
  console.log(`📁 폴더: ${folder}\n`)

  const files = walk(folder)
  const summary: Record<string, number> = {}
  const skipped: string[] = []
  const unknowns: string[] = []

  // annual ledger(MonthlySummary) 는 별도 upsert 로 마지막 처리
  const annualFiles: { file: string; year: number }[] = []

  // 접수수납 "전체목록" 파일 선별 (치과마다 명명이 다름: 중산=전체접수수납목록, 지음=접수수납목록)
  // 규칙: 월별부분(N접수수납목록)·신환-only(6.신환 폴더) 제외 → 폴더별 1개 선택("전체" 포함 우선, 없으면 짧은 이름)
  const receptionFullSet = new Set<string>()
  {
    const recCandidates = files.filter((f) => {
      if (!RECEPTION_TYPES.has(detectFileType(path.basename(f)))) return false
      const b = path.basename(f), dir = path.dirname(f)
      if (/^\d{1,2}접수수납목록/.test(b)) return false            // "5접수수납목록.xlsx" 등 월별 부분 제외
      if (dir.includes("신환") && !dir.includes("구환")) return false // "6.신환" 폴더(신환 only) 제외
      return true
    })
    const byDir = new Map<string, string[]>()
    for (const f of recCandidates) {
      const d = path.dirname(f)
      if (!byDir.has(d)) byDir.set(d, [])
      byDir.get(d)!.push(f)
    }
    for (const list of byDir.values()) {
      const pick = list.find((f) => path.basename(f).includes("전체"))
        || [...list].sort((a, b) => path.basename(a).length - path.basename(b).length)[0]
      if (pick) receptionFullSet.add(pick)
    }
  }

  for (const file of files.sort()) {
    const name = path.basename(file)
    const ftype = detectFileType(name)

    if (ftype === "unknown") { unknowns.push(name); continue }
    if (ftype === "monthly_ledger") { /* daily_ledger 로 아래 처리 */ }
    if (ftype === "annual_ledger") { annualFiles.push({ file, year: yearFromName(name, new Date().getFullYear()) }); continue }
    if (ftype === "patient_stats") { await ingestPatientStats(file, name, clinicId, yearFromName(name, new Date().getFullYear()), summary); continue }
    if (RECEPTION_TYPES.has(ftype) && !receptionFullSet.has(file)) { skipped.push(name + " (신환/중복 접수수납 제외)"); continue }

    let parsed
    try { parsed = parseExcel(readAB(file), name) }
    catch (e) { console.warn(`⚠️ 파싱 실패 ${name}: ${(e as Error).message}`); continue }

    const fileYear = yearFromName(name, new Date().getFullYear())
    const mapped = parsed.rows.map((r) => mapRow(parsed.type, r, fileYear)).filter(Boolean) as { model: string; data: any }[]
    if (mapped.length === 0) { console.warn(`⚠️ 매핑 0건 ${name} (type=${parsed.type})`); continue }

    const model = mapped[0].model
    const rows = mapped.map((m) => ({ clinicId, ...m.data }))

    // 파티션(year,month) 단위 replace
    const parts = new Map<string, { year: number; month: number }>()
    for (const row of rows) parts.set(`${row.year}-${row.month}`, { year: row.year, month: row.month })
    // @ts-ignore dynamic model
    const delegate = (prisma as any)[model]
    await prisma.$transaction(async (tx) => {
      const d = (tx as any)[model]
      for (const p of parts.values()) {
        await d.deleteMany({ where: { clinicId, year: p.year, month: p.month } })
      }
      for (const c of chunk(rows, 1000)) {
        await d.createMany({ data: c, skipDuplicates: true })
      }
    }, { timeout: 120000, maxWait: 20000 })

    summary[model] = (summary[model] || 0) + rows.length
    console.log(`✅ ${name} → ${model} ${rows.length}건 (${[...parts.keys()].join(",")})`)
  }

  // 연간장부 → MonthlySummary (원장 매출/지출 필드만 upsert, 나머지 KPI 보존)
  for (const { file, year } of annualFiles) {
    const name = path.basename(file)
    const parsed = parseExcel(readAB(file), name)
    let cnt = 0
    for (const r of parsed.rows as any[]) {
      if (!r.month) continue
      await prisma.monthlySummary.upsert({
        where: { clinicId_year_month: { clinicId, year, month: r.month } },
        update: {
          totalRevenue: r.totalIncome ?? undefined, totalExpense: r.totalExpense ?? undefined,
          netProfit: r.netTotal ?? undefined, cashIncome: r.cashIncome ?? undefined,
          cardIncome: r.cardIncome ?? undefined, insuranceClaim: r.insuranceClaim ?? undefined,
        },
        create: {
          clinicId, year, month: r.month,
          totalRevenue: r.totalIncome, totalExpense: r.totalExpense, netProfit: r.netTotal,
          cashIncome: r.cashIncome, cardIncome: r.cardIncome, insuranceClaim: r.insuranceClaim,
        },
      })
      cnt++
    }
    summary["monthlySummary(upsert)"] = (summary["monthlySummary(upsert)"] || 0) + cnt
    console.log(`✅ ${name} → MonthlySummary upsert ${cnt}개월 (${year})`)
  }

  console.log("\n===== 요약 =====")
  for (const [k, v] of Object.entries(summary)) console.log(`  ${k}: ${v}`)
  if (skipped.length) console.log(`\n제외된 접수수납(부분/중복) ${skipped.length}건`)
  if (unknowns.length) console.log(`\n⚠️ 타입 미판별 ${unknowns.length}건:`, unknowns.slice(0, 10))
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error("❌ 인제스션 실패:", e)
  await prisma.$disconnect(); process.exit(1)
})

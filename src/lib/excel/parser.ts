import * as XLSX from "xlsx"

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function cleanNum(v: unknown): number | null {
  if (v == null || v === "" || v === "-") return null
  const s = String(v).replace(/,/g, "").replace(/%/g, "").trim()
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

function cleanDate(v: unknown): string | null {
  if (v == null || v === "" || v === "-") return null
  try {
    const d = new Date(v as any)
    if (isNaN(d.getTime())) return null
    return d.toISOString().split("T")[0]
  } catch {
    return null
  }
}

function extractMonth(v: unknown): number | null {
  const s = String(v ?? "")
  const m = s.match(/(\d{1,2})월/)
  if (m) return parseInt(m[1])
  try {
    const d = new Date(v as any)
    if (!isNaN(d.getTime())) return d.getMonth() + 1
  } catch {}
  return null
}

function extractMonthFromFilename(filename: string): number | null {
  const m = filename.match(/(\d{1,2})월/)
  if (m) return parseInt(m[1])
  const m2 = filename.match(/(\d{2,4})\d{2}/) // e.g. 202601 → month=01
  if (m2) {
    const s = filename.match(/\d{4}(\d{2})/)
    if (s) return parseInt(s[1])
  }
  return null
}

function isSummaryRow(v: unknown): boolean {
  if (v == null || v === "") return true
  const s = String(v).trim()
  // 합계/소계/평균 행 모두 제외
  if (["합계", "소계", "합 계", "소 계", "날짜", "월", "진료항목", "내원경로", "환자정보", "평균", "평 균", "전체"].includes(s)) return true
  if (s.endsWith("합계") || s.endsWith("소계") || s.endsWith("평균") || s.startsWith("합계") || s.startsWith("평균")) return true
  return false
}

function readSheet(buffer: ArrayBuffer, sheetIndex = 0): Record<string, unknown>[] {
  const wb = XLSX.read(new Uint8Array(buffer), { type: "array", cellDates: true })
  const name = wb.SheetNames[sheetIndex]
  const ws = wb.Sheets[name]
  return XLSX.utils.sheet_to_json(ws, { defval: null })
}

function readSheetByName(buffer: ArrayBuffer, sheetName: string): Record<string, unknown>[] {
  const wb = XLSX.read(new Uint8Array(buffer), { type: "array", cellDates: true })
  const ws = wb.Sheets[sheetName]
  if (!ws) throw new Error(`시트 "${sheetName}"을(를) 찾을 수 없습니다`)
  return XLSX.utils.sheet_to_json(ws, { defval: null })
}

// ──────────────────────────────────────────────
// Parsers
// ──────────────────────────────────────────────

export type ParsedRow = Record<string, unknown> & { _type: string }

export function parseMonthlyLedger(buffer: ArrayBuffer): ParsedRow[] {
  const rows = readSheet(buffer)
  return rows
    .filter((r) => !isSummaryRow(r["날짜"]))
    .map((r) => {
      const date = cleanDate(r["날짜"])
      if (!date) return null
      const month = extractMonth(r["날짜"])
      const year = new Date(date).getFullYear()
      return {
        _type: "daily_ledger",
        date,
        month,
        year,
        cashIncome: cleanNum(r["현금수입"]),
        cardIncome: cleanNum(r["카드수입"]),
        onlineIncome: cleanNum(r["기타(온라인)수입"]),
        receiptIssued: cleanNum(r["현영발급"]),
        insuranceClaim: cleanNum(r["공단부담(청구액)"]),
        cashExpense: cleanNum(r["현금지출"]),
        cardExpense: cleanNum(r["카드지출"]),
        onlineExpense: cleanNum(r["기타(온라인)지출"]),
        cardFee: cleanNum(r["카드수수료"]),
        totalIncome: cleanNum(r["총 수입(청구포함,VAT제외)"]),
        totalExpense: cleanNum(r["총 지출"]),
        netTotal: cleanNum(r["총계(청구포함,VAT제외)"]),
      } as ParsedRow
    })
    .filter(Boolean) as ParsedRow[]
}

export function parseAnnualLedger(buffer: ArrayBuffer): ParsedRow[] {
  const rows = readSheet(buffer)
  return rows
    .filter((r) => !isSummaryRow(r["월"]))
    .map((r) => {
      const month = extractMonth(r["월"])
      if (!month) return null
      return {
        _type: "monthly_ledger_summary",
        month,
        cashIncome: cleanNum(r["현금수입"]),
        cardIncome: cleanNum(r["카드수입"]),
        onlineIncome: cleanNum(r["기타(온라인)수입"]),
        receiptIssued: cleanNum(r["현영발급"]),
        insuranceClaim: cleanNum(r["공단부담(청구액)"]),
        cashExpense: cleanNum(r["현금지출"]),
        cardExpense: cleanNum(r["카드지출"]),
        onlineExpense: cleanNum(r["기타(온라인)지출"]),
        cardFee: cleanNum(r["카드수수료"]),
        totalIncome: cleanNum(r["총 수입(청구포함,VAT제외)"]),
        totalExpense: cleanNum(r["총 지출"]),
        netTotal: cleanNum(r["총계(청구포함,VAT제외)"]),
      } as ParsedRow
    })
    .filter(Boolean) as ParsedRow[]
}

// 컬럼명 찾기 헬퍼 함수
function findColumn(row: Record<string, unknown>, patterns: string[]): unknown {
  // 정확한 매치 먼저 시도
  for (const pattern of patterns) {
    if (row[pattern] !== undefined && row[pattern] !== null) {
      console.log(`[FIND_COLUMN] 정확한 매치 발견: '${pattern}' = ${row[pattern]}`)
      return row[pattern]
    }
  }

  // 대소문자 구분 없이 부분 매치
  const keys = Object.keys(row)
  console.log(`[FIND_COLUMN] 패턴 ${JSON.stringify(patterns)}에 대해 키 검색: ${JSON.stringify(keys)}`)

  for (const pattern of patterns) {
    const found = keys.find(key =>
      key.toLowerCase().includes(pattern.toLowerCase()) ||
      pattern.toLowerCase().includes(key.toLowerCase())
    )
    if (found && row[found] !== undefined && row[found] !== null) {
      console.log(`[FIND_COLUMN] 부분 매치 발견: '${found}' (패턴: '${pattern}') = ${row[found]}`)
      return row[found]
    }
  }

  console.log(`[FIND_COLUMN] 매치 실패 - 패턴: ${JSON.stringify(patterns)}`)
  return null
}

export function parsePatientStats(buffer: ArrayBuffer, filename: string): ParsedRow[] {
  const rows = readSheet(buffer)
  const fileMonth = extractMonthFromFilename(filename)

  console.log(`[PARSE DEBUG] 파일: ${filename}`)
  console.log(`[PARSE DEBUG] 시트에서 읽은 총 행 수: ${rows.length}`)
  console.log(`[PARSE DEBUG] 파일명에서 추출한 월: ${fileMonth}`)

  if (rows.length > 0) {
    console.log(`[PARSE DEBUG] 첫 번째 행 원본:`, JSON.stringify(rows[0], null, 2))
    console.log(`[PARSE DEBUG] 사용 가능한 컬럼들:`, Object.keys(rows[0]))
  }

  return rows
    .filter((r) => {
      // 날짜 컬럼 찾기
      const dateValue = findColumn(r, ["날짜", "일자", "date", "Date", "일", "Day"])
      console.log(`[PARSE DEBUG] 날짜 컬럼 값:`, dateValue)
      const isValid = !isSummaryRow(dateValue)
      console.log(`[PARSE DEBUG] 요약행 여부: ${!isValid}`)
      return isValid
    })
    .map((r) => {
      // 각 컬럼에 대해 다양한 패턴으로 찾기
      const dateValue = findColumn(r, ["날짜", "일자", "date", "Date", "일", "Day"])
      const date = cleanDate(dateValue)
      if (!date) return null

      const month = fileMonth ?? extractMonth(dateValue)
      const year = new Date(date).getFullYear()

      // 다양한 컬럼명 패턴으로 값 찾기
      const workingDays = cleanNum(findColumn(r, [
        "진료일수", "근무일수", "진료일", "workingDays", "working_days", "진료"
      ]))

      const newPatients = cleanNum(findColumn(r, [
        "신환 수", "신환수", "신환", "new_patients", "newPatients", "New Patients", "신환환자수"
      ]))

      const totalVisits = cleanNum(findColumn(r, [
        "접수환자 수", "총 접수환자수", "접수환자수", "총환자수", "환자수",
        "totalVisits", "total_visits", "Total Visits", "내원환자수"
      ]))

      const totalAppointments = cleanNum(findColumn(r, [
        "총 접수횟수", "접수횟수", "예약수", "totalAppointments", "total_appointments",
        "Total Appointments", "접수건수"
      ]))

      const avgDailyNewPatients = cleanNum(findColumn(r, [
        "일평균 신환", "일평균 신환수", "일평균신환", "avgDailyNewPatients",
        "avg_daily_new_patients", "Average Daily New Patients"
      ]))

      const avgDailyAppointments = cleanNum(findColumn(r, [
        "일평균 접수횟수", "일평균접수횟수", "일평균 예약", "avgDailyAppointments",
        "avg_daily_appointments", "Average Daily Appointments"
      ]))

      return {
        _type: "patient_stat",
        date,
        month,
        year,
        workingDays,
        newPatients,
        totalVisits,
        totalAppointments,
        avgDailyNewPatients,
        avgDailyAppointments,
      } as ParsedRow
    })
    .filter(Boolean) as ParsedRow[]
}

export function parseTreatmentStats(buffer: ArrayBuffer, filename: string): ParsedRow[] {
  const rows = readSheet(buffer)
  const month = extractMonthFromFilename(filename)
  const yearMatch = filename.match(/(\d{4})/)
  const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear()
  return rows
    .filter((r) => !isSummaryRow(r["진료항목"]))
    .map((r) => {
      const itemName = String(r["진료항목"] ?? "").trim()
      if (!itemName) return null
      return {
        _type: "treatment_stat",
        month,
        year,
        itemName,
        category: itemName.includes("(비급여)") ? "NON_INSURANCE" : "INSURANCE",
        patientCount: cleanNum(r["환자수"]),
        visitCount: cleanNum(r["진료횟수"]),
        revenue: cleanNum(r["진료금액"]),
        visitRatio: cleanNum(r["횟수비율"]),
        revenueRatio: cleanNum(r["금액비율"]),
      } as ParsedRow
    })
    .filter(Boolean) as ParsedRow[]
}

export function parseVisitRoutes(buffer: ArrayBuffer, filename: string): ParsedRow[] {
  const wb = XLSX.read(new Uint8Array(buffer), { type: "array", cellDates: true })
  const sheetName = wb.SheetNames.find(
    (n) => n.includes("내원경로 분포") || n.includes("내원경로분포")
  ) ?? wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: null })

  const month = extractMonthFromFilename(filename)
  const yearMatch = filename.match(/(\d{4})/)
  const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear()

  return rows
    .filter((r) => !isSummaryRow(r["내원경로"]))
    .map((r) => {
      const routeName = String(r["내원경로"] ?? "").trim()
      if (!routeName) return null
      const newPatients = cleanNum(r["신환수"]) ?? 0
      const totalRevenue = cleanNum(r["총 진료비"]) ?? 0
      const acquisitionCost = newPatients > 0 ? totalRevenue / newPatients : null
      return {
        _type: "visit_route",
        month,
        year,
        routeName,
        totalVisitors: cleanNum(r["내원환자수"]),
        returningPatients: cleanNum(r["구환수"]),
        newPatients,
        totalVisits: cleanNum(r["총내원횟수"]),
        avgRevenue: cleanNum(r["평균진료비"]),
        totalRevenue,
        acquisitionCost,
      } as ParsedRow
    })
    .filter(Boolean) as ParsedRow[]
}

export function parseTreatmentPlans(buffer: ArrayBuffer, filename: string): ParsedRow[] {
  const rows = readSheet(buffer)
  const fileMonth = extractMonthFromFilename(filename)
  const yearMatch = filename.match(/(\d{4})/)
  const fileYear = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear()

  const STATUS_MAP: Record<string, string> = {
    "치료종결": "COMPLETED",
    "진행중": "IN_PROGRESS",
    "미확정": "PENDING",
    "보류": "ON_HOLD",
  }
  const PAYMENT_MAP: Record<string, string> = {
    "완료": "COMPLETED",
    "미완료": "INCOMPLETE",
    "-": "NA",
  }

  return rows
    .filter((r) => !isSummaryRow(r["환자정보"]))
    .map((r) => {
      const raw = String(r["환자정보"] ?? "").trim()
      if (!raw) return null
      const nameMatch = raw.match(/^(.+?)(\([\d]+\))?$/)
      const patientName = nameMatch?.[1]?.trim() ?? raw
      const chartNumber = nameMatch?.[2]?.replace(/[()]/g, "") ?? null
      const writtenDate = cleanDate(r["작성일"])
      const month = writtenDate ? new Date(writtenDate).getMonth() + 1 : fileMonth
      const year = writtenDate ? new Date(writtenDate).getFullYear() : fileYear
      return {
        _type: "treatment_plan",
        patientName,
        chartNumber,
        writtenDate,
        lastVisit: cleanDate(r["최종내원"]),
        nextAppointment: cleanDate(r["다음예약"]),
        status: STATUS_MAP[String(r["진행상태"] ?? "").trim()] ?? null,
        paymentStatus: PAYMENT_MAP[String(r["수납상태"] ?? "").trim()] ?? null,
        doctor: String(r["담당의사"] ?? "").trim() || null,
        counselor: String(r["상담자"] ?? "").trim() || null,
        planContent: String(r["치료계획"] ?? "").trim() || null,
        contractAmount: cleanNum(r["계약금액"]),
        remainingAmount: cleanNum(r["남은금액"]),
        month,
        year,
      } as ParsedRow
    })
    .filter(Boolean) as ParsedRow[]
}

// ──────────────────────────────────────────────
// 임플란트 수술 통계
// ──────────────────────────────────────────────
export function parseImplantStats(buffer: ArrayBuffer, filename: string): ParsedRow[] {
  const wb = XLSX.read(new Uint8Array(buffer), { type: "array", cellDates: true })
  const sheetName = wb.SheetNames.find((n) => n.includes("임플란트 사용개수") || n.includes("사용개수")) ?? wb.SheetNames[0]
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null })

  const month = extractMonthFromFilename(filename)
  const yearMatch = filename.match(/(\d{4})/)
  const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear()

  return rows
    .filter((r) => {
      const name = String(r["픽스처"] ?? r["임플란트"] ?? "").trim()
      return !isSummaryRow(name) && name.length > 0
    })
    .map((r) => ({
      _type: "implant_stat",
      year, month,
      fixtureName: String(r["픽스처"] ?? r["임플란트"] ?? "").trim(),
      surgeryCount: cleanNum(r["수술횟수"]),
      usageCount: cleanNum(r["사용개수"]),
    } as ParsedRow))
}

// ──────────────────────────────────────────────
// 상담자별 상담통계
// ──────────────────────────────────────────────
export function parseConsultationStats(buffer: ArrayBuffer, filename: string): ParsedRow[] {
  const wb = XLSX.read(new Uint8Array(buffer), { type: "array", cellDates: true })
  const sheetName = wb.SheetNames.find((n) => n.includes("상담자별 통계") || n.includes("상담자별통계")) ?? wb.SheetNames[0]
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null })

  const month = extractMonthFromFilename(filename)
  const yearMatch = filename.match(/(\d{4})/)
  const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear()

  return rows
    .filter((r) => {
      const name = String(r["상담자명"] ?? "").trim()
      return !isSummaryRow(name) && name.length > 0 && !name.startsWith("차트")
    })
    .map((r) => {
      const amtStr = String(r["확정금액"] ?? "").replace(/,/g, "").replace(/만원/g, "0000").replace(/원/g, "")
      const confirmedAmount = parseFloat(amtStr) || cleanNum(r["확정금액"])
      return {
        _type: "consultation_stat",
        year, month,
        counselorName: String(r["상담자명"]).trim(),
        planCount: cleanNum(r["계획 수"]),
        confirmedCount: cleanNum(r["확정건수"]),
        confirmationRate: cleanNum(r["확정비율"]),
        patientCount: cleanNum(r["상담환자 수"]),
        confirmedPatients: cleanNum(r["확정환자수"]),
        patientConfirmRate: cleanNum(r["확정환자비율"]),
        confirmedAmount,
        avgDiscountRate: cleanNum(r["평균할인률"]),
      } as ParsedRow
    })
}

// ──────────────────────────────────────────────
// 접수수납목록 (신환/의사별 분석용)
// ──────────────────────────────────────────────
export function parseReceptionRecords(buffer: ArrayBuffer, filename: string): ParsedRow[] {
  const wb = XLSX.read(new Uint8Array(buffer), { type: "array", cellDates: true })
  const sheetName = wb.SheetNames.find((n) => n.includes("접수수납")) ?? wb.SheetNames[0]
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null })

  const fileMonth = extractMonthFromFilename(filename)
  const yearMatch = filename.match(/(\d{4})/)
  const fileYear = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear()

  return rows
    .filter((r) => r["차트번호"] != null && r["차트번호"] !== "")
    .map((r) => {
      const receptionTime = cleanDate(r["접수시각"])
      const dt = receptionTime ? new Date(receptionTime) : null
      const month = dt ? dt.getMonth() + 1 : fileMonth
      const year = dt ? dt.getFullYear() : fileYear
      return {
        _type: "reception_record",
        year, month,
        receptionTime,
        status: String(r["상태"] ?? "").trim() || null,
        chartNumber: String(r["차트번호"] ?? "").trim() || null,
        patientName: String(r["이름"] ?? "").trim() || null,
        ageGender: String(r["연령성별"] ?? "").trim() || null,
        insuranceType: String(r["보험구분"] ?? "").trim() || null,
        patientType: String(r["신구"] ?? "").trim() || null,
        doctor: String(r["담당의사"] ?? "").trim() || null,
        totalRevenue: cleanNum(r["총진료비"]),
        insuranceCoverage: cleanNum(r["공단부담"]),
        patientPayment: cleanNum(r["본인부담"]),
        nonInsurance: cleanNum(r["비급여"]),
        cardPayment: cleanNum(r["카드수납"]),
        cashPayment: cleanNum(r["현금수납"]),
        onlinePayment: cleanNum(r["기타(온라인)"]),
        dailyArrears: cleanNum(r["당일미수"]),
        totalArrears: cleanNum(r["총미수금"]),
        visitRoute: String(r["내원경로"] ?? "").trim() || null,
      } as ParsedRow
    })
}

// ──────────────────────────────────────────────
// 연령별 분포
// ──────────────────────────────────────────────
export function parseAgeDist(buffer: ArrayBuffer, filename: string): ParsedRow[] {
  const wb = XLSX.read(new Uint8Array(buffer), { type: "array", cellDates: true })
  const sheetName = wb.SheetNames.find((n) => n.includes("연령별") || n.includes("연령")) ?? wb.SheetNames[0]
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null })

  const month = extractMonthFromFilename(filename)
  const yearMatch = filename.match(/(\d{4})/)
  const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear()

  return rows
    .filter((r) => {
      const ag = String(r["연령대"] ?? "").trim()
      return !isSummaryRow(ag) && ag.length > 0
    })
    .map((r) => ({
      _type: "age_dist",
      year, month,
      ageGroup: String(r["연령대"]).trim(),
      totalPatients: cleanNum(r["내원환자수"]),
      returningPatients: cleanNum(r["구환수"]),
      newPatients: cleanNum(r["신환수"]),
      avgRevenue: cleanNum(r["1인당평균진료비"]),
    } as ParsedRow))
}

// ──────────────────────────────────────────────
// 지역별 분포
// ──────────────────────────────────────────────
export function parseRegionDist(buffer: ArrayBuffer, filename: string): ParsedRow[] {
  const wb = XLSX.read(new Uint8Array(buffer), { type: "array", cellDates: true })
  const sheetName = wb.SheetNames.find((n) => n.includes("지역별 분포") || n.includes("지역별분포")) ?? wb.SheetNames[0]
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null })

  const month = extractMonthFromFilename(filename)
  const yearMatch = filename.match(/(\d{4})/)
  const year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear()

  return rows
    .filter((r) => {
      const region = String(r["지역"] ?? "").trim()
      return !isSummaryRow(region) && region.length > 0
    })
    .map((r) => ({
      _type: "region_dist",
      year, month,
      region: String(r["지역"]).trim(),
      totalPatients: cleanNum(r["내원환자수"]),
      returningPatients: cleanNum(r["구환수"]),
      newPatients: cleanNum(r["신환수"]),
      totalVisits: cleanNum(r["총내원횟수"]),
      avgRevenue: cleanNum(r["1인평균진료비"]),
    } as ParsedRow))
}

// ──────────────────────────────────────────────
// 유형 판별 & 라우터
// ──────────────────────────────────────────────
export type FileType =
  | "monthly_ledger"
  | "annual_ledger"
  | "patient_stats"
  | "treatment_stats"
  | "visit_routes"
  | "treatment_plans"
  | "implant_stats"
  | "consultation_stats"
  | "reception_records"
  | "age_dist"
  | "region_dist"
  | "unknown"

export function detectFileType(filename: string): FileType {
  if (filename.includes("월간장부")) return "monthly_ledger"
  if (filename.includes("연간장부")) return "annual_ledger"

  // 환자 통계 관련 파일명 패턴 확장
  if (filename.includes("일별접수환자수") ||
      filename.includes("환자통계") ||
      filename.includes("환자현황") ||
      filename.includes("일별환자") ||
      filename.includes("접수환자") ||
      filename.includes("신환통계") ||
      filename.includes("환자수통계") ||
      filename.includes("patient_stats") ||
      filename.includes("PatientStats") ||
      (filename.includes("환자") && filename.includes("일별")) ||
      (filename.includes("신환") && filename.includes("수"))) {
    return "patient_stats"
  }

  if (filename.includes("진료항목별통계") || filename.includes("진료항목통계")) return "treatment_stats"
  if (filename.includes("내원경로분포") || filename.includes("내원환자내원경로분포")) return "visit_routes"
  if (filename.includes("치료비용계획")) return "treatment_plans"
  if (filename.includes("임플란트수술통계")) return "implant_stats"
  if (filename.includes("상담자별상담통계") || filename.includes("상담통계")) return "consultation_stats"
  if (filename.includes("접수수납목록")) return "reception_records"
  if (filename.includes("연령분포") || filename.includes("연령별")) return "age_dist"
  if (filename.includes("지역별분포") || filename.includes("지역별")) return "region_dist"
  return "unknown"
}

export function parseExcel(
  buffer: ArrayBuffer,
  filename: string
): { type: FileType; rows: ParsedRow[] } {
  const type = detectFileType(filename)
  switch (type) {
    case "monthly_ledger":      return { type, rows: parseMonthlyLedger(buffer) }
    case "annual_ledger":       return { type, rows: parseAnnualLedger(buffer) }
    case "patient_stats":       return { type, rows: parsePatientStats(buffer, filename) }
    case "treatment_stats":     return { type, rows: parseTreatmentStats(buffer, filename) }
    case "visit_routes":        return { type, rows: parseVisitRoutes(buffer, filename) }
    case "treatment_plans":     return { type, rows: parseTreatmentPlans(buffer, filename) }
    case "implant_stats":       return { type, rows: parseImplantStats(buffer, filename) }
    case "consultation_stats":  return { type, rows: parseConsultationStats(buffer, filename) }
    case "reception_records":   return { type, rows: parseReceptionRecords(buffer, filename) }
    case "age_dist":            return { type, rows: parseAgeDist(buffer, filename) }
    case "region_dist":         return { type, rows: parseRegionDist(buffer, filename) }
    default:                    return { type: "unknown", rows: [] }
  }
}

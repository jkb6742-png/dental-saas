import type { ContractStatus, DeliverableKind, TaskCategory, VatTreatment } from "@prisma/client"
import { prisma } from "@/lib/db"
import { monthRange, dayInMonth, KST_MS, isYmd, dateOnly, str } from "./common"
import { countableContent } from "./content"

// 계약·월 분량. 월 목표(MonthlyCommitment)는 그 달 화면을 처음 열 때 진행 중 계약에서 만든다.
// 한 번 만든 목표는 계약이 바뀌어도 그대로(지난달 실적 비교가 흔들리지 않게).

export const DELIVERABLE_LABEL: Record<DeliverableKind, string> = {
  BLOG_POST: "블로그",
  WEBSITE_COLUMN: "홈페이지 칼럼",
  IMAGE_ASSET: "이미지",
  MANAGEMENT_REPORT: "경영보고서",
  PEI_REPORT: "PEI 보고서",
  BLOG_REPORT: "블로그 보고서",
  ADS_REPORT: "광고 보고서",
  CLINIC_MEETING: "정기 미팅",
  SEARCH_AD_OPERATION: "검색광고 운영",
  WEBSITE_MAINTENANCE: "홈페이지 관리",
}
export const DELIVERABLE_KINDS = Object.keys(DELIVERABLE_LABEL) as DeliverableKind[]

export const KIND_TO_TASK_CATEGORY: Record<DeliverableKind, TaskCategory> = {
  BLOG_POST: "BLOG",
  WEBSITE_COLUMN: "BLOG",
  IMAGE_ASSET: "IMAGE",
  MANAGEMENT_REPORT: "REPORT",
  PEI_REPORT: "REPORT",
  BLOG_REPORT: "REPORT",
  ADS_REPORT: "REPORT",
  CLINIC_MEETING: "MEETING",
  SEARCH_AD_OPERATION: "ADS",
  WEBSITE_MAINTENANCE: "WEBSITE",
}

/** 그 달에 걸친 진행 중 계약의 약정으로 월 목표를 만든다(이미 있으면 건너뜀). */
export async function ensureCommitments(clinicId: string, month: string) {
  const { start, next } = monthRange(month)
  const contracts = await prisma.clinicContract.findMany({
    where: { clinicId, status: "ACTIVE", startsOn: { lt: next }, OR: [{ endsOn: null }, { endsOn: { gte: start } }] },
    select: { lines: { select: { id: true, kind: true, monthlyTarget: true } } },
    orderBy: { startsOn: "desc" },
  })
  const seen = new Set<DeliverableKind>()
  const data = []
  for (const c of contracts)
    for (const l of c.lines) {
      if (seen.has(l.kind) || l.monthlyTarget <= 0) continue
      seen.add(l.kind)
      data.push({ clinicId, contractLineId: l.id, monthStart: start, kind: l.kind, targetCount: l.monthlyTarget })
    }
  if (data.length) await prisma.monthlyCommitment.createMany({ data, skipDuplicates: true })
}

export type QuotaRow = {
  commitmentId: string
  kind: DeliverableKind
  label: string
  target: number
  done: number
  inProgress: number
  adjustmentReason: string | null
}

/** 월 목표 대비 실적. 블로그·칼럼은 발행 기록(이행 대상월), 미팅은 확정 일정, 나머지는 연결 업무 완료 수. */
export async function monthQuota(clinicId: string, month: string): Promise<QuotaRow[]> {
  const { start, next } = monthRange(month)
  const commitments = await prisma.monthlyCommitment.findMany({
    where: { clinicId, monthStart: start },
    select: {
      id: true,
      kind: true,
      targetCount: true,
      adjustmentReason: true,
      tasks: { select: { status: true } },
    },
  })
  if (!commitments.length) return []
  const [blog, column, meetings] = await Promise.all([
    prisma.publishedContent.count({ where: { clinicId, kind: "BLOG", serviceMonth: start, ...countableContent } }),
    prisma.publishedContent.count({ where: { clinicId, kind: "COLUMN", serviceMonth: start, ...countableContent } }),
    prisma.calendarEvent.count({
      where: {
        clinicId,
        type: "CLINIC_MEETING",
        status: "CONFIRMED",
        startAt: { gte: new Date(start.getTime() - KST_MS), lt: new Date(Math.min(next.getTime() - KST_MS, Date.now())) },
      },
    }),
  ])
  return commitments
    .map((c) => {
      const doneTasks = c.tasks.filter((t) => t.status === "DONE").length
      const open = c.tasks.filter((t) => !["DONE", "CANCELLED"].includes(t.status)).length
      const done = c.kind === "BLOG_POST" ? blog : c.kind === "WEBSITE_COLUMN" ? column : c.kind === "CLINIC_MEETING" ? meetings : doneTasks
      return { commitmentId: c.id, kind: c.kind, label: DELIVERABLE_LABEL[c.kind], target: c.targetCount, done, inProgress: open, adjustmentReason: c.adjustmentReason }
    })
    .sort((a, b) => DELIVERABLE_KINDS.indexOf(a.kind) - DELIVERABLE_KINDS.indexOf(b.kind))
}

/** 월 목표 수만큼 업무 칸을 만든다("11월 블로그 3/8"). 이미 만든 순번은 건너뛴다. */
export async function generateQuotaTasks(commitmentId: string, actorId: string) {
  const c = await prisma.monthlyCommitment.findUnique({
    where: { id: commitmentId },
    select: { id: true, clinicId: true, kind: true, targetCount: true, monthStart: true, contractLine: { select: { defaultDueDay: true } } },
  })
  if (!c) throw new Error("월 목표를 찾을 수 없습니다")
  const month = c.monthStart.toISOString().slice(0, 7)
  const m = Number(month.slice(5))
  const due = dayInMonth(month, c.contractLine?.defaultDueDay ?? 31)
  let created = 0
  for (let slot = 1; slot <= c.targetCount; slot++) {
    const generationKey = `quota:${c.id}:${slot}`
    const exists = await prisma.task.findUnique({ where: { generationKey }, select: { id: true } })
    if (exists) continue
    await prisma.task.create({
      data: {
        clinicId: c.clinicId,
        title: `${m}월 ${DELIVERABLE_LABEL[c.kind]} ${slot}/${c.targetCount}`,
        category: KIND_TO_TASK_CATEGORY[c.kind],
        monthlyCommitmentId: c.id,
        quotaSlot: slot,
        generationKey,
        dueOn: due,
        reviewRequired: c.kind === "BLOG_POST" || c.kind === "WEBSITE_COLUMN",
        createdByUserId: actorId,
        activities: { create: { type: "CREATED", actorUserId: actorId, newValue: "월 분량 자동 생성" } },
      },
    })
    created++
  }
  return created
}

const STATUSES: ContractStatus[] = ["DRAFT", "ACTIVE", "ENDED", "TERMINATED"]
const VAT: VatTreatment[] = ["UNCONFIRMED", "INCLUDED", "EXCLUDED"]

/** 계약 입력값 검사. 고칠 때도 같은 규칙. */
export function parseContract(b: any, partial = false) {
  const out: Record<string, unknown> = {}
  const need = (k: string) => !partial || b[k] !== undefined
  if (need("planName")) {
    const v = str(b.planName, 100)
    if (!v) return { error: "플랜 이름을 입력하세요" }
    out.planName = v
  }
  if (need("monthlyFeeKrw")) {
    const v = Number(b.monthlyFeeKrw)
    if (!Number.isInteger(v) || v < 0 || v > 1_000_000_000) return { error: "월 금액이 잘못되었습니다" }
    out.monthlyFeeKrw = v
  }
  if (b.vatTreatment !== undefined) out.vatTreatment = VAT.includes(b.vatTreatment) ? b.vatTreatment : "UNCONFIRMED"
  if (need("startsOn")) {
    if (!isYmd(b.startsOn)) return { error: "시작일을 입력하세요" }
    out.startsOn = dateOnly(b.startsOn)
  }
  if (b.endsOn !== undefined) {
    if (b.endsOn && !isYmd(b.endsOn)) return { error: "종료일이 잘못되었습니다" }
    out.endsOn = b.endsOn ? dateOnly(b.endsOn) : null
  }
  if (b.status !== undefined) {
    if (!STATUSES.includes(b.status)) return { error: "상태가 잘못되었습니다" }
    out.status = b.status
  }
  for (const k of ["billDayOfMonth", "paymentDueDay"]) {
    if (b[k] === undefined) continue
    if (b[k] === null || b[k] === "") out[k] = null
    else {
      const v = Number(b[k])
      if (!Number.isInteger(v) || v < 1 || v > 31) return { error: "청구일·입금일은 1~31 입니다" }
      out[k] = v
    }
  }
  if (b.paymentDueMonthOffset !== undefined) out.paymentDueMonthOffset = Number(b.paymentDueMonthOffset) === 1 ? 1 : 0
  if (b.signedContractUrl !== undefined) out.signedContractUrl = str(b.signedContractUrl, 1000)
  let lines: { kind: DeliverableKind; monthlyTarget: number; defaultDueDay: number | null }[] | undefined
  if (Array.isArray(b.lines)) {
    lines = []
    for (const l of b.lines) {
      if (!DELIVERABLE_KINDS.includes(l.kind)) return { error: "서비스 종류가 잘못되었습니다" }
      const t = Number(l.monthlyTarget)
      if (!Number.isInteger(t) || t < 0 || t > 200) return { error: "월 분량이 잘못되었습니다" }
      const d = l.defaultDueDay ? Number(l.defaultDueDay) : null
      if (d !== null && (!Number.isInteger(d) || d < 1 || d > 31)) return { error: "기본 마감일은 1~31 입니다" }
      if (lines.some((x) => x.kind === l.kind)) return { error: "같은 서비스가 두 번 들어 있습니다" }
      lines.push({ kind: l.kind, monthlyTarget: t, defaultDueDay: d })
    }
  }
  return { data: out, lines }
}


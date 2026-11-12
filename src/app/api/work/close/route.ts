import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { guard, fail, isMonth, monthRange, audit, str } from "@/lib/work/common"
import { monthQuota } from "@/lib/work/contracts"
import { createNotifications } from "@/lib/notifications"

// 치과·월 마감.
//  close   : 운영 마감(담당 직원·마스터). 목표 미달이면 사유 필수.
//  finance : 재무 점검 완료(마스터)
//  reopen  : 다시 열기(마스터)
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null)
  if (!b || !isMonth(b.month)) return fail("잘못된 요청")
  const clinicId = String(b.clinicId ?? "")
  const g = await guard({ clinicId })
  if ("res" in g) return g.res
  const actor = g.actor
  const monthStart = monthRange(b.month).start
  const cur = await prisma.clinicMonthClose.findUnique({ where: { clinicId_monthStart: { clinicId, monthStart } } })

  if (b.action === "close") {
    if (cur?.operationsClosedAt && !cur.reopenedAt) return fail("이미 마감했습니다")
    const quota = await monthQuota(clinicId, b.month)
    const short = quota.filter((q) => q.done < q.target)
    const note = str(b.exceptionNote, 1000)
    if (short.length && !note) {
      return fail(`목표에 못 미친 항목이 있습니다: ${short.map((q) => `${q.label} ${q.done}/${q.target}`).join(", ")}. 사유를 적어야 마감됩니다`)
    }
    const row = await prisma.clinicMonthClose.upsert({
      where: { clinicId_monthStart: { clinicId, monthStart } },
      create: { clinicId, monthStart, operationsClosedAt: new Date(), operationsClosedById: actor.id, exceptionNote: note },
      update: { operationsClosedAt: new Date(), operationsClosedById: actor.id, exceptionNote: note, reopenedAt: null },
    })
    await audit(actor.id, "MONTH_CLOSED", clinicId, { month: b.month, short: short.map((q) => q.kind), note })
    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { name: true } })
    await createNotifications({
      type: "MONTH_CLOSE",
      title: `${clinic?.name} ${Number(b.month.slice(5))}월 운영 마감${short.length ? " (미달 사유 있음)" : ""}`,
      link: `/work/clinics/${clinicId}/${b.month}`,
      clinicId,
      audience: "masters",
      userIds: (await prisma.user.findMany({ where: { role: "MASTER" }, select: { id: true } })).map((u) => u.id),
      exclude: [actor.id],
      dedupKey: `close:${clinicId}:${b.month}:${row.updatedAt.getTime()}`,
    })
    return NextResponse.json(row)
  }

  if (!actor.isMaster) return fail("권한이 없습니다", 403)
  if (b.action === "finance") {
    if (!cur?.operationsClosedAt || cur.reopenedAt) return fail("운영 마감을 먼저 해야 합니다")
    const row = await prisma.clinicMonthClose.update({ where: { id: cur.id }, data: { financeReviewedAt: new Date(), financeReviewedById: actor.id } })
    await audit(actor.id, "MONTH_FINANCE_REVIEWED", clinicId, { month: b.month })
    return NextResponse.json(row)
  }
  if (b.action === "reopen") {
    if (!cur) return fail("마감 기록이 없습니다")
    const row = await prisma.clinicMonthClose.update({ where: { id: cur.id }, data: { reopenedAt: new Date(), financeReviewedAt: null, financeReviewedById: null, note: str(b.note, 1000) } })
    await audit(actor.id, "MONTH_REOPENED", clinicId, { month: b.month, note: b.note })
    return NextResponse.json(row)
  }
  return fail("알 수 없는 동작")
}

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { guard, fail, isYmd, dateOnly, audit, str, ymdOf } from "@/lib/work/common"
import { parseSpan, overlaps } from "../shared"

type Ctx = { params: Promise<{ id: string }> }

// PATCH { action:"approve"|"reject", note }  대표만
// PATCH { workDate?, start?, end?, reason? }  본인은 대기 중일 때만, 대표는 언제나
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const g = await guard()
  if ("res" in g) return g.res
  const actor = g.actor
  const o = await prisma.overtimeRecord.findUnique({ where: { id: (await params).id } })
  if (!o) return fail("찾을 수 없습니다", 404)
  const b = await req.json().catch(() => ({}))

  if (b.action === "approve" || b.action === "reject") {
    if (!actor.isMaster) return fail("권한이 없습니다", 403)
    const status = b.action === "approve" ? "APPROVED" : "REJECTED"
    const note = str(b.note, 200)
    if (status === "REJECTED" && !note) return fail("반려 사유를 적어 주세요")
    const row = await prisma.overtimeRecord.update({ where: { id: o.id }, data: { status, decisionNote: note, decidedByUserId: actor.id, decidedAt: new Date() } })
    await audit(actor.id, status === "APPROVED" ? "OVERTIME_APPROVED" : "OVERTIME_REJECTED", null, { id: o.id, employee: o.employeeUserId, before: o.status, note })
    return NextResponse.json(row)
  }

  const owner = o.employeeUserId === actor.id
  if (!actor.isMaster && !(owner && o.status === "PENDING")) return fail("대기 중인 본인 신청만 고칠 수 있습니다", 403)
  const hm = (d: Date) => new Date(d.getTime() + 9 * 3600_000).toISOString().slice(11, 16)
  const workDate = b.workDate ?? ymdOf(o.workDate)
  if (!isYmd(workDate)) return fail("날짜를 고르세요")
  let span
  try {
    span = parseSpan(workDate, b.start ?? hm(o.startAt), b.end ?? hm(o.endAt))
  } catch (e) {
    return fail((e as Error).message)
  }
  const reason = b.reason !== undefined ? str(b.reason, 300) : o.reason
  if (!reason) return fail("사유를 적어 주세요")
  if (await overlaps(o.employeeUserId, span.startAt, span.endAt, o.id)) return fail("같은 시간에 등록된 추가근무가 있습니다")
  const row = await prisma.overtimeRecord.update({ where: { id: o.id }, data: { workDate: dateOnly(workDate), ...span, reason } })
  await audit(actor.id, "OVERTIME_EDITED", null, {
    id: o.id,
    employee: o.employeeUserId,
    before: { workDate: ymdOf(o.workDate), startAt: o.startAt, endAt: o.endAt, reason: o.reason },
    after: { workDate, startAt: span.startAt, endAt: span.endAt, reason },
  })
  return NextResponse.json(row)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const g = await guard()
  if ("res" in g) return g.res
  const actor = g.actor
  const o = await prisma.overtimeRecord.findUnique({ where: { id: (await params).id } })
  if (!o) return fail("찾을 수 없습니다", 404)
  if (!actor.isMaster && !(o.employeeUserId === actor.id && o.status === "PENDING")) return fail("대기 중인 본인 신청만 지울 수 있습니다", 403)
  await prisma.overtimeRecord.delete({ where: { id: o.id } })
  await audit(actor.id, "OVERTIME_DELETED", null, { id: o.id, employee: o.employeeUserId, workDate: ymdOf(o.workDate), minutes: o.minutes, status: o.status })
  return NextResponse.json({ ok: true })
}

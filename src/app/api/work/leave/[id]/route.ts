import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { guard, fail, kstToday, ymdOf, audit, str } from "@/lib/work/common"
import { approveLeave, cancelLeave, LEAVE_UNIT_LABEL } from "@/lib/work/leave"
import { createNotifications } from "@/lib/notifications"

type Ctx = { params: Promise<{ id: string }> }

// approve·reject: 대표 / cancel: 본인(대기 중이거나 시작 전) 또는 대표
export async function POST(req: NextRequest, { params }: Ctx) {
  const g = await guard()
  if ("res" in g) return g.res
  const actor = g.actor
  const r = await prisma.leaveRequest.findUnique({ where: { id: (await params).id } })
  if (!r) return fail("찾을 수 없습니다", 404)
  const b = await req.json().catch(() => ({}))
  const label = `${LEAVE_UNIT_LABEL[r.unit]} ${ymdOf(r.startOn)}${r.endOn.getTime() !== r.startOn.getTime() ? ` ~ ${ymdOf(r.endOn)}` : ""}`
  try {
    if (b.action === "approve" || b.action === "reject") {
      if (!actor.isMaster) return fail("권한이 없습니다", 403)
      if (b.action === "approve") await approveLeave(r.id, actor.id, str(b.note, 300))
      else {
        if (r.status !== "PENDING") return fail("대기 중인 신청만 반려할 수 있습니다")
        await prisma.leaveRequest.update({ where: { id: r.id }, data: { status: "REJECTED", decidedByUserId: actor.id, decidedAt: new Date(), decisionNote: str(b.note, 300) } })
      }
      await audit(actor.id, b.action === "approve" ? "LEAVE_APPROVED" : "LEAVE_REJECTED", null, { requestId: r.id, employee: r.employeeUserId })
      await createNotifications({
        type: "LEAVE_DECIDED",
        title: `${label} ${b.action === "approve" ? "승인" : "반려"}`,
        body: str(b.note, 300) ?? undefined,
        link: "/work/leave",
        audience: "masters",
        userIds: [r.employeeUserId],
        dedupKey: `leave-decided:${r.id}`,
      })
    } else if (b.action === "cancel") {
      const own = r.employeeUserId === actor.id
      if (!own && !actor.isMaster) return fail("권한이 없습니다", 403)
      if (own && !actor.isMaster && r.status === "APPROVED" && ymdOf(r.startOn)! <= kstToday()) return fail("이미 시작한 연차는 대표에게 취소를 요청하세요")
      await cancelLeave(r.id, actor.id)
      await audit(actor.id, "LEAVE_CANCELLED", null, { requestId: r.id, employee: r.employeeUserId, wasApproved: r.status === "APPROVED" })
    } else return fail("알 수 없는 동작")
  } catch (e) {
    return fail((e as Error).message)
  }
  return NextResponse.json(await prisma.leaveRequest.findUnique({ where: { id: r.id } }))
}

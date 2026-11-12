import { NextRequest, NextResponse } from "next/server"
import QRCode from "qrcode"
import { prisma } from "@/lib/db"
import { guard } from "@/lib/work/common"
import { pollRemoteCheck } from "@/lib/work/presence"

// PC 화면이 30초마다 묻는다: 지금 띄울 재택 인증이 있나? (재택 근무자만 해당)
// 정해진 시각은 미리 알려 주지 않고, 시각이 된 뒤에만 QR을 준다.
export async function GET(req: NextRequest) {
  const g = await guard()
  if ("res" in g) return g.res
  const emp = await prisma.employee.findUnique({
    where: { userId: g.actor.id },
    select: { workMode: true, user: { select: { agencyId: true } } },
  })
  if (!emp || emp.workMode !== "REMOTE") return NextResponse.json({ check: null })
  const have = req.nextUrl.searchParams.get("have") || null // 화면이 유효한 QR을 들고 있는 인증
  const prev = req.nextUrl.searchParams.get("prev") || have // 화면에 떠 있던 인증(결과 안내용)
  const c = await pollRemoteCheck(g.actor.id, emp.user.agencyId, have)
  if (!c) {
    // 화면이 들고 있던 인증이 끝났으면 결과를 알려 준다(인증/미인증)
    const ended = prev
      ? await prisma.remoteCheck.findFirst({ where: { id: prev, employeeUserId: g.actor.id }, select: { status: true } })
      : null
    return NextResponse.json({ check: null, ended: ended?.status ?? null })
  }
  if ("keep" in c) return NextResponse.json({ check: { id: c.id, keep: true } })
  const origin = process.env.NEXTAUTH_URL || req.nextUrl.origin
  const url = `${origin.replace(/\/$/, "")}/check/${c.token}`
  const qr = await QRCode.toDataURL(url, { margin: 1, width: 240 })
  return NextResponse.json({
    check: { id: c.id, qr, url, matchCode: c.matchCode, tokenExpiresAt: c.tokenExpiresAt, deadlineAt: c.deadlineAt, shownAt: c.shownAt },
  })
}

import { NextRequest, NextResponse } from "next/server"
import QRCode from "qrcode"
import { prisma } from "@/lib/db"
import { guard, fail, audit, str, isYmd, dateOnly, kstToday } from "@/lib/work/common"
import { masterAgency } from "@/lib/work/staff"
import { clientIp, validCidr, attendanceSetting, sweepMissed } from "@/lib/work/presence"

// 근태 설정(대표 전용): 출퇴근 허용 네트워크 · 재택 인증 운영값 · 재택 인증 기록

export async function GET(req: NextRequest) {
  const g = await guard({ master: true })
  if ("res" in g) return g.res
  const agencyId = await masterAgency(g.actor.id)
  if (!agencyId) return fail("소속 정보가 없습니다", 403)
  const day = req.nextUrl.searchParams.get("date")
  const ymd = isYmd(day) ? day : kstToday()
  await sweepMissed()
  const [networks, setting, checks] = await Promise.all([
    prisma.attendanceNetwork.findMany({ where: { agencyId }, orderBy: { createdAt: "asc" } }),
    attendanceSetting(agencyId),
    prisma.remoteCheck.findMany({
      where: { workDate: dateOnly(ymd), employee: { user: { agencyId } } },
      orderBy: [{ scheduledAt: "asc" }],
      select: {
        id: true, scheduledAt: true, shownAt: true, verifiedAt: true, status: true, reissueCount: true, wrongAttempts: true,
        verifiedIp: true, reason: true, reviewedAt: true,
        employee: { select: { user: { select: { name: true } } } },
      },
    }),
  ])
  return NextResponse.json({ networks, setting, date: ymd, checks, myIp: clientIp(req) })
}

/**
 * addNetwork { name, cidr } · toggleNetwork { id, enabled } · deleteNetwork { id }
 * saveSetting { remoteChecksPerDay, qrSeconds, graceMinutes }
 * excuse { id, reason } — 미인증을 사유 인정으로
 */
export async function POST(req: NextRequest) {
  const g = await guard({ master: true })
  if ("res" in g) return g.res
  const agencyId = await masterAgency(g.actor.id)
  if (!agencyId) return fail("소속 정보가 없습니다", 403)
  const b = await req.json().catch(() => ({}))

  if (b.action === "addNetwork") {
    const name = str(b.name, 40)
    const cidr = String(b.cidr ?? "").trim()
    if (!name) return fail("이름을 입력하세요 (예: 본사 사무실)")
    if (!validCidr(cidr)) return fail("IP 형식이 잘못되었습니다. 예: 211.117.37.162 또는 211.117.37.0/24")
    const row = await prisma.attendanceNetwork.create({ data: { agencyId, name, cidr, createdByUserId: g.actor.id } })
    await audit(g.actor.id, "ATTENDANCE_NETWORK_ADDED", null, { name, cidr })
    return NextResponse.json(row)
  }
  if (b.action === "toggleNetwork" || b.action === "deleteNetwork") {
    const net = await prisma.attendanceNetwork.findFirst({ where: { id: String(b.id ?? ""), agencyId } })
    if (!net) return fail("네트워크를 찾을 수 없습니다", 404)
    if (b.action === "deleteNetwork") await prisma.attendanceNetwork.delete({ where: { id: net.id } })
    else await prisma.attendanceNetwork.update({ where: { id: net.id }, data: { enabled: !!b.enabled } })
    await audit(g.actor.id, b.action === "deleteNetwork" ? "ATTENDANCE_NETWORK_DELETED" : "ATTENDANCE_NETWORK_TOGGLED", null, { name: net.name, cidr: net.cidr, enabled: !!b.enabled })
    return NextResponse.json({ ok: true })
  }
  if (b.action === "saveSetting") {
    const n = Math.round(Number(b.remoteChecksPerDay))
    const q = Math.round(Number(b.qrSeconds))
    const gm = Math.round(Number(b.graceMinutes))
    if (!(n >= 0 && n <= 3)) return fail("하루 인증 횟수는 0~3회입니다")
    if (!(q >= 30 && q <= 300)) return fail("QR 유효 시간은 30~300초입니다")
    if (!(gm >= 1 && gm <= 30)) return fail("인증 유예는 1~30분입니다")
    await prisma.attendanceSetting.upsert({
      where: { agencyId },
      create: { agencyId, remoteChecksPerDay: n, qrSeconds: q, graceMinutes: gm },
      update: { remoteChecksPerDay: n, qrSeconds: q, graceMinutes: gm },
    })
    await audit(g.actor.id, "ATTENDANCE_SETTING_CHANGED", null, { remoteChecksPerDay: n, qrSeconds: q, graceMinutes: gm })
    return NextResponse.json({ ok: true })
  }
  // 대표 미리보기: 실제와 같은 모양의 QR(가짜 주소, 기록 없음)
  if (b.action === "preview") {
    const qr = await QRCode.toDataURL("https://thinklabinsight.com/check/preview", { margin: 1, width: 240 })
    return NextResponse.json({ qr, matchCode: String(10 + Math.floor(Math.random() * 90)) })
  }
  if (b.action === "excuse") {
    const c = await prisma.remoteCheck.findFirst({ where: { id: String(b.id ?? ""), employee: { user: { agencyId } } } })
    if (!c) return fail("기록을 찾을 수 없습니다", 404)
    if (c.status !== "MISSED") return fail("미인증 기록만 사유 인정할 수 있습니다")
    const reason = str(b.reason, 300)
    if (!reason) return fail("사유를 입력하세요")
    await prisma.remoteCheck.update({ where: { id: c.id }, data: { status: "EXCUSED", reason, reviewedByUserId: g.actor.id, reviewedAt: new Date() } })
    await audit(g.actor.id, "REMOTE_CHECK_EXCUSED", null, { targetUserId: c.employeeUserId, checkId: c.id, reason })
    return NextResponse.json({ ok: true })
  }
  return fail("알 수 없는 동작")
}

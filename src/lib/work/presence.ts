import { createHash, randomBytes, randomInt } from "crypto"
import type { NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { KST_MS, dateOnly, kstToday } from "./common"

// 출근 위치 확인: 사무실 근무자는 허용 네트워크(공인 IP)에서만, 재택 근무자는 무작위 QR 인증.

// ---------------- IP ----------------

/**
 * 요청한 사람의 공인 IP.
 * 운영(thinklabinsight.com)은 Cloudflare 뒤에 있어 CF-Connecting-IP 를 먼저 쓴다(Cloudflare가 덮어쓰므로 위조 불가).
 * 그다음 nginx 가 넣는 X-Real-IP, 마지막으로 X-Forwarded-For 의 맨 오른쪽(가장 가까운 프록시가 붙인 값).
 * 맨 왼쪽 값은 사용자가 마음대로 넣을 수 있어 쓰지 않는다.
 */
export function clientIp(req: NextRequest | Request): string {
  const h = req.headers
  const cf = h.get("cf-connecting-ip")?.trim()
  if (cf) return normalizeIp(cf)
  const real = h.get("x-real-ip")?.trim()
  if (real) return normalizeIp(real)
  const xff = h.get("x-forwarded-for")
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean)
    if (parts.length) return normalizeIp(parts[parts.length - 1])
  }
  return "127.0.0.1" // 로컬 개발
}

function normalizeIp(ip: string) {
  const v = ip.replace(/^::ffff:/i, "")
  return v === "::1" ? "127.0.0.1" : v
}

const ipv4ToInt = (ip: string) => {
  const p = ip.split(".")
  if (p.length !== 4 || p.some((x) => !/^\d{1,3}$/.test(x) || Number(x) > 255)) return null
  return p.reduce((n, x) => (n << 8) + Number(x), 0) >>> 0
}

/** "211.117.37.162" 또는 "211.117.37.0/24" 형식인지 */
export function validCidr(v: string) {
  const [ip, bits] = v.split("/")
  if (ipv4ToInt(ip) === null) return /^[0-9a-f:]+$/i.test(ip) && bits === undefined // IPv6 는 정확히 일치만
  return bits === undefined || (/^\d{1,2}$/.test(bits) && Number(bits) <= 32)
}

export function ipInCidr(ip: string, cidr: string) {
  const [base, bitsStr] = cidr.trim().split("/")
  const a = ipv4ToInt(ip)
  const b = ipv4ToInt(base)
  if (a === null || b === null) return ip.toLowerCase() === base.toLowerCase()
  const bits = bitsStr === undefined ? 32 : Number(bitsStr)
  if (bits === 0) return true
  const mask = (~0 << (32 - bits)) >>> 0
  return (a & mask) === (b & mask)
}

/** 사무실 네트워크 판정. 허용 네트워크가 하나도 없으면 제한하지 않는다(설정 전). */
export async function officeNetworkCheck(agencyId: string, ip: string) {
  const nets = await prisma.attendanceNetwork.findMany({ where: { agencyId, enabled: true }, select: { name: true, cidr: true } })
  if (!nets.length) return { enforced: false, ok: true, network: null as string | null }
  const hit = nets.find((n) => ipInCidr(ip, n.cidr))
  return { enforced: true, ok: !!hit, network: hit?.name ?? null }
}

export const OFFICE_DENIED =
  "지금 네트워크에서는 출퇴근을 기록할 수 없습니다. 사무실 네트워크(사무실 컴퓨터)에서 다시 눌러 주세요. 재택·외근이면 대표에게 알려 주세요. 기록은 저장되지 않았습니다."

// ---------------- 재택 무작위 QR ----------------

export async function attendanceSetting(agencyId: string) {
  return (
    (await prisma.attendanceSetting.findUnique({ where: { agencyId } })) ?? {
      agencyId,
      remoteChecksPerDay: 2,
      qrSeconds: 90,
      graceMinutes: 5,
      updatedAt: new Date(0),
    }
  )
}

const hmToMin = (hm: string) => {
  const m = /^(\d{2}):(\d{2})$/.exec(hm)
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}
/** 한국 날짜 + 분 → Date */
const kstAt = (ymd: string, minutes: number) => new Date(dateOnly(ymd).getTime() + minutes * 60_000 - KST_MS)

/**
 * 재택 근무자가 출근을 찍으면 그날 인증 시각을 무작위로 정한다.
 * 범위: max(근무 시작, 출근 + 20분) ~ 근무 종료 - 30분, 점심 12~13시 제외. 시각끼리는 60분 이상 띄운다.
 * 정해진 시각은 직원에게 알려 주지 않는다(대표 화면에서만 보임).
 */
export async function scheduleRemoteChecks(userId: string, agencyId: string, clockInAt: Date) {
  const emp = await prisma.employee.findUnique({ where: { userId }, select: { workStart: true, workEnd: true } })
  if (!emp) return []
  const ymd = kstToday()
  const workDate = dateOnly(ymd)
  const exists = await prisma.remoteCheck.count({ where: { employeeUserId: userId, workDate } })
  if (exists) return []
  const { remoteChecksPerDay } = await attendanceSetting(agencyId)
  const n = Math.max(0, Math.min(3, remoteChecksPerDay))
  const inMin = Math.floor((clockInAt.getTime() + KST_MS - workDate.getTime()) / 60_000)
  const from = Math.max(hmToMin(emp.workStart) ?? 540, inMin + 20)
  const to = (hmToMin(emp.workEnd) ?? 1080) - 30
  const slots: number[] = []
  for (let m = from; m <= to; m++) if (m < 720 || m >= 780) slots.push(m)
  const picked: number[] = []
  for (let tries = 0; picked.length < n && tries < 200 && slots.length; tries++) {
    const m = slots[randomInt(slots.length)]
    if (picked.every((p) => Math.abs(p - m) >= 60)) picked.push(m)
  }
  picked.sort((a, b) => a - b)
  if (!picked.length) return []
  await prisma.remoteCheck.createMany({
    data: picked.map((m) => ({ employeeUserId: userId, workDate, scheduledAt: kstAt(ymd, m) })),
  })
  return picked
}

/** 퇴근하면 남은 인증은 취소 */
export async function cancelRemainingChecks(userId: string) {
  await prisma.remoteCheck.updateMany({
    where: { employeeUserId: userId, workDate: dateOnly(kstToday()), status: "SCHEDULED" },
    data: { status: "CANCELLED" },
  })
}

/** 유예 시간이 지난 표시 중 인증을 미인증으로 */
export async function sweepMissed(userId?: string) {
  await prisma.remoteCheck.updateMany({
    where: { ...(userId ? { employeeUserId: userId } : {}), status: "SHOWN", deadlineAt: { lt: new Date() } },
    data: { status: "MISSED", tokenHash: null },
  })
}

const sha = (s: string) => createHash("sha256").update(s).digest("hex")
const newCode = () => String(randomInt(10, 100))

/**
 * PC가 30초마다 묻는다: 지금 띄울 인증이 있나?
 * 있으면 새 1회용 토큰을 만들어 돌려준다(토큰 원문은 이 응답에만, DB에는 해시만).
 * 이미 떠 있는데 QR이 만료됐으면 유예 시간 안에서 새 QR로 바꿔 준다.
 */
export async function pollRemoteCheck(userId: string, agencyId: string, haveId?: string | null) {
  await sweepMissed(userId)
  const now = new Date()
  const today = dateOnly(kstToday())
  const check = await prisma.remoteCheck.findFirst({
    where: { employeeUserId: userId, workDate: today, OR: [{ status: "SHOWN" }, { status: "SCHEDULED", scheduledAt: { lte: now } }] },
    orderBy: { scheduledAt: "asc" },
  })
  if (!check) return null
  // 화면이 이미 이 인증의 유효한 QR을 들고 있으면 그대로 둔다
  if (haveId === check.id && check.status === "SHOWN" && check.tokenHash && check.tokenExpiresAt && check.tokenExpiresAt > now)
    return { id: check.id, keep: true as const }
  const { qrSeconds, graceMinutes } = await attendanceSetting(agencyId)

  // 원문 토큰은 저장하지 않으므로 새로고침·만료 시에는 새로 발급(이전 QR은 무효)
  const token = randomBytes(24).toString("base64url")
  const first = check.status === "SCHEDULED"
  const shownAt = check.shownAt ?? now
  const deadlineAt = check.deadlineAt ?? new Date(shownAt.getTime() + graceMinutes * 60_000)
  const tokenExpiresAt = new Date(Math.min(now.getTime() + qrSeconds * 1000, deadlineAt.getTime()))
  const matchCode = newCode()
  const updated = await prisma.remoteCheck.updateMany({
    where: { id: check.id, status: check.status, updatedAt: check.updatedAt },
    data: {
      status: "SHOWN",
      shownAt,
      deadlineAt,
      tokenHash: sha(token),
      tokenExpiresAt,
      matchCode,
      reissueCount: first ? 0 : { increment: 1 },
    },
  })
  if (!updated.count) return null // 다른 창이 먼저 발급함 → 다음 폴링에서
  return { id: check.id, token, matchCode, tokenExpiresAt, deadlineAt, shownAt }
}

/** 휴대폰 페이지: 토큰으로 인증 찾기(본인 것만). 숫자 보기 3개를 준다(정답은 섞어서). */
export async function lookupCheck(token: string, userId: string) {
  await sweepMissed(userId)
  const c = await prisma.remoteCheck.findUnique({ where: { tokenHash: sha(token) } })
  if (!c) return { error: "만료되었거나 이미 사용한 QR입니다. 컴퓨터 화면의 새 QR을 찍어 주세요." } as const
  if (c.employeeUserId !== userId) return { error: "다른 직원의 QR입니다. 본인 계정으로 로그인해 주세요." } as const
  if (c.status !== "SHOWN" || !c.tokenExpiresAt || c.tokenExpiresAt < new Date())
    return { error: "QR 유효 시간이 지났습니다. 컴퓨터 화면에서 새 QR을 받아 다시 찍어 주세요." } as const
  const choices = new Set<string>([c.matchCode!])
  while (choices.size < 3) choices.add(newCode())
  return { check: c, choices: [...choices].sort(() => randomInt(3) - 1) } as const
}

export async function verifyCheck(token: string, userId: string, picked: string, ip: string, ua: string) {
  const found = await lookupCheck(token, userId)
  if ("error" in found) return found
  const c = found.check
  if (picked !== c.matchCode) {
    // 틀리면 이 QR은 버린다(찍어 두고 아무거나 누르는 방식 차단)
    await prisma.remoteCheck.update({ where: { id: c.id }, data: { wrongAttempts: { increment: 1 }, tokenHash: null, tokenExpiresAt: null } })
    return { error: "숫자가 다릅니다. 컴퓨터 화면에서 새 QR을 받아 다시 시도해 주세요." } as const
  }
  const done = await prisma.remoteCheck.updateMany({
    where: { id: c.id, status: "SHOWN", tokenHash: c.tokenHash },
    data: { status: "VERIFIED", verifiedAt: new Date(), verifiedIp: ip.slice(0, 64), verifiedUa: ua.slice(0, 300), tokenHash: null },
  })
  if (!done.count) return { error: "이미 처리된 QR입니다." } as const
  return { ok: true } as const
}

export const REMOTE_STATUS_LABEL = {
  SCHEDULED: "예정",
  SHOWN: "표시 중",
  VERIFIED: "인증",
  MISSED: "미인증",
  CANCELLED: "취소",
  EXCUSED: "사유 인정",
} as const

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { canAccessClinic } from "@/lib/requests/access"
import { encryptText } from "@/lib/security/encryption"
import { guard, fail, audit } from "@/lib/work/common"
import { agencyOf, accountScope, accountSelect, canEditAccount, parseAccount, publicAccount } from "@/lib/work/accounts"

// 계정 관리 목록·추가. 목록에는 비밀번호가 들어가지 않는다(보기는 /reveal).

export async function GET(req: NextRequest) {
  const g = await guard()
  if ("res" in g) return g.res
  const agencyId = await agencyOf(g.actor.id)
  if (!agencyId) return fail("소속 정보가 없습니다", 403)
  const scope = req.nextUrl.searchParams.get("scope") ?? "all"
  const base = accountScope(g.actor, agencyId)
  const where = scope === "all" ? base : { AND: [base, { clinicId: scope === "internal" ? null : scope }] }
  const [rows, counts] = await Promise.all([
    prisma.serviceAccount.findMany({ where, select: accountSelect, orderBy: [{ category: "asc" }, { label: "asc" }, { createdAt: "asc" }] }),
    prisma.serviceAccount.groupBy({ by: ["clinicId"], where: base, _count: true }),
  ])
  return NextResponse.json({
    accounts: rows.map(publicAccount),
    counts: Object.fromEntries(counts.map((c) => [c.clinicId ?? "internal", c._count])),
  })
}

export async function POST(req: NextRequest) {
  const g = await guard()
  if ("res" in g) return g.res
  const agencyId = await agencyOf(g.actor.id)
  if (!agencyId) return fail("소속 정보가 없습니다", 403)
  const b = await req.json().catch(() => ({}))
  const clinicId = b.clinicId && b.clinicId !== "internal" ? String(b.clinicId) : null
  if (clinicId) {
    if (!canAccessClinic(g.actor, clinicId)) return fail("권한이 없습니다", 403)
    const c = await prisma.clinic.findFirst({ where: { id: clinicId, agencyId }, select: { id: true } })
    if (!c) return fail("치과를 찾을 수 없습니다", 404)
  }
  if (!canEditAccount(g.actor, clinicId)) return fail("사내 계정은 대표만 추가할 수 있습니다", 403)
  const p = parseAccount(b, g.actor.isMaster)
  if ("error" in p) return fail(p.error!)
  const pw = typeof b.password === "string" && b.password ? b.password.slice(0, 200) : null
  const row = await prisma.serviceAccount.create({
    data: {
      agencyId,
      clinicId,
      ...p.data,
      passwordEnc: pw ? encryptText(pw) : null,
      passwordChangedAt: pw ? new Date() : null,
      createdByUserId: g.actor.id,
      updatedByUserId: g.actor.id,
    },
    select: accountSelect,
  })
  await audit(g.actor.id, "ACCOUNT_CREATED", clinicId, { accountId: row.id, category: row.category, label: row.label })
  return NextResponse.json(publicAccount(row), { status: 201 })
}

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { encryptText, decryptText } from "@/lib/security/encryption"
import { guard, fail, audit } from "@/lib/work/common"
import { agencyOf, accountScope, accountSelect, canEditAccount, parseAccount, publicAccount } from "@/lib/work/accounts"

// 계정 수정·삭제, 그리고 비밀번호 보기(POST, 볼 때마다 기록).

type Ctx = { params: Promise<{ id: string }> }

async function load(id: string) {
  const g = await guard()
  if ("res" in g) return { res: g.res }
  const agencyId = await agencyOf(g.actor.id)
  if (!agencyId) return { res: fail("소속 정보가 없습니다", 403) }
  const row = await prisma.serviceAccount.findFirst({ where: { AND: [{ id }, accountScope(g.actor, agencyId)] } })
  if (!row) return { res: fail("계정을 찾을 수 없습니다", 404) }
  return { actor: g.actor, row }
}

/** 비밀번호 보기: { action: "reveal" } */
export async function POST(req: NextRequest, { params }: Ctx) {
  const r = await load((await params).id)
  if (!("row" in r)) return r.res
  const b = await req.json().catch(() => ({}))
  if (b.action !== "reveal") return fail("알 수 없는 동작")
  if (!r.row.passwordEnc) return NextResponse.json({ password: "" })
  let password: string
  try {
    password = decryptText(r.row.passwordEnc)
  } catch {
    return fail("비밀번호를 풀 수 없습니다(암호화 키가 바뀌었을 수 있음). 다시 입력해 주세요", 500)
  }
  await audit(r.actor.id, "ACCOUNT_REVEALED", r.row.clinicId, { accountId: r.row.id, category: r.row.category, label: r.row.label })
  return NextResponse.json({ password }, { headers: { "Cache-Control": "no-store" } })
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const r = await load((await params).id)
  if (!("row" in r)) return r.res
  if (!canEditAccount(r.actor, r.row.clinicId)) return fail("사내 계정은 대표만 고칠 수 있습니다", 403)
  const b = await req.json().catch(() => ({}))
  const p = parseAccount({ ...r.row, ...b }, r.actor.isMaster)
  if ("error" in p) return fail(p.error!)
  const pwChanged = typeof b.password === "string"
  const row = await prisma.serviceAccount.update({
    where: { id: r.row.id },
    data: {
      ...p.data,
      ...(pwChanged ? { passwordEnc: b.password ? encryptText(String(b.password).slice(0, 200)) : null, passwordChangedAt: new Date() } : {}),
      updatedByUserId: r.actor.id,
    },
    select: accountSelect,
  })
  await audit(r.actor.id, pwChanged ? "ACCOUNT_PASSWORD_CHANGED" : "ACCOUNT_UPDATED", r.row.clinicId, { accountId: r.row.id, category: row.category, label: row.label })
  return NextResponse.json(publicAccount(row))
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const r = await load((await params).id)
  if (!("row" in r)) return r.res
  if (!r.actor.isMaster) return fail("계정 삭제는 대표만 할 수 있습니다", 403)
  await prisma.serviceAccount.delete({ where: { id: r.row.id } })
  await audit(r.actor.id, "ACCOUNT_DELETED", r.row.clinicId, { accountId: r.row.id, category: r.row.category, label: r.row.label, loginId: r.row.loginId })
  return NextResponse.json({ ok: true })
}

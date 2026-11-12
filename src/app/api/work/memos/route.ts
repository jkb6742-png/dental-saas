import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { canAccessClinic } from "@/lib/requests/access"
import { guard, fail, str } from "@/lib/work/common"

// 내 메모(빠른 추가). 본인 것만 보고 쓴다. 보관한 메모는 목록에서 빠진다.

const memoSelect = { id: true, body: true, clinicId: true, convertedTaskId: true, archivedAt: true, createdAt: true } as const

export async function GET(req: NextRequest) {
  const g = await guard()
  if ("res" in g) return g.res
  const take = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get("take")) || 20))
  const memos = await prisma.workMemo.findMany({
    where: { userId: g.actor.id, archivedAt: null },
    orderBy: { createdAt: "desc" },
    take,
    select: memoSelect,
  })
  return NextResponse.json({ memos })
}

/** 메모 쓰기 { body, clinicId? } (clinicId "internal"·빈 값 = 치과 없음) */
export async function POST(req: NextRequest) {
  const g = await guard()
  if ("res" in g) return g.res
  const b = await req.json().catch(() => ({}))
  const body = str(b.body, 2000)
  if (!body) return fail("메모 내용을 입력하세요")
  const raw = str(b.clinicId, 40)
  const clinicId = raw && raw !== "internal" ? raw : null
  if (clinicId && !canAccessClinic(g.actor, clinicId)) return fail("권한이 없습니다", 403)
  const memo = await prisma.workMemo.create({ data: { userId: g.actor.id, body, clinicId }, select: memoSelect })
  return NextResponse.json(memo, { status: 201 })
}

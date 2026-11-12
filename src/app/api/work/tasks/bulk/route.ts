import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { canAccessTask } from "@/lib/requests/access"
import { guard, fail } from "@/lib/work/common"
import { updateTask, type TaskPatch } from "@/lib/work/tasks"

// 업무 일괄 수정.
//  { ids: string[], patch: TaskPatch }            같은 변경을 여러 업무에
//  { items: { id: string, patch: TaskPatch }[] }  업무마다 다른 변경(순서 다시 매기기 등)
// 업무마다 권한·검수 규칙을 따로 확인하고, 실패한 업무만 errors 에 담아 돌려준다.
// 응답 { ok: string[], errors: { [id]: 사유 } }

const MAX = 300
const KEYS = ["title", "status", "priority", "category", "assigneeUserId", "startOn", "dueOn", "groupId", "sortOrder"] as const

function clean(p: unknown): TaskPatch | null {
  if (!p || typeof p !== "object") return null
  const src = p as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const k of KEYS) if (k in src) out[k] = src[k]
  return Object.keys(out).length ? (out as TaskPatch) : null
}

export async function POST(req: NextRequest) {
  const g = await guard()
  if ("res" in g) return g.res
  const b = await req.json().catch(() => null)
  if (!b || typeof b !== "object") return fail("잘못된 요청")

  let jobs: { id: string; patch: TaskPatch }[] = []
  if (Array.isArray(b.items)) {
    for (const it of b.items) {
      const patch = clean(it?.patch)
      if (typeof it?.id === "string" && patch) jobs.push({ id: it.id, patch })
    }
  } else if (Array.isArray(b.ids)) {
    const patch = clean(b.patch)
    if (!patch) return fail("바꿀 내용이 없습니다")
    const ids = Array.from(new Set((b.ids as unknown[]).filter((x): x is string => typeof x === "string")))
    jobs = ids.map((id) => ({ id, patch }))
  }
  if (!jobs.length) return fail("업무를 고르세요")
  if (jobs.length > MAX) return fail(`한 번에 ${MAX}건까지 바꿀 수 있습니다`)

  const rows = await prisma.task.findMany({
    where: { id: { in: jobs.map((j) => j.id) } },
    select: { id: true, clinicId: true, reviewRequired: true, reviews: { orderBy: { reviewedAt: "desc" }, take: 1, select: { decision: true } } },
  })
  const byId = new Map(rows.map((r) => [r.id, r]))
  const ok: string[] = []
  const errors: Record<string, string> = {}

  for (const { id, patch } of jobs) {
    const t = byId.get(id)
    if (!t || !canAccessTask(g.actor, t.clinicId)) {
      errors[id] = "찾을 수 없습니다"
      continue
    }
    // 의료광고 검수가 필요한 원고는 검수 승인 뒤에만 완료 (단건 PATCH 와 같은 규칙)
    if (patch.status === "DONE" && t.reviewRequired && t.reviews[0]?.decision !== "APPROVED") {
      errors[id] = "의료광고 검수 승인 뒤에 완료할 수 있습니다"
      continue
    }
    try {
      await updateTask(id, patch, g.actor.id)
      ok.push(id)
    } catch (e) {
      errors[id] = (e as Error).message
    }
  }
  return NextResponse.json({ ok, errors })
}

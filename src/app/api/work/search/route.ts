import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { guard, KST_MS } from "@/lib/work/common"
import { eventScope } from "@/lib/work/calendar"

// 통합 검색(Ctrl+K): 업무·치과·파일·일정 제목 검색. 볼 수 있는 것만.
// 응답 { groups: [{ key, label, items: [{ id, title, sub, href }] }] }

const STATUS: Record<string, string> = { TODO: "할 일", BLOCKED: "자료 대기", IN_PROGRESS: "진행중", IN_REVIEW: "검토중", DONE: "완료", CANCELLED: "취소" }
const kstDay = (d: Date) => new Date(d.getTime() + KST_MS).toISOString().slice(0, 10)
const kstMonth = () => new Date(Date.now() + KST_MS).toISOString().slice(0, 7)

export async function GET(req: NextRequest) {
  const g = await guard()
  if ("res" in g) return g.res
  const actor = g.actor
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 60)
  if (!q) return NextResponse.json({ groups: [] })
  const like = { contains: q, mode: "insensitive" as const }
  const clinicIds = actor.clinicIds ?? []

  // 직원: 담당 치과 + 사내(치과 없음). 마스터: 전체
  const taskWhere: Prisma.TaskWhereInput = actor.isMaster
    ? { title: like }
    : { title: like, OR: [{ clinicId: { in: clinicIds } }, { clinicId: null }] }
  const fileWhere: Prisma.SharedFileWhereInput = actor.isMaster
    ? { title: like, deletedAt: null }
    : { title: like, deletedAt: null, OR: [{ clinicId: null }, { clinicId: { in: clinicIds } }] }

  const me = actor.isMaster ? await prisma.user.findUnique({ where: { id: actor.id }, select: { agencyId: true } }) : null
  const clinicWhere: Prisma.ClinicWhereInput = actor.isMaster ? { agencyId: me?.agencyId, name: like } : { id: { in: clinicIds }, name: like }

  const [tasks, clinics, files, events] = await Promise.all([
    prisma.task.findMany({
      where: taskWhere,
      orderBy: [{ updatedAt: "desc" }],
      take: 8,
      select: { id: true, title: true, status: true, dueOn: true, clinic: { select: { name: true } } },
    }),
    prisma.clinic.findMany({ where: clinicWhere, orderBy: { name: "asc" }, take: 6, select: { id: true, name: true } }),
    prisma.sharedFile.findMany({
      where: fileWhere,
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: { id: true, title: true, clinic: { select: { name: true } } },
    }),
    prisma.calendarEvent.findMany({
      where: { AND: [eventScope(actor), { title: like }] },
      orderBy: { startAt: "desc" },
      take: 6,
      select: { id: true, title: true, startAt: true, clinic: { select: { name: true } } },
    }),
  ])

  const month = kstMonth()
  const groups = [
    {
      key: "tasks",
      label: "업무",
      items: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        sub: [t.clinic?.name ?? "THINKLAB 사내", STATUS[t.status] ?? t.status, t.dueOn ? `마감 ${t.dueOn.toISOString().slice(5, 10).replace("-", ".")}` : null].filter(Boolean).join(" · "),
        href: `/work/tasks?open=${t.id}`,
      })),
    },
    {
      key: "clinics",
      label: "치과",
      items: clinics.map((c) => ({ id: c.id, title: c.name, sub: `${month} 월 현황`, href: `/work/clinics/${c.id}/${month}`, alt: { label: "보드", href: `/work/board?scope=${c.id}` } })),
    },
    {
      key: "files",
      label: "파일",
      items: files.map((f) => ({ id: f.id, title: f.title, sub: f.clinic?.name ?? "회사 공통", href: `/work/files?file=${f.id}` })),
    },
    {
      key: "events",
      label: "일정",
      items: events.map((e) => ({ id: e.id, title: e.title, sub: [kstDay(e.startAt).slice(5).replace("-", "."), e.clinic?.name].filter(Boolean).join(" · "), href: `/work/calendar?event=${e.id}` })),
    },
  ].filter((g) => g.items.length)

  return NextResponse.json({ groups })
}

export const dynamic = "force-dynamic"

import { prisma } from "@/lib/db"
import { requireWorkActor } from "@/lib/work/actor"
import CalendarClient from "./CalendarClient"

export default async function CalendarPage() {
  const actor = await requireWorkActor()
  // 참석자로 고를 수 있는 사람: 재직 중인 내부 계정
  const people = await prisma.user.findMany({
    where: { role: { in: ["STAFF", "MASTER"] }, status: "APPROVED", OR: [{ employee: null }, { employee: { OR: [{ leftOn: null }, { leftOn: { gt: new Date() } }] } }] },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })
  // 사람별 보기 행: 재직 중인 직원(대표도 직원 행이 있으면 포함)
  const staff = await prisma.employee.findMany({
    where: { OR: [{ leftOn: null }, { leftOn: { gt: new Date() } }], user: { role: { in: ["STAFF", "MASTER"] } } },
    select: { userId: true, user: { select: { name: true } } },
    orderBy: { user: { name: "asc" } },
  })
  return (
    <CalendarClient
      clinics={actor.clinics}
      people={people}
      staff={staff.map((s) => ({ id: s.userId, name: s.user.name }))}
      me={actor.id}
      isMaster={actor.isMaster}
    />
  )
}

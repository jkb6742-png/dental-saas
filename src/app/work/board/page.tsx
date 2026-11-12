export const dynamic = "force-dynamic"

import { requireWorkActor } from "@/lib/work/actor"
import BoardClient from "./BoardClient"

// 업무 보드: 카테고리(THINKLAB 사내·치과별) → 그룹 → 업무 표
export default async function BoardPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const actor = await requireWorkActor()
  const { scope } = await searchParams
  return <BoardClient me={{ id: actor.id, name: actor.name }} initialScope={scope ?? "internal"} />
}

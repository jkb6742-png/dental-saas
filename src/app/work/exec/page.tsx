export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { requireWorkActor } from "@/lib/work/actor"
import { currentMonth, isMonth } from "@/lib/work/common"
import { loadExecData } from "./data"
import ExecClient from "./ExecClient"

// 경영 대시보드(대표만)
export default async function ExecPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const actor = await requireWorkActor()
  if (!actor.isMaster) redirect("/work/today")
  const sp = await searchParams
  const month = isMonth(sp.month) ? sp.month : currentMonth()
  const data = await loadExecData(actor.id, month)
  return <ExecClient initial={data} />
}

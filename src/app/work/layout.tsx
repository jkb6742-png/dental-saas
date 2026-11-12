export const dynamic = "force-dynamic"

import { requireWorkActor } from "@/lib/work/actor"
import { workNavFor } from "./nav"
import WorkNav from "./WorkNav"
import WorkHeader from "./WorkHeader"
import RemoteCheckPopup from "./RemoteCheckPopup"

// Insight 대시보드와 같은 틀: 왼쪽 92px 아이콘 메뉴(+260px 2단 패널) + 위 52px 상단 바 + 본문 스크롤
export default async function WorkLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireWorkActor()
  const groups = workNavFor(actor.isMaster)

  return (
    <div className="flex h-screen overflow-hidden bg-[#f2f2ef] text-[#0a0a0a]">
      <WorkNav groups={groups} clinics={actor.clinics} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <WorkHeader userName={actor.name} isMaster={actor.isMaster} groups={groups} />
        <main className="flex-1 overflow-y-auto px-4 py-3">
          <div className="mx-auto w-full max-w-[2000px]">{children}</div>
        </main>
      </div>
      <RemoteCheckPopup />
    </div>
  )
}

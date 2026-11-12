export const dynamic = "force-dynamic"

import { requireWorkActor } from "@/lib/work/actor"
import AccountsClient from "./AccountsClient"

// 계정 관리: 사내·치과별 서비스 계정(네이버·인스타·홈페이지 관리자 등)
export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const actor = await requireWorkActor()
  const { scope } = await searchParams
  return <AccountsClient clinics={actor.clinics} isMaster={actor.isMaster} initialScope={scope ?? "internal"} />
}

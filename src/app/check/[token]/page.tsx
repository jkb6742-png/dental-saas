export const dynamic = "force-dynamic"

import { requireWorkActor } from "@/lib/work/actor"
import { lookupCheck } from "@/lib/work/presence"
import CheckClient from "./CheckClient"

// 휴대폰 재택 인증 화면. QR 을 찍으면 여기로 온다. 로그인한 본인 것만, 숫자를 직접 골라야 인증.
export default async function RemoteCheckPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const actor = await requireWorkActor()
  const found = await lookupCheck(token, actor.id)
  return (
    <div className="min-h-screen bg-[#f2f2ef] text-[#0a0a0a] px-4 py-8">
      <div className="mx-auto max-w-[360px]">
        <div className="text-[13px] font-extrabold tracking-[-0.03em]">THINKLAB</div>
        <h1 className="mt-1 text-[20px] font-bold">재택 근무 확인</h1>
        <p className="mt-1 text-[13px] text-[#6f6f6a]">{actor.name}</p>
        {"error" in found ? (
          <p className="mt-6 text-[15px] leading-relaxed">{found.error}</p>
        ) : (
          <CheckClient token={token} choices={found.choices} />
        )}
      </div>
    </div>
  )
}

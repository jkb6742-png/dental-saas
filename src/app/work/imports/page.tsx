export const dynamic = "force-dynamic"

import Link from "next/link"
import { prisma } from "@/lib/db"
import SectionCard from "@/components/ui/SectionCard"
import { requireWorkActor } from "@/lib/work/actor"
import { KST_MS } from "@/lib/work/common"

// PMS 자료 올리기: 치과별 엑셀 업로드·데이터 점검 바로가기와 최근 업로드 기록
const kst = (d: Date) => new Date(d.getTime() + KST_MS).toISOString().slice(0, 16).replace("T", " ")

export default async function ImportsPage() {
  const actor = await requireWorkActor()
  const ids = actor.clinics.map((c) => c.id)
  const logs = await prisma.securityLog.findMany({
    where: { event: { in: ["DATA_UPLOAD_PARSE", "DATA_UPLOAD_SAVE"] }, clinicId: { in: ids } },
    orderBy: { timestamp: "desc" },
    take: 60,
  })
  const users = await prisma.user.findMany({ where: { id: { in: logs.map((l) => l.userId).filter(Boolean) as string[] } }, select: { id: true, name: true } })
  const name = (id: string | null) => users.find((u) => u.id === id)?.name ?? "-"
  const clinicName = (id: string | null) => actor.clinics.find((c) => c.id === id)?.name ?? "-"
  const last = new Map<string, Date>()
  for (const l of logs) if (l.event === "DATA_UPLOAD_SAVE" && l.clinicId && !last.has(l.clinicId)) last.set(l.clinicId, l.timestamp)

  return (
    <div className="space-y-4">
      <h1 className="text-[20px] font-bold">PMS 자료 올리기</h1>
      <SectionCard title="치과별" description="엑셀 업로드는 직원 누구나 할 수 있고, 올린 기록이 남습니다">
        <table className="w-full text-[14px]">
          <tbody>
            {actor.clinics.map((c) => (
              <tr key={c.id} className="border-b border-[#ecece9] last:border-0">
                <td className="py-2 pr-3 font-medium">{c.name}</td>
                <td className="py-2 pr-3 text-[13px] text-[#6f6f6a]">마지막 저장 {last.get(c.id) ? kst(last.get(c.id)!) : "기록 없음"}</td>
                <td className="py-2 text-right space-x-2">
                  <Link prefetch={false} className="px-3 py-1.5 rounded bg-[#191f28] text-white text-[13px]" href={`/dashboard/${c.id}/excel-upload`}>
                    엑셀 올리기
                  </Link>
                  <Link prefetch={false} className="px-3 py-1.5 rounded border border-[#d1d1cc] text-[13px]" href={`/dashboard/${c.id}/data-check`}>
                    데이터 점검
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>
      <SectionCard title="최근 업로드 기록">
        {logs.length === 0 ? (
          <p className="text-[13px] text-[#6f6f6a]">기록이 없습니다.</p>
        ) : (
          <table className="w-full text-[13px]">
            <tbody>
              {logs.map((l) => {
                const d = (l.details ?? {}) as Record<string, any>
                return (
                  <tr key={l.id} className="border-b border-[#ecece9] last:border-0">
                    <td className="py-1.5 pr-3 w-[130px] text-[#6f6f6a]">{kst(l.timestamp)}</td>
                    <td className="py-1.5 pr-3 w-[120px]">{clinicName(l.clinicId)}</td>
                    <td className="py-1.5 pr-3 w-[70px]">{name(l.userId)}</td>
                    <td className="py-1.5 pr-3 w-[50px]">{l.event === "DATA_UPLOAD_SAVE" ? "저장" : "읽기"}</td>
                    <td className="py-1.5 truncate text-[#6f6f6a]">{d.fileName ?? d.fileType ?? JSON.stringify(d).slice(0, 80)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </SectionCard>
    </div>
  )
}

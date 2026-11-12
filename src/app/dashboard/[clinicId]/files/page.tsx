export const dynamic = "force-dynamic"

import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { getActor, canAccessClinic } from "@/lib/requests/access"
import SectionCard from "@/components/ui/SectionCard"

// 원장 자료실: THINKLAB 이 이 치과에 공개한 파일만 보인다.
const bytes = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`)
const kstDay = (d: Date) => new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 10)

export default async function ClinicFilesPage({ params }: { params: Promise<{ clinicId: string }> }) {
  const actor = await getActor()
  if (!actor) redirect("/login")
  const { clinicId } = await params
  if (!canAccessClinic(actor, clinicId)) redirect("/dashboard")

  const files = await prisma.sharedFile.findMany({
    where: { clinicId, visibility: "CLINIC", deletedAt: null },
    select: {
      id: true,
      title: true,
      publishedAt: true,
      updatedAt: true,
      currentVersion: true,
      versions: { orderBy: { versionNo: "desc" }, take: 1, select: { originalName: true, byteSize: true } },
    },
    orderBy: { publishedAt: "desc" },
    take: 300,
  })

  return (
    <div className="space-y-4">
      <SectionCard title="자료실" description="THINKLAB 이 전달한 자료">
        {files.length === 0 ? (
          <p className="text-[13px] text-[#6f6f6a]">아직 전달된 자료가 없습니다.</p>
        ) : (
          <table className="w-full text-[14px]">
            <tbody>
              {files.map((f) => (
                <tr key={f.id} className="border-b border-[#ecece9] last:border-0">
                  <td className="py-2 pr-3">
                    <a href={`/api/clinic-files/${f.id}?inline=1`} target="_blank" rel="noreferrer" className="hover:underline">
                      {f.title}
                    </a>
                    <div className="text-[12px] text-[#6f6f6a]">
                      {f.versions[0]?.originalName} · {f.versions[0] ? bytes(Number(f.versions[0].byteSize)) : ""}
                      {f.currentVersion > 1 && ` · 수정본 ${f.currentVersion}`}
                    </div>
                  </td>
                  <td className="py-2 pr-3 w-[100px] text-[13px] text-[#6f6f6a]">{kstDay(f.updatedAt)}</td>
                  <td className="py-2 w-[60px] text-right">
                    <a href={`/api/clinic-files/${f.id}`} className="text-[13px] underline">
                      받기
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>
    </div>
  )
}

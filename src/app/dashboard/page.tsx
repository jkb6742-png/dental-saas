import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import MasterWorkspace from "./MasterWorkspace"

export const dynamic = "force-dynamic"

export default async function DashboardRedirect() {
  const session = await auth()
  if (!session) redirect("/login")

  const userRole = (session.user as any).role
  const isMaster = userRole === 'MASTER'

  // 직원은 직원 화면에서 시작한다
  if (userRole === "STAFF") redirect("/work")

  if (isMaster) {
    // 마스터는 자신의 에이전시에 속한 치과만 관리
    const agencyId = (session.user as any).agencyId
    const clinics = await prisma.clinic.findMany({
      where: { agencyId },
      include: { agency: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    })
    const clinicIds = clinics.map((c) => c.id)

    // 각 치과에서 사용하는 계정(초대코드로 연결된 사용자)
    const users = clinicIds.length
      ? await prisma.user.findMany({
          where: { clinicId: { in: clinicIds } },
          orderBy: { createdAt: "asc" },
        })
      : []
    const userIds = users.map((u) => u.id)

    // 계정별 마지막 로그인 시각
    const lastLogins = userIds.length
      ? await prisma.securityLog.groupBy({
          by: ["userId"],
          where: { event: "LOGIN_SUCCESS", userId: { in: userIds } },
          _max: { timestamp: true },
        })
      : []
    const lastLoginMap = new Map(
      lastLogins.map((l) => [l.userId, l._max.timestamp])
    )

    // 치과별 최근 로그인 이력
    const recentLoginRows = clinicIds.length
      ? await prisma.securityLog.findMany({
          where: { event: "LOGIN_SUCCESS", clinicId: { in: clinicIds } },
          orderBy: { timestamp: "desc" },
          take: 120,
          select: { userId: true, clinicId: true, timestamp: true, ip: true },
        })
      : []
    const userInfoMap = new Map(
      users.map((u) => [u.id, { name: u.name, email: u.email }])
    )

    // 치과별 자료 최신성(마지막 업로드/접수수납/월간요약)
    const [fileAgg, recAgg, monAgg] = clinicIds.length
      ? await Promise.all([
          prisma.fileUpload.groupBy({
            by: ["clinicId"],
            where: { clinicId: { in: clinicIds } },
            _max: { processedAt: true, uploadedAt: true },
          }),
          prisma.receptionRecord.groupBy({
            by: ["clinicId"],
            where: { clinicId: { in: clinicIds } },
            _max: { createdAt: true },
            _count: { clinicId: true },
          }),
          prisma.monthlySummary.groupBy({
            by: ["clinicId"],
            where: { clinicId: { in: clinicIds } },
            _max: { updatedAt: true },
          }),
        ])
      : [[], [], []]

    const clinicData = clinics.map((c) => {
      const accounts = users
        .filter((u) => u.clinicId === c.id)
        .map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          status: u.status,
          lastLoginAt: (lastLoginMap.get(u.id) ?? null) as Date | null,
        }))

      const f = fileAgg.find((x: any) => x.clinicId === c.id)
      const r = recAgg.find((x: any) => x.clinicId === c.id)
      const m = monAgg.find((x: any) => x.clinicId === c.id)

      const recentLogins = recentLoginRows
        .filter((x) => x.clinicId === c.id)
        .slice(0, 12)
        .map((x) => ({
          userName: userInfoMap.get(x.userId ?? "")?.name ?? "(알 수 없음)",
          email: userInfoMap.get(x.userId ?? "")?.email ?? "",
          at: x.timestamp as Date,
          ip: x.ip ?? null,
        }))

      return {
        id: c.id,
        name: c.name,
        code: c.code,
        agencyName: c.agency?.name ?? "",
        createdAt: c.createdAt as Date,
        accounts,
        freshness: {
          lastUpload:
            (f?._max.processedAt ?? f?._max.uploadedAt ?? null) as Date | null,
          lastReception: (r?._max.createdAt ?? null) as Date | null,
          receptionCount: (r as any)?._count?.clinicId ?? 0,
          lastMonthly: (m?._max.updatedAt ?? null) as Date | null,
        },
        recentLogins,
      }
    })

    return (
      <MasterWorkspace
        clinics={clinicData}
        masterName={session.user?.name ?? "마스터"}
      />
    )
  }

  // 비마스터(VIEWER 등)는 초대코드에 묶인 '자신의 치과'로만 이동한다.
  // (이전 버그: agency 전체 치과 중 첫 번째로 리다이렉트 → 다른 치과 데이터 노출)
  const userClinicId = (session.user as any).clinicId as string | null

  if (userClinicId) {
    const ownClinic = await prisma.clinic.findUnique({
      where: { id: userClinicId },
      select: { id: true },
    })
    if (ownClinic) {
      redirect(`/dashboard/${ownClinic.id}`)
    }
  }

  // No clinic yet — show setup screen
  return (
    <div className=" flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <div className="text-[48px] mb-2.5">🦷</div>
        <h2 className="text-[20px] font-bold text-[#191f28] mb-2">
          치과를 먼저 추가해주세요
        </h2>
        <p className="text-[14px] text-[#8b95a1] mb-3">
          설정 메뉴에서 관리할 치과를 등록하면 대시보드가 활성화됩니다.
        </p>
        <a
          href="/admin/clinics"
          className="inline-flex items-center justify-center px-5 py-3 bg-[#0062ff] hover:bg-[#0052d6] text-white text-[15px] font-semibold rounded-[12px] transition-colors"
        >
          치과 등록하기
        </a>
      </div>
    </div>
  )
}

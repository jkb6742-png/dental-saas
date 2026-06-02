import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import Link from "next/link"

export default async function DashboardRedirect() {
  const session = await auth()
  if (!session) redirect("/login")

  // 디버깅: 현재 사용자 정보 로그
  console.log('🔍 [DASHBOARD] 현재 사용자 정보:', {
    userId: (session.user as any).id,
    name: session.user?.name,
    email: session.user?.email,
    role: (session.user as any).role,
    agencyId: (session.user as any).agencyId,
    agencyName: (session.user as any).agencyName
  })

  const userRole = (session.user as any).role
  const isMaster = userRole === 'MASTER'

  if (isMaster) {
    // 마스터는 모든 치과 목록 표시
    const allClinics = await prisma.clinic.findMany({
      include: {
        agency: {
          select: { name: true }
        }
      },
      orderBy: { createdAt: "desc" },
    })

    return (
      <div className="min-h-screen bg-[#f9fafb] flex items-center justify-center p-4">
        <div className="w-full max-w-4xl">
          <div className="text-center mb-8">
            <div className="text-[48px] mb-4">👑</div>
            <h2 className="text-[24px] font-bold text-[#191f28] mb-2">
              마스터 관리자 - 치과 선택
            </h2>
            <p className="text-[14px] text-[#8b95a1]">
              관리할 치과를 선택해주세요. 모든 등록된 치과에 접근 가능합니다.
            </p>
          </div>

          {allClinics.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allClinics.map((clinic) => (
                <Link
                  key={clinic.id}
                  href={`/dashboard/${clinic.id}`}
                  className="bg-white p-6 rounded-xl border border-[#e5e8eb] hover:border-[#3182f6] hover:shadow-lg transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-[#ebf3fe] rounded-full flex items-center justify-center">
                      <span className="text-[16px]">🦷</span>
                    </div>
                    <div>
                      <h3 className="text-[16px] font-semibold text-[#191f28]">
                        {clinic.name}
                      </h3>
                      <p className="text-[13px] text-[#8b95a1]">
                        {clinic.agency?.name}
                      </p>
                    </div>
                  </div>
                  <div className="text-[12px] text-[#6b7684]">
                    등록일: {new Date(clinic.createdAt).toLocaleDateString('ko-KR')}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center">
              <p className="text-[14px] text-[#8b95a1] mb-4">
                등록된 치과가 없습니다.
              </p>
              <Link
                href="/admin/clinics"
                className="inline-flex items-center justify-center px-5 py-3 bg-[#3182f6] hover:bg-[#1b64da] text-white text-[15px] font-semibold rounded-[12px] transition-colors"
              >
                치과 등록하기
              </Link>
            </div>
          )}
        </div>
      </div>
    )
  }

  // 일반 사용자는 첫 번째 치과로 리다이렉트
  const agencyId = (session.user as any).agencyId

  console.log('🔍 [DASHBOARD] 일반 사용자 치과 검색:', {
    userId: (session.user as any).id,
    agencyId: agencyId
  })

  const userClinics = await prisma.clinic.findMany({
    where: { agencyId },
    orderBy: { createdAt: "asc" },
    include: {
      agency: {
        select: { name: true }
      }
    }
  })

  console.log('🔍 [DASHBOARD] 찾은 치과들:', userClinics.map(c => ({
    id: c.id,
    name: c.name,
    agencyName: c.agency?.name,
    createdAt: c.createdAt
  })))

  if (userClinics.length > 0) {
    console.log('🔍 [DASHBOARD] 첫 번째 치과로 리다이렉트:', userClinics[0].name)
    redirect(`/dashboard/${userClinics[0].id}`)
  }

  // No clinic yet — show setup screen
  return (
    <div className="min-h-screen bg-[#f9fafb] flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <div className="text-[48px] mb-4">🦷</div>
        <h2 className="text-[20px] font-bold text-[#191f28] mb-2">
          치과를 먼저 추가해주세요
        </h2>
        <p className="text-[14px] text-[#8b95a1] mb-6">
          설정 메뉴에서 관리할 치과를 등록하면 대시보드가 활성화됩니다.
        </p>
        <a
          href="/admin/clinics"
          className="inline-flex items-center justify-center px-5 py-3 bg-[#3182f6] hover:bg-[#1b64da] text-white text-[15px] font-semibold rounded-[12px] transition-colors"
        >
          치과 등록하기
        </a>
      </div>
    </div>
  )
}

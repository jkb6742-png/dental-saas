import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { prisma } from "@/lib/db"
import PEIReportList from "./PEIReportList"

export default async function PEIPage({ params }: { params: Promise<{ clinicId: string }> }) {
  const session = await auth()
  if (!session) redirect("/login")

  const { clinicId } = await params
  const userRole = (session.user as any).role
  const isMaster = userRole === 'MASTER'

  // 업로드된 PEI 보고서 목록 조회
  const reports = await prisma.peiReport.findMany({
    where: { clinicId },
    orderBy: [
      { year: 'desc' },
      { month: 'desc' }
    ],
    include: {
      clinic: { select: { name: true } }
    }
  })

  // 월별로 그룹화
  const reportsByYearMonth = reports.reduce((acc, report) => {
    const key = `${report.year}-${String(report.month).padStart(2, '0')}`
    if (!acc[key]) {
      acc[key] = {
        year: report.year,
        month: report.month,
        reports: []
      }
    }
    acc[key].reports.push(report)
    return acc
  }, {} as Record<string, { year: number; month: number; reports: typeof reports }>)

  const groupedReports = Object.values(reportsByYearMonth)

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* 헤더 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">PEI 보고서 관리</h1>
              <p className="text-gray-600 mt-1">
                {isMaster
                  ? "Patient Experience Index 보고서를 업로드하고 관리하세요"
                  : "Patient Experience Index 보고서를 확인하세요"
                }
              </p>
              {!isMaster && (
                <p className="text-sm text-amber-600 mt-1">
                  💡 보고서 업로드는 마스터 계정에서만 가능합니다
                </p>
              )}
            </div>
            {isMaster && (
              <Link
                href={`/dashboard/${clinicId}/pei/upload`}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                + 새 보고서 업로드
              </Link>
            )}
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">📄</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">총 보고서</p>
                <p className="text-2xl font-bold text-gray-900">{reports.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">📅</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">월별 그룹</p>
                <p className="text-2xl font-bold text-gray-900">{groupedReports.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">⏰</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">최근 업로드</p>
                <p className="text-lg font-bold text-gray-900">
                  {reports.length > 0
                    ? new Date(reports[0].generatedAt).toLocaleDateString('ko-KR')
                    : '없음'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 사용 방법 안내 */}
        <div className={`border rounded-lg p-4 mb-6 ${
          isMaster
            ? 'bg-blue-50 border-blue-200'
            : 'bg-gray-50 border-gray-200'
        }`}>
          <h3 className={`font-semibold mb-2 ${
            isMaster ? 'text-blue-900' : 'text-gray-700'
          }`}>
            {isMaster ? '🚀 새로운 PEI 시스템' : '📋 PEI 보고서 확인'}
          </h3>
          <p className={`text-sm mb-3 ${
            isMaster ? 'text-blue-800' : 'text-gray-600'
          }`}>
            {isMaster
              ? "이제 더 간단하고 안정적인 방식으로 PEI 보고서를 관리할 수 있습니다!"
              : "등록된 PEI 보고서를 확인하고 다운로드할 수 있습니다."
            }
          </p>
          {isMaster ? (
            <ol className="text-sm text-blue-800 space-y-1">
              <li><strong>1단계:</strong> Claude에게 PEI 보고서 생성을 요청하세요</li>
              <li><strong>2단계:</strong> 생성된 HTML 파일을 다운로드하세요</li>
              <li><strong>3단계:</strong> 위의 "새 보고서 업로드" 버튼으로 파일을 업로드하세요</li>
              <li><strong>4단계:</strong> 아래 목록에서 언제든지 보고서를 확인하세요</li>
            </ol>
          ) : (
            <ol className="text-sm text-gray-600 space-y-1">
              <li><strong>보기:</strong> 📄 보기 버튼을 클릭하여 브라우저에서 보고서를 확인하세요</li>
              <li><strong>다운로드:</strong> 💾 다운로드 버튼을 클릭하여 HTML 파일을 저장하세요</li>
              <li><strong>공유:</strong> 다운로드한 파일을 이메일이나 메신저로 공유할 수 있습니다</li>
            </ol>
          )}
        </div>

        {/* 보고서 목록 (월별 구분) */}
        <div className="space-y-6">
          {groupedReports.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <div className="text-gray-400 text-6xl mb-4">📄</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">아직 업로드된 보고서가 없습니다</h3>
              <p className="text-gray-500 mb-4">
                첫 번째 PEI 보고서를 업로드해보세요!
              </p>
              <Link
                href={`/dashboard/${clinicId}/pei/upload`}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                보고서 업로드하기
              </Link>
            </div>
          ) : (
            groupedReports.map((group) => (
              <div key={`${group.year}-${group.month}`} className="bg-white rounded-lg shadow-sm">
                {/* 월별 헤더 */}
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-4 rounded-t-lg">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold">
                      {group.year}년 {group.month}월
                    </h2>
                    <span className="bg-white/20 text-white text-sm px-3 py-1 rounded-full">
                      {group.reports.length}개 보고서
                    </span>
                  </div>
                </div>

                {/* 보고서 목록 */}
                <div className="divide-y divide-gray-200">
                  <PEIReportList reports={group.reports} isMaster={isMaster} />
                </div>
              </div>
            ))
          )}
        </div>

        {/* 추가 도움말 */}
        {reports.length > 0 && (
          <div className="mt-6 bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">💡 도움말</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• <strong>보기:</strong> 브라우저에서 보고서를 확인할 수 있습니다</li>
              <li>• <strong>다운로드:</strong> HTML 파일을 다운로드하여 저장하거나 공유할 수 있습니다</li>
              {isMaster && (
                <>
                  <li>• <strong>삭제:</strong> 불필요한 보고서를 삭제할 수 있습니다 (복구 불가)</li>
                  <li>• 같은 연월의 보고서를 다시 업로드하면 기존 보고서가 업데이트됩니다</li>
                </>
              )}
              {!isMaster && (
                <li>• <strong>권한:</strong> 보고서 업로드/삭제는 마스터 계정에서만 가능합니다</li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
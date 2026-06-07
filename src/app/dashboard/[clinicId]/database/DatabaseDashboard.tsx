"use client"

import Link from "next/link"
import { Database, Users, DollarSign, Activity, MapPin, Calendar, AlertCircle, CheckCircle } from "lucide-react"

interface TableStats {
  count: number
  latest?: Date | string | null
  health: 'healthy' | 'warning' | 'error'
}

interface DatabaseDashboardProps {
  clinicId: string
  tableStats: {
    revenue: TableStats
    patientInfo: TableStats
    treatmentData: TableStats
    visitRouteData: TableStats
    regionData: TableStats
    ageData: TableStats
  }
  dataQuality: {
    revenueIntegrity: boolean
    patientDataComplete: boolean
    monthlyStatsAvailable: boolean
  }
}

export default function DatabaseDashboard({
  clinicId,
  tableStats,
  dataQuality
}: DatabaseDashboardProps) {
  const tables = [
    {
      id: 'revenue',
      name: '💰 매출 데이터',
      description: '일별 매출, 지출, 순이익 정보',
      icon: <DollarSign className="w-6 h-6" />,
      stats: tableStats.revenue,
      color: 'from-green-500 to-emerald-600'
    },
    {
      id: 'patientInfo',
      name: '👥 환자 정보',
      description: '환자 방문 기록, 대기시간, 진료비',
      icon: <Users className="w-6 h-6" />,
      stats: tableStats.patientInfo,
      color: 'from-blue-500 to-cyan-600'
    },
    {
      id: 'treatmentData',
      name: '🦷 진료별 통계',
      description: '진료 타입별 월간 집계 데이터',
      icon: <Activity className="w-6 h-6" />,
      stats: tableStats.treatmentData,
      color: 'from-purple-500 to-violet-600'
    },
    {
      id: 'visitRouteData',
      name: '🛣️ 내원경로 데이터',
      description: '내원경로별 신환/구환/매출 집계',
      icon: <MapPin className="w-6 h-6" />,
      stats: tableStats.visitRouteData,
      color: 'from-orange-500 to-red-600'
    },
    {
      id: 'regionData',
      name: '📍 지역별 데이터',
      description: '지역별 환자 분포 및 비율',
      icon: <MapPin className="w-6 h-6" />,
      stats: tableStats.regionData,
      color: 'from-teal-500 to-cyan-600'
    },
    {
      id: 'ageData',
      name: '👶👴 연령별 데이터',
      description: '연령대별 환자 분포 및 비율',
      icon: <Calendar className="w-6 h-6" />,
      stats: tableStats.ageData,
      color: 'from-indigo-500 to-purple-600'
    }
  ]

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy': return 'text-green-600'
      case 'warning': return 'text-yellow-600'
      case 'error': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'healthy': return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'warning': return <AlertCircle className="w-5 h-5 text-yellow-600" />
      case 'error': return <AlertCircle className="w-5 h-5 text-red-600" />
      default: return <AlertCircle className="w-5 h-5 text-gray-600" />
    }
  }

  const formatDate = (date: Date | string | null) => {
    if (!date) return '데이터 없음'
    if (typeof date === 'string') return date
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30">
      <div className="space-y-8 p-6">
        {/* 헤더 */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-slate-600 to-slate-700 rounded-xl flex items-center justify-center">
              <Database className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">데이터베이스 관리</h1>
              <p className="text-slate-600">6개 핵심 테이블의 데이터를 확인하고 관리하세요</p>
            </div>
          </div>

          {/* 데이터 품질 상태 */}
          <div className="bg-slate-50 rounded-xl p-4">
            <h3 className="font-semibold text-slate-800 mb-3">데이터 품질 상태</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                {dataQuality.revenueIntegrity ?
                  <CheckCircle className="w-5 h-5 text-green-600" /> :
                  <AlertCircle className="w-5 h-5 text-red-600" />
                }
                <span className={dataQuality.revenueIntegrity ? 'text-green-700' : 'text-red-700'}>
                  매출 데이터 무결성
                </span>
              </div>
              <div className="flex items-center gap-2">
                {dataQuality.patientDataComplete ?
                  <CheckCircle className="w-5 h-5 text-green-600" /> :
                  <AlertCircle className="w-5 h-5 text-red-600" />
                }
                <span className={dataQuality.patientDataComplete ? 'text-green-700' : 'text-red-700'}>
                  환자 데이터 완성도
                </span>
              </div>
              <div className="flex items-center gap-2">
                {dataQuality.monthlyStatsAvailable ?
                  <CheckCircle className="w-5 h-5 text-green-600" /> :
                  <AlertCircle className="w-5 h-5 text-red-600" />
                }
                <span className={dataQuality.monthlyStatsAvailable ? 'text-green-700' : 'text-red-700'}>
                  월간 통계 가용성
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 테이블 카드들 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tables.map((table) => (
            <Link
              key={table.id}
              href={`/dashboard/${clinicId}/database/${table.id}`}
              className="group"
            >
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-6 hover:shadow-lg hover:scale-[1.02] transition-all duration-300">
                {/* 헤더 */}
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-12 h-12 bg-gradient-to-br ${table.color} rounded-xl flex items-center justify-center`}>
                    {table.icon}
                  </div>
                  <div className="flex items-center gap-1">
                    {getHealthIcon(table.stats.health)}
                  </div>
                </div>

                {/* 제목 & 설명 */}
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-slate-900 mb-1 group-hover:text-blue-600 transition-colors">
                    {table.name}
                  </h3>
                  <p className="text-sm text-slate-600">{table.description}</p>
                </div>


                {/* 바로가기 화살표 */}
                <div className="mt-4 flex justify-end">
                  <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                    <span className="text-slate-600 group-hover:text-blue-600 text-sm">→</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* 빠른 작업 */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">빠른 작업</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <button className="p-4 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors text-left">
              <div className="font-medium text-slate-900 mb-1">전체 데이터 새로고침</div>
              <div className="text-sm text-slate-600">모든 테이블 재계산</div>
            </button>
            <button className="p-4 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors text-left">
              <div className="font-medium text-slate-900 mb-1">데이터 검증</div>
              <div className="text-sm text-slate-600">무결성 검사 실행</div>
            </button>
            <button className="p-4 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors text-left">
              <div className="font-medium text-slate-900 mb-1">백업 생성</div>
              <div className="text-sm text-slate-600">현재 데이터 백업</div>
            </button>
            <button className="p-4 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors text-left">
              <div className="font-medium text-slate-900 mb-1">통계 업데이트</div>
              <div className="text-sm text-slate-600">집계 테이블 갱신</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
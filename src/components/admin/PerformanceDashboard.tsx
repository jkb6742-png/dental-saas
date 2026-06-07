"use client"

import { useState, useEffect } from 'react'
import { BarChart3, Database, Zap, Clock, TrendingUp, RefreshCw } from 'lucide-react'

interface PerformanceStats {
  cache: {
    redis: any
    memory: {
      keys: number
      hits: number
      misses: number
      ksize: number
      vsize: number
    }
  }
  database: {
    slowQueries: number
    averageQueryTime: number
    connectionCount: number
  }
  api: {
    averageResponseTime: number
    requestsPerMinute: number
    errorRate: number
  }
}

export default function PerformanceDashboard() {
  const [stats, setStats] = useState<PerformanceStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchStats = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/performance')
      const data = await response.json()
      setStats(data)
      setLastUpdated(new Date())
    } catch (error) {
      console.error('Failed to fetch performance stats:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 30000) // 30초마다 업데이트
    return () => clearInterval(interval)
  }, [])

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M'
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K'
    }
    return num.toString()
  }

  const calculateHitRate = (hits: number, misses: number) => {
    const total = hits + misses
    return total > 0 ? ((hits / total) * 100).toFixed(1) : '0'
  }

  if (loading && !stats) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-64"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">성능 모니터링</h1>
          <p className="text-gray-600 mt-1">시스템 성능 및 캐시 상태를 실시간으로 모니터링합니다</p>
        </div>
        <div className="flex items-center gap-4">
          {lastUpdated && (
            <span className="text-sm text-gray-500">
              마지막 업데이트: {lastUpdated.toLocaleTimeString('ko-KR')}
            </span>
          )}
          <button
            onClick={fetchStats}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </button>
        </div>
      </div>

      {stats && (
        <>
          {/* 주요 지표 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {/* 캐시 히트율 */}
            <div className="bg-white rounded-lg shadow border p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Zap className="w-6 h-6 text-green-600" />
                </div>
                <span className="text-sm font-medium text-green-600 bg-green-100 px-2 py-1 rounded">
                  캐시
                </span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">
                {calculateHitRate(stats.cache.memory.hits, stats.cache.memory.misses)}%
              </h3>
              <p className="text-sm text-gray-600">캐시 히트율</p>
              <p className="text-xs text-gray-500 mt-2">
                Hit: {formatNumber(stats.cache.memory.hits)} / Miss: {formatNumber(stats.cache.memory.misses)}
              </p>
            </div>

            {/* API 응답시간 */}
            <div className="bg-white rounded-lg shadow border p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-6 h-6 text-blue-600" />
                </div>
                <span className="text-sm font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded">
                  API
                </span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">
                {stats.api.averageResponseTime}ms
              </h3>
              <p className="text-sm text-gray-600">평균 응답시간</p>
              <p className="text-xs text-gray-500 mt-2">
                {stats.api.requestsPerMinute}/분 요청
              </p>
            </div>

            {/* 데이터베이스 성능 */}
            <div className="bg-white rounded-lg shadow border p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Database className="w-6 h-6 text-purple-600" />
                </div>
                <span className="text-sm font-medium text-purple-600 bg-purple-100 px-2 py-1 rounded">
                  DB
                </span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">
                {stats.database.averageQueryTime}ms
              </h3>
              <p className="text-sm text-gray-600">평균 쿼리시간</p>
              <p className="text-xs text-gray-500 mt-2">
                느린 쿼리: {stats.database.slowQueries}개
              </p>
            </div>

            {/* 오류율 */}
            <div className="bg-white rounded-lg shadow border p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-orange-600" />
                </div>
                <span className="text-sm font-medium text-orange-600 bg-orange-100 px-2 py-1 rounded">
                  상태
                </span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">
                {stats.api.errorRate.toFixed(2)}%
              </h3>
              <p className="text-sm text-gray-600">오류율</p>
              <p className={`text-xs mt-2 ${stats.api.errorRate < 1 ? 'text-green-600' : 'text-red-600'}`}>
                {stats.api.errorRate < 1 ? '정상' : '주의 필요'}
              </p>
            </div>
          </div>

          {/* 상세 정보 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* 캐시 상세 정보 */}
            <div className="bg-white rounded-lg shadow border">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  캐시 상세 정보
                </h3>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">저장된 키</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatNumber(stats.cache.memory.keys)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">메모리 사용량</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatBytes(stats.cache.memory.vsize)}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">캐시 성능</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">히트</span>
                      <span className="text-sm font-medium text-green-600">
                        {formatNumber(stats.cache.memory.hits)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">미스</span>
                      <span className="text-sm font-medium text-red-600">
                        {formatNumber(stats.cache.memory.misses)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">히트율</span>
                      <span className="text-sm font-bold text-blue-600">
                        {calculateHitRate(stats.cache.memory.hits, stats.cache.memory.misses)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 시스템 상태 */}
            <div className="bg-white rounded-lg shadow border">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  시스템 상태
                </h3>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">데이터베이스 연결</span>
                    <span className="text-sm font-medium text-green-600 bg-green-100 px-2 py-1 rounded">
                      활성 {stats.database.connectionCount}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">평균 쿼리 시간</span>
                    <span className={`text-sm font-medium px-2 py-1 rounded ${
                      stats.database.averageQueryTime < 100
                        ? 'text-green-600 bg-green-100'
                        : stats.database.averageQueryTime < 300
                        ? 'text-yellow-600 bg-yellow-100'
                        : 'text-red-600 bg-red-100'
                    }`}>
                      {stats.database.averageQueryTime}ms
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">API 오류율</span>
                    <span className={`text-sm font-medium px-2 py-1 rounded ${
                      stats.api.errorRate < 1
                        ? 'text-green-600 bg-green-100'
                        : stats.api.errorRate < 5
                        ? 'text-yellow-600 bg-yellow-100'
                        : 'text-red-600 bg-red-100'
                    }`}>
                      {stats.api.errorRate.toFixed(2)}%
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">분당 요청수</span>
                    <span className="text-sm font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded">
                      {stats.api.requestsPerMinute}
                    </span>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">권장사항</h4>
                  <div className="space-y-2 text-xs text-gray-600">
                    {stats.cache.memory.keys < 100 && (
                      <p className="text-yellow-600">• 캐시 사용량이 낮습니다. 더 많은 데이터를 캐싱하는 것을 고려하세요.</p>
                    )}
                    {calculateHitRate(stats.cache.memory.hits, stats.cache.memory.misses) < '80' && (
                      <p className="text-orange-600">• 캐시 히트율이 낮습니다. 캐시 전략을 검토하세요.</p>
                    )}
                    {stats.api.errorRate > 2 && (
                      <p className="text-red-600">• API 오류율이 높습니다. 로그를 확인하세요.</p>
                    )}
                    {stats.database.averageQueryTime > 500 && (
                      <p className="text-red-600">• 데이터베이스 쿼리가 느립니다. 인덱스를 검토하세요.</p>
                    )}
                    {stats.api.errorRate < 1 && calculateHitRate(stats.cache.memory.hits, stats.cache.memory.misses) >= '80' && (
                      <p className="text-green-600">• 모든 지표가 정상 범위입니다.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
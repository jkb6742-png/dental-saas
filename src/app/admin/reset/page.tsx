"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function ResetDataPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [dataStatus, setDataStatus] = useState<any>(null)
  const router = useRouter()

  const checkDataStatus = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/debug/reset-data', {
        method: 'GET'
      })
      const data = await response.json()
      setDataStatus(data)
    } catch (error) {
      console.error('데이터 확인 실패:', error)
      setDataStatus({ error: '데이터 확인 실패' })
    } finally {
      setLoading(false)
    }
  }

  const resetData = async () => {
    if (!confirm('⚠️ 모든 엑셀 데이터가 삭제됩니다. 계속하시겠습니까?')) {
      return
    }

    try {
      setLoading(true)
      setResult(null)

      const response = await fetch('/api/debug/reset-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()
      setResult(data)

      if (data.success) {
        // 데이터 상태도 다시 확인
        setTimeout(() => {
          checkDataStatus()
        }, 1000)
      }

    } catch (error) {
      console.error('데이터 초기화 실패:', error)
      setResult({
        success: false,
        error: '데이터 초기화 실패',
        details: String(error)
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            🗑️ 데이터 초기화 관리
          </h1>

          <div className="space-y-6">
            {/* 현재 상태 확인 */}
            <div className="border rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">현재 데이터 상태</h2>
              <button
                onClick={checkDataStatus}
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? '확인중...' : '데이터 상태 확인'}
              </button>

              {dataStatus && (
                <div className="mt-4 p-4 bg-gray-50 rounded">
                  <pre className="text-sm">{JSON.stringify(dataStatus, null, 2)}</pre>
                </div>
              )}
            </div>

            {/* 데이터 초기화 */}
            <div className="border rounded-lg p-6 border-red-200">
              <h2 className="text-lg font-semibold mb-4 text-red-700">⚠️ 데이터 초기화</h2>
              <p className="text-sm text-gray-600 mb-4">
                다음 모든 엑셀 업로드 관련 데이터가 삭제됩니다:
              </p>
              <ul className="text-sm text-gray-600 mb-4 list-disc list-inside">
                <li>PEI 보고서 (peiReport)</li>
                <li>월별 집계 데이터 (monthlySummary)</li>
                <li>접수 기록 (receptionRecord)</li>
                <li>일별 장부 (dailyLedger)</li>
                <li>환자 통계 (patientStat)</li>
                <li>진료항목 통계 (treatmentStat)</li>
                <li>내원경로 (visitRoute)</li>
                <li>치료계획 (treatmentPlan)</li>
                <li>임플란트 통계 (implantStat)</li>
                <li>상담 통계 (consultationStat)</li>
                <li>연령별 분포 (ageDist)</li>
                <li>지역별 분포 (regionDist)</li>
                <li>파일 업로드 정보 (fileUpload)</li>
                <li>업로드 로그 (uploadLog)</li>
              </ul>
              <p className="text-sm text-green-600 mb-4">
                <strong>보존되는 데이터:</strong> 목표 설정, 사용자 정보, 클리닉 정보, 리뷰 설정
              </p>

              <button
                onClick={resetData}
                disabled={loading}
                className="bg-red-600 text-white px-6 py-2 rounded hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? '삭제중...' : '모든 데이터 삭제'}
              </button>
            </div>

            {/* 결과 표시 */}
            {result && (
              <div className={`border rounded-lg p-6 ${result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                <h3 className="font-semibold mb-2">
                  {result.success ? '✅ 성공' : '❌ 실패'}
                </h3>
                <div className="text-sm">
                  <pre>{JSON.stringify(result, null, 2)}</pre>
                </div>

                {result.success && (
                  <div className="mt-4">
                    <button
                      onClick={() => router.push('/dashboard')}
                      className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                    >
                      대시보드로 이동
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 뒤로가기 */}
            <div className="pt-6 border-t">
              <button
                onClick={() => router.back()}
                className="text-gray-600 hover:text-gray-800"
              >
                ← 뒤로가기
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
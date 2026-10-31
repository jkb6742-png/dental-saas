'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'

interface StructuredData {
  dataType: string
  receptionRecords: Array<{
    receptionTime?: string
    totalRevenue?: number
    patientType?: string
    ageGenderRaw?: string
    [key: string]: unknown
  }>
  summary: {
    totalRecords?: number
    totalRevenue?: number
    dateRange?: {
      start?: string
      end?: string
    }
    [key: string]: unknown
  }
  chartMapping?: Array<{
    originalIndex: number
    patientKey: string
  }>
  [key: string]: unknown
}

interface UploadResult {
  success: boolean
  fileName?: string
  fileSize?: number
  rawDataCount?: number
  structuredData?: StructuredData
  error?: string
  details?: string
  saved?: boolean
  savedData?: {
    patients: number
    revenue: number
    regions: number
    ageData: number
  }
}

export default function ExcelUploadPage() {
  const params = useParams()
  const clinicId = params.clinicId as string

  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [dragActive, setDragActive] = useState(false)

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = e.dataTransfer.files
    if (files && files[0]) {
      setFile(files[0])
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const handleUpload = async () => {
    if (!file) {
      alert('파일을 선택해주세요.')
      return
    }

    setUploading(true)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('clinicId', clinicId)

      const response = await fetch('/api/excel-upload', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()
      setResult(data)

      if (data.success) {
        // 성공 시 데이터 저장 단계로 이동 (다음 단계에서 구현)
        console.log('업로드 성공! 다음 단계: DB 저장')
      }
    } catch (error) {
      setResult({
        success: false,
        error: '업로드 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setUploading(false)
    }
  }

  const handleSaveToDatabase = async () => {
    if (!result?.structuredData) return

    setUploading(true)

    try {
      // 세션 확인 (디버깅용)
      console.log('🔐 세션 확인 중...')
      const sessionResponse = await fetch('/api/auth/session')
      const sessionData = await sessionResponse.json()
      console.log('🔐 현재 세션:', sessionData)

      if (!sessionData || !sessionData.user) {
        alert('❌ 로그인이 필요합니다. 다시 로그인해주세요.')
        window.location.href = '/login'
        return
      }
      // 먼저 디버깅 API로 데이터 확인
      console.log('🔍 디버깅 시작...')
      const debugResponse = await fetch('/api/debug-excel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clinicId,
          structuredData: result.structuredData,
          fileName: result.fileName
        }),
      })

      const debugData = await debugResponse.json()
      console.log('🔍 디버깅 결과:', debugData)

      // 실제 저장 API 호출
      const response = await fetch('/api/excel-upload/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clinicId,
          structuredData: result.structuredData,
          fileName: result.fileName
        }),
      })

      console.log('🔍 HTTP 응답 상태:', response.status, response.statusText)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status} 오류` }))
        console.error(`❌ HTTP 오류 ${response.status}:`, errorData)

        if (response.status === 401) {
          alert('❌ 인증 오류: 다시 로그인해주세요.')
          window.location.href = '/login'
          return
        } else {
          alert(`❌ 서버 오류 (${response.status}): ${errorData.error || '알 수 없는 오류'}`)
          return
        }
      }

      const data = await response.json()
      console.log('✅ 성공 응답:', data)

      if (data.success) {
        alert(`✅ 데이터 저장 완료!\n\n환자: ${data.saved?.patients || 0}명\n수익: ${data.saved?.revenue || 0}건\n지역: ${data.saved?.regions || 0}건\n연령: ${data.saved?.ageData || 0}개 그룹\n\n📊 대시보드에서 확인해보세요!`)

        // 성공 시 결과를 업데이트하여 완료 화면 표시
        setResult({
          ...result,
          saved: true,
          savedData: data.saved
        })
      } else {
        console.error('❌ DB 저장 실패:', data)
        alert(`❌ 저장 실패: ${data.error || '알 수 없는 오류'}\n\n상세: ${data.details || '서버 응답을 확인해주세요'}`)
      }
    } catch (error) {
      console.error('❌ 저장 중 네트워크 오류:', error)
      alert(`❌ 저장 중 오류가 발생했습니다.\n\n오류: ${error instanceof Error ? error.message : '네트워크 연결을 확인해주세요'}`)
    } finally {
      setUploading(false)
    }
  }

  const resetUpload = () => {
    setFile(null)
    setResult(null)
  }

  return (
    <div className="container mx-auto p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">📊 엑셀 데이터 업로드</h1>

        <div className="bg-white rounded-lg shadow-md p-6">
          {!result ? (
            <>
              {/* 파일 업로드 영역 */}
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragActive
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <div className="space-y-4">
                  <div className="text-4xl">📁</div>

                  {file ? (
                    <div className="space-y-2">
                      <p className="text-lg font-semibold text-green-600">
                        ✅ {file.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        크기: {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      <button
                        onClick={resetUpload}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        다른 파일 선택
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-lg text-gray-600">
                        엑셀 파일을 드래그하여 놓거나 클릭하여 선택하세요
                      </p>
                      <p className="text-sm text-gray-500">
                        지원 형식: .xlsx, .xls
                      </p>
                    </div>
                  )}

                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-input"
                  />

                  {!file && (
                    <label
                      htmlFor="file-input"
                      className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors"
                    >
                      파일 선택
                    </label>
                  )}
                </div>
              </div>

              {/* 업로드 버튼 */}
              {file && (
                <div className="mt-6 text-center">
                  <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="px-8 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {uploading ? (
                      <span className="flex items-center justify-center space-x-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>데이터 분석 중...</span>
                      </span>
                    ) : (
                      '🚀 업로드 및 데이터 분석 시작'
                    )}
                  </button>
                </div>
              )}
            </>
          ) : (
            /* 결과 표시 */
            <div className="space-y-6">
              {result.success ? (
                <div className="space-y-4">
                  <div className="flex items-center space-x-2 text-green-600">
                    <span className="text-2xl">✅</span>
                    <h2 className="text-xl font-semibold">업로드 및 분석 완료!</h2>
                  </div>

                  <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-semibold">파일명</p>
                      <p className="text-sm text-gray-600">{result.fileName}</p>
                    </div>
                    <div>
                      <p className="font-semibold">원본 데이터 행 수</p>
                      <p className="text-sm text-gray-600">{result.rawDataCount}개</p>
                    </div>
                    <div>
                      <p className="font-semibold">제외된 열 수</p>
                      <p className="text-sm text-gray-600">{result.excludedColumns || 0}개</p>
                    </div>
                    <div>
                      <p className="font-semibold">처리된 레코드 수</p>
                      <p className="text-sm text-gray-600">{result.structuredData?.receptionRecords?.length || 0}건</p>
                    </div>
                    <div>
                      <p className="font-semibold">차트번호 해시</p>
                      <p className="text-sm text-gray-600">{result.chartMappingCount || 0}개</p>
                    </div>
                  </div>

                  {result.structuredData?.summary && (
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h3 className="font-semibold mb-2">📊 데이터 요약</h3>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>총 레코드: {result.structuredData.summary?.totalRecords || 0}건</div>
                        <div>총 수익: {(result.structuredData.summary?.totalRevenue || 0).toLocaleString()}원</div>
                        <div>고유 환자: {result.structuredData.summary?.uniquePatients || 0}명</div>
                        <div>데이터 유형: {result.structuredData.dataType}</div>
                      </div>
                      {result.structuredData.summary?.dateRange && (
                        <div className="mt-2 text-xs text-blue-700">
                          기간: {result.structuredData.summary.dateRange.start} ~ {result.structuredData.summary.dateRange.end}
                        </div>
                      )}
                    </div>
                  )}

                  {result.saved ? (
                    /* 저장 완료 후 대시보드 링크들 */
                    <div className="space-y-4">
                      <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                        <h3 className="text-green-800 font-semibold mb-2">🎉 데이터 저장 완료!</h3>
                        <p className="text-green-700 text-sm">
                          데이터가 성공적으로 저장되어 모든 대시보드에서 확인할 수 있습니다.
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <a
                          href={`/dashboard/${clinicId}`}
                          className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-center"
                        >
                          🏠 홈 대시보드
                        </a>
                        <a
                          href={`/dashboard/${clinicId}/patients`}
                          className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-center"
                        >
                          👥 환자 통계
                        </a>
                        <a
                          href={`/dashboard/${clinicId}/revenue`}
                          className="px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-center"
                        >
                          💰 매출 분석
                        </a>
                        <a
                          href={`/dashboard/${clinicId}/regions`}
                          className="px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-center"
                        >
                          🗺️ 지역 분석
                        </a>
                      </div>

                      <button
                        onClick={resetUpload}
                        className="w-full px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        새 파일 업로드
                      </button>
                    </div>
                  ) : (
                    /* 저장 전 버튼들 */
                    <div className="flex space-x-4">
                      <button
                        onClick={handleSaveToDatabase}
                        disabled={uploading}
                        className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {uploading ? (
                          <span className="flex items-center justify-center space-x-2">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>데이터베이스 저장 중...</span>
                          </span>
                        ) : (
                          '💾 데이터베이스에 저장'
                        )}
                      </button>
                      <button
                        onClick={resetUpload}
                        className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        새 파일 업로드
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center space-x-2 text-red-600">
                    <span className="text-2xl">❌</span>
                    <h2 className="text-xl font-semibold">업로드 실패</h2>
                  </div>

                  <div className="p-4 bg-red-50 rounded-lg">
                    <p className="text-red-800 font-semibold">{result.error}</p>
                    {result.details && (
                      <p className="text-sm text-red-600 mt-2">{result.details}</p>
                    )}
                  </div>

                  <button
                    onClick={resetUpload}
                    className="w-full px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    다시 시도
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 사용법 안내 */}
        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold mb-2">💡 사용법</h3>
          <ol className="text-sm text-gray-600 space-y-1">
            <li>1. <strong>전체접수수납목록</strong> 엑셀 파일(.xlsx, .xls)을 선택합니다.</li>
            <li>2. 시스템이 자동으로 불필요한 열(C,D,H,J,K,M,N,O,P,Q,R,S,T,V,W,X,Y,Z,AA,AB,AC,AD,AE,AF,AG,AH,AK)을 제외합니다.</li>
            <li>3. 시스템이 필터링된 데이터를 자동으로 분석하여 표준 필드로 매핑합니다.</li>
            <li>4. 분석 결과를 확인한 후 데이터베이스에 저장합니다.</li>
            <li>5. 각 카테고리 대시보드에서 업로드된 데이터를 확인할 수 있습니다.</li>
          </ol>

          <div className="mt-4 space-y-2">
            <div className="p-3 bg-green-50 rounded border border-green-200">
              <h4 className="font-semibold text-green-800 mb-1">✅ 처리되는 필드 (헤더명 기준)</h4>
              <p className="text-xs text-green-700">접수시각, 상태, 연령성별, 보험구분, 신구, 대기, 예약시각, 총진료비, 최초내원, 내원경로, 고객구분, 리콜구분 등</p>
            </div>

            <div className="p-3 bg-red-50 rounded border border-red-200">
              <h4 className="font-semibold text-red-800 mb-1">❌ 제외되는 필드 (개인정보 보호)</h4>
              <p className="text-xs text-red-700">차트번호(해시처리), 이름, 전화번호, 담당의사, 진료내역, 수납 상세 등</p>
            </div>

            <div className="p-3 bg-yellow-50 rounded border border-yellow-200">
              <h4 className="font-semibold text-yellow-800 mb-1">🔒 개인정보 보호</h4>
              <p className="text-xs text-yellow-700">차트번호는 SHA256 해시로 변환 저장, 환자명 등 개인식별정보는 저장하지 않음</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
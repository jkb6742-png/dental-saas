"use client"

import React, { useState, useEffect } from "react"
import { FileSpreadsheet, RefreshCw, CheckCircle, XCircle, Upload, Trash2, ChevronDown, ChevronRight } from "lucide-react"

interface UploadedFile {
  id: string
  fileName: string
  status: string
  category: string
  year: number | string
  month?: number | null
  uploadedAt?: string
  fileSize?: number
  recordCount?: number | null
}

interface RequiredFileItem {
  id: number
  name: string
  category: string
  uploadedMonths: number[]
  completedMonths: number
  isFullyUploaded: boolean
  uploadedFiles: UploadedFile[]
}

export default function SafeUploadsClient({ clinicId }: { clinicId: string }) {
  // 실제 업로드된 파일 목록 (하드코딩 제거)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState(2026)
  const [uploading, setUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [expandedRows, setExpandedRows] = useState<number[]>([])
  const [clinicWarning, setClinicWarning] = useState<string | null>(null)

  // 파일 카테고리 목록
  const requiredFileCategories = [
    { name: "월간장부", category: "MONTHLY_LEDGER" },
    { name: "연간장부", category: "ANNUAL_LEDGER" },
    { name: "진료항목별통계", category: "TREATMENT_STATS" },
    { name: "임플란트수술통계", category: "IMPLANT_STATS" },
    { name: "전체접수수납목록", category: "COMPREHENSIVE_PATIENTS" },
    { name: "연령별분포", category: "AGE_DISTRIBUTION" },
    { name: "지역별분포", category: "REGION_DISTRIBUTION" },
    { name: "일별접수환자수", category: "DAILY_PATIENTS" },
    { name: "내원경로분포", category: "VISIT_ROUTES" }
  ]

  // 클리닉 매칭 상태 확인
  const checkClinicAccess = async () => {
    try {
      const response = await fetch(`/api/debug-clinic?clinicId=${clinicId}`)
      const result = await response.json()

      if (result.success && result.clinic && !result.clinic.matches) {
        setClinicWarning(`다른 agency 소속 클리닉입니다. (${result.clinic.agencyName})`)
      } else {
        setClinicWarning(null)
      }
    } catch (error) {
      console.log('클리닉 매칭 확인 실패:', error)
    }
  }

  const loadData = async () => {
    setLoading(true)
    let response: Response | null = null

    try {
      console.log(`📊 업로드된 파일 목록 요청 중... (clinicId: ${clinicId})`)

      if (!clinicId) {
        throw new Error('clinicId가 없습니다')
      }

      response = await fetch(`/api/uploads?clinicId=${clinicId}`)

      if (!response) {
        throw new Error('응답을 받을 수 없습니다')
      }

      const responseStatus = response.status
      console.log(`📬 파일 목록 응답 상태: ${responseStatus}`)

      if (response.ok) {
        try {
          const data = await response.json()
          console.log(`📋 로드된 파일 데이터:`, data)
          console.log(`📄 파일 수: ${data?.files?.length || 0}개`)

          setUploadedFiles(data?.files || [])

          if (data?.files && data.files.length > 0) {
            console.log(`📁 파일 목록:`, data.files.map((f: any) => `${f?.fileName || 'unknown'} (${f?.category || 'unknown'}, ${f?.status || 'unknown'})`))
          }
        } catch (jsonError) {
          console.log('❌ JSON 파싱 실패:', jsonError)
          setUploadedFiles([])
        }
      } else {
        console.log('❌ 파일 목록 로드 실패')
        console.log('응답 상태:', responseStatus)

        // 응답 본문 확인 (에러 메시지)
        try {
          const errorData = await response.json()
          console.log('❌ 서버 오류 내용:', errorData)

          // 클리닉 매칭 오류 감지
          if (errorData.debug && errorData.debug.includes('다른 agency 소속')) {
            setClinicWarning('클리닉 접근 권한이 없습니다')
          }
        } catch {
          console.log('❌ 응답 본문을 읽을 수 없음')
        }

        setUploadedFiles([])
        console.log('⚠️ 파일 목록 API 오류 - 빈 상태로 시작합니다.')
      }
    } catch (error) {
      console.log('❌ 네트워크 또는 요청 실패:', error)
      setUploadedFiles([])
      console.log('⚠️ 파일 목록 로딩 실패 - 빈 상태로 시작합니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    checkClinicAccess()
  }, [clinicId])

  // 🧪 테스트 업로드 (문제 진단용)
  const testUpload = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return

    setUploading(true)
    const file = files[0] // 첫 번째 파일만 테스트

    try {
      console.log(`🧪 테스트 업로드 시작: ${file.name}`)

      const formData = new FormData()
      formData.append('file', file)
      formData.append('clinicId', clinicId)

      console.log(`🔥🔥🔥 testUpload에서 진짜 /api/uploads 호출! 🔥🔥🔥`)
      const response = await fetch('/api/uploads', {
        method: 'POST',
        body: formData
      })

      console.log(`🔥 진짜 업로드 응답 상태: ${response.status}`)
      const result = await response.json()
      console.log(`🔥 진짜 업로드 응답:`, result)

      if (response.ok && result.success) {
        // 업로드된 파일을 목록에 즉시 추가
        const newFile = {
          id: result.data?.fileId || `test-upload-${Date.now()}`,
          fileName: file.name,
          status: result.data?.status || 'PENDING',
          category: result.data?.category || 'UNKNOWN',
          year: result.data?.year || new Date().getFullYear(),
          month: result.data?.month,
          uploadedAt: new Date().toISOString().split('T')[0],
          fileSize: result.data?.fileSize || file.size,
          recordCount: result.data?.recordCount || null
        }
        setUploadedFiles(prev => [newFile, ...prev])

        alert(`🔥 테스트 업로드 성공!\n${result.message}\n파일이 업로드되었습니다. 처리 버튼을 클릭하여 데이터를 처리하세요.`)

        // 새로고침도 시도
        await loadData()
      } else {
        alert(`❌ 테스트 업로드 실패!\n오류: ${result.error}\n상태: ${response.status}`)
      }
    } catch (error) {
      console.log(`🧪 테스트 오류:`, error)
      alert(`💥 테스트 오류: ${error}`)
    } finally {
      setUploading(false)
    }
  }

  // 🔥 완전히 새로 작성된 업로드 함수
  const processFiles = async (files: FileList | File[]) => {
    console.log(`💥💥💥 NEW processFiles 함수 실행됨!!! 💥💥💥`)

    if (!files || files.length === 0) {
      console.log(`❌ 파일이 없음`)
      return
    }

    setUploading(true)
    const fileArray = Array.from(files)
    console.log(`📁 처리할 파일 수: ${fileArray.length}`)

    try {
      for (const file of fileArray) {
        console.log(`🔥 파일 처리 시작: ${file.name}`)

        if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
          console.log(`⚠️ Excel 파일이 아님: ${file.name}`)
          continue
        }

        console.log(`🚀 ${file.name} 실제 업로드 시작!!!`)
        console.log(`🌟 이제 진짜 API 호출할 거임!!!`)

        // 🔥 NEW API 호출 로직
        const formData = new FormData()
        formData.append('file', file)
        formData.append('clinicId', clinicId)

        console.log(`💥 FormData 준비됨:`, {
          파일명: file.name,
          파일크기: file.size,
          클리닉ID: clinicId
        })

        console.log(`🚀🚀🚀 지금 진짜로 /api/uploads 호출한다!!! 🚀🚀🚀`)
        const response = await fetch('/api/uploads', {
          method: 'POST',
          body: formData
        })

        console.log(`💥💥💥 API 응답 받았다! 상태: ${response.status} 💥💥💥`)

        const result = await response.json()
        console.log(`🔥 응답 내용:`, result)

        if (response.ok && result.success) {
          console.log(`🎉🎉🎉 ${file.name} 업로드 진짜 성공했다!!! 🎉🎉🎉`)
          console.log(`📊 업로드 완료 - 파일 ID: ${result.data?.fileId}`)
          console.log(`🎯 파일 카테고리: ${result.data?.category}`)

          // 업로드된 파일을 목록에 추가 (uploads API 응답 형식에 맞게 수정)
          const newFile: UploadedFile = {
            id: result.data?.fileId || `upload-${Date.now()}`,
            fileName: file.name,
            status: result.data?.status || 'PENDING',
            category: result.data?.category || 'UNKNOWN',
            year: result.data?.year || new Date().getFullYear(),
            month: result.data?.month,
            uploadedAt: new Date().toISOString().split('T')[0],
            fileSize: result.data?.fileSize || file.size,
            recordCount: result.data?.recordCount || null
          }

          setUploadedFiles(prev => [newFile, ...prev])

          // 🔥 추가 새로고침 시도 (이미 목록에는 추가됨)
          try {
            console.log(`🔄 추가 새로고침 시도...`)
            await loadData()
          } catch (refreshError) {
            console.log(`⚠️ 새로고침 실패했지만 이미 목록에 표시됨:`, refreshError)
          }

          // 사용자에게 성공 알림
          alert(`✅ "${file.name}" 업로드 성공!\n${result.message}\n\n파일이 업로드되었습니다. "처리" 버튼을 클릭하여 데이터를 처리하세요.`)
        } else {
          console.log(`❌ ${file.name} 업로드 실패`)
          console.log('응답 상태:', response.status)
          console.log('응답 내용:', result)

          let errorMessage = `HTTP ${response.status}: ${response.statusText}`

          if (result?.error) {
            errorMessage = result.error
          } else if (result?.message) {
            errorMessage = result.message
          } else if (Object.keys(result || {}).length === 0) {
            errorMessage = '서버에서 빈 응답을 받았습니다'
          }

          alert(`❌ "${file.name}" 업로드 실패:\n${errorMessage}\n\n🧪 "테스트 업로드" 버튼으로 상세 진단 가능`)
        }
      }

      // 최종 새로고침 (이미 목록 업데이트됨)
      console.log(`🔄 최종 데이터 새로고침...`)
      try {
        await loadData()
        console.log(`✅ 최종 새로고침 완료!`)
      } catch (finalError) {
        console.log(`⚠️ 최종 새로고침 실패했지만 이미 목록 업데이트됨:`, finalError)
        alert(`📋 업로드된 파일이 목록에 추가되었습니다!\n(API 새로고침은 실패했지만 파일은 목록에 표시됨)`)
      }
    } catch (error) {
      console.log('💥 업로드 네트워크 오류:', error)
      alert(`💥 네트워크 오류 발생:\n${error}\n\n인터넷 연결을 확인하거나 페이지를 새로고침 후 다시 시도해주세요.`)
    } finally {
      setUploading(false)
    }
  }

  // 드래그앤드롭 이벤트
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    await processFiles(e.dataTransfer.files)
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files) {
      await processFiles(files)
      event.target.value = ''
    }
  }

  const toggleRow = (rowId: number) => {
    setExpandedRows(prev =>
      prev.includes(rowId)
        ? prev.filter(id => id !== rowId)
        : [...prev, rowId]
    )
  }

  // 파일 목록 생성
  const getRequiredFilesList = (): RequiredFileItem[] => {
    console.log(`🔍 파일 목록 생성 중... (${selectedYear}년, 전체 파일 ${uploadedFiles.length}개)`)

    return requiredFileCategories.map((required, index) => {
      const categoryFiles = uploadedFiles.filter(file =>
        file.category === required.category &&
        Number(file.year) === Number(selectedYear)
        // 모든 상태의 파일 표시 (PENDING, COMPLETED, FAILED 등)
      )

      console.log(`📁 ${required.name} (${required.category}): ${categoryFiles.length}개 파일`)

      const uploadedMonths = categoryFiles
        .map(file => file.month)
        .filter((month): month is number => month !== null && month !== undefined)
        .sort((a, b) => a - b)

      const uniqueMonths = [...new Set(uploadedMonths)]

      if (uniqueMonths.length > 0) {
        console.log(`📅 ${required.name} 완료된 월: ${uniqueMonths.join('월, ')}월`)
      }

      return {
        id: index + 1,
        name: required.name,
        category: required.category,
        uploadedMonths: uniqueMonths,
        completedMonths: uniqueMonths.length,
        isFullyUploaded: uniqueMonths.length === 12,
        uploadedFiles: categoryFiles
      }
    })
  }

  const filesList = getRequiredFilesList()

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <FileSpreadsheet className="w-6 h-6 text-blue-600" />
          <div>
            <h3 className="text-lg font-semibold">파일 업로드 관리</h3>
            <p className="text-sm text-gray-600">월별 진행적 업로드 (새로운 데이터만 추가)</p>
            <p className="text-xs text-orange-600 font-medium">현재 클리닉 ID: {clinicId}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              console.log('🔥 강제 새로고침 시작')
              try {
                await loadData()
                alert('✅ 새로고침 완료!')
              } catch (error) {
                console.log('❌ 새로고침 실패:', error)
                alert(`❌ 새로고침 실패: ${error}`)
              }
            }}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-bold disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            🔥 강제 새로고침
          </button>

          <button
            onClick={() => {
              console.log(`📋 현재 업로드된 파일 수: ${uploadedFiles.length}`)

              const summary = uploadedFiles.reduce((acc, file) => {
                acc[file.status] = (acc[file.status] || 0) + 1
                return acc
              }, {} as Record<string, number>)

              alert(`📊 현재 파일 현황:\n\n총 ${uploadedFiles.length}개\n${Object.entries(summary).map(([status, count]) => `${status}: ${count}개`).join('\n')}\n\n🔄 목록이 보이지 않으면 새로고침 버튼을 클릭하세요!`)
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-medium"
          >
            📊 현황 확인
          </button>

          <button
            onClick={async () => {
              try {
                console.log(`🔍 데이터베이스 데이터 확인 시작`)
                const response = await fetch(`/api/check-db-data?clinicId=${clinicId}`)
                const result = await response.json()
                console.log(`🔍 DB 확인 결과:`, result)

                if (result.success) {
                  const details = Object.entries(result.tableDetails)
                    .map(([table, count]) => `${table}: ${count}`)
                    .join('\n')

                  alert(`🔍 데이터베이스 확인 결과:\n\n총 레코드: ${result.totalRecords}개\n\n테이블별 상세:\n${details}\n\n최근 파일: ${result.recentFiles.length}개`)
                } else {
                  alert(`❌ DB 확인 실패: ${result.error}`)
                }
              } catch (error) {
                console.log(`🔍 DB 확인 오류:`, error)
                alert(`💥 DB 확인 오류: ${error}`)
              }
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-xs font-bold"
          >
            🔍 DB 확인
          </button>

          <button
            onClick={async () => {
              try {
                console.log('🏥 올바른 클리닉으로 이동')
                const response = await fetch('/api/get-my-clinics')
                const result = await response.json()
                console.log('🏥 내 클리닉 목록:', result)

                if (result.success && result.clinics.length > 0) {
                  const clinic = result.clinics[0] // 첫 번째 클리닉으로 이동
                  const newUrl = `/dashboard/${clinic.id}/uploads`

                  if (confirm(`✅ 올바른 클리닉으로 이동하시겠습니까?\n\n${clinic.name}\n주소: ${clinic.address || '미설정'}\n\n확인을 누르면 ${newUrl}로 이동합니다.`)) {
                    window.location.href = newUrl
                  }
                } else if (result.success) {
                  alert(`❌ 접근 가능한 클리닉이 없습니다.\n관리자에게 클리닉 등록을 요청하세요.`)
                } else {
                  alert(`❌ 클리닉 조회 실패: ${result.error}`)
                }
              } catch (error) {
                console.log('🏥 클리닉 이동 오류:', error)
                alert(`💥 오류: ${error}`)
              }
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-medium"
          >
            🔄 올바른 클리닉으로 이동
          </button>
        </div>
      </div>

      {/* 연도 선택 */}
      <div className="flex items-center space-x-4">
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value={2025}>2025년</option>
          <option value={2026}>2026년</option>
          <option value={2027}>2027년</option>
        </select>

        <div className="text-sm text-gray-600">
          💡 월별 전체 파일 업로드 시 중복 데이터는 자동으로 필터링됩니다
        </div>

        {/* 동적 클리닉 매칭 경고 (문제가 있을 때만 표시) */}
        {clinicWarning && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3 mb-3">
              <div className="text-red-600 text-lg">⚠️</div>
              <div>
                <div className="font-bold text-red-800 text-lg mb-1">클리닉 접근 오류!</div>
                <div className="text-red-700 mb-3 text-base">
                  {clinicWarning}
                </div>
              </div>
            </div>

            <button
              onClick={async () => {
                try {
                  const response = await fetch('/api/get-my-clinics')
                  const result = await response.json()
                  if (result.success && result.clinics.length > 0) {
                    const clinic = result.clinics[0]
                    window.location.href = `/dashboard/${clinic.id}/uploads`
                  }
                } catch (error) {
                  alert(`오류: ${error}`)
                }
              }}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg text-lg transition-colors"
            >
              🚀 지금 즉시 올바른 클리닉으로 이동하기!
            </button>
          </div>
        )}

        {/* 🧪 테스트 업로드 버튼 (500 에러 디버깅용) */}
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => e.target.files && testUpload(e.target.files)}
            disabled={uploading}
            className="hidden"
            id="test-upload-input"
          />
          <label
            htmlFor="test-upload-input"
            className={`inline-flex items-center gap-1 px-3 py-1 text-xs bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors cursor-pointer ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            🧪 테스트 업로드 (디버깅용)
          </label>
        </div>
      </div>

      {/* 파일 업로드 영역 */}
      <div
        className={`bg-white rounded-lg border-2 border-dashed p-8 text-center transition-all ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : uploading
              ? 'border-gray-300 bg-gray-50'
              : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {uploading ? (
          <div className="space-y-3">
            <div className="w-12 h-12 mx-auto border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            <div className="text-blue-600 font-medium">업로드 중...</div>
            <div className="text-sm text-gray-600">중복 데이터 필터링 중</div>
          </div>
        ) : isDragging ? (
          <div className="space-y-3">
            <Upload className="w-12 h-12 mx-auto text-blue-600" />
            <div className="text-blue-600 font-medium text-lg">파일을 여기에 놓으세요</div>
            <div className="text-sm text-blue-500">Excel 파일(.xlsx, .xls)만 지원됩니다</div>
          </div>
        ) : (
          <div className="space-y-4">
            <Upload className="w-12 h-12 mx-auto text-gray-400" />
            <div>
              <div className="text-gray-700 font-medium text-lg mb-2">
                월별 전체 파일을 드래그하여 업로드
              </div>
              <div className="text-sm text-gray-500 mb-4">
                기존 데이터와 중복된 부분은 자동으로 제외하고 새로운 데이터만 추가됩니다
              </div>

              <input
                type="file"
                multiple
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
                id="file-upload-input"
              />
              <label
                htmlFor="file-upload-input"
                className={`inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Upload className="w-4 h-4" />
                파일 선택
              </label>
            </div>
          </div>
        )}
      </div>

      {/* 업로드 현황 테이블 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h4 className="font-medium text-gray-900">
            {selectedYear}년 월별 업로드 현황
          </h4>
          <p className="text-sm text-gray-600 mt-1">
            각 카테고리별로 진행된 월별 업로드 상황을 확인할 수 있습니다
          </p>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
            <div className="mt-2 text-sm text-gray-600">로딩 중...</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">카테고리</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">진행상황</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filesList.map((item) => {
                  const isExpanded = expandedRows.includes(item.id)

                  // 상태별 색상과 텍스트 결정
                  let statusColor = "gray"
                  let statusText = "대기중"
                  let statusIcon = <XCircle className="w-3 h-3" />

                  // PENDING 상태 파일이 있으면 "처리중"으로 표시
                  const pendingFiles = item.uploadedFiles.filter(f => f.status === 'PENDING')
                  const completedFiles = item.uploadedFiles.filter(f => f.status === 'COMPLETED')

                  if (pendingFiles.length > 0) {
                    statusColor = "orange"
                    statusText = `처리중 (${pendingFiles.length}개 파일)`
                    statusIcon = <RefreshCw className="w-3 h-3 animate-spin" />
                  } else if (completedFiles.length > 0) {
                    if (item.isFullyUploaded) {
                      statusColor = "green"
                      statusText = "완료"
                      statusIcon = <CheckCircle className="w-3 h-3" />
                    } else {
                      statusColor = "blue"
                      statusText = `진행중 (${completedFiles.length}개월)`
                      statusIcon = <Upload className="w-3 h-3" />
                    }
                  }

                  return (
                    <React.Fragment key={item.id}>
                      <tr
                        className={`hover:bg-gray-50 cursor-pointer ${
                          statusColor === 'green' ? 'bg-green-50' :
                          statusColor === 'orange' ? 'bg-orange-50' :
                          statusColor === 'blue' ? 'bg-blue-50' : ''
                        }`}
                        onClick={() => toggleRow(item.id)}
                      >
                        <td className="px-4 py-3 text-sm text-gray-900">
                          <div className="flex items-center gap-2">
                            {isExpanded ?
                              <ChevronDown className="w-4 h-4 text-gray-400" /> :
                              <ChevronRight className="w-4 h-4 text-gray-400" />
                            }
                            <div className="font-medium">{item.name}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded ${
                            statusColor === "green" ? "bg-green-100 text-green-700" :
                            statusColor === "orange" ? "bg-orange-100 text-orange-700" :
                            statusColor === "blue" ? "bg-blue-100 text-blue-700" :
                            "bg-gray-100 text-gray-600"
                          }`}>
                            {statusIcon}
                            {statusText}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <input
                              type="file"
                              multiple
                              accept=".xlsx,.xls"
                              onChange={(e) => handleFileUpload(e)}
                              disabled={uploading}
                              className="hidden"
                              id={`file-upload-${item.category}`}
                            />
                            <label
                              htmlFor={`file-upload-${item.category}`}
                              className={`inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors cursor-pointer ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              <Upload className="w-3 h-3" />
                              파일선택
                            </label>
                            {/* PENDING 상태 파일들에 대한 처리 버튼 표시 */}
                            {pendingFiles.length > 0 && (
                              <button
                                onClick={async () => {
                                  for (const pendingFile of pendingFiles) {
                                    try {
                                      console.log(`🔄 파일 처리 시작: ${pendingFile.fileName}`)
                                      const processResponse = await fetch(`/api/uploads/${pendingFile.id}/process`, {
                                        method: 'POST'
                                      })
                                      const processResult = await processResponse.json()

                                      if (processResponse.ok) {
                                        console.log(`✅ 파일 처리 완료: ${pendingFile.fileName}`)
                                        alert(`✅ "${pendingFile.fileName}" 처리 완료!\n처리된 레코드: ${processResult.processedCount}개`)
                                      } else {
                                        console.error(`❌ 파일 처리 실패: ${pendingFile.fileName}`, processResult.error)
                                        alert(`❌ "${pendingFile.fileName}" 처리 실패!\n오류: ${processResult.error}`)
                                      }
                                    } catch (error) {
                                      console.error(`💥 파일 처리 중 오류: ${pendingFile.fileName}`, error)
                                      alert(`💥 "${pendingFile.fileName}" 처리 중 오류 발생: ${error}`)
                                    }
                                  }
                                  // 처리 완료 후 새로고침
                                  await loadData()
                                }}
                                disabled={uploading}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors disabled:opacity-50"
                              >
                                <RefreshCw className="w-3 h-3" />
                                처리 ({pendingFiles.length})
                              </button>
                            )}
                            {/* 파일 삭제 버튼 (업로드된 파일이 있을 때만 표시) */}
                            {item.uploadedFiles.length > 0 && (
                              <button
                                onClick={async () => {
                                  if (confirm(`이 카테고리의 파일 ${item.uploadedFiles.length}개를 모두 삭제하시겠습니까?`)) {
                                    for (const fileToDelete of item.uploadedFiles) {
                                      try {
                                        const deleteResponse = await fetch(`/api/uploads/${fileToDelete.id}`, {
                                          method: 'DELETE'
                                        })
                                        if (deleteResponse.ok) {
                                          console.log(`✅ 파일 삭제 완료: ${fileToDelete.fileName}`)
                                        } else {
                                          console.error(`❌ 파일 삭제 실패: ${fileToDelete.fileName}`)
                                        }
                                      } catch (error) {
                                        console.error(`💥 파일 삭제 중 오류: ${fileToDelete.fileName}`, error)
                                      }
                                    }
                                    alert(`파일 삭제가 완료되었습니다.`)
                                    await loadData()
                                  }
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                              >
                                <Trash2 className="w-3 h-3" />
                                삭제 ({item.uploadedFiles.length})
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* 상세 정보 */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={3} className="px-0 py-0 bg-gray-50">
                            <div className="px-8 py-4">
                              <div className="text-sm text-gray-600 mb-2">
                                업로드된 월: {item.uploadedMonths.length > 0 ? item.uploadedMonths.map(m => `${m}월`).join(', ') : '없음'}
                              </div>

                              {/* 개별 파일 목록 */}
                              {item.uploadedFiles.length > 0 && (
                                <div className="mt-3">
                                  <div className="text-xs font-medium text-gray-700 mb-2">업로드된 파일:</div>
                                  <div className="space-y-2">
                                    {item.uploadedFiles.map((file) => (
                                      <div key={file.id} className="flex items-center justify-between bg-white rounded border p-3">
                                        <div className="flex-1">
                                          <div className="text-sm font-medium text-gray-900">{file.fileName}</div>
                                          <div className="text-xs text-gray-500">
                                            {file.year}년 {file.month ? `${file.month}월` : '연간'} •
                                            {Math.round((file.fileSize || 0) / 1024)}KB •
                                            {file.recordCount ? ` ${file.recordCount}개 레코드` : ' 미처리'}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2 ml-4">
                                          <span className={`text-xs px-2 py-1 rounded ${
                                            file.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                                            file.status === 'PENDING' ? 'bg-orange-100 text-orange-700' :
                                            file.status === 'PROCESSING' ? 'bg-blue-100 text-blue-700' :
                                            'bg-red-100 text-red-700'
                                          }`}>
                                            {file.status === 'COMPLETED' ? '처리완료' :
                                             file.status === 'PENDING' ? '대기중' :
                                             file.status === 'PROCESSING' ? '처리중' :
                                             '실패'}
                                          </span>
                                          {file.status === 'PENDING' && (
                                            <button
                                              onClick={async () => {
                                                try {
                                                  const processResponse = await fetch(`/api/uploads/${file.id}/process`, {
                                                    method: 'POST'
                                                  })
                                                  const processResult = await processResponse.json()

                                                  if (processResponse.ok) {
                                                    alert(`✅ 처리 완료!\n처리된 레코드: ${processResult.processedCount}개`)
                                                    await loadData()
                                                  } else {
                                                    alert(`❌ 처리 실패: ${processResult.error}`)
                                                  }
                                                } catch (error) {
                                                  alert(`💥 처리 중 오류: ${error}`)
                                                }
                                              }}
                                              className="text-xs px-2 py-1 bg-orange-600 text-white rounded hover:bg-orange-700"
                                            >
                                              처리
                                            </button>
                                          )}
                                          <button
                                            onClick={async () => {
                                              if (confirm(`"${file.fileName}" 파일을 삭제하시겠습니까?`)) {
                                                try {
                                                  const deleteResponse = await fetch(`/api/uploads/${file.id}`, {
                                                    method: 'DELETE'
                                                  })
                                                  if (deleteResponse.ok) {
                                                    alert('파일이 삭제되었습니다.')
                                                    await loadData()
                                                  } else {
                                                    alert('파일 삭제에 실패했습니다.')
                                                  }
                                                } catch (error) {
                                                  alert(`삭제 중 오류: ${error}`)
                                                }
                                              }
                                            }}
                                            className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                                          >
                                            삭제
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              <div className="text-xs text-gray-500 mt-2">
                                💡 매월 전체 파일을 업로드하면 새로운 데이터만 자동으로 추가됩니다
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
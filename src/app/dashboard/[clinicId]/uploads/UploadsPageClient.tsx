"use client"

import React, { useState, useEffect } from "react"
import { FileSpreadsheet, RefreshCw, CheckCircle, XCircle, Upload, Trash2, ChevronDown, ChevronRight } from "lucide-react"

interface UploadedFile {
  id: string
  fileName: string
  status: string
  category: string
  year: number | string // DB에서 문자열로 올 수 있음
  month?: number | null // null 허용
}

interface RequiredFileItem {
  id: number
  name: string
  category: string
  uploadedMonths: number[] // 업로드된 월들
  completedMonths: number // 완료된 월 수 (최대 12)
  isFullyUploaded: boolean // 12개월 모두 업로드 완료
  uploadedFiles: UploadedFile[] // 업로드된 파일들
}

export default function UploadsPageClient({ clinicId }: { clinicId: string }) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState(2026)
  // 월별 선택 제거 - 연간 기준으로 변경
  const [uploading, setUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [expandedRows, setExpandedRows] = useState<number[]>([]) // Set 대신 배열 사용
  const [refreshKey, setRefreshKey] = useState(0) // 🔥 강제 리렌더링용
  const [mounted, setMounted] = useState(false) // Hydration 안전성을 위한 상태


  // 파일 카테고리 목록 (신환 관련 제거, 통합 구조로 변경)
  const requiredFileCategories = [
    { name: "월간장부", category: "MONTHLY_LEDGER" },
    { name: "연간장부", category: "ANNUAL_LEDGER" },
    { name: "진료항목별통계", category: "TREATMENT_STATS" },
    { name: "임플란트수술통계", category: "IMPLANT_STATS" },
    { name: "전체접수수납목록", category: "COMPREHENSIVE_PATIENTS" }, // 통합된 신환+구환 데이터
    { name: "연령별분포", category: "AGE_DISTRIBUTION" },
    { name: "지역별분포", category: "REGION_DISTRIBUTION" },
    { name: "일별접수환자수", category: "DAILY_PATIENTS" },
    { name: "내원경로분포", category: "VISIT_ROUTES" }
  ]

  const loadData = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/uploads?clinicId=${clinicId}`)
      if (response.ok) {
        const data = await response.json()
        // 🔥 긴급: 전체 파일 상세 확인
        console.log(`🔥 === 로드된 전체 파일 목록 ===`)
        data.files?.forEach((file: any, index: number) => {
          console.log(`📄 ${index + 1}. ${file.fileName} → category: ${file.category}, month: ${file.month}`)
        })
        console.log(`🔥 === 총 ${data.files?.length || 0}개 파일 ===`)
        setUploadedFiles(data.files || [])
      }
    } catch (error) {
      console.error('데이터 로드 실패:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted) {
      loadData()
    }
  }, [clinicId, mounted])

  // 파일 업로드 처리 함수 (개선된 버전)
  const processFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) {
      console.warn('⚠️ processFiles: 파일이 없습니다')
      return
    }

    const fileArray = Array.from(files)
    console.log(`🎯 processFiles 호출: ${fileArray.length}개 파일`)
    console.log(`📄 파일 목록:`, fileArray.map(f => `${f.name} (${(f.size / 1024).toFixed(1)}KB)`))

    setUploading(true)

    let successCount = 0
    let errorCount = 0
    const errors: string[] = []
    const validFiles: File[] = []

    // 1단계: 파일 사전 검증
    for (const file of fileArray) {
      console.log(`🔍 검증 중: ${file.name}`)

      // Excel 파일 체크
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        console.warn(`❌ Excel 파일 아님: ${file.name}`)
        errorCount++
        errors.push(`${file.name}: Excel 파일이 아님 (.xlsx 또는 .xls 파일만 지원)`)
        continue
      }

      // 파일 크기 체크 (100MB 제한)
      if (file.size > 100 * 1024 * 1024) {
        console.warn(`❌ 파일 크기 초과: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`)
        errorCount++
        errors.push(`${file.name}: 파일 크기가 너무 큼 (100MB 이하만 지원)`)
        continue
      }

      // 중복 업로드 체크
      const isDuplicate = uploadedFiles.some(uploadedFile =>
        uploadedFile.fileName === file.name &&
        uploadedFile.status === "COMPLETED"
      )

      if (isDuplicate) {
        console.warn(`❌ 중복 파일: ${file.name}`)
        errorCount++
        errors.push(`${file.name}: 이미 업로드됨`)
        continue
      }

      console.log(`✅ 검증 통과: ${file.name}`)
      validFiles.push(file)
    }

    console.log(`📊 검증 결과: 유효한 파일 ${validFiles.length}개, 오류 ${errorCount}개`)

    if (validFiles.length === 0) {
      setUploading(false)
      const message = `업로드할 수 있는 파일이 없습니다.${errorCount > 0 ? `\n\n오류:\n${errors.join('\n')}` : ''}`
      alert(message)
      return
    }

    // 2단계: 업로드 실행
    console.log(`🚀 ${validFiles.length}개 파일 업로드 시작...`)

    const uploadPromises = validFiles.map(async (file, index) => {
      console.log(`📤 [${index + 1}/${validFiles.length}] ${file.name} 업로드 시작`)

      const formData = new FormData()
      formData.append('file', file)
      formData.append('clinicId', clinicId)

      try {
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        })

        const result = await response.json()

        console.log(`📝 [${index + 1}/${validFiles.length}] ${file.name} 응답: ${response.status}`)

        if (response.ok && result.success) {
          console.log(`✅ [${index + 1}/${validFiles.length}] ${file.name} 성공`)
          return { file: file.name, success: true }
        } else {
          console.error(`❌ [${index + 1}/${validFiles.length}] ${file.name} 실패:`, result.error)
          return { file: file.name, success: false, error: result.error || '업로드 실패' }
        }
      } catch (error) {
        console.error(`💥 [${index + 1}/${validFiles.length}] ${file.name} 네트워크 오류:`, error)
        return { file: file.name, success: false, error: `네트워크 오류: ${error}` }
      }
    })

    // 모든 업로드 동시 실행
    const results = await Promise.all(uploadPromises)

    // 3단계: 결과 집계
    results.forEach(result => {
      if (result.success) {
        successCount++
      } else {
        errorCount++
        errors.push(`${result.file}: ${result.error}`)
      }
    })

    console.log(`📈 최종 결과: 성공 ${successCount}개, 실패 ${errorCount}개`)

    // 4단계: 데이터 새로고침
    console.log('🔄 데이터 새로고침 중...')
    await loadData()

    // UI 강제 새로고침
    const currentExpanded = [...expandedRows]
    setExpandedRows([])
    setTimeout(() => {
      setExpandedRows(currentExpanded)
      setRefreshKey(prev => prev + 1)
    }, 100)

    setUploading(false)

    // 5단계: 사용자 알림
    let message = ''
    if (successCount > 0) {
      message += `✅ ${successCount}개 파일 업로드 성공!`
    }
    if (errorCount > 0) {
      if (successCount > 0) message += '\n\n'
      message += `❌ ${errorCount}개 파일 실패:`
      message += `\n${errors.slice(0, 3).join('\n')}`
      if (errors.length > 3) {
        message += `\n... 외 ${errors.length - 3}개 (자세한 내용은 콘솔 참조)`
      }
    }

    if (message) {
      console.log('💬 사용자 알림:', message)
      alert(message)
    }
  }

  // 파일 선택 업로드 (개선된 버전)
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    console.log('🖱️ 파일 선택 이벤트 발생')
    console.log(`📁 선택된 파일 수: ${files?.length || 0}`)

    if (files && files.length > 0) {
      console.log('📄 선택된 파일들:', Array.from(files).map(f => f.name))

      try {
        await processFiles(files)
      } finally {
        // 항상 input 초기화 (같은 파일을 다시 선택할 수 있도록)
        event.target.value = ''
        console.log('🧹 파일 선택 input 초기화 완료')
      }
    } else {
      console.warn('⚠️ 파일 선택되지 않음')
      event.target.value = ''
    }
  }

  // 카테고리별 파일 선택 함수
  const handleCategoryFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, category: string) => {
    const files = event.target.files
    console.log(`🎯 카테고리별 파일 선택: ${category}`)
    console.log(`📁 선택된 파일 수: ${files?.length || 0}`)

    if (files && files.length > 0) {
      console.log('📄 선택된 파일들:', Array.from(files).map(f => f.name))

      try {
        await processFiles(files)
      } finally {
        // 항상 input 초기화
        event.target.value = ''
        console.log(`🧹 ${category} 파일 선택 input 초기화 완료`)
      }
    } else {
      console.warn(`⚠️ ${category} 파일 선택되지 않음`)
      event.target.value = ''
    }
  }

  // 드래그앤드롭 이벤트 (개선된 버전)
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // 드롭 영역을 완전히 벗어났을 때만 상태 변경
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX
    const y = e.clientY

    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragging(false)
    }
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    console.log('🎯 드롭 이벤트 감지!')

    const files = e.dataTransfer.files
    console.log(`📁 드롭된 파일 수: ${files.length}`)

    if (files && files.length > 0) {
      console.log('📄 드롭된 파일들:', Array.from(files).map(f => f.name))
      await processFiles(files)
    } else {
      console.warn('⚠️ 드롭된 파일이 없습니다')
      alert('파일을 제대로 드롭하지 못했습니다. 다시 시도해주세요.')
    }
  }

  // 행 펼침/접기 토글
  const toggleRow = (rowId: number) => {
    setExpandedRows(prev => {
      const isExpanded = prev.includes(rowId)
      if (isExpanded) {
        return prev.filter(id => id !== rowId)
      } else {
        return [...prev, rowId]
      }
    })
  }

  // 파일 처리 함수
  const processUploadedFile = async (fileId: string, fileName: string) => {
    if (!confirm(`"${fileName}" 파일을 처리하시겠습니까?`)) return

    try {
      console.log(`🔄 파일 처리 시작: ${fileName}`)

      const response = await fetch(`/api/uploads/${fileId}/process`, {
        method: 'POST'
      })

      const result = await response.json()

      if (response.ok && result.success) {
        alert(`"${fileName}" 파일 처리가 완료되었습니다!\n처리된 데이터: ${result.recordCount || 0}건`)
        await loadData() // 데이터 새로고침

        // 드롭다운 새로고침
        const currentExpanded = [...expandedRows]
        setExpandedRows([])
        setTimeout(() => {
          setExpandedRows(currentExpanded)
          setRefreshKey(prev => prev + 1)
        }, 100)
      } else {
        throw new Error(result.error || '처리 실패')
      }
    } catch (error) {
      console.error('파일 처리 오류:', error)
      alert(`파일 처리 중 오류가 발생했습니다: ${error}`)
    }
  }

  // 파일 삭제 함수
  const deleteUploadedFile = async (fileId: string, fileName: string) => {
    if (!confirm(`"${fileName}" 파일을 삭제하시겠습니까?\n\n⚠️ 관련된 모든 데이터가 함께 삭제됩니다!`)) return

    try {
      console.log(`🗑️ 파일 삭제 시작: ${fileName}`)

      const response = await fetch(`/api/uploads/${fileId}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (response.ok) {
        console.log(`✅ 삭제 성공: ${fileName}`)
        alert(`"${fileName}" 파일과 관련 데이터가 모두 삭제되었습니다!`)

        // 🔥 강력한 새로고침
        setLoading(true)
        await new Promise(resolve => setTimeout(resolve, 500)) // 잠시 대기
        await loadData()

        // 모든 상태 초기화
        setExpandedRows([])
        setRefreshKey(prev => prev + 1)

        // 브라우저도 강제 새로고침
        window.location.reload()
      } else {
        throw new Error(result.error || '삭제 실패')
      }
    } catch (error) {
      console.error('파일 삭제 오류:', error)
      alert('파일 삭제 중 오류가 발생했습니다.')
    }
  }

  // 연간 기준 업로드 파일 목록 생성
  const getRequiredFilesList = (): RequiredFileItem[] => {
    // ✅ 성공! 간단한 로그만 유지 (클라이언트에서만)
    if (mounted && uploadedFiles.length > 0) {
      console.log(`📊 ${selectedYear}년 데이터 처리 중: ${uploadedFiles.length}개 파일`)
    }

    return requiredFileCategories.map((required, index) => {

      // 해당 카테고리의 모든 업로드된 파일 찾기
      const categoryFiles = uploadedFiles.filter(file => {
        const match = file.category === required.category &&
          Number(file.year) === Number(selectedYear) && // 타입 통일
          file.status === "COMPLETED"

        // ✅ 성공! 상세 로그 제거

        return match
      })

      // ✅ 매칭 성공시만 로그 (클라이언트에서만)
      if (mounted && categoryFiles.length > 0) {
        console.log(`📁 ${required.name}: ${categoryFiles.length}개 파일 매칭`)
      }

      // 연간 파일들은 월별 구분 없음 (단일 파일)
      if (required.category === "ANNUAL_LEDGER" ||
          required.category === "COMPREHENSIVE_PATIENTS") {
        return {
          id: index + 1,
          name: required.name,
          category: required.category,
          uploadedMonths: categoryFiles.length > 0 ? [0] : [], // 0은 연간 표시
          completedMonths: categoryFiles.length,
          isFullyUploaded: categoryFiles.length > 0,
          uploadedFiles: categoryFiles
        }
      }

      // 월별 파일들의 월 추출
      const uploadedMonths = categoryFiles
        .map(file => file.month)
        .filter((month): month is number => month !== null && month !== undefined)
        .sort((a, b) => a - b)

      // 중복 제거
      const uniqueMonths = [...new Set(uploadedMonths)]

      // ✅ 완료된 월들만 로그 (클라이언트에서만)
      if (mounted && uniqueMonths.length > 0) {
        console.log(`📅 ${required.name}: ${uniqueMonths.join('월, ')}월 완료`)
      }

      return {
        id: index + 1,
        name: required.name,
        category: required.category,
        uploadedMonths: uniqueMonths,
        completedMonths: uniqueMonths.length,
        isFullyUploaded: uniqueMonths.length === 12, // 12개월 모두 완료
        uploadedFiles: categoryFiles
      }
    })
  }

  const filesList = mounted ? getRequiredFilesList() : []
  const fullyCompletedCount = filesList.filter(f => f.isFullyUploaded).length
  const totalMonthsCompleted = filesList.reduce((sum, f) => sum + f.completedMonths, 0)

  // 클라이언트에서만 렌더링 (hydration 안전성)
  if (!mounted || typeof window === 'undefined') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <FileSpreadsheet className="w-6 h-6 text-blue-600" />
            <div>
              <h3 className="text-lg font-semibold">파일 업로드 관리</h3>
              <p className="text-sm text-gray-600">월별 필수 파일 업로드 현황</p>
            </div>
          </div>
        </div>
        <div className="text-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
          <div className="mt-2 text-sm text-gray-600">로딩 중...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <FileSpreadsheet className="w-6 h-6 text-blue-600" />
          <div>
            <h3 className="text-lg font-semibold">파일 업로드 관리</h3>
            <p className="text-sm text-gray-600">월별 필수 파일 업로드 현황</p>
          </div>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? "로딩 중..." : "새로고침"}
        </button>
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
          완전완료: {filesList.filter(f => f.isFullyUploaded).length}/{filesList.length}개 카테고리
        </div>

        <div className="text-sm text-blue-600">
          전체진도: {filesList.reduce((sum, f) => sum + f.completedMonths, 0)}/{filesList.length * 12}개월
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
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="space-y-4">
          {uploading ? (
            <div className="space-y-3">
              <div className="w-12 h-12 mx-auto border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
              <div className="text-blue-600 font-medium">업로드 중...</div>
              <div className="text-sm text-gray-600">파일을 처리하고 있습니다</div>
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
                  파일을 드래그하여 업로드하거나 클릭하여 선택
                </div>
                <div className="text-sm text-gray-500 mb-4">
                  Excel 파일(.xlsx, .xls)만 지원됩니다
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
      </div>

      {/* 업로드해야 할 파일 목록 */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h4 className="font-medium text-gray-900">
            {selectedYear}년 연간 업로드 파일 현황 (카테고리별)
          </h4>
          <p className="text-sm text-gray-600 mt-1">
            각 카테고리별로 1월~12월 데이터가 모두 업로드되어야 완료됩니다
          </p>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
            <div className="mt-2 text-sm text-gray-600">로딩 중...</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table key={refreshKey} className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">순번</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">파일명</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">상태</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filesList.map((item) => {
                  // 상태 결정
                  let statusColor = "gray"
                  let statusText = "미완료"
                  let statusIcon = <XCircle className="w-3 h-3" />

                  if (item.category === "ANNUAL_LEDGER" ||
                      item.category === "COMPREHENSIVE_PATIENTS") {
                    // 연간 파일들은 파일이 있으면 완료
                    if (item.isFullyUploaded) {
                      statusColor = "green"
                      statusText = "완료"
                      statusIcon = <CheckCircle className="w-3 h-3" />
                    }
                  } else {
                    // 월별 파일들
                    if (item.isFullyUploaded) {
                      statusColor = "green"
                      statusText = "완료 (12/12)"
                      statusIcon = <CheckCircle className="w-3 h-3" />
                    } else if (item.completedMonths > 0) {
                      statusColor = "yellow"
                      statusText = `진행중 (${item.completedMonths}개월)`
                      statusIcon = <Upload className="w-3 h-3" />
                    }
                  }

                  const isExpanded = expandedRows.includes(item.id)

                  return (
                    <React.Fragment key={`row-group-${item.id}`}>
                      {/* 메인 행 */}
                      <tr
                        key={item.id}
                        className={`hover:bg-gray-50 cursor-pointer ${item.isFullyUploaded ? 'bg-green-50' : item.completedMonths > 0 ? 'bg-yellow-50' : ''}`}
                        onClick={() => toggleRow(item.id)}
                      >
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {item.id}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          <div className="flex items-center gap-2">
                            {isExpanded ?
                              <ChevronDown className="w-4 h-4 text-gray-400" /> :
                              <ChevronRight className="w-4 h-4 text-gray-400" />
                            }
                            <div>
                              <div className="font-medium">{item.name}</div>
                              <div className="text-xs text-gray-500 mt-1">
                                {(item.category === "ANNUAL_LEDGER" ||
                                  item.category === "COMPREHENSIVE_PATIENTS") ? "연간 단일 파일" : "월별 12개 파일 필요"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded ${
                            statusColor === "green" ? "bg-green-100 text-green-700" :
                            statusColor === "yellow" ? "bg-yellow-100 text-yellow-700" :
                            "bg-gray-100 text-gray-600"
                          }`}>
                            {statusIcon}
                            {statusText}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {/* 카테고리별 파일 선택 버튼 */}
                            <input
                              type="file"
                              multiple
                              accept=".xlsx,.xls"
                              onChange={(e) => handleCategoryFileUpload(e, item.category)}
                              disabled={uploading}
                              className="hidden"
                              id={`file-upload-${item.category}`}
                            />
                            <label
                              htmlFor={`file-upload-${item.category}`}
                              className={`inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors cursor-pointer ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                              title={`${item.name} 파일 선택`}
                            >
                              <Upload className="w-3 h-3" />
                              파일선택
                            </label>

                            <span className="text-xs text-gray-500">
                              {isExpanded ? "접기" : "펼치기"}
                            </span>
                          </div>
                        </td>
                      </tr>

                      {/* 펼쳐진 상세 행들 */}
                      {isExpanded && (
                        <tr key={`expanded-${item.id}`}>
                          <td colSpan={4} className="px-0 py-0 bg-gray-50">
                            <div className="px-8 py-4">
                              {(item.category === "ANNUAL_LEDGER" ||
                                item.category === "COMPREHENSIVE_PATIENTS") ? (
                                // 연간 파일들 상세
                                <div className="space-y-2">
                                  <div className="text-sm font-medium text-gray-700 mb-3">연간 파일 (업로드 날짜 기록)</div>
                                  {item.uploadedFiles.length > 0 ? (
                                    <div className="flex items-center justify-between p-3 bg-white rounded border">
                                      <div>
                                        <div className="text-sm font-medium text-green-700">
                                          {item.uploadedFiles[0].status === 'COMPLETED' ? '✅ 처리완료' :
                                           item.uploadedFiles[0].status === 'PENDING' ? '⏳ 처리대기' :
                                           item.uploadedFiles[0].status === 'PROCESSING' ? '🔄 처리중' : '❌ 처리실패'}
                                        </div>
                                        <div className="text-xs text-gray-600 font-mono">{item.uploadedFiles[0].fileName}</div>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        {item.uploadedFiles[0].status === 'PENDING' && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              processUploadedFile(item.uploadedFiles[0].id, item.uploadedFiles[0].fileName)
                                            }}
                                            className="px-2 py-1 text-xs bg-blue-500 text-white hover:bg-blue-600 rounded transition-colors"
                                            title="파일 처리"
                                          >
                                            처리
                                          </button>
                                        )}
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            deleteUploadedFile(item.uploadedFiles[0].id, item.uploadedFiles[0].fileName)
                                          }}
                                          className="p-1 text-red-400 hover:text-red-600 hover:bg-red-100 rounded transition-colors"
                                          title="파일 삭제"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="p-3 bg-white rounded border border-dashed border-gray-300">
                                      <div className="text-sm text-gray-500">❌ 연간 파일 업로드 필요</div>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                // 월별 파일들 상세
                                <div className="space-y-2">
                                  <div className="text-sm font-medium text-gray-700 mb-3">월별 파일 현황 (1월~12월)</div>
                                  <div className="grid grid-cols-3 gap-3">
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(month => {
                                      const monthFile = item.uploadedFiles.find(f => f.month === month)
                                      return (
                                        <div
                                          key={month}
                                          className={`p-3 rounded border ${monthFile ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}
                                        >
                                          <div className="flex items-center justify-between">
                                            <div className="text-sm font-medium">
                                              {month}월
                                            </div>
                                            {monthFile && (
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  deleteUploadedFile(monthFile.id, monthFile.fileName)
                                                }}
                                                className="p-1 text-red-400 hover:text-red-600 hover:bg-red-100 rounded transition-colors"
                                                title={`${monthFile.fileName} 삭제`}
                                              >
                                                <Trash2 className="w-3 h-3" />
                                              </button>
                                            )}
                                          </div>
                                          {monthFile ? (
                                            <div>
                                              <div className="text-xs font-medium">
                                                {monthFile.status === 'COMPLETED' ? '✅ 처리완료' :
                                                 monthFile.status === 'PENDING' ? '⏳ 처리대기' :
                                                 monthFile.status === 'PROCESSING' ? '🔄 처리중' : '❌ 처리실패'}
                                              </div>
                                              <div className="text-xs text-gray-600 font-mono truncate" title={monthFile.fileName}>
                                                {monthFile.fileName}
                                              </div>
                                              {monthFile.status === 'PENDING' && (
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    processUploadedFile(monthFile.id, monthFile.fileName)
                                                  }}
                                                  className="mt-1 px-1 py-0.5 text-xs bg-blue-500 text-white hover:bg-blue-600 rounded transition-colors"
                                                  title="파일 처리"
                                                >
                                                  처리
                                                </button>
                                              )}
                                            </div>
                                          ) : (
                                            <div className="text-xs text-gray-500">❌ 업로드 필요</div>
                                          )}
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              )}
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
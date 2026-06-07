'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

export default function PEIUploadPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session, status } = useSession()
  const clinicId = params.clinicId as string
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 업로드 모드 상태
  const [uploadMode, setUploadMode] = useState<'html' | 'excel'>('excel')

  // 공통 상태
  const [file, setFile] = useState<File | null>(null)
  const [year, setYear] = useState(2026)
  const [month, setMonth] = useState(6)
  const [title, setTitle] = useState('')
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')

  // 드래그 앤 드롭 상태
  const [isDragging, setIsDragging] = useState(false)
  const [dragCounter, setDragCounter] = useState(0)

  // 엑셀 모드 전용 상태
  const [clinicName, setClinicName] = useState('')
  const [doctorSpecialties, setDoctorSpecialties] = useState('')
  const [googleSheetLink, setGoogleSheetLink] = useState('')
  const [progress, setProgress] = useState<string>('')

  // 권한 체크
  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      router.push('/login')
      return
    }

    if ((session.user as any).role !== 'MASTER') {
      alert('PEI 보고서 업로드는 마스터 계정만 가능합니다.')
      router.push(`/dashboard/${clinicId}/pei`)
      return
    }
  }, [session, status, router, clinicId])

  // 파일 검증
  const validateFile = useCallback((file: File): string | null => {
    if (uploadMode === 'excel') {
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        return '엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.'
      }
    } else {
      if (!file.name.endsWith('.html')) {
        return 'HTML 파일(.html)만 업로드 가능합니다.'
      }
    }

    if (file.size > 50 * 1024 * 1024) { // 50MB 제한
      return '파일 크기는 50MB를 초과할 수 없습니다.'
    }

    return null
  }, [uploadMode])

  // 파일 설정
  const handleFileSelect = useCallback((selectedFile: File) => {
    const error = validateFile(selectedFile)
    if (error) {
      setMessage(`❌ ${error}`)
      return
    }

    setFile(selectedFile)
    setMessage('')

    // 파일명에서 자동으로 제목 추출
    const fileName = selectedFile.name.replace(/\.(html|xlsx|xls)$/, '')
    if (!title) {
      setTitle(fileName)
    }
  }, [validateFile, title])

  // 드래그 이벤트 핸들러
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragCounter(prev => prev + 1)

    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true)
    }
  }, [])

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragCounter(prev => prev - 1)

    if (dragCounter - 1 === 0) {
      setIsDragging(false)
    }
  }, [dragCounter])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    setDragCounter(0)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0]
      handleFileSelect(droppedFile)
      e.dataTransfer.clearData()
    }
  }, [handleFileSelect])

  // 파일 입력 변경
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      handleFileSelect(selectedFile)
    }
  }

  // 드롭 영역 클릭
  const handleDropZoneClick = () => {
    fileInputRef.current?.click()
  }

  // 엑셀 업로드 처리
  const handleExcelUpload = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!file || !title) {
      setMessage('❌ 파일과 제목을 모두 입력해주세요.')
      return
    }

    setUploading(true)
    setMessage('')
    setProgress('📊 엑셀 파일 업로드 중...')

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('clinicId', clinicId)
      formData.append('year', year.toString())
      formData.append('month', month.toString())
      formData.append('title', title)
      formData.append('clinicName', clinicName)
      formData.append('doctorSpecialties', doctorSpecialties)
      formData.append('googleSheetLink', googleSheetLink)

      setProgress('🔍 데이터 분석 중...')

      const response = await fetch('/api/pei/generate-excel', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (result.success) {
        setProgress('✅ 보고서 생성 완료!')
        setMessage(`🎉 PEI 보고서가 성공적으로 생성되었습니다!\\n\\n📊 종합 점수: ${result.analysis.overallScore.toFixed(2)}점\\n👥 응답 수: ${result.analysis.responseCount}명\\n📈 상태: ${result.analysis.statusBadge === 'excellent' ? '매우 양호' : result.analysis.statusBadge === 'good' ? '양호' : '개선 필요'}`)

        setTimeout(() => {
          router.push(`/dashboard/${clinicId}/pei`)
        }, 3000)
      } else {
        setProgress('')
        setMessage(`❌ 생성 실패: ${result.error}`)
        if (result.details) {
          console.error('상세 오류:', result.details)
        }
      }
    } catch (error) {
      console.error('업로드 오류:', error)
      setProgress('')
      setMessage('❌ 업로드 중 오류가 발생했습니다.')
    } finally {
      setUploading(false)
    }
  }

  // HTML 업로드 처리
  const handleHtmlUpload = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!file || !title) {
      setMessage('❌ 파일과 제목을 모두 입력해주세요.')
      return
    }

    setUploading(true)
    setMessage('')

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('clinicId', clinicId)
      formData.append('year', year.toString())
      formData.append('month', month.toString())
      formData.append('title', title)

      const response = await fetch('/api/pei/upload-html', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (result.success) {
        setMessage('✅ HTML 보고서가 성공적으로 업로드되었습니다!')

        setTimeout(() => {
          router.push(`/dashboard/${clinicId}/pei`)
        }, 3000)
      } else {
        setMessage('❌ 업로드 실패: ' + result.error)
      }
    } catch (error) {
      console.error('업로드 오류:', error)
      setMessage('❌ 업로드 중 오류가 발생했습니다.')
    } finally {
      setUploading(false)
    }
  }

  // 권한 체크 중
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">권한 확인 중...</p>
        </div>
      </div>
    )
  }

  if (!session || (session.user as any).role !== 'MASTER') {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            PEI 보고서 업로드
          </h1>

          {/* 업로드 모드 선택 */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">업로드 방식 선택</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div
                className={`p-6 rounded-lg border-2 cursor-pointer transition-all ${
                  uploadMode === 'excel'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setUploadMode('excel')}
              >
                <div className="flex items-center mb-3">
                  <input
                    type="radio"
                    name="uploadMode"
                    checked={uploadMode === 'excel'}
                    onChange={() => setUploadMode('excel')}
                    className="mr-3 text-blue-600"
                  />
                  <h4 className="text-lg font-semibold text-gray-900">📊 엑셀 자동 생성</h4>
                  <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">추천</span>
                </div>
                <p className="text-sm text-gray-600 mb-2">
                  구글폼 설문 응답 엑셀을 드래그 앤 드롭하면 자동으로 전문적인 PEI 보고서를 생성합니다.
                </p>
              </div>

              <div
                className={`p-6 rounded-lg border-2 cursor-pointer transition-all ${
                  uploadMode === 'html'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setUploadMode('html')}
              >
                <div className="flex items-center mb-3">
                  <input
                    type="radio"
                    name="uploadMode"
                    checked={uploadMode === 'html'}
                    onChange={() => setUploadMode('html')}
                    className="mr-3 text-blue-600"
                  />
                  <h4 className="text-lg font-semibold text-gray-900">📄 HTML 업로드</h4>
                </div>
                <p className="text-sm text-gray-600 mb-2">
                  이미 생성된 HTML 보고서를 직접 업로드합니다.
                </p>
              </div>
            </div>
          </div>

          {/* 드래그 앤 드롭 영역 */}
          <div className="mb-8">
            <div
              className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                isDragging
                  ? 'border-blue-500 bg-blue-50'
                  : file
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragEnter={handleDragIn}
              onDragLeave={handleDragOut}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={handleDropZoneClick}
            >
              {/* 숨겨진 파일 입력 */}
              <input
                ref={fileInputRef}
                type="file"
                accept={uploadMode === 'excel'
                  ? '.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel'
                  : '.html,text/html'
                }
                onChange={handleFileInputChange}
                className="hidden"
              />

              {isDragging ? (
                <div className="py-12">
                  <div className="text-6xl mb-4">📥</div>
                  <p className="text-xl font-semibold text-blue-600">
                    파일을 여기에 드롭하세요!
                  </p>
                  <p className="text-sm text-blue-500 mt-2">
                    {uploadMode === 'excel' ? 'Excel 파일 (.xlsx, .xls)' : 'HTML 파일 (.html)'}
                  </p>
                </div>
              ) : file ? (
                <div className="py-8">
                  <div className="text-6xl mb-4">✅</div>
                  <p className="text-lg font-semibold text-green-700 mb-2">
                    {file.name}
                  </p>
                  <p className="text-sm text-green-600">
                    파일 크기: {(file.size / 1024).toFixed(1)}KB
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    다른 파일을 선택하려면 클릭하거나 드래그하세요
                  </p>
                </div>
              ) : (
                <div className="py-12">
                  <div className="text-6xl mb-4">
                    {uploadMode === 'excel' ? '📊' : '📄'}
                  </div>
                  <p className="text-xl font-semibold text-gray-700 mb-2">
                    {uploadMode === 'excel'
                      ? '엑셀 파일을 드래그 앤 드롭하거나 클릭하세요'
                      : 'HTML 파일을 드래그 앤 드롭하거나 클릭하세요'
                    }
                  </p>
                  <p className="text-sm text-gray-500">
                    지원 형식: {uploadMode === 'excel' ? '.xlsx, .xls' : '.html'}
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    최대 50MB까지 업로드 가능
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 폼 영역 */}
          <form onSubmit={uploadMode === 'excel' ? handleExcelUpload : handleHtmlUpload} className="space-y-6">
            {/* 기본 정보 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  연도 *
                </label>
                <input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value))}
                  min="2020"
                  max="2030"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  월 *
                </label>
                <select
                  value={month}
                  onChange={(e) => setMonth(parseInt(e.target.value))}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  required
                >
                  {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>{m}월</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                보고서 제목 *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 26년 6월 PEI 보고서"
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            {/* 엑셀 모드 전용 추가 정보 */}
            {uploadMode === 'excel' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    치과명 (선택사항)
                  </label>
                  <input
                    type="text"
                    value={clinicName}
                    onChange={(e) => setClinicName(e.target.value)}
                    placeholder="기본값: 시스템에 등록된 치과명 사용"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    의료진 전문분야 (선택사항)
                  </label>
                  <input
                    type="text"
                    value={doctorSpecialties}
                    onChange={(e) => setDoctorSpecialties(e.target.value)}
                    placeholder="예: 김원장:일반치과, 박원장:치주과"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    '의사명:전문분야' 형식으로 쉼표로 구분하여 입력
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    구글 스프레드시트 링크 (선택사항)
                  </label>
                  <input
                    type="url"
                    value={googleSheetLink}
                    onChange={(e) => setGoogleSheetLink(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    보고서에 원본 데이터 링크를 포함하려면 입력하세요
                  </p>
                </div>
              </>
            )}

            {/* 진행 상황 */}
            {progress && (
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span className="text-blue-800 font-medium">{progress}</span>
                </div>
              </div>
            )}

            {/* 메시지 */}
            {message && (
              <div className={`p-4 rounded-lg whitespace-pre-line ${
                message.includes('✅') || message.includes('🎉') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
              }`}>
                {message}
              </div>
            )}

            {/* 버튼 */}
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={uploading || !file}
                className={`flex-1 py-3 px-4 rounded-lg font-medium ${
                  uploading || !file
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                } text-white transition-colors`}
              >
                {uploading
                  ? (uploadMode === 'excel' ? '📊 보고서 생성 중...' : '업로드 중...')
                  : (uploadMode === 'excel' ? '🚀 엑셀로 자동 생성' : '📄 HTML 보고서 업로드')
                }
              </button>

              <button
                type="button"
                onClick={() => router.push(`/dashboard/${clinicId}/pei`)}
                className="px-4 py-3 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
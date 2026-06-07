"use client"

import { useState, useRef, useCallback } from "react"
import { useSession } from "next-auth/react"
import { FileText, Upload, AlertCircle, CheckCircle } from "lucide-react"

interface ReportHtmlUploadProps {
  clinicId: string
  onUploadSuccess?: () => void
}

export default function ReportHtmlUpload({ clinicId, onUploadSuccess }: ReportHtmlUploadProps) {
  const { data: session, status } = useSession()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 상태
  const [file, setFile] = useState<File | null>(null)
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [title, setTitle] = useState('')
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')

  // 드래그 앤 드롭 상태
  const [isDragging, setIsDragging] = useState(false)
  const [dragCounter, setDragCounter] = useState(0)

  // 파일 검증
  const validateFile = useCallback((file: File): string | null => {
    if (!file.name.endsWith('.html')) {
      return 'HTML 파일(.html)만 업로드 가능합니다.'
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB 제한
      return '파일 크기는 5MB를 초과할 수 없습니다.'
    }

    return null
  }, [])

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
    const fileName = selectedFile.name.replace(/\.html$/, '')
    if (!title) {
      setTitle(fileName)
    }
  }, [validateFile, title])

  // 드래그 이벤트 핸들러 (터치 지원 개선)
  const handleDrag = useCallback((e: React.DragEvent | React.TouchEvent) => {
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

  // 터치 이벤트 핸들러
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    setIsDragging(false)
    // 터치 디바이스에서는 파일 선택 창을 바로 열기
    handleDropZoneClick()
  }, [])

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

  // HTML 업로드 처리
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()

    if (status !== "authenticated" || !session) {
      setMessage("로그인이 필요합니다.")
      return
    }

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

      const response = await fetch('/api/reports/upload-html', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (response.ok) {
        setMessage('✅ HTML 경영 보고서가 성공적으로 업로드되었습니다!')
        setFile(null)
        setTitle('')
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        onUploadSuccess?.()
      } else {
        if (response.status === 401) {
          setMessage("세션이 만료되었습니다. 다시 로그인해주세요.")
          setTimeout(() => {
            window.location.href = "/login"
          }, 3000)
        } else {
          setMessage(`❌ ${result.error || '업로드에 실패했습니다.'}`)
        }
      }
    } catch (error) {
      setMessage('❌ 업로드 중 네트워크 오류가 발생했습니다.')
      console.error('업로드 오류:', error)
    } finally {
      setUploading(false)
    }
  }

  // 인증되지 않은 경우
  if (status === "unauthenticated") {
    return (
      <div className="bg-white rounded-2xl border border-[#e5e8eb] p-6">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-[#ff6b6b] mx-auto mb-4" />
          <p className="text-[#191f28] font-medium">로그인이 필요합니다</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-[#e5e8eb] p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-[#fff3cd] rounded-xl flex items-center justify-center">
          <Upload className="w-4 h-4 text-[#f59e0b]" />
        </div>
        <div>
          <h3 className="text-[16px] font-semibold text-[#191f28]">HTML 보고서 업로드</h3>
          <p className="text-[13px] text-[#8b95a1]">직접 제작한 경영 보고서 HTML 파일을 업로드합니다</p>
        </div>
      </div>

      <form onSubmit={handleUpload} className="space-y-6">
        {/* 드래그 앤 드롭 영역 - 터치 지원 개선 */}
        <div>
          <div
            className={`relative border-2 border-dashed rounded-xl p-4 sm:p-6 text-center transition-all cursor-pointer touch-manipulation ${
              isDragging
                ? 'border-[#f59e0b] bg-[#fff3cd]'
                : file
                ? 'border-[#10b981] bg-[#ecfdf5]'
                : 'border-[#e5e8eb] hover:border-[#8b95a1] active:border-[#3182f6]'
            }`}
            onDragEnter={handleDragIn}
            onDragLeave={handleDragOut}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onClick={handleDropZoneClick}
            role="button"
            tabIndex={0}
            aria-label="파일 업로드 영역"
          >
            {/* 숨겨진 파일 입력 */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".html,text/html"
              onChange={handleFileInputChange}
              className="hidden"
            />

            {isDragging ? (
              <div className="py-6 sm:py-8">
                <div className="text-3xl sm:text-4xl mb-3 sm:mb-4">📄</div>
                <p className="text-base sm:text-lg font-semibold text-[#f59e0b]">
                  HTML 파일을 여기에 드롭하세요!
                </p>
              </div>
            ) : file ? (
              <div className="py-4 sm:py-6">
                <CheckCircle className="w-10 h-10 sm:w-12 sm:h-12 text-[#10b981] mx-auto mb-2 sm:mb-3" />
                <p className="text-base sm:text-lg font-semibold text-[#10b981] mb-1 sm:mb-2 break-all">
                  {file.name}
                </p>
                <p className="text-[13px] sm:text-sm text-[#6b7280]">
                  파일 크기: {(file.size / 1024).toFixed(1)}KB
                </p>
                <p className="text-[11px] sm:text-xs text-[#8b95a1] mt-2 px-2">
                  다른 파일을 선택하려면 터치하거나 클릭하세요
                </p>
              </div>
            ) : (
              <div className="py-6 sm:py-8">
                <FileText className="w-10 h-10 sm:w-12 sm:h-12 text-[#8b95a1] mx-auto mb-3 sm:mb-4" />
                <p className="text-base sm:text-lg font-semibold text-[#191f28] mb-2 px-2">
                  HTML 파일을 터치하여 선택하거나<br className="sm:hidden" />
                  <span className="hidden sm:inline"> 드래그 앤 드롭하세요</span>
                </p>
                <p className="text-[13px] sm:text-sm text-[#8b95a1]">
                  지원 형식: .html (최대 5MB)
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 기본 정보 입력 - 모바일 개선 */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div>
            <label className="block text-[13px] sm:text-sm font-medium text-[#191f28] mb-2">
              연도 *
            </label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              min="2020"
              max="2030"
              className="block w-full px-3 py-2.5 sm:py-2 border border-[#e5e8eb] rounded-lg text-[14px] focus:outline-none focus:border-[#3182f6] touch-manipulation"
              required
              disabled={uploading}
            />
          </div>

          <div>
            <label className="block text-[13px] sm:text-sm font-medium text-[#191f28] mb-2">
              월 *
            </label>
            <select
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value))}
              className="block w-full px-3 py-2.5 sm:py-2 border border-[#e5e8eb] rounded-lg text-[14px] focus:outline-none focus:border-[#3182f6] touch-manipulation"
              required
              disabled={uploading}
            >
              {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{m}월</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[13px] sm:text-sm font-medium text-[#191f28] mb-2">
            보고서 제목 *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 2026년 6월 경영보고서"
            className="block w-full px-3 py-2.5 sm:py-2 border border-[#e5e8eb] rounded-lg text-[14px] focus:outline-none focus:border-[#3182f6] touch-manipulation"
            required
            disabled={uploading}
          />
        </div>

        {/* 업로드 버튼 - 모바일 개선 */}
        <button
          type="submit"
          disabled={uploading || !file || !title || status === "loading"}
          className="w-full bg-[#f59e0b] hover:bg-[#d97706] active:bg-[#d97706] text-white text-[14px] font-medium rounded-xl h-12 sm:h-11 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation"
        >
          {uploading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>업로드 중...</span>
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              <span>HTML 보고서 업로드</span>
            </>
          )}
        </button>

        {/* 메시지 표시 */}
        {message && (
          <div className={`p-3 rounded-lg text-[13px] ${
            message.includes("성공") || message.includes("✅")
              ? "bg-[#ecfdf5] text-[#10b981] border border-[#d1fae5]"
              : "bg-[#fef2f2] text-[#dc2626] border border-[#fecaca]"
          }`}>
            {message}
          </div>
        )}
      </form>
    </div>
  )
}
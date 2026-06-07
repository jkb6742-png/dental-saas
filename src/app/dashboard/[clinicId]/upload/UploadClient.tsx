"use client"

import { useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Upload, FolderOpen, CheckCircle, XCircle, ArrowRight, BarChart2, Loader2, Zap } from "lucide-react"
import Button from "@/components/ui/Button"
import Badge from "@/components/ui/Badge"

const FILE_TYPE_LABELS: Record<string, string> = {
  MONTHLY_LEDGER: "월간장부",
  ANNUAL_LEDGER: "연간장부 📅",
  TREATMENT_STATS: "진료항목통계",
  IMPLANT_STATS: "임플란트통계",
  COMPREHENSIVE_PATIENTS: "전체접수수납목록 📅", // 신환+구환 통합
  AGE_DISTRIBUTION: "연령별분포",
  REGION_DISTRIBUTION: "지역별분포",
  DAILY_PATIENTS: "일별접수환자수",
  VISIT_ROUTES: "내원경로분포",
}

type FileItem = {
  filename: string
  status: "대기 중" | "업로드 중" | "업로드 완료" | "오류"
}

export default function UploadClient({ clinicId }: { clinicId: string }) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const [dragging, setDragging] = useState(false)
  const [fileList, setFileList] = useState<FileItem[]>([])
  const [latestPeriod, setLatestPeriod] = useState<{ year: number; month: number } | null>(null)
  const [generating, setGenerating] = useState(false)
  const [generationResult, setGenerationResult] = useState<string | null>(null)

  const processFiles = useCallback(async (fileArray: File[]) => {
    const files = fileArray.filter(f =>
      (f.name.endsWith(".xlsx") || f.name.endsWith(".xls") || f.name.endsWith(".zip")) &&
      !f.name.startsWith("~$")
    )
    if (!files.length) return

    // 파일 목록 생성
    const items: FileItem[] = files.map(f => ({ filename: f.name, status: "대기 중" }))
    setFileList(items)

    // 순차적으로 업로드
    for (let i = 0; i < files.length; i++) {
      // 현재 파일 상태를 "업로드 중"으로 변경
      setFileList(prev => prev.map((item, idx) =>
        idx === i ? { ...item, status: "업로드 중" } : item
      ))

      const form = new FormData()
      form.append("file", files[i])
      form.append("clinicId", clinicId)

      try {
        console.log(`[클라이언트] ${files[i].name} 업로드 시작`)
        console.log(`[클라이언트] clinicId: ${clinicId}`)
        console.log(`[클라이언트] 파일 크기: ${files[i].size} bytes`)

        const res = await fetch("/api/uploads", { method: "POST", body: form })
        console.log(`[클라이언트] 응답 상태: ${res.status} ${res.statusText}`)

        if (!res.ok) {
          const errorText = await res.text()
          console.error(`[클라이언트] HTTP 오류: ${errorText}`)
          setFileList(prev => prev.map((item, idx) =>
            idx === i ? { ...item, status: "오류" } : item
          ))
          continue
        }

        const data = await res.json()
        console.log(`[클라이언트] ${files[i].name} 응답:`, data)

        if (data.success) {
          console.log(`[클라이언트] ${files[i].name} 성공: ${data.created}건 생성`)
          setFileList(prev => prev.map((item, idx) =>
            idx === i ? { ...item, status: "업로드 완료" } : item
          ))
        } else {
          console.error(`[클라이언트] ${files[i].name} 실패:`, data.error)
          setFileList(prev => prev.map((item, idx) =>
            idx === i ? { ...item, status: "오류" } : item
          ))
        }
      } catch (error) {
        console.error(`[클라이언트] ${files[i].name} 네트워크 오류:`, error)
        setFileList(prev => prev.map((item, idx) =>
          idx === i ? { ...item, status: "오류" } : item
        ))
      }
    }
  }, [clinicId])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const items = Array.from(e.dataTransfer.files)
    processFiles(items)
  }, [processFiles])

  // 환자 통계 자동 생성 함수
  const generatePatientStats = useCallback(async () => {
    setGenerating(true)
    setGenerationResult(null)

    try {
      const response = await fetch("/api/generate-patient-stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicId })
      })

      const data = await response.json()

      if (data.success) {
        setGenerationResult(`✅ 환자 통계 생성 완료: ${data.result.created}건 생성`)
        console.log(`[PATIENT_STATS] 자동 생성 완료: ${data.result.created}건`)

        // 즉시 페이지 새로고침
        router.refresh()

        // 추가적으로 강제 새로고침도 시도
        setTimeout(() => {
          if (typeof window !== 'undefined') {
            window.location.reload()
          }
        }, 1000)
      } else {
        setGenerationResult(`❌ 생성 실패: ${data.error}`)
        console.error(`[PATIENT_STATS] 생성 실패:`, data.error)
      }
    } catch (error) {
      setGenerationResult(`❌ 요청 실패: ${error}`)
    } finally {
      setGenerating(false)
    }
  }, [clinicId, router])

  const completedFiles = fileList.filter(f => f.status === "업로드 완료")
  const errorFiles = fileList.filter(f => f.status === "오류")

  return (
    <div className="max-w-2xl space-y-5">

      {/* 드롭존 */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`relative rounded-2xl p-10 text-center border-2 border-dashed transition-all ${
          dragging ? "border-[#3182f6] bg-[#ebf3fe]" : "border-[#e5e8eb] bg-white"
        }`}
      >
        <div className="flex flex-col items-center gap-4">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${dragging ? "bg-[#3182f6]" : "bg-[#f2f4f6]"}`}>
            <Upload className={`w-7 h-7 ${dragging ? "text-white" : "text-[#6b7684]"}`} />
          </div>

          <div>
            <p className="text-[17px] font-bold text-[#191f28]">
              파일 또는 폴더를 여기에 드래그하세요
            </p>
            <p className="text-[13px] text-[#8b95a1] mt-1">
              월별 구분 없이 한꺼번에 올리면 자동으로 분류됩니다
            </p>
          </div>

          <div className="flex gap-3">
            {/* 파일 선택 */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.zip"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && processFiles(Array.from(e.target.files))}
            />
            <Button variant="secondary" size="md" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              <Upload className="w-4 h-4" />
              파일 선택
            </Button>

            {/* 폴더 선택 */}
            <input
              ref={folderInputRef}
              type="file"
              // @ts-ignore
              webkitdirectory=""
              multiple
              className="hidden"
              onChange={(e) => e.target.files && processFiles(Array.from(e.target.files))}
            />
            <Button variant="primary" size="md" onClick={() => folderInputRef.current?.click()} disabled={uploading}>
              <FolderOpen className="w-4 h-4" />
              폴더 전체 선택
            </Button>
          </div>
        </div>
      </div>

      {/* 업로드 파일 목록 */}
      {fileList.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#e5e8eb] p-5">
          <h3 className="text-[15px] font-semibold text-[#191f28] mb-4">업로드 파일 목록</h3>
          <div className="space-y-2">
            {fileList.map((item, index) => (
              <div key={index} className="flex items-center gap-3 py-2">
                <span className="text-[14px] font-medium text-[#6b7684] w-8">{index + 1}.</span>
                <span className="text-[14px] text-[#191f28] flex-1">{item.filename}</span>
                <span className={`text-[13px] font-medium px-3 py-1 rounded ${
                  item.status === "업로드 완료" ? "bg-green-100 text-green-700" :
                  item.status === "업로드 중" ? "bg-blue-100 text-blue-700" :
                  item.status === "오류" ? "bg-red-100 text-red-700" :
                  "bg-gray-100 text-gray-600"
                }`}>
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 완료 배너 */}
      {completedFiles.length > 0 && (
        <div className="bg-[#e5f9f0] border border-[#a7f3d0] rounded-2xl p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#05c072] rounded-xl flex items-center justify-center shrink-0">
              <BarChart2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-[15px] font-bold text-[#191f28]">
                {completedFiles.length}개 파일 업로드 완료
              </p>
            </div>
          </div>
          <Button
            size="md"
            onClick={() => router.push(`/dashboard/${clinicId}`)}
          >
            대시보드 확인
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      )}


      {/* 환자 통계 자동 생성 */}
      <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[16px] font-semibold text-[#191f28] mb-2">환자 통계 자동 생성</h3>
            <p className="text-[13px] text-[#6b7684] mb-3">
              전체접수수납목록에서 환자 통계를 자동으로 생성합니다.<br/>
              일별 환자수, 총방문수, 신환/구환 분석 등의 데이터가 생성됩니다.
            </p>
            {generationResult && (
              <p className={`text-[14px] font-medium ${
                generationResult.startsWith('✅') ? 'text-green-700' : 'text-red-700'
              }`}>
                {generationResult}
              </p>
            )}
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={generatePatientStats}
            disabled={generating}
            className="shrink-0"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                생성 중...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                자동 생성
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 안내 */}
      <div className="bg-[#f9fafb] rounded-xl p-4 text-[13px] text-[#6b7684] leading-relaxed">
        <p className="font-semibold text-[#4e5968] mb-1">사용 방법</p>
        <p>① <strong className="text-[#191f28]">폴더 전체 선택</strong> 버튼으로 연도 폴더(예: 2025) 선택 → 하위 파일 전부 자동 처리</p>
        <p>② 또는 여러 파일을 <strong className="text-[#191f28]">드래그&드롭</strong>으로 한꺼번에 올리기</p>
        <p>③ <strong className="text-[#191f28]">🆕 ZIP 파일 지원</strong> → 여러 엑셀 파일을 ZIP으로 압축해서 한 번에 업로드 가능</p>
        <p>④ 파일명으로 종류 자동 판별 → 월별 분리 없이 한 번에 완료</p>
        <p>⑤ <strong className="text-[#191f28]">환자 통계 자동 생성</strong> 버튼으로 접수수납목록에서 환자 데이터 추출</p>
      </div>
    </div>
  )
}

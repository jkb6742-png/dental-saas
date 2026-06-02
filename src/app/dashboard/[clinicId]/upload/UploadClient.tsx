"use client"

import { useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Upload, FolderOpen, CheckCircle, XCircle, ArrowRight, BarChart2, Loader2, Zap } from "lucide-react"
import Button from "@/components/ui/Button"
import Badge from "@/components/ui/Badge"

const FILE_TYPE_LABELS: Record<string, string> = {
  monthly_ledger: "월간장부",
  annual_ledger: "연간장부",
  patient_stats: "일별접수환자수",
  treatment_stats: "진료항목통계",
  visit_routes: "내원경로",
  treatment_plans: "치료비용계획",
  implant_stats: "임플란트통계",
  consultation_stats: "상담통계",
  reception_records: "접수수납목록",
  age_dist: "연령별분포",
  region_dist: "지역별분포",
}

type UploadResult = {
  filename: string
  type: string
  total: number
  created: number
  skipped: number
  errors: string[]
  status: "success" | "error" | "skip"
}

export default function UploadClient({ clinicId }: { clinicId: string }) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, filename: "" })
  const [results, setResults] = useState<UploadResult[]>([])
  const [latestPeriod, setLatestPeriod] = useState<{ year: number; month: number } | null>(null)
  const [generating, setGenerating] = useState(false)
  const [generationResult, setGenerationResult] = useState<string | null>(null)

  const processFiles = useCallback(async (fileList: File[]) => {
    // xlsx/xls/zip만 필터, 임시파일(~$) 제외
    const files = fileList.filter(
      (f) => (f.name.endsWith(".xlsx") || f.name.endsWith(".xls") || f.name.endsWith(".zip")) && !f.name.startsWith("~$")
    )
    if (!files.length) return

    setUploading(true)
    setProgress({ current: 0, total: files.length, filename: "" })
    const newResults: UploadResult[] = []
    let bestYear = 0
    let bestMonth = 0

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      setProgress({ current: i + 1, total: files.length, filename: file.name })

      const form = new FormData()
      form.append("file", file)
      form.append("clinicId", clinicId)

      try {
        const res = await fetch("/api/upload", { method: "POST", body: form })
        const data = await res.json()

        if (res.ok) {
          // ZIP 파일 응답 처리
          if (data.fileType === 'zip') {
            newResults.push({
              filename: file.name,
              type: `ZIP (${data.processedTypes?.join(', ') || 'unknown'})`,
              total: data.total || 0,
              created: data.created || 0,
              skipped: data.skipped || 0,
              errors: data.errors || [],
              status: "success"
            })
          } else {
            // 단일 파일 응답 처리 (기존 로직)
            newResults.push({ filename: file.name, ...data, status: "success" })
          }

          // 가장 최근 연월 추적
          const ym = file.name.match(/(\d{4})년?(\d{1,2})월?/)
          if (ym) {
            const y = parseInt(ym[1]), m = parseInt(ym[2])
            if (y > bestYear || (y === bestYear && m > bestMonth)) {
              bestYear = y; bestMonth = m
            }
          }
        } else if (data.error?.includes("판별 실패")) {
          newResults.push({ filename: file.name, type: "unknown", total: 0, created: 0, skipped: 0, errors: [], status: "skip" })
        } else {
          newResults.push({ filename: file.name, type: "unknown", total: 0, created: 0, skipped: 0, errors: [data.error ?? "오류"], status: "error" })
        }
      } catch (e) {
        newResults.push({ filename: file.name, type: "unknown", total: 0, created: 0, skipped: 0, errors: [String(e)], status: "error" })
      }
    }

    setResults(newResults)
    if (bestYear > 0) setLatestPeriod({ year: bestYear, month: bestMonth })
    setUploading(false)
    setProgress({ current: 0, total: 0, filename: "" })
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
        // 페이지 새로고침하여 결과 반영
        setTimeout(() => {
          router.refresh()
        }, 1000)
      } else {
        setGenerationResult(`❌ 생성 실패: ${data.error}`)
      }
    } catch (error) {
      setGenerationResult(`❌ 요청 실패: ${error}`)
    } finally {
      setGenerating(false)
    }
  }, [clinicId, router])

  const successResults = results.filter((r) => r.status === "success")
  const errorResults = results.filter((r) => r.status === "error")
  const totalCreated = successResults.reduce((s, r) => s + r.created, 0)
  const totalSkipped = successResults.reduce((s, r) => s + r.skipped, 0)

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

      {/* 진행 상황 */}
      {uploading && (
        <div className="bg-white rounded-2xl p-5 border border-[#e5e8eb]">
          <div className="flex items-center gap-3 mb-3">
            <Loader2 className="w-5 h-5 text-[#3182f6] animate-spin" />
            <span className="text-[14px] font-semibold text-[#191f28]">
              업로드 중... ({progress.current}/{progress.total})
            </span>
          </div>
          <div className="w-full h-2 bg-[#f2f4f6] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#3182f6] rounded-full transition-all duration-300"
              style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
            />
          </div>
          <p className="text-[12px] text-[#8b95a1] mt-2 truncate">{progress.filename}</p>
        </div>
      )}

      {/* 완료 배너 */}
      {!uploading && successResults.length > 0 && (
        <div className="bg-[#e5f9f0] border border-[#a7f3d0] rounded-2xl p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#05c072] rounded-xl flex items-center justify-center shrink-0">
              <BarChart2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-[15px] font-bold text-[#191f28]">
                {successResults.length}개 파일 완료 · {totalCreated.toLocaleString()}건 신규 입력
                {totalSkipped > 0 && <span className="text-[#8b95a1] font-normal"> · {totalSkipped.toLocaleString()}건 중복</span>}
              </p>
              {latestPeriod && (
                <p className="text-[13px] text-[#6b7684] mt-0.5">
                  최근 데이터: {latestPeriod.year}년 {latestPeriod.month}월
                </p>
              )}
            </div>
          </div>
          <Button
            size="md"
            onClick={() => {
              router.refresh()
              const q = latestPeriod ? `?year=${latestPeriod.year}&month=${latestPeriod.month}` : ""
              router.push(`/dashboard/${clinicId}${q}`)
            }}
          >
            대시보드 확인
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* 결과 목록 */}
      {results.length > 0 && !uploading && (
        <div className="bg-white rounded-2xl border border-[#e5e8eb] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#f2f4f6] flex items-center justify-between">
            <span className="text-[15px] font-semibold text-[#191f28]">처리 결과</span>
            <div className="flex gap-2">
              {successResults.length > 0 && <Badge variant="green">{successResults.length}개 성공</Badge>}
              {errorResults.length > 0 && <Badge variant="red">{errorResults.length}개 오류</Badge>}
            </div>
          </div>
          <div className="divide-y divide-[#f2f4f6] max-h-80 overflow-y-auto">
            {results
              .filter((r) => r.status !== "skip")
              .map((r, i) => (
                <div key={i} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {r.status === "success"
                      ? <CheckCircle className="w-4 h-4 text-[#05c072] shrink-0" />
                      : <XCircle className="w-4 h-4 text-[#f04452] shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-[#191f28] truncate">{r.filename}</p>
                      {r.status === "success"
                        ? <p className="text-[12px] text-[#8b95a1]">신규 {r.created}건 · 중복 {r.skipped}건</p>
                        : <p className="text-[12px] text-[#f04452]">{r.errors[0]}</p>}
                    </div>
                  </div>
                  {r.type !== "unknown" && (
                    <Badge variant={r.status === "success" ? "blue" : "red"}>
                      {FILE_TYPE_LABELS[r.type] ?? r.type}
                    </Badge>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* 환자 통계 자동 생성 */}
      <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[16px] font-semibold text-[#191f28] mb-2">환자 통계 자동 생성</h3>
            <p className="text-[13px] text-[#6b7684] mb-3">
              접수수납목록에서 환자 통계를 자동으로 생성합니다.<br/>
              일별 신환수, 총방문수 등의 데이터가 생성됩니다.
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

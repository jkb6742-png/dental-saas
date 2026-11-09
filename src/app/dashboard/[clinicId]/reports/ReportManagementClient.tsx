"use client"

import { useState, useRef, useCallback, useMemo } from "react"
import {
  FileText, FolderPlus, Upload, Trash2, Eye, Download, Pencil,
  ChevronUp, ChevronDown, X, Check, Folder, Plus, Inbox,
} from "lucide-react"

interface ManagedReport {
  id: string
  title: string
  month: string | null
  memo: string | null
  fileType: string
  fileName: string | null
  sortOrder: number
  createdAt: string
}

interface Sector {
  id: string
  name: string
  sortOrder: number
  reports: ManagedReport[]
}

interface Props {
  clinicId: string
  userRole: string
  initialSectors: Sector[]
}

export default function ReportManagementClient({ clinicId, userRole, initialSectors }: Props) {
  const isMaster = userRole === "MASTER"
  const [sectors, setSectors] = useState<Sector[]>(initialSectors)
  const [busy, setBusy] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(initialSectors[0]?.id ?? null)
  const [preview, setPreview] = useState<ManagedReport | null>(null)
  const [uploadFor, setUploadFor] = useState<Sector | null>(null)
  const [editingSectorId, setEditingSectorId] = useState<string | null>(null)
  const [editingSectorName, setEditingSectorName] = useState("")

  const selected = useMemo(
    () => sectors.find((s) => s.id === selectedId) ?? sectors[0] ?? null,
    [sectors, selectedId]
  )
  const totalReports = sectors.reduce((n, s) => n + s.reports.length, 0)

  const refresh = useCallback(async (keepId?: string) => {
    const res = await fetch(`/api/report-management/sectors?clinicId=${clinicId}`, { cache: "no-store" })
    if (res.ok) {
      const data = await res.json()
      setSectors(data.sectors)
      if (keepId) setSelectedId(keepId)
    }
  }, [clinicId])

  const api = useCallback(async (url: string, options: RequestInit) => {
    setBusy(true)
    try {
      const res = await fetch(url, options)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "요청에 실패했습니다")
      return data
    } finally {
      setBusy(false)
    }
  }, [])

  // ---- 카테고리 ----
  const addCategory = async () => {
    const name = window.prompt("추가할 카테고리 이름을 입력하세요 (예: 경영 보고서, 네이버 광고 보고서)")
    if (!name?.trim()) return
    try {
      const data = await api("/api/report-management/sectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicId, name: name.trim() }),
      })
      await refresh(data.sector?.id)
    } catch (e: any) {
      alert(e.message)
    }
  }

  const saveSectorName = async (id: string) => {
    if (!editingSectorName.trim()) return
    try {
      await api(`/api/report-management/sectors/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingSectorName.trim() }),
      })
      setEditingSectorId(null)
      await refresh(id)
    } catch (e: any) {
      alert(e.message)
    }
  }

  const deleteCategory = async (s: Sector) => {
    if (!window.confirm(`'${s.name}' 카테고리를 삭제할까요?${s.reports.length ? `\n안에 있는 보고서 ${s.reports.length}건도 함께 삭제됩니다.` : ""}`)) return
    try {
      await api(`/api/report-management/sectors/${s.id}`, { method: "DELETE" })
      await refresh()
    } catch (e: any) {
      alert(e.message)
    }
  }

  const moveCategory = async (index: number, dir: -1 | 1) => {
    const next = index + dir
    if (next < 0 || next >= sectors.length) return
    const reordered = [...sectors]
    ;[reordered[index], reordered[next]] = [reordered[next], reordered[index]]
    setSectors(reordered)
    try {
      await api("/api/report-management/sectors/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicId, orderedIds: reordered.map((s) => s.id) }),
      })
    } catch (e: any) {
      alert(e.message)
      await refresh()
    }
  }

  // ---- 보고서 ----
  const deleteReport = async (r: ManagedReport) => {
    if (!window.confirm(`'${r.title}' 보고서를 삭제할까요?`)) return
    try {
      await api(`/api/report-management/reports/${r.id}`, { method: "DELETE" })
      if (preview?.id === r.id) setPreview(null)
      await refresh(selected?.id)
    } catch (e: any) {
      alert(e.message)
    }
  }

  const moveReport = async (sector: Sector, index: number, dir: -1 | 1) => {
    const next = index + dir
    if (next < 0 || next >= sector.reports.length) return
    const reports = [...sector.reports]
    ;[reports[index], reports[next]] = [reports[next], reports[index]]
    setSectors((prev) => prev.map((s) => (s.id === sector.id ? { ...s, reports } : s)))
    try {
      await api("/api/report-management/reports/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicId, sectorId: sector.id, orderedIds: reports.map((r) => r.id) }),
      })
    } catch (e: any) {
      alert(e.message)
      await refresh(sector.id)
    }
  }

  const saveMemo = async (id: string, memo: string) => {
    try {
      await api(`/api/report-management/reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memo }),
      })
      setSectors((prev) => prev.map((s) => ({
        ...s,
        reports: s.reports.map((r) => (r.id === id ? { ...r, memo } : r)),
      })))
    } catch (e: any) {
      alert(e.message)
    }
  }

  return (
    <div className="bg-white rounded-2xl overflow-hidden flex flex-col min-h-[calc(100vh-120px)] border border-[#d1d1cc]">
      {/* 상단 헤더 */}
      <div className="px-4 py-4 flex items-center justify-between border-b border-[#e0e0db]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#e8f0ff] rounded-xl flex items-center justify-center">
            <FileText className="w-5 h-5 text-[#0062ff]" />
          </div>
          <div>
            <h2 className="text-[17px] font-semibold text-[#191f28]">보고서</h2>
            <p className="text-[12px] text-[#8b95a1] mt-0.5">
              카테고리 {sectors.length} · 보고서 {totalReports}건{!isMaster && " · 열람 전용"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* ===== 왼쪽: 카테고리 사이드바 ===== */}
        <aside className="w-[248px] shrink-0 border-r border-[#e0e0db] flex flex-col bg-[#fbfcfd]">
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <span className="text-[12px] font-semibold text-[#8b95a1]">카테고리</span>
            {isMaster && (
              <button onClick={addCategory} disabled={busy} className="flex items-center gap-1 text-[12px] font-semibold text-[#0062ff] hover:bg-[#e8f0ff] px-2 py-1 rounded-lg disabled:opacity-50">
                <Plus className="w-3.5 h-3.5" /> 추가
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
            {sectors.length === 0 && (
              <div className="px-3 py-3 text-center text-[12px] text-[#b0b8c1]">카테고리 없음</div>
            )}
            {sectors.map((s, si) => {
              const active = selected?.id === s.id
              const isEditing = editingSectorId === s.id
              return (
                <div key={s.id} className="group relative">
                  {isEditing ? (
                    <div className="flex items-center gap-1 px-2 py-1.5">
                      <input
                        value={editingSectorName}
                        onChange={(e) => setEditingSectorName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveSectorName(s.id); if (e.key === "Escape") setEditingSectorId(null) }}
                        autoFocus
                        className="flex-1 min-w-0 px-2 py-1 border border-[#0062ff] rounded-lg text-[13px] font-medium outline-none"
                      />
                      <button onClick={() => saveSectorName(s.id)} className="p-1 text-[#0062ff]"><Check className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setEditingSectorId(null)} className="p-1 text-[#8b95a1]"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setSelectedId(s.id)}
                      className={`w-full flex items-center gap-2.5 pl-3 pr-2 py-2 rounded-xl text-left transition-colors ${active ? "bg-[#e8f0ff]" : "hover:bg-[#f2f4f6]"}`}
                    >
                      <Folder className={`w-4 h-4 shrink-0 ${active ? "text-[#0062ff]" : "text-[#b0b8c1]"}`} />
                      <span className={`flex-1 min-w-0 truncate text-[13px] font-medium ${active ? "text-[#0062ff]" : "text-[#4e5968]"}`}>{s.name}</span>
                      {/* 건수 배지 (마스터는 hover 시 액션으로 대체) */}
                      <span className={`shrink-0 text-[11px] px-1.5 py-0.5 rounded-md ${active ? "bg-white text-[#0062ff]" : "bg-[#f2f4f6] text-[#8b95a1]"} ${isMaster ? "group-hover:hidden" : ""}`}>{s.reports.length}</span>
                      {isMaster && (
                        <span className="hidden group-hover:flex items-center shrink-0">
                          <span onClick={(e) => { e.stopPropagation(); moveCategory(si, -1) }} className={`p-1 rounded ${si === 0 ? "opacity-30" : "hover:bg-white text-[#8b95a1]"}`} title="위로"><ChevronUp className="w-3.5 h-3.5" /></span>
                          <span onClick={(e) => { e.stopPropagation(); moveCategory(si, 1) }} className={`p-1 rounded ${si === sectors.length - 1 ? "opacity-30" : "hover:bg-white text-[#8b95a1]"}`} title="아래로"><ChevronDown className="w-3.5 h-3.5" /></span>
                          <span onClick={(e) => { e.stopPropagation(); setEditingSectorId(s.id); setEditingSectorName(s.name) }} className="p-1 rounded hover:bg-white text-[#8b95a1]" title="이름 변경"><Pencil className="w-3.5 h-3.5" /></span>
                          <span onClick={(e) => { e.stopPropagation(); deleteCategory(s) }} className="p-1 rounded hover:bg-white text-[#e5484d]" title="삭제"><Trash2 className="w-3.5 h-3.5" /></span>
                        </span>
                      )}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </aside>

        {/* ===== 오른쪽: 선택 카테고리의 보고서 목록 ===== */}
        <section className="flex-1 min-w-0 flex flex-col">
          {!selected ? (
            <EmptyPane
              icon={<Folder className="w-6 h-6 text-[#b0b8c1]" />}
              title="등록된 카테고리가 없습니다"
              desc={isMaster ? "왼쪽 '추가'로 이 치과의 보고서 카테고리를 만들어보세요" : "아직 준비된 보고서가 없습니다"}
            />
          ) : (
            <>
              {/* 카테고리 헤더 */}
              <div className="px-4 py-4 flex items-center justify-between border-b border-[#e0e0db]">
                <div className="min-w-0">
                  <h3 className="text-[16px] font-semibold text-[#191f28] truncate">{selected.name}</h3>
                  <p className="text-[12px] text-[#8b95a1] mt-0.5">보고서 {selected.reports.length}건</p>
                </div>
                {isMaster && (
                  <button
                    onClick={() => setUploadFor(selected)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0062ff] text-white text-[14px] font-semibold hover:bg-[#2670e0] transition-colors shrink-0"
                  >
                    <Upload className="w-4 h-4" /> 보고서 업로드
                  </button>
                )}
              </div>

              {/* 목록 */}
              <div className="flex-1 overflow-y-auto">
                {selected.reports.length === 0 ? (
                  <EmptyPane
                    icon={<Inbox className="w-6 h-6 text-[#b0b8c1]" />}
                    title="업로드된 보고서가 없습니다"
                    desc={isMaster ? "오른쪽 위 '보고서 업로드'로 HTML 보고서를 올려보세요" : "아직 준비된 보고서가 없습니다"}
                  />
                ) : (
                  <>
                    {/* 컬럼 헤더 */}
                    <div className="px-4 py-2.5 flex items-center gap-3 text-[11px] font-semibold text-[#b0b8c1] border-b border-[#e0e0db] sticky top-0 bg-white z-10">
                      <span className="w-6 text-center">#</span>
                      <span className="w-16">월</span>
                      <span className="flex-1">제목 / 비고</span>
                      <span className="w-20 text-center hidden sm:block">업로드일</span>
                      <span className="w-32 text-right">작업</span>
                    </div>
                    <div className="divide-y divide-[#f2f4f6]">
                      {selected.reports.map((r, ri) => (
                        <ReportRow
                          key={r.id}
                          report={r}
                          index={ri}
                          count={selected.reports.length}
                          isMaster={isMaster}
                          onPreview={() => setPreview(r)}
                          onDelete={() => deleteReport(r)}
                          onMove={(dir) => moveReport(selected, ri, dir)}
                          onSaveMemo={(memo) => saveMemo(r.id, memo)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      {uploadFor && (
        <UploadModal
          clinicId={clinicId}
          sector={uploadFor}
          onClose={() => setUploadFor(null)}
          onUploaded={async () => { const id = uploadFor.id; setUploadFor(null); await refresh(id) }}
        />
      )}

      {preview && <PreviewModal report={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}

// ============ 빈 상태 ============
function EmptyPane({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="w-14 h-14 bg-[#f2f4f6] rounded-2xl flex items-center justify-center mb-2.5">{icon}</div>
      <p className="text-[15px] font-semibold text-[#191f28]">{title}</p>
      <p className="text-[13px] text-[#8b95a1] mt-1 max-w-xs">{desc}</p>
    </div>
  )
}

// ============ 보고서 행 ============
function ReportRow({
  report, index, count, isMaster, onPreview, onDelete, onMove, onSaveMemo,
}: {
  report: ManagedReport
  index: number
  count: number
  isMaster: boolean
  onPreview: () => void
  onDelete: () => void
  onMove: (dir: -1 | 1) => void
  onSaveMemo: (memo: string) => void
}) {
  const [editingMemo, setEditingMemo] = useState(false)
  const [memoDraft, setMemoDraft] = useState(report.memo || "")

  return (
    <div className="px-4 py-3 flex items-center gap-3 hover:bg-[#f2f2ef] transition-colors group">
      <span className="w-6 text-center text-[13px] text-[#b0b8c1] shrink-0">{index + 1}</span>
      <span className="w-16 text-[13px] text-[#6b7684] shrink-0 truncate">{report.month || "-"}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${report.fileType === "pdf" ? "bg-[#fdeeee] text-[#e5484d]" : "bg-[#e8f0ff] text-[#0062ff]"}`}>
            {report.fileType === "pdf" ? "PDF" : "HTML"}
          </span>
          <button onClick={onPreview} className="min-w-0 text-left text-[14px] font-medium text-[#191f28] truncate hover:text-[#0062ff]">{report.title}</button>
        </div>
        {editingMemo ? (
          <div className="flex items-center gap-1 mt-1">
            <input
              value={memoDraft}
              onChange={(e) => setMemoDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { onSaveMemo(memoDraft); setEditingMemo(false) } if (e.key === "Escape") { setMemoDraft(report.memo || ""); setEditingMemo(false) } }}
              autoFocus
              placeholder="비고 입력"
              className="px-2 py-0.5 border border-[#0062ff] rounded text-[12px] outline-none w-56"
            />
            <button onClick={() => { onSaveMemo(memoDraft); setEditingMemo(false) }} className="p-0.5 text-[#0062ff]"><Check className="w-3.5 h-3.5" /></button>
            <button onClick={() => { setMemoDraft(report.memo || ""); setEditingMemo(false) }} className="p-0.5 text-[#8b95a1]"><X className="w-3.5 h-3.5" /></button>
          </div>
        ) : (
          <div
            className={`text-[12px] mt-0.5 ${report.memo ? "text-[#8b95a1]" : "text-[#c4ccd4]"} ${isMaster ? "cursor-pointer hover:underline" : ""}`}
            onClick={() => isMaster && setEditingMemo(true)}
          >
            {report.memo || (isMaster ? "비고 추가" : "")}
          </div>
        )}
      </div>
      <span className="w-20 text-center text-[12px] text-[#b0b8c1] shrink-0 hidden sm:block">
        {new Date(report.createdAt).toLocaleDateString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit" })}
      </span>
      <div className="w-32 flex items-center justify-end gap-0.5 shrink-0">
        <button onClick={onPreview} className="p-1.5 text-[#8b95a1] hover:bg-[#e8f0ff] hover:text-[#0062ff] rounded-lg" title="미리보기"><Eye className="w-4 h-4" /></button>
        <a href={`/api/report-management/reports/${report.id}?download=1`} className="p-1.5 text-[#8b95a1] hover:bg-[#f2f4f6] rounded-lg" title="HTML 다운로드"><Download className="w-4 h-4" /></a>
        {isMaster && (
          <>
            <button onClick={() => onMove(-1)} disabled={index === 0} className="p-1.5 text-[#8b95a1] hover:bg-[#f2f4f6] rounded-lg disabled:opacity-30" title="위로"><ChevronUp className="w-4 h-4" /></button>
            <button onClick={() => onMove(1)} disabled={index === count - 1} className="p-1.5 text-[#8b95a1] hover:bg-[#f2f4f6] rounded-lg disabled:opacity-30" title="아래로"><ChevronDown className="w-4 h-4" /></button>
            <button onClick={onDelete} className="p-1.5 text-[#e5484d] hover:bg-[#fdeeee] rounded-lg" title="삭제"><Trash2 className="w-4 h-4" /></button>
          </>
        )}
      </div>
    </div>
  )
}

// ============ 미리보기 모달 ============
function PreviewModal({ report, onClose }: { report: ManagedReport; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden border border-[#d1d1cc]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-4 border-b border-[#e0e0db] shrink-0">
          <div className="min-w-0">
            <h3 className="text-[16px] font-semibold text-[#191f28] truncate">{report.title}</h3>
            {report.month && <p className="text-[12px] text-[#8b95a1] mt-0.5">{report.month}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a href={`/api/report-management/reports/${report.id}?download=1`} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#f2f4f6] text-[#4e5968] text-[13px] font-semibold hover:bg-[#e5e8eb]"><Download className="w-4 h-4" /> 다운로드</a>
            <button onClick={onClose} className="w-9 h-9 flex items-center justify-center text-[#8b95a1] hover:bg-[#f2f4f6] rounded-lg"><X className="w-5 h-5" /></button>
          </div>
        </div>
        <iframe src={`/api/report-management/reports/${report.id}`} className="flex-1 w-full bg-white" title={report.title} />
      </div>
    </div>
  )
}

// ============ 업로드 모달 ============
function UploadModal({
  clinicId, sector, onClose, onUploaded,
}: {
  clinicId: string
  sector: Sector
  onClose: () => void
  onUploaded: () => void
}) {
  const [title, setTitle] = useState("")
  const [month, setMonth] = useState("")
  const [memo, setMemo] = useState("")
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const submit = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file) { alert("HTML 파일을 선택하세요"); return }
    if (!title.trim()) { alert("제목을 입력하세요"); return }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("clinicId", clinicId)
      fd.append("sectorId", sector.id)
      fd.append("title", title.trim())
      fd.append("month", month.trim())
      fd.append("memo", memo.trim())
      const res = await fetch("/api/report-management/reports", { method: "POST", body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "업로드에 실패했습니다")
      onUploaded()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md border border-[#d1d1cc]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#e0e0db]">
          <div>
            <h3 className="text-[17px] font-semibold text-[#191f28]">보고서 업로드</h3>
            <p className="text-[13px] text-[#8b95a1] mt-0.5">카테고리 · {sector.name}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-[#8b95a1] hover:bg-[#f2f4f6] rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-4 py-3 space-y-2.5">
          <div>
            <label className="block text-[13px] font-medium text-[#4e5968] mb-1.5">제목 <span className="text-[#e5484d]">*</span></label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 2026년 6월 경영 보고서" className="w-full px-3 py-2.5 border border-[#d1d1cc] rounded-xl text-[14px] outline-none focus:border-[#0062ff]" />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-[#4e5968] mb-1.5">해당 월 <span className="text-[#b0b8c1]">(선택)</span></label>
            <input value={month} onChange={(e) => setMonth(e.target.value)} placeholder="예: 2026-06 또는 6월" className="w-full px-3 py-2.5 border border-[#d1d1cc] rounded-xl text-[14px] outline-none focus:border-[#0062ff]" />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-[#4e5968] mb-1.5">비고 <span className="text-[#b0b8c1]">(선택)</span></label>
            <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="메모" className="w-full px-3 py-2.5 border border-[#d1d1cc] rounded-xl text-[14px] outline-none focus:border-[#0062ff]" />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-[#4e5968] mb-1.5">보고서 파일 <span className="text-[#e5484d]">*</span></label>
            <input ref={fileRef} type="file" accept=".pdf,.html,.htm" className="w-full text-[13px] file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-[#e8f0ff] file:text-[#0062ff] file:text-[13px] file:font-semibold" />
            <p className="text-[12px] text-[#b0b8c1] mt-1.5">PDF 또는 HTML (.pdf / .html / .htm), 최대 50MB</p>
          </div>
        </div>
        <div className="px-4 py-4 border-t border-[#e0e0db] flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-[14px] font-medium text-[#4e5968] hover:bg-[#f2f4f6]">취소</button>
          <button onClick={submit} disabled={uploading} className="px-5 py-2.5 rounded-xl bg-[#0062ff] text-white text-[14px] font-semibold hover:bg-[#2670e0] disabled:opacity-50">
            {uploading ? "업로드 중..." : "업로드"}
          </button>
        </div>
      </div>
    </div>
  )
}

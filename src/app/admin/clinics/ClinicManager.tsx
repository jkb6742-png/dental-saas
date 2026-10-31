"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import type { Clinic } from "@prisma/client"
import Button from "@/components/ui/Button"
import SectionCard from "@/components/ui/SectionCard"
import { Plus, Building2, RefreshCw, Trash2, AlertTriangle } from "lucide-react"

export default function ClinicManager({
  agencyId,
  clinics: initial,
}: {
  agencyId: string
  clinics: Clinic[]
}) {
  const router = useRouter()
  const [clinics, setClinics] = useState(initial)
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [autoGenerate, setAutoGenerate] = useState(true)
  const [previewCode, setPreviewCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Generate code preview when name changes and auto-generate is enabled
  useEffect(() => {
    if (autoGenerate && name.trim()) {
      const generated = name
        .toLowerCase()
        .replace(/[^a-z가-힣0-9]/g, '') // Keep only Korean, English letters and numbers first
        .replace(/\s+/g, '') // Remove spaces
        .replace(/치과$/, '') // Remove '치과' suffix if present (after cleaning)
        .substring(0, 20) // Limit length

      setPreviewCode(generated || 'clinic')
    } else {
      setPreviewCode('')
    }
  }, [name, autoGenerate])

  async function addClinic() {
    if (!name.trim()) return
    if (!autoGenerate && !code.trim()) return

    setLoading(true)

    try {
      const payload = autoGenerate
        ? { name: name.trim() } // Let server auto-generate code
        : { name: name.trim(), code: code.trim() } // Use provided code

      const res = await fetch("/api/clinics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (res.ok) {
        setClinics((c) => [...c, data])
        setName("")
        setCode("")
        setPreviewCode("")
        router.refresh()
      } else {
        // Show error message to user
        alert(data.error || "치과 생성 중 오류가 발생했습니다.")
      }
    } catch (error) {
      alert("네트워크 오류가 발생했습니다.")
    } finally {
      setLoading(false)
    }
  }

  async function deleteClinic(clinic: Clinic) {
    // 삭제 확인
    const confirmed = window.confirm(
      `⚠️ 치과 삭제 확인\n\n` +
      `치과: ${clinic.name} (${clinic.code})\n\n` +
      `모든 데이터가 영구 삭제됩니다.\n` +
      `정말로 삭제하시겠습니까?`
    )

    if (!confirmed) return

    setDeletingId(clinic.id)

    try {
      const res = await fetch(`/api/clinics/${clinic.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      })

      const data = await res.json()

      if (res.ok) {
        // 성공적으로 삭제됨
        setClinics((c) => c.filter(cl => cl.id !== clinic.id))
        alert(`✅ ${data.message}`)
        router.refresh()
      } else {
        alert(`❌ 삭제 실패: ${data.error}`)
      }
    } catch (error) {
      alert("네트워크 오류가 발생했습니다.")
      console.error("Delete error:", error)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <SectionCard title="새 치과 추가">
        <div className="space-y-4">
          {/* Name Input */}
          <div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="치과 이름 (예: 이생각치과)"
              className="w-full px-4 py-2.5 rounded-xl border border-[#e5e8eb] text-[14px] focus:outline-none focus:border-[#3182f6] focus:ring-2 focus:ring-[#ebf3fe]"
            />
          </div>

          {/* Code Generation Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoGenerate}
                  onChange={(e) => setAutoGenerate(e.target.checked)}
                  className="w-4 h-4 text-[#3182f6] border-[#e5e8eb] rounded focus:ring-[#3182f6]"
                />
                <span className="text-[14px] text-[#191f28]">코드 자동 생성</span>
              </label>
              {autoGenerate && previewCode && (
                <div className="px-3 py-1 bg-[#ebf3fe] text-[#3182f6] text-[12px] rounded-lg font-medium">
                  미리보기: {previewCode}
                </div>
              )}
            </div>
          </div>

          {/* Manual Code Input (when auto-generate is off) */}
          {!autoGenerate && (
            <div>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="코드 (예: isanggak)"
                className="w-full px-4 py-2.5 rounded-xl border border-[#e5e8eb] text-[14px] focus:outline-none focus:border-[#3182f6] focus:ring-2 focus:ring-[#ebf3fe]"
              />
              <p className="mt-1 text-[12px] text-[#8b95a1]">
                한글, 영문, 숫자, 하이픈만 사용 가능합니다
              </p>
            </div>
          )}

          {/* Add Button */}
          <div className="flex justify-end">
            <Button
              onClick={addClinic}
              loading={loading}
              size="md"
              disabled={!name.trim() || (!autoGenerate && !code.trim())}
            >
              <Plus className="w-4 h-4" />
              치과 추가
            </Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title={`등록된 치과 (${clinics.length}개)`}>
        {clinics.length > 0 && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="text-[12px] text-yellow-800">
                <p className="font-semibold">⚠️ 삭제 시 주의사항</p>
                <p className="mt-1">치과를 삭제하면 환자정보, 수익데이터, 리포트 등 모든 데이터가 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.</p>
              </div>
            </div>
          </div>
        )}
        {clinics.length === 0 ? (
          <p className="text-[14px] text-[#8b95a1] text-center py-4">등록된 치과가 없습니다</p>
        ) : (
          <div className="space-y-2">
            {clinics.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between p-4 rounded-xl bg-[#f9fafb] hover:bg-[#f2f4f6] transition-colors"
              >
                <div
                  className="flex items-center gap-3 flex-1 cursor-pointer"
                  onClick={() => router.push(`/dashboard/${c.id}`)}
                >
                  <div className="w-9 h-9 bg-[#ebf3fe] rounded-xl flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-[#3182f6]" />
                  </div>
                  <div>
                    <div className="text-[14px] font-semibold text-[#191f28]">{c.name}</div>
                    <div className="text-[12px] text-[#8b95a1]">{c.code}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className="text-[13px] text-[#3182f6] font-medium cursor-pointer hover:text-[#1e40af]"
                    onClick={() => router.push(`/dashboard/${c.id}`)}
                  >
                    대시보드 →
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteClinic(c)
                    }}
                    disabled={deletingId === c.id}
                    className="ml-3 p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="치과 삭제 (모든 데이터 삭제됨)"
                  >
                    {deletingId === c.id ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}

"use client"

import { useState } from "react"
import { Plus, Code, Calendar, User, Building2, CheckCircle, XCircle, Clock, Copy, Trash2 } from "lucide-react"
import Button from "@/components/ui/Button"
import SectionCard from "@/components/ui/SectionCard"
import KpiCard from "@/components/ui/KpiCard"

type InviteCode = {
  id: string
  code: string
  clinicId: string
  createdBy: string
  usedBy: string | null
  usedAt: Date | null
  expiresAt: Date | null
  maxUses: number
  currentUses: number
  description: string | null
  isActive: boolean
  createdAt: Date
  clinic: {
    id: string
    name: string
    code: string
    agency: {
      id: string
      name: string
      slug: string
    }
  }
  creator: {
    id: string
    name: string
    email: string
  }
  users: {
    id: string
    name: string
    email: string
    createdAt: Date
  }[]
}

type Clinic = {
  id: string
  name: string
  code: string
  agency: {
    id: string
    name: string
    slug: string
  }
}

interface InviteCodesManagementClientProps {
  initialCodes: InviteCode[]
  clinics: Clinic[]
  stats: {
    total: number
    active: number
    used: number
    expired: number
  }
  currentUserId: string
}

export default function InviteCodesManagementClient({
  initialCodes,
  clinics,
  stats,
  currentUserId
}: InviteCodesManagementClientProps) {
  const [codes, setCodes] = useState<InviteCode[]>(initialCodes)
  const [loading, setLoading] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newCode, setNewCode] = useState({
    clinicId: clinics[0]?.id || '',
    description: '',
    maxUses: 1,
    expiresInMonths: 12, // 기본 12개월
  })

  // 초대 코드 생성
  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let result = ''
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  // 코드 생성
  const createInviteCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/admin/invite-codes/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCode)
      })

      if (response.ok) {
        const data = await response.json()
        setCodes([data.code, ...codes])
        setShowCreateForm(false)
        setNewCode({
          clinicId: clinics[0]?.id || '',
          description: '',
          maxUses: 1,
          expiresInMonths: 12,
        })
        alert('초대 코드가 생성되었습니다!')
      } else {
        const data = await response.json()
        alert(data.error || '코드 생성에 실패했습니다')
      }
    } catch (error) {
      alert('오류가 발생했습니다')
    }

    setLoading(false)
  }

  // 코드 활성화/비활성화
  const toggleCodeStatus = async (codeId: string, isActive: boolean) => {
    setLoading(true)

    try {
      const response = await fetch('/api/admin/invite-codes/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codeId, isActive })
      })

      if (response.ok) {
        setCodes(codes.map(code =>
          code.id === codeId ? { ...code, isActive } : code
        ))
      } else {
        alert('상태 변경에 실패했습니다')
      }
    } catch (error) {
      alert('오류가 발생했습니다')
    }

    setLoading(false)
  }

  // 코드 삭제
  const deleteCode = async (codeId: string) => {
    if (!confirm('정말로 이 초대 코드를 삭제하시겠습니까?')) return

    setLoading(true)

    try {
      const response = await fetch('/api/admin/invite-codes/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codeId })
      })

      if (response.ok) {
        setCodes(codes.filter(code => code.id !== codeId))
      } else {
        alert('삭제에 실패했습니다')
      }
    } catch (error) {
      alert('오류가 발생했습니다')
    }

    setLoading(false)
  }

  // 코드 복사
  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      alert('코드가 복사되었습니다!')
    } catch (error) {
      alert('복사에 실패했습니다')
    }
  }

  // 코드 상태 확인
  const getCodeStatus = (code: InviteCode) => {
    if (!code.isActive) return { status: 'inactive', text: '비활성', color: 'gray' }
    if (code.expiresAt && code.expiresAt < new Date()) return { status: 'expired', text: '만료', color: 'red' }
    if (code.currentUses >= code.maxUses) return { status: 'exhausted', text: '소진', color: 'orange' }
    return { status: 'active', text: '활성', color: 'green' }
  }

  return (
    <div className="min-h-screen bg-[#f9fafb] p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-[#e5e8eb] pb-6">
          <div className="text-center flex-1">
            <h1 className="text-[32px] font-bold text-[#191f28] mb-2">초대 코드 관리</h1>
            <p className="text-[16px] text-[#6b7280]">회원가입 초대 코드 생성 및 관리</p>
          </div>
          <Button
            variant="primary"
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="ml-4"
          >
            <Plus className="w-4 h-4 mr-2" />
            코드 생성
          </Button>
        </div>

        {/* 통계 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KpiCard
            label="전체 코드"
            value={stats.total}
            unit="개"
            icon={<Code className="w-4 h-4" />}
            color="blue"
          />
          <KpiCard
            label="활성 코드"
            value={stats.active}
            unit="개"
            icon={<CheckCircle className="w-4 h-4" />}
            color="green"
          />
          <KpiCard
            label="사용된 코드"
            value={stats.used}
            unit="개"
            icon={<User className="w-4 h-4" />}
            color="yellow"
          />
          <KpiCard
            label="만료된 코드"
            value={stats.expired}
            unit="개"
            icon={<Clock className="w-4 h-4" />}
            color="red"
          />
        </div>

        {/* 코드 생성 폼 */}
        {showCreateForm && (
          <SectionCard title="새 초대 코드 생성" description="회원가입용 초대 코드를 생성합니다">
            <form onSubmit={createInviteCode} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-medium text-[#4e5968] mb-2">
                    대상 치과
                  </label>
                  <select
                    value={newCode.clinicId}
                    onChange={(e) => setNewCode({ ...newCode, clinicId: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-[#e5e8eb] text-[14px] focus:outline-none focus:border-[#3182f6] focus:ring-2 focus:ring-[#ebf3fe]"
                    required
                  >
                    {clinics.map(clinic => (
                      <option key={clinic.id} value={clinic.id}>
                        {clinic.name} ({clinic.code})
                      </option>
                    ))}
                  </select>
                  {clinics.length === 0 && (
                    <p className="text-[12px] text-[#f04452] mt-1">
                      등록된 치과가 없습니다. 먼저 치과를 생성해주세요.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[13px] font-medium text-[#4e5968] mb-2">
                    최대 사용 횟수
                  </label>
                  <input
                    type="number"
                    value={newCode.maxUses}
                    onChange={(e) => setNewCode({ ...newCode, maxUses: parseInt(e.target.value) })}
                    min="1"
                    max="100"
                    className="w-full px-4 py-3 rounded-xl border border-[#e5e8eb] text-[14px] focus:outline-none focus:border-[#3182f6] focus:ring-2 focus:ring-[#ebf3fe]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-medium text-[#4e5968] mb-2">
                    만료 기간 (개월)
                  </label>
                  <select
                    value={newCode.expiresInMonths}
                    onChange={(e) => setNewCode({ ...newCode, expiresInMonths: parseInt(e.target.value) })}
                    className="w-full px-4 py-3 rounded-xl border border-[#e5e8eb] text-[14px] focus:outline-none focus:border-[#3182f6] focus:ring-2 focus:ring-[#ebf3fe]"
                    required
                  >
                    <option value={1}>1개월</option>
                    <option value={3}>3개월</option>
                    <option value={6}>6개월</option>
                    <option value={12}>12개월 (1년)</option>
                    <option value={24}>24개월 (2년)</option>
                    <option value={36}>36개월 (3년)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[13px] font-medium text-[#4e5968] mb-2">
                    설명 (선택사항)
                  </label>
                  <input
                    type="text"
                    value={newCode.description}
                    onChange={(e) => setNewCode({ ...newCode, description: e.target.value })}
                    placeholder="예: 신규 파트너용"
                    className="w-full px-4 py-3 rounded-xl border border-[#e5e8eb] text-[14px] focus:outline-none focus:border-[#3182f6] focus:ring-2 focus:ring-[#ebf3fe]"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="submit" variant="primary" loading={loading}>
                  코드 생성
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowCreateForm(false)}
                >
                  취소
                </Button>
              </div>
            </form>
          </SectionCard>
        )}

        {/* 코드 목록 */}
        <SectionCard title={`초대 코드 목록 (${codes.length}개)`} description="생성된 모든 초대 코드">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[#f2f4f6]">
                  <th className="text-left py-3 px-3 text-[#8b95a1] font-medium">코드</th>
                  <th className="text-left py-3 px-3 text-[#8b95a1] font-medium">치과</th>
                  <th className="text-left py-3 px-3 text-[#8b95a1] font-medium">상태</th>
                  <th className="text-left py-3 px-3 text-[#8b95a1] font-medium">사용 현황</th>
                  <th className="text-left py-3 px-3 text-[#8b95a1] font-medium">만료일</th>
                  <th className="text-left py-3 px-3 text-[#8b95a1] font-medium">생성자</th>
                  <th className="text-left py-3 px-3 text-[#8b95a1] font-medium">작업</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((code) => {
                  const status = getCodeStatus(code)

                  return (
                    <tr key={code.id} className="border-b border-[#f9fafb] hover:bg-[#f9fafb]">
                      {/* 코드 */}
                      <td className="py-4 px-3">
                        <div className="flex items-center gap-2">
                          <code className="bg-[#f9fafb] px-2 py-1 rounded font-mono text-[16px] font-bold">
                            {code.code}
                          </code>
                          <button
                            onClick={() => copyCode(code.code)}
                            className="p-1 hover:bg-[#e5e8eb] rounded"
                            title="코드 복사"
                          >
                            <Copy className="w-4 h-4 text-[#6b7684]" />
                          </button>
                        </div>
                        {code.description && (
                          <div className="text-[#8b95a1] text-[12px] mt-1">{code.description}</div>
                        )}
                      </td>

                      {/* 치과 */}
                      <td className="py-4 px-3">
                        <div className="font-medium text-[#191f28]">{code.clinic.name}</div>
                        <div className="text-[#6b7684] text-[12px]">{code.clinic.code}</div>
                      </td>

                      {/* 상태 */}
                      <td className="py-4 px-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[12px] font-medium ${
                          status.color === 'green' ? 'bg-green-100 text-green-700' :
                          status.color === 'red' ? 'bg-red-100 text-red-700' :
                          status.color === 'orange' ? 'bg-orange-100 text-orange-700' :
                          status.color === 'gray' ? 'bg-gray-100 text-gray-700' : ''
                        }`}>
                          {status.color === 'green' && <CheckCircle className="w-3 h-3" />}
                          {status.color === 'red' && <XCircle className="w-3 h-3" />}
                          {status.color === 'orange' && <Clock className="w-3 h-3" />}
                          {status.color === 'gray' && <XCircle className="w-3 h-3" />}
                          {status.text}
                        </span>
                      </td>

                      {/* 사용 현황 */}
                      <td className="py-4 px-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono">{code.currentUses}/{code.maxUses}</span>
                          {code.users.length > 0 && (
                            <span className="text-[#6b7684] text-[12px]">
                              ({code.users.length}명 가입)
                            </span>
                          )}
                        </div>
                        {code.usedAt && (
                          <div className="text-[#8b95a1] text-[12px] mt-1">
                            마지막 사용: {new Date(code.usedAt).toLocaleDateString('ko-KR')}
                          </div>
                        )}
                      </td>

                      {/* 만료일 */}
                      <td className="py-4 px-3">
                        {code.expiresAt ? (
                          <div className={`text-[12px] ${
                            code.expiresAt < new Date() ? 'text-red-600 font-medium' : 'text-[#6b7684]'
                          }`}>
                            {new Date(code.expiresAt).toLocaleDateString('ko-KR')}
                          </div>
                        ) : (
                          <span className="text-[#8b95a1]">무제한</span>
                        )}
                      </td>

                      {/* 생성자 */}
                      <td className="py-4 px-3">
                        <div className="text-[#191f28]">{code.creator.name}</div>
                        <div className="text-[#6b7684] text-[12px]">
                          {new Date(code.createdAt).toLocaleDateString('ko-KR')}
                        </div>
                      </td>

                      {/* 작업 */}
                      <td className="py-4 px-3">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant={code.isActive ? "secondary" : "primary"}
                            onClick={() => toggleCodeStatus(code.id, !code.isActive)}
                            disabled={loading}
                          >
                            {code.isActive ? '비활성화' : '활성화'}
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => deleteCode(code.id)}
                            disabled={loading || code.currentUses > 0}
                            className="text-red-600 border-red-200 hover:bg-red-50"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {codes.length === 0 && (
              <div className="text-center py-12 text-[#8b95a1]">
                생성된 초대 코드가 없습니다.
              </div>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
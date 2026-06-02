"use client"

import { useState } from "react"
import { UserRole, UserStatus } from "@prisma/client"
import { CheckCircle, XCircle, Clock, Users, Shield, Crown, Building2, Mail, Calendar, Code } from "lucide-react"
import Button from "@/components/ui/Button"
import SectionCard from "@/components/ui/SectionCard"
import KpiCard from "@/components/ui/KpiCard"

type User = {
  id: string
  email: string
  name: string
  role: UserRole
  status: UserStatus
  inviteCodeId: string | null
  approvedAt: Date | null
  createdAt: Date
  agency: {
    id: string
    name: string
    slug: string
  }
  inviteCode?: {
    id: string
    code: string
    description: string | null
  } | null
}

interface UsersManagementClientProps {
  initialUsers: User[]
  stats: {
    total: number
    pending: number
    approved: number
    rejected: number
    master: number
  }
}

export default function UsersManagementClient({
  initialUsers,
  stats
}: UsersManagementClientProps) {
  const [users, setUsers] = useState<User[]>(initialUsers)
  const [loading, setLoading] = useState<string | null>(null)
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL')

  // 사용자 상태 업데이트
  const updateUserStatus = async (userId: string, newStatus: UserStatus) => {
    setLoading(userId)

    try {
      const response = await fetch('/api/admin/users/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, status: newStatus })
      })

      if (response.ok) {
        setUsers(users.map(user =>
          user.id === userId
            ? { ...user, status: newStatus, approvedAt: newStatus === 'APPROVED' ? new Date() : null }
            : user
        ))
      } else {
        alert('상태 업데이트에 실패했습니다')
      }
    } catch (error) {
      alert('오류가 발생했습니다')
    }

    setLoading(null)
  }

  // 사용자 역할 업데이트
  const updateUserRole = async (userId: string, newRole: UserRole) => {
    if (newRole === 'MASTER') {
      if (!confirm('정말로 이 사용자를 마스터로 변경하시겠습니까?')) return
    }

    setLoading(userId)

    try {
      const response = await fetch('/api/admin/users/update-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole })
      })

      if (response.ok) {
        setUsers(users.map(user =>
          user.id === userId ? { ...user, role: newRole } : user
        ))
      } else {
        alert('역할 업데이트에 실패했습니다')
      }
    } catch (error) {
      alert('오류가 발생했습니다')
    }

    setLoading(null)
  }

  // 필터링된 사용자 목록
  const filteredUsers = users.filter(user => {
    if (filter === 'ALL') return true
    return user.status === filter
  })

  // 상태별 색상 및 아이콘
  const getStatusConfig = (status: UserStatus) => {
    switch (status) {
      case 'PENDING':
        return { icon: <Clock className="w-4 h-4" />, color: 'yellow', text: '대기중' }
      case 'APPROVED':
        return { icon: <CheckCircle className="w-4 h-4" />, color: 'green', text: '승인됨' }
      case 'REJECTED':
        return { icon: <XCircle className="w-4 h-4" />, color: 'red', text: '거부됨' }
    }
  }

  // 역할별 색상 및 아이콘
  const getRoleConfig = (role: UserRole) => {
    switch (role) {
      case 'MASTER':
        return { icon: <Crown className="w-4 h-4" />, color: 'purple', text: '마스터' }
      case 'ADMIN':
        return { icon: <Shield className="w-4 h-4" />, color: 'blue', text: '관리자' }
      case 'ANALYST':
        return { icon: <Building2 className="w-4 h-4" />, color: 'green', text: '분석가' }
      case 'VIEWER':
        return { icon: <Users className="w-4 h-4" />, color: 'gray', text: '뷰어' }
    }
  }

  return (
    <div className="min-h-screen bg-[#f9fafb] p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 헤더 */}
        <div className="text-center border-b border-[#e5e8eb] pb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-black rounded-xl mb-4">
            <span className="text-[18px] font-bold text-white">T</span>
          </div>
          <h1 className="text-[32px] font-bold text-[#191f28] mb-2">사용자 관리</h1>
          <p className="text-[16px] text-[#6b7280]">THINKLAB dental insight 사용자 관리 시스템</p>
        </div>

        {/* 통계 */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <KpiCard
            label="전체 사용자"
            value={stats.total}
            unit="명"
            icon={<Users className="w-4 h-4" />}
            color="blue"
          />
          <KpiCard
            label="승인 대기"
            value={stats.pending}
            unit="명"
            icon={<Clock className="w-4 h-4" />}
            color="yellow"
          />
          <KpiCard
            label="승인됨"
            value={stats.approved}
            unit="명"
            icon={<CheckCircle className="w-4 h-4" />}
            color="green"
          />
          <KpiCard
            label="거부됨"
            value={stats.rejected}
            unit="명"
            icon={<XCircle className="w-4 h-4" />}
            color="red"
          />
          <KpiCard
            label="마스터 계정"
            value={stats.master}
            unit="명"
            icon={<Crown className="w-4 h-4" />}
            color="blue"
          />
        </div>

        {/* 필터 탭 */}
        <div className="flex space-x-2 bg-white p-1 rounded-xl border border-[#e5e8eb]">
          {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-all ${
                filter === status
                  ? 'bg-[#3182f6] text-white'
                  : 'text-[#6b7280] hover:text-[#191f28] hover:bg-[#f9fafb]'
              }`}
            >
              {status === 'ALL' ? '전체' :
               status === 'PENDING' ? '대기중' :
               status === 'APPROVED' ? '승인됨' : '거부됨'}
            </button>
          ))}
        </div>

        {/* 사용자 목록 */}
        <SectionCard title={`사용자 목록 (${filteredUsers.length}명)`} description="계정 상태 및 역할 관리">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[#f2f4f6]">
                  <th className="text-left py-3 px-3 text-[#8b95a1] font-medium">사용자</th>
                  <th className="text-left py-3 px-3 text-[#8b95a1] font-medium">에이전시</th>
                  <th className="text-left py-3 px-3 text-[#8b95a1] font-medium">상태</th>
                  <th className="text-left py-3 px-3 text-[#8b95a1] font-medium">역할</th>
                  <th className="text-left py-3 px-3 text-[#8b95a1] font-medium">초대코드</th>
                  <th className="text-left py-3 px-3 text-[#8b95a1] font-medium">가입일</th>
                  <th className="text-left py-3 px-3 text-[#8b95a1] font-medium">작업</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => {
                  const statusConfig = getStatusConfig(user.status)
                  const roleConfig = getRoleConfig(user.role)

                  return (
                    <tr key={user.id} className="border-b border-[#f9fafb] hover:bg-[#f9fafb]">
                      {/* 사용자 정보 */}
                      <td className="py-4 px-3">
                        <div>
                          <div className="font-semibold text-[#191f28]">{user.name}</div>
                          <div className="text-[#6b7684] flex items-center mt-1">
                            <Mail className="w-3 h-3 mr-1" />
                            {user.email}
                          </div>
                        </div>
                      </td>

                      {/* 에이전시 */}
                      <td className="py-4 px-3">
                        <div className="font-medium text-[#191f28]">{user.agency.name}</div>
                        <div className="text-[#6b7684] text-[12px]">{user.agency.slug}</div>
                      </td>

                      {/* 상태 */}
                      <td className="py-4 px-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[12px] font-medium ${
                          statusConfig.color === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                          statusConfig.color === 'green' ? 'bg-green-100 text-green-700' :
                          statusConfig.color === 'red' ? 'bg-red-100 text-red-700' : ''
                        }`}>
                          {statusConfig.icon}
                          {statusConfig.text}
                        </span>
                      </td>

                      {/* 역할 */}
                      <td className="py-4 px-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[12px] font-medium ${
                          roleConfig.color === 'purple' ? 'bg-purple-100 text-purple-700' :
                          roleConfig.color === 'blue' ? 'bg-blue-100 text-blue-700' :
                          roleConfig.color === 'green' ? 'bg-green-100 text-green-700' :
                          roleConfig.color === 'gray' ? 'bg-gray-100 text-gray-700' : ''
                        }`}>
                          {roleConfig.icon}
                          {roleConfig.text}
                        </span>
                      </td>

                      {/* 초대 코드 */}
                      <td className="py-4 px-3">
                        {user.inviteCode ? (
                          <span className="inline-flex items-center gap-1 text-[12px] text-[#6b7684] bg-[#f9fafb] px-2 py-1 rounded">
                            <Code className="w-3 h-3" />
                            {user.inviteCode.code}
                          </span>
                        ) : (
                          <span className="text-[#b0b8c1]">—</span>
                        )}
                      </td>

                      {/* 가입일 */}
                      <td className="py-4 px-3">
                        <div className="flex items-center text-[#6b7684]">
                          <Calendar className="w-3 h-3 mr-1" />
                          {new Date(user.createdAt).toLocaleDateString('ko-KR')}
                        </div>
                        {user.approvedAt && (
                          <div className="text-[11px] text-[#8b95a1] mt-1">
                            승인: {new Date(user.approvedAt).toLocaleDateString('ko-KR')}
                          </div>
                        )}
                      </td>

                      {/* 작업 */}
                      <td className="py-4 px-3">
                        <div className="flex gap-2">
                          {user.status === 'PENDING' && (
                            <>
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => updateUserStatus(user.id, 'APPROVED')}
                                loading={loading === user.id}
                              >
                                승인
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => updateUserStatus(user.id, 'REJECTED')}
                                loading={loading === user.id}
                              >
                                거부
                              </Button>
                            </>
                          )}

                          {user.status === 'REJECTED' && (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => updateUserStatus(user.id, 'APPROVED')}
                              loading={loading === user.id}
                            >
                              승인
                            </Button>
                          )}

                          {user.status === 'APPROVED' && user.role !== 'MASTER' && (
                            <select
                              value={user.role}
                              onChange={(e) => updateUserRole(user.id, e.target.value as UserRole)}
                              className="text-[12px] border border-[#e5e8eb] rounded px-2 py-1"
                              disabled={loading === user.id}
                            >
                              <option value="ADMIN">관리자</option>
                              <option value="ANALYST">분석가</option>
                              <option value="VIEWER">뷰어</option>
                              <option value="MASTER">마스터</option>
                            </select>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {filteredUsers.length === 0 && (
              <div className="text-center py-12 text-[#8b95a1]">
                표시할 사용자가 없습니다.
              </div>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
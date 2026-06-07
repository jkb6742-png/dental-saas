"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { redirect } from "next/navigation"
import Button from "@/components/ui/Button"
import { Target, Calendar, DollarSign, Users, Edit2, Save, X, ArrowLeft, Home, Plus } from "lucide-react"

type Clinic = {
  id: string
  name: string
  code: string
}

type Goal = {
  id: string
  clinicId: string
  year: number
  month: number
  revenueGoal?: number
  newPatientGoal?: number
  description?: string
  createdAt: string
}

export default function GoalsManagementPage() {
  const { data: session, status } = useSession()
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedClinicId, setSelectedClinicId] = useState<string>("")
  const [activeYear, setActiveYear] = useState(new Date().getFullYear())
  const [editingMonth, setEditingMonth] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    revenueGoal: "",
    newPatientGoal: "",
    description: "",
  })

  const currentDate = new Date()

  // 선택된 연도의 12개월 데이터 생성
  const generateMonths = () => {
    const months = []
    for (let month = 1; month <= 12; month++) {
      months.push({
        year: activeYear,
        month: month,
        key: `${activeYear}-${month}`
      })
    }
    return months
  }

  const months = generateMonths()

  // 사용 가능한 연도 목록 (2025년부터 현재 연도+1까지)
  const availableYears: number[] = []
  for (let year = 2025; year <= currentDate.getFullYear() + 1; year++) {
    availableYears.push(year)
  }

  // 권한 확인
  useEffect(() => {
    if (status === "loading") return
    if (!session) {
      redirect("/login")
      return
    }

    const userRole = (session.user as any).role
    if (!['MASTER', 'ADMIN'].includes(userRole)) {
      redirect("/dashboard")
      return
    }
  }, [session, status])

  // 치과 목록 조회
  useEffect(() => {
    const fetchClinics = async () => {
      try {
        const response = await fetch('/api/clinics')
        if (response.ok) {
          const clinicsData = await response.json()
          setClinics(clinicsData)
          if (clinicsData.length > 0 && !selectedClinicId) {
            setSelectedClinicId(clinicsData[0].id)
          }
        }
      } catch (error) {
        console.error('치과 목록 조회 실패:', error)
      }
    }

    if (session) {
      fetchClinics()
    }
  }, [session])

  // 목표 데이터 조회
  const fetchGoals = async () => {
    if (!selectedClinicId) return

    try {
      setLoading(true)
      const response = await fetch(`/api/goals?clinicId=${selectedClinicId}&year=${activeYear}`)
      if (response.ok) {
        const data = await response.json()
        setGoals(data.goals || [])
      }
    } catch (error) {
      console.error('목표 조회 실패:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchGoals()
  }, [selectedClinicId, activeYear])

  const getGoalData = (year: number, month: number) => {
    return goals.find(g => g.year === year && g.month === month)
  }

  const startEditing = (year: number, month: number) => {
    const monthKey = `${year}-${month}`
    const data = getGoalData(year, month)

    setEditingMonth(monthKey)
    setEditForm({
      revenueGoal: data?.revenueGoal?.toString() || "",
      newPatientGoal: data?.newPatientGoal?.toString() || "",
      description: data?.description || "",
    })
  }

  const cancelEditing = () => {
    setEditingMonth(null)
    setEditForm({ revenueGoal: "", newPatientGoal: "", description: "" })
  }

  const saveGoal = async (year: number, month: number) => {
    try {
      const revenueGoal = parseInt(editForm.revenueGoal) || null
      const newPatientGoal = parseInt(editForm.newPatientGoal) || null
      const description = editForm.description.trim() || null

      // 모든 값이 비어있으면 삭제
      if (!revenueGoal && !newPatientGoal && !description) {
        const existingGoal = getGoalData(year, month)
        if (existingGoal) {
          const response = await fetch(`/api/goals?goalId=${existingGoal.id}`, {
            method: 'DELETE'
          })
          if (response.ok) {
            await fetchGoals()
            cancelEditing()
          }
        } else {
          cancelEditing()
        }
        return
      }

      const requestData = {
        clinicId: selectedClinicId,
        year,
        month,
        revenueGoal,
        newPatientGoal,
        description
      }

      const response = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestData),
      })

      if (response.ok) {
        await fetchGoals()
        cancelEditing()
      } else {
        const error = await response.json()
        alert(`저장 실패: ${error.error}`)
      }
    } catch (error) {
      alert("저장 중 오류가 발생했습니다.")
    }
  }

  const addYear = async () => {
    const newYear = Math.max(...availableYears) + 1
    availableYears.push(newYear)
    setActiveYear(newYear)
  }

  const formatAmount = (amount: number) => {
    if (amount >= 100000000) {
      return `${Math.floor(amount / 100000000)}억${Math.floor((amount % 100000000) / 10000000) > 0 ? Math.floor((amount % 100000000) / 10000000) + '천' : ''}만원`
    } else if (amount >= 10000000) {
      return `${Math.floor(amount / 10000000)}천만원`
    } else if (amount >= 10000) {
      return `${Math.floor(amount / 10000)}만원`
    } else {
      return `${amount.toLocaleString()}원`
    }
  }

  if (status === "loading") {
    return <div className="flex justify-center items-center h-64">로딩 중...</div>
  }

  if (loading) {
    return <div className="text-center py-8">데이터를 불러오는 중...</div>
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {/* 내비게이션 버튼들 */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => window.history.back()}
              className="flex items-center space-x-1 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title="뒤로가기"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">뒤로</span>
            </button>
            <button
              onClick={() => window.location.href = '/dashboard'}
              className="flex items-center space-x-1 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title="홈으로"
            >
              <Home className="w-4 h-4" />
              <span className="text-sm">홈</span>
            </button>
          </div>
          {/* 제목 */}
          <div className="flex items-center space-x-3 border-l border-gray-300 pl-4">
            <Target className="w-6 h-6 text-blue-600" />
            <div>
              <h3 className="text-lg font-semibold">목표 관리</h3>
              <p className="text-sm text-gray-600">월별 매출 및 신환 목표 설정</p>
            </div>
          </div>
        </div>
      </div>

      {/* 치과 선택 */}
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">치과 선택</label>
            <select
              value={selectedClinicId}
              onChange={(e) => setSelectedClinicId(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">치과를 선택하세요</option>
              {clinics.map(clinic => (
                <option key={clinic.id} value={clinic.id}>
                  {clinic.name} ({clinic.code})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {selectedClinicId && (
        <>
          {/* 연도 탭 */}
          <div className="flex items-center justify-between">
            <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
              {availableYears.map(year => (
                <button
                  key={year}
                  onClick={() => setActiveYear(year)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeYear === year
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {year}년
                </button>
              ))}
            </div>
            <Button
              onClick={addYear}
              variant="secondary"
              className="flex items-center space-x-1"
            >
              <Plus className="w-4 h-4" />
              <span>연도 추가</span>
            </Button>
          </div>

          {/* 월별 목표 테이블 */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-2 font-medium text-gray-700">월</th>
                    <th className="text-center py-3 px-2 font-medium text-gray-700">매출 목표</th>
                    <th className="text-center py-3 px-2 font-medium text-gray-700">신환 목표</th>
                    <th className="text-center py-3 px-2 font-medium text-gray-700">설명</th>
                    <th className="text-center py-3 px-2 font-medium text-gray-700">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {months.map(({ year, month, key }) => {
                    const data = getGoalData(year, month)
                    const isEditing = editingMonth === key
                    const isCurrentMonth = activeYear === currentDate.getFullYear() && month === currentDate.getMonth() + 1

                    return (
                      <tr key={key} className={`border-b border-gray-100 hover:bg-gray-50 ${isCurrentMonth ? 'bg-blue-50' : ''}`}>
                        <td className="py-3 px-2">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{year}.{String(month).padStart(2, '0')}</span>
                            {isCurrentMonth && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">현재</span>
                            )}
                          </div>
                        </td>

                        <td className="text-center py-3 px-2">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editForm.revenueGoal}
                              onChange={(e) => setEditForm(prev => ({ ...prev, revenueGoal: e.target.value }))}
                              className="w-24 px-2 py-1 text-center border border-gray-300 rounded text-sm"
                              placeholder="목표 금액"
                            />
                          ) : (
                            <div className="flex items-center justify-center space-x-1">
                              {data?.revenueGoal ? (
                                <>
                                  <DollarSign className="w-3 h-3 text-green-500" />
                                  <span className="font-medium text-green-600">
                                    {formatAmount(data.revenueGoal)}
                                  </span>
                                </>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="text-center py-3 px-2">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editForm.newPatientGoal}
                              onChange={(e) => setEditForm(prev => ({ ...prev, newPatientGoal: e.target.value }))}
                              className="w-16 px-2 py-1 text-center border border-gray-300 rounded text-sm"
                              placeholder="신환"
                            />
                          ) : (
                            <div className="flex items-center justify-center space-x-1">
                              {data?.newPatientGoal ? (
                                <>
                                  <Users className="w-3 h-3 text-blue-500" />
                                  <span className="font-medium text-blue-600">
                                    {data.newPatientGoal}명
                                  </span>
                                </>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="text-center py-3 px-2">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editForm.description}
                              onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                              className="w-32 px-2 py-1 text-center border border-gray-300 rounded text-sm"
                              placeholder="설명"
                            />
                          ) : (
                            <span className="text-xs text-gray-600 max-w-32 truncate">
                              {data?.description || "—"}
                            </span>
                          )}
                        </td>

                        <td className="text-center py-3 px-2">
                          {isEditing ? (
                            <div className="flex items-center justify-center space-x-1">
                              <button
                                onClick={() => saveGoal(year, month)}
                                className="p-1 text-green-600 hover:bg-green-100 rounded"
                                title="저장"
                              >
                                <Save className="w-3 h-3" />
                              </button>
                              <button
                                onClick={cancelEditing}
                                className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                                title="취소"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => startEditing(year, month)}
                              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                              title="편집"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* 요약 통계 */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-green-700">
                  {goals.filter(g => g.year === activeYear && g.revenueGoal).length}
                </div>
                <div className="text-xs text-green-600">매출 목표 설정 월</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-blue-700">
                  {goals.filter(g => g.year === activeYear && g.newPatientGoal).length}
                </div>
                <div className="text-xs text-blue-600">신환 목표 설정 월</div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-yellow-700">
                  {formatAmount(goals.filter(g => g.year === activeYear && g.revenueGoal).reduce((sum, g) => sum + (g.revenueGoal || 0), 0))}
                </div>
                <div className="text-xs text-yellow-600">{activeYear}년 총 매출 목표</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-purple-700">
                  {goals.filter(g => g.year === activeYear && g.newPatientGoal).reduce((sum, g) => sum + (g.newPatientGoal || 0), 0)}명
                </div>
                <div className="text-xs text-purple-600">{activeYear}년 총 신환 목표</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
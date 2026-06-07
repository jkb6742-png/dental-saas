"use client"

import { useState } from "react"
import { Target, Calendar, FileText, Plus, Edit, Trash2, Filter, CheckCircle, Clock, PlayCircle, Paperclip, MessageSquare, Send, User, Download } from "lucide-react"

interface ActionPlan {
  id: string
  goal: string
  targetDate: Date
  description: string
  status: "시작전" | "진행중" | "완료"
  createdAt: Date
  progress: number
  priority: "상" | "중" | "하"
  attachments: Attachment[]
  comments: Comment[]
}

interface Attachment {
  id: string
  name: string
  size: number
  type: string
  uploadedAt: Date
  url: string
}

interface Comment {
  id: string
  content: string
  author: string
  authorRole: "MASTER" | "CLINIC"
  createdAt: Date
}

interface ActionPlansClientProps {
  clinicId: string
  actionPlans: ActionPlan[]
  userRole?: string
}

export default function ActionPlansClient({
  clinicId,
  actionPlans: initialActionPlans,
  userRole
}: ActionPlansClientProps) {
  const isMaster = userRole === 'MASTER'
  const [actionPlans, setActionPlans] = useState<ActionPlan[]>(initialActionPlans)
  const [selectedStatus, setSelectedStatus] = useState<string>("전체")
  const [selectedPriority, setSelectedPriority] = useState<string>("전체")
  const [selectedDeadline, setSelectedDeadline] = useState<string>("전체")
  const [selectedProgress, setSelectedProgress] = useState<string>("전체")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<ActionPlan | null>(null)
  const [selectedPlan, setSelectedPlan] = useState<ActionPlan | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  const [formData, setFormData] = useState({
    goal: "",
    targetDate: "",
    description: "",
    status: "시작전" as ActionPlan["status"],
    priority: "중" as ActionPlan["priority"],
    attachments: [] as File[]
  })

  const [newComment, setNewComment] = useState("")

  const statusOptions = ["전체", "시작전", "진행중", "완료"]
  const priorityOptions = ["전체", "상", "중", "하"]
  const deadlineOptions = ["전체", "이번 주", "이번 달", "다음 달", "3개월 이내", "기한 초과"]
  const progressOptions = ["전체", "시작 안함 (0%)", "진행 초기 (1-30%)", "진행 중반 (31-70%)", "거의 완료 (71-99%)", "완료 (100%)"]

  const isWithinDeadline = (plan: ActionPlan, deadline: string) => {
    const now = new Date()
    const targetDate = plan.targetDate
    const diffTime = targetDate.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    switch (deadline) {
      case "이번 주": return diffDays <= 7 && diffDays >= 0
      case "이번 달": return diffDays <= 30 && diffDays >= 0
      case "다음 달": return diffDays > 30 && diffDays <= 60
      case "3개월 이내": return diffDays <= 90 && diffDays >= 0
      case "기한 초과": return diffDays < 0
      default: return true
    }
  }

  const isWithinProgress = (plan: ActionPlan, progressRange: string) => {
    const progress = plan.progress
    switch (progressRange) {
      case "시작 안함 (0%)": return progress === 0
      case "진행 초기 (1-30%)": return progress >= 1 && progress <= 30
      case "진행 중반 (31-70%)": return progress >= 31 && progress <= 70
      case "거의 완료 (71-99%)": return progress >= 71 && progress <= 99
      case "완료 (100%)": return progress === 100
      default: return true
    }
  }

  const filteredPlans = actionPlans
    .filter(plan => selectedStatus === "전체" || plan.status === selectedStatus)
    .filter(plan => selectedPriority === "전체" || plan.priority === selectedPriority)
    .filter(plan => selectedDeadline === "전체" || isWithinDeadline(plan, selectedDeadline))
    .filter(plan => selectedProgress === "전체" || isWithinProgress(plan, selectedProgress))
    .sort((a, b) => {
      // 우선순위 정렬: 상 > 중 > 하
      const priorityOrder = { "상": 1, "중": 2, "하": 3 }
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    })

  const getStatusIcon = (status: ActionPlan["status"]) => {
    switch (status) {
      case "시작전": return <Clock className="w-4 h-4 text-gray-600" />
      case "진행중": return <PlayCircle className="w-4 h-4 text-blue-600" />
      case "완료": return <CheckCircle className="w-4 h-4 text-green-600" />
    }
  }

  const getStatusColor = (status: ActionPlan["status"]) => {
    switch (status) {
      case "시작전": return "bg-gray-100 text-gray-700 border-gray-200"
      case "진행중": return "bg-blue-100 text-blue-700 border-blue-200"
      case "완료": return "bg-green-100 text-green-700 border-green-200"
    }
  }

  const getPriorityColor = (priority: ActionPlan["priority"]) => {
    switch (priority) {
      case "상": return "bg-red-500 text-white"
      case "중": return "bg-yellow-500 text-white"
      case "하": return "bg-green-500 text-white"
    }
  }

  const getPriorityIcon = (priority: ActionPlan["priority"]) => {
    switch (priority) {
      case "상": return "🔥"
      case "중": return "⚡"
      case "하": return "📋"
    }
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatDateTime = (date: Date) => {
    return new Date(date).toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setFormData({...formData, attachments: files})
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (editingPlan) {
      // 수정
      setActionPlans(plans => plans.map(plan =>
        plan.id === editingPlan.id
          ? {
              ...plan,
              goal: formData.goal,
              targetDate: new Date(formData.targetDate),
              description: formData.description,
              status: formData.status,
              priority: formData.priority,
              // 실제로는 서버에 파일을 업로드하고 URL을 받아와야 합니다
              attachments: [
                ...plan.attachments,
                ...formData.attachments.map((file, index) => ({
                  id: `${Date.now()}-${index}`,
                  name: file.name,
                  size: file.size,
                  type: file.type,
                  uploadedAt: new Date(),
                  url: `#${file.name}` // Mock URL
                }))
              ]
            }
          : plan
      ))
    } else {
      // 새로 추가
      const newPlan: ActionPlan = {
        id: Date.now().toString(),
        goal: formData.goal,
        targetDate: new Date(formData.targetDate),
        description: formData.description,
        status: formData.status,
        createdAt: new Date(),
        progress: formData.status === "완료" ? 100 : formData.status === "진행중" ? 30 : 0,
        priority: formData.priority,
        attachments: formData.attachments.map((file, index) => ({
          id: `${Date.now()}-${index}`,
          name: file.name,
          size: file.size,
          type: file.type,
          uploadedAt: new Date(),
          url: `#${file.name}` // Mock URL
        })),
        comments: []
      }
      setActionPlans([...actionPlans, newPlan])
    }

    // 폼 초기화
    setFormData({
      goal: "",
      targetDate: "",
      description: "",
      status: "시작전",
      priority: "중",
      attachments: []
    })
    setIsModalOpen(false)
    setEditingPlan(null)
  }

  const handleEdit = (plan: ActionPlan) => {
    setEditingPlan(plan)
    setFormData({
      goal: plan.goal,
      targetDate: plan.targetDate.toISOString().split('T')[0],
      description: plan.description,
      status: plan.status,
      priority: plan.priority,
      attachments: []
    })
    setIsModalOpen(true)
  }

  const handleDelete = (id: string) => {
    if (confirm("정말로 이 액션플랜을 삭제하시겠습니까?")) {
      setActionPlans(plans => plans.filter(plan => plan.id !== id))
    }
  }

  const openAddModal = () => {
    setEditingPlan(null)
    setFormData({
      goal: "",
      targetDate: "",
      description: "",
      status: "시작전",
      priority: "중",
      attachments: []
    })
    setIsModalOpen(true)
  }

  const openDetail = (plan: ActionPlan) => {
    setSelectedPlan(plan)
    setIsDetailOpen(true)
  }

  const addComment = (planId: string) => {
    if (!newComment.trim()) return

    const comment: Comment = {
      id: Date.now().toString(),
      content: newComment,
      author: isMaster ? "마스터 관리자" : "치과 원장", // 실제로는 세션에서 가져와야 함
      authorRole: isMaster ? "MASTER" : "CLINIC",
      createdAt: new Date()
    }

    setActionPlans(plans => plans.map(plan =>
      plan.id === planId
        ? { ...plan, comments: [...plan.comments, comment] }
        : plan
    ))

    if (selectedPlan?.id === planId) {
      setSelectedPlan({ ...selectedPlan, comments: [...selectedPlan.comments, comment] })
    }

    setNewComment("")
  }

  // 통계 계산
  const stats = {
    total: actionPlans.length,
    pending: actionPlans.filter(p => p.status === "시작전").length,
    inProgress: actionPlans.filter(p => p.status === "진행중").length,
    completed: actionPlans.filter(p => p.status === "완료").length
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30">
      <div className="space-y-6 p-6">
        {/* 헤더 */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl flex items-center justify-center">
                <Target className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">🎯 실행계획</h1>
                <p className="text-slate-600">
                  {isMaster
                    ? "목표 설정 및 실행 현황을 관리하세요"
                    : "실행계획을 확인하고 댓글로 소통하세요"
                  }
                </p>
              </div>
            </div>
            {isMaster && (
              <button
                onClick={openAddModal}
                className="px-4 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                새 계획 추가
              </button>
            )}
          </div>

          {/* 통계 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-5 h-5 text-slate-600" />
                <span className="text-sm font-medium text-slate-700">총 계획</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">{stats.total}개</div>
            </div>

            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">시작전</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{stats.pending}개</div>
            </div>

            <div className="bg-blue-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <PlayCircle className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium text-blue-700">진행중</span>
              </div>
              <div className="text-2xl font-bold text-blue-900">{stats.inProgress}개</div>
            </div>

            <div className="bg-green-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium text-green-700">완료</span>
              </div>
              <div className="text-2xl font-bold text-green-900">{stats.completed}개</div>
            </div>
          </div>
        </div>

        {/* 필터 */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-5 h-5 text-slate-600" />
              <span className="text-lg font-semibold text-slate-700">필터 옵션</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 상태 필터 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">실행 상태</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>

              {/* 우선순위 필터 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">우선순위</label>
                <select
                  value={selectedPriority}
                  onChange={(e) => setSelectedPriority(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {priorityOptions.map((priority) => (
                    <option key={priority} value={priority}>{priority}</option>
                  ))}
                </select>
              </div>

              {/* 기한 필터 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">목표 기한</label>
                <select
                  value={selectedDeadline}
                  onChange={(e) => setSelectedDeadline(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {deadlineOptions.map((deadline) => (
                    <option key={deadline} value={deadline}>{deadline}</option>
                  ))}
                </select>
              </div>

              {/* 진행률 필터 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">진행률</label>
                <select
                  value={selectedProgress}
                  onChange={(e) => setSelectedProgress(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {progressOptions.map((progress) => (
                    <option key={progress} value={progress}>{progress}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 필터 초기화 */}
            {(selectedStatus !== "전체" || selectedPriority !== "전체" || selectedDeadline !== "전체" || selectedProgress !== "전체") && (
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setSelectedStatus("전체")
                    setSelectedPriority("전체")
                    setSelectedDeadline("전체")
                    setSelectedProgress("전체")
                  }}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  모든 필터 초기화
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 액션플랜 목록 */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/60 p-6">
          <h3 className="text-xl font-bold text-slate-900 mb-6">액션플랜 목록</h3>

          {filteredPlans.length === 0 ? (
            <div className="text-center py-12">
              <Target className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600">
                {selectedStatus === "전체" ? "액션플랜이 없습니다." : `${selectedStatus} 상태의 액션플랜이 없습니다.`}
              </p>
              {isMaster ? (
                <p className="text-slate-500 text-sm">새로운 계획을 추가해보세요.</p>
              ) : (
                <p className="text-slate-500 text-sm">마스터 관리자가 계획을 추가하면 여기에 표시됩니다.</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPlans.map((plan) => (
                <div key={plan.id} className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-4 mb-4">
                    {/* 우선순위 표시 */}
                    <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${getPriorityColor(plan.priority)}`}>
                      <span title={`${plan.priority} 우선순위`}>
                        {getPriorityIcon(plan.priority)}
                      </span>
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4
                          className="text-lg font-semibold text-slate-900 cursor-pointer hover:text-purple-600 transition-colors"
                          onClick={() => openDetail(plan)}
                        >
                          {plan.goal}
                        </h4>
                        <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm border ${getStatusColor(plan.status)}`}>
                          {getStatusIcon(plan.status)}
                          {plan.status}
                        </div>
                      </div>
                      <p className="text-slate-600 mb-3">{plan.description}</p>

                      <div className="flex items-center gap-6 text-sm text-slate-500 mb-3">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>목표: {formatDate(plan.targetDate)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <FileText className="w-4 h-4" />
                          <span>생성: {formatDate(plan.createdAt)}</span>
                        </div>
                        {plan.attachments.length > 0 && (
                          <div className="flex items-center gap-1">
                            <Paperclip className="w-4 h-4" />
                            <span>첨부파일 {plan.attachments.length}개</span>
                          </div>
                        )}
                        {plan.comments.length > 0 && (
                          <div className="flex items-center gap-1">
                            <MessageSquare className="w-4 h-4" />
                            <span>댓글 {plan.comments.length}개</span>
                          </div>
                        )}
                      </div>

                      {plan.status === "진행중" && (
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-sm text-slate-600 mb-1">
                            <span>진행률</span>
                            <span>{plan.progress}%</span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-2">
                            <div
                              className="bg-blue-500 h-2 rounded-full transition-all"
                              style={{ width: `${plan.progress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => openDetail(plan)}
                        className="p-2 text-slate-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                        title="상세 보기"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                      {isMaster && (
                        <>
                          <button
                            onClick={() => handleEdit(plan)}
                            className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="수정"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(plan.id)}
                            className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 추가/수정 모달 */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-bold text-slate-900 mb-4">
                {editingPlan ? "액션플랜 수정" : "새 액션플랜 추가"}
              </h3>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">목표</label>
                    <input
                      type="text"
                      value={formData.goal}
                      onChange={(e) => setFormData({...formData, goal: e.target.value})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="달성하고자 하는 목표를 입력하세요"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">우선순위</label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({...formData, priority: e.target.value as ActionPlan["priority"]})}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      required
                    >
                      <option value="상">🔥 상 - 긴급/중요</option>
                      <option value="중">⚡ 중 - 보통</option>
                      <option value="하">📋 하 - 여유</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">목표 설정일자</label>
                  <input
                    type="date"
                    value={formData.targetDate}
                    onChange={(e) => setFormData({...formData, targetDate: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">상세내용</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 h-24 resize-none"
                    placeholder="목표 달성을 위한 상세한 계획을 입력하세요"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">실행현황</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value as ActionPlan["status"]})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="시작전">시작전</option>
                    <option value="진행중">진행중</option>
                    <option value="완료">완료</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">첨부파일</label>
                  <input
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
                  />
                  {formData.attachments.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {formData.attachments.map((file, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm text-slate-600">
                          <Paperclip className="w-3 h-3" />
                          <span>{file.name}</span>
                          <span className="text-slate-400">({formatFileSize(file.size)})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                  >
                    {editingPlan ? "수정" : "추가"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 상세 보기 모달 */}
        {isDetailOpen && selectedPlan && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold ${getPriorityColor(selectedPlan.priority)}`}>
                    {getPriorityIcon(selectedPlan.priority)}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{selectedPlan.goal}</h2>
                    <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm border ${getStatusColor(selectedPlan.status)} mt-2`}>
                      {getStatusIcon(selectedPlan.status)}
                      {selectedPlan.status}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setIsDetailOpen(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 왼쪽: 계획 정보 */}
                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-2">상세내용</h3>
                    <p className="text-slate-600">{selectedPlan.description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-500">목표일자</span>
                      <div className="font-medium">{formatDate(selectedPlan.targetDate)}</div>
                    </div>
                    <div>
                      <span className="text-slate-500">생성일자</span>
                      <div className="font-medium">{formatDate(selectedPlan.createdAt)}</div>
                    </div>
                  </div>

                  {selectedPlan.status === "진행중" && (
                    <div>
                      <div className="flex items-center justify-between text-sm text-slate-600 mb-2">
                        <span>진행률</span>
                        <span>{selectedPlan.progress}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-3">
                        <div
                          className="bg-blue-500 h-3 rounded-full transition-all"
                          style={{ width: `${selectedPlan.progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* 첨부파일 */}
                  {selectedPlan.attachments.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-3">첨부파일 ({selectedPlan.attachments.length})</h3>
                      <div className="space-y-2">
                        {selectedPlan.attachments.map((file) => (
                          <div key={file.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                            <Paperclip className="w-4 h-4 text-slate-500" />
                            <div className="flex-1">
                              <div className="font-medium text-sm">{file.name}</div>
                              <div className="text-xs text-slate-500">
                                {formatFileSize(file.size)} • {formatDateTime(file.uploadedAt)}
                              </div>
                            </div>
                            <button className="p-1 text-slate-500 hover:text-blue-600 transition-colors">
                              <Download className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 오른쪽: 댓글 */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-slate-900">댓글 ({selectedPlan.comments.length})</h3>

                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {selectedPlan.comments.map((comment) => (
                      <div key={comment.id} className="bg-slate-50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <User className="w-4 h-4 text-slate-500" />
                          <span className="font-medium text-sm">{comment.author}</span>
                          <span className={`text-xs px-2 py-1 rounded ${
                            comment.authorRole === "MASTER"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-blue-100 text-blue-700"
                          }`}>
                            {comment.authorRole === "MASTER" ? "마스터" : "치과"}
                          </span>
                          <span className="text-xs text-slate-500 ml-auto">
                            {formatDateTime(comment.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700">{comment.content}</p>
                      </div>
                    ))}
                  </div>

                  {/* 새 댓글 추가 */}
                  <div className="border-t pt-4">
                    <div className="flex gap-2">
                      <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="댓글을 입력하세요..."
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none h-20"
                      />
                      <button
                        onClick={() => addComment(selectedPlan.id)}
                        disabled={!newComment.trim()}
                        className="px-3 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
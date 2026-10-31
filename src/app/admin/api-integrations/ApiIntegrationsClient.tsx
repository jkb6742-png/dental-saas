"use client"

// =============================================================================
// API Integrations Client - GPT API 설정 관리 클라이언트
// =============================================================================

import React, { useState, useEffect } from "react"
import {
  Plus,
  Settings,
  TestTube,
  Star,
  StarOff,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  Clock,
  Edit2,
  Trash2,
  AlertTriangle
} from "lucide-react"

interface ApiIntegration {
  id: string
  provider: string
  name: string
  maskedApiKey: string
  model?: string
  isEnabled: boolean
  isDefault: boolean
  lastTestedAt?: string
  lastTestStatus?: string
  lastTestMessage?: string
  createdAt: string
  updatedAt: string
}

interface CreateFormData {
  provider: string
  name: string
  apiKey: string
  model: string
  isEnabled: boolean
  setAsDefault: boolean
}

export default function ApiIntegrationsClient() {
  const [integrations, setIntegrations] = useState<ApiIntegration[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createForm, setCreateForm] = useState<CreateFormData>({
    provider: "OPENAI",
    name: "",
    apiKey: "",
    model: "",
    isEnabled: true,
    setAsDefault: false
  })
  const [creating, setCreating] = useState(false)
  const [testing, setTesting] = useState<Record<string, boolean>>({})
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({})

  // 데이터 로드
  const loadIntegrations = async () => {
    try {
      const response = await fetch('/api/admin/api-integrations')
      if (response.ok) {
        const data = await response.json()
        setIntegrations(data.integrations || [])
      } else {
        console.error('API 통합 목록 로드 실패')
      }
    } catch (error) {
      console.error('API 통합 목록 로드 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadIntegrations()
  }, [])

  // 새로운 API 통합 생성
  const handleCreate = async () => {
    if (!createForm.name.trim() || !createForm.apiKey.trim()) {
      alert('이름과 API Key는 필수입니다.')
      return
    }

    setCreating(true)
    try {
      const response = await fetch('/api/admin/api-integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm)
      })

      const data = await response.json()

      if (response.ok) {
        alert(`✅ ${data.message}`)
        setShowCreateForm(false)
        setCreateForm({
          provider: "OPENAI",
          name: "",
          apiKey: "",
          model: "",
          isEnabled: true,
          setAsDefault: false
        })
        loadIntegrations()
      } else {
        alert(`❌ 생성 실패: ${data.error}`)
      }
    } catch (error) {
      alert('❌ 생성 중 오류가 발생했습니다.')
      console.error('생성 오류:', error)
    } finally {
      setCreating(false)
    }
  }

  // API 연결 테스트
  const handleTest = async (id: string) => {
    setTesting(prev => ({ ...prev, [id]: true }))

    try {
      const response = await fetch(`/api/admin/api-integrations/${id}/test`, {
        method: 'POST'
      })

      const data = await response.json()

      if (data.success) {
        alert(`✅ 연결 테스트 성공!\n\n${data.message}`)
      } else {
        alert(`❌ 연결 테스트 실패!\n\n${data.error || data.details}`)
      }

      // 결과를 반영하기 위해 목록 새로고침
      loadIntegrations()

    } catch (error) {
      alert('❌ 테스트 중 오류가 발생했습니다.')
      console.error('테스트 오류:', error)
    } finally {
      setTesting(prev => ({ ...prev, [id]: false }))
    }
  }

  // 기본 설정으로 지정
  const handleSetDefault = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/api-integrations/${id}/set-default`, {
        method: 'POST'
      })

      const data = await response.json()

      if (response.ok) {
        alert(`⭐ ${data.message}`)
        loadIntegrations()
      } else {
        alert(`❌ 기본 설정 실패: ${data.error}`)
      }
    } catch (error) {
      alert('❌ 기본 설정 중 오류가 발생했습니다.')
      console.error('기본 설정 오류:', error)
    }
  }

  // 삭제
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`정말로 '${name}' API 통합을 삭제하시겠습니까?`)) {
      return
    }

    try {
      const response = await fetch(`/api/admin/api-integrations/${id}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (response.ok) {
        alert(`🗑️ ${data.message}`)
        loadIntegrations()
      } else {
        alert(`❌ 삭제 실패: ${data.error}`)
      }
    } catch (error) {
      alert('❌ 삭제 중 오류가 발생했습니다.')
      console.error('삭제 오류:', error)
    }
  }

  // Provider별 기본 모델
  const getDefaultModelForProvider = (provider: string): string => {
    switch (provider) {
      case "OPENAI": return "gpt-4o"
      case "ANTHROPIC": return "claude-3-5-sonnet-20241022"
      case "GOOGLE": return "gemini-1.5-pro"
      default: return ""
    }
  }

  // Provider 선택 시 모델 자동 설정
  const handleProviderChange = (provider: string) => {
    setCreateForm(prev => ({
      ...prev,
      provider,
      model: getDefaultModelForProvider(provider)
    }))
  }

  if (loading) {
    return <div className="p-6 text-center">로딩 중...</div>
  }

  return (
    <div className="p-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            API 통합 목록 ({integrations.length}개)
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            활성화된 API: {integrations.filter(i => i.isEnabled).length}개
          </p>
        </div>

        <button
          onClick={() => setShowCreateForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          새 API 추가
        </button>
      </div>

      {/* 생성 폼 */}
      {showCreateForm && (
        <div className="mb-6 p-4 border border-blue-200 bg-blue-50 rounded-lg">
          <h3 className="text-md font-semibold text-blue-900 mb-4">새 API 통합 추가</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Provider
              </label>
              <select
                value={createForm.provider}
                onChange={(e) => handleProviderChange(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="OPENAI">OpenAI (GPT-4o, GPT-4-turbo 등)</option>
                <option value="ANTHROPIC">Anthropic (Claude 3.5 Sonnet 등)</option>
                <option value="GOOGLE">Google AI (Gemini Pro 등)</option>
                <option value="CUSTOM">Custom API</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                이름
              </label>
              <input
                type="text"
                value={createForm.name}
                onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="예: 메인 OpenAI API"
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Key
              </label>
              <input
                type="password"
                value={createForm.apiKey}
                onChange={(e) => setCreateForm(prev => ({ ...prev, apiKey: e.target.value }))}
                placeholder="API Key를 입력하세요"
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                모델
              </label>
              <input
                type="text"
                value={createForm.model}
                onChange={(e) => setCreateForm(prev => ({ ...prev, model: e.target.value }))}
                placeholder="모델명 (선택사항)"
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={createForm.isEnabled}
                onChange={(e) => setCreateForm(prev => ({ ...prev, isEnabled: e.target.checked }))}
                className="rounded"
              />
              <span className="text-sm">활성화</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={createForm.setAsDefault}
                onChange={(e) => setCreateForm(prev => ({ ...prev, setAsDefault: e.target.checked }))}
                className="rounded"
              />
              <span className="text-sm">기본 API로 설정</span>
            </label>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={handleCreate}
              disabled={creating}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {creating ? '생성 중...' : '생성'}
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* API 통합 목록 */}
      {integrations.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Settings className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-lg">설정된 API 통합이 없습니다.</p>
          <p className="text-sm mt-1">새 API를 추가하여 파일 분석 시 GPT 도움을 받으세요.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {integrations.map((integration) => (
            <div
              key={integration.id}
              className={`border rounded-lg p-4 ${
                integration.isDefault ? 'border-yellow-300 bg-yellow-50' :
                integration.isEnabled ? 'border-green-300 bg-green-50' :
                'border-gray-300 bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-gray-900">{integration.name}</h3>

                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        integration.provider === 'OPENAI' ? 'bg-green-100 text-green-800' :
                        integration.provider === 'ANTHROPIC' ? 'bg-purple-100 text-purple-800' :
                        integration.provider === 'GOOGLE' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {integration.provider}
                      </span>

                      {integration.isDefault && (
                        <Star className="w-4 h-4 text-yellow-500 fill-current" title="기본 API" />
                      )}

                      {integration.isEnabled ? (
                        <CheckCircle className="w-4 h-4 text-green-500" title="활성화됨" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" title="비활성화됨" />
                      )}
                    </div>
                  </div>

                  <div className="mt-2 text-sm text-gray-600 space-y-1">
                    <div className="flex items-center gap-4">
                      <span>API Key: {showApiKeys[integration.id] ? 'sk-...' : integration.maskedApiKey}</span>
                      <button
                        onClick={() => setShowApiKeys(prev => ({ ...prev, [integration.id]: !prev[integration.id] }))}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {showApiKeys[integration.id] ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {integration.model && (
                      <div>모델: {integration.model}</div>
                    )}

                    {integration.lastTestedAt && (
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span>
                          마지막 테스트: {new Date(integration.lastTestedAt).toLocaleString()}
                          {integration.lastTestStatus === 'SUCCESS' ? (
                            <CheckCircle className="w-4 h-4 text-green-500 inline ml-2" />
                          ) : integration.lastTestStatus === 'FAILED' ? (
                            <XCircle className="w-4 h-4 text-red-500 inline ml-2" />
                          ) : null}
                        </span>
                      </div>
                    )}

                    {integration.lastTestMessage && (
                      <div className="text-xs text-gray-500">
                        {integration.lastTestMessage}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTest(integration.id)}
                    disabled={testing[integration.id] || !integration.isEnabled}
                    className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
                  >
                    <TestTube className="w-4 h-4" />
                    {testing[integration.id] ? '테스트 중...' : '연결 테스트'}
                  </button>

                  {!integration.isDefault && integration.isEnabled && (
                    <button
                      onClick={() => handleSetDefault(integration.id)}
                      className="flex items-center gap-1 px-3 py-1 text-sm bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                    >
                      <StarOff className="w-4 h-4" />
                      기본 설정
                    </button>
                  )}

                  <button
                    onClick={() => handleDelete(integration.id, integration.name)}
                    className="flex items-center gap-1 px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                  >
                    <Trash2 className="w-4 h-4" />
                    삭제
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 사용 안내 */}
      <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-semibold mb-2">GPT API 사용 안내</p>
            <ul className="space-y-1 text-xs">
              <li>• GPT API는 파일 분석 시 컬럼 매핑 보조용으로만 사용됩니다.</li>
              <li>• 실제 데이터 처리와 계산은 서버에서 deterministic하게 수행됩니다.</li>
              <li>• 개인정보는 마스킹되어 GPT에 전송됩니다.</li>
              <li>• API 설정이 없어도 rule-based 방식으로 업로드 가능합니다.</li>
              <li>• API Key는 암호화되어 저장되며, 프론트에는 마스킹되어 표시됩니다.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
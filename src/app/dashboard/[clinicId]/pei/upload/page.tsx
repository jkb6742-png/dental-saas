'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

export default function PEIUploadPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session, status } = useSession()
  const clinicId = params.clinicId as string

  const [file, setFile] = useState<File | null>(null)
  const [year, setYear] = useState(2026)
  const [month, setMonth] = useState(6)
  const [title, setTitle] = useState('')
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')

  // 권한 체크
  useEffect(() => {
    if (status === 'loading') return // 로딩 중이면 대기

    if (!session) {
      router.push('/login')
      return
    }

    // 마스터 계정이 아닌 경우 접근 차단
    if ((session.user as any).role !== 'MASTER') {
      alert('PEI 보고서 업로드는 마스터 계정만 가능합니다.')
      router.push(`/dashboard/${clinicId}/pei`)
      return
    }
  }, [session, status, router, clinicId])

  // 로딩 중이거나 권한 체크 중
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">권한 확인 중...</p>
        </div>
      </div>
    )
  }

  // 권한이 없는 경우 (useEffect에서 리다이렉트 되지만 안전을 위해)
  if (!session || (session.user as any).role !== 'MASTER') {
    return null
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      // 파일명에서 자동으로 제목 추출
      const fileName = selectedFile.name.replace('.html', '')
      if (!title) {
        setTitle(fileName)
      }
    }
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!file || !title) {
      setMessage('파일과 제목을 모두 입력해주세요.')
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

      const response = await fetch('/api/pei/upload-html', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (result.success) {
        setMessage('✅ PEI 보고서가 성공적으로 업로드되었습니다!')

        // 3초 후 목록 페이지로 이동
        setTimeout(() => {
          router.push(`/dashboard/${clinicId}/pei`)
        }, 3000)
      } else {
        setMessage('❌ 업로드 실패: ' + result.error)
      }
    } catch (error) {
      console.error('업로드 오류:', error)
      setMessage('❌ 업로드 중 오류가 발생했습니다.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            PEI 보고서 업로드
          </h1>

          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">📋 업로드 방법</h3>
            <ol className="text-sm text-blue-800 space-y-1">
              <li>1. Claude에서 PEI 보고서 HTML 파일을 생성받으세요</li>
              <li>2. 생성된 HTML 파일을 다운로드하세요</li>
              <li>3. 아래 폼에서 파일을 선택하고 업로드하세요</li>
              <li>4. 업로드된 보고서는 목록에서 확인할 수 있습니다</li>
            </ol>
          </div>

          <form onSubmit={handleUpload} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                HTML 파일 선택 *
              </label>
              <input
                type="file"
                accept=".html,text/html"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none focus:border-blue-500"
                required
              />
              {file && (
                <p className="mt-2 text-sm text-green-600">
                  선택된 파일: {file.name} ({(file.size / 1024).toFixed(1)}KB)
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  연도 *
                </label>
                <input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value))}
                  min="2020"
                  max="2030"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  월 *
                </label>
                <select
                  value={month}
                  onChange={(e) => setMonth(parseInt(e.target.value))}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  required
                >
                  {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>{m}월</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                보고서 제목 *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 26년 6월 PEI 보고서"
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            {message && (
              <div className={`p-4 rounded-lg ${
                message.includes('✅') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
              }`}>
                {message}
              </div>
            )}

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={uploading}
                className={`flex-1 py-2 px-4 rounded-lg font-medium ${
                  uploading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                } text-white transition-colors`}
              >
                {uploading ? '업로드 중...' : 'HTML 보고서 업로드'}
              </button>

              <button
                type="button"
                onClick={() => router.push(`/dashboard/${clinicId}/pei`)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
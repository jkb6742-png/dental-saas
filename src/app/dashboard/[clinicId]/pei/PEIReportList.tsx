'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Report {
  id: string
  title: string
  year: number
  month: number
  status: string
  generatedAt: Date
  clinic: { name: string }
}

interface PEIReportListProps {
  reports: Report[]
  isMaster: boolean
}

export default function PEIReportList({ reports, isMaster }: PEIReportListProps) {
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState('')

  const handleDelete = async (reportId: string, reportTitle: string) => {
    if (!confirm(`"${reportTitle}" 보고서를 정말 삭제하시겠습니까?\n\n삭제된 보고서는 복구할 수 없습니다.`)) {
      return
    }

    setDeletingIds(prev => new Set(prev).add(reportId))
    setMessage('')

    try {
      const response = await fetch('/api/pei/upload-html', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reportId })
      })

      const result = await response.json()

      if (result.success) {
        setMessage('✅ 보고서가 성공적으로 삭제되었습니다.')

        // 페이지 새로고침
        setTimeout(() => {
          window.location.reload()
        }, 1500)
      } else {
        setMessage('❌ 삭제 실패: ' + result.error)
      }
    } catch (error) {
      console.error('삭제 오류:', error)
      setMessage('❌ 삭제 중 오류가 발생했습니다.')
    } finally {
      setDeletingIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(reportId)
        return newSet
      })
    }
  }

  return (
    <>
      {message && (
        <div className={`mx-6 mt-4 p-3 rounded-lg text-sm ${
          message.includes('✅')
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message}
        </div>
      )}

      {reports.map((report) => (
        <div key={report.id} className="p-6 hover:bg-gray-50 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-lg font-medium text-gray-900">
                  {report.title}
                </h3>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  {report.status === 'COMPLETED' ? '완료' : report.status}
                </span>
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span>🏥 {report.clinic.name}</span>
                <span>📅 업로드: {new Date(report.generatedAt).toLocaleDateString('ko-KR')}</span>
                <span>🕐 {new Date(report.generatedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* 보기 버튼 */}
              <Link
                href={`/api/pei/html?reportId=${report.id}`}
                target="_blank"
                className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 border border-blue-300 rounded hover:bg-blue-50 transition-colors"
              >
                📄 보기
              </Link>

              {/* 다운로드 버튼 */}
              <a
                href={`/api/pei/html?reportId=${report.id}&download=true`}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                💾 다운로드
              </a>

              {/* 삭제 버튼 - 마스터 계정만 */}
              {isMaster && (
                <button
                  onClick={() => handleDelete(report.id, report.title)}
                  disabled={deletingIds.has(report.id)}
                  className={`px-3 py-1 text-sm border rounded transition-colors ${
                    deletingIds.has(report.id)
                      ? 'text-gray-400 border-gray-200 cursor-not-allowed'
                      : 'text-red-600 hover:text-red-800 border-red-300 hover:bg-red-50'
                  }`}
                >
                  {deletingIds.has(report.id) ? '⏳ 삭제중...' : '🗑️ 삭제'}
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </>
  )
}
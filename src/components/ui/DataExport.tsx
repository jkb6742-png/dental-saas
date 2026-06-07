"use client"

import { useState } from "react"
import { Download, FileText, FileSpreadsheet } from "lucide-react"
import { RegionData } from "@/types/regionTypes"
import { transformForCSVExport } from "@/lib/utils/regionUtils"

interface DataExportProps {
  data: RegionData[]
  year: number
  month: number
  filename?: string
}

export default function DataExport({ data, year, month, filename }: DataExportProps) {
  const [isExporting, setIsExporting] = useState(false)

  const exportToCSV = async () => {
    setIsExporting(true)
    try {
      const exportData = transformForCSVExport(data, year, month)

      // CSV 헤더
      const headers = Object.keys(exportData[0] || {})

      // CSV 내용 생성
      const csvContent = [
        headers.join(','),
        ...exportData.map(row =>
          headers.map(header => {
            const value = row[header as keyof typeof row]
            // 값에 쉼표가 있으면 따옴표로 감싸기
            return typeof value === 'string' && value.includes(',')
              ? `"${value}"`
              : String(value)
          }).join(',')
        )
      ].join('\n')

      // BOM 추가 (한글 깨짐 방지)
      const bom = '﻿'
      const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' })

      // 다운로드
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = filename || `지역별_환자분석_${year}년_${month}월.csv`
      link.click()

      URL.revokeObjectURL(link.href)
    } catch (error) {
      console.error('CSV 내보내기 실패:', error)
      alert('CSV 내보내기에 실패했습니다.')
    } finally {
      setIsExporting(false)
    }
  }

  const exportToJSON = async () => {
    setIsExporting(true)
    try {
      const exportData = transformForCSVExport(data, year, month)
      const jsonContent = JSON.stringify(exportData, null, 2)

      const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' })

      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = filename?.replace('.csv', '.json') || `지역별_환자분석_${year}년_${month}월.json`
      link.click()

      URL.revokeObjectURL(link.href)
    } catch (error) {
      console.error('JSON 내보내기 실패:', error)
      alert('JSON 내보내기에 실패했습니다.')
    } finally {
      setIsExporting(false)
    }
  }

  if (data.length === 0) {
    return null
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-slate-600 mr-2">데이터 내보내기:</span>

      <button
        onClick={exportToCSV}
        disabled={isExporting}
        className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
      >
        <FileSpreadsheet className="w-4 h-4" />
        {isExporting ? '내보내는 중...' : 'CSV'}
      </button>

      <button
        onClick={exportToJSON}
        disabled={isExporting}
        className="flex items-center gap-1 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
      >
        <FileText className="w-4 h-4" />
        {isExporting ? '내보내는 중...' : 'JSON'}
      </button>
    </div>
  )
}
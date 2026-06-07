"use client"

import { useState } from "react"
import { Upload } from "lucide-react"
import Button from "@/components/ui/Button"

type FileStatus = "대기 중" | "업로드 중" | "업로드 완료" | "오류"

interface FileItem {
  id: number
  name: string
  status: FileStatus
}

export default function SimpleUpload({ clinicId }: { clinicId: string }) {
  const [fileItems, setFileItems] = useState<FileItem[]>([])
  const [uploading, setUploading] = useState(false)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files)
      const items: FileItem[] = files.map((file, index) => ({
        id: index + 1,
        name: file.name,
        status: "대기 중"
      }))
      setFileItems(items)
    }
  }

  const uploadFiles = async () => {
    if (fileItems.length === 0) return

    setUploading(true)

    for (let i = 0; i < fileItems.length; i++) {
      // 업로드 중으로 변경
      setFileItems(prev => prev.map(item =>
        item.id === i + 1 ? { ...item, status: "업로드 중" } : item
      ))

      // 실제 파일 업로드 (여기서는 시뮬레이션)
      await new Promise(resolve => setTimeout(resolve, 1000))

      // 완료로 변경
      setFileItems(prev => prev.map(item =>
        item.id === i + 1 ? { ...item, status: "업로드 완료" } : item
      ))
    }

    setUploading(false)
  }

  const getStatusBadge = (status: FileStatus) => {
    switch (status) {
      case "대기 중":
        return <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">대기 중</span>
      case "업로드 중":
        return <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">업로드 중</span>
      case "업로드 완료":
        return <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded">업로드 완료</span>
      case "오류":
        return <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded">오류</span>
    }
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center space-x-3">
        <Upload className="w-6 h-6 text-blue-600" />
        <div>
          <h3 className="text-lg font-semibold">파일 업로드</h3>
          <p className="text-sm text-gray-600">엑셀 파일 업로드 및 처리</p>
        </div>
      </div>

      {/* 파일 선택 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <input
          type="file"
          multiple
          accept=".xlsx,.xls,.zip"
          onChange={handleFileSelect}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />

        {fileItems.length > 0 && (
          <div className="mt-4">
            <Button
              onClick={uploadFiles}
              disabled={uploading}
              className="px-4 py-2"
            >
              {uploading ? "업로드 중..." : "업로드 시작"}
            </Button>
          </div>
        )}
      </div>

      {/* 파일 목록 테이블 */}
      {fileItems.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200">
            <h4 className="font-medium text-gray-900">업로드 파일 목록</h4>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    순번
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    파일명
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상태
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {fileItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {item.id}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {item.name}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {getStatusBadge(item.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
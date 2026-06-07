"use client"

import { useState, useMemo } from "react"
import { Search, X } from "lucide-react"

interface RegionFilterProps {
  regions: string[]
  selectedRegion: string
  onRegionSelect: (region: string) => void
  maxDisplay?: number
}

export default function RegionFilter({
  regions,
  selectedRegion,
  onRegionSelect,
  maxDisplay = 10
}: RegionFilterProps) {
  const [searchTerm, setSearchTerm] = useState("")

  const filteredRegions = useMemo(() => {
    if (!searchTerm) return regions.slice(0, maxDisplay)

    return regions
      .filter(region =>
        region.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .slice(0, maxDisplay)
  }, [regions, searchTerm, maxDisplay])

  const clearSearch = () => {
    setSearchTerm("")
  }

  return (
    <div className="space-y-4">
      {/* 검색 입력 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="지역명 검색..."
          className="w-full pl-10 pr-10 py-2 bg-white/90 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
        />
        {searchTerm && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 검색 결과 정보 */}
      {searchTerm && (
        <div className="text-sm text-slate-600">
          {filteredRegions.length > 0
            ? `"${searchTerm}" 검색 결과: ${filteredRegions.length}개 지역`
            : `"${searchTerm}" 검색 결과가 없습니다.`
          }
        </div>
      )}

      {/* 지역 선택 버튼들 */}
      {filteredRegions.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-5 gap-3">
          {filteredRegions.map((region, index) => {
            // 원본 인덱스 찾기 (순위 표시용)
            const originalIndex = regions.indexOf(region)

            return (
              <button
                key={region}
                onClick={() => onRegionSelect(region)}
                className={`px-3 py-2 rounded-xl text-sm font-medium transition-all border ${
                  selectedRegion === region
                    ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white border-blue-500 shadow-lg scale-105'
                    : 'bg-white/80 text-slate-700 hover:bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-center gap-1">
                  <span className={`text-xs ${selectedRegion === region ? 'text-blue-100' : 'text-blue-600'}`}>
                    {originalIndex + 1}
                  </span>
                  <span className="truncate">{region}</span>
                </div>
              </button>
            )
          })}
        </div>
      ) : searchTerm ? (
        <div className="text-center py-8 text-slate-500">
          <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>검색 결과가 없습니다.</p>
          <button
            onClick={clearSearch}
            className="mt-2 text-blue-600 hover:text-blue-700 text-sm"
          >
            검색 초기화
          </button>
        </div>
      ) : null}

      {/* 더 많은 지역이 있을 때 안내 */}
      {!searchTerm && regions.length > maxDisplay && (
        <div className="text-sm text-slate-500 text-center py-2 border-t border-slate-200">
          총 {regions.length}개 지역 중 상위 {maxDisplay}개 표시
          <br />
          <span className="text-blue-600">검색을 통해 다른 지역을 찾아보세요</span>
        </div>
      )}
    </div>
  )
}
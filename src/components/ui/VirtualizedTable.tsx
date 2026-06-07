"use client"

import { useState, useEffect, useMemo, useCallback } from 'react'
import { FixedSizeList as List } from 'react-window'
import InfiniteLoader from 'react-window-infinite-loader'
import { Search, Filter, Download } from 'lucide-react'

interface Column<T> {
  key: keyof T
  header: string
  width: number
  sortable?: boolean
  render?: (value: any, row: T) => React.ReactNode
  align?: 'left' | 'center' | 'right'
}

interface VirtualizedTableProps<T> {
  data: T[]
  columns: Column<T>[]
  height?: number
  itemHeight?: number
  totalCount: number
  hasNextPage: boolean
  isNextPageLoading: boolean
  loadNextPage: () => Promise<void>
  onSort?: (column: keyof T, direction: 'asc' | 'desc') => void
  onSearch?: (query: string) => void
  onFilter?: (filters: Record<string, any>) => void
  searchPlaceholder?: string
  showSearch?: boolean
  showFilter?: boolean
  showExport?: boolean
  onExport?: () => void
  className?: string
}

export default function VirtualizedTable<T extends Record<string, any>>({
  data,
  columns,
  height = 400,
  itemHeight = 60,
  totalCount,
  hasNextPage,
  isNextPageLoading,
  loadNextPage,
  onSort,
  onSearch,
  onFilter,
  searchPlaceholder = "검색...",
  showSearch = true,
  showFilter = false,
  showExport = false,
  onExport,
  className = ""
}: VirtualizedTableProps<T>) {
  const [sortColumn, setSortColumn] = useState<keyof T | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [searchQuery, setSearchQuery] = useState('')
  const [isFilterOpen, setIsFilterOpen] = useState(false)

  // 무한 스크롤을 위한 아이템 로드 여부 확인
  const isItemLoaded = useCallback(
    (index: number) => !!data[index],
    [data]
  )

  // 전체 아이템 개수 (로딩 아이템 포함)
  const itemCount = hasNextPage ? totalCount + 1 : totalCount

  // 정렬 핸들러
  const handleSort = (column: keyof T) => {
    if (!onSort) return

    const newDirection =
      sortColumn === column && sortDirection === 'asc' ? 'desc' : 'asc'

    setSortColumn(column)
    setSortDirection(newDirection)
    onSort(column, newDirection)
  }

  // 검색 핸들러
  const handleSearch = (query: string) => {
    setSearchQuery(query)
    onSearch?.(query)
  }

  // 테이블 헤더 컴포넌트
  const TableHeader = () => (
    <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
      <div className="flex" style={{ width: columns.reduce((acc, col) => acc + col.width, 0) }}>
        {columns.map((column) => (
          <div
            key={String(column.key)}
            className={`
              flex items-center px-4 py-3 text-sm font-medium text-gray-700
              ${column.sortable ? 'cursor-pointer hover:bg-gray-50' : ''}
              ${column.align === 'center' ? 'justify-center' : ''}
              ${column.align === 'right' ? 'justify-end' : ''}
            `}
            style={{ width: column.width }}
            onClick={() => column.sortable && handleSort(column.key)}
          >
            {column.header}
            {column.sortable && sortColumn === column.key && (
              <span className="ml-2 text-xs">
                {sortDirection === 'asc' ? '↑' : '↓'}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )

  // 테이블 행 컴포넌트
  const TableRow = ({ index, style }: { index: number; style: any }) => {
    const item = data[index]

    // 로딩 상태 표시
    if (!item) {
      return (
        <div style={style} className="flex items-center justify-center py-4">
          <div className="animate-pulse flex space-x-4 w-full px-4">
            {columns.map((col, i) => (
              <div
                key={i}
                className="bg-gray-200 h-4 rounded"
                style={{ width: col.width - 16 }}
              />
            ))}
          </div>
        </div>
      )
    }

    return (
      <div
        style={style}
        className="flex border-b border-gray-100 hover:bg-gray-50 transition-colors"
      >
        {columns.map((column) => (
          <div
            key={String(column.key)}
            className={`
              flex items-center px-4 py-3 text-sm text-gray-900
              ${column.align === 'center' ? 'justify-center' : ''}
              ${column.align === 'right' ? 'justify-end' : ''}
            `}
            style={{ width: column.width }}
          >
            {column.render
              ? column.render(item[column.key], item)
              : String(item[column.key] || '-')
            }
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 overflow-hidden ${className}`}>
      {/* 상단 도구모음 */}
      {(showSearch || showFilter || showExport) && (
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* 검색 */}
              {showSearch && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder={searchPlaceholder}
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64"
                  />
                </div>
              )}

              {/* 필터 */}
              {showFilter && (
                <button
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-white transition-colors"
                >
                  <Filter className="w-4 h-4" />
                  필터
                </button>
              )}
            </div>

            <div className="flex items-center gap-4">
              {/* 결과 개수 */}
              <span className="text-sm text-gray-600">
                총 {totalCount.toLocaleString()}개
              </span>

              {/* 내보내기 */}
              {showExport && (
                <button
                  onClick={onExport}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  내보내기
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 테이블 헤더 */}
      <TableHeader />

      {/* 가상화된 테이블 본체 */}
      <div style={{ height }}>
        <InfiniteLoader
          isItemLoaded={isItemLoaded}
          itemCount={itemCount}
          loadMoreItems={loadNextPage}
        >
          {({ onItemsRendered, ref }) => (
            <List
              ref={ref}
              height={height}
              itemCount={itemCount}
              itemSize={itemHeight}
              onItemsRendered={onItemsRendered}
              width="100%"
            >
              {TableRow}
            </List>
          )}
        </InfiniteLoader>
      </div>

      {/* 로딩 상태 */}
      {isNextPageLoading && (
        <div className="p-4 text-center text-gray-600 border-t">
          <div className="inline-flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            데이터를 불러오는 중...
          </div>
        </div>
      )}

      {/* 빈 상태 */}
      {!isNextPageLoading && totalCount === 0 && (
        <div className="p-8 text-center text-gray-500">
          <div className="text-lg font-medium mb-2">데이터가 없습니다</div>
          <p className="text-sm">검색 조건을 변경하거나 데이터를 추가해보세요.</p>
        </div>
      )}
    </div>
  )
}

// 사용 예제를 위한 타입과 컴포넌트
export interface PatientData {
  id: string
  patientName: string
  chartNumber: string
  ageGender: string
  receptionTime: string
  totalRevenue: number
  waitingTime: number
  doctor: string
}

// 환자 테이블 전용 컴포넌트
export const PatientVirtualTable = ({
  data,
  totalCount,
  hasNextPage,
  isNextPageLoading,
  loadNextPage,
  onSort,
  onSearch,
  onExport,
  className
}: Omit<VirtualizedTableProps<PatientData>, 'columns'> & {
  data: PatientData[]
}) => {
  const columns: Column<PatientData>[] = [
    {
      key: 'chartNumber',
      header: '차트번호',
      width: 120,
      sortable: true
    },
    {
      key: 'patientName',
      header: '환자명',
      width: 120,
      sortable: true
    },
    {
      key: 'ageGender',
      header: '연령/성별',
      width: 100,
      align: 'center'
    },
    {
      key: 'receptionTime',
      header: '내원일시',
      width: 150,
      sortable: true,
      render: (value) => value ? new Date(value).toLocaleString('ko-KR') : '-'
    },
    {
      key: 'totalRevenue',
      header: '총 진료비',
      width: 120,
      align: 'right',
      sortable: true,
      render: (value) => value ? `${value.toLocaleString()}원` : '0원'
    },
    {
      key: 'waitingTime',
      header: '대기시간',
      width: 100,
      align: 'center',
      sortable: true,
      render: (value) => value ? `${value}분` : '-'
    },
    {
      key: 'doctor',
      header: '담당의사',
      width: 100,
      sortable: true
    }
  ]

  return (
    <VirtualizedTable
      data={data}
      columns={columns}
      totalCount={totalCount}
      hasNextPage={hasNextPage}
      isNextPageLoading={isNextPageLoading}
      loadNextPage={loadNextPage}
      onSort={onSort}
      onSearch={onSearch}
      onExport={onExport}
      searchPlaceholder="환자명, 차트번호 검색..."
      showSearch={true}
      showExport={true}
      className={className}
    />
  )
}
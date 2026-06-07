"use client"

import Link from "next/link"
import { Filter } from "lucide-react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"

interface AvailablePeriod {
  year: number
  month: number
}

interface MonthlyFilterProps {
  clinicId: string
  availablePeriods: AvailablePeriod[]
  currentYear?: number
  currentMonth?: number
}

export default function MonthlyFilter({
  clinicId,
  availablePeriods,
  currentYear,
  currentMonth
}: MonthlyFilterProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const handleYearChange = (year: string) => {
    const params = new URLSearchParams(searchParams)
    if (year) {
      params.set('year', year)
    } else {
      params.delete('year')
    }
    // year가 변경되면 month 파라미터 제거
    params.delete('month')

    router.push(`${pathname}?${params.toString()}`)
  }

  const handleMonthChange = (month: string) => {
    const params = new URLSearchParams(searchParams)
    if (month) {
      params.set('month', month)
    } else {
      params.delete('month')
    }

    router.push(`${pathname}?${params.toString()}`)
  }

  const clearFilters = () => {
    router.push(pathname)
  }

  if (availablePeriods.length === 0) {
    return null
  }

  return (
    <div className="border-t border-slate-200 pt-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-600" />
          <span className="text-sm font-medium text-slate-700">필터:</span>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={currentYear || ''}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
            onChange={(e) => handleYearChange(e.target.value)}
          >
            <option value="">전체 연도</option>
            {Array.from(new Set(availablePeriods.map(p => p.year))).map(y => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>

          <select
            value={currentMonth || ''}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
            onChange={(e) => handleMonthChange(e.target.value)}
          >
            <option value="">전체 월</option>
            {currentYear ?
              availablePeriods
                .filter(p => p.year === currentYear)
                .map(p => (
                  <option key={p.month} value={p.month}>{p.month}월</option>
                )) :
              Array.from(new Set(availablePeriods.map(p => p.month)))
                .sort((a, b) => a - b)
                .map(m => (
                  <option key={m} value={m}>{m}월</option>
                ))
            }
          </select>

          {(currentYear || currentMonth) && (
            <button
              onClick={clearFilters}
              className="px-3 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              필터 초기화
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
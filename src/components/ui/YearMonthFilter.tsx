"use client"

import { useState, useEffect } from "react"
import { Calendar, ChevronDown } from "lucide-react"

interface YearMonthFilterProps {
  initialYear?: number
  initialMonth?: number
  onYearChange: (year: number) => void
  onMonthChange: (month: number) => void
  showMonthFilter?: boolean
}

export default function YearMonthFilter({
  initialYear = new Date().getFullYear(),
  initialMonth = new Date().getMonth() + 1,
  onYearChange,
  onMonthChange,
  showMonthFilter = true
}: YearMonthFilterProps) {
  const [selectedYear, setSelectedYear] = useState(initialYear)
  const [selectedMonth, setSelectedMonth] = useState(initialMonth)

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  const months = [
    { value: 1, label: "1월" }, { value: 2, label: "2월" }, { value: 3, label: "3월" },
    { value: 4, label: "4월" }, { value: 5, label: "5월" }, { value: 6, label: "6월" },
    { value: 7, label: "7월" }, { value: 8, label: "8월" }, { value: 9, label: "9월" },
    { value: 10, label: "10월" }, { value: 11, label: "11월" }, { value: 12, label: "12월" }
  ]

  useEffect(() => {
    onYearChange(selectedYear)
  }, [selectedYear, onYearChange])

  useEffect(() => {
    onMonthChange(selectedMonth)
  }, [selectedMonth, onMonthChange])

  const handleYearChange = (year: number) => {
    setSelectedYear(year)
  }

  const handleMonthChange = (month: number) => {
    setSelectedMonth(month)
  }

  return (
    <div className="bg-white rounded-2xl border border-[#e5e8eb] p-6 mb-6">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#3182f6]" />
          <span className="text-[16px] font-semibold text-[#191f28]">기간 선택</span>
        </div>

        <div className="flex items-center gap-3">
          {/* 년도 선택 */}
          <div className="relative">
            <select
              value={selectedYear}
              onChange={(e) => handleYearChange(parseInt(e.target.value))}
              className="appearance-none bg-white border border-[#e5e8eb] rounded-xl px-4 py-2.5 pr-10 text-[14px] font-medium text-[#191f28] focus:border-[#3182f6] focus:outline-none cursor-pointer"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}년
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#8b95a1] pointer-events-none" />
          </div>

          {/* 월 선택 */}
          {showMonthFilter && (
            <div className="relative">
              <select
                value={selectedMonth}
                onChange={(e) => handleMonthChange(parseInt(e.target.value))}
                className="appearance-none bg-white border border-[#e5e8eb] rounded-xl px-4 py-2.5 pr-10 text-[14px] font-medium text-[#191f28] focus:border-[#3182f6] focus:outline-none cursor-pointer"
              >
                {months.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#8b95a1] pointer-events-none" />
            </div>
          )}
        </div>

        <div className="text-[13px] text-[#8b95a1]">
          {showMonthFilter
            ? `${selectedYear}년 전체 추이와 ${selectedMonth}월 상세 데이터를 표시합니다`
            : `${selectedYear}년 전체 데이터를 표시합니다`
          }
        </div>
      </div>
    </div>
  )
}
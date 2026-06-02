"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"

type Props = {
  availableMonths: { year: number; month: number }[]
  currentYear: number
  currentMonth: number
}

export default function MonthSelector({ availableMonths, currentYear, currentMonth }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const [y, m] = e.target.value.split("-")
    const params = new URLSearchParams(searchParams.toString())
    params.set("year", y)
    params.set("month", m)
    router.push(`${pathname}?${params.toString()}`)
  }

  const value = `${currentYear}-${currentMonth}`

  return (
    <select
      value={value}
      onChange={handleChange}
      className="px-3 py-2 text-[13px] font-medium rounded-xl border border-[#e5e8eb] bg-white text-[#191f28] focus:outline-none focus:border-[#3182f6] cursor-pointer"
    >
      {availableMonths.map((m) => (
        <option key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>
          {m.year}년 {m.month}월
        </option>
      ))}
    </select>
  )
}

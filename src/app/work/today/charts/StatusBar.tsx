import Link from "next/link"

const SEG = [
  { key: "TODO", label: "할 일", color: "#c4c4be" },
  { key: "IN_PROGRESS", label: "진행중", color: "#0062ff" },
  { key: "BLOCKED", label: "자료 대기", color: "#b54708" },
  { key: "IN_REVIEW", label: "검토중", color: "#7a5af8" },
  { key: "DONE", label: "이번 달 완료", color: "#1a7f37" },
] as const

// 업무 상태 분포: 누적 가로 막대 한 줄 + 아래 상태별 숫자(클릭 시 그 상태 목록)
export default function StatusBar({ counts }: { counts: Record<(typeof SEG)[number]["key"], number> }) {
  const total = SEG.reduce((s, x) => s + counts[x.key], 0)
  if (total < 3) return <p className="px-4 py-8 text-center text-[13px] text-[#8a8a84]">데이터 모으는 중입니다.</p>
  return (
    <div className="px-4 py-4">
      <div className="flex h-4 overflow-hidden rounded-sm bg-[#ecece9]">
        {SEG.filter((s) => counts[s.key] > 0).map((s) => (
          <Link
            key={s.key}
            href={`/work/tasks?status=${s.key}`}
            prefetch={false}
            title={`${s.label} ${counts[s.key]}건`}
            className="h-full border-r border-white last:border-0 hover:opacity-80"
            style={{ width: `${(counts[s.key] / total) * 100}%`, background: s.color }}
          />
        ))}
      </div>
      <ul className="mt-3 divide-y divide-[#f2f2ef]">
        {SEG.map((s) => (
          <li key={s.key}>
            <Link href={`/work/tasks?status=${s.key}`} prefetch={false} className="flex items-center gap-2 py-1.5 text-[13px] hover:underline">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ background: s.color }} />
              <span className="flex-1">{s.label}</span>
              <span className="tabular-nums text-[#555555]">{counts[s.key]}</span>
              <span className="w-[40px] text-right text-[12px] tabular-nums text-[#8a8a84]">{Math.round((counts[s.key] / total) * 100)}%</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

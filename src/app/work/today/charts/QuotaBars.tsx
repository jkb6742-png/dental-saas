import Link from "next/link"

type Row = { id: string; name: string; target: number; done: number; q: { label: string; done: number; target: number }[] }

// 치과별 이번 달 계약 진행률: 가로 막대 + 오늘 기준 기대 진도선(세로 눈금)
export default function QuotaBars({ rows, elapsed, month, master }: { rows: Row[]; elapsed: number; month: string; master: boolean }) {
  const withQuota = rows.filter((r) => r.target > 0).sort((a, b) => a.done / a.target - b.done / b.target)
  const without = rows.filter((r) => r.target === 0)
  const tick = Math.min(100, Math.round(elapsed * 100))

  if (withQuota.length === 0)
    return (
      <div className="px-4 py-6 text-[13px] text-[#8a8a84]">
        이번 달 계약 분량이 등록된 치과가 없습니다.
        {master && (
          <Link href="/work/contracts" prefetch={false} className="ml-2 text-[#0062ff] hover:underline">
            계약 등록
          </Link>
        )}
      </div>
    )

  return (
    <div className="px-4 py-3">
      <div className="mb-2 flex items-center gap-3 text-[12px] text-[#8a8a84]">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-3 rounded-sm bg-[#0062ff]" /> 완료
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-px bg-[#0a0a0a]" /> 오늘 기준 기대 진도 {tick}%
        </span>
      </div>
      <ul className="space-y-2.5">
        {withQuota.map((r) => {
          const pct = Math.min(100, Math.round((r.done / r.target) * 100))
          const behind = r.done / r.target + 0.15 < elapsed
          return (
            <li key={r.id}>
              <Link href={`/work/clinics/${r.id}/${month}`} prefetch={false} className="group grid grid-cols-[120px_minmax(0,1fr)_64px] items-center gap-3" title={r.q.map((x) => `${x.label} ${x.done}/${x.target}`).join(" · ")}>
                <span className="truncate text-[13px] group-hover:underline">{r.name}</span>
                <span className="relative h-2.5 rounded-sm bg-[#ecece9]">
                  <span
                    className={`absolute inset-y-0 left-0 rounded-sm ${pct >= 100 ? "bg-[#1a7f37]" : behind ? "bg-[#d92d20]" : "bg-[#0062ff]"}`}
                    style={{ width: `${pct}%` }}
                  />
                  <span className="absolute -top-1 -bottom-1 w-px bg-[#0a0a0a]" style={{ left: `${tick}%` }} />
                </span>
                <span className={`text-right text-[12px] tabular-nums ${behind ? "text-[#d92d20]" : "text-[#555555]"}`}>
                  {r.done}/{r.target}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
      {without.length > 0 && (
        <p className="mt-3 text-[12px] text-[#8a8a84]">
          계약 분량 없음: {without.slice(0, 6).map((r) => r.name).join(", ")}
          {without.length > 6 ? ` 외 ${without.length - 6}곳` : ""}
          {master && (
            <Link href="/work/contracts" prefetch={false} className="ml-2 text-[#0062ff] hover:underline">
              계약 등록
            </Link>
          )}
        </p>
      )}
    </div>
  )
}

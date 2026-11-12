import Link from "next/link"

const WEEK = ["일", "월", "화", "수", "목", "금", "토"]
// 0, 1, 2, 3, 4+
const SCALE = ["#ffffff", "#e6efff", "#b3cdff", "#6698ff", "#0062ff"]

// 직원별 향후 14일 미완료 마감 수. 셀 = 그날 마감인 미완료 업무 수, 주말 칸은 옅게 칠한다.
export default function DueHeatmap({ days, rows }: { days: string[]; rows: { id: string; name: string; cells: number[] }[] }) {
  if (rows.length === 0) return <p className="px-4 py-8 text-center text-[13px] text-[#8a8a84]">재직 직원이 없습니다.</p>
  const total = rows.reduce((s, r) => s + r.cells.reduce((a, b) => a + b, 0), 0)
  if (total === 0) return <p className="px-4 py-8 text-center text-[13px] text-[#8a8a84]">데이터 모으는 중입니다. 앞으로 14일 안에 마감인 담당 업무가 없습니다.</p>
  const wk = days.map((d) => new Date(`${d}T00:00:00Z`).getUTCDay())
  return (
    <div className="overflow-x-auto px-4 py-3">
      <table className="w-full min-w-[720px] border-collapse text-[12px]">
        <thead>
          <tr>
            <th className="w-[96px] py-1 text-left font-medium text-[#6f6f6a]">직원</th>
            {days.map((d, i) => (
              <th key={d} className={`py-1 font-normal tabular-nums ${wk[i] === 0 || wk[i] === 6 ? "bg-[#f2f2ef] text-[#8a8a84]" : "text-[#6f6f6a]"}`}>
                <div>{i === 0 ? "오늘" : `${Number(d.slice(5, 7))}.${Number(d.slice(8))}`}</div>
                <div className="text-[11px]">{WEEK[wk[i]]}</div>
              </th>
            ))}
            <th className="w-[48px] py-1 text-right font-medium text-[#6f6f6a]">합계</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-[#f2f2ef]">
              <td className="truncate py-1 pr-2">
                <Link href={`/work/tasks?assignee=${r.id}`} prefetch={false} className="hover:underline">
                  {r.name}
                </Link>
              </td>
              {r.cells.map((n, i) => (
                <td key={i} className={`p-0.5 ${wk[i] === 0 || wk[i] === 6 ? "bg-[#f2f2ef]" : ""}`}>
                  <Link
                    href={`/work/tasks?assignee=${r.id}`}
                    prefetch={false}
                    title={`${r.name} · ${days[i]} 마감 ${n}건`}
                    className={`flex h-7 items-center justify-center rounded-sm border tabular-nums hover:border-[#0a0a0a] ${n ? "border-transparent" : "border-[#ecece9]"} ${n >= 3 ? "text-white" : "text-[#0a0a0a]"}`}
                    style={{ background: n ? SCALE[Math.min(4, n)] : wk[i] === 0 || wk[i] === 6 ? "transparent" : SCALE[0] }}
                  >
                    {n || ""}
                  </Link>
                </td>
              ))}
              <td className="py-1 text-right tabular-nums text-[#555555]">{r.cells.reduce((a, b) => a + b, 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex items-center justify-end gap-1 text-[11px] text-[#8a8a84]">
        적음
        {SCALE.map((c, i) => (
          <span key={i} className="inline-block h-3 w-4 rounded-sm border border-[#ecece9]" style={{ background: c }} />
        ))}
        4건 이상
      </div>
    </div>
  )
}

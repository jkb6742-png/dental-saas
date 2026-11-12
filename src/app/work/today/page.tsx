export const dynamic = "force-dynamic"

import Link from "next/link"
import { prisma } from "@/lib/db"
import { requireWorkActor, type WorkActor } from "@/lib/work/actor"
import { leaveBalance } from "@/lib/work/leave"
import { loadCalendar, type CalendarItem } from "@/lib/work/calendar"
import { kstToday } from "@/lib/work/common"
import ClockCard from "./ClockCard"
import TaskLanes from "./TaskLanes"
import { QuickButtons, QuickAddLink, AutoRefresh } from "./QuickAdd"
import { addDays, longDate, shortDay, monthElapsed, clinicProgress, loadStaffHome, loadMasterHome } from "./data"
import QuotaBars from "./charts/QuotaBars"
import WeekBars from "./charts/WeekBars"
import StatusBar from "./charts/StatusBar"
import DueHeatmap from "./charts/DueHeatmap"

// 홈: 직원 = 오늘 처리할 업무 중심, 대표 = 운영 위험·승인 중심([운영 | 내 업무] 전환).

const REQUEST_STATUS: Record<string, string> = { REQUESTED: "접수", IN_REVIEW: "검토중", IN_PROGRESS: "진행중" }
const GRID = "grid gap-4 items-start lg:grid-cols-[minmax(0,65fr)_minmax(0,35fr)]"

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const actor = await requireWorkActor()
  const sp = await searchParams
  const today = kstToday()
  const opsView = actor.isMaster && sp.view !== "mine"

  const [me, todayItems] = await Promise.all([
    prisma.employee.findUnique({ where: { userId: actor.id }, select: { userId: true } }),
    loadCalendar(actor, today, addDays(today, 1)).catch(() => [] as CalendarItem[]),
  ])
  const leave = me ? await leaveBalance(actor.id).catch(() => null) : null
  const schedule = todayItems
    .filter((i) => i.kind !== "TASK")
    .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""))

  return (
    <div className="space-y-4">
      <AutoRefresh />
      {/* 1. 상단 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div>
          <h1 className="text-[20px] font-bold leading-tight">{longDate(today)}</h1>
          <div className="text-[13px] text-[#6f6f6a]">
            {actor.name}님
            {leave && (
              <Link prefetch={false} href="/work/leave" className="ml-2 hover:underline">
                잔여 연차 <span className="tabular-nums">{leave.balance}</span>일
              </Link>
            )}
          </div>
        </div>
        {actor.isMaster && (
          <div className="flex h-8 rounded border border-[#d1d1cc] bg-white p-0.5 text-[13px]">
            <Link href="/work/today" prefetch={false} className={`rounded-sm px-3 leading-[26px] ${opsView ? "bg-[#191f28] text-white" : "text-[#555555] hover:bg-[#f2f2ef]"}`}>
              운영
            </Link>
            <Link href="/work/today?view=mine" prefetch={false} className={`rounded-sm px-3 leading-[26px] ${!opsView ? "bg-[#191f28] text-white" : "text-[#555555] hover:bg-[#f2f2ef]"}`}>
              내 업무
            </Link>
          </div>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-3">
          {me ? (
            <ClockCard />
          ) : (
            <Link href={actor.isMaster ? `/work/staff/${actor.id}` : "/work/attendance"} prefetch={false} className="text-[12px] text-[#6f6f6a] underline">
              직원 정보(입사일)를 등록하면 출퇴근이 시작됩니다
            </Link>
          )}
          <QuickButtons />
        </div>
      </div>

      {opsView ? <MasterHome actor={actor} today={today} schedule={schedule} /> : <StaffHome actor={actor} today={today} schedule={schedule} />}
    </div>
  )
}

// ───────── 직원 홈 ─────────
async function StaffHome({ actor, today, schedule }: { actor: WorkActor; today: string; schedule: CalendarItem[] }) {
  const month = today.slice(0, 7)
  const [h, progress] = await Promise.all([loadStaffHome(actor), clinicProgress(actor.clinics, month)])
  const meRef = { id: actor.id, name: actor.name }

  return (
    <>
      {/* 2. 요약 */}
      <div className="grid grid-cols-3 rounded border border-[#d1d1cc] bg-white divide-x divide-[#ecece9]">
        <Stat href="/work/tasks?assignee=me&due=overdue" label="마감 지남" value={h.counts.overdue} tone="red" />
        <Stat href="/work/tasks?assignee=me&due=today" label="오늘 마감" value={h.counts.dueToday} tone="blue" />
        <Stat href="/work/tasks?assignee=me&status=IN_REVIEW" label="내 검토 대기" value={h.counts.inReview} tone="orange" />
      </div>

      {/* 3. 업무 / 일정·요청 */}
      <div className={GRID}>
        <Section title="내가 처리할 업무" note={`진행 중 ${h.counts.open}건${h.counts.later ? ` · 다음 주 이후 ${h.counts.later}건` : ""}`} link={{ href: "/work/board", label: "업무 보드" }}>
          {h.firstUse ? (
            <FirstUseGuide guide={h.guide} />
          ) : h.tasks.length === 0 ? (
            <div className="px-4 py-6 text-[14px] text-[#6f6f6a]">
              오늘 마감할 업무가 없습니다.
              <Link href="/work/tasks?assignee=me" prefetch={false} className="ml-2 text-[13px] text-[#0062ff] hover:underline">
                이번 주 보기
              </Link>
            </div>
          ) : (
            <TaskLanes tasks={h.tasks} today={today} me={meRef} />
          )}
        </Section>

        <div className="space-y-4">
          <Schedule items={schedule} />
          <Section title="내가 담당하는 원장 요청" link={{ href: "/work/tasks?assignee=me", label: "전체" }}>
            {h.requests.length === 0 ? (
              <Empty>처리할 원장 요청이 없습니다.</Empty>
            ) : (
              <ul className="divide-y divide-[#f2f2ef]">
                {h.requests.map((r) => (
                  <li key={r.id} className="px-4 py-2 text-[14px]">
                    <Link href={`/dashboard/${r.clinicId}/requests`} prefetch={false} className="line-clamp-1 hover:underline">
                      {r.title}
                    </Link>
                    <span className="block text-[12px] text-[#8a8a84]">
                      {r.clinicName} · {REQUEST_STATUS[r.status] ?? r.status} · {shortDay(r.created)} 접수
                      {r.due && ` · ${shortDay(r.due)} 희망`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>

      {/* 4. 계약 진행률 / 7일 완료량 */}
      <div className={GRID}>
        <Section title="담당 치과 월 계약 진행률" note={`${Number(month.slice(5))}월`} link={{ href: "/work/clinics", label: "치과별 월 현황" }}>
          {progress.length === 0 ? <Empty>배정된 치과가 없습니다. 대표에게 담당 치과 배정을 요청하세요.</Empty> : <QuotaBars rows={progress} elapsed={monthElapsed(today)} month={month} master={actor.isMaster} />}
        </Section>
        <Section title="최근 7일 완료량" note="마감 예정과 비교">
          <WeekBars data={h.week} />
        </Section>
      </div>
    </>
  )
}

function FirstUseGuide({ guide }: { guide: { clinics: boolean; task: boolean; event: boolean } }) {
  const step = (n: number, done: boolean, title: string, action: React.ReactNode) => (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[12px] tabular-nums ${done ? "border-[#1a7f37] text-[#1a7f37]" : "border-[#d1d1cc] text-[#6f6f6a]"}`}>{done ? "✓" : n}</span>
      <span className={`flex-1 text-[14px] ${done ? "text-[#8a8a84]" : ""}`}>{title}</span>
      <span className="text-[13px]">{action}</span>
    </li>
  )
  return (
    <div>
      <p className="px-4 pt-3 text-[13px] text-[#6f6f6a]">처음 오셨네요. 세 가지만 하면 오늘 할 일이 여기에 모입니다.</p>
      <ol className="divide-y divide-[#f2f2ef]">
        {step(1, guide.clinics, "담당 치과 확인", <Link href="/work/clinics" prefetch={false} className="text-[#0062ff] hover:underline">치과 보기</Link>)}
        {step(2, guide.task, "첫 업무 만들기", <QuickAddLink kind="task">+ 업무</QuickAddLink>)}
        {step(3, guide.event, "일정 등록", <QuickAddLink kind="event">+ 일정</QuickAddLink>)}
      </ol>
    </div>
  )
}

// ───────── 대표 홈 ─────────
async function MasterHome({ actor, today, schedule }: { actor: WorkActor; today: string; schedule: CalendarItem[] }) {
  const m = await loadMasterHome(actor)
  const month = today.slice(0, 7)
  const inN = m.roster.filter((r) => r.state === "IN" || r.state === "OUT")
  const leaveN = m.roster.filter((r) => r.state === "LEAVE")
  const absentN = m.roster.filter((r) => r.state === "ABSENT")

  return (
    <>
      {/* 2. 요약 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 rounded border border-[#d1d1cc] bg-white divide-x divide-[#ecece9]">
        <Stat href="/work/tasks?due=overdue" label="지연 업무" value={m.counts.late} tone="red" />
        <Stat href="/work/tasks?assignee=none" label="미배정" value={m.counts.unassigned} tone="orange" />
        <Stat href="/work/clinics" label="진행 부족 치과" value={m.counts.behind} tone="red" unit="곳" />
        <Stat href="/work/billing" label="미입금 금액" value={m.counts.unpaid} tone="red" unit="원" money />
      </div>

      {/* 3. 운영 문제 / 승인·근무·일정 */}
      <div className={GRID}>
        <Section title="지금 확인할 운영 문제" note={m.issueTotal > 5 ? `상위 5건 · 전체 ${m.issueTotal}건` : undefined} link={{ href: "/work/board", label: "업무 보드" }}>
          {m.issues.length === 0 ? (
            <Empty>지금 확인할 운영 문제가 없습니다.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-[13px]">
                <thead>
                  <tr className="border-b border-[#ecece9] text-left text-[12px] text-[#6f6f6a]">
                    <th className="px-4 py-2 font-medium">치과</th>
                    <th className="px-2 py-2 font-medium">문제</th>
                    <th className="px-2 py-2 font-medium">담당자</th>
                    <th className="px-2 py-2 font-medium">기한</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {m.issues.map((i) => (
                    <tr key={i.key} className="border-b border-[#f2f2ef] last:border-0">
                      <td className="max-w-[140px] truncate px-4 py-2.5 font-medium">{i.clinic}</td>
                      <td className="px-2 py-2.5">{i.problem}</td>
                      <td className="max-w-[120px] truncate px-2 py-2.5 text-[#555555]">{i.owner}</td>
                      <td className={`whitespace-nowrap px-2 py-2.5 tabular-nums ${i.due.late ? "text-[#d92d20]" : "text-[#6f6f6a]"}`}>{i.due.text}</td>
                      <td className="px-4 py-2.5 text-right">
                        <Link href={i.action.href} prefetch={false} className="inline-flex h-7 items-center whitespace-nowrap rounded border border-[#d1d1cc] px-2.5 text-[12px] hover:bg-[#f2f2ef]">
                          {i.action.label}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <div className="space-y-4">
          <Section title="승인 대기">
            <ul className="divide-y divide-[#f2f2ef]">
              <ApprovalRow href="/work/leave" label="연차 승인" value={m.approvals.leave} />
              <ApprovalRow href="/work/billing" label="입금 확인" value={m.approvals.payment} />
              <ApprovalRow href="/work/presence" label="재택 미인증(7일)" value={m.approvals.missed} />
            </ul>
          </Section>

          <Section title="오늘 근무" link={{ href: "/work/attendance", label: "출퇴근" }}>
            {m.roster.length === 0 ? (
              <Empty>오늘 근무 예정 직원이 없습니다.</Empty>
            ) : (
              <div className="px-4 py-2.5 space-y-1.5 text-[13px]">
                <RosterLine label="출근" tone="text-[#1a7f37]" people={inN.map((r) => `${r.name}${r.remote ? "(재택)" : ""} ${r.time}${r.late ? " 지각" : ""}`)} />
                <RosterLine label="연차" tone="text-[#b54708]" people={leaveN.map((r) => `${r.name}${r.leaveLabel !== "연차" ? `(${r.leaveLabel})` : ""}`)} />
                <RosterLine label="미출근" tone="text-[#d92d20]" people={absentN.map((r) => r.name)} />
              </div>
            )}
          </Section>

          <Schedule items={schedule} />
        </div>
      </div>

      {/* 4. 계약 진행률 / 상태 분포 */}
      <div className={GRID}>
        <Section title="전체 치과 월 계약 진행률" note={`${Number(month.slice(5))}월 · 진도 낮은 순`} link={{ href: "/work/clinics", label: "치과별 월 현황" }}>
          {m.progress.length === 0 ? <Empty>등록된 치과가 없습니다.</Empty> : <QuotaBars rows={m.progress} elapsed={m.elapsed} month={month} master />}
        </Section>
        <Section title="업무 상태 분포" note="진행 중 + 이번 달 완료" link={{ href: "/work/board", label: "보드" }}>
          <StatusBar counts={m.status} />
        </Section>
      </div>

      {/* 5. 히트맵 */}
      <Section title="직원별 향후 14일 마감" note="칸 = 그날 마감인 미완료 업무 수">
        <DueHeatmap days={m.heat.days} rows={m.heat.rows} />
      </Section>
    </>
  )
}

// ───────── 공통 부품 ─────────
function Schedule({ items }: { items: CalendarItem[] }) {
  return (
    <Section title="오늘 일정" link={{ href: "/work/calendar", label: "달력" }}>
      {items.length === 0 ? (
        <div className="px-4 py-3 text-[13px] text-[#8a8a84]">
          오늘 잡힌 일정이 없습니다.
          <QuickAddLink kind="event" className="ml-2">
            + 일정 추가
          </QuickAddLink>
        </div>
      ) : (
        <ul className="divide-y divide-[#f2f2ef]">
          {items.map((i) => (
            <li key={`${i.kind}${i.id}`} className="flex gap-2 px-4 py-2 text-[14px]">
              <span className={`w-[44px] shrink-0 pt-0.5 text-[12px] tabular-nums ${i.kind === "LEAVE" ? "text-[#b54708]" : i.kind === "PAYMENT" ? "text-[#1a7f37]" : "text-[#0062ff]"}`}>
                {i.kind === "LEAVE" ? "연차" : i.kind === "PAYMENT" ? "결제" : i.time ?? "종일"}
              </span>
              <span className="min-w-0">
                {i.link ? (
                  <Link href={i.link} prefetch={false} className="hover:underline">
                    {i.title}
                  </Link>
                ) : (
                  i.title
                )}
                {(i.clinicName || i.sub) && <span className="block truncate text-[12px] text-[#8a8a84]">{[i.clinicName, i.sub].filter(Boolean).join(" · ")}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

function Section({ title, note, link, children }: { title: string; note?: string; link?: { href: string; label: string }; children: React.ReactNode }) {
  return (
    <section className="rounded border border-[#d1d1cc] bg-white">
      <div className="flex h-11 items-center border-b border-[#ecece9] px-4">
        <h2 className="text-[15px] font-bold">{title}</h2>
        {note && <span className="ml-2 truncate text-[12px] text-[#8a8a84]">{note}</span>}
        {link && (
          <Link href={link.href} prefetch={false} className="ml-auto shrink-0 text-[13px] text-[#0062ff] hover:underline">
            {link.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}

const TONE = { red: "text-[#d92d20]", blue: "text-[#0062ff]", orange: "text-[#b54708]" }
function Stat({ href, label, value, tone, unit = "건", money = false }: { href: string; label: string; value: number; tone: keyof typeof TONE; unit?: string; money?: boolean }) {
  return (
    <Link href={href} prefetch={false} className="px-4 py-3 hover:bg-[#fafaf8]">
      <div className="text-[13px] text-[#6f6f6a]">{label}</div>
      <div className={`mt-0.5 text-[24px] font-bold leading-tight tabular-nums ${value ? TONE[tone] : "text-[#c4c4be]"}`}>
        {money ? value.toLocaleString("ko-KR") : value}
        <span className="ml-0.5 text-[13px] font-normal text-[#8a8a84]">{unit}</span>
      </div>
    </Link>
  )
}

function ApprovalRow({ href, label, value }: { href: string; label: string; value: number }) {
  return (
    <li>
      <Link href={href} prefetch={false} className="flex items-center px-4 py-2 text-[14px] hover:bg-[#fafaf8]">
        <span className="flex-1">{label}</span>
        <span className={`tabular-nums ${value ? "font-bold text-[#b54708]" : "text-[#c4c4be]"}`}>{value}</span>
        <span className="ml-2 text-[#c4c4be]">›</span>
      </Link>
    </li>
  )
}

function RosterLine({ label, tone, people }: { label: string; tone: string; people: string[] }) {
  return (
    <div className="flex gap-2">
      <span className={`w-[52px] shrink-0 ${tone}`}>
        {label} <b className="tabular-nums">{people.length}</b>
      </span>
      <span className="min-w-0 text-[#555555]">{people.length ? people.join(", ") : "-"}</span>
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-4 text-[13px] text-[#8a8a84]">{children}</p>
}

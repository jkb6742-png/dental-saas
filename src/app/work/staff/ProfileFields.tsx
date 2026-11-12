"use client"

import { field } from "../ui"

// 직원 기본정보 입력칸(추가·상세 공용). 개인정보 최소수집: 생년월일·계좌·주민번호·주소는 받지 않는다.
export type Profile = {
  name: string
  email?: string
  hiredOn: string
  leftOn: string
  jobTitle: string
  phone: string
  employmentType: string
  workMode: "OFFICE" | "REMOTE"
  workStart: string
  workEnd: string
  workWeekdays: number[]
  weeklyHours: string
  memo: string
}
export const EMPTY_PROFILE: Profile = {
  name: "",
  hiredOn: "",
  leftOn: "",
  jobTitle: "",
  phone: "",
  employmentType: "정규직",
  workMode: "OFFICE",
  workStart: "09:00",
  workEnd: "18:00",
  workWeekdays: [1, 2, 3, 4, 5],
  weeklyHours: "40",
  memo: "",
}
const DAYS = ["월", "화", "수", "목", "금", "토", "일"]

function Row({ label, need, children }: { label: string; need?: boolean; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_1fr] items-center gap-2 py-1.5 border-b border-[#ecece9] last:border-0">
      <span className="text-[13px] text-[#555555]">
        {label}
        {need && <span className="text-[#d92d20]"> *</span>}
      </span>
      <span className="min-w-0">{children}</span>
    </div>
  )
}

export default function ProfileFields({ v, set, withLeft = true }: { v: Profile; set: (p: Profile) => void; withLeft?: boolean }) {
  const u = <K extends keyof Profile>(k: K, val: Profile[K]) => set({ ...v, [k]: val })
  return (
    <div>
      <Row label="이름" need>
        <input aria-label="이름" className={`${field} w-full`} value={v.name} onChange={(e) => u("name", e.target.value)} />
      </Row>
      {v.email !== undefined && (
        <Row label="로그인 이메일" need>
          <input aria-label="로그인 이메일" className={`${field} w-full`} value={v.email} onChange={(e) => u("email", e.target.value)} />
        </Row>
      )}
      <Row label="직무">
        <input aria-label="직무" className={`${field} w-full`} placeholder="예: 블로그 마케터" value={v.jobTitle} onChange={(e) => u("jobTitle", e.target.value)} />
      </Row>
      <Row label="입사일" need>
        <input aria-label="입사일" type="date" className={field} value={v.hiredOn} onChange={(e) => u("hiredOn", e.target.value)} />
      </Row>
      {withLeft && (
        <Row label="퇴사일">
          <input aria-label="퇴사일" type="date" className={field} value={v.leftOn} onChange={(e) => u("leftOn", e.target.value)} />
        </Row>
      )}
      <Row label="고용형태">
        <select aria-label="고용형태" className={field} value={v.employmentType} onChange={(e) => u("employmentType", e.target.value)}>
          {["정규직", "수습", "계약직", "파트타임", "프리랜서"].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </Row>
      <Row label="근무 방식" need>
        <span className="flex gap-4 text-[14px]">
          <label className="flex items-center gap-1">
            <input type="radio" checked={v.workMode === "OFFICE"} onChange={() => u("workMode", "OFFICE")} /> 사무실
          </label>
          <label className="flex items-center gap-1">
            <input type="radio" checked={v.workMode === "REMOTE"} onChange={() => u("workMode", "REMOTE")} /> 재택
          </label>
        </span>
      </Row>
      <Row label="근무 시간" need>
        <span className="flex items-center gap-1">
          <input aria-label="출근 시각" type="time" className={field} value={v.workStart} onChange={(e) => u("workStart", e.target.value)} />
          <span className="text-[#6f6f6a]">~</span>
          <input aria-label="퇴근 시각" type="time" className={field} value={v.workEnd} onChange={(e) => u("workEnd", e.target.value)} />
        </span>
      </Row>
      <Row label="근무 요일" need>
        <span className="flex flex-wrap gap-2 text-[14px]">
          {DAYS.map((d, i) => (
            <label key={d} className="flex items-center gap-0.5">
              <input
                type="checkbox"
                checked={v.workWeekdays.includes(i + 1)}
                onChange={(e) => u("workWeekdays", e.target.checked ? [...v.workWeekdays, i + 1] : v.workWeekdays.filter((x) => x !== i + 1))}
              />
              {d}
            </label>
          ))}
        </span>
      </Row>
      <Row label="주 소정근로" need>
        <span className="flex items-center gap-1 text-[14px]">
          <input aria-label="주 소정근로시간" type="number" min={1} max={52} className={`${field} w-[72px]`} value={v.weeklyHours} onChange={(e) => u("weeklyHours", e.target.value)} />
          시간
        </span>
      </Row>
      <Row label="휴대폰">
        <input aria-label="휴대폰" className={`${field} w-full`} placeholder="010-0000-0000" value={v.phone} onChange={(e) => u("phone", e.target.value)} />
      </Row>
      <Row label="메모">
        <textarea aria-label="메모" className="w-full min-h-[56px] px-2 py-1 rounded border border-[#d1d1cc] bg-white text-[14px]" value={v.memo} onChange={(e) => u("memo", e.target.value)} />
      </Row>
    </div>
  )
}

export const toPayload = (v: Profile) => ({ ...v, weeklyHours: Number(v.weeklyHours) })

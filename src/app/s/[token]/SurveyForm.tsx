"use client"

import { useEffect, useState } from "react"
import { Check } from "lucide-react"
import { AGE_RANGES, NA_LABEL, RECOMMEND_WORDS, SCALE, fillClinicName, splitDoctorName, type Doctor, type QuestionDef } from "@/lib/pei-survey/questions"

type Props = {
  token: string; title: string; slogan: string | null; logo: string | null; clinicName: string; intro: string | null
  doctors: Doctor[]; questions: QuestionDef[]
}

type Answer = string | number | string[]

// 같은 폰에서 7일 안에 다시 내지 않게 한다 — 다음 방문 때는 다시 참여할 수 있다
const RESUBMIT_DAYS = 7
const doneKey = (token: string) => `pei-done:${token}`

function submittedRecently(token: string) {
  try {
    const at = Number(localStorage.getItem(doneKey(token)))
    return at > 0 && Date.now() - at < RESUBMIT_DAYS * 86400 * 1000
  } catch {
    return false
  }
}
const card = "bg-white rounded-2xl px-5 py-6"
const qTitle = "text-[16px] leading-[1.5] font-bold text-[#191f28]"
const reqMark = <span className="text-[#f04452] ml-0.5">*</span>

/** 하나만 고르는 선택지 — 왼쪽 동그라미에 체크 */
function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`w-full flex items-center gap-3 text-left px-4 py-3.5 rounded-xl border text-[15px] transition active:scale-[0.99] ${
        selected
          ? "border-[#3182f6] bg-[#e8f3ff] text-[#1b64da] font-semibold"
          : "border-[#e5e8eb] bg-white text-[#333d4b]"
      }`}
    >
      <span
        className={`shrink-0 w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center transition ${
          selected ? "bg-[#3182f6] border-[#3182f6]" : "bg-white border-[#d1d6db]"
        }`}
      >
        {selected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
      </span>
      <span>{children}</span>
    </button>
  )
}

/** 1~10 — 좌우로 끌어서 고른다. 처음엔 값 없음(가운데 흐린 손잡이) */
function RecommendSlider({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  const v = value ?? 5
  const pct = ((v - 1) / 9) * 100
  const pick = (e: React.SyntheticEvent<HTMLInputElement>) => onChange(Number(e.currentTarget.value))
  return (
    <div className="mt-5">
      <div className="text-center">
        <span className={`text-[40px] font-bold leading-none ${value == null ? "text-[#d1d6db]" : "text-[#3182f6]"}`}>
          {value ?? "-"}
        </span>
        <span className="ml-1 text-[15px] text-[#8b95a1]">/ 10</span>
        {value == null && <p className="mt-2 text-[13px] text-[#8b95a1]">손잡이를 좌우로 밀어 선택해 주세요</p>}
      </div>
      <input
        type="range"
        min={1}
        max={10}
        step={1}
        value={v}
        onChange={pick}
        onPointerUp={pick} // 손잡이를 움직이지 않고 눌러도 값이 정해지게
        aria-label="점수"
        style={{
          background: value == null ? "#e5e8eb" : `linear-gradient(to right, #3182f6 ${pct}%, #e5e8eb ${pct}%)`,
        }}
        className={`mt-6 w-full h-2 rounded-full appearance-none cursor-pointer touch-pan-y
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-8 [&::-webkit-slider-thumb]:h-8
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-[3px]
          [&::-webkit-slider-thumb]:shadow-md
          [&::-moz-range-thumb]:w-7 [&::-moz-range-thumb]:h-7 [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:shadow-md
          ${value == null
            ? "[&::-webkit-slider-thumb]:border-[#d1d6db] [&::-moz-range-thumb]:border-[#d1d6db]"
            : "[&::-webkit-slider-thumb]:border-[#3182f6] [&::-moz-range-thumb]:border-[#3182f6]"}`}
      />
      <div className="mt-3 flex justify-between px-[6px]">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`w-5 text-center text-[13px] ${value === n ? "font-bold text-[#3182f6]" : "text-[#8b95a1]"}`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[12px] text-[#8b95a1]">
        <span>전혀 그렇지 않다</span><span>매우 그렇다</span>
      </div>
    </div>
  )
}

/** 중복 선택용 — 왼쪽 체크 상자 */
function CheckChoice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`w-full flex items-center gap-3 text-left px-4 py-3.5 rounded-xl border text-[15px] transition active:scale-[0.99] ${
        selected ? "border-[#3182f6] bg-[#e8f3ff] text-[#1b64da] font-semibold" : "border-[#e5e8eb] bg-white text-[#333d4b]"
      }`}
    >
      <span
        className={`shrink-0 w-5 h-5 rounded-md border flex items-center justify-center text-[12px] text-white ${
          selected ? "bg-[#3182f6] border-[#3182f6]" : "bg-white border-[#d1d6db]"
        }`}
      >
        {selected && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
      </span>
      {children}
    </button>
  )
}

function DoctorCard({ doctor, selected, onClick }: { doctor: Doctor; selected: boolean; onClick: () => void }) {
  const { title, sub } = splitDoctorName(doctor.name)
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`w-full flex items-center gap-4 text-left rounded-2xl border-2 overflow-hidden p-2.5 pr-4 transition active:scale-[0.99] ${
        selected ? "border-[#3182f6] bg-[#e8f3ff]" : "border-[#e5e8eb] bg-white"
      }`}
    >
      <div className="shrink-0 w-32 aspect-[4/5] rounded-xl overflow-hidden bg-[#f2f4f6]">
        {doctor.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={doctor.photo} alt={title} className="w-full h-full object-cover object-top" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[36px] font-bold text-[#b0b8c1]">{title.charAt(0)}</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-[18px] font-bold leading-snug ${selected ? "text-[#1b64da]" : "text-[#191f28]"}`}>{title}</p>
        {sub && <p className="mt-1 text-[14px] leading-snug text-[#6b7684]">{sub}</p>}
      </div>
      <span
        className={`shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition ${
          selected ? "bg-[#3182f6] border-[#3182f6]" : "bg-white border-[#d1d6db]"
        }`}
      >
        {selected && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
      </span>
    </button>
  )
}

// 슬로건은 한 줄 — 글자 수에 맞춰 카드 폭(최대 448px, 좌우 여백 72px)을 넘지 않는 크기로
const sloganSize = (t: string) => {
  const units = [...t].reduce((n, ch) => n + (/\s/.test(ch) ? 0.3 : /[가-힣]/.test(ch) ? 1 : 0.6), 0) + 1 // 따옴표 2개
  return `min(19px, calc((min(100vw, 448px) - 72px) / ${units.toFixed(2)}))`
}

const fieldCls = "mt-4 w-full px-4 py-3 rounded-xl border border-[#e5e8eb] text-[15px] text-[#191f28] placeholder:text-[#b0b8c1] focus:outline-none focus:border-[#3182f6] resize-none"

const isAnswered = (v: Answer | undefined) =>
  v !== undefined && (Array.isArray(v) ? v.length > 0 : typeof v === "string" ? v.trim() !== "" : true)

export default function SurveyForm({ token, title, slogan, logo, clinicName, intro, doctors, questions: allQuestions }: Props) {
  // 의료진이 등록되지 않은 치과는 의료진 문항을 건너뛴다
  const questions = allQuestions.filter((q) => q.type !== "doctor" || doctors.length > 0)
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [website, setWebsite] = useState("") // 봇 차단용 숨은 칸
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)
  const [showMissing, setShowMissing] = useState(false)
  const [already, setAlready] = useState(false)

  useEffect(() => {
    if (submittedRecently(token)) setAlready(true)
  }, [token])

  const requiredQs = questions.filter((q) => q.required)
  const required = requiredQs.length
  const answered = requiredQs.filter((q) => isAnswered(answers[q.id])).length
  const missing = (cond: boolean) => showMissing && cond
  const set = (id: string, v: Answer) => setAnswers((p) => ({ ...p, [id]: v }))
  const toggle = (id: string, o: string) =>
    setAnswers((p) => {
      const cur = Array.isArray(p[id]) ? (p[id] as string[]) : []
      return { ...p, [id]: cur.includes(o) ? cur.filter((x) => x !== o) : [...cur, o] }
    })

  async function submit() {
    if (answered < required) {
      setShowMissing(true)
      setError(`응답하지 않은 문항이 ${required - answered}개 있습니다.`)
      const first = document.querySelector("[data-missing='true']")
      first?.scrollIntoView({ behavior: "smooth", block: "center" })
      return
    }
    setBusy(true)
    setError("")
    try {
      const res = await fetch(`/api/public/pei/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, website }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "제출하지 못했습니다. 다시 시도해 주세요.")
      try { localStorage.setItem(doneKey(token), String(Date.now())) } catch {}
      setDone(true)
      window.scrollTo({ top: 0 })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  function renderInput(q: QuestionDef) {
    const v = answers[q.id]
    switch (q.type) {
      case "single":
        return (
          <div className={`mt-4 ${(q.options ?? []).length === 2 && (q.options ?? []).every((o) => o.length <= 6) ? "grid grid-cols-2 gap-2" : "space-y-2"}`}>
            {(q.options ?? []).map((o) => (
              <Choice key={o} selected={v === o} onClick={() => set(q.id, o)}>
                {o}
                {q.id === "age" && AGE_RANGES[o] && <span className={v === o ? "font-normal" : "text-[#8b95a1]"}> ({AGE_RANGES[o]})</span>}
              </Choice>
            ))}
          </div>
        )
      case "multi":
        return (
          <div className="mt-4 space-y-2">
            {(q.options ?? []).map((o) => (
              <CheckChoice key={o} selected={Array.isArray(v) && v.includes(o)} onClick={() => toggle(q.id, o)}>{o}</CheckChoice>
            ))}
          </div>
        )
      case "doctor":
        return (
          <div className="mt-4 space-y-2.5">
            {doctors.map((d) => <DoctorCard key={d.name} doctor={d} selected={v === d.name} onClick={() => set(q.id, d.name)} />)}
          </div>
        )
      case "scale5":
        return (
          <div className="mt-4 space-y-2">
            {SCALE.map((s) => <Choice key={s.value} selected={v === s.value} onClick={() => set(q.id, s.value)}>{s.label}</Choice>)}
            {q.allowNA && <Choice selected={v === 0} onClick={() => set(q.id, 0)}>{NA_LABEL.replace(/\s*X$/, "")}</Choice>}
          </div>
        )
      case "scale10":
        if (q.words) {
          return (
            <div className="mt-4 space-y-2">
              {RECOMMEND_WORDS.map((w) => <Choice key={w.value} selected={v === w.value} onClick={() => set(q.id, w.value)}>{w.label}</Choice>)}
            </div>
          )
        }
        return <RecommendSlider value={typeof v === "number" ? v : null} onChange={(n) => set(q.id, n)} />
      case "short":
        return (
          <input
            value={typeof v === "string" ? v : ""}
            onChange={(e) => set(q.id, e.target.value)}
            maxLength={300}
            placeholder={q.required ? "입력해 주세요" : "입력해 주세요 (선택)"}
            className={fieldCls}
          />
        )
      case "long":
        return (
          <textarea
            value={typeof v === "string" ? v : ""}
            onChange={(e) => set(q.id, e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder={q.required ? "자유롭게 적어주세요" : "자유롭게 적어주세요 (선택)"}
            className={fieldCls}
          />
        )
    }
  }

  if (done || already) {
    return (
      <main className="min-h-full bg-[#f2f4f6] flex items-center justify-center px-5 py-10">
        <div className="bg-white rounded-2xl px-6 py-10 text-center max-w-md w-full">
          <div className="mx-auto w-14 h-14 rounded-full bg-[#e8f3ff] flex items-center justify-center text-[28px]">✓</div>
          <p className="mt-5 text-[20px] font-bold text-[#191f28]">{done ? "소중한 의견 감사합니다" : "이미 참여해 주셨습니다"}</p>
          <p className="mt-2 text-[15px] leading-relaxed text-[#6b7684]">
            남겨주신 내용은 {clinicName}의<br />진료 환경 개선에 반영하겠습니다.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-full bg-[#f2f4f6]">
      {/* 진행률 */}
      <div className="sticky top-0 z-10 bg-[#f2f4f6]/95 backdrop-blur">
        <div className="max-w-md mx-auto px-4 pt-3 pb-2">
          <div className="h-1.5 rounded-full bg-[#e5e8eb] overflow-hidden">
            <div className="h-full bg-[#3182f6] transition-all" style={{ width: `${required ? (answered / required) * 100 : 100}%` }} />
          </div>
          <p className="mt-1.5 text-right text-[12px] text-[#8b95a1]">{answered} / {required}</p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 pb-12 space-y-3">
        {/* 치과 영역 — 로고(없으면 치과명) + 슬로건, 가운데 정렬 */}
        <header className={`${card} py-7 text-center`}>
          <div className="h-14 flex items-center justify-center">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt={clinicName} className="max-h-14 max-w-[260px] object-contain" />
            ) : (
              <p className="text-[20px] font-bold text-[#3182f6]">{clinicName}</p>
            )}
          </div>
          {slogan && (
            <>
              {/* 슬로건용 명조체 — next/font 는 한글 서브셋을 못 받아 구글 폰트 CSS 를 직접 씀 */}
              <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@600&display=swap" precedence="default" />
              <p className="mt-5 font-semibold leading-snug tracking-tight text-[#3b4f9a] whitespace-nowrap" style={{ fontFamily: '"Noto Serif KR", serif', fontSize: sloganSize(slogan) }}>
                &ldquo;{slogan}&rdquo;
              </p>
            </>
          )}
        </header>

        {/* 설문 영역 */}
        <section className={card}>
          <h1 className="text-[22px] font-bold text-[#191f28]">{title}</h1>
          {intro && <p className="mt-3 text-[14px] leading-relaxed text-[#4e5968] whitespace-pre-line">{intro}</p>}
        </section>

        {questions.map((q, i) => {
          const miss = q.required && missing(!isAnswered(answers[q.id]))
          return (
            <section key={q.id} className={card} data-missing={miss}>
              <p className={qTitle}>{i + 1}. {fillClinicName(q.text, clinicName)}{q.required && reqMark}</p>
              {renderInput(q)}
              {miss && <p className="mt-2 text-[13px] text-[#f04452]">{q.type === "multi" ? "하나 이상 선택해 주세요" : q.type === "short" || q.type === "long" ? "입력해 주세요" : "선택해 주세요"}</p>}
            </section>
          )
        })}

        <input
          type="text" tabIndex={-1} autoComplete="off" aria-hidden="true"
          value={website} onChange={(e) => setWebsite(e.target.value)}
          className="absolute -left-[9999px] h-0 w-0 opacity-0"
        />

        {error && <p className="px-1 text-[14px] text-[#f04452]">{error}</p>}

        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="w-full h-14 rounded-2xl bg-[#3182f6] text-white text-[17px] font-bold disabled:opacity-60 active:bg-[#1b64da] transition"
        >
          {busy ? "제출 중…" : "제출하기"}
        </button>
        <p className="text-center text-[12px] text-[#b0b8c1]">응답은 익명으로 처리됩니다</p>
      </div>
    </main>
  )
}

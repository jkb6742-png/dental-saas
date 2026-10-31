"use client"

// 설문 편집 — 구글폼처럼 문항 카드마다 문구·유형·선택지·필수를 고치고, 문항을 더하거나 빼고 순서를 바꾼다.
import { useRef, useState } from "react"
import { ArrowDown, ArrowUp, Camera, Copy, ExternalLink, GripVertical, Plus, RefreshCw, Trash2, X } from "lucide-react"
import Button from "@/components/ui/Button"
import {
  AGE_RANGES, BUILTIN, CUSTOM_TYPES, DEFAULT_TREATMENTS, NA_LABEL, QTYPE_LABEL, SCALE, defaultQuestions, isBuiltin,
  newQuestionId, type Doctor, type QType, type QuestionDef,
} from "@/lib/pei-survey/questions"
import type { SurveyDTO } from "@/lib/pei-survey/service"

const card = "bg-white rounded-2xl shadow-[0_1px_3px_0_rgb(0_0_0/0.06)]"
const inputCls = "w-full px-3.5 py-2.5 rounded-[10px] border border-[#e5e8eb] bg-white text-[14px] text-[#191f28] placeholder:text-[#b0b8c1] focus:outline-none focus:border-[#3182f6] focus:ring-2 focus:ring-[#3182f6]/15 transition"
const labelCls = "block text-[13px] font-semibold text-[#4e5968] mb-1.5"
const lineInput = "w-full bg-transparent border-b border-[#e5e8eb] focus:border-[#3182f6] focus:outline-none py-1.5 text-[14px] text-[#191f28] placeholder:text-[#b0b8c1]"

const toLoginIf401 = (res: Response) => {
  if (res.status === 401 && typeof window !== "undefined") {
    window.location.href = `/login?callbackUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`
    return true
  }
  return false
}

/** 올리기 전에 브라우저에서 4:5 로 가운데·위쪽 기준 자르고 400×500 JPG 로 줄인다 */
async function toPortraitJpeg(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((ok, fail) => {
      const i = new Image()
      i.onload = () => ok(i)
      i.onerror = () => fail(new Error("이미지를 읽지 못했습니다"))
      i.src = url
    })
    const W = 400, H = 500
    const scale = Math.max(W / img.width, H / img.height)
    const sw = W / scale, sh = H / scale
    const sx = (img.width - sw) / 2
    const sy = Math.max(0, (img.height - sh) * 0.15) // 얼굴이 잘리지 않게 위쪽 위주
    const canvas = document.createElement("canvas")
    canvas.width = W
    canvas.height = H
    canvas.getContext("2d")!.drawImage(img, sx, sy, sw, sh, 0, 0, W, H)
    return await new Promise<Blob>((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error("변환 실패"))), "image/jpeg", 0.88))
  } finally {
    URL.revokeObjectURL(url)
  }
}

const move = <T,>(list: T[], i: number, dir: -1 | 1) => {
  const j = i + dir
  if (j < 0 || j >= list.length) return list
  const next = [...list]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

export default function SurveyEditor({ clinicId, survey, link, onSaved }: {
  clinicId: string; survey: SurveyDTO; link: string; onSaved: (s: SurveyDTO, text: string) => void
}) {
  const [title, setTitle] = useState(survey.title)
  const [slogan, setSlogan] = useState(survey.slogan ?? "")
  const [slug, setSlug] = useState(survey.slug ?? "")
  const [logo, setLogo] = useState<string | null>(survey.logo)
  const [intro, setIntro] = useState(survey.intro ?? "")
  const [doctors, setDoctors] = useState<Doctor[]>(survey.doctors)
  const [questions, setQuestions] = useState<QuestionDef[]>(survey.questions)
  const [isActive, setIsActive] = useState(survey.isActive)
  const [active, setActive] = useState<string | null>(null) // 펼쳐서 고치는 중인 문항
  const [uploading, setUploading] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  const [dirty, setDirty] = useState(false)
  const logoRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const uploadIdx = useRef<number | null>(null)
  const focusNext = useRef<string | null>(null) // 엔터로 새 선택지 칸을 만들면 그 칸으로 커서 이동

  const touch = <A extends unknown[]>(fn: (...a: A) => void) => (...a: A) => { setDirty(true); fn(...a) }
  const setQ = touch((id: string, patch: Partial<QuestionDef>) => setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q))))
  const removeQ = touch((id: string) => setQuestions((qs) => qs.filter((q) => q.id !== id)))
  const moveQ = touch((i: number, dir: -1 | 1) => setQuestions((qs) => move(qs, i, dir)))
  const insertQ = touch((at: number, q: QuestionDef) => {
    setQuestions((qs) => [...qs.slice(0, at), q, ...qs.slice(at)])
    setActive(q.id)
  })
  const addCustom = (at: number) => insertQ(at, { id: newQuestionId(), type: "single", text: "", required: true, options: ["선택지 1"] })
  const duplicate = (i: number) => {
    const q = questions[i]
    insertQ(i + 1, { ...q, id: newQuestionId(), type: q.type === "doctor" ? "single" : q.type, text: `${q.text} (사본)`, options: q.options ? [...q.options] : q.type === "doctor" ? ["선택지 1"] : undefined })
  }
  // 지운 기본 문항(PEI 점수 항목 등)은 다시 넣을 수 있게
  const defaults = defaultQuestions(survey.facilityQuestion, survey.treatments.length ? survey.treatments : DEFAULT_TREATMENTS)
  const missingBuiltins = defaults.filter((d) => !questions.some((q) => q.id === d.id))

  const setDoctor = touch((i: number, patch: Partial<Doctor>) => setDoctors((ds) => ds.map((d, j) => (j === i ? { ...d, ...patch } : d))))

  const save = async (extra: Record<string, unknown> = {}, okText = "설문을 저장했습니다. 환자 화면에 바로 반영됩니다.") => {
    const blank = questions.find((q) => !q.text.trim())
    if (blank) { setActive(blank.id); setErr("질문 문구가 비어 있는 문항이 있습니다"); return }
    setBusy(true); setErr("")
    try {
      const res = await fetch("/api/pei-survey", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinicId, slug, title, slogan, logo, intro, isActive,
          doctors: doctors.filter((d) => d.name.trim()),
          questions: questions.map((q) => (q.options ? { ...q, options: q.options.map((o) => o.trim()).filter(Boolean) } : q)),
          ...extra,
        }),
      })
      if (toLoginIf401(res)) return
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "저장하지 못했습니다")
      setQuestions(json.survey.questions)
      setDirty(false)
      onSaved(json.survey, okText)
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  const upload = async (file: File | Blob, name: string, type: string) => {
    const fd = new FormData()
    fd.append("clinicId", clinicId)
    fd.append("file", new File([file], name, { type }))
    const res = await fetch("/api/pei-survey/photo", { method: "POST", body: fd })
    if (toLoginIf401(res)) return null
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || "사진을 올리지 못했습니다")
    return json.url as string
  }

  // 로고는 자르지 않고 원본 그대로(투명 PNG 유지)
  const onLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setUploading(-1); setErr("")
    try {
      const url = await upload(file, file.name, file.type)
      if (url) { setLogo(url); setDirty(true) }
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setUploading(null)
    }
  }

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const i = uploadIdx.current
    e.target.value = ""
    if (!file || i == null) return
    setUploading(i); setErr("")
    try {
      const url = await upload(await toPortraitJpeg(file), "photo.jpg", "image/jpeg")
      if (url) setDoctor(i, { photo: url })
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setUploading(null)
    }
  }

  const doctorEditor = (
    <div className="mt-3 space-y-2">
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onPhoto} />
      {doctors.map((d, i) => (
        <div key={i} className="flex items-center gap-2.5 rounded-xl border border-[#e5e8eb] p-2">
          <button
            type="button"
            onClick={() => { uploadIdx.current = i; fileRef.current?.click() }}
            className="relative w-12 h-[60px] rounded-lg bg-[#f2f4f6] overflow-hidden shrink-0 flex items-center justify-center"
            title="사진 올리기"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {d.photo ? <img src={d.photo} alt="" className="w-full h-full object-cover object-top" /> : <Camera className="w-4 h-4 text-[#8b95a1]" />}
            {uploading === i && <span className="absolute inset-0 bg-white/70 flex items-center justify-center text-[11px] text-[#4e5968]">올리는 중</span>}
          </button>
          <input value={d.name} onChange={(e) => setDoctor(i, { name: e.target.value })} className={`${inputCls} py-2`} placeholder="홍길동 원장 (치주과 전문의)" />
          <div className="flex flex-col shrink-0">
            <button type="button" onClick={touch(() => setDoctors((ds) => move(ds, i, -1)))} aria-label="위로" className="p-0.5 text-[#b0b8c1] hover:text-[#4e5968]"><ArrowUp className="w-3.5 h-3.5" /></button>
            <button type="button" onClick={touch(() => setDoctors((ds) => move(ds, i, 1)))} aria-label="아래로" className="p-0.5 text-[#b0b8c1] hover:text-[#4e5968]"><ArrowDown className="w-3.5 h-3.5" /></button>
          </div>
          <div className="flex flex-col shrink-0 gap-0.5">
            {d.photo && <button type="button" onClick={() => setDoctor(i, { photo: null })} className="text-[11px] text-[#8b95a1] hover:text-[#f04452]">사진삭제</button>}
            <button type="button" onClick={touch(() => setDoctors((ds) => ds.filter((_, j) => j !== i)))} aria-label="의료진 삭제" className="p-0.5 text-[#b0b8c1] hover:text-[#f04452] self-end">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={touch(() => setDoctors((ds) => [...ds, { name: "", photo: null }]))}
        className="w-full flex items-center justify-center gap-1 py-2.5 rounded-xl border border-dashed border-[#d1d6db] text-[13px] text-[#4e5968] hover:bg-[#f9fafb]"
      >
        <Plus className="w-4 h-4" />의료진 추가
      </button>
      <p className="text-[12px] text-[#8b95a1]">사진 칸을 눌러 올립니다(세로 4:5로 자동 맞춤). 괄호 안은 전공으로 작게 표시됩니다.</p>
    </div>
  )

  /** 펼친 카드 — 선택지 목록을 칸마다 직접 입력, 추가·삭제·순서 */
  const optionEditor = (q: QuestionDef) => {
    const opts = q.options ?? []
    const setOpts = (next: string[]) => setQ(q.id, { options: next })
    return (
      <div className="mt-3 space-y-1.5">
        {opts.map((o, i) => (
          <div key={i} className="group flex items-center gap-2">
            <span className={`shrink-0 w-4 h-4 border-2 border-[#d1d6db] ${q.type === "multi" ? "rounded" : "rounded-full"}`} />
            <input
              ref={(el) => {
                if (el && focusNext.current === `${q.id}:${i}`) { focusNext.current = null; el.focus() }
              }}
              value={o}
              onChange={(e) => setOpts(opts.map((x, j) => (j === i ? e.target.value : x)))}
              onKeyDown={(e) => {
                // 엔터로 다음 칸 추가 (구글폼처럼)
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  focusNext.current = `${q.id}:${i + 1}`
                  setOpts([...opts.slice(0, i + 1), "", ...opts.slice(i + 1)])
                }
              }}
              className={lineInput}
              placeholder={`선택지 ${i + 1}`}
            />
            {q.id === "age" && AGE_RANGES[o] && <span className="shrink-0 text-[12px] text-[#8b95a1]">({AGE_RANGES[o]})</span>}
            <button type="button" onClick={() => setOpts(move(opts, i, -1))} aria-label="위로" className="shrink-0 p-0.5 text-[#d1d6db] hover:text-[#4e5968]"><ArrowUp className="w-3.5 h-3.5" /></button>
            <button type="button" onClick={() => setOpts(move(opts, i, 1))} aria-label="아래로" className="shrink-0 p-0.5 text-[#d1d6db] hover:text-[#4e5968]"><ArrowDown className="w-3.5 h-3.5" /></button>
            <button type="button" onClick={() => setOpts(opts.filter((_, j) => j !== i))} aria-label="선택지 삭제" className="shrink-0 p-0.5 text-[#b0b8c1] hover:text-[#f04452]"><X className="w-4 h-4" /></button>
          </div>
        ))}
        <div className="flex items-center gap-3 pt-1">
          <button type="button" onClick={() => { focusNext.current = `${q.id}:${opts.length}`; setOpts([...opts, ""]) }} className="flex items-center gap-1 text-[13px] text-[#3182f6] font-semibold">
            <Plus className="w-3.5 h-3.5" />선택지 추가
          </button>
          {q.id === "treatment" && (
            <button type="button" onClick={() => setOpts([...DEFAULT_TREATMENTS])} className="text-[12px] text-[#8b95a1] hover:text-[#4e5968]">기본 진료 목록으로</button>
          )}
        </div>
      </div>
    )
  }

  /** 접힌 카드 — 환자에게 보이는 모습 미리보기 */
  const preview = (q: QuestionDef) => {
    const chip = "px-2.5 py-1 rounded-lg bg-[#f2f4f6] text-[12px] text-[#4e5968]"
    switch (q.type) {
      case "single":
      case "multi":
        return <div className="mt-2 flex flex-wrap gap-1.5">{(q.options ?? []).map((o) => <span key={o} className={chip}>{o}</span>)}</div>
      case "doctor":
        return <div className="mt-2 flex flex-wrap gap-1.5">{doctors.map((d) => <span key={d.name} className={chip}>{d.name.replace(/\s*\(.*\)$/, "")}</span>)}</div>
      case "scale5":
        return <div className="mt-2 flex flex-wrap gap-1.5">{SCALE.map((s) => <span key={s.value} className={chip}>{s.label}</span>)}{q.allowNA && <span className={chip}>{NA_LABEL.replace(/\s*X$/, "")}</span>}</div>
      case "scale10":
        return <p className="mt-2 text-[12px] text-[#8b95a1]">1 ~ 10 좌우로 밀어서 선택</p>
      default:
        return <p className="mt-2 text-[12px] text-[#8b95a1]">{q.type === "short" ? "짧은 글 입력" : "긴 글 입력"}</p>
    }
  }

  const addBar = (at: number) => (
    <div className="flex justify-center -my-1.5 relative z-[1]">
      <button
        type="button"
        onClick={() => addCustom(at)}
        className="flex items-center gap-1 px-3 py-1 rounded-full bg-white border border-[#e5e8eb] text-[12px] text-[#6b7684] shadow-sm opacity-60 hover:opacity-100 hover:text-[#3182f6] hover:border-[#3182f6] transition"
      >
        <Plus className="w-3.5 h-3.5" />여기에 질문 추가
      </button>
    </div>
  )

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
      <div className="space-y-3 max-w-3xl">
        {/* 머리 카드 */}
        <div className={`${card} p-5 border-t-[6px] border-[#3182f6]`}>
          <input value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true) }} className="w-full text-[22px] font-bold text-[#191f28] focus:outline-none border-b border-transparent focus:border-[#3182f6] pb-1" placeholder="설문 제목" />
          <input value={slogan} onChange={(e) => { setSlogan(e.target.value); setDirty(true) }} className={`${lineInput} mt-2`} placeholder="슬로건 (로고 아래 한 줄)" />
          <textarea value={intro} onChange={(e) => { setIntro(e.target.value); setDirty(true) }} rows={3} className={`${lineInput} mt-2 resize-none leading-relaxed`} placeholder="안내 문구" />
          <div className="mt-4 flex items-center gap-3">
            <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onLogo} />
            <button
              type="button"
              onClick={() => logoRef.current?.click()}
              className="h-14 w-[200px] rounded-xl border border-dashed border-[#d1d6db] bg-[#f9fafb] flex items-center justify-center overflow-hidden px-3"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {logo ? <img src={logo} alt="" className="max-h-10 max-w-full object-contain" />
                : <span className="text-[13px] text-[#8b95a1]">{uploading === -1 ? "올리는 중…" : "로고 올리기"}</span>}
            </button>
            {logo && <button type="button" onClick={() => { setLogo(null); setDirty(true) }} className="text-[12px] text-[#8b95a1] hover:text-[#f04452]">로고 삭제</button>}
            <p className="text-[12px] text-[#8b95a1]">배경 없는 가로형 PNG 권장</p>
          </div>
        </div>

        {questions.map((q, i) => {
          const open = active === q.id
          const builtin = isBuiltin(q.id)
          return (
            <div key={q.id}>
              {addBar(i)}
              <div
                className={`${card} p-5 transition ${open ? "ring-2 ring-[#3182f6]/40 border-l-[5px] border-[#3182f6]" : "cursor-pointer hover:shadow-md"}`}
                onClick={() => !open && setActive(q.id)}
              >
                <div className="flex items-start gap-3">
                  <GripVertical className="w-4 h-4 mt-1 text-[#d1d6db] shrink-0" />
                  <div className="min-w-0 flex-1">
                    {open ? (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <textarea
                          value={q.text}
                          onChange={(e) => setQ(q.id, { text: e.target.value })}
                          rows={2}
                          autoFocus={!q.text}
                          className="flex-1 px-3 py-2.5 rounded-lg bg-[#f9fafb] border-b-2 border-[#e5e8eb] focus:border-[#3182f6] focus:outline-none text-[15px] font-semibold text-[#191f28] resize-none"
                          placeholder="질문"
                        />
                        {builtin ? (
                          <span className="self-start shrink-0 px-2.5 py-2 rounded-lg bg-[#f2f4f6] text-[12px] text-[#6b7684]">{QTYPE_LABEL[q.type]}</span>
                        ) : (
                          <select
                            value={q.type}
                            onChange={(e) => {
                              const type = e.target.value as QType
                              setQ(q.id, {
                                type,
                                options: type === "single" || type === "multi" ? (q.options?.length ? q.options : ["선택지 1"]) : undefined,
                                allowNA: type === "scale5" ? !!q.allowNA : undefined,
                              })
                            }}
                            className={`${inputCls} sm:w-52 self-start`}
                          >
                            {CUSTOM_TYPES.map((t) => <option key={t} value={t}>{QTYPE_LABEL[t]}</option>)}
                          </select>
                        )}
                      </div>
                    ) : (
                      <p className="text-[15px] font-semibold text-[#191f28]">
                        {i + 1}. {q.text || <span className="text-[#b0b8c1]">(질문 없음)</span>}
                        {q.required && <span className="text-[#f04452] ml-0.5">*</span>}
                      </p>
                    )}
                    {builtin && (
                      <p className="mt-1.5 text-[11px] text-[#8b95a1]">
                        PEI 기본 문항 · {BUILTIN[q.id].label}{["visit", "gender", "age", "doctor", "treatment"].includes(q.id) ? " (통계에 쓰임)" : q.type === "scale5" || q.id === "recommend" ? " (PEI 점수에 들어감)" : ""}
                      </p>
                    )}
                    <div data-opts>
                      {open && (q.type === "single" || q.type === "multi") ? optionEditor(q) : open && q.type === "doctor" ? doctorEditor : preview(q)}
                    </div>
                  </div>
                </div>

                {open && (
                  <div className="mt-4 pt-3 border-t border-[#f2f4f6] flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
                    {q.type === "scale5" && (
                      <label className="flex items-center gap-1.5 text-[13px] text-[#4e5968] mr-auto">
                        <input type="checkbox" checked={!!q.allowNA} onChange={(e) => setQ(q.id, { allowNA: e.target.checked })} className="w-4 h-4 accent-[#3182f6]" />
                        &lsquo;경험 없음&rsquo; 선택지
                      </label>
                    )}
                    <button type="button" onClick={(e) => { e.stopPropagation(); moveQ(i, -1) }} disabled={i === 0} className="p-1 text-[#8b95a1] hover:text-[#191f28] disabled:opacity-30" aria-label="위로"><ArrowUp className="w-4 h-4" /></button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); moveQ(i, 1) }} disabled={i === questions.length - 1} className="p-1 text-[#8b95a1] hover:text-[#191f28] disabled:opacity-30" aria-label="아래로"><ArrowDown className="w-4 h-4" /></button>
                    <button type="button" onClick={() => duplicate(i)} className="p-1 text-[#8b95a1] hover:text-[#191f28]" title="복사"><Copy className="w-4 h-4" /></button>
                    <button
                      type="button"
                      onClick={() => {
                        if (builtin && !confirm(`'${BUILTIN[q.id].label}' 기본 문항을 지우면 이 항목은 더 이상 집계되지 않습니다. 지울까요?`)) return
                        removeQ(q.id)
                      }}
                      className="p-1 text-[#8b95a1] hover:text-[#f04452]"
                      title="삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <span className="w-px h-5 bg-[#e5e8eb]" />
                    <label className="flex items-center gap-2 text-[13px] text-[#4e5968]">
                      필수
                      <button
                        type="button"
                        role="switch"
                        aria-checked={q.required}
                        onClick={() => setQ(q.id, { required: !q.required })}
                        className={`relative w-9 h-5 rounded-full transition ${q.required ? "bg-[#3182f6]" : "bg-[#d1d6db]"}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${q.required ? "left-[18px]" : "left-0.5"}`} />
                      </button>
                    </label>
                    <button type="button" onClick={() => setActive(null)} className="text-[13px] font-semibold text-[#3182f6]">접기</button>
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {addBar(questions.length)}
        {missingBuiltins.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 px-1 pt-2">
            <span className="text-[12px] text-[#8b95a1]">지운 기본 문항 다시 넣기:</span>
            {missingBuiltins.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  // 원래 자리 근처(앞 기본 문항 뒤)에 넣는다
                  const order = defaults.map((x) => x.id)
                  const before = order.slice(0, order.indexOf(d.id)).reverse().find((id) => questions.some((q) => q.id === id))
                  insertQ(before ? questions.findIndex((q) => q.id === before) + 1 : 0, d)
                }}
                className="px-2.5 py-1 rounded-full border border-[#e5e8eb] bg-white text-[12px] text-[#4e5968] hover:border-[#3182f6] hover:text-[#3182f6]"
              >
                + {BUILTIN[d.id].label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 오른쪽 — 저장·링크 설정 */}
      <div className="space-y-3 lg:sticky lg:top-4">
        <div className={`${card} p-5 space-y-3`}>
          <Button onClick={() => save()} disabled={busy} className="w-full">{busy ? "저장 중…" : dirty ? "저장하기" : "저장됨"}</Button>
          {err && <p className="text-[13px] text-[#f04452]">{err}</p>}
          <a href={link || "#"} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 text-[13px] font-semibold text-[#3182f6]">
            <ExternalLink className="w-3.5 h-3.5" />환자 화면 열기 (저장된 내용)
          </a>
          <p className="text-[12px] leading-relaxed text-[#8b95a1]">
            문구·선택지를 바꿔도 이미 받은 응답은 그대로 남습니다. 기본 문항의 점수는 문구를 바꿔도 같은 항목으로 집계됩니다.
          </p>
        </div>
        <div className={`${card} p-5 space-y-4`}>
          <div>
            <label className={labelCls}>설문 주소</label>
            <div className="flex items-center rounded-[10px] border border-[#e5e8eb] focus-within:border-[#3182f6] overflow-hidden">
              <span className="pl-3 text-[13px] text-[#8b95a1] shrink-0">/</span>
              <input value={slug} onChange={(e) => { setSlug(e.target.value); setDirty(true) }} className="flex-1 min-w-0 py-2.5 pr-3 text-[14px] text-[#191f28] focus:outline-none" placeholder="하얀드림치과설문" />
            </div>
            <p className="mt-1 text-[12px] text-[#8b95a1]">한글·영문·숫자 2~30자. 바꾸면 예전 한글 주소는 열리지 않습니다.</p>
          </div>
          <label className="flex items-start gap-2 text-[13px] text-[#333d4b]">
            <input type="checkbox" checked={isActive} onChange={(e) => { setIsActive(e.target.checked); setDirty(true) }} className="mt-0.5 w-4 h-4 accent-[#3182f6]" />
            응답 받기 (끄면 &lsquo;진행 중인 설문이 아닙니다&rsquo;가 보입니다)
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => { if (confirm("링크를 새로 만들면 기존 영문 링크·QR은 더 이상 열리지 않습니다. 계속할까요?")) save({ regenerateToken: true }, "새 링크를 만들었습니다. 기존 영문 링크·QR은 이제 열리지 않습니다.") }}
            className="text-[12px] text-[#8b95a1] hover:text-[#f04452] flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />영문 링크 새로 만들기
          </button>
        </div>
      </div>
    </div>
  )
}

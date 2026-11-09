// PEI 자체 설문 정의 — 기존 구글폼(중산·디어스·지음 PEI)의 15문항을 그대로 옮겼다.
// 내보내기 CSV 앞 16열은 구글시트 응답과 같은 순서(타임스탬프 + 15문항)이고 17열에 받은 진료를 붙인다.
// 그래서 PEI 보고서 스킬(pei_data.py, 위치 기준으로 읽음)을 그대로 쓸 수 있다.

export const GENDERS = ["남자", "여자"] as const
export const AGE_GROUPS = ["10대 이하", "20대", "30대", "40대", "50대", "60대", "70대 이상"] as const
/** 화면 표기용 나이 범위. 저장값은 구글폼과 같은 AGE_GROUPS 그대로 둔다(CSV·보고서 호환). */
export const AGE_RANGES: Record<string, string> = {
  "10대 이하": "19세 이하", "20대": "20~29세", "30대": "30~39세", "40대": "40~49세",
  "50대": "50~59세", "60대": "60~69세", "70대 이상": "70세 이상",
}

// 의료진 선택지. name 은 응답에 그대로 저장되는 표기("조은정 대표원장 (통합치의학 전문의)"), photo 는 이미지 URL.
export type Doctor = { name: string; photo: string | null }

/** 예전 형식(문자열 배열)도 받아서 Doctor[] 로 맞춘다. */
export function normalizeDoctors(raw: unknown): Doctor[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((d: any) => (typeof d === "string" ? { name: d, photo: null } : { name: String(d?.name ?? ""), photo: d?.photo ? String(d.photo) : null }))
    .filter((d) => d.name.trim())
}

/** "조은정 대표원장 (통합치의학 전문의)" → { title: "조은정 대표원장", sub: "통합치의학 전문의" } */
export function splitDoctorName(name: string) {
  const m = name.match(/^(.*?)\s*\((.*)\)\s*$/)
  return m ? { title: m[1], sub: m[2] } : { title: name, sub: "" }
}

// 4~12번 5점 문항 (0 = 경험 없음)
export const SCALE = [
  { value: 5, label: "매우 그렇다" },
  { value: 4, label: "그렇다" },
  { value: 3, label: "보통이다" },
  { value: 2, label: "그렇지 않다" },
  { value: 1, label: "전혀 그렇지 않다" },
] as const
export const NA_LABEL = "경험 없음 X"

// 지인 권유 문항을 글자로 받는 치과용. 저장값은 0~10 척도 그대로라 ÷2 하면 5~1점이 되어 PEI 계산·CSV 가 바뀌지 않는다.
export const RECOMMEND_WORDS = [
  { value: 10, label: "매우 만족" },
  { value: 8, label: "만족" },
  { value: 6, label: "보통" },
  { value: 4, label: "불만족" },
  { value: 2, label: "매우 불만족" },
] as const
export const recommendWord = (v: number | null | undefined) =>
  v == null ? "" : RECOMMEND_WORDS.find((w) => w.value === v)?.label ?? String(v)

export type ScoreKey =
  | "qPhone" | "qDesk" | "qConsult" | "qDoctorTalk" | "qHygienist"
  | "qDoctorCare" | "qFacility" | "qHomepage" | "qWaiting"

export type ScoreQuestion = { key: ScoreKey; no: number; text: string; label: string; allowNA: boolean }

/** 4~12번. facility 문항 문구만 치과마다 다르다(주차 유무). */
export function scoreQuestions(facilityQuestion: string): ScoreQuestion[] {
  return [
    { key: "qPhone", no: 4, text: "전화와 카카오톡 상 고객 응대는 만족하였습니까?", label: "전화 및 온라인 응대", allowNA: true },
    { key: "qDesk", no: 5, text: "접수, 수납 시 데스크 직원의 고객 응대는 만족하였습니까?", label: "접수 수납 응대", allowNA: false },
    { key: "qConsult", no: 6, text: "치료 상담에 대한 상담 직원의 고객 응대는 만족하였습니까?", label: "치료 상담 응대", allowNA: true },
    { key: "qDoctorTalk", no: 7, text: "의사의 진료에 대한 상담은 만족하였습니까?", label: "의료진 진료 상담", allowNA: false },
    { key: "qHygienist", no: 8, text: "진료 시 치위생사의 고객응대는 만족하였습니까?", label: "진료실 직원 만족도", allowNA: false },
    { key: "qDoctorCare", no: 9, text: "진료 시 의사의 응대는 만족하였습니까?", label: "의료진 진료 응대", allowNA: false },
    { key: "qFacility", no: 10, text: facilityQuestion, label: facilityQuestion.includes("주차") ? "주차·내부 시설" : "내부 시설", allowNA: true },
    { key: "qHomepage", no: 11, text: "홈페이지는 이용하기 편리하였습니까?", label: "홈페이지", allowNA: true },
    { key: "qWaiting", no: 12, text: "진료를 위한 대기시간은 적당하였습니까?", label: "진료 대기시간", allowNA: false },
  ]
}

export const SCORE_KEYS: ScoreKey[] = scoreQuestions("").map((q) => q.key)

export const Q_GENDER = "1. 본 조사에 참여하신 귀하의 성별을 선택해 주십시오."
export const Q_AGE = "2. 본 조사에 참여하신 귀하의 연령을 선택해 주십시오."
export const Q_DOCTOR = "3. 의료진을 선택해 주십시오."
// 자체 설문에서 추가한 문항 — 화면에는 의료진 앞(3번)에 두고, CSV 에는 구글시트 16열 뒤 17번째 열로 붙인다.
// {치과명} 은 환자 화면에서 치과 이름으로 바뀐다
export const Q_VISIT = "{치과명}에 처음 방문하셨나요?"
export const VISIT_OPTIONS = ["네, 처음이에요", "아니요, 전에도 왔어요"]
export const CSV_VISIT_HEADER = "방문 구분"
export const fillClinicName = (text: string, clinicName: string) => text.replaceAll("{치과명}", clinicName)

export const Q_TREATMENT = "오늘 어떤 진료를 받으셨나요? (중복 선택 가능)"
export const CSV_TREATMENT_HEADER = "받은 진료 (중복 선택)"

export const DEFAULT_TREATMENTS = [
  "충치·신경치료", "스케일링·잇몸치료", "임플란트", "크라운·브릿지·틀니", "교정",
  "소아 진료", "사랑니·발치", "미백·심미", "검진·상담", "기타",
]
export const Q_RECOMMEND = "13. 주위분들이 진료가 필요한 경우 저희 치과를 추천하시겠습니까?"
export const Q_POSITIVE = "14. 치과에 다니시면서 좋았던 점, 칭찬할 직원의 이름과 이유를 말씀 부탁드립니다!"
export const Q_IMPROVE = "15. 치과에 다니시면서 느끼셨던 개선이 필요한 부분을 무엇이든 좋으니 자유롭게 말씀 부탁드립니다!"

// ── 문항 구성 (구글폼처럼 문구·순서·선택지·필수 여부를 고치고, 문항을 더하거나 뺀다)
// 기본 문항(id = 성별·연령·점수 키 등)은 응답이 정해진 열에 저장돼 PEI·CSV 에 쓰이고, 유형은 바꿀 수 없다.
// 직접 더한 문항(id = c_xxxx)은 응답의 answers JSON 에 { id: 값 } 으로 저장된다.
export type QType = "single" | "multi" | "doctor" | "scale5" | "scale10" | "short" | "long"
export type QuestionDef = { id: string; type: QType; text: string; required: boolean; options?: string[]; allowNA?: boolean; words?: boolean }

export const QTYPE_LABEL: Record<QType, string> = {
  single: "객관식 (하나 선택)", multi: "체크박스 (여러 개 선택)", doctor: "의료진 선택", scale5: "5점 척도",
  scale10: "1~10 점수 (좌우로 밀기)", short: "단답형", long: "장문형",
}
/** 직접 더하는 문항에 고를 수 있는 유형 (의료진 선택은 기본 문항 하나뿐) */
export const CUSTOM_TYPES: QType[] = ["single", "multi", "scale5", "scale10", "short", "long"]

type BuiltinMeta = { type: QType; label: string }
export const BUILTIN: Record<string, BuiltinMeta> = {
  visit: { type: "single", label: "방문 구분" },
  gender: { type: "single", label: "성별" },
  age: { type: "single", label: "연령" },
  treatment: { type: "multi", label: "받은 진료" },
  doctor: { type: "doctor", label: "의료진" },
  ...Object.fromEntries(scoreQuestions("").map((q) => [q.key, { type: "scale5" as QType, label: q.label }])),
  recommend: { type: "scale10", label: "지인 권유 의향" },
  positive: { type: "long", label: "좋았던 점" },
  improvement: { type: "long", label: "개선 필요" },
}
export const isBuiltin = (id: string) => id in BUILTIN
/** 기본 문항 이름. 시설 문항은 주차를 묻지 않는 치과(지음 등)면 "내부 시설" */
export const itemLabel = (id: string, text: string) => (id === "qFacility" && !text.includes("주차") ? "내부 시설" : BUILTIN[id]?.label ?? id)
export const questionLabel = (q: QuestionDef) => (BUILTIN[q.id] ? itemLabel(q.id, q.text) : q.text)

/** 구글폼과 같은 15문항 + 받은 진료 — 문항 구성을 아직 저장하지 않은 설문은 이것으로 보인다 */
export function defaultQuestions(facilityQuestion: string, treatments: string[]): QuestionDef[] {
  return [
    { id: "visit", type: "single", text: Q_VISIT, required: true, options: [...VISIT_OPTIONS] },
    { id: "gender", type: "single", text: stripNo(Q_GENDER), required: true, options: [...GENDERS] },
    { id: "age", type: "single", text: stripNo(Q_AGE), required: true, options: [...AGE_GROUPS] },
    ...(treatments.length ? [{ id: "treatment", type: "multi" as QType, text: Q_TREATMENT, required: true, options: treatments }] : []),
    { id: "doctor", type: "doctor", text: stripNo(Q_DOCTOR), required: true },
    ...scoreQuestions(facilityQuestion).map((q) => ({ id: q.key, type: "scale5" as QType, text: q.text, required: true, allowNA: q.allowNA })),
    { id: "recommend", type: "scale10", text: stripNo(Q_RECOMMEND), required: true },
    { id: "positive", type: "long", text: stripNo(Q_POSITIVE), required: false },
    { id: "improvement", type: "long", text: stripNo(Q_IMPROVE), required: false },
  ]
}

const stripNo = (s: string) => s.replace(/^\d+\.\s*/, "")
const cleanText = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max)
const cleanOptions = (v: unknown) =>
  Array.isArray(v) ? [...new Set(v.map((o) => cleanText(o, 100)).filter(Boolean))].slice(0, 40) : []

/** 저장된 값(또는 관리자 화면에서 보낸 값)을 다듬는다. 비어 있으면 기본 문항. 잘못된 문항은 버린다. */
export function normalizeQuestions(raw: unknown, facilityQuestion: string, treatments: string[]): QuestionDef[] {
  if (!Array.isArray(raw) || raw.length === 0) return defaultQuestions(facilityQuestion, treatments)
  const seen = new Set<string>()
  const out: QuestionDef[] = []
  for (const r of raw as any[]) {
    const id = String(r?.id ?? "")
    if (!id || seen.has(id)) continue
    const builtin = BUILTIN[id]
    if (!builtin && !/^c_[a-z0-9]{4,16}$/.test(id)) continue
    const type: QType = builtin ? builtin.type : CUSTOM_TYPES.includes(r?.type) ? r.type : "short"
    const text = cleanText(r?.text, 300)
    if (!text) continue
    const q: QuestionDef = { id, type, text, required: r?.required !== false }
    if (type === "single" || type === "multi") q.options = cleanOptions(r?.options)
    if (type === "scale5") q.allowNA = !!r?.allowNA
    seen.add(id)
    out.push(q)
  }
  return out
}

export const newQuestionId = () => `c_${Math.random().toString(36).slice(2, 10)}`

export const FACILITY_WITH_PARKING = "주차 및 치과 내부시설 이용은 편리하였습니까?"
export const FACILITY_ONLY = "치과 내부시설 이용은 편리하였습니까?"

// 기본 의료진 사진 — public/pei-doctors/<치과코드>/<순번>.jpg (홈페이지 의료진 사진을 400×500 으로 맞춤)
const photoSet = (code: string, n: number) => Array.from({ length: n }, (_, i) => `/pei-doctors/${code}/${i + 1}.jpg`)

/** 새 설문을 만들 때 치과 코드별 기본값 (구글폼 선택지 기준). 없으면 빈 의료진 목록으로 만든다. */
export const DEFAULT_SURVEYS: Record<string, {
  doctors: string[]; facilityQuestion: string; treatments?: string[]; slogan?: string; logo?: string
  photos?: (string | null)[] // doctors 와 같은 순서
  recommendWords?: boolean // 지인 권유 문항을 숫자 대신 글자로 받는다
}> = {
  중산사과나무: {
    doctors: ["김보라 대표원장 (구강악안면외과, 통합치의학 전문의)", "서치원 원장 (치과보철과 전문의)", "윤보영 원장 (통합치의학 전문의)"],
    facilityQuestion: FACILITY_WITH_PARKING,
    slogan: "온가족 치과주치의, 중산사과나무치과입니다", // 홈페이지 메인 문구
    photos: photoSet("중산사과나무", 3),
  },
  디어스: {
    doctors: ["장재원 원장 (치주과 전문의)", "한정화 원장 (소아치과 전문의)", "김나현 원장 (보존과 전문의)"],
    facilityQuestion: "주차 및 주차시설 이용은 편리하였습니까?",
    slogan: "온가족이 함께 다니는 치과, 디어스치과입니다",
    photos: photoSet("디어스", 3),
  },
  지음: {
    doctors: ["윤희균 원장 (통합치의학 전문의)", "이관주 원장 (치주과 전문의)"],
    facilityQuestion: FACILITY_ONLY,
    slogan: "더 나은 삶을 위해 최상의 진료를 약속하는 지음치과입니다",
    recommendWords: true,
    photos: photoSet("지음", 2),
  },
  하얀드림: {
    doctors: [
      "조은정 대표원장 (통합치의학 전문의)",
      "한상준 원장 (치과보존과 전문의)",
      "권민정 원장 (통합치의학·치주과 전문의)",
      "박세현 원장 (치과보철과 전문의)",
      "정혜원 원장 (치과보존과 전문의)",
    ],
    facilityQuestion: FACILITY_WITH_PARKING,
    treatments: DEFAULT_TREATMENTS.filter((t) => t !== "교정"), // 교정 진료 안 함
    slogan: "내 가족에게 권하는 마음으로 진료합니다.", // 원장님 진료철학
    photos: photoSet("하얀드림", 5),
    logo: "/pei-logos/hayandream.png",
  },
}

// 한글 주소(/하얀드림치과설문). 앱의 다른 최상위 경로와 겹치면 안 된다.
const RESERVED_SLUGS = new Set(["admin", "api", "dashboard", "s", "login", "signup", "register", "setup-master", "test-account", "test-clinic", "test-signup", "pei-doctors", "favicon.ico"])
export const slugFromName = (name: string) => `${name.replace(/\s+/g, "")}설문` // /하얀드림치과설문

/** 쓸 수 있으면 다듬은 값, 아니면 null. 한글·영문·숫자·-·_ 2~30자 */
export function cleanSlug(raw: string) {
  const v = raw.trim().replace(/^\/+/, "").replace(/\s+/g, "")
  if (!/^[가-힣A-Za-z0-9_-]{2,30}$/.test(v) || RESERVED_SLUGS.has(v.toLowerCase())) return null
  return v
}

export function defaultIntro(clinicName: string) {
  return `${clinicName}를 찾아주셔서 감사합니다.\n더 나은 진료 환경을 위해 1분 정도 소요되는 만족도 조사를 진행하고 있습니다. 응답 내용은 익명으로 처리됩니다.`
}

// ── 점수 집계 (PEI 보고서 스킬과 같은 규칙)
// 5점 9개 + 지인 권유(0~10 → ÷2) = 10개 항목 단순 평균. 0(경험 없음·미응답)은 평균에서 제외.
type ScoreRow = Partial<Record<ScoreKey, number | null>> & { recommend?: number | null }

export function itemAverages(rows: ScoreRow[]) {
  const avg = (vals: number[]) => (vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null)
  const items: Record<string, number | null> = {}
  for (const k of SCORE_KEYS) {
    items[k] = avg(rows.map((r) => r[k]).filter((v): v is number => typeof v === "number" && v > 0 && v <= 5))
  }
  items.recommend = avg(rows.map((r) => r.recommend).filter((v): v is number => typeof v === "number" && v > 0 && v <= 10).map((v) => v / 2))
  const present = Object.values(items).filter((v): v is number => v != null)
  const pei = present.length ? present.reduce((a, b) => a + b, 0) / present.length : null
  return { items, pei }
}

// ── 점수 등급 (5점 만점 평균). 환자 만족도는 대체로 높게 나와서 4.0 미만이면 이미 불만이 꽤 있다는 뜻이다.
export const PEI_GRADES = [
  { min: 4.7, label: "매우 우수", color: "#03b26c", bg: "#e5f8ef" },
  { min: 4.5, label: "우수", color: "#3182f6", bg: "#e8f3ff" },
  { min: 4.0, label: "보통", color: "#e17000", bg: "#fff3e0" },
  { min: 0, label: "개선 필요", color: "#f04452", bg: "#ffeeee" },
] as const
export const peiGrade = (v: number | null | undefined) => (v == null ? null : PEI_GRADES.find((g) => v >= g.min)!)

// ── 구글시트 형식 CSV
const scaleLabel = (v: number | null | undefined) =>
  v == null ? "" : v === 0 ? NA_LABEL : SCALE.find((s) => s.value === v)?.label ?? ""

/** 구글폼 타임스탬프 형식: "2026. 10. 22 오후 2:03:04" (KST) */
export function googleTimestamp(d: Date) {
  const k = new Date(d.getTime() + 9 * 3600 * 1000)
  const h = k.getUTCHours()
  const ap = h < 12 ? "오전" : "오후"
  const h12 = h % 12 === 0 ? 12 : h % 12
  const p2 = (n: number) => String(n).padStart(2, "0")
  return `${k.getUTCFullYear()}. ${k.getUTCMonth() + 1}. ${k.getUTCDate()} ${ap} ${h12}:${p2(k.getUTCMinutes())}:${p2(k.getUTCSeconds())}`
}

const csvCell = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)

export type ExportRow = ScoreRow & {
  submittedAt: Date; visitType?: string | null; gender: string | null; ageGroup: string | null; doctor: string | null; treatments?: unknown
  positive: string | null; improvement: string | null; answers?: unknown
}

/** 직접 더한 문항 응답을 글자로 (CSV·관리자 화면 공용) */
export function answerText(q: QuestionDef, v: unknown) {
  if (v == null || v === "") return ""
  if (Array.isArray(v)) return v.join(", ")
  if (q.type === "scale5") return scaleLabel(Number(v))
  return String(v)
}

// 앞 16열은 구글시트 순서 고정(보고서 스킬이 위치로 읽음), 17열 받은 진료, 18열 방문 구분, 19열부터 직접 더한 문항
export function toGoogleCsv(facilityQuestion: string, rows: ExportRow[], questions: QuestionDef[] = []) {
  const qs = scoreQuestions(facilityQuestion)
  const custom = questions.filter((q) => !isBuiltin(q.id))
  const header = ["타임스탬프", Q_GENDER, Q_AGE, Q_DOCTOR, ...qs.map((q) => `${q.no}. ${q.text}`), Q_RECOMMEND, Q_POSITIVE, Q_IMPROVE, CSV_TREATMENT_HEADER, CSV_VISIT_HEADER, ...custom.map((q) => q.text)]
  const lines = [header.map(csvCell).join(",")]
  for (const r of rows) {
    lines.push([
      googleTimestamp(r.submittedAt), r.gender ?? "", r.ageGroup ?? "", r.doctor ?? "",
      ...qs.map((q) => scaleLabel(r[q.key])),
      r.recommend == null ? "" : String(r.recommend),
      r.positive ?? "", r.improvement ?? "",
      Array.isArray(r.treatments) ? r.treatments.join(", ") : "",
      r.visitType ?? "",
      ...custom.map((q) => answerText(q, (r.answers as Record<string, unknown> | null)?.[q.id])),
    ].map(csvCell).join(","))
  }
  return "﻿" + lines.join("\r\n") + "\r\n"
}

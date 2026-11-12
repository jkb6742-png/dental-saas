// 로그인·회원가입 공통 틀(bokbok 로그인 구성): 왼쪽 검은 브랜드 면(THINKLAB 로고·큰 글자·크롬 링), 오른쪽 폼(카드 없음).
export default function AuthShell({ eyebrow, title, children, note }: { eyebrow: string; title: string; children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-[#f2f2ef] text-[#0a0a0a]">
      <section aria-hidden="true" className="tl-grid relative overflow-hidden bg-black text-white flex flex-col justify-between px-8 sm:px-11 pt-8 pb-10 min-h-[300px] lg:min-h-screen border-b lg:border-b-0 lg:border-r border-[#292929]">
        <div className="relative flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/thinklab-white.svg" alt="" className="h-[18px] w-auto" />
        </div>
        <div className="tl-chrome-wrap absolute right-[-14%] top-[8%] lg:right-[-6%] lg:top-[15%]">
          <div className="tl-chrome" style={{ ["--cz" as string]: "clamp(240px, 30vw, 440px)" }}>
            <i />
          </div>
        </div>
        <div className="relative">
          <h2 className="m-0 font-extrabold uppercase leading-[0.86] tracking-[-0.065em] text-[clamp(52px,6.4vw,110px)]">
            Dental
            <br />
            Insight
            <span className="block text-[#505050]">& work.</span>
          </h2>
          <div className="mt-7 flex flex-wrap gap-5 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-[#777]">
            <span>Clinic data</span>
            <span>Team work</span>
            <span>Schedule</span>
            <span>Secure</span>
          </div>
        </div>
      </section>

      <section className="flex flex-col justify-center px-7 sm:px-[clamp(28px,6vw,96px)] py-12 bg-[#ecece9]">
        <div className="w-full max-w-[400px]">
          <div className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-[#0062ff] mb-4">{eyebrow}</div>
          <h1 className="text-[34px] font-bold tracking-[-0.045em] leading-[1.1] m-0 mb-8 pb-6 border-b border-[#d1d1cc]">{title}</h1>
          {children}
        </div>
        {note && <p className="max-w-[400px] mt-7 text-[12px] text-[#888] leading-relaxed">{note}</p>}
      </section>
    </div>
  )
}

/** 영문 소제목 + 한글 이름 라벨 */
export function AuthLabel({ htmlFor, en, ko }: { htmlFor: string; en: string; ko: string }) {
  return (
    <label htmlFor={htmlFor} className="block mb-2 font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-[#888]">
      {en}
      <em className="not-italic font-sans text-[12px] tracking-normal normal-case text-[#b0b0aa] ml-2">{ko}</em>
    </label>
  )
}

export const authInput =
  "w-full h-[44px] px-3.5 rounded-[4px] border border-[#d1d1cc] bg-white text-[14px] text-[#0a0a0a] placeholder:text-[#b0b0aa] outline-none focus:border-[#0062ff] focus:ring-2 focus:ring-[#0062ff]/15 transition-colors"

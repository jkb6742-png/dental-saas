import Link from "next/link"
import { ChevronRight } from "lucide-react"

export default function HomeCard({
  title,
  note,
  href,
  className = "",
  children,
}: {
  title: string
  note?: string
  href?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={`min-w-0 bg-white rounded border border-[#d1d1cc] ${className}`}>
      <header className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-[#e0e0db]">
        <div className="flex items-baseline gap-2 min-w-0">
          <h3 className="shrink-0 text-[14px] font-semibold text-[#0a0a0a]">{title}</h3>
          {note && <span className="text-[12px] text-[#6f6f6a] truncate">{note}</span>}
        </div>
        {href && (
          <Link
            href={href}
            prefetch={false}
            className="shrink-0 inline-flex items-center text-[12px] text-[#555555] hover:text-[#0062ff]"
          >
            자세히
            <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        )}
      </header>
      <div className="px-2.5 py-2">{children}</div>
    </section>
  )
}

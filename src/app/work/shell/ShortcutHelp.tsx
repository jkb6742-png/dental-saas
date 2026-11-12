"use client"

import { useEffect, useRef, useState } from "react"
import { X } from "lucide-react"
import { usePopover, isTyping } from "./store"

const KEYS: [string, string][] = [
  ["Ctrl + K", "통합 검색"],
  ["Alt + N", "새 업무 추가"],
  ["Alt + 1 ~ 7", "왼쪽 메뉴 열기(홈·업무·일정·치과·자료·사내·경영)"],
  ["Esc", "열린 창 닫기"],
  ["?", "단축키 안내"],
]

// "?" (입력 중이 아닐 때) 또는 work:shortcuts 이벤트로 여는 단축키 안내
export default function ShortcutHelp() {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  usePopover(box, open, () => setOpen(false))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey && !isTyping(e)) {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    const onOpen = () => setOpen(true)
    window.addEventListener("keydown", onKey)
    window.addEventListener("work:shortcuts", onOpen)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("work:shortcuts", onOpen)
    }
  }, [])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60] bg-black/20 flex items-start justify-center pt-[14vh] px-4">
      <div ref={box} role="dialog" aria-modal="true" aria-label="단축키 안내" className="w-full max-w-[420px] bg-white border border-[#d1d1cc] rounded shadow-[0_12px_32px_rgb(0_0_0/0.18)]">
        <div className="flex items-center justify-between h-[44px] pl-4 pr-2 border-b border-[#e3e3de]">
          <span className="text-[14px] font-bold">단축키</span>
          <button type="button" aria-label="닫기" onClick={() => setOpen(false)} className="w-8 h-8 flex items-center justify-center rounded text-[#6f6f6a] hover:bg-[#f2f2ef]">
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        <table className="w-full text-[13px]">
          <tbody>
            {KEYS.map(([k, d]) => (
              <tr key={k} className="border-b border-[#ecece9] last:border-0">
                <td className="px-4 py-2 w-[120px] whitespace-nowrap">
                  <kbd className="text-[12px] font-sans border border-[#d1d1cc] rounded px-1.5 py-0.5 text-[#3d3d3a]">{k}</kbd>
                </td>
                <td className="px-2 py-2 text-[#3d3d3a]">{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

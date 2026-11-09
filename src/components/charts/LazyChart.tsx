"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"

// 그래프가 많은 화면에서 화면 근처에 왔을 때만 그린다. 자리는 height 로 미리 잡아 스크롤이 튀지 않는다.
export default function LazyChart({ height, children }: { height: number; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = box.current
    if (!el || shown) return
    if (typeof IntersectionObserver === "undefined") {
      setShown(true)
      return
    }
    // 대시보드 스크롤 영역은 <main> 이므로 그 안을 기준으로 삼는다.
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true)
          io.disconnect()
        }
      },
      { root: el.closest("main"), rootMargin: "300px 0px" }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [shown])

  return (
    <div ref={box} style={{ height }} className="w-full min-w-0">
      {shown ? children : null}
    </div>
  )
}

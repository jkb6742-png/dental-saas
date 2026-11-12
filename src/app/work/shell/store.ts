"use client"

import { useCallback, useEffect, useRef, useState, type RefObject } from "react"

// 상단 바·사이드바 공통 도구: 최근 본 항목(브라우저 저장), 고정(서버 WorkPin), 팝오버 포커스 처리.

/* ───────── 브라우저 저장(실패해도 화면은 동작) ───────── */
export function readLocal<T>(key: string, fallback: T): T {
  try {
    const s = window.localStorage.getItem(key)
    return s ? (JSON.parse(s) as T) : fallback
  } catch {
    return fallback
  }
}
export function writeLocal(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

/* ───────── 최근 본 항목 ───────── */
export type RecentItem = { href: string; label: string; at: number }
const RECENT_KEY = "work:recent"
const RECENT_MAX = 5
export const RECENT_EVENT = "work:recent"

/**
 * 최근 본 항목에 넣는다. 다른 화면(업무 상세 등)에서 제목과 함께 부를 수 있다:
 * window.dispatchEvent(new CustomEvent("work:recent", { detail: { href, label } }))
 */
export function rememberRecent(href: string, label: string) {
  if (!href.startsWith("/work") || !label) return
  const list = readLocal<RecentItem[]>(RECENT_KEY, []).filter((r) => r.href !== href)
  list.unshift({ href, label: label.slice(0, 80), at: Date.now() })
  writeLocal(RECENT_KEY, list.slice(0, RECENT_MAX * 2))
  window.dispatchEvent(new Event("work:recent-changed"))
}

export function useRecent(): RecentItem[] {
  const [items, setItems] = useState<RecentItem[]>([])
  useEffect(() => {
    const load = () => setItems(readLocal<RecentItem[]>(RECENT_KEY, []).slice(0, RECENT_MAX))
    const onAdd = (e: Event) => {
      const d = (e as CustomEvent).detail
      if (d && typeof d.href === "string" && typeof d.label === "string") rememberRecent(d.href, d.label)
    }
    load()
    window.addEventListener("work:recent-changed", load)
    window.addEventListener(RECENT_EVENT, onAdd)
    return () => {
      window.removeEventListener("work:recent-changed", load)
      window.removeEventListener(RECENT_EVENT, onAdd)
    }
  }, [])
  return items
}

/* ───────── 고정(별표) ───────── */
export type Pin = { id: string; kind: "CLINIC" | "BOARD" | "TASK"; refId: string; label: string; sortOrder: number }
const PINS_EVENT = "work:pins-changed"

export function usePins() {
  const [pins, setPins] = useState<Pin[]>([])
  const [error, setError] = useState("")
  const load = useCallback(() => {
    fetch("/api/work/pins")
      .then((r) => (r.ok ? r.json() : { pins: [] }))
      .then((j) => setPins(j.pins ?? []))
      .catch(() => {})
  }, [])
  useEffect(() => {
    load()
    window.addEventListener(PINS_EVENT, load)
    return () => window.removeEventListener(PINS_EVENT, load)
  }, [load])

  const isPinned = (kind: Pin["kind"], refId: string) => pins.some((p) => p.kind === kind && p.refId === refId)

  const toggle = async (kind: Pin["kind"], refId: string, label: string) => {
    setError("")
    const on = isPinned(kind, refId)
    const r = on
      ? await fetch(`/api/work/pins?kind=${kind}&refId=${encodeURIComponent(refId)}`, { method: "DELETE" })
      : await fetch("/api/work/pins", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, refId, label }) })
    if (!r.ok) {
      const j = await r.json().catch(() => ({}))
      setError(j.error ?? "고정하지 못했습니다")
      return
    }
    window.dispatchEvent(new Event(PINS_EVENT))
  }
  return { pins, isPinned, toggle, error }
}

/* ───────── 팝오버: 열면 첫 칸에 포커스, Tab 은 안에서만 돌고, 닫으면 원래 자리로 ───────── */
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

export function usePopover(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void, opts: { trap?: boolean; autoFocus?: boolean } = {}) {
  const close = useRef(onClose)
  close.current = onClose
  const { trap = true, autoFocus = true } = opts
  useEffect(() => {
    if (!open) return
    const before = document.activeElement as HTMLElement | null
    if (autoFocus) {
      const t = setTimeout(() => {
        const el = ref.current?.querySelector<HTMLElement>("[data-autofocus]") ?? ref.current?.querySelector<HTMLElement>(FOCUSABLE)
        el?.focus()
      }, 0)
      void t
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation()
        close.current()
        return
      }
      if (!trap || e.key !== "Tab" || !ref.current) return
      const els = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => x.offsetParent !== null)
      if (!els.length) return
      const first = els[0], last = els[els.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close.current()
    }
    document.addEventListener("keydown", onKey)
    document.addEventListener("mousedown", onDown)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("mousedown", onDown)
      // 닫힐 때 원래 누른 버튼으로 포커스를 돌려준다(다른 곳으로 이미 옮겼으면 그대로)
      if (before && (document.activeElement === document.body || ref.current?.contains(document.activeElement))) before.focus?.()
    }
  }, [open, ref, trap, autoFocus])
}

/** 입력칸에서 타이핑 중인가(단축키 무시용) */
export function isTyping(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null
  if (!t) return false
  return t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)
}

/** 한국 날짜 YYYY-MM-DD / YYYY-MM */
export const kstToday = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
export const kstMonth = () => kstToday().slice(0, 7)

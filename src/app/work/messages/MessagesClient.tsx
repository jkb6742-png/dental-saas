"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { field, btn, btnLine, card, kst, bytes, api } from "../ui"

type Room = { id: string; type: "DIRECT" | "GROUP" | "CLINIC"; clinicId: string | null; title: string; members: { id: string; name: string }[]; unread: number; last: { body: string | null; sender: string } | null }
type Msg = {
  id: string
  roomId: string
  senderUserId: string
  clientNonce: string | null
  body: string | null
  createdAt: string
  deletedAt: string | null
  sender: { name: string }
  files: { id: string; fileId: string; versionNo: number; originalName: string; mimeType: string; byteSize: number }[]
  pending?: boolean
}
const TYPE: Record<string, string> = { CLINIC: "치과", GROUP: "단체", DIRECT: "1:1" }

export default function MessagesClient({ me }: { me: { id: string; name: string } }) {
  const params = useSearchParams()
  const [rooms, setRooms] = useState<Room[]>([])
  const [roomId, setRoomId] = useState<string | null>(params.get("room"))
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [text, setText] = useState("")
  const [err, setErr] = useState("")
  const [creating, setCreating] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const roomRef = useRef(roomId)
  roomRef.current = roomId

  const loadRooms = useCallback(async () => {
    try {
      const r = await api<{ rooms: Room[] }>("/api/work/chat/rooms")
      setRooms(r.rooms)
      if (!roomRef.current && r.rooms[0]) setRoomId(r.rooms[0].id)
    } catch (e) {
      setErr((e as Error).message)
    }
  }, [])
  useEffect(() => {
    loadRooms()
  }, [loadRooms])

  const markRead = useCallback(async (rid: string, list: Msg[]) => {
    const lastReal = [...list].reverse().find((m) => !m.pending)
    if (!lastReal) return
    await api(`/api/work/chat/rooms/${rid}/read`, { method: "POST", json: { messageId: lastReal.id } }).catch(() => {})
    setRooms((rs) => rs.map((r) => (r.id === rid ? { ...r, unread: 0 } : r)))
  }, [])

  useEffect(() => {
    if (!roomId) return
    let alive = true
    api<{ messages: Msg[] }>(`/api/work/chat/rooms/${roomId}/messages`)
      .then((r) => {
        if (!alive) return
        setMsgs(r.messages)
        markRead(roomId, r.messages)
      })
      .catch((e) => setErr(e.message))
    return () => {
      alive = false
    }
  }, [roomId, markRead])

  // 실시간: 새 메시지가 오면 열린 방이면 붙이고, 아니면 안 읽은 수만 올린다
  useEffect(() => {
    let es: EventSource | null = null
    let stop = false
    const open = () => {
      if (stop) return
      es = new EventSource("/api/work/chat/stream")
      es.addEventListener("message", (ev) => {
        const m: Msg = JSON.parse((ev as MessageEvent).data)
        if (m.roomId === roomRef.current) {
          setMsgs((cur) => {
            if (cur.some((x) => x.id === m.id)) return cur
            const i = m.clientNonce ? cur.findIndex((x) => x.pending && x.clientNonce === m.clientNonce) : -1
            const next = i >= 0 ? cur.map((x, j) => (j === i ? m : x)) : [...cur, m]
            if (m.senderUserId !== me.id && document.visibilityState === "visible") markRead(m.roomId, next)
            return next
          })
        }
        setRooms((rs) => {
          const known = rs.some((r) => r.id === m.roomId)
          if (!known) {
            loadRooms()
            return rs
          }
          return rs
            .map((r) =>
              r.id === m.roomId ? { ...r, last: { body: m.body, sender: m.sender.name }, unread: m.roomId === roomRef.current || m.senderUserId === me.id ? r.unread : r.unread + 1 } : r
            )
            .sort((a, b) => (a.id === m.roomId ? -1 : b.id === m.roomId ? 1 : 0))
        })
      })
      es.onerror = () => {
        es?.close()
        setTimeout(open, 3000)
      }
    }
    open()
    return () => {
      stop = true
      es?.close()
    }
  }, [me.id, markRead, loadRooms])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [msgs.length, roomId])

  const room = rooms.find((r) => r.id === roomId)

  const send = async (fileVersionIds: string[] = []) => {
    if (!roomId || (!text.trim() && !fileVersionIds.length)) return
    const nonce = crypto.randomUUID()
    const body = text.trim()
    setText("")
    const temp: Msg = { id: `tmp-${nonce}`, roomId, senderUserId: me.id, clientNonce: nonce, body, createdAt: new Date().toISOString(), deletedAt: null, sender: { name: me.name }, files: [], pending: true }
    setMsgs((m) => [...m, temp])
    try {
      const saved = await api<Msg>(`/api/work/chat/rooms/${roomId}/messages`, { method: "POST", json: { body, clientNonce: nonce, fileVersionIds } })
      setMsgs((cur) => (cur.some((x) => x.id === saved.id) ? cur.filter((x) => x.id !== temp.id) : cur.map((x) => (x.id === temp.id ? saved : x))))
    } catch (e) {
      setErr((e as Error).message)
      setMsgs((cur) => cur.filter((x) => x.id !== temp.id))
      setText(body)
    }
  }

  const attach = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file || !room) return
    const fd = new FormData()
    fd.set("file", file)
    fd.set("visibility", "INTERNAL")
    if (room.clinicId) fd.set("clinicId", room.clinicId)
    try {
      const f = await api<{ versions: { id: string }[] }>("/api/work/files", { method: "POST", body: fd })
      await send([f.versions[0].id])
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  return (
    <div className="space-y-2">
      <h1 className="text-[20px] font-bold">메신저</h1>
      {err && <p className="text-[13px] text-[#d92d20]">{err}</p>}
      <div className={`${card} grid grid-cols-[260px_1fr] h-[calc(100vh-170px)] min-h-[420px] overflow-hidden`}>
        <div className="border-r border-[#d1d1cc] flex flex-col min-h-0">
          <div className="p-2 border-b border-[#ecece9]">
            <button className={`${btnLine} w-full`} onClick={() => setCreating(true)}>
              새 대화
            </button>
          </div>
          <div className="overflow-y-auto flex-1">
            {rooms.map((r) => (
              <button key={r.id} onClick={() => setRoomId(r.id)} className={`w-full text-left px-3 py-2 border-b border-[#ecece9] ${r.id === roomId ? "bg-[#ecece9]" : "hover:bg-[#fafaf8]"}`}>
                <div className="flex items-center gap-1.5 text-[14px]">
                  <span className="text-[11px] text-[#6f6f6a] w-[26px] shrink-0">{TYPE[r.type]}</span>
                  <span className="flex-1 truncate font-medium">{r.title}</span>
                  {r.unread > 0 && <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#d92d20] text-white text-[11px] leading-[18px] text-center">{r.unread}</span>}
                </div>
                <div className="text-[12px] text-[#6f6f6a] truncate pl-[32px]">{r.last ? `${r.last.sender}: ${r.last.body ?? "파일"}` : "메시지 없음"}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col min-h-0">
          {room ? (
            <>
              <div className="px-3 py-2 border-b border-[#ecece9] text-[14px]">
                <b>{room.title}</b> <span className="text-[12px] text-[#6f6f6a]">{room.members.map((m) => m.name).join(", ")}</span>
              </div>
              <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
                {msgs.map((m, i) => {
                  const mine = m.senderUserId === me.id
                  const showName = !mine && msgs[i - 1]?.senderUserId !== m.senderUserId
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className="max-w-[70%]">
                        {showName && <div className="text-[12px] text-[#6f6f6a] mb-0.5">{m.sender.name}</div>}
                        <div className={`px-3 py-1.5 rounded text-[14px] whitespace-pre-wrap break-words ${mine ? "bg-[#191f28] text-white" : "bg-[#f4f4f2]"} ${m.pending ? "opacity-60" : ""}`}>
                          {m.deletedAt ? <i className="opacity-60">삭제된 메시지</i> : m.body}
                          {m.files.map((f) => (
                            <a key={f.id} href={`/api/work/files/${f.fileId}/download?v=${f.versionNo}`} className="block underline text-[13px]">
                              {f.originalName} ({bytes(f.byteSize)})
                            </a>
                          ))}
                        </div>
                        <div className={`text-[11px] text-[#9a9a94] mt-0.5 ${mine ? "text-right" : ""}`}>{m.pending ? "보내는 중" : kst(m.createdAt).slice(5)}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="p-2 border-t border-[#ecece9] flex gap-2 items-end">
                <label className={`${btnLine} cursor-pointer leading-8`} title="파일 첨부">
                  파일
                  <input ref={fileRef} type="file" className="hidden" onChange={attach} />
                </label>
                <textarea
                  className="flex-1 h-[60px] p-2 rounded border border-[#d1d1cc] text-[14px] resize-none"
                  placeholder="메시지 (Enter 보내기, Shift+Enter 줄바꿈, @이름 으로 알림)"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault()
                      send()
                    }
                  }}
                />
                <button className={btn} onClick={() => send()}>
                  보내기
                </button>
              </div>
            </>
          ) : (
            <p className="p-4 text-[13px] text-[#6f6f6a]">대화를 고르세요.</p>
          )}
        </div>
      </div>
      {creating && (
        <NewRoom
          onClose={() => setCreating(false)}
          onCreated={async (id) => {
            setCreating(false)
            await loadRooms()
            setRoomId(id)
          }}
        />
      )}
    </div>
  )
}

function NewRoom({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [people, setPeople] = useState<{ id: string; name: string }[]>([])
  const [sel, setSel] = useState<string[]>([])
  const [title, setTitle] = useState("")
  const [err, setErr] = useState("")
  useEffect(() => {
    api<{ people: { id: string; name: string }[] }>("/api/work/chat/people").then((r) => setPeople(r.people))
  }, [])
  const create = async () => {
    setErr("")
    try {
      const json = sel.length === 1 ? { type: "DIRECT", userId: sel[0] } : { type: "GROUP", title, userIds: sel }
      const r = await api<{ id: string }>("/api/work/chat/rooms", { method: "POST", json })
      onCreated(r.id)
    } catch (e) {
      setErr((e as Error).message)
    }
  }
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-40" onClick={onClose}>
      <div className={`${card} p-4 w-[360px] space-y-3`} onClick={(e) => e.stopPropagation()}>
        <div className="text-[15px] font-bold">새 대화</div>
        <div className="max-h-[260px] overflow-y-auto space-y-1">
          {people.map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-[14px]">
              <input type="checkbox" checked={sel.includes(p.id)} onChange={(e) => setSel(e.target.checked ? [...sel, p.id] : sel.filter((x) => x !== p.id))} />
              {p.name}
            </label>
          ))}
        </div>
        {sel.length > 1 && <input className={`${field} w-full`} placeholder="단체방 이름" value={title} onChange={(e) => setTitle(e.target.value)} />}
        {err && <p className="text-[13px] text-[#d92d20]">{err}</p>}
        <div className="flex gap-2 justify-end">
          <button className={btnLine} onClick={onClose}>
            닫기
          </button>
          <button className={btn} disabled={!sel.length} onClick={create}>
            {sel.length > 1 ? "단체방 만들기" : "1:1 대화"}
          </button>
        </div>
      </div>
    </div>
  )
}

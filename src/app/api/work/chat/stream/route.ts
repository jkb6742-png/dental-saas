import { NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { guard } from "@/lib/work/common"
import { myRoomIds, messageSelect, serializeMessage } from "@/lib/work/chat"

export const dynamic = "force-dynamic"

// 실시간 수신(SSE). 2초마다 내 방들의 새 메시지를 확인해 보낸다. 10명 규모라 DB 부담은 작다.
// 방 목록은 30초마다 다시 읽어 담당 치과 변경을 반영한다. 최대 10분 뒤 끊고 브라우저가 다시 연결.
export async function GET(req: NextRequest) {
  const g = await guard()
  if ("res" in g) return g.res
  const actor = g.actor
  const startParam = req.nextUrl.searchParams.get("after")
  let last: bigint =
    startParam && /^\d+$/.test(startParam) ? BigInt(startParam) : ((await prisma.chatMessage.aggregate({ _max: { id: true } }))._max.id ?? BigInt(0))
  let rooms = await myRoomIds(actor)
  let roomsAt = Date.now()
  const enc = new TextEncoder()
  const started = Date.now()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      send("ready", { after: last.toString() })
      let closed = false
      req.signal.addEventListener("abort", () => {
        closed = true
      })
      while (!closed && Date.now() - started < 10 * 60_000) {
        try {
          if (Date.now() - roomsAt > 30_000) {
            rooms = await myRoomIds(actor)
            roomsAt = Date.now()
          }
          if (rooms.length) {
            const rows = await prisma.chatMessage.findMany({ where: { roomId: { in: rooms }, id: { gt: last } }, select: messageSelect, orderBy: { id: "asc" }, take: 100 })
            for (const m of rows) {
              send("message", serializeMessage(m))
              last = m.id
            }
          }
          controller.enqueue(enc.encode(`: ping\n\n`))
        } catch {
          break
        }
        await new Promise((r) => setTimeout(r, 2000))
      }
      try {
        controller.close()
      } catch {}
    },
  })
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" },
  })
}

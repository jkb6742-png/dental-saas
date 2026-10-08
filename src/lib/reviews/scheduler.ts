import { prisma } from "@/lib/db"
import { syncNaverConfig } from "./sync"

// 앱 서버 안에서 도는 네이버 리뷰 자동 수집. NAS 작업 스케줄러를 따로 걸 필요가 없다.
// 30분마다 깨어나, KST 8~22시 사이에 마지막 수집 후 SYNC_GAP 이 지난 치과만 수집 → 하루 약 3회.
// 끄려면 REVIEW_AUTO_SYNC=off

const CHECK_EVERY = 30 * 60 * 1000
const SYNC_GAP = 5 * 3600 * 1000
let running = false

export async function runDueNaverSyncs(force = false) {
  if (running) return []
  running = true
  try {
    const kstHour = new Date(Date.now() + 9 * 3600 * 1000).getUTCHours()
    if (!force && (kstHour < 8 || kstHour >= 22)) return []

    const configs = await prisma.reviewConfig.findMany({
      where: {
        source: "NAVER",
        isActive: true,
        ...(force ? {} : { OR: [{ lastSyncAt: null }, { lastSyncAt: { lt: new Date(Date.now() - SYNC_GAP) } }] }),
      },
      select: { id: true, clinicId: true },
    })

    const results = []
    for (const c of configs) {
      try {
        results.push(await syncNaverConfig(c.id))
      } catch (e: any) {
        console.error(`[reviews] ${c.clinicId} 네이버 수집 실패:`, e?.message)
        results.push({ clinicId: c.clinicId, error: e?.message || String(e) })
      }
      // 네이버에 연달아 요청하지 않도록 치과 사이 간격
      await new Promise((r) => setTimeout(r, 5000 + Math.random() * 5000))
    }
    return results
  } finally {
    running = false
  }
}

export function startReviewScheduler() {
  if (process.env.REVIEW_AUTO_SYNC === "off") return
  if ((globalThis as any).__reviewSchedulerStarted) return
  ;(globalThis as any).__reviewSchedulerStarted = true
  console.log("[reviews] 네이버 리뷰 자동 수집 시작 (30분 간격 점검)")
  setTimeout(() => runDueNaverSyncs().catch((e) => console.error("[reviews]", e)), 60 * 1000)
  setInterval(() => runDueNaverSyncs().catch((e) => console.error("[reviews]", e)), CHECK_EVERY)
}

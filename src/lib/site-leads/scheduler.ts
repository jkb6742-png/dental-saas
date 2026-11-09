import { prisma } from "@/lib/db"
import { syncSiteLeads, purgeExpiredLeads } from "./service"

// 홈페이지 상담문의 자동 수집. 1분마다 변경분(새 문의 메일 알림이 바로 나가도록), KST 4시대에 전체 재수집(홈페이지에서 지운 글 반영) + 보관기간(1년) 지난 문의 삭제.
// 끄려면 SITE_LEADS_AUTO_SYNC=off

const CHECK_EVERY = 60 * 1000
let running = false

export async function runSiteLeadsJobs() {
  if (running) return
  running = true
  try {
    const kstHour = new Date(Date.now() + 9 * 3600 * 1000).getUTCHours()
    const daily = kstHour === 4
    if (daily) {
      const n = await purgeExpiredLeads().catch(() => 0)
      if (n) console.info(`[site-leads] 보관기간 지난 문의 ${n}건 삭제`)
    }
    const sources = await prisma.siteLeadSource.findMany({ where: { isActive: true } })
    for (const s of sources) {
      // 전체 재수집은 4시대에 하루 1번만
      const full = daily && (!s.lastSyncAt || new Date(s.lastSyncAt.getTime() + 9 * 3600 * 1000).getUTCHours() !== 4)
      try {
        await syncSiteLeads(s.clinicId, { full })
      } catch (e: any) {
        console.error(`[site-leads] ${s.clinicId} 수집 실패:`, e?.message)
      }
    }
  } finally {
    running = false
  }
}

export function startSiteLeadsScheduler() {
  if (process.env.SITE_LEADS_AUTO_SYNC === "off") return
  if ((globalThis as any).__siteLeadsSchedulerStarted) return
  ;(globalThis as any).__siteLeadsSchedulerStarted = true
  console.info("[site-leads] 홈페이지 상담문의 자동 수집 시작 (1분 간격)")
  setTimeout(() => runSiteLeadsJobs().catch((e) => console.error("[site-leads]", e)), 60 * 1000)
  setInterval(() => runSiteLeadsJobs().catch((e) => console.error("[site-leads]", e)), CHECK_EVERY)
}

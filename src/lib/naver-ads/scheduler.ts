import { prisma } from "@/lib/db"
import { ymd } from "./client"
import { syncClinic, checkBizmoneyAlert, notifySyncFailure } from "./service"
import { generateReport, monthRange } from "./report"
import { pruneNotifications } from "@/lib/notifications"

// 앱 서버 안에서 도는 네이버 검색광고 자동화. 1시간마다 깨어나서
//  1) 하루 1회(KST 06시 이후) 최근 7일 성과 동기화 — 실패가 새로 생기면 메일
//  2) KST 8~22시 매시간 비즈머니 잔액 점검 → 기준 이하면 메일(24시간 1회)
//  3) 매월 1~3일, 전월 운영 보고서 자동 생성(계정별 옵션)
// 끄려면 NAVER_ADS_AUTO_SYNC=off

const CHECK_EVERY = 60 * 60 * 1000
let running = false

export async function runNaverAdsJobs(force = false) {
  if (running) return
  running = true
  try {
    const now = Date.now()
    const kst = new Date(now + 9 * 3600 * 1000)
    const kstHour = kst.getUTCHours()
    const kstMidnight = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - 9 * 3600 * 1000

    // 새벽 4시대에 90일 지난 앱 알림 정리
    if (kstHour === 4) await pruneNotifications(90).catch(() => null)

    const accounts = await prisma.naverAdAccount.findMany({ where: { isActive: true } })
    for (const acc of accounts) {
      // 1) 일 1회 동기화
      if (force || (kstHour >= 6 && (!acc.lastSyncAt || acc.lastSyncAt.getTime() < kstMidnight))) {
        const until = new Date(now - 24 * 3600 * 1000)
        const since = new Date(until.getTime() - 6 * 24 * 3600 * 1000)
        try {
          await syncClinic(acc.clinicId, ymd(since), ymd(until))
        } catch (e: any) {
          const msg = e?.message || String(e)
          console.error(`[naver-ads] ${acc.clinicId} 동기화 실패:`, msg)
          if (acc.lastSyncStatus !== "FAILED") await notifySyncFailure(acc.clinicId, msg).catch((err) => console.error("[naver-ads] 실패 알림 오류", err))
        }
      }
      // 2) 비즈머니 점검
      if (force || (kstHour >= 8 && kstHour < 22)) {
        try {
          const r = await checkBizmoneyAlert(acc.clinicId)
          if (r.sent) console.info(`[naver-ads] ${acc.clinicId} 비즈머니 부족 메일 발송 (${r.balance}원)`)
        } catch (e: any) {
          console.error(`[naver-ads] ${acc.clinicId} 비즈머니 점검 실패:`, e?.message)
        }
      }
      // 3) 전월 보고서 자동 생성
      if (acc.autoMonthlyReport && kst.getUTCDate() <= 3 && kstHour >= 7) {
        const prevMonth = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth() - 1, 1))
        const r = monthRange(prevMonth.getUTCFullYear(), prevMonth.getUTCMonth() + 1)
        const exists = await prisma.naverAdReport.findFirst({ where: { clinicId: acc.clinicId, periodStart: new Date(r.since), periodEnd: new Date(r.until), status: { not: "FAILED" } } })
        if (!exists) {
          try {
            await generateReport({ clinicId: acc.clinicId, since: r.since, until: r.until, createdBy: "scheduler" })
            console.info(`[naver-ads] ${acc.clinicId} ${r.since}~${r.until} 보고서 자동 생성`)
          } catch (e: any) {
            console.error(`[naver-ads] ${acc.clinicId} 보고서 자동 생성 실패:`, e?.message)
          }
        }
      }
    }
  } finally {
    running = false
  }
}

export function startNaverAdsScheduler() {
  if (process.env.NAVER_ADS_AUTO_SYNC === "off") return
  if ((globalThis as any).__naverAdsSchedulerStarted) return
  ;(globalThis as any).__naverAdsSchedulerStarted = true
  console.info("[naver-ads] 검색광고 자동 동기화·알림 시작 (1시간 간격 점검)")
  setTimeout(() => runNaverAdsJobs().catch((e) => console.error("[naver-ads]", e)), 90 * 1000)
  setInterval(() => runNaverAdsJobs().catch((e) => console.error("[naver-ads]", e)), CHECK_EVERY)
}

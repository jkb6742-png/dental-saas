export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV === "production") {
    const { startReviewScheduler } = await import("@/lib/reviews/scheduler")
    startReviewScheduler()
    const { startNaverAdsScheduler } = await import("@/lib/naver-ads/scheduler")
    startNaverAdsScheduler()
    const { startSiteLeadsScheduler } = await import("@/lib/site-leads/scheduler")
    startSiteLeadsScheduler()
    const { startWorkScheduler } = await import("@/lib/work/jobs")
    startWorkScheduler()
  }
}

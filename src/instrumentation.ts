export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV === "production") {
    const { startReviewScheduler } = await import("@/lib/reviews/scheduler")
    startReviewScheduler()
  }
}

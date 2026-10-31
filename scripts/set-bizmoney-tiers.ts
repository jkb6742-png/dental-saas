// 디어스·중산 비즈머니 알림을 금액 2단계(1차 100,000원 · 2차 50,000원)로 설정하고 판정 결과를 출력한다
// 실행: npx tsx --env-file=.env scripts/set-bizmoney-tiers.ts
import { prisma } from "../src/lib/db"
import { checkBizmoneyAlert } from "../src/lib/naver-ads/service"

async function main() {
  const accounts = await prisma.naverAdAccount.findMany({ include: { clinic: { select: { name: true } } } })
  for (const acc of accounts) {
    if (!/디어스|중산/.test(acc.clinic.name)) continue
    await prisma.naverAdAccount.update({
      where: { id: acc.id },
      data: { alertEnabled: true, alertDays: null, alertThreshold: 100000, alertThreshold2: 50000, lastAlertLevel: 0 },
    })
    const r = await checkBizmoneyAlert(acc.clinicId)
    console.log(acc.clinic.name, "→ 1차 100,000 · 2차 50,000 · 메일", acc.alertEmails, "| 판정:", r.reason ?? (r.sent ? "발송" : "-"), "| 잔액", r.balance)
  }
}
main().finally(() => prisma.$disconnect())

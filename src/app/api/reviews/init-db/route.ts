import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/auth"

// GET /api/reviews/init-db
// 네이버 리뷰 자동 수집용 컬럼·테이블을 멱등 생성하고, 아직 설정이 없는 치과에 네이버 플레이스를 연결한다.
// Dockerfile 이 마이그레이션을 돌리지 않으므로 NAS 배포 후 마스터가 1회 호출.
const KNOWN_PLACES: Array<{ match: string; placeId: string }> = [
  { match: "중산", placeId: "13055956" },
  { match: "디어스", placeId: "1989758373" },
  { match: "고산", placeId: "2019721532" },
  { match: "지음", placeId: "1364600419" }, // 노원구 공릉동
]

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 })
  if ((session.user as any).role !== "MASTER") return NextResponse.json({ error: "마스터만 실행할 수 있습니다" }, { status: 403 })

  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "originType" TEXT;`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "replyDraft" TEXT;`)
    await prisma.$executeRawUnsafe(`ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "analyzedAt" TIMESTAMP(3);`)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ReviewSnapshot" (
        "id" TEXT PRIMARY KEY,
        "configId" TEXT NOT NULL,
        "visitorTotal" INTEGER NOT NULL,
        "blogTotal" INTEGER,
        "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ReviewSnapshot_configId_fkey" FOREIGN KEY ("configId") REFERENCES "ReviewConfig"("id") ON UPDATE CASCADE ON DELETE CASCADE
      );
    `)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ReviewSnapshot_configId_takenAt_idx" ON "ReviewSnapshot"("configId", "takenAt");`)

    const clinics = await prisma.clinic.findMany({ select: { id: true, name: true } })
    const linked: string[] = []
    for (const clinic of clinics) {
      const known = KNOWN_PLACES.find((k) => clinic.name.includes(k.match))
      if (!known) continue
      const exists = await prisma.reviewConfig.findUnique({ where: { clinicId_source: { clinicId: clinic.id, source: "NAVER" } } })
      if (exists?.placeId) continue
      await prisma.reviewConfig.upsert({
        where: { clinicId_source: { clinicId: clinic.id, source: "NAVER" } },
        create: { clinicId: clinic.id, source: "NAVER", placeId: known.placeId, placeUrl: `https://m.place.naver.com/hospital/${known.placeId}`, isActive: true },
        update: { placeId: known.placeId, placeUrl: `https://m.place.naver.com/hospital/${known.placeId}`, isActive: true },
      })
      linked.push(clinic.name)
    }

    return NextResponse.json({ success: true, message: "네이버 리뷰 자동 수집 준비 완료", linked })
  } catch (error: any) {
    console.error("[reviews/init-db]", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { prisma } from "@/lib/db"
import { getActor } from "@/lib/requests/access"

// GET /api/requests/init-db
// 요청사항·네이버 검색광고(계정·일 성과·알림·보고서)·홈페이지 상담문의 테이블을 멱등 생성.
// Dockerfile 이 마이그레이션을 돌리지 않으므로 NAS 배포 후 마스터가 1회 호출. 여러 번 호출해도 안전.
const MIGRATIONS = ["20261016100000_add_service_requests_naver_ads", "20261016130000_naver_ad_alerts", "20261017100000_notifications", "20261019100000_naver_ad_alert_tiers", "20261022100000_pei_surveys", "20261028100000_pei_visit_type", "20261030100000_site_leads", "20261031100000_site_lead_alert_emails"]

function splitStatements(sql: string) {
  // DO $$ ... $$; 블록은 내부에 세미콜론이 있으므로 블록 단위로 나눈다
  const statements: string[] = []
  let buf = ""
  let inDollar = false
  for (const line of sql.split("\n")) {
    if (line.trim().startsWith("--")) continue
    const dollarCount = (line.match(/\$\$/g) || []).length
    if (dollarCount % 2 === 1) inDollar = !inDollar
    buf += line + "\n"
    if (!inDollar && line.trim().endsWith(";")) {
      statements.push(buf.trim())
      buf = ""
    }
  }
  return statements.filter(Boolean)
}

export async function GET() {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 })
  if (!actor.isMaster) return NextResponse.json({ error: "마스터만 실행할 수 있습니다" }, { status: 403 })

  try {
    let ran = 0
    for (const dir of MIGRATIONS) {
      const file = path.join(process.cwd(), "prisma", "migrations", dir, "migration.sql")
      const sql = await fs.readFile(file, "utf-8")
      for (const st of splitStatements(sql)) {
        await prisma.$executeRawUnsafe(st)
        ran++
      }
    }
    return NextResponse.json({ success: true, message: "요청사항·네이버 검색광고 테이블 준비 완료", migrations: MIGRATIONS.length, statements: ran })
  } catch (error: any) {
    console.error("[requests/init-db]", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

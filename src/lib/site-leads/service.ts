import { prisma } from "@/lib/db"
import { protect, reveal, mask } from "@/lib/naver-ads/service"
import { createNotifications } from "@/lib/notifications"

export { protect, reveal, mask }

// 홈페이지(그누보드 /dashboard/api/leads.php)에서 상담문의를 읽어 온다. 읽기 전용 — 상태 변경은 홈페이지 대시보드에서.
// 개인정보 보관: 접수 후 RETENTION_DAYS 지나면 Insight 에서 삭제.
export const RETENTION_DAYS = 365

type SiteLeadRow = {
  id: number; bo_table: string; wr_id: number; created_at: string; updated_at: string | null
  status: string; status_label: string | null; name: string | null; phone: string | null; category: string | null; subject: string | null
  source: string | null; path: string | null; src: string | null; src_label: string | null; med: string | null; med_label: string | null
  camp: string | null; note_count: number
}

export function normalizeSiteUrl(v: string) {
  const s = v.trim().replace(/\/+$/, "")
  const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`)
  return `${u.protocol}//${u.host}`
}

/** KST 'YYYY-MM-DD HH:MM:SS' (사이트 DB 가 서울 시간으로 저장) */
function kstString(d: Date) {
  const k = new Date(d.getTime() + 9 * 3600 * 1000)
  return k.toISOString().slice(0, 19).replace("T", " ")
}

async function fetchPage(siteUrl: string, token: string, params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString()
  const res = await fetch(`${siteUrl}/dashboard/api/leads.php?${qs}`, {
    headers: { "X-Insight-Token": token, "User-Agent": "THINKLAB-Insight/1.0", Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  })
  const text = await res.text()
  let body: any = null
  try {
    body = JSON.parse(text)
  } catch {
    throw new Error(`응답이 JSON 이 아닙니다 (HTTP ${res.status}${/cloudflare|cf-/i.test(text) ? ", Cloudflare 차단 의심" : ""})`)
  }
  if (res.status === 401) throw new Error("토큰이 맞지 않습니다. 홈페이지 /dashboard/insight.php 에서 다시 발급해 주세요")
  if (!res.ok || !body?.ok) throw new Error(`홈페이지 API 오류 (HTTP ${res.status}${body?.error ? `, ${body.error}` : ""})`)
  return body as { ok: true; now: string; leads: SiteLeadRow[]; has_more: boolean; next_after: number | null }
}

/** 연결 확인용 — 최근 1일만 조회 */
export async function testConnection(siteUrl: string, token: string) {
  const r = await fetchPage(siteUrl, token, { days: "1" })
  return { count: r.leads.length }
}

async function fetchAll(siteUrl: string, token: string, base: Record<string, string>) {
  const rows: SiteLeadRow[] = []
  let after: number | null = null
  for (let i = 0; i < 50; i++) {
    const r = await fetchPage(siteUrl, token, after ? { ...base, after: String(after) } : base)
    rows.push(...r.leads)
    if (!r.has_more || !r.next_after) break
    after = r.next_after
  }
  return rows
}

/**
 * full=true: 보관기간(365일) 전체를 다시 받아 홈페이지에서 지워진 글은 Insight 에서도 지운다.
 * full=false: 마지막 동기화 1시간 전 이후 접수·변경분만.
 */
export async function syncSiteLeads(clinicId: string, opts: { full?: boolean; notify?: boolean } = {}) {
  const src = await prisma.siteLeadSource.findUnique({ where: { clinicId } })
  if (!src) throw new Error("상담문의 연동이 설정되지 않았습니다")
  const token = reveal(src.token)
  const full = opts.full || !src.lastSyncAt
  const params: Record<string, string> = full
    ? { days: String(RETENTION_DAYS) }
    : { since: kstString(new Date(src.lastSyncAt!.getTime() - 3600 * 1000)) }

  try {
    const rows = await fetchAll(src.siteUrl, token, params)
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400000)
    const existing = new Set(
      (await prisma.siteLead.findMany({ where: { sourceId: src.id, siteLeadId: { in: rows.map((r) => r.id) } }, select: { siteLeadId: true } })).map((r) => r.siteLeadId),
    )
    const fresh: SiteLeadRow[] = []
    for (const r of rows) {
      const receivedAt = new Date(r.created_at)
      if (Number.isNaN(receivedAt.getTime()) || receivedAt < cutoff) continue
      const data = {
        boTable: r.bo_table, wrId: r.wr_id, receivedAt,
        siteUpdatedAt: r.updated_at ? new Date(r.updated_at) : null,
        status: r.status, statusLabel: r.status_label, name: r.name, phone: r.phone, category: r.category, subject: r.subject,
        channel: r.source, path: r.path, src: r.src, srcLabel: r.src_label, med: r.med, medLabel: r.med_label || null,
        campaign: r.camp || null, noteCount: r.note_count ?? 0,
      }
      await prisma.siteLead.upsert({
        where: { sourceId_siteLeadId: { sourceId: src.id, siteLeadId: r.id } },
        create: { clinicId, sourceId: src.id, siteLeadId: r.id, ...data },
        update: data,
      })
      if (!existing.has(r.id) && r.status !== "spam") fresh.push(r)
    }
    let removed = 0
    if (full) {
      const keep = rows.map((r) => r.id)
      removed = (await prisma.siteLead.deleteMany({ where: { sourceId: src.id, siteLeadId: { notIn: keep } } })).count
    }
    await prisma.siteLeadSource.update({ where: { id: src.id }, data: { lastSyncAt: new Date(), lastSyncStatus: "SUCCESS", lastSyncError: null } })

    // 첫 동기화(과거분 일괄)는 알리지 않는다
    if (opts.notify !== false && src.lastSyncAt && fresh.length) {
      const first = fresh[0]
      await createNotifications({
        type: "SITE_LEAD_NEW",
        title: fresh.length === 1 ? `홈페이지 상담문의 1건${first.category ? ` · ${first.category}` : ""}` : `홈페이지 상담문의 ${fresh.length}건`,
        body: fresh.map((r) => r.subject || "(제목 없음)").slice(0, 5).join("\n"),
        link: `/dashboard/${clinicId}/site-leads`,
        clinicId,
        audience: "all",
      }).catch((e) => console.error("[site-leads] 알림 실패", e))
    }
    return { fetched: rows.length, added: fresh.length, removed, full }
  } catch (e: any) {
    await prisma.siteLeadSource.update({ where: { id: src.id }, data: { lastSyncAt: src.lastSyncAt, lastSyncStatus: "FAILED", lastSyncError: String(e?.message ?? e).slice(0, 500) } })
    throw e
  }
}

/** 접수 후 보관기간 지난 문의 삭제 (이름·연락처 포함 행 전체) */
export async function purgeExpiredLeads() {
  const r = await prisma.siteLead.deleteMany({ where: { receivedAt: { lt: new Date(Date.now() - RETENTION_DAYS * 86400000) } } })
  return r.count
}

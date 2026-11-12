import { prisma } from "@/lib/db"
import { protect, reveal, mask } from "@/lib/naver-ads/service"
import { createNotifications } from "@/lib/notifications"
import { isMailConfigured, sendMail, parseEmails } from "@/lib/mail"

export { protect, reveal, mask }

// 홈페이지(그누보드 /dashboard/api/leads.php)에서 상담문의를 읽어 온다. 읽기 전용 — 상태 변경은 홈페이지 대시보드에서.
// 개인정보 보관: 접수 후 RETENTION_DAYS 지나면 Insight 에서 삭제.
export const RETENTION_DAYS = 365

type SiteLeadRow = {
  id: number; bo_table: string; wr_id: number; created_at: string; updated_at: string | null
  status: string; status_label: string | null; name: string | null; phone: string | null; category: string | null; subject: string | null
  source: string | null; path: string | null; src: string | null; src_label: string | null; med: string | null; med_label: string | null
  camp: string | null; note_count: number
  content?: string | null // 상담 본문 (홈페이지 API 2026-11-12 이후)
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
        // 상담 본문: 개인 건강정보가 담길 수 있어 암호화 저장. 옛 홈페이지 API(본문 없음)면 기존 값 유지
        ...(r.content !== undefined ? { content: r.content ? protect(String(r.content).slice(0, 4000)) : null } : {}),
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
      const to = parseEmails(src.alertEmails)
      if (to.length && isMailConfigured()) await sendLeadMail(clinicId, src.siteUrl, to, fresh).catch((e) => console.error("[site-leads] 메일 실패", e?.message))
    }
    return { fetched: rows.length, added: fresh.length, removed, full }
  } catch (e: any) {
    await prisma.siteLeadSource.update({ where: { id: src.id }, data: { lastSyncAt: src.lastSyncAt, lastSyncStatus: "FAILED", lastSyncError: String(e?.message ?? e).slice(0, 500) } })
    throw e
  }
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!)
// 메일은 외부(Gmail 등)로 나가므로 이름·연락처는 가린다 — 홍*동 · 010-****-5678
export const maskName = (n: string | null) => (!n ? "이름 없음" : n.length <= 1 ? "*" : n.length === 2 ? `${n[0]}*` : `${n[0]}${"*".repeat(n.length - 2)}${n[n.length - 1]}`)
export const maskPhone = (p: string | null) => {
  const d = (p ?? "").replace(/\D/g, "")
  return d.length >= 8 ? `${d.slice(0, 3)}-****-${d.slice(-4)}` : "—"
}

async function sendLeadMail(clinicId: string, siteUrl: string, to: string[], rows: SiteLeadRow[]) {
  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { name: true } })
  const name = clinic?.name ?? "치과"
  const base = process.env.NEXTAUTH_URL?.startsWith("https://") ? process.env.NEXTAUTH_URL : "https://thinklabinsight.com"
  const kst = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 16).replace("T", " ")
  const lines = rows.map((r) => `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee">${kst(r.created_at)}</td><td style="padding:6px 10px;border-bottom:1px solid #eee">${esc(maskName(r.name))}</td><td style="padding:6px 10px;border-bottom:1px solid #eee">${maskPhone(r.phone)}</td><td style="padding:6px 10px;border-bottom:1px solid #eee">${esc([r.category, r.subject].filter(Boolean).join(" · ") || "-")}</td><td style="padding:6px 10px;border-bottom:1px solid #eee">${esc([r.src_label, r.med_label].filter(Boolean).join(" · ") || "-")}</td></tr>`).join("")
  await sendMail({
    to,
    subject: `[${name}] 홈페이지 상담문의 ${rows.length}건`,
    html: `<div style="font-family:sans-serif;font-size:14px;color:#191f28"><p><b>${esc(name)}</b> 홈페이지에 상담문의가 들어왔습니다.</p>
<table style="border-collapse:collapse;font-size:13px"><tr style="background:#f9fafb"><th style="padding:6px 10px;text-align:left">접수</th><th style="padding:6px 10px;text-align:left">이름</th><th style="padding:6px 10px;text-align:left">연락처</th><th style="padding:6px 10px;text-align:left">분류 · 제목</th><th style="padding:6px 10px;text-align:left">유입</th></tr>${lines}</table>
<p style="margin-top:16px"><a href="${base}/dashboard/${clinicId}/site-leads">Insight 에서 보기</a> · <a href="${siteUrl}/dashboard/leads.php">홈페이지 관리 화면</a></p>
<p style="color:#8b95a1;font-size:12px">개인정보 보호를 위해 이름·연락처 일부를 가렸습니다. 전체 정보는 Insight 또는 홈페이지 관리 화면에서 확인하세요.</p></div>`,
    text: `[${name}] 홈페이지 상담문의 ${rows.length}건\n` + rows.map((r) => `${kst(r.created_at)} ${maskName(r.name)} ${maskPhone(r.phone)} ${[r.category, r.subject].filter(Boolean).join(" · ")}`).join("\n"),
  })
}

/** 접수 후 보관기간 지난 문의 삭제 (이름·연락처 포함 행 전체) */
export async function purgeExpiredLeads() {
  const r = await prisma.siteLead.deleteMany({ where: { receivedAt: { lt: new Date(Date.now() - RETENTION_DAYS * 86400000) } } })
  return r.count
}

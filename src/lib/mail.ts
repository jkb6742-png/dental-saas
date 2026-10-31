import nodemailer from "nodemailer"

// SMTP 메일 발송. Gmail 이면 SMTP_HOST=smtp.gmail.com SMTP_PORT=465 SMTP_USER=계정 SMTP_PASS=앱 비밀번호
export function isMailConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
}

export const MAIL_NOT_CONFIGURED = "메일 서버(SMTP_HOST·SMTP_USER·SMTP_PASS)가 설정되어 있지 않습니다"

let cached: nodemailer.Transporter | null = null
function transporter() {
  if (cached) return cached
  const port = Number(process.env.SMTP_PORT ?? 465)
  cached = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })
  return cached
}

export async function sendMail(opts: { to: string[]; subject: string; html: string; text?: string }) {
  if (!isMailConfigured()) throw new Error(MAIL_NOT_CONFIGURED)
  const from = process.env.MAIL_FROM || `THINKLAB Insight <${process.env.SMTP_USER}>`
  const info = await transporter().sendMail({ from, to: opts.to.join(", "), subject: opts.subject, html: opts.html, text: opts.text })
  return info.messageId as string
}

export function parseEmails(s?: string | null): string[] {
  return (s ?? "")
    .split(/[,;\s]+/)
    .map((e) => e.trim())
    .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))
}

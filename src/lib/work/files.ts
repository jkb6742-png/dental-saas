import path from "path"
import { promises as fs } from "fs"
import { createHash, randomBytes } from "crypto"
import { prisma } from "@/lib/db"
import type { Actor } from "@/lib/requests/access"
import { canAccessClinic } from "@/lib/requests/access"

// 공유 파일 저장소. 실제 파일은 uploads/files/<예측 불가 키>, 이름·권한은 DB.
// 원장은 visibility=CLINIC 으로 공개된 자기 치과 파일만 받는다.

const ROOT = path.join(process.cwd(), "uploads", "files")
// 업무에 붙인 파일은 NAS 공유 폴더(공유\업무자료)에 <치과>\<그룹>\<업무>\<원래 이름> 으로 저장한다.
// 운영 컨테이너는 NAS 의 그 폴더를 NAS_FILES_ROOT 로 연결한다. 로컬은 uploads/nas.
export const NAS_ROOT = path.resolve(process.env.NAS_FILES_ROOT || path.join(process.cwd(), "uploads", "nas"))

/** 폴더·파일 이름에 못 쓰는 글자 정리 */
export const safeName = (s: string) =>
  s.replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ").replace(/\s+/g, " ").replace(/^[.\s]+|[.\s]+$/g, "").slice(0, 80) || "이름없음"

/** 업무 파일이 들어갈 NAS 폴더 [치과, 그룹, 업무] */
export async function taskFolder(taskId: string) {
  const t = await prisma.task.findUnique({ where: { id: taskId }, select: { title: true, clinic: { select: { name: true } }, group: { select: { name: true } } } })
  if (!t) return null
  return [t.clinic?.name ?? "THINKLAB 사내", t.group?.name ?? "그룹 없음", t.title]
}

/** storageKey → 실제 경로. files/ 는 앱 폴더, nas/ 는 NAS 공유 폴더. 바깥으로 나가는 경로는 막는다. */
export function storedPath(storageKey: string) {
  if (storageKey.startsWith("nas/")) {
    const abs = path.resolve(NAS_ROOT, storageKey.slice(4))
    if (!abs.startsWith(NAS_ROOT + path.sep)) throw new Error("잘못된 파일 경로")
    return abs
  }
  const abs = path.resolve(process.cwd(), "uploads", storageKey)
  if (!abs.startsWith(ROOT + path.sep)) throw new Error("잘못된 파일 경로")
  return abs
}
export const MAX_SHARED_FILE_BYTES = 100 * 1024 * 1024
const BLOCKED_EXT = new Set([".exe", ".bat", ".cmd", ".com", ".msi", ".ps1", ".sh", ".js", ".vbs", ".scr", ".jar", ".html", ".htm", ".svg"])

export function checkUpload(file: File) {
  if (!file || typeof file.arrayBuffer !== "function") return "파일을 선택하세요"
  if (file.size <= 0) return "빈 파일입니다"
  if (file.size > MAX_SHARED_FILE_BYTES) return `파일당 ${MAX_SHARED_FILE_BYTES / 1024 / 1024}MB 이하만 올릴 수 있습니다`
  if (BLOCKED_EXT.has(path.extname(file.name).toLowerCase())) return "실행 파일·웹 문서는 올릴 수 없습니다"
  return null
}

/** 파일을 저장하고 버전 행에 넣을 값을 돌려준다. folder 가 있으면 NAS 공유 폴더에 사람이 읽을 수 있는 이름으로. */
export async function storeFile(file: File, folder?: string[] | null) {
  const buf = Buffer.from(await file.arrayBuffer())
  let storageKey: string
  if (folder?.length) {
    const dir = path.join(NAS_ROOT, ...folder.map(safeName))
    await fs.mkdir(dir, { recursive: true })
    const ext = path.extname(file.name).slice(0, 12)
    const base = safeName(path.basename(file.name, path.extname(file.name)))
    let name = `${base}${ext}`
    // 같은 이름이 있으면 (2), (3)… 을 붙인다. 덮어쓰지 않는다.
    for (let i = 2; ; i++) {
      try {
        await fs.writeFile(path.join(dir, name), buf, { flag: "wx" })
        break
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "EEXIST" || i > 500) throw e
        name = `${base} (${i})${ext}`
      }
    }
    storageKey = `nas/${path.relative(NAS_ROOT, path.join(dir, name)).split(path.sep).join("/")}`
  } else {
    const key = `${new Date().toISOString().slice(0, 7)}/${randomBytes(24).toString("hex")}`
    const abs = path.join(ROOT, key)
    await fs.mkdir(path.dirname(abs), { recursive: true })
    await fs.writeFile(abs, buf)
    storageKey = `files/${key}`
  }
  return {
    storageKey,
    originalName: file.name.slice(0, 255) || "file",
    mimeType: (file.type || "application/octet-stream").slice(0, 120),
    byteSize: BigInt(buf.length),
    sha256: createHash("sha256").update(buf).digest("hex"),
  }
}

export async function readStored(storageKey: string) {
  return fs.readFile(storedPath(storageKey))
}

/** 첨부 다운로드 응답. 이미지·PDF 는 ?inline=1 로 미리보기. */
export function fileResponse(buf: Buffer, v: { originalName: string; mimeType: string }, inline: boolean) {
  const canInline = inline && (v.mimeType.startsWith("image/") && v.mimeType !== "image/svg+xml" || v.mimeType === "application/pdf")
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": v.mimeType,
      "Content-Length": String(buf.length),
      "Content-Disposition": `${canInline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(v.originalName)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=60",
    },
  })
}

/** 직원이 이 파일을 볼 수 있는가. 치과 없는 회사 공통 자료는 직원 전원. */
export function staffCanSee(actor: Actor, f: { clinicId: string | null }) {
  if (actor.isMaster) return true
  if (!actor.isStaff) return false
  return f.clinicId === null || canAccessClinic(actor, f.clinicId)
}

export const fileListSelect = {
  id: true,
  clinicId: true,
  taskId: true,
  serviceRequestId: true,
  visibility: true,
  title: true,
  currentVersion: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  clinic: { select: { name: true } },
  uploadedBy: { select: { name: true } },
  task: { select: { title: true } },
  versions: {
    orderBy: { versionNo: "desc" as const },
    select: { id: true, versionNo: true, originalName: true, mimeType: true, byteSize: true, createdAt: true, uploadedBy: { select: { name: true } } },
  },
}

export function serializeFile(f: any) {
  return { ...f, versions: f.versions.map((v: any) => ({ ...v, byteSize: Number(v.byteSize) })) }
}

/** 지운 지 30일 지난 파일의 실제 바이너리 정리 */
export async function purgeDeletedFiles(days = 30) {
  const old = await prisma.sharedFile.findMany({
    where: { deletedAt: { lt: new Date(Date.now() - days * 86400_000) } },
    select: { id: true, versions: { select: { storageKey: true } } },
  })
  for (const f of old) {
    for (const v of f.versions) {
      await fs.rm(storedPath(v.storageKey), { force: true }).catch(() => {})
    }
  }
  return old.length
}

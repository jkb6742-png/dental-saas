import path from "path"
import { promises as fs } from "fs"
import { randomUUID } from "crypto"
import { ALLOWED_MIME_PREFIXES, MAX_FILE_BYTES, MAX_FILES } from "./categories"

const ROOT = path.join(process.cwd(), "uploads", "requests")

export function validateFiles(files: File[]) {
  if (files.length > MAX_FILES) return `첨부는 최대 ${MAX_FILES}개까지 가능합니다`
  for (const f of files) {
    if (f.size > MAX_FILE_BYTES) return `${f.name}: 파일당 ${MAX_FILE_BYTES / 1024 / 1024}MB 이하만 가능합니다`
    if (!ALLOWED_MIME_PREFIXES.some((p) => f.type.startsWith(p))) return `${f.name}: 지원하지 않는 파일 형식입니다`
  }
  return null
}

/** uploads/requests/<clinicId>/<requestId>/<uuid>.<ext> 로 저장하고 상대경로를 돌려준다. */
export async function saveRequestFile(clinicId: string, requestId: string, file: File) {
  const dir = path.join(ROOT, clinicId, requestId)
  await fs.mkdir(dir, { recursive: true })
  const ext = path.extname(file.name).toLowerCase().slice(0, 10)
  const fileName = `${randomUUID()}${ext}`
  const abs = path.join(dir, fileName)
  await fs.writeFile(abs, Buffer.from(await file.arrayBuffer()))
  return { fileName, filePath: path.relative(process.cwd(), abs).split(path.sep).join("/") }
}

export function absolutePath(relative: string) {
  const abs = path.resolve(process.cwd(), relative)
  if (!abs.startsWith(ROOT)) throw new Error("잘못된 파일 경로")
  return abs
}

import path from "path"
import { promises as fs } from "fs"
import { randomUUID } from "crypto"

// 의료진 사진 — uploads/pei-photos/<clinicId>/<uuid>.<ext> (운영은 /app/uploads 볼륨이라 컨테이너 교체에도 남는다)
const ROOT = path.join(process.cwd(), "uploads", "pei-photos")
export const PHOTO_MAX_BYTES = 3 * 1024 * 1024
export const PHOTO_TYPES: Record<string, string> = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" }

export async function savePhoto(clinicId: string, file: File) {
  const ext = PHOTO_TYPES[file.type]
  if (!ext) throw new Error("JPG·PNG·WEBP 이미지만 올릴 수 있습니다")
  if (file.size > PHOTO_MAX_BYTES) throw new Error("사진은 3MB 이하만 가능합니다")
  const dir = path.join(ROOT, clinicId)
  await fs.mkdir(dir, { recursive: true })
  const fileName = `${randomUUID()}${ext}`
  await fs.writeFile(path.join(dir, fileName), Buffer.from(await file.arrayBuffer()))
  return `/api/public/pei-photo/${clinicId}/${fileName}`
}

/** 경로 조작을 막고 파일을 읽는다. 없으면 null */
export async function readPhoto(clinicId: string, fileName: string) {
  if (!/^[\w-]+$/.test(clinicId) || !/^[\w-]+\.(jpg|png|webp)$/.test(fileName)) return null
  try {
    const buf = await fs.readFile(path.join(ROOT, clinicId, fileName))
    const type = Object.entries(PHOTO_TYPES).find(([, e]) => fileName.endsWith(e))![0]
    return { buf, type }
  } catch {
    return null
  }
}

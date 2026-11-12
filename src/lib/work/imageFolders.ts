import path from "path"
import { promises as fs } from "fs"
import { prisma } from "@/lib/db"
import { NAS_ROOT, safeName, storedPath, taskFolder } from "./files"

// 이미지 폴더함 폴더 = NAS 실제 폴더. 앱에서 만들기·이름 바꾸기·삭제·이미지 이동을 하면 NAS 에도 바로 반영한다.
// 위치: NAS_ROOT(공유\업무자료)\<치과 이름 또는 THINKLAB 사내>\<폴더 경로>

export const INTERNAL_DIR = "THINKLAB 사내"

export async function scopeDir(clinicId: string | null) {
  if (!clinicId) return INTERNAL_DIR
  const c = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { name: true } })
  return safeName(c?.name ?? clinicId)
}

const abs = (rel: string) => {
  const p = path.resolve(NAS_ROOT, ...rel.split("/"))
  if (!p.startsWith(NAS_ROOT + path.sep)) throw new Error("잘못된 폴더 경로")
  return p
}

async function exists(p: string) {
  return fs.stat(p).then(() => true).catch(() => false)
}

/** 같은 이름이 있으면 (2), (3)… 을 붙인 빈 자리 */
async function freeName(dir: string, file: string) {
  const ext = path.extname(file)
  const base = path.basename(file, ext)
  let name = file
  for (let i = 2; await exists(path.join(dir, name)); i++) name = `${base} (${i})${ext}`
  return name
}

export async function createFolder(agencyId: string, clinicId: string | null, parentId: string | null, rawName: string, userId: string) {
  const name = safeName(rawName).slice(0, 80)
  let base = await scopeDir(clinicId)
  if (parentId) {
    const parent = await prisma.imageFolder.findFirst({ where: { id: parentId, agencyId, clinicId } })
    if (!parent) throw new Error("상위 폴더를 찾을 수 없습니다")
    base = parent.path
  }
  const rel = `${base}/${name}`
  if (await prisma.imageFolder.findUnique({ where: { agencyId_path: { agencyId, path: rel } } })) throw new Error("같은 이름의 폴더가 이미 있습니다")
  await fs.mkdir(abs(rel), { recursive: true })
  return prisma.imageFolder.create({ data: { agencyId, clinicId, parentId, name, path: rel, createdByUserId: userId } })
}

/** 폴더 이름 바꾸기: NAS 폴더 이름을 바꾸고, 하위 폴더 경로·안의 파일 저장 위치도 같이 고친다 */
export async function renameFolder(agencyId: string, id: string, rawName: string) {
  const f = await prisma.imageFolder.findFirst({ where: { id, agencyId } })
  if (!f) throw new Error("폴더를 찾을 수 없습니다")
  const name = safeName(rawName).slice(0, 80)
  if (name === f.name) return f
  const newRel = `${f.path.slice(0, f.path.lastIndexOf("/"))}/${name}`
  if (await prisma.imageFolder.findUnique({ where: { agencyId_path: { agencyId, path: newRel } } })) throw new Error("같은 이름의 폴더가 이미 있습니다")
  if (await exists(abs(newRel))) throw new Error("NAS 에 같은 이름의 폴더가 이미 있습니다")
  if (await exists(abs(f.path))) await fs.rename(abs(f.path), abs(newRel))
  else await fs.mkdir(abs(newRel), { recursive: true })

  const subtree = await prisma.imageFolder.findMany({ where: { agencyId, OR: [{ id }, { path: { startsWith: `${f.path}/` } }] } })
  const versions = await prisma.sharedFileVersion.findMany({ where: { storageKey: { startsWith: `nas/${f.path}/` } }, select: { id: true, storageKey: true } })
  await prisma.$transaction([
    ...subtree.map((s) => prisma.imageFolder.update({ where: { id: s.id }, data: { path: newRel + s.path.slice(f.path.length), ...(s.id === id ? { name } : {}) } })),
    ...versions.map((v) => prisma.sharedFileVersion.update({ where: { id: v.id }, data: { storageKey: `nas/${newRel}${v.storageKey.slice(4 + f.path.length)}` } })),
  ])
  return prisma.imageFolder.findUniqueOrThrow({ where: { id } })
}

/** 이미지(파일)의 모든 버전을 NAS 의 다른 폴더로 옮긴다. targetRel 이 없으면 업무 폴더 또는 치과 폴더로. */
export async function moveFile(fileId: string, target: { folderId: string | null }, agencyId: string) {
  const file = await prisma.sharedFile.findUnique({ where: { id: fileId }, include: { versions: true } })
  if (!file) throw new Error("파일을 찾을 수 없습니다")
  let rel: string
  if (target.folderId) {
    const folder = await prisma.imageFolder.findFirst({ where: { id: target.folderId, agencyId } })
    if (!folder) throw new Error("폴더를 찾을 수 없습니다")
    if (folder.clinicId !== file.clinicId) throw new Error("같은 치과 안에서만 옮길 수 있습니다")
    rel = folder.path
  } else {
    const tf = file.taskId ? await taskFolder(file.taskId) : null
    rel = tf ? tf.map(safeName).join("/") : await scopeDir(file.clinicId)
  }
  const dir = abs(rel)
  await fs.mkdir(dir, { recursive: true })
  const updates: { id: string; storageKey: string }[] = []
  for (const v of file.versions) {
    const from = storedPath(v.storageKey)
    if (!(await exists(from))) continue
    if (v.storageKey.startsWith(`nas/${rel}/`) && !v.storageKey.slice(5 + rel.length).includes("/")) continue // 이미 그 폴더
    const name = await freeName(dir, v.storageKey.startsWith("nas/") ? path.basename(from) : safeName(path.basename(v.originalName, path.extname(v.originalName))) + path.extname(v.originalName).slice(0, 12))
    const to = path.join(dir, name)
    await fs.rename(from, to).catch(async () => {
      // 다른 디스크면 복사 후 삭제
      await fs.copyFile(from, to)
      await fs.rm(from, { force: true })
    })
    updates.push({ id: v.id, storageKey: `nas/${path.relative(NAS_ROOT, to).split(path.sep).join("/")}` })
  }
  await prisma.$transaction([
    ...updates.map((u) => prisma.sharedFileVersion.update({ where: { id: u.id }, data: { storageKey: u.storageKey } })),
    prisma.sharedFile.update({ where: { id: fileId }, data: { imageFolderId: target.folderId } }),
  ])
}

/** 폴더 삭제: 안의 이미지는 지우지 않고 상위 폴더(없으면 치과 폴더)로 옮긴 뒤 NAS 폴더를 지운다. 하위 폴더가 있으면 거부. */
export async function deleteFolder(agencyId: string, id: string) {
  const f = await prisma.imageFolder.findFirst({ where: { id, agencyId } })
  if (!f) throw new Error("폴더를 찾을 수 없습니다")
  if (await prisma.imageFolder.count({ where: { parentId: id } })) throw new Error("하위 폴더를 먼저 지우거나 옮기세요")
  const files = await prisma.sharedFile.findMany({ where: { imageFolderId: id }, select: { id: true } })
  for (const file of files) await moveFile(file.id, { folderId: f.parentId }, agencyId)
  const dir = abs(f.path)
  let leftover = 0
  if (await exists(dir)) {
    const rest = await fs.readdir(dir)
    leftover = rest.length
    // NAS 에 직접 넣은(앱이 모르는) 파일이 남아 있으면 폴더는 지우지 않는다
    if (!leftover) await fs.rmdir(dir)
  }
  await prisma.imageFolder.delete({ where: { id } })
  return { moved: files.length, leftover }
}

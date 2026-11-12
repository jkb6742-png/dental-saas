import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { canAccessClinic } from "@/lib/requests/access"
import { guard, fail } from "@/lib/work/common"

// 이미지 폴더함: 치과(또는 사내) → 그룹 → 업무 폴더별 이미지 파일. NAS 폴더 구조(공유\업무자료\<치과>\<그룹>\<업무>)와 같다.
// 업무에 붙지 않은 치과 이미지는 '업무 없음' 폴더.

export async function GET(req: NextRequest) {
  const g = await guard()
  if ("res" in g) return g.res
  const scope = req.nextUrl.searchParams.get("scope") ?? "internal"
  const clinicId = scope === "internal" ? null : scope
  if (clinicId && !canAccessClinic(g.actor, clinicId)) return fail("권한이 없습니다", 403)

  const files = await prisma.sharedFile.findMany({
    where: {
      clinicId,
      deletedAt: null,
      versions: { some: { mimeType: { startsWith: "image/" } } },
    },
    select: {
      id: true,
      title: true,
      createdAt: true,
      visibility: true,
      taskId: true,
      imageFolderId: true,
      task: { select: { title: true, status: true, group: { select: { id: true, name: true } } } },
      uploadedBy: { select: { name: true } },
      versions: { orderBy: { versionNo: "desc" }, take: 1, select: { originalName: true, mimeType: true, byteSize: true, storageKey: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 2000,
  })

  // 카테고리별 이미지 수(왼쪽 패널)
  const counts = await prisma.sharedFile.groupBy({
    by: ["clinicId"],
    where: {
      deletedAt: null,
      versions: { some: { mimeType: { startsWith: "image/" } } },
      ...(g.actor.isMaster ? {} : { OR: [{ clinicId: null }, { clinicId: { in: g.actor.clinicIds ?? [] } }] }),
    },
    _count: true,
  })

  return NextResponse.json({
    images: files
      .filter((f) => f.versions[0]?.mimeType.startsWith("image/"))
      .map((f) => ({
        id: f.id,
        title: f.title,
        name: f.versions[0].originalName,
        bytes: Number(f.versions[0].byteSize),
        createdAt: f.createdAt,
        visibility: f.visibility,
        uploadedBy: f.uploadedBy.name,
        onNas: f.versions[0].storageKey.startsWith("nas/"),
        taskId: f.taskId,
        folderId: f.imageFolderId,
        taskTitle: f.task?.title ?? null,
        groupId: f.task?.group?.id ?? null,
        groupName: f.task?.group?.name ?? null,
      })),
    counts: Object.fromEntries(counts.map((c) => [c.clinicId ?? "internal", c._count])),
  })
}

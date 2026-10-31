import { prisma } from "@/lib/db"

export const requestInclude = {
  user: { select: { name: true, role: true } },
  comments: { include: { user: { select: { name: true, role: true } } }, orderBy: { createdAt: "asc" as const } },
  attachments: { include: { user: { select: { name: true, role: true } } }, orderBy: { uploadedAt: "asc" as const } },
}

type Raw = NonNullable<Awaited<ReturnType<typeof fetchOne>>>

export async function fetchOne(id: string) {
  return prisma.serviceRequest.findUnique({ where: { id }, include: requestInclude })
}

/** 클라이언트에 내려줄 형태(날짜는 ISO 문자열). */
export function serializeRequest(r: Raw) {
  return {
    id: r.id,
    clinicId: r.clinicId,
    category: r.category,
    title: r.title,
    description: r.description,
    details: (r.details ?? {}) as Record<string, string>,
    status: r.status,
    priority: r.priority,
    dueDate: r.dueDate?.toISOString() ?? null,
    assignee: r.assignee,
    resultNote: r.resultNote,
    completedAt: r.completedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    createdBy: r.createdBy,
    author: r.user.name,
    authorRole: r.user.role,
    comments: r.comments.map((c) => ({
      id: c.id,
      content: c.content,
      author: c.user.name,
      authorRole: c.user.role,
      createdAt: c.createdAt.toISOString(),
    })),
    attachments: r.attachments.map((a) => ({
      id: a.id,
      name: a.originalName,
      size: a.fileSize,
      type: a.mimeType,
      kind: a.kind,
      uploadedBy: a.user.name,
      uploadedAt: a.uploadedAt.toISOString(),
      url: `/api/requests/${r.id}/files/${a.id}`,
    })),
  }
}

export type SerializedRequest = ReturnType<typeof serializeRequest>

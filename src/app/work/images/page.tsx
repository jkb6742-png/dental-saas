export const dynamic = "force-dynamic"

import { requireWorkActor } from "@/lib/work/actor"
import ImagesClient from "./ImagesClient"

// 이미지 폴더함: 치과(사내) → 그룹 → 업무 폴더별 이미지. NAS 공유\업무자료 구조와 같다.
export default async function ImagesPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const actor = await requireWorkActor()
  const { scope } = await searchParams
  return <ImagesClient clinics={actor.clinics} initialScope={scope ?? actor.clinics[0]?.id ?? "internal"} />
}

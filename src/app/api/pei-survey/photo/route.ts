import { NextRequest, NextResponse } from "next/server"
import { getActor } from "@/lib/requests/access"
import { savePhoto } from "@/lib/pei-survey/photos"

// POST /api/pei-survey/photo  (multipart: clinicId, file) — 의료진 사진 업로드, 마스터 전용.
// 돌려준 url 을 설정 저장(PUT /api/pei-survey) 때 doctors[].photo 로 넣는다.
export async function POST(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 })
  if (!actor.isMaster) return NextResponse.json({ error: "마스터만 수정할 수 있습니다" }, { status: 403 })

  const form = await req.formData().catch(() => null)
  const clinicId = String(form?.get("clinicId") || "")
  const file = form?.get("file")
  if (!/^[\w-]+$/.test(clinicId) || !(file instanceof File)) {
    return NextResponse.json({ error: "clinicId 와 사진 파일이 필요합니다" }, { status: 400 })
  }
  try {
    return NextResponse.json({ url: await savePhoto(clinicId, file) })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

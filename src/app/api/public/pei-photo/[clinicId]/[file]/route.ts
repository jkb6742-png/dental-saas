import { NextRequest, NextResponse } from "next/server"
import { readPhoto } from "@/lib/pei-survey/photos"

// GET /api/public/pei-photo/<clinicId>/<file> — 환자 설문 화면의 의료진 사진 (로그인 없음)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ clinicId: string; file: string }> }) {
  const { clinicId, file } = await params
  const photo = await readPhoto(clinicId, file)
  if (!photo) return new NextResponse("Not found", { status: 404 })
  return new NextResponse(new Uint8Array(photo.buf), {
    headers: { "Content-Type": photo.type, "Cache-Control": "public, max-age=31536000, immutable" },
  })
}

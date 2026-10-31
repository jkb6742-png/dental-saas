export const dynamic = "force-dynamic"

import type { Metadata } from "next"
import { getSurveyByToken } from "@/lib/pei-survey/service"
import SurveyView, { surveyMetadata } from "./SurveyView"

// 환자용 공개 설문 페이지 — 로그인 없음. 문자·QR 로 링크(/s/<token>)를 받는다. 한글 주소(/하얀드림치과설문)는 app/[slug].
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params
  return surveyMetadata(await getSurveyByToken(token))
}

export default async function SurveyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <SurveyView survey={await getSurveyByToken(token)} />
}

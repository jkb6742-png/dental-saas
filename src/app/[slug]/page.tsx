export const dynamic = "force-dynamic"

import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getSurveyBySlug } from "@/lib/pei-survey/service"
import SurveyView, { surveyMetadata } from "../s/[token]/SurveyView"

// 한글 주소 설문 — thinklabinsight.com/하얀드림치과설문. 다른 최상위 경로가 우선하고, 설문이 없는 주소는 404.
const decode = (v: string) => {
  try {
    return decodeURIComponent(v)
  } catch {
    return v
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  return surveyMetadata(await getSurveyBySlug(decode(slug).normalize("NFC")))
}

export default async function SlugSurveyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const survey = await getSurveyBySlug(decode(slug).normalize("NFC"))
  if (!survey) notFound()
  return <SurveyView survey={survey} />
}

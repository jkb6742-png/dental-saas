import SurveyForm from "./SurveyForm"
import type { getSurveyByToken } from "@/lib/pei-survey/service"

type Survey = NonNullable<Awaited<ReturnType<typeof getSurveyByToken>>>

/** 환자용 설문 본문 — /s/<token> 과 /<한글주소> 가 같이 쓴다 */
export default function SurveyView({ survey }: { survey: Survey | null }) {
  if (!survey || !survey.isActive) {
    return (
      <main className="min-h-full bg-[#f2f4f6] flex items-center justify-center px-5">
        <div className="bg-white rounded-2xl p-8 text-center max-w-sm w-full">
          <p className="text-[17px] font-bold text-[#191f28]">진행 중인 설문이 아닙니다</p>
          <p className="mt-2 text-[14px] text-[#6b7684]">링크를 다시 확인해 주세요.</p>
        </div>
      </main>
    )
  }
  return (
    <SurveyForm
      token={survey.token}
      title={survey.title}
      slogan={survey.slogan}
      logo={survey.logo}
      clinicName={survey.clinicName}
      intro={survey.intro}
      doctors={survey.doctors}
      questions={survey.questions}
    />
  )
}

export function surveyMetadata(survey: Survey | null) {
  return {
    title: survey ? survey.title : "설문",
    description: survey ? `${survey.clinicName} 진료 만족도 조사` : undefined,
    robots: { index: false, follow: false },
  }
}

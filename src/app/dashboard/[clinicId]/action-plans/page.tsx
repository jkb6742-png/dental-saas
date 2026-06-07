export const dynamic = "force-dynamic"

import { auth } from "@/auth"
import { redirect } from "next/navigation"
import ActionPlansClient from "./ActionPlansClient"

// Mock data - 실제로는 데이터베이스에서 가져와야 합니다
const mockActionPlans = [
  {
    id: "1",
    goal: "환자 만족도 개선",
    targetDate: new Date("2026-08-31"),
    description: "대기시간 단축 및 서비스 품질 향상을 통한 환자 만족도 95% 달성",
    status: "진행중" as const,
    createdAt: new Date("2026-06-01"),
    progress: 60,
    priority: "상",
    attachments: [
      {
        id: "1",
        name: "만족도_개선_계획서.pdf",
        size: 2048576,
        type: "application/pdf",
        uploadedAt: new Date("2026-06-01"),
        url: "/files/satisfaction-plan.pdf"
      }
    ],
    comments: [
      {
        id: "1",
        content: "대기시간 단축을 위한 예약 시스템 개선이 필요해 보입니다.",
        author: "마스터 관리자",
        authorRole: "MASTER" as const,
        createdAt: new Date("2026-06-02")
      },
      {
        id: "2",
        content: "네, 새로운 예약 시스템 도입을 검토해보겠습니다.",
        author: "김원장",
        authorRole: "CLINIC" as const,
        createdAt: new Date("2026-06-03")
      }
    ]
  },
  {
    id: "2",
    goal: "월 매출 목표 달성",
    targetDate: new Date("2026-07-31"),
    description: "새로운 진료 항목 도입 및 마케팅 강화를 통한 월 매출 20% 증가",
    status: "시작전" as const,
    createdAt: new Date("2026-06-08"),
    progress: 0,
    priority: "중",
    attachments: [],
    comments: [
      {
        id: "3",
        content: "어떤 진료 항목을 추가로 도입할 계획인지 구체적인 계획을 공유해주세요.",
        author: "마스터 관리자",
        authorRole: "MASTER" as const,
        createdAt: new Date("2026-06-08")
      }
    ]
  },
  {
    id: "3",
    goal: "직원 교육 프로그램 완료",
    targetDate: new Date("2026-06-30"),
    description: "전 직원 대상 고객 서비스 향상 교육 및 신규 시스템 사용법 교육",
    status: "완료" as const,
    createdAt: new Date("2026-05-15"),
    progress: 100,
    priority: "하",
    attachments: [
      {
        id: "2",
        name: "교육_수료증.jpg",
        size: 512000,
        type: "image/jpeg",
        uploadedAt: new Date("2026-06-30"),
        url: "/files/certificate.jpg"
      }
    ],
    comments: [
      {
        id: "4",
        content: "모든 직원이 교육을 성공적으로 완료했습니다!",
        author: "김원장",
        authorRole: "CLINIC" as const,
        createdAt: new Date("2026-06-30")
      }
    ]
  }
]

export default async function ActionPlansPage({
  params,
}: {
  params: Promise<{ clinicId: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")

  const { clinicId } = await params

  // 사용자 역할 가져오기
  const userRole = (session.user as any).role

  return (
    <ActionPlansClient
      clinicId={clinicId}
      actionPlans={mockActionPlans}
      userRole={userRole}
    />
  )
}
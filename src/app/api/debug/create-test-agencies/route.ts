import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function POST() {
  try {
    const testAgencies = [
      { name: "서울 치과 대행사", slug: "seoul-dental-agency" },
      { name: "강남 의료 그룹", slug: "gangnam-medical-group" },
      { name: "부산 덴탈 파트너", slug: "busan-dental-partner" },
      { name: "대구 의료 협회", slug: "daegu-medical-association" },
    ]

    const createdAgencies = []

    for (const agencyData of testAgencies) {
      try {
        const agency = await prisma.agency.create({
          data: {
            name: agencyData.name,
            slug: agencyData.slug,
            plan: "FREE"
          }
        })
        createdAgencies.push(agency)
      } catch (error) {
        // 이미 존재하는 경우 스킵
        if (error.code === 'P2002') {
          console.log(`Agency ${agencyData.name} already exists, skipping...`)
        } else {
          throw error
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `${createdAgencies.length}개의 테스트 에이전시가 생성되었습니다`,
      agencies: createdAgencies
    })
  } catch (error) {
    console.error("Error creating test agencies:", error)
    return NextResponse.json({
      success: false,
      error: "테스트 에이전시 생성 중 오류가 발생했습니다.",
      detail: error.message
    }, { status: 500 })
  }
}
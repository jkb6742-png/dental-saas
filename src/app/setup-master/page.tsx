import { NextRequest } from "next/server"
import { prisma } from "@/lib/db"
import { UserRole, UserStatus } from "@prisma/client"
import bcrypt from "bcryptjs"

export default async function SetupMasterPage() {
  let message = ""
  let isSuccess = false

  try {
    // 기존 마스터 계정 확인 (이메일 또는 역할로)
    const existingMaster = await prisma.user.findFirst({
      where: {
        OR: [
          { role: UserRole.MASTER },
          { email: 'thinklabmedi@gmail.com' }
        ]
      }
    })

    if (existingMaster) {
      message = `이미 마스터 계정이 존재합니다: ${existingMaster.email}`
      isSuccess = false
    } else {
      // 마스터용 에이전시 생성
      const masterAgency = await prisma.agency.create({
        data: {
          name: 'Master Agency',
          slug: 'master-agency-' + Date.now(),
          plan: 'ENTERPRISE'
        }
      })

      // 비밀번호 해시
      const password = 'dltodrkr13!'  // 사용자 지정 비밀번호
      const hashedPassword = await bcrypt.hash(password, 12)

      // 마스터 계정 생성
      const masterUser = await prisma.user.create({
        data: {
          email: 'thinklabmedi@gmail.com',
          password: hashedPassword,
          name: 'Master Admin',
          role: UserRole.MASTER,
          status: UserStatus.APPROVED,
          agencyId: masterAgency.id,
          approvedAt: new Date(),
        }
      })

      // 보안 로그 기록
      await prisma.securityLog.create({
        data: {
          userId: masterUser.id,
          event: 'MASTER_ACCOUNT_CREATED',
          agencyId: masterAgency.id,
          details: {
            email: masterUser.email,
            name: masterUser.name,
            role: UserRole.MASTER,
            createdAt: new Date().toISOString(),
            note: 'Initial master account created via web interface'
          },
          severity: 'HIGH',
        }
      })

      message = `마스터 계정이 생성되었습니다!

이메일: ${masterUser.email}
비밀번호: ${password}

✅ 계정이 즉시 활성화되었습니다!`
      isSuccess = true
    }
  } catch (error) {
    message = `마스터 계정 생성 실패: ${error}`
    isSuccess = false
  }

  return (
    <div className="min-h-screen bg-[#f9fafb] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-black rounded-2xl mb-4">
            <span className="text-[24px] font-bold text-white">T</span>
          </div>
          <h1 className="text-[20px] font-bold text-[#191f28] mb-1">THINKLAB dental insight</h1>
          <h2 className="text-[18px] font-medium text-[#4e5968] mb-2">마스터 계정 설정</h2>
          <p className="text-[14px] text-[#8b95a1]">시스템 초기 설정</p>
        </div>

        <div className="bg-white rounded-2xl p-7 shadow-[0_1px_3px_0_rgb(0_0_0/0.06)]">
          <div className={`p-4 rounded-xl ${
            isSuccess
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}>
            <div className={`text-[14px] font-medium mb-2 ${
              isSuccess ? 'text-green-800' : 'text-red-800'
            }`}>
              {isSuccess ? '✅ 성공' : '❌ 오류'}
            </div>
            <div className={`text-[13px] whitespace-pre-line ${
              isSuccess ? 'text-green-700' : 'text-red-700'
            }`}>
              {message}
            </div>
          </div>

          {isSuccess && (
            <div className="mt-6 text-center">
              <a
                href="/login"
                className="inline-block bg-[#3182f6] text-white px-6 py-3 rounded-xl text-[14px] font-medium hover:bg-[#2563eb] transition-colors"
              >
                로그인 페이지로 이동
              </a>
            </div>
          )}

          <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-200">
            <div className="text-[12px] text-amber-800">
              <strong>⚠️ 보안 주의사항</strong><br/>
              • 마스터 계정 생성 후 이 페이지는 삭제하세요<br/>
              • 임시 비밀번호를 즉시 변경하세요<br/>
              • 마스터 계정은 시스템 관리용으로만 사용하세요
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
import { PrismaClient } from "@prisma/client"
import { auth } from "@/auth"

/**
 * RLS(Row Level Security)가 적용된 보안 Prisma 클라이언트
 * 현재 사용자 정보를 PostgreSQL 세션에 설정하여 데이터 접근 제한
 */
export class SecurePrismaClient {
  private prisma: PrismaClient

  constructor() {
    this.prisma = new PrismaClient()
  }

  /**
   * 현재 인증된 사용자로 보안 세션 생성
   */
  async getSecureClient(userEmail?: string): Promise<PrismaClient> {
    try {
      let email = userEmail

      // 사용자 이메일이 제공되지 않은 경우 세션에서 가져오기
      if (!email) {
        const session = await auth()
        if (!session?.user?.email) {
          throw new Error("인증되지 않은 사용자입니다.")
        }
        email = session.user.email
      }

      // PostgreSQL 세션에 현재 사용자 이메일 설정
      await this.prisma.$executeRaw`SELECT set_current_user_email(${email})`

      return this.prisma
    } catch (error) {
      console.error("보안 클라이언트 생성 오류:", error)
      throw new Error("데이터베이스 보안 세션 생성에 실패했습니다.")
    }
  }

  /**
   * 특정 사용자로 보안 세션 생성 (관리자 전용)
   */
  async getSecureClientAs(userEmail: string): Promise<PrismaClient> {
    const session = await auth()

    // 관리자만 다른 사용자로 접근 가능
    if ((session?.user as any)?.role !== "ADMIN") {
      throw new Error("관리자만 다른 사용자로 접근할 수 있습니다.")
    }

    return this.getSecureClient(userEmail)
  }

  /**
   * 연결 종료
   */
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect()
  }
}

// 전역 인스턴스
const securePrisma = new SecurePrismaClient()

/**
 * 현재 사용자에 대한 보안 Prisma 클라이언트 반환
 * RLS 정책이 자동으로 적용되어 사용자는 자신의 데이터만 접근 가능
 */
export async function getSecurePrisma(userEmail?: string): Promise<PrismaClient> {
  return securePrisma.getSecureClient(userEmail)
}

/**
 * 관리자 전용: 특정 사용자로 보안 Prisma 클라이언트 반환
 */
export async function getSecurePrismaAs(userEmail: string): Promise<PrismaClient> {
  return securePrisma.getSecureClientAs(userEmail)
}

/**
 * 보안 쿼리 실행기
 * 모든 쿼리가 RLS 정책을 통과해야 실행됨
 */
export class SecureQueryExecutor {
  private prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /**
   * 안전한 클리닉 데이터 조회
   * 사용자가 접근 권한이 있는 클리닉만 반환
   */
  async findClinicsByUser() {
    return this.prisma.clinic.findMany({
      include: {
        agency: true,
      },
    })
  }

  /**
   * 안전한 리포트 데이터 조회
   */
  async findReportsByClinic(clinicId: string) {
    return this.prisma.report.findMany({
      where: { clinicId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    })
  }

  /**
   * 안전한 월간 요약 데이터 조회
   */
  async findMonthlySummary(clinicId: string, year: number, month: number) {
    return this.prisma.monthlySummary.findFirst({
      where: {
        clinicId,
        year,
        month,
      },
    })
  }
}

/**
 * 현재 사용자에 대한 보안 쿼리 실행기 생성
 */
export async function createSecureQueryExecutor(userEmail?: string): Promise<SecureQueryExecutor> {
  const prisma = await getSecurePrisma(userEmail)
  return new SecureQueryExecutor(prisma)
}

export default securePrisma
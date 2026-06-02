import { prisma } from "@/lib/db"
import { auth } from "@/auth"
import { NextRequest } from "next/server"

/**
 * 사용자가 특정 클리닉에 접근 권한이 있는지 확인
 */
export async function validateClinicAccess(clinicId: string, userId?: string): Promise<boolean> {
  if (!userId) return false

  try {
    // 사용자가 속한 에이전시를 통해 접근 가능한 클리닉인지 확인
    const userWithClinic = await prisma.user.findFirst({
      where: {
        id: userId,
        agency: {
          clinics: {
            some: {
              id: clinicId
            }
          }
        }
      },
      include: {
        agency: {
          include: {
            clinics: {
              where: { id: clinicId }
            }
          }
        }
      }
    })

    return !!userWithClinic && userWithClinic.agency.clinics.length > 0
  } catch (error) {
    console.error("권한 검증 오류:", error)
    return false
  }
}

/**
 * API 요청에서 클리닉 접근 권한을 검증하는 미들웨어
 */
export async function requireClinicAccess(clinicId: string) {
  const session = await auth()

  if (!session?.user?.id) {
    throw new Error("인증되지 않은 사용자입니다.")
  }

  const hasAccess = await validateClinicAccess(clinicId, session.user.id)

  if (!hasAccess) {
    // 보안 이벤트 로깅
    await logSecurityEvent({
      userId: session.user.id,
      event: "UNAUTHORIZED_CLINIC_ACCESS",
      clinicId,
      timestamp: new Date(),
      ip: "unknown" // Request에서 가져올 수 있음
    })

    throw new Error("해당 클리닉에 접근 권한이 없습니다.")
  }

  return session.user
}

/**
 * 에이전시 접근 권한 검증
 */
export async function validateAgencyAccess(agencyId: string, userId?: string): Promise<boolean> {
  if (!userId) return false

  try {
    const userWithAgency = await prisma.user.findFirst({
      where: {
        id: userId,
        agencyId: agencyId
      }
    })

    return !!userWithAgency
  } catch (error) {
    console.error("에이전시 권한 검증 오류:", error)
    return false
  }
}

/**
 * 보안 이벤트 로깅
 */
export async function logSecurityEvent(event: {
  userId: string
  event: string
  clinicId?: string
  agencyId?: string
  timestamp: Date
  ip?: string
  details?: any
}) {
  try {
    // 보안 로그를 별도 테이블에 저장 (추후 SecurityLog 모델 필요)
    console.warn("🚨 보안 이벤트:", {
      ...event,
      severity: "HIGH"
    })

    // TODO: 실제 운영에서는 별도 보안 로그 시스템에 저장
    // await prisma.securityLog.create({ data: event })
  } catch (error) {
    console.error("보안 로그 저장 실패:", error)
  }
}

/**
 * 로그인 실패 횟수 추적 및 계정 잠금
 */
export async function trackLoginFailure(email: string, ip?: string): Promise<{ shouldLock: boolean; remainingAttempts: number }> {
  try {
    // 현재는 메모리에 저장하지만, 실제로는 Redis나 DB에 저장 필요
    const key = `login_attempts_${email}`
    const attempts = await getLoginAttempts(key)
    const newAttempts = attempts + 1

    await setLoginAttempts(key, newAttempts)

    if (newAttempts >= 5) {
      await lockAccount(email)
      await logSecurityEvent({
        userId: email,
        event: "ACCOUNT_LOCKED_MULTIPLE_FAILED_LOGINS",
        timestamp: new Date(),
        ip,
        details: { attempts: newAttempts }
      })

      return { shouldLock: true, remainingAttempts: 0 }
    }

    return { shouldLock: false, remainingAttempts: 5 - newAttempts }
  } catch (error) {
    console.error("로그인 실패 추적 오류:", error)
    return { shouldLock: false, remainingAttempts: 5 }
  }
}

/**
 * 로그인 성공 시 실패 횟수 초기화
 */
export async function resetLoginAttempts(email: string): Promise<void> {
  try {
    const key = `login_attempts_${email}`
    await clearLoginAttempts(key)
  } catch (error) {
    console.error("로그인 실패 횟수 초기화 오류:", error)
  }
}

/**
 * 계정 잠금
 */
export async function lockAccount(email: string): Promise<void> {
  try {
    await prisma.user.update({
      where: { email },
      data: {
        lockedAt: new Date(),
        // 24시간 후 자동 해제
        lockUntil: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }
    })
  } catch (error) {
    console.error("계정 잠금 오류:", error)
  }
}

/**
 * 계정 잠금 상태 확인
 */
export async function isAccountLocked(email: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { lockUntil: true }
    })

    if (!user?.lockUntil) return false

    // 잠금 시간이 지났으면 자동 해제
    if (new Date() > user.lockUntil) {
      await prisma.user.update({
        where: { email },
        data: { lockedAt: null, lockUntil: null }
      })
      return false
    }

    return true
  } catch (error) {
    console.error("계정 잠금 상태 확인 오류:", error)
    return false
  }
}

// 임시 메모리 저장소 (실제로는 Redis 사용 필요)
const memoryStore = new Map<string, number>()

async function getLoginAttempts(key: string): Promise<number> {
  return memoryStore.get(key) || 0
}

async function setLoginAttempts(key: string, attempts: number): Promise<void> {
  memoryStore.set(key, attempts)

  // 1시간 후 자동 삭제
  setTimeout(() => {
    memoryStore.delete(key)
  }, 60 * 60 * 1000)
}

async function clearLoginAttempts(key: string): Promise<void> {
  memoryStore.delete(key)
}
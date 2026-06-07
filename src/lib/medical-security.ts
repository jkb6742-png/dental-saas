import crypto from 'crypto'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * 의료 데이터 암호화 클래스
 * 개인정보보호법 및 의료법 준수를 위한 환자 정보 암호화
 */
export class MedicalDataSecurity {
  private static readonly ALGORITHM = 'aes-256-gcm'
  private static readonly KEY_LENGTH = 32
  private static readonly IV_LENGTH = 16
  private static readonly TAG_LENGTH = 16

  /**
   * 암호화 키 생성 (환경변수에서 로드)
   */
  private static getEncryptionKey(): Buffer {
    const key = process.env.MEDICAL_DATA_KEY
    if (!key) {
      throw new Error('MEDICAL_DATA_KEY 환경변수가 설정되지 않았습니다.')
    }
    return crypto.scryptSync(key, 'salt', this.KEY_LENGTH)
  }

  /**
   * 환자 개인정보 암호화
   */
  static encryptPatientData(data: string): string {
    try {
      const key = this.getEncryptionKey()
      const iv = crypto.randomBytes(this.IV_LENGTH)
      const cipher = crypto.createCipher(this.ALGORITHM, key, { iv })

      let encrypted = cipher.update(data, 'utf8', 'hex')
      encrypted += cipher.final('hex')

      const tag = cipher.getAuthTag()

      // IV + TAG + 암호화된 데이터를 결합
      return iv.toString('hex') + tag.toString('hex') + encrypted
    } catch (error) {
      console.error('환자 데이터 암호화 실패:', error)
      throw new Error('환자 정보 암호화에 실패했습니다.')
    }
  }

  /**
   * 환자 개인정보 복호화
   */
  static decryptPatientData(encryptedData: string): string {
    try {
      const key = this.getEncryptionKey()

      // IV, TAG, 암호화된 데이터 분리
      const iv = Buffer.from(encryptedData.slice(0, this.IV_LENGTH * 2), 'hex')
      const tag = Buffer.from(encryptedData.slice(this.IV_LENGTH * 2, (this.IV_LENGTH + this.TAG_LENGTH) * 2), 'hex')
      const encrypted = encryptedData.slice((this.IV_LENGTH + this.TAG_LENGTH) * 2)

      const decipher = crypto.createDecipher(this.ALGORITHM, key, { iv })
      decipher.setAuthTag(tag)

      let decrypted = decipher.update(encrypted, 'hex', 'utf8')
      decrypted += decipher.final('utf8')

      return decrypted
    } catch (error) {
      console.error('환자 데이터 복호화 실패:', error)
      throw new Error('환자 정보 복호화에 실패했습니다.')
    }
  }

  /**
   * 의료정보 접근 로그 기록 (의무사항)
   */
  static async logMedicalAccess(req: NextRequest, params: {
    userId: string
    action: 'VIEW' | 'CREATE' | 'UPDATE' | 'DELETE' | 'EXPORT'
    resourceType: 'PATIENT_DATA' | 'TREATMENT_RECORD' | 'PEI_REPORT' | 'REVIEW_DATA'
    resourceId?: string
    additionalData?: any
  }) {
    try {
      const ip = req.headers.get('x-forwarded-for') ||
                req.headers.get('x-real-ip') ||
                'unknown'

      const userAgent = req.headers.get('user-agent') || 'unknown'

      await prisma.medicalAccessLog.create({
        data: {
          userId: params.userId,
          action: params.action,
          resourceType: params.resourceType,
          resourceId: params.resourceId,
          ipAddress: ip,
          userAgent: userAgent,
          timestamp: new Date(),
          additionalData: params.additionalData || {},
          severity: this.getLogSeverity(params.action)
        }
      })
    } catch (error) {
      // 로깅 실패해도 메인 로직은 계속 진행
      console.error('의료정보 접근 로그 기록 실패:', error)
    }
  }

  /**
   * 로그 심각도 판정
   */
  private static getLogSeverity(action: string): string {
    switch (action) {
      case 'DELETE':
      case 'EXPORT':
        return 'HIGH'
      case 'UPDATE':
      case 'CREATE':
        return 'MEDIUM'
      case 'VIEW':
        return 'LOW'
      default:
        return 'MEDIUM'
    }
  }

  /**
   * 환자 동의 확인
   */
  static async checkPatientConsent(
    patientId: string,
    clinicId: string,
    consentType: 'DATA_PROCESSING' | 'DATA_STORAGE' | 'DATA_ANALYSIS'
  ): Promise<boolean> {
    try {
      const consent = await prisma.patientConsent.findFirst({
        where: {
          patientId,
          clinicId,
          consentType,
          consented: true,
          revokedDate: null,
          OR: [
            { expiryDate: null },
            { expiryDate: { gt: new Date() } }
          ]
        }
      })

      return !!consent
    } catch (error) {
      console.error('환자 동의 확인 실패:', error)
      return false
    }
  }

  /**
   * 개인정보 익명화 (통계 분석용)
   */
  static anonymizePatientData(data: any): any {
    const anonymized = { ...data }

    // 개인 식별 정보 제거
    delete anonymized.patientName
    delete anonymized.chartNumber
    delete anonymized.phoneNumber
    delete anonymized.email
    delete anonymized.address
    delete anonymized.ssn

    // 나이는 연령대로 변환
    if (anonymized.age) {
      anonymized.ageGroup = this.getAgeGroup(anonymized.age)
      delete anonymized.age
    }

    // 날짜는 월 단위로 변환
    if (anonymized.visitDate) {
      anonymized.visitMonth = new Date(anonymized.visitDate).toISOString().slice(0, 7)
      delete anonymized.visitDate
    }

    return anonymized
  }

  /**
   * 연령대 분류
   */
  private static getAgeGroup(age: number): string {
    if (age < 10) return '10세 미만'
    if (age < 20) return '10대'
    if (age < 30) return '20대'
    if (age < 40) return '30대'
    if (age < 50) return '40대'
    if (age < 60) return '50대'
    if (age < 70) return '60대'
    return '70세 이상'
  }

  /**
   * 보안 이벤트 알림 (관리자용)
   */
  static async sendSecurityAlert(event: {
    type: 'UNAUTHORIZED_ACCESS' | 'DATA_BREACH' | 'SUSPICIOUS_ACTIVITY' | 'SYSTEM_ERROR'
    description: string
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    details?: any
  }) {
    try {
      // 보안 로그에 기록
      await prisma.securityLog.create({
        data: {
          event: event.type,
          details: {
            description: event.description,
            ...event.details
          },
          severity: event.severity,
          timestamp: new Date()
        }
      })

      // CRITICAL 또는 HIGH 심각도면 즉시 알림
      if (event.severity === 'CRITICAL' || event.severity === 'HIGH') {
        console.error(`🚨 [보안 경고] ${event.type}: ${event.description}`)

        // TODO: 이메일/SMS 알림 연동
        // await sendEmailAlert(event)
        // await sendSlackAlert(event)
      }
    } catch (error) {
      console.error('보안 알림 발송 실패:', error)
    }
  }
}

/**
 * 의료정보 접근 미들웨어
 */
export function withMedicalSecurity(handler: Function) {
  return async (req: NextRequest, ...args: any[]) => {
    try {
      // 의료정보 접근 시도 기록
      const url = new URL(req.url)
      const isPatientDataAccess = url.pathname.includes('/patients') ||
                                 url.pathname.includes('/pei') ||
                                 url.pathname.includes('/treatment')

      if (isPatientDataAccess) {
        // 세션에서 사용자 정보 추출 (auth 미들웨어 이후 실행 가정)
        const userId = req.headers.get('x-user-id') // 실제 구현에서는 세션에서 추출

        if (userId) {
          await MedicalDataSecurity.logMedicalAccess(req, {
            userId,
            action: req.method === 'GET' ? 'VIEW' : 'UPDATE',
            resourceType: 'PATIENT_DATA',
            resourceId: url.pathname.split('/').pop()
          })
        }
      }

      return await handler(req, ...args)
    } catch (error) {
      await MedicalDataSecurity.sendSecurityAlert({
        type: 'SYSTEM_ERROR',
        description: `의료정보 보안 미들웨어 오류: ${error.message}`,
        severity: 'HIGH',
        details: { url: req.url, method: req.method }
      })

      throw error
    }
  }
}
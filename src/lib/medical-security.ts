import crypto from 'crypto'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'

/*
// 의료 데이터 암호화 클래스 - 현재 사용되지 않음으로 주석 처리

export class MedicalDataSecurity {
  private static readonly ALGORITHM = 'aes-256-gcm'
  private static readonly KEY_LENGTH = 32
  private static readonly IV_LENGTH = 16
  private static readonly TAG_LENGTH = 16

  // 전체 클래스 내용 주석 처리됨
  // 필요시 다시 활성화하여 사용 가능
}
*/

// 의료 데이터 보안 관련 유틸리티가 필요한 경우 여기에 구현
export const medicalSecurityUtils = {
  // 기본적인 데이터 마스킹
  maskPatientName: (name: string) => {
    if (!name || name.length < 2) return '***'
    return name[0] + '*'.repeat(name.length - 1)
  },

  // 전화번호 마스킹
  maskPhoneNumber: (phone: string) => {
    if (!phone) return '***-****-****'
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length === 11) {
      return `${cleaned.slice(0, 3)}-****-${cleaned.slice(-4)}`
    }
    return '***-****-****'
  }
}
// =============================================================================
// Encryption Utilities - API Key 암호화/복호화
// =============================================================================

const crypto = require('crypto')

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32 // 256 bits
const IV_LENGTH = 12 // 96 bits for GCM
const TAG_LENGTH = 16 // 128 bits for GCM

/**
 * 환경변수에서 암호화 키 가져오기
 */
function getEncryptionKey(): Buffer {
  const keyString = process.env.APP_ENCRYPTION_KEY

  if (!keyString) {
    throw new Error('APP_ENCRYPTION_KEY 환경변수가 설정되지 않았습니다.')
  }

  if (keyString.length !== 64) { // 32 bytes = 64 hex chars
    throw new Error('APP_ENCRYPTION_KEY는 64자리 hex 문자열이어야 합니다.')
  }

  return Buffer.from(keyString, 'hex')
}

/**
 * 텍스트 암호화
 */
export function encryptText(text: string): string {
  try {
    if (!text) {
      throw new Error('암호화할 텍스트가 없습니다.')
    }

    const key = getEncryptionKey()
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    const tag = cipher.getAuthTag()

    // IV + tag + encrypted 데이터를 결합
    const combined = iv.toString('hex') + tag.toString('hex') + encrypted

    return combined

  } catch (error) {
    throw new Error(`텍스트 암호화 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
  }
}

/**
 * 텍스트 복호화
 */
export function decryptText(encryptedText: string): string {
  try {
    if (!encryptedText) {
      throw new Error('복호화할 텍스트가 없습니다.')
    }

    if (encryptedText.length < (IV_LENGTH + TAG_LENGTH) * 2) {
      throw new Error('암호화된 텍스트가 너무 짧습니다.')
    }

    const key = getEncryptionKey()

    // IV, tag, encrypted 데이터 분리
    const ivHex = encryptedText.slice(0, IV_LENGTH * 2)
    const tagHex = encryptedText.slice(IV_LENGTH * 2, (IV_LENGTH + TAG_LENGTH) * 2)
    const encryptedHex = encryptedText.slice((IV_LENGTH + TAG_LENGTH) * 2)

    const iv = Buffer.from(ivHex, 'hex')
    const tag = Buffer.from(tagHex, 'hex')

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted

  } catch (error) {
    throw new Error(`텍스트 복호화 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
  }
}

/**
 * API Key 마스킹 (프론트엔드 표시용)
 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey) return ''

  if (apiKey.length <= 8) {
    return '*'.repeat(apiKey.length)
  }

  // OpenAI: sk-... 형태
  if (apiKey.startsWith('sk-')) {
    return `sk-${'*'.repeat(8)}...${apiKey.slice(-4)}`
  }

  // Anthropic: ant-... 형태
  if (apiKey.startsWith('ant-')) {
    return `ant-${'*'.repeat(8)}...${apiKey.slice(-4)}`
  }

  // 기본: 처음 4자리 + 마스킹 + 마지막 4자리
  return `${apiKey.slice(0, 4)}${'*'.repeat(Math.max(0, apiKey.length - 8))}${apiKey.slice(-4)}`
}

/**
 * 암호화 키 생성 (개발/배포 시 사용)
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('hex')
}

/**
 * 암호화 상태 확인
 */
export function checkEncryptionSetup(): {
  isConfigured: boolean
  error?: string
} {
  try {
    getEncryptionKey()

    // 간단한 암호화/복호화 테스트
    const testText = 'test-encryption-' + Date.now()
    const encrypted = encryptText(testText)
    const decrypted = decryptText(encrypted)

    if (decrypted !== testText) {
      return {
        isConfigured: false,
        error: '암호화/복호화 테스트 실패'
      }
    }

    return { isConfigured: true }

  } catch (error) {
    return {
      isConfigured: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    }
  }
}
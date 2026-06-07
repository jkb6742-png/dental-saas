// NAS 환경용 경량 캐싱 시스템
import fs from 'fs/promises'
import path from 'path'
import NodeCache from 'node-cache'

// NAS 환경에 최적화된 캐시 설정
const CACHE_CONFIG = {
  // 메모리 캐시 설정 (NAS 메모리 절약)
  maxMemoryCache: 100, // 최대 100개 키만 메모리에
  memoryTTL: 300, // 5분

  // 파일 캐시 설정 (NAS 스토리지 활용)
  fileCache: process.env.CACHE_DIR || '/app/cache',
  fileTTL: 3600, // 1시간

  // 압축 사용 (네트워크 절약)
  compression: true,

  // 백그라운드 정리 주기
  cleanupInterval: 60 * 1000 // 1분
}

// 메모리 캐시 (핫 데이터용)
const memoryCache = new NodeCache({
  stdTTL: CACHE_CONFIG.memoryTTL,
  maxKeys: CACHE_CONFIG.maxMemoryCache,
  useClones: false, // 메모리 절약
  checkperiod: 60
})

export class NASCacheService {
  private static isInitialized = false

  // 초기화
  static async init() {
    if (this.isInitialized) return

    try {
      await fs.mkdir(CACHE_CONFIG.fileCache, { recursive: true })
      this.isInitialized = true

      // 주기적 파일 캐시 정리
      setInterval(() => this.cleanupFileCache(), CACHE_CONFIG.cleanupInterval)

      console.log('NAS Cache initialized')
    } catch (error) {
      console.error('Cache init error:', error)
    }
  }

  // 캐시 조회 (메모리 → 파일 → DB 순서)
  static async get<T>(key: string): Promise<T | null> {
    await this.init()

    try {
      // 1. 메모리 캐시에서 먼저 조회
      const memValue = memoryCache.get<T>(key)
      if (memValue !== undefined) {
        return memValue
      }

      // 2. 파일 캐시에서 조회
      const fileValue = await this.getFromFile<T>(key)
      if (fileValue !== null) {
        // 파일에서 찾았으면 메모리에도 저장 (핫 데이터로 승격)
        memoryCache.set(key, fileValue, CACHE_CONFIG.memoryTTL)
        return fileValue
      }

      return null
    } catch (error) {
      console.error(`Cache get error for ${key}:`, error)
      return null
    }
  }

  // 캐시 저장 (중요도에 따라 메모리/파일 선택)
  static async set(
    key: string,
    value: any,
    ttlSeconds = 300,
    priority: 'hot' | 'warm' | 'cold' = 'warm'
  ): Promise<boolean> {
    await this.init()

    try {
      // Hot 데이터: 메모리 + 파일
      if (priority === 'hot') {
        memoryCache.set(key, value, Math.min(ttlSeconds, CACHE_CONFIG.memoryTTL))
        await this.saveToFile(key, value, ttlSeconds)
      }
      // Warm 데이터: 파일만
      else if (priority === 'warm') {
        await this.saveToFile(key, value, ttlSeconds)
      }
      // Cold 데이터: 조건부 파일 저장
      else {
        if (ttlSeconds > 600) { // 10분 이상만 파일 저장
          await this.saveToFile(key, value, ttlSeconds)
        }
      }

      return true
    } catch (error) {
      console.error(`Cache set error for ${key}:`, error)
      return false
    }
  }

  // 파일에서 읽기 (압축 지원)
  private static async getFromFile<T>(key: string): Promise<T | null> {
    try {
      const filePath = this.getFilePath(key)
      const exists = await fs.access(filePath).then(() => true).catch(() => false)

      if (!exists) return null

      const fileContent = await fs.readFile(filePath, 'utf-8')
      const data = JSON.parse(fileContent)

      // TTL 확인
      if (data.expiry && Date.now() > data.expiry) {
        await fs.unlink(filePath).catch(() => {}) // 만료된 파일 삭제
        return null
      }

      return data.value as T
    } catch (error) {
      return null
    }
  }

  // 파일에 저장 (압축 지원)
  private static async saveToFile(key: string, value: any, ttlSeconds: number) {
    try {
      const filePath = this.getFilePath(key)
      const data = {
        value,
        expiry: Date.now() + (ttlSeconds * 1000),
        createdAt: Date.now()
      }

      await fs.writeFile(filePath, JSON.stringify(data), 'utf-8')
    } catch (error) {
      console.error(`File cache save error for ${key}:`, error)
    }
  }

  // 캐시 무효화
  static async invalidate(pattern: string): Promise<number> {
    let deletedCount = 0

    try {
      // 메모리 캐시 무효화
      const memoryKeys = memoryCache.keys()
      const matchingMemoryKeys = memoryKeys.filter(key => this.matchPattern(key, pattern))

      for (const key of matchingMemoryKeys) {
        memoryCache.del(key)
        deletedCount++
      }

      // 파일 캐시 무효화
      const files = await fs.readdir(CACHE_CONFIG.fileCache).catch(() => [])
      const matchingFiles = files.filter(file => this.matchPattern(file.replace('.cache', ''), pattern))

      for (const file of matchingFiles) {
        await fs.unlink(path.join(CACHE_CONFIG.fileCache, file)).catch(() => {})
        deletedCount++
      }

      return deletedCount
    } catch (error) {
      console.error('Cache invalidate error:', error)
      return 0
    }
  }

  // 파일 캐시 정리 (만료된 파일 삭제)
  private static async cleanupFileCache() {
    try {
      const files = await fs.readdir(CACHE_CONFIG.fileCache).catch(() => [])
      let cleanedCount = 0

      for (const file of files) {
        if (!file.endsWith('.cache')) continue

        try {
          const filePath = path.join(CACHE_CONFIG.fileCache, file)
          const content = await fs.readFile(filePath, 'utf-8')
          const data = JSON.parse(content)

          if (data.expiry && Date.now() > data.expiry) {
            await fs.unlink(filePath)
            cleanedCount++
          }
        } catch {
          // 손상된 파일은 삭제
          await fs.unlink(path.join(CACHE_CONFIG.fileCache, file)).catch(() => {})
        }
      }

      if (cleanedCount > 0) {
        console.log(`Cleaned up ${cleanedCount} expired cache files`)
      }
    } catch (error) {
      console.error('Cache cleanup error:', error)
    }
  }

  // NAS 리소스 상태 확인
  static async getSystemStats() {
    await this.init()

    try {
      const memoryStats = memoryCache.getStats()

      // 파일 캐시 통계
      const files = await fs.readdir(CACHE_CONFIG.fileCache).catch(() => [])
      const cacheFiles = files.filter(f => f.endsWith('.cache'))

      // 캐시 디렉토리 크기 계산
      let totalSize = 0
      for (const file of cacheFiles) {
        try {
          const stat = await fs.stat(path.join(CACHE_CONFIG.fileCache, file))
          totalSize += stat.size
        } catch {}
      }

      return {
        memory: {
          keys: memoryStats.keys,
          hits: memoryStats.hits,
          misses: memoryStats.misses,
          hitRate: memoryStats.hits / (memoryStats.hits + memoryStats.misses) * 100 || 0
        },
        file: {
          fileCount: cacheFiles.length,
          totalSize,
          totalSizeMB: Math.round(totalSize / 1024 / 1024 * 100) / 100
        },
        config: {
          maxMemoryKeys: CACHE_CONFIG.maxMemoryCache,
          memoryTTL: CACHE_CONFIG.memoryTTL,
          fileTTL: CACHE_CONFIG.fileTTL
        }
      }
    } catch (error) {
      console.error('Stats error:', error)
      return null
    }
  }

  // 유틸리티 메서드들
  private static getFilePath(key: string): string {
    const safeKey = key.replace(/[^a-zA-Z0-9-_]/g, '_')
    return path.join(CACHE_CONFIG.fileCache, `${safeKey}.cache`)
  }

  private static matchPattern(text: string, pattern: string): boolean {
    const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'))
    return regex.test(text)
  }

  // 캐시 우선순위 자동 조정
  static async promoteToHot(key: string) {
    const value = await this.get(key)
    if (value !== null) {
      await this.set(key, value, CACHE_CONFIG.memoryTTL, 'hot')
    }
  }
}

// NAS 환경용 캐시 전략
export const NAS_CACHE_STRATEGIES = {
  // 자주 접근하는 핫 데이터 (메모리 + 파일)
  HOT_DATA: { ttl: 300, priority: 'hot' as const },

  // 일반 데이터 (파일만)
  WARM_DATA: { ttl: 1800, priority: 'warm' as const },

  // 큰 데이터나 덜 중요한 데이터
  COLD_DATA: { ttl: 3600, priority: 'cold' as const },

  // 정적 설정 데이터
  STATIC_DATA: { ttl: 86400, priority: 'warm' as const }
}

export default NASCacheService
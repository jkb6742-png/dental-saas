const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function checkUploadStatus() {
  try {
    console.log('🔍 업로드 상태 진단 시작...\n')

    // 1. 클리닉 목록 확인
    console.log('=== 클리닉 목록 ===')
    const clinics = await prisma.clinic.findMany()
    clinics.forEach(c => console.log(`📍 ${c.id}: ${c.name}`))
    console.log('')

    // 2. 업로드된 파일 확인
    console.log('=== 최근 업로드된 파일들 ===')
    const files = await prisma.fileUpload.findMany({
      orderBy: { uploadedAt: 'desc' },
      take: 10
    })

    if (files.length === 0) {
      console.log('❌ 업로드된 파일이 없습니다!')
    } else {
      files.forEach((f, i) => {
        const time = f.uploadedAt.toLocaleString('ko-KR')
        console.log(`${i+1}. ${f.fileName} | ${f.category} | ${f.status} | ${time}`)
      })
    }
    console.log('')

    // 3. 연령별분포 데이터 확인
    console.log('=== 연령별분포 데이터 ===')
    const ageDistCount = await prisma.ageDist.count()
    console.log(`전체 연령별분포 레코드: ${ageDistCount}개`)

    if (ageDistCount > 0) {
      const recentAgeDist = await prisma.ageDist.findMany({
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        take: 5
      })

      console.log('최근 연령별분포 데이터:')
      recentAgeDist.forEach((a, i) => {
        console.log(`  ${i+1}. ${a.year}년 ${a.month}월 | ${a.ageGroup} | 총환자: ${a.totalPatients}명`)
      })
    }
    console.log('')

    // 4. 지역별분포 데이터 확인
    console.log('=== 지역별분포 데이터 ===')
    const regionDistCount = await prisma.regionDist.count()
    console.log(`전체 지역별분포 레코드: ${regionDistCount}개`)

    if (regionDistCount > 0) {
      const recentRegionDist = await prisma.regionDist.findMany({
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        take: 5
      })

      console.log('최근 지역별분포 데이터:')
      recentRegionDist.forEach((r, i) => {
        console.log(`  ${i+1}. ${r.year}년 ${r.month}월 | ${r.region} | 총환자: ${r.totalPatients}명`)
      })
    }
    console.log('')

    // 5. 업로드 로그 확인
    console.log('=== 최근 업로드 로그 ===')
    const logs = await prisma.uploadLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10
    })

    if (logs.length === 0) {
      console.log('업로드 로그가 없습니다.')
    } else {
      logs.forEach((l, i) => {
        const time = l.createdAt.toLocaleString('ko-KR')
        console.log(`${i+1}. ${l.action} | ${l.fileName} | ${l.status} | ${time}`)
        if (l.message) {
          console.log(`   메시지: ${l.message}`)
        }
      })
    }

  } catch (error) {
    console.error('❌ 진단 실패:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

checkUploadStatus()
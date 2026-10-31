import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 [DEBUG] 디버깅 API 호출')

    // 인증 확인
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    console.log('🔍 [DEBUG] 수신 데이터:', {
      keys: Object.keys(data),
      clinicId: data.clinicId,
      fileName: data.fileName,
      structuredDataExists: !!data.structuredData,
      structuredDataKeys: data.structuredData ? Object.keys(data.structuredData) : [],
      patientsCount: data.structuredData?.patients?.length || 0,
      revenueCount: data.structuredData?.revenue?.length || 0
    })

    if (data.structuredData?.patients) {
      console.log('👥 [DEBUG] 환자 데이터 샘플 (첫 2명):')
      data.structuredData.patients.slice(0, 2).forEach((patient, index) => {
        console.log(`${index + 1}:`, patient)
      })
    }

    if (data.structuredData?.summary) {
      console.log('📊 [DEBUG] 요약 데이터:', data.structuredData.summary)
    }

    return NextResponse.json({
      success: true,
      debug: {
        clinicId: data.clinicId,
        fileName: data.fileName,
        dataReceived: !!data.structuredData,
        patientsCount: data.structuredData?.patients?.length || 0,
        revenueCount: data.structuredData?.revenue?.length || 0,
        summaryExists: !!data.structuredData?.summary
      }
    })

  } catch (error) {
    console.error('🔍 [DEBUG] 오류:', error)
    return NextResponse.json({
      error: 'Debug failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
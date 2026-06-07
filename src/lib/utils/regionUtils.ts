import { RegionData } from "@/types/regionTypes"

/**
 * 평균 항목을 제외하는 필터 함수
 */
export function filterOutAverages<T extends { region: string }>(data: T[]): T[] {
  return data.filter(item => {
    const region = item.region.toLowerCase()
    return !(
      region === "평균" ||
      region === "average" ||
      region.includes("평균") ||
      region.includes("average")
    )
  })
}

/**
 * 지역별 데이터에서 실제 데이터가 있는 지역만 필터링
 */
export function filterRegionsWithData(yearlyData: RegionData[]): string[] {
  const regions = [...new Set(yearlyData.map(d => d.region))]

  return filterOutAverages(regions.map(region => ({ region })))
    .map(item => item.region)
    .filter(region => {
      return yearlyData.some(d =>
        d.region === region &&
        ((d.newPatients || 0) > 0 || (d.returningPatients || 0) > 0 || (d.avgRevenue || 0) > 0)
      )
    })
    .sort((a, b) => {
      const totalA = yearlyData
        .filter(d => d.region === a)
        .reduce((sum, d) => sum + (d.totalPatients || 0), 0)
      const totalB = yearlyData
        .filter(d => d.region === b)
        .reduce((sum, d) => sum + (d.totalPatients || 0), 0)
      return totalB - totalA
    })
}

/**
 * 차트용 데이터 변환
 */
export function transformDataForChart(data: RegionData[], limit = 10) {
  return filterOutAverages(data)
    .sort((a, b) => (b.totalPatients || 0) - (a.totalPatients || 0))
    .slice(0, limit)
    .map(item => ({
      name: item.region,
      newPatients: item.newPatients || 0,
      returningPatients: item.returningPatients || 0,
      totalPatients: item.totalPatients || 0,
      avgRevenue: item.avgRevenue || 0
    }))
}

/**
 * 지역별 연간 통계 계산
 */
export function calculateRegionStats(region: string, yearlyData: RegionData[]) {
  const regionData = yearlyData.filter(d => d.region === region)
  const totalPatients = regionData.reduce((sum, d) => sum + (d.totalPatients || 0), 0)
  const totalNewPatients = regionData.reduce((sum, d) => sum + (d.newPatients || 0), 0)
  const totalReturningPatients = regionData.reduce((sum, d) => sum + (d.returningPatients || 0), 0)
  const avgRevenue = regionData.length > 0
    ? regionData.reduce((sum, d) => sum + (d.avgRevenue || 0), 0) / regionData.length
    : 0
  const newPatientRate = totalPatients > 0 ? (totalNewPatients / totalPatients * 100) : 0

  return {
    totalPatients,
    totalNewPatients,
    totalReturningPatients,
    avgRevenue,
    newPatientRate
  }
}

/**
 * 월대월 변화율 계산
 */
export function calculateMoMChange(
  current: RegionData | undefined,
  previous: RegionData | undefined
) {
  if (!current || !previous) {
    return { patientsChange: 0, revenueChange: 0 }
  }

  const patientsChange = previous.totalPatients
    ? ((current.totalPatients || 0) - (previous.totalPatients || 0)) / (previous.totalPatients || 1) * 100
    : 0

  const revenueChange = previous.avgRevenue
    ? ((current.avgRevenue || 0) - (previous.avgRevenue || 0)) / (previous.avgRevenue || 1) * 100
    : 0

  return { patientsChange, revenueChange }
}

/**
 * CSV 데이터 내보내기용 변환
 */
export function transformForCSVExport(data: RegionData[], year: number, month: number) {
  return filterOutAverages(data)
    .sort((a, b) => (b.totalPatients || 0) - (a.totalPatients || 0))
    .map((item, index) => ({
      순위: index + 1,
      지역: item.region,
      년도: year,
      월: month,
      총환자: item.totalPatients || 0,
      신환: item.newPatients || 0,
      구환: item.returningPatients || 0,
      총방문: item.totalVisits || 0,
      평균진료비: item.avgRevenue || 0,
      신환비율: item.totalPatients ? ((item.newPatients || 0) / item.totalPatients * 100).toFixed(1) + '%' : '0%'
    }))
}
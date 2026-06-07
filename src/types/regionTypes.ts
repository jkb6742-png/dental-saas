export interface RegionData {
  id: string
  region: string
  year: number
  month: number
  totalPatients?: number | null
  newPatients?: number | null
  returningPatients?: number | null
  totalVisits?: number | null
  avgRevenue?: number | null
}

export interface RegionsPageClientProps {
  clinicId: string
  initialYear: number
  initialMonth: number
  yearlyData: RegionData[]
  monthlyData: RegionData[]
  availableData: Array<{ year: number; month: number }>
}

export interface ChartDataPoint {
  name: string
  newPatients: number
  returningPatients: number
  totalPatients: number
  avgRevenue: number
}

export interface RegionStats {
  totalPatients: number
  totalNewPatients: number
  totalReturningPatients: number
  avgRevenue: number
  newPatientRate: number
}

export type ViewMode = 'combined' | 'individual'
export type ChartType = 'total' | 'new' | 'returning'
"use client"

import SimplePatientStats from "./SimplePatientStats"

interface PatientsPageClientProps {
  clinicId: string
  initialYear?: number
  initialMonth?: number
  yearlyData?: any[]
  monthlyData?: any[]
  availableData?: any[]
  fallbackData?: any[] | null
  receptionRecords?: any[]
  currentMonthReceptionRecords?: any[]
  treatmentPlans?: any[]
  historicalReceptionData?: any[]
}

export default function PatientsPageClient({
  clinicId,
  initialYear = 2026,
  initialMonth = 5
}: PatientsPageClientProps) {
  return (
    <SimplePatientStats
      clinicId={clinicId}
      initialYear={initialYear}
      initialMonth={initialMonth}
    />
  )
}
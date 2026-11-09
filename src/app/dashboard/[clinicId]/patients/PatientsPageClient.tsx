"use client"

import SimplePatientStats from "./SimplePatientStats"
import type { CompareRow } from "@/components/charts/MonthlyCompare"

interface PatientsPageClientProps {
  clinicId: string
  initialYear?: number
  initialMonth?: number
  compareRows?: CompareRow[]
}

export default function PatientsPageClient({
  clinicId,
  initialYear = 2026,
  initialMonth = 5,
  compareRows = []
}: PatientsPageClientProps) {
  return (
    <SimplePatientStats
      clinicId={clinicId}
      initialYear={initialYear}
      initialMonth={initialMonth}
      compareRows={compareRows}
    />
  )
}
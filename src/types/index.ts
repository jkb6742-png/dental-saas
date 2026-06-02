import type {
  Agency,
  Clinic,
  User,
  UserRole,
  MonthlySummary,
  DailyLedger,
  PatientStat,
  TreatmentStat,
  VisitRoute,
  TreatmentPlan,
  Report,
} from "@prisma/client"

export type {
  Agency,
  Clinic,
  User,
  UserRole,
  MonthlySummary,
  DailyLedger,
  PatientStat,
  TreatmentStat,
  VisitRoute,
  TreatmentPlan,
  Report,
}

export type SessionUser = {
  id: string
  email: string
  name: string
  role: UserRole
  agencyId: string
  agencySlug: string
  agencyName: string
}

export type KpiCard = {
  label: string
  value: string | number
  unit?: string
  change?: number
  changeLabel?: string
  trend?: "up" | "down" | "neutral"
}

export type ChartDataPoint = {
  label: string
  value: number
  value2?: number
}

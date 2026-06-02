import { prisma } from "@/lib/db"

export async function resolveMonth(
  clinicId: string,
  sp: { year?: string; month?: string },
  table: "monthlySummary" | "treatmentStat" | "visitRoute" | "implantStat" | "consultationStat" | "ageDist" | "regionDist" | "patientStat"
) {
  const now = new Date()

  type MonthRow = { year: number; month: number }
  let rows: MonthRow[] = []

  if (table === "monthlySummary") {
    // 실제 데이터가 있는 달만 (totalRevenue > 0 or workingDays > 0)
    rows = await prisma.monthlySummary.findMany({
      where: { clinicId, OR: [{ totalRevenue: { gt: 0 } }, { workingDays: { gt: 0 } }] },
      select: { year: true, month: true },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    })
  } else if (table === "treatmentStat") {
    rows = await prisma.treatmentStat.findMany({ where: { clinicId }, distinct: ["year", "month"], select: { year: true, month: true }, orderBy: [{ year: "desc" }, { month: "desc" }] })
  } else if (table === "visitRoute") {
    rows = await prisma.visitRoute.findMany({ where: { clinicId }, distinct: ["year", "month"], select: { year: true, month: true }, orderBy: [{ year: "desc" }, { month: "desc" }] })
  } else if (table === "implantStat") {
    rows = await prisma.implantStat.findMany({ where: { clinicId }, distinct: ["year", "month"], select: { year: true, month: true }, orderBy: [{ year: "desc" }, { month: "desc" }] })
  } else if (table === "consultationStat") {
    rows = await prisma.consultationStat.findMany({ where: { clinicId }, distinct: ["year", "month"], select: { year: true, month: true }, orderBy: [{ year: "desc" }, { month: "desc" }] })
  } else if (table === "ageDist") {
    rows = await prisma.ageDist.findMany({ where: { clinicId }, distinct: ["year", "month"], select: { year: true, month: true }, orderBy: [{ year: "desc" }, { month: "desc" }] })
  } else if (table === "regionDist") {
    rows = await prisma.regionDist.findMany({ where: { clinicId }, distinct: ["year", "month"], select: { year: true, month: true }, orderBy: [{ year: "desc" }, { month: "desc" }] })
  } else if (table === "patientStat") {
    rows = await prisma.patientStat.findMany({ where: { clinicId }, distinct: ["year", "month"], select: { year: true, month: true }, orderBy: [{ year: "desc" }, { month: "desc" }] })
  }

  const latest = rows[0]
  const year = sp.year ? parseInt(sp.year) : (latest?.year ?? now.getFullYear())
  const month = sp.month ? parseInt(sp.month) : (latest?.month ?? now.getMonth() + 1)

  return { year, month, availableMonths: rows }
}

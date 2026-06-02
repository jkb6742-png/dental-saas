const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const pg = require('pg')
require('dotenv/config')

async function checkSheetName() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes("supabase") ? { rejectUnauthorized: false } : undefined,
  })
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

  const config = await prisma.peiSheetConfig.findFirst()
  console.log('데이터베이스 시트명:', `"${config?.sheetName}"`)
  console.log('예상 범위:', config?.sheetName ? `${config.sheetName}!A1:Z1000` : 'A1:Z1000')

  await prisma.$disconnect()
  await pool.end()
}

checkSheetName()
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function checkFilePath() {
  try {
    const file = await prisma.fileUpload.findFirst({
      where: {
        id: 'cmq0awo7m0jn9evwetfh6x4a7'
      }
    })

    if (file) {
      console.log('File Info:')
      console.log('  ID:', file.id)
      console.log('  File Name:', file.fileName)
      console.log('  File Path:', file.filePath)
      console.log('  Status:', file.status)
      console.log('  Record Count:', file.recordCount)
      console.log('  Error Message:', file.errorMessage)

      // 파일이 실제로 존재하는지 확인
      const fs = require('fs')
      const exists = fs.existsSync(file.filePath)
      console.log('  File Exists:', exists)

      if (exists) {
        const stats = fs.statSync(file.filePath)
        console.log('  File Size:', stats.size, 'bytes')
      }
    } else {
      console.log('File not found')
    }
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkFilePath()
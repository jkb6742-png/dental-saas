const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function getLatestFileId() {
  try {
    const latestFile = await prisma.fileUpload.findFirst({
      where: {
        category: 'COMPREHENSIVE_PATIENTS'
      },
      orderBy: {
        uploadedAt: 'desc'
      },
      select: {
        id: true,
        fileName: true,
        status: true
      }
    })

    if (latestFile) {
      console.log(`File ID: ${latestFile.id}`)
      console.log(`File Name: ${latestFile.fileName}`)
      console.log(`Status: ${latestFile.status}`)
    } else {
      console.log('No files found')
    }
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

getLatestFileId()
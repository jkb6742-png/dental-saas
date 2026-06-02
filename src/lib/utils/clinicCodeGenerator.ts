import { prisma } from "@/lib/db"

/**
 * Generate a clinic code from the clinic name
 * @param name - The clinic name
 * @returns A sanitized code string
 */
export function generateCodeFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z가-힣0-9]/g, '') // Keep only Korean, English letters and numbers first
    .replace(/\s+/g, '') // Remove spaces
    .replace(/치과$/, '') // Remove '치과' suffix if present (after cleaning)
    .substring(0, 20) // Limit length
}

/**
 * Generate a unique clinic code for an agency
 * @param agencyId - The agency ID
 * @param name - The clinic name
 * @returns A unique clinic code
 */
export async function generateUniqueClinicCode(agencyId: string, name: string): Promise<string> {
  let baseCode = generateCodeFromName(name)

  // If baseCode is empty or too short, use a fallback
  if (baseCode.length < 2) {
    baseCode = 'clinic'
  }

  let code = baseCode
  let counter = 1

  // Check if code already exists in the agency
  while (await codeExistsInAgency(agencyId, code)) {
    code = `${baseCode}${counter}`
    counter++

    // Prevent infinite loop by limiting attempts
    if (counter > 999) {
      // Use timestamp as fallback
      code = `${baseCode}${Date.now().toString().slice(-6)}`
      break
    }
  }

  return code
}

/**
 * Check if a clinic code already exists within an agency
 * @param agencyId - The agency ID
 * @param code - The clinic code to check
 * @returns True if code exists, false otherwise
 */
async function codeExistsInAgency(agencyId: string, code: string): Promise<boolean> {
  const existing = await prisma.clinic.findFirst({
    where: {
      agencyId,
      code,
    },
  })

  return !!existing
}

/**
 * Validate clinic code format
 * @param code - The code to validate
 * @returns True if valid, false otherwise
 */
export function isValidClinicCode(code: string): boolean {
  // Allow Korean characters, English letters, numbers, and hyphens
  const validPattern = /^[a-z가-힣0-9-]+$/
  return validPattern.test(code) && code.length >= 2 && code.length <= 50
}
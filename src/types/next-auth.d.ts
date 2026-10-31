import "next-auth"
import { JWT } from "next-auth/jwt"

declare module "next-auth" {
  interface User {
    role: string
    status: string
    agencyId: string
    agencySlug: string
    agencyName: string
    clinicId: string | null
  }

  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      role: string
      status: string
      agencyId: string
      agencySlug: string
      agencyName: string
      clinicId: string | null
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: string
    status: string
    agencyId: string
    agencySlug: string
    agencyName: string
    clinicId: string | null
  }
}
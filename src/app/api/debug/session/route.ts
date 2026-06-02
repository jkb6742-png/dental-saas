import { NextResponse } from "next/server"
import { auth } from "@/auth"

export async function GET() {
  const session = await auth()

  if (!session) {
    return NextResponse.json({
      error: "No session found",
      session: null
    }, { status: 401 })
  }

  return NextResponse.json({
    session: {
      user: session.user,
      expires: session.expires
    },
    userInfo: {
      id: (session.user as any)?.id,
      email: session.user?.email,
      name: session.user?.name,
      agencyId: (session.user as any)?.agencyId,
      role: (session.user as any)?.role,
      status: (session.user as any)?.status
    }
  })
}
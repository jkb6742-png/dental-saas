import { auth } from "@/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const { nextUrl, auth: session } = req
  const isLoggedIn = !!session

  const isAuthPage = nextUrl.pathname.startsWith("/login") || nextUrl.pathname.startsWith("/signup")
  const isApiAuth = nextUrl.pathname.startsWith("/api/auth")
  const isPublic = nextUrl.pathname === "/"

  if (isApiAuth) return NextResponse.next()

  if (isPublic) {
    if (isLoggedIn) return NextResponse.redirect(new URL("/dashboard", nextUrl))
    return NextResponse.redirect(new URL("/login", nextUrl))
  }

  if (isAuthPage) {
    if (isLoggedIn) return NextResponse.redirect(new URL("/dashboard", nextUrl))
    return NextResponse.next()
  }

  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", nextUrl))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}

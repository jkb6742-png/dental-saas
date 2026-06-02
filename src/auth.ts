import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { prisma } from "@/lib/db"
import bcrypt from "bcryptjs"

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "이메일", type: "email" },
        password: { label: "비밀번호", type: "password" },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          include: { agency: true },
        })

        if (!user) return null

        // 비밀번호 확인
        const valid = await bcrypt.compare(
          credentials.password as string,
          user.password
        )
        if (!valid) return null

        // 계정 상태 확인
        if (user.status === "PENDING") {
          throw new Error("ACCOUNT_PENDING")
        }
        if (user.status === "REJECTED") {
          throw new Error("ACCOUNT_REJECTED")
        }
        if (user.status !== "APPROVED") {
          throw new Error("ACCOUNT_NOT_APPROVED")
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          status: user.status,
          agencyId: user.agencyId,
          agencySlug: user.agency.slug,
          agencyName: user.agency.name,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
        token.status = (user as any).status
        token.agencyId = (user as any).agencyId
        token.agencySlug = (user as any).agencySlug
        token.agencyName = (user as any).agencyName
      } else if (token.id) {
        // 기존 토큰이 있으면 최신 사용자 정보를 데이터베이스에서 가져오기
        try {
          const latestUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            include: { agency: true },
          })

          if (latestUser) {
            token.role = latestUser.role
            token.status = latestUser.status
            token.agencyId = latestUser.agencyId
            token.agencySlug = latestUser.agency.slug
            token.agencyName = latestUser.agency.name
          }
        } catch (error) {
          console.error("JWT 토큰 업데이트 오류:", error)
        }
      }
      return token
    },
    session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        ;(session.user as any).role = token.role
        ;(session.user as any).status = token.status
        ;(session.user as any).agencyId = token.agencyId
        ;(session.user as any).agencySlug = token.agencySlug
        ;(session.user as any).agencyName = token.agencyName
      }
      return session
    },
  },
})

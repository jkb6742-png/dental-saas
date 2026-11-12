import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { prisma } from "@/lib/db"
import bcrypt from "bcryptjs"
import { cache } from "react"

// auth() 는 레이아웃과 페이지에서 각각 불린다. 한 요청 안에서는 사용자 조회를 한 번만 한다.
const loadSessionUser = cache((id: string) =>
  prisma.user.findUnique({
    where: { id },
    include: {
      agency: true,
      inviteCode: { select: { clinicId: true } },
      employee: { select: { leftOn: true, clinicAccess: { select: { clinicId: true } } } },
    },
  })
)

type AccessUser = {
  role: string
  clinicId: string | null
  inviteCode?: { clinicId: string } | null
  employee?: { leftOn: Date | null; clinicAccess: { clinicId: string }[] } | null
}

/**
 * 접근 가능한 치과 목록. MASTER 는 null(전체).
 * STAFF 는 배정된 치과(퇴사일이 지났으면 없음), 원장은 소속 치과 1곳.
 */
export function accessibleClinicIds(user: AccessUser): string[] | null {
  if (user.role === "MASTER") return null
  if (user.role === "STAFF") {
    const emp = user.employee
    if (!emp || (emp.leftOn && emp.leftOn.getTime() <= Date.now())) return []
    return emp.clinicAccess.map((a) => a.clinicId)
  }
  const own = user.clinicId ?? user.inviteCode?.clinicId ?? null
  return own ? [own] : []
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  // 운영은 NAS 리버스 프록시 뒤에서 돌아 요청 호스트가 내부 주소와 다르다
  trustHost: true,
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
          include: {
            agency: true,
            inviteCode: { select: { clinicId: true } },
            employee: { select: { leftOn: true, clinicAccess: { select: { clinicId: true } } } },
          },
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

        // 로그인 성공 이력 기록 (SecurityLog). 실패해도 로그인은 진행.
        try {
          await prisma.securityLog.create({
            data: {
              userId: user.id,
              event: "LOGIN_SUCCESS",
              clinicId: user.clinicId ?? user.inviteCode?.clinicId ?? null,
              agencyId: user.agencyId,
              severity: "LOW",
            },
          })
        } catch (e) {
          console.error("로그인 로그 기록 실패:", e)
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
          // 비마스터(로그인 계정)는 소속 치과에만 접근. MASTER는 null(전체).
          clinicId: user.clinicId ?? user.inviteCode?.clinicId ?? null,
          clinicIds: accessibleClinicIds(user),
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
        token.clinicId = (user as any).clinicId ?? null
        token.clinicIds = (user as any).clinicIds ?? null
      } else if (token.id) {
        // 기존 토큰이 있으면 최신 사용자 정보를 데이터베이스에서 가져오기
        try {
          const latestUser = await loadSessionUser(token.id as string)

          if (latestUser) {
            token.role = latestUser.role
            token.status = latestUser.status
            token.agencyId = latestUser.agencyId
            token.agencySlug = latestUser.agency.slug
            token.agencyName = latestUser.agency.name
            token.clinicId = latestUser.clinicId ?? latestUser.inviteCode?.clinicId ?? null
            // 담당 치과 배정·회수가 다음 요청부터 바로 반영되도록 매번 다시 읽는다
            token.clinicIds = accessibleClinicIds(latestUser)
          } else {
            // 사용자가 삭제됐으면 기존 토큰을 믿지 않는다
            return null
          }
        } catch (error) {
          console.error("JWT 토큰 업데이트 오류:", error)
          // 담당 치과를 확인하지 못하면 직원은 치과 접근을 막는다
          if (token.role === "STAFF") token.clinicIds = []
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
        ;(session.user as any).clinicId = token.clinicId ?? null
        ;(session.user as any).clinicIds = token.clinicIds ?? null
      }
      return session
    },
  },
})

import type { Metadata } from "next"
import NextAuthSessionProvider from "@/components/providers/SessionProvider"
import "./globals.css"

export const metadata: Metadata = {
  title: "덴탈 인사이트 — 치과 경영지표 분석 플랫폼",
  description: "엑셀 업로드 하나로 완성되는 치과 경영 대시보드",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko" className="h-full">
      <body className="h-full antialiased">
        <NextAuthSessionProvider>
          {children}
        </NextAuthSessionProvider>
      </body>
    </html>
  )
}

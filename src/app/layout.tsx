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
      <head>
        {/* CSS @import 는 렌더링을 막으므로 link 로 불러온다 */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="h-full antialiased">
        <NextAuthSessionProvider>
          {children}
        </NextAuthSessionProvider>
      </body>
    </html>
  )
}

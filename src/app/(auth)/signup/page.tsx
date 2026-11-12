import Link from "next/link"
import AuthShell from "../AuthShell"

// 회원가입은 막아 둠(2026-11-12). 계정은 관리자가 직원 관리·치과 계정 화면에서 만든다.
// 가입 API(/api/signup)도 proxy 에서 막는다.
export default function SignupClosedPage() {
  return (
    <AuthShell eyebrow="02 / Account" title="회원가입 안내">
      <p className="text-[15px] leading-relaxed text-[#3d3d3a]">
        회원가입은 받지 않습니다.
        <br />
        계정이 필요하면 <b className="text-[#0a0a0a]">관리자에게 문의하세요.</b>
      </p>
      <Link href="/login" className="mt-8 flex items-center justify-center w-full h-[46px] rounded-[4px] bg-[#0062ff] text-white text-[14px] font-semibold hover:bg-[#0052d6] transition-colors">
        로그인으로 돌아가기
      </Link>
    </AuthShell>
  )
}

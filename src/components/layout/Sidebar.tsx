"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  TrendingUp,
  Users,
  Stethoscope,
  MapPin,
  FileText,
  Upload,
  Settings,
  ChevronDown,
  Building2,
  UserCheck,
  MessageSquare,
  BarChart2,
  Globe,
  Crown,
  Shield,
  Code,
} from "lucide-react"

type NavItem = {
  href: string
  label: string
  icon: React.ReactNode
  group?: string
}

// 기본 메뉴 구성
const baseNavItems: NavItem[] = [
  { href: "/dashboard", label: "홈", icon: <LayoutDashboard className="w-4 h-4" /> },

  { href: "/dashboard/revenue", label: "매출 분석", icon: <TrendingUp className="w-4 h-4" />, group: "매출" },

  { href: "/dashboard/patients", label: "환자 통계", icon: <Users className="w-4 h-4" />, group: "환자" },
  { href: "/dashboard/age", label: "연령별 분석", icon: <BarChart2 className="w-4 h-4" />, group: "환자" },
  { href: "/dashboard/regions", label: "지역별 분석", icon: <Globe className="w-4 h-4" />, group: "환자" },

  { href: "/dashboard/treatments", label: "진료항목", icon: <Stethoscope className="w-4 h-4" />, group: "진료" },
  { href: "/dashboard/implants", label: "임플란트 통계", icon: <Stethoscope className="w-4 h-4" />, group: "진료" },
  { href: "/dashboard/pei", label: "PEI 통계", icon: <UserCheck className="w-4 h-4" />, group: "진료" },

  { href: "/dashboard/routes", label: "내원경로 ROI", icon: <MapPin className="w-4 h-4" />, group: "마케팅" },
  { href: "/dashboard/consultations", label: "상담 성과", icon: <MessageSquare className="w-4 h-4" />, group: "마케팅" },

  { href: "/dashboard/reports", label: "월간 리포트", icon: <FileText className="w-4 h-4" /> },
]

type Props = {
  clinicName: string
  agencyName: string
  clinicId: string
  userRole?: string
}

export default function Sidebar({ clinicName, agencyName, clinicId, userRole }: Props) {
  const pathname = usePathname()

  // 마스터 계정 전용 메뉴 (컴포넌트 내부에서 정의)
  const adminNavItems: NavItem[] = userRole === 'MASTER' ? [
    { href: "/dashboard/upload", label: "엑셀 업로드", icon: <Upload className="w-4 h-4" />, group: "관리자" },
    { href: "/admin/users", label: "사용자 관리", icon: <Shield className="w-4 h-4" />, group: "관리자" },
    { href: "/admin/invite-codes", label: "초대 코드", icon: <Code className="w-4 h-4" />, group: "관리자" },
  ] : []

  const navItems = [...baseNavItems, ...adminNavItems]

  const resolvedNav = navItems.map((item) => ({
    ...item,
    href: item.href.replace("/dashboard", `/dashboard/${clinicId}`),
  }))

  // 그룹별로 구분선 삽입
  const rendered: React.ReactNode[] = []
  let lastGroup: string | undefined = undefined
  resolvedNav.forEach((item, i) => {
    if (i > 0 && item.group !== lastGroup && (item.group || lastGroup)) {
      rendered.push(<div key={`div-${i}`} className="my-1 border-t border-[#f2f4f6]" />)
    }
    lastGroup = item.group
    const isActive =
      item.href === `/dashboard/${clinicId}`
        ? pathname === item.href
        : pathname.startsWith(item.href)
    rendered.push(
      <Link
        key={item.href}
        href={item.href}
        className={`flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-150 ${
          isActive ? "bg-[#ebf3fe] text-[#3182f6]" : "text-[#4e5968] hover:bg-[#f9fafb] hover:text-[#191f28]"
        }`}
      >
        <span className={isActive ? "text-[#3182f6]" : "text-[#b0b8c1]"}>{item.icon}</span>
        {item.label}
      </Link>
    )
  })

  return (
    <aside className="w-[220px] min-h-screen bg-white border-r border-[#f2f4f6] flex flex-col">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-[#f2f4f6]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
            <span className="text-[16px] font-bold text-white">T</span>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[14px] font-bold text-[#191f28]">THINKLAB</span>
            <span className="text-[12px] text-[#6b7280]">dental insight</span>
          </div>
        </div>
      </div>

      {/* Clinic selector */}
      <div className="px-4 py-3 border-b border-[#f2f4f6]">
        {userRole === 'MASTER' ? (
          <Link
            href="/dashboard"
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-[#f9fafb] hover:bg-[#f2f4f6] transition-colors group"
          >
            <div className="text-left">
              <div className="text-[11px] text-[#8b95a1] flex items-center gap-1">
                <Crown className="w-3 h-3" />
                {agencyName}
              </div>
              <div className="text-[13px] font-semibold text-[#191f28] truncate max-w-[130px]">{clinicName}</div>
            </div>
            <ChevronDown className="w-4 h-4 text-[#b0b8c1] group-hover:text-[#6b7684] transition-colors" />
          </Link>
        ) : (
          <div className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-[#f9fafb]">
            <div className="text-left">
              <div className="text-[11px] text-[#8b95a1]">{agencyName}</div>
              <div className="text-[13px] font-semibold text-[#191f28] truncate max-w-[130px]">{clinicName}</div>
            </div>
          </div>
        )}

        {userRole === 'MASTER' && (
          <div className="mt-2">
            <div className="text-[10px] text-[#6b7684] px-3 py-1 bg-[#ebf3fe] rounded-md text-center">
              💡 클릭하여 다른 치과로 변경
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 overflow-y-auto space-y-0.5">
        {rendered}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-3 border-t border-[#f2f4f6]">
        <Link
          href="/admin/clinics"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium text-[#4e5968] hover:bg-[#f9fafb] hover:text-[#191f28] transition-all duration-150"
        >
          <Settings className="w-4 h-4 text-[#8b95a1]" />
          설정
        </Link>
      </div>
    </aside>
  )
}

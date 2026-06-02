"use client"

import { signOut } from "next-auth/react"
import { Bell, LogOut, User } from "lucide-react"

type Props = {
  userName: string
  pageTitle: string
}

export default function Header({ userName, pageTitle }: Props) {
  return (
    <header className="h-14 bg-white border-b border-[#f2f4f6] flex items-center justify-between px-6">
      <h1 className="text-[17px] font-bold text-[#191f28]">{pageTitle}</h1>

      <div className="flex items-center gap-2">
        <button className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-[#f9fafb] text-[#6b7684] transition-colors">
          <Bell className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-[#f9fafb] cursor-pointer transition-colors">
          <div className="w-7 h-7 bg-[#ebf3fe] rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-[#3182f6]" />
          </div>
          <span className="text-[14px] font-medium text-[#4e5968]">{userName}</span>
        </div>

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-[#fff0f1] text-[#8b95a1] hover:text-[#f04452] transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}

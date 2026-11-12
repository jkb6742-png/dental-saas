import { redirect } from "next/navigation"

// 직원 관리는 /work/staff 로 옮겼다
export default function StaffAdminPage() {
  redirect("/work/staff")
}

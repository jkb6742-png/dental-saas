export const dynamic = "force-dynamic"

import { requireWorkActor } from "@/lib/work/actor"
import NotificationsClient from "./NotificationsClient"

export default async function NotificationsPage() {
  await requireWorkActor()
  return <NotificationsClient />
}

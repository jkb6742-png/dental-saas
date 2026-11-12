export const dynamic = "force-dynamic"

import { requireWorkActor } from "@/lib/work/actor"
import FilesClient from "./FilesClient"

export default async function FilesPage() {
  const actor = await requireWorkActor()
  return <FilesClient clinics={actor.clinics} />
}

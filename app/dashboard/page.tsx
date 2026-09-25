"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useMarketplace } from "@/lib/store"

export default function DashboardIndexPage() {
  const { role } = useMarketplace()
  const router = useRouter()

  useEffect(() => {
    router.replace(role === "contractor" ? "/dashboard/contractor" : "/dashboard/client")
  }, [role, router])

  return (
    <div className="mx-auto flex min-h-[50vh] w-full max-w-7xl items-center justify-center px-4">
      <p className="text-sm text-muted-foreground">Loading your dashboard…</p>
    </div>
  )
}

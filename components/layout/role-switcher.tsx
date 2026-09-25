"use client"

import { useRouter } from "next/navigation"
import { Briefcase, HardHat } from "lucide-react"
import { cn } from "@/lib/utils"
import { useMarketplace } from "@/lib/store"
import type { UserType } from "@/lib/types"

const options: { value: UserType; label: string; icon: typeof Briefcase }[] = [
  { value: "client", label: "Client", icon: Briefcase },
  { value: "contractor", label: "Contractor", icon: HardHat },
]

export function RoleSwitcher() {
  const { role, setRole } = useMarketplace()
  const router = useRouter()

  function handleSwitch(next: UserType) {
    if (next === role) return
    setRole(next)
    router.push("/dashboard")
  }

  return (
    <div
      className="hidden items-center rounded-lg border border-border bg-muted/50 p-0.5 sm:flex"
      role="group"
      aria-label="Switch role"
    >
      {options.map((opt) => {
        const Icon = opt.icon
        const active = role === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => handleSwitch(opt.value)}
            aria-pressed={active}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon width={14} height={14} aria-hidden="true" />
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

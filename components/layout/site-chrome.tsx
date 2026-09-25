"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { HardHat } from "lucide-react"
import { cn } from "@/lib/utils"
import { useMarketplace } from "@/lib/store"
import { RoleSwitcher } from "./role-switcher"
import { NotificationsMenu } from "./notifications-menu"
import { UserMenu } from "./user-menu"

const clientNav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/projects", label: "Browse Projects" },
  { href: "/post-project", label: "Post a Project" },
  { href: "/messages", label: "Messages" },
]

const contractorNav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/projects", label: "Find Work" },
  { href: "/messages", label: "Messages" },
]

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const { role } = useMarketplace()
  const pathname = usePathname()
  const nav = role === "client" ? clientNav : contractorNav

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <HardHat width={20} height={20} aria-hidden="true" />
            </span>
            <span className="font-heading text-lg font-bold tracking-tight text-foreground">WorkBid</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            {nav.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <RoleSwitcher />
            <NotificationsMenu />
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border bg-muted/30">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <HardHat width={16} height={16} aria-hidden="true" />
            </span>
            <span className="font-heading font-bold text-foreground">WorkBid</span>
          </div>
          <p className="max-w-md text-sm text-muted-foreground text-pretty">
            A contractor marketplace prototype. Post projects, collect competitive bids, and hire trusted pros — all in
            one place.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">Demo prototype · Sample data only</p>
        </div>
      </footer>
    </div>
  )
}

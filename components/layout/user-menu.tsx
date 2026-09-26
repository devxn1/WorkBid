"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { LayoutDashboard, LogOut, MessageSquare, User as UserIcon } from "lucide-react"
import { signOut } from "aws-amplify/auth"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useMarketplace } from "@/lib/store"

export function UserMenu() {
  const { currentUser, role } = useMarketplace()
  const router = useRouter()
  const initials = `${currentUser.firstName[0] ?? ""}${currentUser.lastName[0] ?? ""}`.toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="rounded-full" aria-label="Account menu">
            <Avatar className="size-9">
              {currentUser.avatar ? <AvatarImage src={currentUser.avatar} alt="" /> : null}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        {/* Base UI requires a menu label to sit inside a group. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="font-medium">
                {currentUser.firstName} {currentUser.lastName}
              </span>
              <span className="text-xs font-normal text-muted-foreground capitalize">{role} account</span>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => router.push("/profile")}>
            <UserIcon width={16} height={16} data-icon="inline-start" />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/dashboard")}>
            <LayoutDashboard width={16} height={16} data-icon="inline-start" />
            Dashboard
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/messages")}>
            <MessageSquare width={16} height={16} data-icon="inline-start" />
            Messages
          </DropdownMenuItem>
          {role === "contractor" && (
            <DropdownMenuItem onClick={() => router.push("/bids")}>
              <UserIcon width={16} height={16} data-icon="inline-start" />
              My Bids
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            await signOut()
            router.push("/login")
          }}
        >
          <LogOut width={16} height={16} data-icon="inline-start" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

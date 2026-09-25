"use client"

import Link from "next/link"
import { useState } from "react"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { useMarketplace } from "@/lib/store"
import { relativeTime } from "@/lib/format"

export function NotificationsMenu() {
  const { notifications, unreadCount, markNotificationsRead } = useMarketplace()
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
            <Bell width={18} height={18} />
            {unreadCount > 0 && (
              <span className="absolute right-1.5 top-1.5 flex size-2 items-center justify-center rounded-full bg-destructive ring-2 ring-background" />
            )}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3">
          <p className="font-heading text-sm font-semibold">Notifications</p>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-auto px-2 py-1 text-xs" onClick={markNotificationsRead}>
              Mark all read
            </Button>
          )}
        </div>
        <Separator />
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
          ) : (
            <ul className="divide-y divide-border">
              {notifications.map((n) => {
                const content = (
                  <div className={cn("flex flex-col gap-1 px-4 py-3 transition-colors hover:bg-muted/50", !n.read && "bg-info/5")}>
                    <div className="flex items-center gap-2">
                      {!n.read && <span className="size-1.5 rounded-full bg-info" />}
                      <p className="text-sm font-medium text-foreground">{n.title}</p>
                      <span className="ml-auto text-xs text-muted-foreground">{relativeTime(n.createdAt)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground text-pretty">{n.body}</p>
                  </div>
                )
                return (
                  <li key={n.notificationId}>
                    {n.href ? (
                      <Link href={n.href} onClick={() => setOpen(false)}>
                        {content}
                      </Link>
                    ) : (
                      content
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}

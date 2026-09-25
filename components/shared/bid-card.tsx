import Link from "next/link"
import { BadgeCheck, CalendarClock, Check, X } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { StarRating } from "./star-rating"
import { formatCurrency, initials, relativeTime } from "@/lib/format"
import type { Bid, Contractor } from "@/lib/types"

interface BidCardProps {
  bid: Bid
  contractor?: Contractor
  showActions?: boolean
  onAccept?: () => void
  onReject?: () => void
  onMessage?: () => void
}

export function BidCard({ bid, contractor, showActions, onAccept, onReject, onMessage }: BidCardProps) {
  return (
    <Card
      className={
        bid.status === "accepted"
          ? "border-primary/40 bg-primary/5"
          : bid.status === "rejected"
            ? "opacity-70"
            : undefined
      }
    >
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Avatar className="size-11">
              <AvatarImage src={contractor?.avatar || "/placeholder.svg"} alt={contractor?.contractorName ?? "Contractor"} />
              <AvatarFallback>{initials(contractor?.contractorName ?? "NA")}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-1.5">
                <Link
                  href={`/contractors/${bid.contractorId}`}
                  className="font-heading text-sm font-semibold text-foreground hover:underline"
                >
                  {contractor?.businessName ?? "Contractor"}
                </Link>
                {contractor?.verified && <BadgeCheck width={15} height={15} className="text-primary" aria-label="Verified" />}
              </div>
              {contractor && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <StarRating rating={contractor.rating} size={12} />
                  <span>
                    {contractor.rating.toFixed(1)} ({contractor.reviewCount})
                  </span>
                </div>
              )}
            </div>
          </div>
          {bid.status !== "pending" && (
            <Badge variant={bid.status === "accepted" ? "default" : "secondary"} className="capitalize">
              {bid.status}
            </Badge>
          )}
        </div>

        <p className="text-sm text-muted-foreground text-pretty">{bid.proposalMessage}</p>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div>
            <p className="text-xs text-muted-foreground">Bid amount</p>
            <p className="font-heading text-lg font-bold text-foreground">{formatCurrency(bid.amount)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Timeline</p>
            <p className="flex items-center gap-1 text-sm font-medium text-foreground">
              <CalendarClock width={14} height={14} aria-hidden="true" />
              {bid.estimatedDays} days
            </p>
          </div>
          <span className="ml-auto text-xs text-muted-foreground">{relativeTime(bid.bidDate)}</span>
        </div>

        {showActions && bid.status === "pending" && (
          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <Button size="sm" onClick={onAccept}>
              <Check data-icon="inline-start" />
              Accept bid
            </Button>
            <Button size="sm" variant="outline" onClick={onReject}>
              <X data-icon="inline-start" />
              Decline
            </Button>
            {onMessage && (
              <Button size="sm" variant="ghost" onClick={onMessage} className="ml-auto">
                Message
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

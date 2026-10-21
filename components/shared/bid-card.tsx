"use client"

import Link from "next/link"
import { BadgeCheck, CalendarClock, FileText, MessageSquare, PencilLine, X } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { StarRating } from "./star-rating"
import { ConfirmActionDialog, RequestRevisionDialog } from "@/components/proposals/bid-dialogs"
import { useMarketplace } from "@/lib/store"
import { bidStatusLabels, formatCurrency, initials, isOpenBid, relativeTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Bid, Contractor } from "@/lib/types"

interface BidCardProps {
  bid: Bid
  contractor?: Contractor
  /** Show the client's actions (review, message, request revision, decline, accept). */
  showActions?: boolean
  onMessage?: () => void
  messageDisabled?: boolean
}

export function BidCard({ bid, contractor, showActions, onMessage, messageDisabled }: BidCardProps) {
  const { declineBid } = useMarketplace()
  const proposalHref = `/projects/${bid.projectId}/bids/${bid.bidId}`
  const revised = bid.currentVersion > 1
  const canAct = showActions && isOpenBid(bid.status)

  return (
    <Card
      className={cn(
        bid.status === "accepted" && "border-primary/40 bg-primary/5",
        (bid.status === "rejected" || bid.status === "withdrawn" || bid.status === "closed") && "opacity-70",
      )}
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
          <div className="flex flex-wrap justify-end gap-1.5">
            {revised && <Badge variant="outline">Revised · v{bid.currentVersion}</Badge>}
            <Badge
              variant={bid.status === "accepted" ? "default" : bid.status === "pending" ? "outline" : "secondary"}
              className={cn(bid.status === "revision_requested" && "border-warning/30 bg-warning/15 text-warning-foreground")}
            >
              {bidStatusLabels[bid.status]}
            </Badge>
          </div>
        </div>

        <p className="line-clamp-3 text-sm text-muted-foreground text-pretty">{bid.proposalMessage}</p>

        {bid.status === "revision_requested" && bid.revisionNote && (
          <p className="rounded-md bg-warning/10 px-3 py-2 text-xs text-foreground">
            <span className="font-medium">Revision requested:</span> {bid.revisionNote}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div>
            <p className="text-xs text-muted-foreground">{revised ? "Current offer" : "Bid amount"}</p>
            <p className="flex items-baseline gap-2 font-heading text-lg font-bold text-foreground">
              {formatCurrency(bid.amount)}
              {bid.previousAmount != null && bid.previousAmount !== bid.amount && (
                <span className="font-sans text-sm font-normal text-muted-foreground line-through">
                  {formatCurrency(bid.previousAmount)}
                </span>
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Timeline</p>
            <p className="flex items-center gap-1 text-sm font-medium text-foreground">
              <CalendarClock width={14} height={14} aria-hidden="true" />
              {bid.estimatedDays} days
            </p>
          </div>
          <span className="ml-auto text-xs text-muted-foreground">
            {bid.amountUpdatedAt ? `Revised ${relativeTime(bid.amountUpdatedAt)}` : relativeTime(bid.bidDate)}
          </span>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <Button size="sm" variant="outline" render={<Link href={proposalHref} />}>
            <FileText data-icon="inline-start" />
            Review proposal
          </Button>
          {onMessage && (
            <Button size="sm" variant="outline" onClick={onMessage} disabled={messageDisabled}>
              <MessageSquare data-icon="inline-start" />
              Message
            </Button>
          )}
          {canAct && (
            <>
              <RequestRevisionDialog
                bidId={bid.bidId}
                trigger={
                  <Button size="sm" variant="outline">
                    <PencilLine data-icon="inline-start" />
                    Request revision
                  </Button>
                }
              />
              <ConfirmActionDialog
                title="Decline this bid?"
                description="The contractor will be notified. This can't be undone, and other bids aren't affected."
                confirmLabel="Decline bid"
                workingLabel="Declining…"
                destructive
                onConfirm={() => declineBid(bid.bidId)}
                trigger={
                  <Button size="sm" variant="ghost">
                    <X data-icon="inline-start" />
                    Decline
                  </Button>
                }
              />
              <Button size="sm" className="ml-auto" render={<Link href={`${proposalHref}/agreement`} />}>
                Accept bid
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

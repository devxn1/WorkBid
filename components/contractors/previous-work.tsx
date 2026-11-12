"use client"

import { useState } from "react"
import Link from "next/link"
import { BadgeCheck, Images } from "lucide-react"
import { usePortfolio } from "@/lib/portfolio"
import { formatDate, formatDay } from "@/lib/format"
import type { PortfolioItem, Project, Review } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ProjectImage } from "@/components/shared/project-image"
import { StarRating } from "@/components/shared/star-rating"

interface PreviousWorkProps {
  contractorId: string
  signedIn: boolean
  /** Projects this contractor was hired for on WorkBid and finished. */
  completedProjects: Project[]
  reviews: Review[]
}

/** A contractor's past jobs: ones finished on WorkBid, then the portfolio they added themselves. */
export function PreviousWork({ contractorId, signedIn, completedProjects, reviews }: PreviousWorkProps) {
  const { items, loading } = usePortfolio(contractorId, signedIn)
  const [open, setOpen] = useState<PortfolioItem | null>(null)
  const count = completedProjects.length + items.length

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-heading text-lg font-semibold text-foreground">
        Previous work {!loading && <span className="text-muted-foreground">({count})</span>}
      </h2>

      {loading && completedProjects.length === 0 ? (
        <Skeleton className="h-40 w-full rounded-lg" />
      ) : count === 0 ? (
        <p className="text-sm text-muted-foreground">No previous work added yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {completedProjects.map((p) => {
            const review = reviews.find((r) => r.projectId === p.projectId)
            return (
              <Link
                key={p.projectId}
                href={`/projects/${p.projectId}`}
                className="group overflow-hidden rounded-lg border border-border transition-colors hover:border-primary"
              >
                <ProjectImage src={p.images[0]} alt="" className="aspect-video w-full bg-muted object-cover" />
                <div className="flex flex-col gap-1.5 p-4">
                  <Badge variant="secondary" className="w-fit gap-1">
                    <BadgeCheck width={14} height={14} aria-hidden="true" />
                    Done through WorkBid
                  </Badge>
                  <p className="font-medium text-foreground group-hover:text-primary">{p.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {[p.location, p.completionDate && `Finished ${formatDate(p.completionDate)}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {review && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <StarRating rating={review.rating} size={13} />
                      Client&apos;s rating
                    </span>
                  )}
                </div>
              </Link>
            )
          })}

          {items.map((item) => (
            <button
              key={item.itemId}
              type="button"
              onClick={() => setOpen(item)}
              className="group overflow-hidden rounded-lg border border-border text-left transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-ring"
            >
              <div className="relative">
                <ProjectImage src={item.images[0]} alt="" className="aspect-video w-full bg-muted object-cover" />
                {item.images.length > 1 && (
                  <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-background/90 px-1.5 py-0.5 text-xs text-foreground">
                    <Images width={13} height={13} aria-hidden="true" />
                    {item.images.length}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1.5 p-4">
                <p className="font-medium text-foreground group-hover:text-primary">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  {[item.location, item.completedOn && `Finished ${formatDay(item.completedOn)}`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {item.description && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle>{open.title}</DialogTitle>
                <DialogDescription>
                  {[open.location, open.completedOn && `Finished ${formatDay(open.completedOn)}`]
                    .filter(Boolean)
                    .join(" · ") || "From the contractor's portfolio"}
                </DialogDescription>
              </DialogHeader>
              {open.description && (
                <p className="whitespace-pre-line text-sm text-muted-foreground">{open.description}</p>
              )}
              <div className="flex flex-col gap-3">
                {open.images.map((src, i) => (
                  <ProjectImage
                    key={src}
                    src={src}
                    alt={`${open.title}, photo ${i + 1}`}
                    className="w-full rounded-lg bg-muted object-cover"
                  />
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}

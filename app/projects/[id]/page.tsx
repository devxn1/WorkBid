"use client"

import { use, useState } from "react"
import Link from "next/link"
import { notFound, useRouter } from "next/navigation"
import { ArrowLeft, CalendarClock, MapPin, MessageSquare, Pencil, Wallet } from "lucide-react"
import { useMarketplace } from "@/lib/store"
import { categories } from "@/lib/mock-data"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { StatusBadge } from "@/components/shared/status-badge"
import { CategoryIcon } from "@/components/shared/category-icon"
import { BidCard } from "@/components/shared/bid-card"
import { PlaceBidDialog } from "@/components/shared/place-bid-dialog"
import { ReviewDialog } from "@/components/shared/review-dialog"
import { ProjectImage } from "@/components/shared/project-image"
import { formatBudget, formatDate, relativeTime } from "@/lib/format"
import { cn } from "@/lib/utils"

export default function ProjectDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const {
    role,
    getProject,
    projectsLoading,
    currentClientId,
    getBidsForProject,
    getContractor,
    currentContractorId,
    acceptBid,
    rejectBid,
    startConversation,
    completeProject,
    reviews,
  } = useMarketplace()
  const [photoIndex, setPhotoIndex] = useState(0)

  const project = getProject(id)

  if (!project) {
    if (projectsLoading) {
      return (
        <div className="mx-auto flex min-h-[50vh] max-w-5xl items-center justify-center px-4">
          <p className="text-sm text-muted-foreground">Loading project…</p>
        </div>
      )
    }
    return notFound()
  }

  // Only the client who posted this project can accept bids, complete it, or review.
  const isOwner = role === "client" && project.clientId === currentClientId

  const category = categories.find((c) => c.categoryId === project.categoryId)
  const projectBids = getBidsForProject(project.projectId)
  const myBid = projectBids.find((b) => b.contractorId === currentContractorId)
  const isOpen = project.status === "open"
  const hasReview = reviews.some((r) => r.projectId === project.projectId)
  const awardedContractor = project.awardedContractorId ? getContractor(project.awardedContractorId) : undefined

  function handleMessage(contractorId: string) {
    const convId = startConversation(project!.projectId, contractorId)
    router.push(`/messages?c=${convId}`)
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Button variant="ghost" size="sm" render={<Link href="/projects" />} className="mb-4 -ml-2">
        <ArrowLeft data-icon="inline-start" />
        Back to projects
      </Button>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <div className="overflow-hidden rounded-xl border border-border bg-muted">
              <ProjectImage
                src={project.images[photoIndex] ?? project.images[0]}
                alt={project.title}
                className="aspect-[16/9] w-full object-cover"
              />
            </div>
            {project.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {project.images.map((src, i) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setPhotoIndex(i)}
                    aria-label={`Show photo ${i + 1}`}
                    aria-current={i === photoIndex}
                    className={cn(
                      "size-16 shrink-0 overflow-hidden rounded-md border-2 transition-colors",
                      i === photoIndex ? "border-primary" : "border-transparent opacity-70 hover:opacity-100",
                    )}
                  >
                    <ProjectImage src={src} alt="" className="size-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={project.status} />
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <CategoryIcon icon={category?.icon ?? "wrench"} size={15} className="text-primary" />
                {category?.name}
              </span>
              <span className="text-sm text-muted-foreground">· Posted {relativeTime(project.createdAt)}</span>
            </div>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground text-balance">
              {project.title}
            </h1>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <MapPin width={15} height={15} aria-hidden="true" />
                {project.location}
              </span>
              <span>Posted by {project.clientName}</span>
            </div>
          </div>

          <Separator />

          <div className="flex flex-col gap-3">
            <h2 className="font-heading text-lg font-semibold text-foreground">Project description</h2>
            <p className="whitespace-pre-line leading-relaxed text-muted-foreground text-pretty">
              {project.description}
            </p>
          </div>

          <Separator />

          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-semibold text-foreground">
                {isOwner ? "Bids" : "Your bid"}{" "}
                {isOwner && <span className="text-muted-foreground">({projectBids.length})</span>}
              </h2>
            </div>
            {projectBids.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                {isOwner
                  ? "No bids yet."
                  : role === "contractor" && isOpen
                    ? "You haven't bid on this project yet."
                    : "Bids are private between each contractor and the client."}
              </p>
            ) : isOwner ? (
              <div className="flex flex-col gap-4">
                {projectBids.map((bid) => (
                  <BidCard
                    key={bid.bidId}
                    bid={bid}
                    contractor={getContractor(bid.contractorId)}
                    showActions={isOpen}
                    onAccept={() => acceptBid(bid.bidId)}
                    onReject={() => rejectBid(bid.bidId)}
                    onMessage={() => handleMessage(bid.contractorId)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {myBid ? (
                  <BidCard bid={myBid} contractor={getContractor(myBid.contractorId)} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Bids are private between each contractor and the client.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Client budget</CardTitle>
              <p className="font-heading text-2xl font-bold text-foreground">
                {formatBudget(project.budgetMin, project.budgetMax)}
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 text-sm">
                {isOwner && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <MessageSquare width={15} height={15} aria-hidden="true" />
                      Bids received
                    </span>
                    <span className="font-medium text-foreground">{projectBids.length}</span>
                  </div>
                )}
                {project.startDate && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <CalendarClock width={15} height={15} aria-hidden="true" />
                      Start date
                    </span>
                    <span className="font-medium text-foreground">{formatDate(project.startDate)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Wallet width={15} height={15} aria-hidden="true" />
                    Status
                  </span>
                  <StatusBadge status={project.status} />
                </div>
              </div>

              <Separator />

              {role === "contractor" ? (
                myBid ? (
                  <div className="rounded-lg bg-primary/5 p-3 text-center text-sm">
                    <p className="font-medium text-foreground">You&apos;ve bid on this project</p>
                    <p className="text-muted-foreground">Bid status: {myBid.status}</p>
                  </div>
                ) : isOpen ? (
                  <PlaceBidDialog
                    project={project}
                    trigger={<Button className="w-full">Place a bid</Button>}
                  />
                ) : (
                  <Button className="w-full" disabled>
                    Bidding closed
                  </Button>
                )
              ) : isOwner ? (
                <div className="flex flex-col gap-2">
                  {isOpen && (
                    <Button
                      variant="outline"
                      className="w-full"
                      render={<Link href={`/projects/${project.projectId}/edit`} />}
                    >
                      <Pencil data-icon="inline-start" />
                      Edit project
                    </Button>
                  )}
                  {awardedContractor && (
                    <div className="rounded-lg bg-muted p-3 text-sm">
                      <p className="text-xs text-muted-foreground">Awarded to</p>
                      <Link
                        href={`/contractors/${awardedContractor.contractorId}`}
                        className="font-medium text-foreground hover:underline"
                      >
                        {awardedContractor.businessName}
                      </Link>
                    </div>
                  )}
                  {project.status === "in_progress" && (
                    <Button className="w-full" onClick={() => completeProject(project.projectId)}>
                      Mark as complete
                    </Button>
                  )}
                  {project.status === "completed" &&
                    (hasReview ? (
                      <div className="rounded-lg bg-success/10 p-3 text-center text-sm font-medium text-foreground">
                        Review submitted
                      </div>
                    ) : (
                      <ReviewDialog
                        project={project}
                        trigger={<Button className="w-full">Leave a review</Button>}
                      />
                    ))}
                  {awardedContractor && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => handleMessage(awardedContractor.contractorId)}
                    >
                      Message contractor
                    </Button>
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}

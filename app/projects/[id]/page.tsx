"use client"

import { use, useState } from "react"
import Link from "next/link"
import { notFound, useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, CalendarClock, Clock, FileText, MapPin, MessageSquare, Pencil, Wallet } from "lucide-react"
import { useMarketplace } from "@/lib/store"
import { categories } from "@/lib/mock-data"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { StatusBadge } from "@/components/shared/status-badge"
import { CategoryIcon } from "@/components/shared/category-icon"
import { BidCard } from "@/components/shared/bid-card"
import { ReviewDialog } from "@/components/shared/review-dialog"
import { ProjectImage } from "@/components/shared/project-image"
import { AgreementPanel } from "@/components/proposals/agreement-panel"
import { bidStatusLabels, formatBudget, formatDate, isOpenBid, relativeTime } from "@/lib/format"
import { cn } from "@/lib/utils"

export default function ProjectDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const {
    authUser,
    role,
    getProject,
    projectsLoading,
    currentClientId,
    getBidsForProject,
    getContractor,
    currentContractorId,
    startConversation,
    completeProject,
    reviews,
  } = useMarketplace()
  const [photoIndex, setPhotoIndex] = useState(0)
  const [openingChat, setOpeningChat] = useState(false)
  const [completing, setCompleting] = useState(false)

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
  // A withdrawn bid doesn't count: the contractor can bid again while the project is open.
  const myBid = projectBids.find((b) => b.contractorId === currentContractorId && b.status !== "withdrawn")
  const isOpen = project.status === "open"
  // The client and the hired contractor share the agreement workspace once someone is hired.
  const isHiredContractor = !!authUser && project.awardedContractorId === authUser.userId
  const showWorkspace = !isOpen && !!authUser && (isOwner || isHiredContractor)
  const hasReview = reviews.some((r) => r.projectId === project.projectId)
  const awardedContractor = project.awardedContractorId ? getContractor(project.awardedContractorId) : undefined

  async function handleComplete() {
    setCompleting(true)
    try {
      await completeProject(project!.projectId)
    } catch (err) {
      toast.error("Couldn't complete the project", { description: err instanceof Error ? err.message : undefined })
    } finally {
      setCompleting(false)
    }
  }

  async function handleMessage(contractorId: string) {
    setOpeningChat(true)
    try {
      const convId = await startConversation(project!.projectId, contractorId)
      router.push(`/messages?c=${convId}`)
    } catch (err) {
      toast.error("Couldn't open the conversation", {
        description: err instanceof Error ? err.message : "Please try again.",
      })
      setOpeningChat(false)
    }
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
              {project.timeline && (
                <span className="flex items-center gap-1.5">
                  <Clock width={15} height={15} aria-hidden="true" />
                  {project.timeline}
                </span>
              )}
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

          {showWorkspace && (
            <>
              <AgreementPanel project={project} viewerId={authUser!.userId} />
              <Separator />
            </>
          )}

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
                    onMessage={() => handleMessage(bid.contractorId)}
                    messageDisabled={openingChat}
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
                {project.timeline && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Clock width={15} height={15} aria-hidden="true" />
                      Timeline
                    </span>
                    <span className="text-right font-medium text-foreground">{project.timeline}</span>
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
                  <div className="flex flex-col gap-2">
                    <div className="rounded-lg bg-primary/5 p-3 text-center text-sm">
                      <p className="font-medium text-foreground">
                        {myBid.status === "accepted" ? "You're hired for this project" : "You've bid on this project"}
                      </p>
                      <p className="text-muted-foreground">
                        {myBid.status === "closed"
                          ? "This project hired another contractor."
                          : `Bid status: ${bidStatusLabels[myBid.status]}`}
                      </p>
                    </div>
                    {isOpen && isOpenBid(myBid.status) && (
                      <Button
                        className="w-full"
                        render={<Link href={`/projects/${project.projectId}/proposal?revise=${myBid.bidId}`} />}
                      >
                        <Pencil data-icon="inline-start" />
                        Revise bid
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      className="w-full"
                      render={<Link href={`/projects/${project.projectId}/bids/${myBid.bidId}`} />}
                    >
                      <FileText data-icon="inline-start" />
                      View your proposal
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={openingChat}
                      onClick={() => handleMessage(myBid.contractorId)}
                    >
                      <MessageSquare data-icon="inline-start" />
                      Message client
                    </Button>
                  </div>
                ) : isOpen ? (
                  <Button className="w-full" render={<Link href={`/projects/${project.projectId}/proposal`} />}>
                    Submit a bid
                  </Button>
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
                      <p className="text-xs text-muted-foreground">Hired</p>
                      <Link
                        href={`/contractors/${awardedContractor.contractorId}`}
                        className="font-medium text-foreground hover:underline"
                      >
                        {awardedContractor.businessName}
                      </Link>
                    </div>
                  )}
                  {(project.status === "awarded" || project.status === "in_progress") && (
                    <Button className="w-full" onClick={handleComplete} disabled={completing}>
                      {completing ? "Saving…" : "Mark as complete"}
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
                      disabled={openingChat}
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

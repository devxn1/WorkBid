"use client"

import { use, useEffect } from "react"
import Link from "next/link"
import { notFound, useRouter } from "next/navigation"
import { ArrowLeft, MessageSquareQuote, RotateCcw } from "lucide-react"
import { useMarketplace } from "@/lib/store"
import { useBidVersions, type ProposalInput } from "@/lib/proposals"
import { formatBudget, isOpenBid } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ProposalForm } from "@/components/proposals/proposal-form"
import type { ProposalTerms } from "@/lib/types"

export default function ProposalPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ revise?: string; from?: string }>
}) {
  const { id } = use(params)
  // `from` = an earlier version number to start from ("go back to an earlier offer").
  const { revise: reviseBidId, from } = use(searchParams)
  const router = useRouter()
  const { authUser, authLoading, getProject, projectsLoading, bids, bidsLoading, addBid, reviseBid } = useMarketplace()

  const project = getProject(id)
  const bid = reviseBidId ? bids.find((b) => b.bidId === reviseBidId) : undefined
  const isRevision = !!reviseBidId
  const { data: versions, loading: versionsLoading } = useBidVersions(bid?.bidId, bid?.currentVersion)

  const myOpenBid = bids.find((b) => b.projectId === id && b.contractorId === authUser?.userId && b.status !== "withdrawn")
  const allowed =
    !!project &&
    authUser?.userType === "contractor" &&
    project.status === "open" &&
    (isRevision ? !!bid && bid.contractorId === authUser.userId && isOpenBid(bid.status) : !myOpenBid)

  useEffect(() => {
    if (authLoading || projectsLoading) return
    if (!authUser) router.replace("/login")
  }, [authLoading, projectsLoading, authUser, router])

  if (!project) {
    if (projectsLoading) return <Loading />
    return notFound()
  }
  if (authLoading || bidsLoading) return <Loading />

  const backHref = bid ? `/projects/${id}/bids/${bid.bidId}` : `/projects/${id}`

  if (!allowed) {
    const reason =
      authUser?.userType !== "contractor"
        ? "Only contractor accounts can bid on projects."
        : project.status !== "open"
          ? "This project has hired a contractor and is no longer accepting bids."
          : isRevision
            ? "This bid can't be revised. It may have been accepted, declined or withdrawn."
            : "You already have a bid on this project. Revise it instead."
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <h1 className="font-heading text-2xl font-bold text-foreground">Can&apos;t open this proposal</h1>
        <p className="mt-2 text-muted-foreground">{reason}</p>
        <Button className="mt-6" render={<Link href={myOpenBid && !isRevision ? `/projects/${id}/bids/${myOpenBid.bidId}` : `/projects/${id}`} />}>
          {myOpenBid && !isRevision ? "View your bid" : "Back to project"}
        </Button>
      </div>
    )
  }

  // The version being revised (or the earlier one picked with `from`). Bids from before
  // versions existed fall back to their own fields.
  const startingFrom = from ? versions?.find((v) => v.version === Number(from) && v.status === "superseded") : undefined
  const current: ProposalTerms | undefined =
    startingFrom ??
    versions?.[0] ??
    (bid && !versionsLoading
      ? { amount: bid.amount, scope: bid.proposalMessage, estimatedDays: bid.estimatedDays, included: [], excluded: [] }
      : undefined)
  if (isRevision && !current) return <Loading />

  async function handleSubmit(input: ProposalInput, changeSummary: string) {
    if (bid) {
      await reviseBid(bid.bidId, bid.currentVersion, input, changeSummary)
      router.push(`/projects/${id}/bids/${bid.bidId}`)
    } else {
      const bidId = await addBid(id, input)
      router.push(`/projects/${id}/bids/${bidId}`)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <Button variant="ghost" size="sm" render={<Link href={backHref} />} className="mb-4 -ml-2">
        <ArrowLeft data-icon="inline-start" />
        Back
      </Button>

      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground text-balance">
          {isRevision ? `Revise your bid (version ${(bid?.currentVersion ?? 1) + 1})` : "Submit a bid"}
        </h1>
        <p className="text-muted-foreground">
          {project.title} · Client budget {formatBudget(project.budgetMin, project.budgetMax)}
          {project.timeline ? ` · Timeline: ${project.timeline}` : ""}
        </p>
      </header>

      {bid?.revisionNote && (
        <div className="mt-6 flex gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm">
          <MessageSquareQuote className="mt-0.5 size-4 shrink-0 text-warning-foreground" aria-hidden="true" />
          <div>
            <p className="font-medium text-foreground">The client asked for changes</p>
            <p className="mt-1 whitespace-pre-line text-muted-foreground">{bid.revisionNote}</p>
          </div>
        </div>
      )}

      {startingFrom && (
        <div className="mt-6 flex gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
          <RotateCcw className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <p className="text-foreground">
            Filled in with your version {startingFrom.version} offer. Add anything that&apos;s missing, like the start
            date or payment terms, then send it.
          </p>
        </div>
      )}

      <Card className="mt-6">
        <CardContent className="p-6">
          <ProposalForm
            initial={current}
            initialChangeSummary={startingFrom ? `Went back to the version ${startingFrom.version} offer.` : undefined}
            isRevision={isRevision}
            cancelHref={backHref}
            onSubmit={handleSubmit}
          />
        </CardContent>
      </Card>
    </div>
  )
}

function Loading() {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-3xl items-center justify-center px-4">
      <p className="text-sm text-muted-foreground">Loading…</p>
    </div>
  )
}

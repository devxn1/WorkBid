"use client"

import { use, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, ArrowRight, History, MessageSquare, MessageSquareQuote, PencilLine, RotateCcw, Undo2, X } from "lucide-react"
import { useMarketplace } from "@/lib/store"
import { diffTerms, restoreInput, useBidVersions } from "@/lib/proposals"
import { bidStatusLabels, formatCurrency, formatDate, isOpenBid } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ProposalTermsView } from "@/components/proposals/proposal-terms"
import { ConfirmActionDialog, RequestRevisionDialog } from "@/components/proposals/bid-dialogs"
import type { BidVersion } from "@/lib/types"

const versionLabels: Record<BidVersion["status"], string> = {
  active: "Current",
  superseded: "Superseded",
  accepted: "Accepted",
}

export default function BidProposalPage({ params }: { params: Promise<{ id: string; bidId: string }> }) {
  const { id, bidId } = use(params)
  const router = useRouter()
  const {
    authUser,
    authLoading,
    bids,
    bidsLoading,
    getProject,
    projectsLoading,
    getContractor,
    startConversation,
    declineBid,
    withdrawBid,
    reviseBid,
  } = useMarketplace()
  const [openingChat, setOpeningChat] = useState(false)

  const project = getProject(id)
  const bid = bids.find((b) => b.bidId === bidId && b.projectId === id)
  // Reload versions whenever the bid moves to a new version (live updates included).
  const { data: versions, loading, error } = useBidVersions(bid?.bidId, bid?.currentVersion)

  if (authLoading || bidsLoading || projectsLoading || (bid && loading)) {
    return <Centered>Loading proposal…</Centered>
  }
  // Bids are private: only the client and that contractor can load them.
  if (!project || !bid || !authUser) {
    return (
      <Centered>
        This proposal doesn&apos;t exist, or it&apos;s private to the client and contractor.{" "}
        <Link href={`/projects/${id}`} className="underline">
          Back to project
        </Link>
      </Centered>
    )
  }

  const isClient = authUser.userId === project.clientId
  const isContractor = authUser.userId === bid.contractorId
  const contractor = getContractor(bid.contractorId)
  const canAct = project.status === "open" && isOpenBid(bid.status)

  // Older bids have no saved versions; show their fields as version 1.
  const history: BidVersion[] = versions?.length
    ? versions
    : [
        {
          versionId: "legacy",
          bidId: bid.bidId,
          version: 1,
          status: "active",
          amount: bid.amount,
          scope: bid.proposalMessage,
          estimatedDays: bid.estimatedDays,
          included: [],
          excluded: [],
          createdAt: bid.bidDate,
        },
      ]
  const current = history[0]
  const previous = history[1]
  const changes = previous ? diffTerms(previous, current) : []
  const earlier = history.filter((v) => v.status === "superseded")

  async function handleMessage() {
    setOpeningChat(true)
    try {
      const convId = await startConversation(id, bid!.contractorId)
      router.push(`/messages?c=${convId}`)
    } catch (err) {
      toast.error("Couldn't open the conversation", { description: err instanceof Error ? err.message : undefined })
      setOpeningChat(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Button variant="ghost" size="sm" render={<Link href={`/projects/${id}`} />} className="mb-4 -ml-2">
        <ArrowLeft data-icon="inline-start" />
        Back to project
      </Button>

      <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-6">
          <header className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">Version {current.version}</Badge>
              <Badge variant={bid.status === "accepted" ? "default" : "secondary"}>{bidStatusLabels[bid.status]}</Badge>
            </div>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground text-balance">
              {isContractor ? "Your proposal" : `Proposal from ${contractor?.businessName ?? "contractor"}`}
            </h1>
            <p className="text-muted-foreground">
              For{" "}
              <Link href={`/projects/${id}`} className="underline-offset-2 hover:underline">
                {project.title}
              </Link>{" "}
              · Submitted {formatDate(bid.bidDate)}
            </p>
          </header>

          {error && <p className="text-sm text-destructive">Couldn&apos;t load the version history: {error}</p>}

          {bid.status === "revision_requested" && bid.revisionNote && (
            <div className="flex gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm">
              <MessageSquareQuote className="mt-0.5 size-4 shrink-0 text-warning-foreground" aria-hidden="true" />
              <div>
                <p className="font-medium text-foreground">
                  {isClient ? "You asked for changes" : "The client asked for changes"}
                </p>
                <p className="mt-1 whitespace-pre-line text-muted-foreground">{bid.revisionNote}</p>
              </div>
            </div>
          )}

          {previous && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  What changed from version {previous.version}
                </CardTitle>
                {current.changeSummary && (
                  <p className="text-sm text-muted-foreground">&ldquo;{current.changeSummary}&rdquo;</p>
                )}
              </CardHeader>
              <CardContent>
                {changes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No terms changed.</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-border">
                    {changes.map((c) => (
                      <li key={c.label} className="grid gap-1 py-3 sm:grid-cols-[140px_1fr_auto_1fr] sm:items-start sm:gap-3">
                        <span className="text-xs font-medium text-muted-foreground sm:pt-0.5">{c.label}</span>
                        <span className="whitespace-pre-line text-sm text-muted-foreground line-through">{c.before}</span>
                        <ArrowRight className="hidden size-4 text-muted-foreground sm:block" aria-hidden="true" />
                        <span className="whitespace-pre-line rounded bg-primary/10 px-1.5 text-sm font-medium text-foreground">
                          {c.after}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {bid.status === "accepted" ? "Accepted terms" : "Current offer"} (version {current.version})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ProposalTermsView terms={current} />
            </CardContent>
          </Card>

          {history.length > 1 && (
            <section className="flex flex-col gap-3">
              <h2 className="flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
                <History className="size-4" aria-hidden="true" />
                Version history
              </h2>
              {history.map((v) => (
                <details key={v.versionId} className="rounded-lg border border-border">
                  <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
                    <span className="font-medium text-foreground">Version {v.version}</span>
                    <Badge variant={v.status === "superseded" ? "secondary" : "default"}>{versionLabels[v.status]}</Badge>
                    <span className="text-sm text-muted-foreground">{formatCurrency(v.amount)}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{formatDate(v.createdAt)}</span>
                  </summary>
                  <div className="border-t border-border p-4">
                    {v.changeSummary && (
                      <p className="mb-4 text-sm text-muted-foreground">What changed: {v.changeSummary}</p>
                    )}
                    <ProposalTermsView terms={v} />
                  </div>
                </details>
              ))}
            </section>
          )}
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {canAct ? "Next steps" : "Status"}
              </CardTitle>
              <p className="font-heading text-2xl font-bold text-foreground">{formatCurrency(bid.amount)}</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {(isClient || isContractor) && (
                <Button variant="outline" className="w-full" onClick={handleMessage} disabled={openingChat}>
                  <MessageSquare data-icon="inline-start" />
                  {isClient ? "Message contractor" : "Message client"}
                </Button>
              )}

              {isClient && canAct && (
                <>
                  <RequestRevisionDialog
                    bidId={bid.bidId}
                    trigger={
                      <Button variant="outline" className="w-full">
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
                      <Button variant="ghost" className="w-full">
                        <X data-icon="inline-start" />
                        Decline
                      </Button>
                    }
                  />
                  <Separator className="my-1" />
                  <Button className="w-full" render={<Link href={`/projects/${id}/bids/${bid.bidId}/agreement`} />}>
                    Accept bid
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    You&apos;ll review the final terms before anything is confirmed.
                  </p>
                </>
              )}

              {isContractor && canAct && (
                <>
                  <Button className="w-full" render={<Link href={`/projects/${id}/proposal?revise=${bid.bidId}`} />}>
                    <PencilLine data-icon="inline-start" />
                    Revise bid
                  </Button>
                  <ConfirmActionDialog
                    title="Withdraw your bid?"
                    description="The client will be notified and can no longer accept this bid. You can submit a new bid later while the project is open."
                    confirmLabel="Withdraw bid"
                    workingLabel="Withdrawing…"
                    destructive
                    onConfirm={() => withdrawBid(bid.bidId)}
                    trigger={
                      <Button variant="ghost" className="w-full">
                        <Undo2 data-icon="inline-start" />
                        Withdraw bid
                      </Button>
                    }
                  />
                  {earlier.length > 0 && (
                    <>
                      <Separator className="my-1" />
                      <p className="text-xs font-medium text-muted-foreground">Go back to an earlier offer</p>
                      {earlier.map((v) => (
                        <RestoreVersion
                          key={v.versionId}
                          version={v}
                          editHref={`/projects/${id}/proposal?revise=${bid.bidId}&from=${v.version}`}
                          onRestore={(input) =>
                            reviseBid(bid.bidId, bid.currentVersion, input, `Went back to the version ${v.version} offer.`)
                          }
                        />
                      ))}
                    </>
                  )}
                </>
              )}

              {!canAct && (
                <p className="rounded-lg bg-muted p-3 text-center text-sm text-muted-foreground">
                  {bid.status === "accepted"
                    ? "This proposal was accepted. See the agreement on the project page."
                    : bid.status === "closed"
                      ? "Another contractor was hired for this project."
                      : bid.status === "withdrawn"
                        ? "This bid was withdrawn."
                        : bid.status === "rejected"
                          ? "This bid was declined."
                          : "This project is no longer accepting bids."}
                </p>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}

/** Lets the contractor resend an earlier version as a new current version, without retyping it. */
function RestoreVersion({
  version,
  editHref,
  onRestore,
}: {
  version: BidVersion
  /** The revise form, pre-filled with this version, for when it can't be resent as-is. */
  editHref: string
  onRestore: (input: Exclude<ReturnType<typeof restoreInput>, string>) => Promise<void>
}) {
  const input = restoreInput(version)
  const label = `Version ${version.version} · ${formatCurrency(version.amount)}`
  if (typeof input === "string") {
    return (
      <div className="flex flex-col gap-1">
        <Button variant="outline" className="w-full" render={<Link href={editHref} />}>
          <RotateCcw data-icon="inline-start" />
          {label}
        </Button>
        <p className="text-xs text-muted-foreground">{input}</p>
      </div>
    )
  }
  return (
    <ConfirmActionDialog
      title={`Make version ${version.version} the current offer?`}
      description={`Its terms (${formatCurrency(version.amount)}, ${version.estimatedDays} days) are sent to the client as a new version. Your history stays as it is.`}
      confirmLabel="Make current offer"
      workingLabel="Sending…"
      onConfirm={() => onRestore(input)}
      trigger={
        <Button variant="outline" className="w-full">
          <RotateCcw data-icon="inline-start" />
          {label}
        </Button>
      }
    />
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-3xl items-center justify-center px-4 text-center">
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  )
}

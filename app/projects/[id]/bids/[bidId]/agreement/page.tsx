"use client"

import { use, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertTriangle, ArrowLeft, BadgeCheck, MapPin, ShieldCheck } from "lucide-react"
import { useMarketplace } from "@/lib/store"
import { missingTerms, useBidVersions } from "@/lib/proposals"
import { formatCurrency, initials, isOpenBid } from "@/lib/format"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StarRating } from "@/components/shared/star-rating"
import { ProposalTermsView } from "@/components/proposals/proposal-terms"
import { RequestRevisionDialog } from "@/components/proposals/bid-dialogs"

export default function ReviewAgreementPage({ params }: { params: Promise<{ id: string; bidId: string }> }) {
  const { id, bidId } = use(params)
  const router = useRouter()
  const { authUser, authLoading, bids, bidsLoading, getProject, projectsLoading, getContractor, confirmAgreement } =
    useMarketplace()
  // The version the client ticked "I agree" for. If the contractor revises meanwhile,
  // the box un-ticks itself because the current version no longer matches.
  const [agreedVersionId, setAgreedVersionId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState("")

  const project = getProject(id)
  const bid = bids.find((b) => b.bidId === bidId && b.projectId === id)
  const { data: versions, loading } = useBidVersions(bid?.bidId, bid?.currentVersion)

  // After confirming, the project reloads as hired before the redirect lands; don't flash an error.
  if (confirmed) return <Centered>Agreement confirmed. Opening your project…</Centered>
  if (authLoading || bidsLoading || projectsLoading || (bid && loading)) {
    return <Centered>Loading agreement…</Centered>
  }
  if (!project || !bid || !authUser || authUser.userId !== project.clientId) {
    return (
      <Centered>
        Only the client who posted this project can review and accept its bids.{" "}
        <Link href={`/projects/${id}`} className="underline">
          Back to project
        </Link>
      </Centered>
    )
  }
  if (project.status !== "open" || !isOpenBid(bid.status)) {
    return (
      <Centered>
        This bid can&apos;t be accepted any more{project.status !== "open" ? ": the project already hired a contractor" : ""}.{" "}
        <Link href={`/projects/${id}`} className="underline">
          Back to project
        </Link>
      </Centered>
    )
  }

  const contractor = getContractor(bid.contractorId)
  const proposalHref = `/projects/${id}/bids/${bid.bidId}`
  // Older bids have no saved version and lack required terms, so they can't be confirmed as-is.
  const current = versions?.[0]
  const terms = current ?? {
    amount: bid.amount,
    scope: bid.proposalMessage,
    estimatedDays: bid.estimatedDays,
    included: [],
    excluded: [],
  }
  const missing = missingTerms(terms)
  const agreed = !!current && agreedVersionId === current.versionId
  const canConfirm = !!current && missing.length === 0 && agreed && !confirming

  async function handleConfirm() {
    if (!current || !canConfirm) return
    setError("")
    setConfirming(true)
    try {
      await confirmAgreement(bid!.bidId, current.versionId)
      setConfirmed(true)
      router.push(`/projects/${id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't confirm the agreement. Please try again.")
      setConfirming(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <Button variant="ghost" size="sm" render={<Link href={proposalHref} />} className="mb-4 -ml-2">
        <ArrowLeft data-icon="inline-start" />
        Back to proposal
      </Button>

      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground text-balance">
          Review &amp; confirm agreement
        </h1>
        <p className="text-muted-foreground">
          Check the final terms for <span className="font-medium text-foreground">{project.title}</span>. Nothing is
          confirmed until you press Confirm agreement.
        </p>
      </header>

      <div className="mt-6 flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contractor</CardTitle>
          </CardHeader>
          <CardContent className="flex items-start gap-4">
            <Avatar className="size-12">
              <AvatarImage src={contractor?.avatar || "/placeholder.svg"} alt={contractor?.contractorName ?? "Contractor"} />
              <AvatarFallback>{initials(contractor?.contractorName ?? "NA")}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-1 text-sm">
              <Link href={`/contractors/${bid.contractorId}`} className="flex items-center gap-1.5 font-semibold text-foreground hover:underline">
                {contractor?.businessName ?? "Contractor"}
                {contractor?.verified && <BadgeCheck className="size-4 text-primary" aria-label="Verified" />}
              </Link>
              {contractor && (
                <>
                  <span className="text-muted-foreground">{contractor.contractorName}</span>
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <StarRating rating={contractor.rating} size={12} />
                    {contractor.rating.toFixed(1)} ({contractor.reviewCount} reviews)
                  </span>
                  {contractor.location && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <MapPin className="size-3.5" aria-hidden="true" />
                      {contractor.location}
                    </span>
                  )}
                  {contractor.licenseNumber && (
                    <span className="text-muted-foreground">License #{contractor.licenseNumber}</span>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Final terms (proposal version {current?.version ?? 1})</CardTitle>
          </CardHeader>
          <CardContent>
            <ProposalTermsView terms={terms} />
          </CardContent>
        </Card>

        {missing.length > 0 && (
          <div className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm sm:flex-row sm:items-center">
            <AlertTriangle className="size-5 shrink-0 text-destructive" aria-hidden="true" />
            <p className="flex-1 text-foreground">
              This proposal is missing <span className="font-medium">{missing.join(", ")}</span>. Ask the contractor to
              revise it before you can confirm.
            </p>
            <RequestRevisionDialog bidId={bid.bidId} trigger={<Button variant="outline">Request revision</Button>} />
          </div>
        )}

        <Card>
          <CardContent className="flex flex-col gap-4 p-6">
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-primary"
                checked={agreed}
                disabled={!current || missing.length > 0}
                onChange={(e) => setAgreedVersionId(e.target.checked && current ? current.versionId : null)}
              />
              <span className="text-foreground">
                I&apos;ve reviewed these terms and agree to hire{" "}
                <span className="font-medium">{contractor?.businessName ?? "this contractor"}</span> for{" "}
                <span className="font-medium">{formatCurrency(terms.amount)}</span>. Other bids on this project will be
                closed.
              </span>
            </label>

            {error && (
              <div role="alert" className="flex flex-col gap-1 text-sm text-destructive">
                <p>{error}</p>
                <Link href={proposalHref} className="underline">
                  Review the latest proposal
                </Link>
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" render={<Link href={proposalHref} />}>
                Keep negotiating
              </Button>
              <Button onClick={handleConfirm} disabled={!canConfirm}>
                <ShieldCheck data-icon="inline-start" />
                {confirming ? "Confirming…" : "Confirm agreement"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              WorkBid records the agreement but doesn&apos;t process payments. Later changes need a change order approved
              by both of you.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-3xl items-center justify-center px-4 text-center">
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  )
}

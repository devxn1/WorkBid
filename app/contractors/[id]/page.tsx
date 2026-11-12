"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { notFound, useRouter } from "next/navigation"
import { ArrowLeft, Award, BadgeCheck, Briefcase, Calendar, MapPin, MessageSquare, Star } from "lucide-react"
import { useMarketplace } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { StarRating } from "@/components/shared/star-rating"
import { ReviewDialog } from "@/components/shared/review-dialog"
import { PreviousWork } from "@/components/contractors/previous-work"
import { formatDate, initials } from "@/lib/format"

export default function ContractorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { authUser, getContractor, requestContractor, contractorStatus, getReviewsForContractor, projects } =
    useMarketplace()
  const [verifiedOnly, setVerifiedOnly] = useState(false)

  useEffect(() => requestContractor(id), [id, requestContractor])

  const contractor = getContractor(id)
  if (!contractor) {
    if (contractorStatus(id) === "loading") {
      return <p className="py-24 text-center text-sm text-muted-foreground">Loading…</p>
    }
    return notFound()
  }

  const allReviews = getReviewsForContractor(id)
  const verifiedCount = allReviews.filter((r) => r.verified).length
  const contractorReviews = verifiedOnly ? allReviews.filter((r) => r.verified) : allReviews

  // What the signed-in client can review: a completed project where they hired this
  // contractor (verified), otherwise one unverified review if they haven't left any.
  const isClient = authUser?.userType === "client"
  const myReviews = allReviews.filter((r) => r.clientId === authUser?.userId)
  const projectToReview = projects.find(
    (p) =>
      p.clientId === authUser?.userId &&
      p.awardedContractorId === id &&
      p.status === "completed" &&
      !myReviews.some((r) => r.projectId === p.projectId),
  )
  const canReview = isClient && (!!projectToReview || myReviews.length === 0)
  const completedForContractor = projects.filter(
    (p) => p.awardedContractorId === id && p.status === "completed",
  )

  const ratingBuckets = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: contractorReviews.filter((r) => Math.round(r.rating) === star).length,
  }))

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-4 -ml-2">
        <ArrowLeft data-icon="inline-start" />
        Back
      </Button>

      {/* Header */}
      <Card>
        <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-start">
          <Avatar className="size-20">
            <AvatarImage src={contractor.avatar || "/placeholder.svg"} alt={contractor.contractorName} />
            <AvatarFallback className="text-lg">{initials(contractor.contractorName)}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
                {contractor.businessName}
              </h1>
              {contractor.verified && (
                <Badge variant="secondary" className="gap-1">
                  <BadgeCheck width={14} height={14} aria-hidden="true" />
                  Verified
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              {contractor.contractorName} · {contractor.specialty}
            </p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
              <span className="flex items-center gap-1.5">
                <StarRating rating={contractor.rating} size={15} />
                <span className="font-semibold text-foreground">{contractor.rating.toFixed(1)}</span>
                <span className="text-muted-foreground">({contractor.reviewCount} reviews)</span>
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <MapPin width={15} height={15} aria-hidden="true" />
                {contractor.location}
              </span>
            </div>
          </div>
          <Button render={<Link href="/messages" />} className="shrink-0">
            <MessageSquare data-icon="inline-start" />
            Message
          </Button>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-6">
          {/* About */}
          <section className="flex flex-col gap-3">
            <h2 className="font-heading text-lg font-semibold text-foreground">About</h2>
            <p className="leading-relaxed text-muted-foreground text-pretty">{contractor.about}</p>
          </section>

          <Separator />

          {/* Services */}
          <section className="flex flex-col gap-3">
            <h2 className="font-heading text-lg font-semibold text-foreground">Services offered</h2>
            <div className="flex flex-wrap gap-2">
              {contractor.services.map((s) => (
                <Badge key={s} variant="outline" className="px-3 py-1">
                  {s}
                </Badge>
              ))}
            </div>
          </section>

          <Separator />

          <PreviousWork
            contractorId={id}
            signedIn={!!authUser}
            completedProjects={completedForContractor}
            reviews={allReviews}
          />

          <Separator />

          {/* Reviews */}
          <section className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-heading text-lg font-semibold text-foreground">
                Reviews <span className="text-muted-foreground">({allReviews.length})</span>
              </h2>
              {canReview && (
                <ReviewDialog
                  contractorId={id}
                  project={projectToReview}
                  trigger={
                    <Button size="sm" variant="outline">
                      <Star data-icon="inline-start" />
                      Write a review
                    </Button>
                  }
                />
              )}
            </div>

            {allReviews.length > 0 && (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filter reviews">
                <Button size="sm" variant={verifiedOnly ? "ghost" : "secondary"} onClick={() => setVerifiedOnly(false)}>
                  All ({allReviews.length})
                </Button>
                <Button size="sm" variant={verifiedOnly ? "secondary" : "ghost"} onClick={() => setVerifiedOnly(true)}>
                  <BadgeCheck data-icon="inline-start" />
                  Verified hires ({verifiedCount})
                </Button>
              </div>
            )}

            {contractorReviews.length > 0 && (
              <div className="flex flex-col gap-1.5 rounded-lg border border-border p-4">
                {ratingBuckets.map((b) => (
                  <div key={b.star} className="flex items-center gap-3 text-sm">
                    <span className="w-8 text-muted-foreground">{b.star}★</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{
                          width: `${contractorReviews.length ? (b.count / contractorReviews.length) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <span className="w-6 text-right text-muted-foreground">{b.count}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-3">
              {contractorReviews.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {verifiedOnly ? "No reviews from verified hires yet." : "No reviews yet."}
                </p>
              ) : (
                contractorReviews.map((review) => (
                  <Card key={review.reviewId}>
                    <CardContent className="flex flex-col gap-2 p-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <StarRating rating={review.rating} size={14} />
                          <span className="text-sm font-medium text-foreground">{review.clientName}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{formatDate(review.createdAt)}</span>
                      </div>
                      {review.verified ? (
                        <p className="flex items-center gap-1 text-xs font-medium text-success">
                          <BadgeCheck width={14} height={14} aria-hidden="true" />
                          Verified hire{review.projectTitle ? ` · ${review.projectTitle}` : ""}
                        </p>
                      ) : (
                        <p className="text-xs font-medium text-muted-foreground">
                          Unverified · didn&apos;t hire through WorkBid
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground text-pretty">{review.reviewText}</p>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Sidebar stats */}
        <aside className="flex flex-col gap-4">
          <Card>
            <CardContent className="flex flex-col gap-4 p-5 text-sm">
              <div className="flex items-center gap-3">
                <Briefcase width={18} height={18} className="text-primary" aria-hidden="true" />
                <div>
                  <p className="font-heading text-lg font-bold text-foreground">{contractor.completedProjects}</p>
                  <p className="text-muted-foreground">Projects completed</p>
                </div>
              </div>
              <Separator />
              <div className="flex items-center gap-3">
                <Calendar width={18} height={18} className="text-primary" aria-hidden="true" />
                <div>
                  <p className="font-heading text-lg font-bold text-foreground">{contractor.yearsExperience} yrs</p>
                  <p className="text-muted-foreground">Experience</p>
                </div>
              </div>
              <Separator />
              <div className="flex items-center gap-3">
                <Award width={18} height={18} className="text-primary" aria-hidden="true" />
                <div>
                  <p className="font-medium text-foreground">License #{contractor.licenseNumber}</p>
                  <p className="text-muted-foreground">Licensed &amp; insured</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-3 p-5">
              <h3 className="font-heading text-sm font-semibold text-foreground">Skills</h3>
              <div className="flex flex-wrap gap-1.5">
                {contractor.skills.map((skill) => (
                  <Badge key={skill} variant="secondary">
                    {skill}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}

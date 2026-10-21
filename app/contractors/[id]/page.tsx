"use client"

import { use } from "react"
import Link from "next/link"
import { notFound, useRouter } from "next/navigation"
import { ArrowLeft, Award, BadgeCheck, Briefcase, Calendar, MapPin, MessageSquare } from "lucide-react"
import { useMarketplace } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { StarRating } from "@/components/shared/star-rating"
import { ProjectImage } from "@/components/shared/project-image"
import { formatDate, initials } from "@/lib/format"

export default function ContractorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { getContractor, getReviewsForContractor, projects } = useMarketplace()

  const contractor = getContractor(id)
  if (!contractor) return notFound()

  const contractorReviews = getReviewsForContractor(id)
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

          {/* Reviews */}
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-semibold text-foreground">
                Reviews <span className="text-muted-foreground">({contractorReviews.length})</span>
              </h2>
            </div>

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
                <p className="text-sm text-muted-foreground">No reviews yet.</p>
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
                      <p className="text-xs font-medium text-muted-foreground">{review.projectTitle}</p>
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

          {completedForContractor.length > 0 && (
            <Card>
              <CardContent className="flex flex-col gap-3 p-5">
                <h3 className="font-heading text-sm font-semibold text-foreground">Recent work</h3>
                <div className="flex flex-col gap-2">
                  {completedForContractor.slice(0, 3).map((p) => (
                    <Link
                      key={p.projectId}
                      href={`/projects/${p.projectId}`}
                      className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted"
                    >
                      <ProjectImage
                        src={p.images[0]}
                        alt=""
                        className="size-12 shrink-0 rounded-md object-cover"
                      />
                      <span className="truncate text-sm text-foreground">{p.title}</span>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </div>
  )
}

"use client"

import { useMemo } from "react"
import Link from "next/link"
import { Award, CheckCircle2, Clock, Search, Star } from "lucide-react"
import { useMarketplace } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle, EmptyContent } from "@/components/ui/empty"
import { StatCard } from "@/components/shared/stat-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { formatCurrency, relativeTime } from "@/lib/format"
import type { Bid, Project } from "@/lib/types"

export default function ContractorDashboardPage() {
  const { currentContractorId, getContractor, getBidsByContractor, getProject } = useMarketplace()
  const contractor = getContractor(currentContractorId)
  const myBids = useMemo(() => getBidsByContractor(currentContractorId), [getBidsByContractor, currentContractorId])

  const pending = myBids.filter((b) => b.status === "pending")
  const won = myBids.filter((b) => b.status === "accepted")
  const winRate = myBids.length ? Math.round((won.length / myBids.length) * 100) : 0

  if (!contractor) return null

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">Welcome back, {contractor.contractorName}</p>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">{contractor.businessName}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" render={<Link href={`/contractors/${contractor.contractorId}`} />}>
            View public profile
          </Button>
          <Button render={<Link href="/projects" />}>
            <Search data-icon="inline-start" />
            Find work
          </Button>
        </div>
      </header>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Clock} label="Pending bids" value={pending.length} />
        <StatCard icon={Award} label="Jobs won" value={won.length} />
        <StatCard icon={CheckCircle2} label="Win rate" value={`${winRate}%`} />
        <StatCard icon={Star} label="Rating" value={contractor.rating.toFixed(1)} hint={`${contractor.reviewCount} reviews`} />
      </div>

      <Tabs defaultValue="pending" className="mt-8">
        <TabsList>
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="won">Won ({won.length})</TabsTrigger>
          <TabsTrigger value="all">All bids ({myBids.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="mt-4">
          <BidList bids={pending} getProject={getProject} />
        </TabsContent>
        <TabsContent value="won" className="mt-4">
          <BidList bids={won} getProject={getProject} />
        </TabsContent>
        <TabsContent value="all" className="mt-4">
          <BidList bids={myBids} getProject={getProject} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function BidList({
  bids,
  getProject,
}: {
  bids: Bid[]
  getProject: (id: string) => Project | undefined
}) {
  if (bids.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Search />
          </EmptyMedia>
          <EmptyTitle>No bids here yet</EmptyTitle>
          <EmptyDescription>Browse open projects and submit proposals to grow your business.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button render={<Link href="/projects" />}>Browse projects</Button>
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {bids.map((bid) => {
        const project = getProject(bid.projectId)
        if (!project) return null
        return (
          <Card key={bid.bidId} className="transition-shadow hover:shadow-sm">
            <Link href={`/projects/${project.projectId}`} className="block">
              <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={bid.status === "accepted" ? "default" : bid.status === "rejected" ? "secondary" : "outline"}
                      className="capitalize"
                    >
                      {bid.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">Bid {relativeTime(bid.bidDate)}</span>
                  </div>
                  <h3 className="truncate font-heading text-base font-semibold text-foreground">{project.title}</h3>
                  <p className="text-sm text-muted-foreground">{project.location}</p>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <div className="text-right">
                    <p className="font-heading text-lg font-bold text-foreground">{formatCurrency(bid.amount)}</p>
                    <p className="text-xs text-muted-foreground">{bid.estimatedDays} days</p>
                  </div>
                  <StatusBadge status={project.status} />
                </div>
              </CardContent>
            </Link>
          </Card>
        )
      })}
    </div>
  )
}

"use client"

import { useMemo } from "react"
import Link from "next/link"
import { FolderOpen, MessageSquare, Plus, TrendingUp } from "lucide-react"
import { useMarketplace } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StatusBadge } from "@/components/shared/status-badge"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { StatCard } from "@/components/shared/stat-card"
import { formatBudget, relativeTime } from "@/lib/format"
import type { Project } from "@/lib/types"

export default function ClientDashboardPage() {
  const { projects, currentClientId, getBidsForProject, currentUser } = useMarketplace()

  const myProjects = useMemo(
    () => projects.filter((p) => p.clientId === currentClientId),
    [projects, currentClientId],
  )

  const active = myProjects.filter((p) => p.status === "open" || p.status === "awarded" || p.status === "in_progress")
  const completed = myProjects.filter((p) => p.status === "completed")
  const totalBids = myProjects.reduce((sum, p) => sum + getBidsForProject(p.projectId).length, 0)

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">Welcome back, {currentUser.firstName}</p>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">Client dashboard</h1>
        </div>
        <Button render={<Link href="/post-project" />}>
          <Plus data-icon="inline-start" />
          Post a project
        </Button>
      </header>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard icon={FolderOpen} label="Active projects" value={active.length} />
        <StatCard icon={MessageSquare} label="Total bids received" value={totalBids} />
        <StatCard icon={TrendingUp} label="Completed" value={completed.length} />
      </div>

      <Tabs defaultValue="active" className="mt-8">
        <TabsList>
          <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="mt-4">
          <ProjectList
            projects={active}
            getBidCount={(id) => getBidsForProject(id).length}
            emptyTitle="No active projects"
            emptyDesc="Post your first project to start receiving bids from contractors."
          />
        </TabsContent>
        <TabsContent value="completed" className="mt-4">
          <ProjectList
            projects={completed}
            getBidCount={(id) => getBidsForProject(id).length}
            emptyTitle="No completed projects yet"
            emptyDesc="Completed projects will appear here."
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ProjectList({
  projects,
  getBidCount,
  emptyTitle,
  emptyDesc,
}: {
  projects: Project[]
  getBidCount: (id: string) => number
  emptyTitle: string
  emptyDesc: string
}) {
  if (projects.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FolderOpen />
          </EmptyMedia>
          <EmptyTitle>{emptyTitle}</EmptyTitle>
          <EmptyDescription>{emptyDesc}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {projects.map((project) => {
        const bidCount = getBidCount(project.projectId)
        return (
          <Card key={project.projectId} className="transition-shadow hover:shadow-sm">
            <Link href={`/projects/${project.projectId}`} className="block">
              <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={project.status} />
                    <span className="text-xs text-muted-foreground">{relativeTime(project.createdAt)}</span>
                  </div>
                  <h3 className="truncate font-heading text-base font-semibold text-foreground">{project.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {formatBudget(project.budgetMin, project.budgetMax)} · {project.location}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <div className="text-right">
                    <p className="font-heading text-xl font-bold text-foreground">{bidCount}</p>
                    <p className="text-xs text-muted-foreground">{bidCount === 1 ? "bid" : "bids"}</p>
                  </div>
                  <Button variant="outline" size="sm">
                    {project.status === "open" ? "Review bids" : "View"}
                  </Button>
                </div>
              </CardContent>
            </Link>
          </Card>
        )
      })}
    </div>
  )
}

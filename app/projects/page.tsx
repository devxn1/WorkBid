"use client"

import { useMemo, useState } from "react"
import { Search } from "lucide-react"
import { useMarketplace } from "@/lib/store"
import { categories } from "@/lib/mock-data"
import { ProjectCard } from "@/components/shared/project-card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { cn } from "@/lib/utils"

type SortKey = "recent" | "budget-high" | "budget-low"

export default function BrowseProjectsPage() {
  const { projects, projectsLoading, getBidsForProject } = useMarketplace()
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("open")
  const [sort, setSort] = useState<SortKey>("recent")

  const filtered = useMemo(() => {
    let list = projects.filter((p) => {
      const matchesQuery =
        !query ||
        p.title.toLowerCase().includes(query.toLowerCase()) ||
        p.description.toLowerCase().includes(query.toLowerCase()) ||
        p.location.toLowerCase().includes(query.toLowerCase())
      const matchesCategory = category === "all" || p.categoryId === category
      const matchesStatus = statusFilter === "all" || p.status === statusFilter
      return matchesQuery && matchesCategory && matchesStatus
    })

    list = [...list].sort((a, b) => {
      if (sort === "budget-high") return b.budgetMax - a.budgetMax
      if (sort === "budget-low") return a.budgetMin - b.budgetMin
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
    return list
  }, [projects, query, category, statusFilter, sort])

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground text-balance">
          Browse projects
        </h1>
        <p className="text-muted-foreground">
          Find open jobs from homeowners near you and submit a competitive bid.
        </p>
      </header>

      <div className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search
              width={18}
              height={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title, description, or location"
              className="pl-10"
              aria-label="Search projects"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
            <SelectTrigger className="sm:w-44">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="open">Open for bids</SelectItem>
              <SelectItem value="awarded">Awarded</SelectItem>
              <SelectItem value="in_progress">In progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort((v ?? "recent") as SortKey)}>
            <SelectTrigger className="sm:w-48">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Most recent</SelectItem>
              <SelectItem value="budget-high">Budget: high to low</SelectItem>
              <SelectItem value="budget-low">Budget: low to high</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setCategory("all")}>
            <Badge
              variant={category === "all" ? "default" : "outline"}
              className={cn("cursor-pointer px-3 py-1", category === "all" && "hover:bg-primary")}
            >
              All categories
            </Badge>
          </button>
          {categories.map((c) => (
            <button type="button" key={c.categoryId} onClick={() => setCategory(c.categoryId)}>
              <Badge
                variant={category === c.categoryId ? "default" : "outline"}
                className="cursor-pointer px-3 py-1"
              >
                {c.name}
              </Badge>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "project" : "projects"}
        </p>
      </div>

      {projectsLoading ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">Loading projects…</p>
      ) : filtered.length === 0 ? (
        <Empty className="mt-8">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Search />
            </EmptyMedia>
            <EmptyTitle>No projects found</EmptyTitle>
            <EmptyDescription>Try adjusting your search or filters.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <ProjectCard key={p.projectId} project={p} bidCount={getBidsForProject(p.projectId).length} />
          ))}
        </div>
      )}
    </div>
  )
}

import Link from "next/link"
import { MapPin, MessageSquare } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CategoryIcon } from "./category-icon"
import { StatusBadge } from "./status-badge"
import { formatBudget, relativeTime } from "@/lib/format"
import { categories } from "@/lib/mock-data"
import type { Project } from "@/lib/types"

interface ProjectCardProps {
  project: Project
  bidCount?: number
}

export function ProjectCard({ project, bidCount }: ProjectCardProps) {
  const category = categories.find((c) => c.categoryId === project.categoryId)

  return (
    <Card className="group overflow-hidden py-0 transition-shadow hover:shadow-md">
      <Link href={`/projects/${project.projectId}`} className="block">
        <div className="relative aspect-[16/10] overflow-hidden bg-muted">
          <img
            src={project.images[0] || "/placeholder.svg"}
            alt={project.title}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute left-3 top-3">
            <StatusBadge status={project.status} />
          </div>
        </div>
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <CategoryIcon icon={category?.icon ?? "wrench"} size={14} className="text-primary" />
            <span>{category?.name}</span>
            <span aria-hidden="true">·</span>
            <span>{relativeTime(project.createdAt)}</span>
          </div>
          <h3 className="font-heading text-base font-semibold leading-snug text-foreground text-balance">
            {project.title}
          </h3>
          <p className="line-clamp-2 text-sm text-muted-foreground text-pretty">{project.description}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
            <span className="font-semibold text-foreground">{formatBudget(project.budgetMin, project.budgetMax)}</span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <MapPin width={14} height={14} aria-hidden="true" />
              {project.location}
            </span>
            {typeof bidCount === "number" && (
              <Badge variant="secondary" className="ml-auto gap-1">
                <MessageSquare width={12} height={12} aria-hidden="true" />
                {bidCount} {bidCount === 1 ? "bid" : "bids"}
              </Badge>
            )}
          </div>
        </CardContent>
      </Link>
    </Card>
  )
}

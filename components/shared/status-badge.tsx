import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { statusLabels } from "@/lib/format"
import type { ProjectStatus } from "@/lib/types"

const styles: Record<ProjectStatus, string> = {
  open: "bg-info/10 text-info border-info/20",
  awarded: "bg-warning/15 text-warning-foreground border-warning/30",
  in_progress: "bg-warning/15 text-warning-foreground border-warning/30",
  completed: "bg-success/10 text-success border-success/20",
}

export function StatusBadge({ status, className }: { status: ProjectStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", styles[status], className)}>
      {statusLabels[status]}
    </Badge>
  )
}

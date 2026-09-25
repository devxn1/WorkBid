import type { ProjectStatus } from "./types"

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatBudget(min: number, max: number) {
  return `${formatCurrency(min)} – ${formatCurrency(max)}`
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

export function relativeTime(iso: string) {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diff = now - then
  const mins = Math.round(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.round(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.round(months / 12)}y ago`
}

export const statusLabels: Record<ProjectStatus, string> = {
  open: "Open for bids",
  awarded: "Awarded",
  in_progress: "In progress",
  completed: "Completed",
}

export const statusVariants: Record<ProjectStatus, "default" | "secondary" | "outline"> = {
  open: "default",
  awarded: "secondary",
  in_progress: "secondary",
  completed: "outline",
}

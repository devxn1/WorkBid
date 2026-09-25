import {
  Droplets,
  Grid2x2,
  Hammer,
  Home,
  PaintRoller,
  Trees,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react"

const iconMap: Record<string, LucideIcon> = {
  hammer: Hammer,
  zap: Zap,
  droplets: Droplets,
  "paint-roller": PaintRoller,
  trees: Trees,
  home: Home,
  "grid-2x2": Grid2x2,
  wrench: Wrench,
}

export function CategoryIcon({ icon, className, size = 20 }: { icon: string; className?: string; size?: number }) {
  const Icon = iconMap[icon] ?? Wrench
  return <Icon width={size} height={size} className={className} aria-hidden="true" />
}

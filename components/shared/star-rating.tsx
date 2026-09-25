import { Star } from "lucide-react"
import { cn } from "@/lib/utils"

interface StarRatingProps {
  rating: number
  size?: number
  className?: string
  showValue?: boolean
  reviewCount?: number
}

export function StarRating({ rating, size = 16, className, showValue, reviewCount }: StarRatingProps) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div className="flex items-center gap-0.5" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, i) => {
          const filled = i < Math.round(rating)
          return (
            <Star
              key={i}
              width={size}
              height={size}
              className={cn(filled ? "fill-warning text-warning" : "fill-muted text-muted")}
            />
          )
        })}
      </div>
      {showValue && (
        <span className="text-sm font-medium text-foreground">
          {rating.toFixed(1)}
          {typeof reviewCount === "number" && (
            <span className="font-normal text-muted-foreground"> ({reviewCount})</span>
          )}
        </span>
      )}
      <span className="sr-only">{rating.toFixed(1)} out of 5 stars</span>
    </div>
  )
}

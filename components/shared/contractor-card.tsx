import Link from "next/link"
import { BadgeCheck, MapPin } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { StarRating } from "./star-rating"
import { initials } from "@/lib/format"
import type { Contractor } from "@/lib/types"

interface ContractorCardProps {
  contractor: Contractor
}

export function ContractorCard({ contractor }: ContractorCardProps) {
  return (
    <Card className="group transition-shadow hover:shadow-md">
      <Link href={`/contractors/${contractor.contractorId}`} className="block">
        <CardContent className="flex flex-col gap-4 p-5">
          <div className="flex items-start gap-3">
            <Avatar className="size-12">
              <AvatarImage src={contractor.avatar || "/placeholder.svg"} alt={contractor.contractorName} />
              <AvatarFallback>{initials(contractor.contractorName)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h3 className="truncate font-heading text-base font-semibold text-foreground">
                  {contractor.businessName}
                </h3>
                {contractor.verified && (
                  <BadgeCheck width={16} height={16} className="shrink-0 text-primary" aria-label="Verified" />
                )}
              </div>
              <p className="truncate text-sm text-muted-foreground">{contractor.specialty}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <StarRating rating={contractor.rating} size={14} />
            <span className="font-medium text-foreground">{contractor.rating.toFixed(1)}</span>
            <span className="text-muted-foreground">({contractor.reviewCount})</span>
          </div>

          <p className="line-clamp-2 text-sm text-muted-foreground text-pretty">{contractor.about}</p>

          <div className="flex flex-wrap gap-1.5">
            {contractor.skills.slice(0, 3).map((skill) => (
              <Badge key={skill} variant="secondary">
                {skill}
              </Badge>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-border pt-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin width={14} height={14} aria-hidden="true" />
              {contractor.location}
            </span>
            <span>{contractor.completedProjects} projects</span>
          </div>
        </CardContent>
      </Link>
    </Card>
  )
}

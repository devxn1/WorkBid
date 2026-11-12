"use client"

import { useMemo, useState } from "react"
import { MapPin, Search } from "lucide-react"
import { useMarketplace } from "@/lib/store"
import { isNear, type LocationScope } from "@/lib/location"
import { ContractorCard } from "@/components/shared/contractor-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"

type SortKey = "rating" | "reviews" | "experience"

const sortLabels: Record<SortKey, string> = {
  rating: "Top rated",
  reviews: "Most reviews",
  experience: "Most experience",
}

const scopeLabels: Record<LocationScope, string> = {
  city: "Same city",
  state: "Same state",
  anywhere: "Anywhere",
}

export default function BrowseContractorsPage() {
  const { authUser, contractors, contractorsLoading, projects, getContractor } = useMarketplace()
  const [query, setQuery] = useState("")
  // null = not changed yet, so use the signed-in user's own location.
  const [nearInput, setNearInput] = useState<string | null>(null)
  const [scopeInput, setScopeInput] = useState<LocationScope | null>(null)
  const [sort, setSort] = useState<SortKey>("rating")

  // Contractors start from their profile's location; clients from their latest project's.
  const myLocation = !authUser
    ? ""
    : authUser.userType === "contractor"
      ? (getContractor(authUser.userId)?.location ?? "")
      : (projects.find((p) => p.clientId === authUser.userId)?.location ?? "")
  const near = nearInput ?? myLocation
  const scope = scopeInput ?? (near ? "city" : "anywhere")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = contractors.filter((c) => {
      if (authUser && c.contractorId === authUser.userId) return false
      const text = [c.businessName, c.contractorName, c.specialty, c.about, ...c.skills, ...c.services]
        .join(" ")
        .toLowerCase()
      return (!q || text.includes(q)) && isNear(c.location, near, scope)
    })
    return list.sort((a, b) => {
      if (sort === "reviews") return b.reviewCount - a.reviewCount
      if (sort === "experience") return b.yearsExperience - a.yearsExperience
      return b.rating - a.rating || b.reviewCount - a.reviewCount
    })
  }, [contractors, authUser, query, near, scope, sort])

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground text-balance">
          Find contractors
        </h1>
        <p className="text-muted-foreground">Browse local pros, compare reviews and request a quote.</p>
      </header>

      <div className="mt-6 flex flex-col gap-3 lg:flex-row">
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
            placeholder="Search by name, trade or skill"
            className="pl-10"
            aria-label="Search contractors"
          />
        </div>
        <div className="relative lg:w-56">
          <MapPin
            width={18}
            height={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={near}
            onChange={(e) => setNearInput(e.target.value)}
            placeholder="City, state"
            className="pl-10"
            aria-label="Location"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:flex">
          <Select value={scope} onValueChange={(v) => setScopeInput((v ?? "anywhere") as LocationScope)}>
            <SelectTrigger className="w-full lg:w-36" aria-label="How far">
              <SelectValue>{(v: LocationScope) => scopeLabels[v]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="city">Same city</SelectItem>
              <SelectItem value="state">Same state</SelectItem>
              <SelectItem value="anywhere">Anywhere</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort((v ?? "rating") as SortKey)}>
            <SelectTrigger className="w-full lg:w-40" aria-label="Sort by">
              <SelectValue>{(v: SortKey) => sortLabels[v]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rating">Top rated</SelectItem>
              <SelectItem value="reviews">Most reviews</SelectItem>
              <SelectItem value="experience">Most experience</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        {filtered.length} {filtered.length === 1 ? "contractor" : "contractors"}
        {scope !== "anywhere" && near.trim() ? ` near ${near.trim()}` : ""}
      </p>

      {contractorsLoading && contractors.length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">Loading contractors…</p>
      ) : filtered.length === 0 ? (
        <Empty className="mt-8">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MapPin />
            </EmptyMedia>
            <EmptyTitle>No contractors found</EmptyTitle>
            <EmptyDescription>
              {scope === "city" ? "Try searching your whole state." : "Try a different search or location."}
            </EmptyDescription>
          </EmptyHeader>
          {scope !== "anywhere" && (
            <Button variant="outline" onClick={() => setScopeInput(scope === "city" ? "state" : "anywhere")}>
              {scope === "city" ? "Search my state" : "Search everywhere"}
            </Button>
          )}
        </Empty>
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <ContractorCard key={c.contractorId} contractor={c} />
          ))}
        </div>
      )}
    </div>
  )
}

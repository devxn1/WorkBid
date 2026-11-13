"use client"

import { useState } from "react"
import { Sparkles } from "lucide-react"
import { generateClient } from "aws-amplify/data"
import type { Schema } from "@/amplify/data/resource"
import { orThrow } from "@/lib/proposals"
import { formatCurrency } from "@/lib/format"
import { Button } from "@/components/ui/button"

type Suggestion = { low: number; high: number; explanation: string }

/** "Suggest a price range" button under the budget fields. Asks the server (Claude) for a range. */
export function PriceSuggestion({
  details,
  onUse,
}: {
  details: { categoryId: string; title: string; description: string; location: string; timeline: string }
  onUse: (low: number, high: number) => void
}) {
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const ready = !!details.categoryId && !!details.title.trim() && details.description.trim().length >= 20

  async function handleSuggest() {
    setError("")
    setLoading(true)
    try {
      const client = generateClient<Schema>()
      const result = orThrow(
        await client.queries.suggestPriceRange({
          categoryId: details.categoryId,
          title: details.title.trim(),
          description: details.description.trim(),
          location: details.location.trim(),
          timeline: details.timeline.trim() || null,
        }),
        "Couldn't get a price suggestion.",
      )
      setSuggestion(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't get a price suggestion.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="sm" onClick={handleSuggest} disabled={!ready || loading}>
          <Sparkles data-icon="inline-start" aria-hidden="true" />
          {loading ? "Thinking…" : suggestion ? "Suggest again" : "Suggest a price range"}
        </Button>
        {!ready && (
          <span className="text-xs text-muted-foreground">
            Pick a category and add a title and description first.
          </span>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {suggestion && (
        <div className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 p-4" aria-live="polite">
          <p className="text-sm text-muted-foreground">Suggested range</p>
          <p className="font-heading text-xl font-semibold text-foreground">
            {formatCurrency(suggestion.low)} – {formatCurrency(suggestion.high)}
          </p>
          <p className="text-sm text-muted-foreground">{suggestion.explanation}</p>
          <p className="text-xs text-muted-foreground">
            Based on your details and typical prices in your area. AI estimate, so actual bids can differ.
          </p>
          <Button type="button" size="sm" className="w-fit" onClick={() => onUse(suggestion.low, suggestion.high)}>
            Use this range
          </Button>
        </div>
      )}
    </div>
  )
}

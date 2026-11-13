import Anthropic from "@anthropic-ai/sdk"
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod"
import { z } from "zod"
import { Amplify } from "aws-amplify"
import { generateClient } from "aws-amplify/data"
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime"
import { env } from "$amplify/env/price-suggest"
import type { Schema } from "../../data/resource"

// Same database setup as bid-actions (see the note there about the Auth placeholder).
const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env)
Amplify.configure(
  {
    ...resourceConfig,
    Auth: {
      Cognito: { identityPoolId: `${env.AWS_REGION}:00000000-0000-0000-0000-000000000000`, allowGuestAccess: true },
    },
  },
  libraryOptions,
)
const db = generateClient<Schema>()
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })

const categoryNames: Record<string, string> = {
  remodeling: "Remodeling",
  electrical: "Electrical",
  plumbing: "Plumbing",
  painting: "Painting",
  landscaping: "Landscaping",
  roofing: "Roofing",
  flooring: "Flooring",
  general: "General Contracting",
}

const Suggestion = z.object({
  low: z.number().describe("Low end of a fair total price in US dollars, whole number"),
  high: z.number().describe("High end of a fair total price in US dollars, whole number"),
  explanation: z.string().describe("Two or three short sentences for the client on what drives the price"),
})

const SYSTEM = `You help homeowners on WorkBid, a marketplace where clients post home projects and contractors bid on them. Given a project the client is about to post, suggest a realistic total price range (labor plus materials, in US dollars) they should expect contractors to bid.

Base it on typical US contractor pricing for the location given, the scope described, and any past WorkBid jobs listed (those are real accepted prices, so weigh them when they're similar). Keep the range honest and reasonably tight: wide enough to cover normal variation, not so wide it's useless. If the description is vague, say in the explanation what detail would narrow it down.

The explanation is shown directly to the client: plain language, no markdown, no headings, at most three sentences.`

type Comparable = { title: string; amount: number; location: string }

/** Up to 10 recent hired/finished WorkBid jobs in this category, with the agreed price. */
async function comparables(categoryId: string): Promise<Comparable[]> {
  const projects: Schema["Project"]["type"][] = []
  for (const status of ["completed", "in_progress", "awarded"] as const) {
    const { data } = await db.models.Project.listProjectByStatus({ status }, { limit: 200 })
    projects.push(...data.filter((p) => p.categoryId === categoryId))
  }
  projects.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))

  const out: Comparable[] = []
  for (const p of projects.slice(0, 10)) {
    const { data } = await db.models.Agreement.listAgreementByProjectId({ projectId: p.id })
    if (data[0]) out.push({ title: p.title, amount: data[0].amount, location: p.location })
  }
  return out
}

export const handler: Schema["suggestPriceRange"]["functionHandler"] = async (event) => {
  const { categoryId, title, description, location, timeline } = event.arguments
  if (!categoryNames[categoryId]) throw new Error("Pick a category first.")
  if (!title.trim() || description.trim().length < 20) {
    throw new Error("Add a title and a description (20+ characters) to get a suggestion.")
  }

  const past = await comparables(categoryId)
  const pastText = past.length
    ? past.map((c) => `- "${c.title}" in ${c.location}: $${Math.round(c.amount)}`).join("\n")
    : "None yet in this category."

  const prompt = `Project to price:
Category: ${categoryNames[categoryId]}
Title: ${title.slice(0, 200)}
Location: ${location.slice(0, 200) || "Not given"}
Timeline: ${timeline?.slice(0, 200) || "Not given"}
Description:
${description.slice(0, 4000)}

Past WorkBid jobs in this category (agreed price):
${pastText}`

  let response
  try {
    response = await anthropic.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      output_config: { effort: "low", format: betaZodOutputFormat(Suggestion) },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    })
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) throw new Error("Too many suggestions right now. Try again in a minute.")
    if (err instanceof Anthropic.AuthenticationError) {
      console.error("Anthropic API key is missing or invalid")
      throw new Error("Price suggestions aren't set up yet.")
    }
    if (err instanceof Anthropic.APIError) {
      console.error("Anthropic API error", err.status, err.message)
      throw new Error("Couldn't get a price suggestion. Try again.")
    }
    throw err
  }

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error("Couldn't suggest a price for this description. Try rewording it.")
  }

  const { low, high, explanation } = response.parsed_output
  const lo = Math.max(1, Math.round(Math.min(low, high)))
  const hi = Math.max(lo, Math.round(Math.max(low, high)))
  return { low: lo, high: hi, explanation: explanation.trim(), comparableCount: past.length }
}

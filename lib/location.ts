// Locations are free text like "Atlanta, GA". These helpers compare them by city and state.

const STATES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO",
  connecticut: "CT", delaware: "DE", "district of columbia": "DC", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY",
  louisiana: "LA", maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN",
  mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH",
  "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND",
  ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI",
  "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
}
const ABBREVIATIONS = new Set(Object.values(STATES))

/** A state name or abbreviation as its two-letter code, e.g. "Georgia" or "ga" → "GA". */
function toState(text: string) {
  const t = text.trim().toLowerCase().replace(/\.$/, "")
  if (STATES[t]) return STATES[t]
  return ABBREVIATIONS.has(t.toUpperCase()) ? t.toUpperCase() : ""
}

/** Splits "Atlanta, GA 30303" into { city: "atlanta", state: "GA" }. Either part may be empty. */
export function parseLocation(text: string) {
  const parts = text
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length === 0) return { city: "", state: "" }
  // The last part may hold a ZIP code after the state ("GA 30303").
  const lastPart = parts[parts.length - 1].replace(/\s*\d{5}(-\d{4})?$/, "")
  const state = toState(lastPart)
  if (parts.length === 1) return state ? { city: "", state } : { city: lastPart.toLowerCase(), state: "" }
  return { city: parts[parts.length - 2].toLowerCase(), state }
}

export type LocationScope = "city" | "state" | "anywhere"

/** Whether `location` is in the same city (or state) as `near`. */
export function isNear(location: string, near: string, scope: LocationScope) {
  if (scope === "anywhere" || !near.trim()) return true
  const a = parseLocation(location)
  const b = parseLocation(near)
  // Different states never match, if both have one.
  if (a.state && b.state && a.state !== b.state) return false
  if (scope === "state") return b.state ? a.state === b.state : !!b.city && a.city === b.city
  return !!b.city && a.city === b.city
}

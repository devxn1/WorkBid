"use client"

import { useCallback, useEffect, useState } from "react"
import { generateClient } from "aws-amplify/data"
import type { Schema } from "@/amplify/data/resource"
import { formatCurrency, formatDay } from "./format"
import type { Agreement, BidVersion, ChangeOrder, ProposalTerms } from "./types"

type BidVersionRow = Schema["BidVersion"]["type"]
type AgreementRow = Schema["Agreement"]["type"]
type ChangeOrderRow = Schema["ChangeOrder"]["type"]

/** What a contractor fills in when placing or revising a bid (sent to placeBid / reviseBid). */
export interface ProposalInput {
  amount: number
  scope: string
  estimatedDays: number
  startDate: string
  paymentTerms: string
  materialsCost: number | null
  laborCost: number | null
  materialsDetail: string | null
  included: string[]
  excluded: string[]
  notes: string | null
}

/** Today as YYYY-MM-DD in the user's time zone (the earliest allowed start date). */
export function todayLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/**
 * The terms of an earlier version, ready to send again with reviseBid so it becomes the
 * current offer. Returns a reason instead when it can't be sent as-is.
 */
export function restoreInput(version: BidVersion): ProposalInput | string {
  if (!version.startDate || !version.paymentTerms) {
    return "It's missing a start date or payment terms. You'll add them before it's sent."
  }
  if (version.startDate < todayLocal()) return "Its start date has passed. You'll pick a new one before it's sent."
  return {
    amount: version.amount,
    scope: version.scope,
    estimatedDays: version.estimatedDays,
    startDate: version.startDate,
    paymentTerms: version.paymentTerms,
    materialsCost: version.materialsCost ?? null,
    laborCost: version.laborCost ?? null,
    materialsDetail: version.materialsDetail ?? null,
    included: version.included,
    excluded: version.excluded,
    notes: version.notes ?? null,
  }
}

function strings(list: (string | null)[] | null | undefined) {
  return (list ?? []).filter((x): x is string => !!x)
}

function toTerms(row: BidVersionRow | AgreementRow): ProposalTerms {
  return {
    amount: row.amount,
    scope: row.scope,
    estimatedDays: row.estimatedDays,
    startDate: row.startDate ?? undefined,
    paymentTerms: row.paymentTerms ?? undefined,
    materialsCost: row.materialsCost ?? undefined,
    laborCost: row.laborCost ?? undefined,
    materialsDetail: row.materialsDetail ?? undefined,
    included: strings(row.included),
    excluded: strings(row.excluded),
    notes: row.notes ?? undefined,
  }
}

export function toBidVersion(row: BidVersionRow): BidVersion {
  return {
    ...toTerms(row),
    versionId: row.id,
    bidId: row.bidId,
    version: row.version,
    status: row.status ?? "active",
    changeSummary: row.changeSummary ?? undefined,
    createdAt: row.createdAt,
  }
}

export function toAgreement(row: AgreementRow): Agreement {
  return {
    ...toTerms(row),
    agreementId: row.id,
    projectId: row.projectId,
    projectTitle: row.projectTitle,
    bidId: row.bidId,
    bidVersionId: row.bidVersionId,
    version: row.version,
    clientId: row.clientId,
    clientName: row.clientName,
    contractorId: row.contractorId,
    contractorName: row.contractorName,
    businessName: row.businessName ?? undefined,
    confirmedAt: row.confirmedAt,
  }
}

function toChangeOrder(row: ChangeOrderRow): ChangeOrder {
  return {
    changeOrderId: row.id,
    agreementId: row.agreementId,
    proposedBy: row.proposedBy,
    description: row.description,
    amountChange: row.amountChange,
    daysChange: row.daysChange,
    status: row.status ?? "proposed",
    createdAt: row.createdAt,
    respondedAt: row.respondedAt ?? undefined,
  }
}

/** The required agreement terms a proposal is missing (empty when it can be confirmed). Matches the server. */
export function missingTerms(terms: ProposalTerms) {
  const missing: string[] = []
  if (!(terms.amount > 0)) missing.push("price")
  if (!terms.scope?.trim()) missing.push("scope of work")
  if (!terms.startDate) missing.push("start date")
  if (!(terms.estimatedDays > 0)) missing.push("estimated duration")
  if (!terms.paymentTerms?.trim()) missing.push("payment terms")
  return missing
}

export interface TermChange {
  label: string
  before: string
  after: string
}

/** Each term that differs between two versions, as readable text. */
export function diffTerms(before: ProposalTerms, after: ProposalTerms): TermChange[] {
  const money = (v?: number) => (v == null ? "—" : formatCurrency(v))
  const text = (v?: string) => v?.trim() || "—"
  const list = (v: string[]) => (v.length ? v.join(", ") : "—")
  const fields: [string, string, string][] = [
    ["Price", money(before.amount), money(after.amount)],
    ["Start date", before.startDate ? formatDay(before.startDate) : "—", after.startDate ? formatDay(after.startDate) : "—"],
    ["Duration", `${before.estimatedDays} days`, `${after.estimatedDays} days`],
    ["Scope of work", text(before.scope), text(after.scope)],
    ["Materials cost", money(before.materialsCost), money(after.materialsCost)],
    ["Labor cost", money(before.laborCost), money(after.laborCost)],
    ["Materials", text(before.materialsDetail), text(after.materialsDetail)],
    ["Included", list(before.included), list(after.included)],
    ["Not included", list(before.excluded), list(after.excluded)],
    ["Payment terms", text(before.paymentTerms), text(after.paymentTerms)],
    ["Notes", text(before.notes), text(after.notes)],
  ]
  return fields.filter(([, a, b]) => a !== b).map(([label, a, b]) => ({ label, before: a, after: b }))
}

/** Generic loader: runs `load` when `key` changes and exposes data, loading, error and reload. */
function useLoader<T>(key: string | undefined, load: (key: string) => Promise<T>) {
  const [state, setState] = useState<{ key?: string; data?: T; error?: string }>({})
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!key) return
    let cancelled = false
    load(key)
      .then((data) => !cancelled && setState({ key, data }))
      .catch((err) => !cancelled && setState({ key, error: err instanceof Error ? err.message : String(err) }))
    return () => {
      cancelled = true
    }
    // `load` is left out on purpose: callers pass a new arrow each render, and `key` already
    // identifies what to load.
  }, [key, version])

  const reload = useCallback(() => setVersion((v) => v + 1), [])
  const current = state.key === key
  return {
    data: current ? state.data : undefined,
    error: current ? state.error : undefined,
    loading: !!key && !current,
    reload,
  }
}

async function loadVersions(bidId: string) {
  const client = generateClient<Schema>()
  const { data, errors } = await client.models.BidVersion.listBidVersionByBidIdAndVersion(
    { bidId },
    { sortDirection: "DESC", limit: 1000 },
  )
  if (errors?.length) throw new Error(errors[0].message)
  return data.map(toBidVersion)
}

async function loadAgreement(projectId: string) {
  const client = generateClient<Schema>()
  const { data, errors } = await client.models.Agreement.listAgreementByProjectId({ projectId })
  if (errors?.length) throw new Error(errors[0].message)
  return data[0] ? toAgreement(data[0]) : null
}

async function loadChangeOrders(projectId: string) {
  const client = generateClient<Schema>()
  const { data, errors } = await client.models.ChangeOrder.listChangeOrderByProjectId({ projectId }, { limit: 1000 })
  if (errors?.length) throw new Error(errors[0].message)
  return data.map(toChangeOrder).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/** A bid's proposal versions, newest first. Pass `refreshKey` (e.g. the bid's current version) to reload on change. */
export function useBidVersions(bidId: string | undefined, refreshKey?: string | number) {
  return useLoader(bidId ? `${bidId}:${refreshKey ?? ""}` : undefined, (key) => loadVersions(key.split(":")[0]))
}

/** The project's confirmed agreement (null if none, or if you're not one of its two parties). */
export function useAgreement(projectId: string | undefined, refreshKey?: string) {
  return useLoader(projectId ? `${projectId}:${refreshKey ?? ""}` : undefined, (key) => loadAgreement(key.split(":")[0]))
}

export function useChangeOrders(projectId: string | undefined) {
  return useLoader(projectId, loadChangeOrders)
}

/** Throws a data call's first error (or `fallback` if there's no data), otherwise returns the data. */
export function orThrow<T>(result: { data: T; errors?: { message: string }[] }, fallback: string): NonNullable<T> {
  const message = result.errors?.[0]?.message
  // Amplify's wording when this tab's login is gone (e.g. signed out in another tab).
  if (message === "No current user") throw new Error("You've been signed out. Please sign in again and retry.")
  if (result.errors?.length || result.data == null) throw new Error(message ?? fallback)
  return result.data as NonNullable<T>
}

export async function proposeChangeOrder(agreementId: string, description: string, amountChange: number, daysChange: number) {
  const client = generateClient<Schema>()
  return orThrow(
    await client.mutations.proposeChangeOrder({ agreementId, description, amountChange, daysChange }),
    "Couldn't propose the change.",
  )
}

export async function respondToChangeOrder(changeOrderId: string, approve: boolean) {
  const client = generateClient<Schema>()
  return orThrow(await client.mutations.respondToChangeOrder({ changeOrderId, approve }), "Couldn't answer the change order.")
}

"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Separator } from "@/components/ui/separator"
import { todayLocal, type ProposalInput } from "@/lib/proposals"
import type { ProposalTerms } from "@/lib/types"

/** "" -> null, otherwise a number (NaN if not a number). */
function optionalNumber(value: string) {
  return value.trim() === "" ? null : Number(value)
}

function lines(value: string) {
  return value
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
}

interface ProposalFormProps {
  /** The version being revised (leave out when placing a new bid). */
  initial?: ProposalTerms
  /** Pre-fills "What changed?" (e.g. when going back to an earlier version). */
  initialChangeSummary?: string
  isRevision: boolean
  cancelHref: string
  /** Saves the proposal. Throw an Error to show its message under the form. */
  onSubmit: (input: ProposalInput, changeSummary: string) => Promise<void>
}

/** The full proposal form: price, scope, schedule, costs, inclusions and terms. */
export function ProposalForm({ initial, initialChangeSummary, isRevision, cancelHref, onSubmit }: ProposalFormProps) {
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "")
  const [startDate, setStartDate] = useState(initial?.startDate ?? "")
  const [days, setDays] = useState(initial ? String(initial.estimatedDays) : "")
  const [scope, setScope] = useState(initial?.scope ?? "")
  const [materialsCost, setMaterialsCost] = useState(initial?.materialsCost != null ? String(initial.materialsCost) : "")
  const [laborCost, setLaborCost] = useState(initial?.laborCost != null ? String(initial.laborCost) : "")
  const [materialsDetail, setMaterialsDetail] = useState(initial?.materialsDetail ?? "")
  const [included, setIncluded] = useState(initial?.included.join("\n") ?? "")
  const [excluded, setExcluded] = useState(initial?.excluded.join("\n") ?? "")
  const [paymentTerms, setPaymentTerms] = useState(initial?.paymentTerms ?? "")
  const [notes, setNotes] = useState(initial?.notes ?? "")
  const [changeSummary, setChangeSummary] = useState(initialChangeSummary ?? "")
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const minStart = todayLocal()
  const problems = {
    amount: !(Number(amount) > 0) ? "Enter a price greater than $0." : "",
    startDate: !startDate ? "Pick a start date." : startDate < minStart ? "The start date can't be in the past." : "",
    days:
      !Number.isInteger(Number(days)) || Number(days) < 1 || Number(days) > 3650
        ? "Enter a whole number of days (1–3650)."
        : "",
    scope: scope.trim().length < 10 ? "Describe the work (at least 10 characters)." : "",
    materialsCost: Number(optionalNumber(materialsCost) ?? 0) >= 0 ? "" : "Enter $0 or more.",
    laborCost: Number(optionalNumber(laborCost) ?? 0) >= 0 ? "" : "Enter $0 or more.",
    paymentTerms: paymentTerms.trim().length < 3 ? "Add payment terms." : "",
    changeSummary: isRevision && changeSummary.trim().length < 5 ? "Briefly say what changed." : "",
  }
  const show = (key: keyof typeof problems) => (submitted && problems[key] ? problems[key] : "")

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitted(true)
    if (Object.values(problems).some(Boolean)) return
    setError("")
    setSaving(true)
    try {
      await onSubmit(
        {
          amount: Number(amount),
          startDate,
          estimatedDays: Number(days),
          scope: scope.trim(),
          materialsCost: optionalNumber(materialsCost),
          laborCost: optionalNumber(laborCost),
          materialsDetail: materialsDetail.trim() || null,
          included: lines(included),
          excluded: lines(excluded),
          paymentTerms: paymentTerms.trim(),
          notes: notes.trim() || null,
        },
        changeSummary.trim(),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your proposal. Please try again.")
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        {isRevision && (
          <Field data-invalid={show("changeSummary") ? true : undefined}>
            <FieldLabel htmlFor="change-summary">What changed?</FieldLabel>
            <Input
              id="change-summary"
              value={changeSummary}
              onChange={(e) => setChangeSummary(e.target.value)}
              placeholder="e.g. Added railing replacement as we discussed"
              aria-invalid={show("changeSummary") ? true : undefined}
            />
            <FieldDescription>The client sees this next to a side-by-side comparison with your last version.</FieldDescription>
            {show("changeSummary") && <FieldError>{show("changeSummary")}</FieldError>}
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <Field data-invalid={show("amount") ? true : undefined}>
            <FieldLabel htmlFor="amount">Total price ($)</FieldLabel>
            <Input
              id="amount"
              type="number"
              min={0}
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="4500"
              aria-invalid={show("amount") ? true : undefined}
            />
            {show("amount") && <FieldError>{show("amount")}</FieldError>}
          </Field>
          <Field data-invalid={show("startDate") ? true : undefined}>
            <FieldLabel htmlFor="start-date">Proposed start</FieldLabel>
            <Input
              id="start-date"
              type="date"
              min={minStart}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              aria-invalid={show("startDate") ? true : undefined}
            />
            {show("startDate") && <FieldError>{show("startDate")}</FieldError>}
          </Field>
          <Field data-invalid={show("days") ? true : undefined}>
            <FieldLabel htmlFor="days">Duration (days)</FieldLabel>
            <Input
              id="days"
              type="number"
              min={1}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              placeholder="10"
              aria-invalid={show("days") ? true : undefined}
            />
            {show("days") && <FieldError>{show("days")}</FieldError>}
          </Field>
        </div>

        <Field data-invalid={show("scope") ? true : undefined}>
          <FieldLabel htmlFor="scope">Scope of work</FieldLabel>
          <Textarea
            id="scope"
            rows={5}
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            placeholder="Describe exactly what you'll do: the work, your approach, and the result the client gets."
            aria-invalid={show("scope") ? true : undefined}
          />
          {show("scope") && <FieldError>{show("scope")}</FieldError>}
        </Field>

        <Separator />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={show("materialsCost") ? true : undefined}>
            <FieldLabel htmlFor="materials-cost">Materials cost ($, optional)</FieldLabel>
            <Input
              id="materials-cost"
              type="number"
              min={0}
              step="any"
              value={materialsCost}
              onChange={(e) => setMaterialsCost(e.target.value)}
              aria-invalid={show("materialsCost") ? true : undefined}
            />
            {show("materialsCost") && <FieldError>{show("materialsCost")}</FieldError>}
          </Field>
          <Field data-invalid={show("laborCost") ? true : undefined}>
            <FieldLabel htmlFor="labor-cost">Labor cost ($, optional)</FieldLabel>
            <Input
              id="labor-cost"
              type="number"
              min={0}
              step="any"
              value={laborCost}
              onChange={(e) => setLaborCost(e.target.value)}
              aria-invalid={show("laborCost") ? true : undefined}
            />
            {show("laborCost") && <FieldError>{show("laborCost")}</FieldError>}
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="materials-detail">Materials (optional)</FieldLabel>
          <Textarea
            id="materials-detail"
            rows={2}
            value={materialsDetail}
            onChange={(e) => setMaterialsDetail(e.target.value)}
            placeholder="e.g. Pressure-treated pine decking, exterior acrylic paint"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="included">Included</FieldLabel>
            <Textarea
              id="included"
              rows={4}
              value={included}
              onChange={(e) => setIncluded(e.target.value)}
              placeholder={"Demolition and haul-away\nNew flooring\nTwo coats of paint"}
            />
            <FieldDescription>One item per line.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="excluded">Not included</FieldLabel>
            <Textarea
              id="excluded"
              rows={4}
              value={excluded}
              onChange={(e) => setExcluded(e.target.value)}
              placeholder={"Permit fees\nStructural repairs"}
            />
            <FieldDescription>One item per line.</FieldDescription>
          </Field>
        </div>

        <Field data-invalid={show("paymentTerms") ? true : undefined}>
          <FieldLabel htmlFor="payment-terms">Payment terms</FieldLabel>
          <Input
            id="payment-terms"
            value={paymentTerms}
            onChange={(e) => setPaymentTerms(e.target.value)}
            placeholder="e.g. 30% deposit, remainder on completion"
            aria-invalid={show("paymentTerms") ? true : undefined}
          />
          <FieldDescription>Agreed terms only. WorkBid doesn&apos;t process payments.</FieldDescription>
          {show("paymentTerms") && <FieldError>{show("paymentTerms")}</FieldError>}
        </Field>

        <Field>
          <FieldLabel htmlFor="notes">Notes and assumptions (optional)</FieldLabel>
          <Textarea
            id="notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Assumes the existing joists are sound. Client provides access to water and power."
          />
        </Field>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" render={<Link href={cancelHref} />}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Sending…" : isRevision ? "Send revised proposal" : "Submit bid"}
          </Button>
        </div>
      </FieldGroup>
    </form>
  )
}

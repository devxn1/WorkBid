"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Check, FilePlus2, FileSignature, X } from "lucide-react"
import { proposeChangeOrder, respondToChangeOrder, useAgreement, useChangeOrders } from "@/lib/proposals"
import { formatChange, formatCurrency, formatDate, formatDay, relativeTime } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ProposalTermsView } from "./proposal-terms"
import type { Agreement, ChangeOrder, Project } from "@/lib/types"

const changeStatusLabels: Record<ChangeOrder["status"], string> = {
  proposed: "Awaiting approval",
  approved: "Approved",
  declined: "Declined",
}

/** The confirmed agreement and its change orders, for the client and the hired contractor. */
export function AgreementPanel({ project, viewerId }: { project: Project; viewerId: string }) {
  const { data: agreement, loading, error } = useAgreement(project.projectId, project.status)
  const changeOrders = useChangeOrders(agreement ? project.projectId : undefined)

  if (loading) return <p className="text-sm text-muted-foreground">Loading agreement…</p>
  if (error) return <p className="text-sm text-destructive">Couldn&apos;t load the agreement: {error}</p>
  if (!agreement) return null

  const orders = changeOrders.data ?? []
  const approved = orders.filter((o) => o.status === "approved")
  const total = agreement.amount + approved.reduce((sum, o) => sum + o.amountChange, 0)
  const days = agreement.estimatedDays + approved.reduce((sum, o) => sum + o.daysChange, 0)
  const active = project.status === "awarded" || project.status === "in_progress"

  return (
    <div className="flex flex-col gap-6">
      <Card className="border-primary/30">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileSignature className="size-4 text-primary" aria-hidden="true" />
              Agreement
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {agreement.clientName} hired {agreement.businessName ?? agreement.contractorName} · Confirmed{" "}
              {formatDate(agreement.confirmedAt)} · Based on proposal version {agreement.version}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{approved.length ? "Current total" : "Agreed price"}</p>
            <p className="font-heading text-2xl font-bold text-foreground">{formatCurrency(total)}</p>
            <p className="text-xs text-muted-foreground">
              {days} days{agreement.startDate ? ` from ${formatDay(agreement.startDate)}` : ""}
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <details>
            <summary className="cursor-pointer text-sm font-medium text-primary">View the agreed terms</summary>
            <div className="mt-4">
              <ProposalTermsView terms={agreement} />
            </div>
          </details>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-heading text-lg font-semibold text-foreground">Change orders</h2>
            <p className="text-sm text-muted-foreground">
              The agreement never changes. Changes are added here once both of you approve them.
            </p>
          </div>
          {active && (
            <ProposeChangeDialog
              agreement={agreement}
              currentTotal={total}
              onProposed={changeOrders.reload}
            />
          )}
        </div>
        {changeOrders.error && <p className="text-sm text-destructive">{changeOrders.error}</p>}
        {orders.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            No change orders yet.
          </p>
        ) : (
          orders.map((order) => (
            <ChangeOrderRow
              key={order.changeOrderId}
              order={order}
              agreement={agreement}
              viewerId={viewerId}
              canRespond={active}
              onChanged={changeOrders.reload}
            />
          ))
        )}
      </section>
    </div>
  )
}

function ChangeOrderRow({
  order,
  agreement,
  viewerId,
  canRespond,
  onChanged,
}: {
  order: ChangeOrder
  agreement: Agreement
  viewerId: string
  canRespond: boolean
  onChanged: () => void
}) {
  const [working, setWorking] = useState(false)
  const proposer =
    order.proposedBy === viewerId
      ? "You"
      : order.proposedBy === agreement.clientId
        ? agreement.clientName
        : (agreement.businessName ?? agreement.contractorName)
  const awaitingMe = order.status === "proposed" && order.proposedBy !== viewerId && canRespond

  async function respond(approve: boolean) {
    setWorking(true)
    try {
      await respondToChangeOrder(order.changeOrderId, approve)
      toast.success(approve ? "Change order approved" : "Change order declined")
      onChanged()
    } catch (err) {
      toast.error("Couldn't answer the change order", { description: err instanceof Error ? err.message : undefined })
      onChanged()
    } finally {
      setWorking(false)
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={order.status === "approved" ? "default" : order.status === "declined" ? "secondary" : "outline"}>
            {changeStatusLabels[order.status]}
          </Badge>
          <span className="text-sm font-medium text-foreground">
            {order.amountChange !== 0 && formatChange(order.amountChange)}
            {order.amountChange !== 0 && order.daysChange !== 0 && " · "}
            {order.daysChange !== 0 && `${order.daysChange > 0 ? "+" : "−"}${Math.abs(order.daysChange)} days`}
            {order.amountChange === 0 && order.daysChange === 0 && "No price or schedule change"}
          </span>
          <span className="ml-auto text-xs text-muted-foreground">
            {proposer} · {relativeTime(order.createdAt)}
          </span>
        </div>
        <p className="whitespace-pre-line text-sm text-muted-foreground">{order.description}</p>
        {awaitingMe && (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => respond(true)} disabled={working}>
              <Check data-icon="inline-start" />
              Approve
            </Button>
            <Button size="sm" variant="outline" onClick={() => respond(false)} disabled={working}>
              <X data-icon="inline-start" />
              Decline
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ProposeChangeDialog({
  agreement,
  currentTotal,
  onProposed,
}: {
  agreement: Agreement
  currentTotal: number
  onProposed: () => void
}) {
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState("")
  const [amountChange, setAmountChange] = useState("0")
  const [daysChange, setDaysChange] = useState("0")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const amount = Number(amountChange)
  const days = Number(daysChange)
  const valid =
    description.trim().length >= 5 &&
    Number.isFinite(amount) &&
    Number.isInteger(days) &&
    currentTotal + amount > 0

  async function handleSubmit() {
    if (!valid) return
    setError("")
    setSaving(true)
    try {
      await proposeChangeOrder(agreement.agreementId, description.trim(), amount, days)
      toast.success("Change order proposed", { description: "The other party was notified to approve it." })
      setDescription("")
      setAmountChange("0")
      setDaysChange("0")
      setOpen(false)
      onProposed()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't propose the change.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <FilePlus2 data-icon="inline-start" />
            Propose change
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Propose a change order</DialogTitle>
          <DialogDescription>
            The other party has to approve it. Current total: {formatCurrency(currentTotal)}.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="co-description">What&apos;s changing?</FieldLabel>
            <Textarea
              id="co-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              placeholder="e.g. Add a second coat of stain to the porch steps"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="co-amount">Price change ($)</FieldLabel>
              <Input id="co-amount" type="number" step="any" value={amountChange} onChange={(e) => setAmountChange(e.target.value)} />
              <FieldDescription>Negative to reduce.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="co-days">Schedule change (days)</FieldLabel>
              <Input id="co-days" type="number" value={daysChange} onChange={(e) => setDaysChange(e.target.value)} />
              <FieldDescription>Negative to shorten.</FieldDescription>
            </Field>
          </div>
        </FieldGroup>
        {currentTotal + amount <= 0 && (
          <p className="text-sm text-destructive">The total price has to stay above $0.</p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button onClick={handleSubmit} disabled={!valid || saving}>
            {saving ? "Sending…" : "Propose change"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

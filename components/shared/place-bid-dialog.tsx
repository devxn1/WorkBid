"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
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
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { useMarketplace } from "@/lib/store"
import { formatBudget, formatCurrency } from "@/lib/format"
import type { Bid, Project } from "@/lib/types"

interface PlaceBidDialogProps {
  project: Project
  trigger: React.ReactElement
  /** Pass the contractor's existing bid to update its amount/timeline instead of placing a new one. */
  bid?: Bid
}

export function PlaceBidDialog({ project, trigger, bid }: PlaceBidDialogProps) {
  const { addBid, updateBid } = useMarketplace()
  const isUpdate = !!bid
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState("")
  const [days, setDays] = useState("")
  const [message, setMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  // Opening in update mode starts from the bid's current numbers.
  function handleOpenChange(next: boolean) {
    if (next && bid) {
      setAmount(String(bid.amount))
      setDays(String(bid.estimatedDays))
      setError("")
    }
    setOpen(next)
  }

  const changed = !bid || Number(amount) !== bid.amount || Number(days) !== bid.estimatedDays
  const valid =
    Number(amount) > 0 &&
    Number.isInteger(Number(days)) &&
    Number(days) > 0 &&
    (isUpdate ? changed : message.trim().length >= 10)

  async function handleSubmit() {
    if (!valid) return
    setError("")
    setSubmitting(true)
    try {
      if (bid) {
        await updateBid(bid.bidId, { amount: Number(amount), estimatedDays: Number(days) })
      } else {
        await addBid(project.projectId, {
          amount: Number(amount),
          estimatedDays: Number(days),
          proposalMessage: message.trim(),
        })
      }
      setAmount("")
      setDays("")
      setMessage("")
      setOpen(false)
    } catch (err) {
      // e.g. "You already placed a bid on this project." from the server
      setError(err instanceof Error ? err.message : "Couldn't submit your bid.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isUpdate ? "Update your bid" : "Submit your bid"}</DialogTitle>
          <DialogDescription>
            {isUpdate
              ? `Agreed on a different price with the client? Change it here so they can accept the real amount. Current bid: ${formatCurrency(bid.amount)}, ${bid.estimatedDays} days.`
              : `${project.title} · Client budget ${formatBudget(project.budgetMin, project.budgetMax)}`}
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="bid-amount">Bid amount ($)</FieldLabel>
              <Input
                id="bid-amount"
                type="number"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="12000"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="bid-days">Timeline (days)</FieldLabel>
              <Input
                id="bid-days"
                type="number"
                min={1}
                value={days}
                onChange={(e) => setDays(e.target.value)}
                placeholder="14"
              />
            </Field>
          </div>
          {!isUpdate && (
            <Field>
              <FieldLabel htmlFor="bid-message">Proposal message</FieldLabel>
              <Textarea
                id="bid-message"
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Introduce yourself, describe your approach, materials, and what's included in your price."
              />
              <FieldDescription>At least 10 characters. Sell yourself to win the job.</FieldDescription>
            </Field>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </FieldGroup>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button onClick={handleSubmit} disabled={!valid || submitting}>
            {submitting ? (isUpdate ? "Saving…" : "Submitting…") : isUpdate ? "Update bid" : "Submit bid"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

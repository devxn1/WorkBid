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
import { formatBudget } from "@/lib/format"
import type { Project } from "@/lib/types"

interface PlaceBidDialogProps {
  project: Project
  trigger: React.ReactElement
}

export function PlaceBidDialog({ project, trigger }: PlaceBidDialogProps) {
  const { addBid } = useMarketplace()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState("")
  const [days, setDays] = useState("")
  const [message, setMessage] = useState("")

  const valid = Number(amount) > 0 && Number(days) > 0 && message.trim().length >= 10

  function handleSubmit() {
    if (!valid) return
    addBid(project.projectId, {
      amount: Number(amount),
      estimatedDays: Number(days),
      proposalMessage: message.trim(),
    })
    setAmount("")
    setDays("")
    setMessage("")
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Submit your bid</DialogTitle>
          <DialogDescription>
            {project.title} · Client budget {formatBudget(project.budgetMin, project.budgetMax)}
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
        </FieldGroup>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button onClick={handleSubmit} disabled={!valid}>
            Submit bid
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

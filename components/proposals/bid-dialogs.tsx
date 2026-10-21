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
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { useMarketplace } from "@/lib/store"

/** Client asks a contractor to revise their bid, with a note saying what to change. */
export function RequestRevisionDialog({ bidId, trigger }: { bidId: string; trigger: React.ReactElement }) {
  const { requestRevision } = useMarketplace()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const valid = note.trim().length >= 5

  async function handleSubmit() {
    if (!valid) return
    setError("")
    setSaving(true)
    try {
      await requestRevision(bidId, note.trim())
      setNote("")
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't request a revision.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Request a revision</DialogTitle>
          <DialogDescription>
            Tell the contractor what to change. They&apos;ll get a notification, and your note is added to your chat.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="revision-note">What would you like changed?</FieldLabel>
          <Textarea
            id="revision-note"
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={2000}
            placeholder="e.g. Please include replacing the damaged railings and update the price."
          />
          <FieldDescription>Other contractors&apos; bids aren&apos;t affected.</FieldDescription>
        </Field>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button onClick={handleSubmit} disabled={!valid || saving}>
            {saving ? "Sending…" : "Request revision"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface ConfirmActionDialogProps {
  title: string
  description: string
  confirmLabel: string
  workingLabel: string
  destructive?: boolean
  onConfirm: () => Promise<void>
  trigger: React.ReactElement
}

/** "Are you sure?" for actions that can't be undone, like declining or withdrawing a bid. */
export function ConfirmActionDialog({
  title,
  description,
  confirmLabel,
  workingLabel,
  destructive,
  onConfirm,
  trigger,
}: ConfirmActionDialogProps) {
  const [open, setOpen] = useState(false)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState("")

  async function handleConfirm() {
    setError("")
    setWorking(true)
    try {
      await onConfirm()
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.")
    } finally {
      setWorking(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button variant={destructive ? "destructive" : "default"} onClick={handleConfirm} disabled={working}>
            {working ? workingLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

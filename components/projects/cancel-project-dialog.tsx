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

/** Client cancels a project that hasn't hired anyone, with an optional reason for the bidders. */
export function CancelProjectDialog({
  projectId,
  bidCount,
  trigger,
}: {
  projectId: string
  /** Open bids that will be closed. */
  bidCount: number
  trigger: React.ReactElement
}) {
  const { cancelProject } = useMarketplace()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function handleCancel() {
    setError("")
    setSaving(true)
    try {
      await cancelProject(projectId, reason.trim())
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't cancel the project.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cancel this project?</DialogTitle>
          <DialogDescription>
            Contractors won&apos;t be able to bid on it any more
            {bidCount > 0
              ? `, and the ${bidCount === 1 ? "open bid" : `${bidCount} open bids`} will be closed. Everyone who bid gets a notification.`
              : "."}{" "}
            This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="cancel-reason">Reason (optional)</FieldLabel>
          <Textarea
            id="cancel-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={1000}
            placeholder="e.g. We decided to wait until spring."
          />
          <FieldDescription>Shown to the contractors who bid.</FieldDescription>
        </Field>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Keep project</Button>} />
          <Button variant="destructive" onClick={handleCancel} disabled={saving}>
            {saving ? "Cancelling…" : "Cancel project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

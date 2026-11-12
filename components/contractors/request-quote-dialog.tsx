"use client"

import { useState } from "react"
import Link from "next/link"
import { FilePlus2, FolderOpen } from "lucide-react"
import { useMarketplace } from "@/lib/store"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

/**
 * Client asks a contractor for a quote: either on one of their open projects, or with a new
 * private request (a project only this contractor can see and bid on).
 */
export function RequestQuoteDialog({
  contractorId,
  businessName,
  trigger,
}: {
  contractorId: string
  businessName: string
  trigger: React.ReactElement
}) {
  const { authUser, projects, bids, quoteRequests, requestQuote } = useMarketplace()
  const [open, setOpen] = useState(false)
  const [projectId, setProjectId] = useState("")
  const [message, setMessage] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  // Your open public projects they haven't bid on or been asked about yet.
  const eligible = projects.filter(
    (p) =>
      p.clientId === authUser?.userId &&
      p.status === "open" &&
      !p.invitedContractorId &&
      !bids.some((b) => b.projectId === p.projectId && b.contractorId === contractorId && b.status !== "withdrawn") &&
      !quoteRequests.some((q) => q.projectId === p.projectId && q.contractorId === contractorId),
  )
  const titles = Object.fromEntries(eligible.map((p) => [p.projectId, p.title]))

  async function handleSend() {
    if (!projectId) return
    setError("")
    setSaving(true)
    try {
      await requestQuote(projectId, contractorId, message.trim())
      setOpen(false)
      setProjectId("")
      setMessage("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the quote request.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Request a quote from {businessName}</DialogTitle>
          <DialogDescription>They&apos;ll get a notification and can send you a bid.</DialogDescription>
        </DialogHeader>

        <div className="flex gap-3 rounded-lg border border-border p-4">
          <FilePlus2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <div className="flex flex-1 flex-col gap-2">
            <div>
              <p className="font-medium text-foreground">New private request</p>
              <p className="text-sm text-muted-foreground">
                Describe the job just for them. It won&apos;t be listed in Browse, and only they can bid.
              </p>
            </div>
            <Button size="sm" className="w-fit" render={<Link href={`/post-project?for=${contractorId}`} />}>
              Describe the job
            </Button>
          </div>
        </div>

        <div className="flex gap-3 rounded-lg border border-border p-4">
          <FolderOpen className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div>
              <p className="font-medium text-foreground">Invite to a project you already posted</p>
              <p className="text-sm text-muted-foreground">Other contractors can still bid on it too.</p>
            </div>
            {eligible.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                You don&apos;t have an open project to invite them to.
              </p>
            ) : (
              <>
                <Field>
                  <FieldLabel>Project</FieldLabel>
                  <Select value={projectId} onValueChange={(v) => setProjectId(v ?? "")}>
                    <SelectTrigger aria-label="Project">
                      <SelectValue placeholder="Pick a project">{(v: string) => titles[v] ?? "Pick a project"}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {eligible.map((p) => (
                        <SelectItem key={p.projectId} value={p.projectId}>
                          {p.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="quote-message">Message (optional)</FieldLabel>
                  <Textarea
                    id="quote-message"
                    rows={3}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={2000}
                    placeholder="e.g. Saw your deck work and would love a quote on ours."
                  />
                  <FieldDescription>Shown to the contractor with the request.</FieldDescription>
                </Field>
              </>
            )}
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Close</Button>} />
          {eligible.length > 0 && (
            <Button onClick={handleSend} disabled={!projectId || saving}>
              {saving ? "Sending…" : "Send invite"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

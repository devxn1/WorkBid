"use client"

import { useState } from "react"
import { ImageIcon, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { deletePortfolioItem, savePortfolioItem, usePortfolio } from "@/lib/portfolio"
import { formatDay } from "@/lib/format"
import { todayLocal } from "@/lib/proposals"
import type { PortfolioItem } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
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
import { ConfirmActionDialog } from "@/components/proposals/bid-dialogs"
import { PhotoPicker, savedPhotos, uploadPhotos, type Photo } from "@/components/shared/photo-picker"
import { ProjectImage } from "@/components/shared/project-image"

/** "Previous work" on a contractor's own profile page: add, edit and delete portfolio items. */
export function PortfolioManager({ contractorId }: { contractorId: string }) {
  const { items, loading, error, reload } = usePortfolio(contractorId, true)

  async function handleDelete(item: PortfolioItem) {
    await deletePortfolioItem(item)
    reload()
    toast.success("Removed from your portfolio")
  }

  return (
    <Card className="mt-6">
      <CardContent className="flex flex-col gap-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-heading text-lg font-semibold text-foreground">Previous work</h2>
            <p className="text-sm text-muted-foreground">
              Show clients jobs you&apos;ve done. Projects you finish on WorkBid are added automatically.
            </p>
          </div>
          <PortfolioDialog
            contractorId={contractorId}
            onSaved={reload}
            trigger={
              <Button size="sm">
                <Plus data-icon="inline-start" />
                Add work
              </Button>
            }
          />
        </div>

        {loading ? (
          <Skeleton className="h-20 w-full rounded-lg" />
        ) : error ? (
          <p className="text-sm text-destructive">Couldn&apos;t load your portfolio. Refresh to try again.</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing here yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((item) => (
              <li key={item.itemId} className="flex items-center gap-3 rounded-lg border border-border p-3">
                {item.images[0] ? (
                  <ProjectImage src={item.images[0]} alt="" className="size-14 shrink-0 rounded-md object-cover" />
                ) : (
                  <div className="flex size-14 shrink-0 items-center justify-center rounded-md bg-muted">
                    <ImageIcon className="size-5 text-muted-foreground" aria-hidden="true" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{item.title}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {[item.location, item.completedOn && formatDay(item.completedOn), `${item.images.length} photos`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <PortfolioDialog
                  contractorId={contractorId}
                  item={item}
                  onSaved={reload}
                  trigger={
                    <Button size="icon" variant="ghost" aria-label={`Edit ${item.title}`}>
                      <Pencil />
                    </Button>
                  }
                />
                <ConfirmActionDialog
                  title="Remove this work?"
                  description={`"${item.title}" and its photos will be removed from your profile.`}
                  confirmLabel="Remove"
                  workingLabel="Removing…"
                  destructive
                  onConfirm={() => handleDelete(item)}
                  trigger={
                    <Button size="icon" variant="ghost" aria-label={`Remove ${item.title}`}>
                      <Trash2 />
                    </Button>
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

interface PortfolioDialogProps {
  contractorId: string
  /** The item to edit. Leave out to add a new one. */
  item?: PortfolioItem
  onSaved: () => void
  trigger: React.ReactElement
}

function PortfolioDialog({ contractorId, item, onSaved, trigger }: PortfolioDialogProps) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? "Edit work" : "Add previous work"}</DialogTitle>
          <DialogDescription>A job you finished, with photos so clients can see the quality.</DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so the form starts fresh each time. */}
        {open && (
          <PortfolioForm
            contractorId={contractorId}
            item={item}
            onSaved={() => {
              setOpen(false)
              onSaved()
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function PortfolioForm({
  contractorId,
  item,
  onSaved,
}: {
  contractorId: string
  item?: PortfolioItem
  onSaved: () => void
}) {
  const [title, setTitle] = useState(item?.title ?? "")
  const [location, setLocation] = useState(item?.location ?? "")
  const [completedOn, setCompletedOn] = useState(item?.completedOn ?? "")
  const [description, setDescription] = useState(item?.description ?? "")
  const [photos, setPhotos] = useState<Photo[]>(() => savedPhotos(item?.images ?? []))
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const today = todayLocal()
  const dateInvalid = !!completedOn && completedOn > today

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitted(true)
    if (!title.trim() || dateInvalid) return
    setError("")
    setSaving(true)
    try {
      const images = await uploadPhotos(photos, "portfolio-images")
      await savePortfolioItem(
        contractorId,
        {
          title: title.trim(),
          description: description.trim() || null,
          location: location.trim() || null,
          completedOn: completedOn || null,
          images,
        },
        item,
      )
      toast.success(item ? "Work updated" : "Added to your portfolio")
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save this work. Please try again.")
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        <Field data-invalid={submitted && !title.trim() ? true : undefined}>
          <FieldLabel htmlFor="work-title">Title</FieldLabel>
          <Input
            id="work-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="e.g. Backyard deck with built-in benches"
          />
          {submitted && !title.trim() && <FieldError>Please add a title.</FieldError>}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="work-location">Location (optional)</FieldLabel>
            <Input
              id="work-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              maxLength={120}
              placeholder="Decatur, GA"
            />
          </Field>
          <Field data-invalid={dateInvalid ? true : undefined}>
            <FieldLabel htmlFor="work-date">Finished on (optional)</FieldLabel>
            <Input
              id="work-date"
              type="date"
              max={today}
              value={completedOn}
              onChange={(e) => setCompletedOn(e.target.value)}
            />
            {dateInvalid && <FieldError>That date hasn&apos;t happened yet.</FieldError>}
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="work-description">Description (optional)</FieldLabel>
          <Textarea
            id="work-description"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            placeholder="What you did, materials used, how long it took."
          />
        </Field>

        <PhotoPicker photos={photos} onChange={setPhotos} />

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline">Cancel</Button>} />
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </FieldGroup>
    </form>
  )
}

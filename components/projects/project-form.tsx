"use client"

import { useState } from "react"
import Link from "next/link"
import { categories } from "@/lib/mock-data"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CategoryIcon } from "@/components/shared/category-icon"
import { PhotoPicker, savedPhotos, uploadPhotos, type Photo } from "@/components/shared/photo-picker"
import { PriceSuggestion } from "@/components/projects/price-suggestion"

// Stock photo per category, used when the client doesn't upload any. Keys match categoryId in lib/mock-data.ts.
const categoryImages: Record<string, string> = {
  remodeling: "/images/projects/kitchen.png",
  plumbing: "/images/projects/bathroom.png",
  electrical: "/images/projects/electrical.png",
  painting: "/images/projects/painting.png",
  general: "/images/projects/deck.png",
  roofing: "/images/projects/roof.png",
  landscaping: "/images/projects/fence.png",
  flooring: "/images/projects/flooring.png",
}

/** The stock photo used for a category's projects. */
export function stockImageFor(categoryId: string) {
  return categoryImages[categoryId] ?? "/images/projects/painting.png"
}

/** True for a built-in stock photo (as opposed to one the client provided). */
export function isStockImage(src: string) {
  return Object.values(categoryImages).includes(src)
}

export interface ProjectFormValues {
  title: string
  categoryId: string
  location: string
  description: string
  budgetMin: number
  budgetMax: number
  /** When the client wants it done, e.g. "Within 2 weeks" (optional). */
  timeline: string | null
  /** S3 paths of the client's photos, in display order. Empty when they added none. */
  images: string[]
}

interface ProjectFormProps {
  /** Starting values (for editing). Leave out for a blank form. */
  initialValues?: ProjectFormValues
  submitLabel: string
  submittingLabel: string
  cancelHref: string
  disabled?: boolean
  /** Saves the values. Throw an Error to show its message under the form. */
  onSubmit: (values: ProjectFormValues) => Promise<void>
}

/** Project details form shared by the post-project and edit-project pages. */
export function ProjectForm({
  initialValues,
  submitLabel,
  submittingLabel,
  cancelHref,
  disabled,
  onSubmit,
}: ProjectFormProps) {
  const [title, setTitle] = useState(initialValues?.title ?? "")
  const [categoryId, setCategoryId] = useState(initialValues?.categoryId ?? "")
  const [location, setLocation] = useState(initialValues?.location ?? "")
  const [description, setDescription] = useState(initialValues?.description ?? "")
  const [budgetMin, setBudgetMin] = useState(initialValues ? String(initialValues.budgetMin) : "")
  const [budgetMax, setBudgetMax] = useState(initialValues ? String(initialValues.budgetMax) : "")
  const [timeline, setTimeline] = useState(initialValues?.timeline ?? "")
  const [photos, setPhotos] = useState<Photo[]>(() => savedPhotos(initialValues?.images ?? []))
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const min = Number(budgetMin)
  const max = Number(budgetMax)
  const budgetValid = min > 0 && max > 0 && max >= min

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitted(true)
    if (!title.trim() || !categoryId || !location.trim() || description.trim().length < 20 || !budgetValid) return

    setError("")
    setSaving(true)
    try {
      const images = await uploadPhotos(photos, "project-images")
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        categoryId,
        location: location.trim(),
        budgetMin: min,
        budgetMax: max,
        timeline: timeline.trim() || null,
        images,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the project. Please try again.")
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        <Field data-invalid={submitted && !title.trim() ? true : undefined}>
          <FieldLabel htmlFor="title">Project title</FieldLabel>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Kitchen remodel with new cabinets"
            aria-invalid={submitted && !title.trim() ? true : undefined}
          />
          {submitted && !title.trim() && <FieldError>Please add a title.</FieldError>}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={submitted && !categoryId ? true : undefined}>
            <FieldLabel>Category</FieldLabel>
            <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? "")}>
              <SelectTrigger aria-invalid={submitted && !categoryId ? true : undefined}>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.categoryId} value={c.categoryId}>
                    <span className="flex items-center gap-2">
                      <CategoryIcon icon={c.icon} size={15} className="text-muted-foreground" />
                      {c.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {submitted && !categoryId && <FieldError>Pick a category.</FieldError>}
          </Field>

          <Field data-invalid={submitted && !location.trim() ? true : undefined}>
            <FieldLabel htmlFor="location">Location</FieldLabel>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Austin, TX"
              aria-invalid={submitted && !location.trim() ? true : undefined}
            />
            {submitted && !location.trim() && <FieldError>Add a location.</FieldError>}
          </Field>
        </div>

        <Field data-invalid={submitted && description.trim().length < 20 ? true : undefined}>
          <FieldLabel htmlFor="description">Description</FieldLabel>
          <Textarea
            id="description"
            rows={6}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the scope of work, materials, current condition, and any specific requirements."
            aria-invalid={submitted && description.trim().length < 20 ? true : undefined}
          />
          <FieldDescription>Be specific to get accurate bids. At least 20 characters.</FieldDescription>
          {submitted && description.trim().length < 20 && (
            <FieldError>Please add more detail (20+ characters).</FieldError>
          )}
        </Field>

        <Field data-invalid={submitted && !budgetValid ? true : undefined}>
          <FieldLabel>Budget range ($)</FieldLabel>
          <div className="grid grid-cols-2 gap-4">
            <Input
              type="number"
              min={0}
              value={budgetMin}
              onChange={(e) => setBudgetMin(e.target.value)}
              placeholder="Min"
              aria-label="Minimum budget"
              aria-invalid={submitted && !budgetValid ? true : undefined}
            />
            <Input
              type="number"
              min={0}
              value={budgetMax}
              onChange={(e) => setBudgetMax(e.target.value)}
              placeholder="Max"
              aria-label="Maximum budget"
              aria-invalid={submitted && !budgetValid ? true : undefined}
            />
          </div>
          {submitted && !budgetValid && (
            <FieldError>Enter a valid range (max must be at least the min).</FieldError>
          )}
          <PriceSuggestion
            details={{ categoryId, title, description, location, timeline }}
            onUse={(low, high) => {
              setBudgetMin(String(low))
              setBudgetMax(String(high))
            }}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="timeline">Timeline (optional)</FieldLabel>
          <Input
            id="timeline"
            value={timeline}
            onChange={(e) => setTimeline(e.target.value)}
            maxLength={200}
            placeholder="e.g. Within 2 weeks, before June 1, or flexible"
          />
          <FieldDescription>When you&apos;d like the work done. Contractors propose an exact start date in their bids.</FieldDescription>
        </Field>

        <PhotoPicker photos={photos} onChange={setPhotos} />

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" render={<Link href={cancelHref} />}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || disabled}>
            {saving ? submittingLabel : submitLabel}
          </Button>
        </div>
      </FieldGroup>
    </form>
  )
}

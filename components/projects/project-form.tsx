"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { uploadData } from "aws-amplify/storage"
import { ImagePlus, X } from "lucide-react"
import { categories } from "@/lib/mock-data"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CategoryIcon } from "@/components/shared/category-icon"
import { ProjectImage } from "@/components/shared/project-image"

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
  /** S3 paths of the client's photos, in display order. Empty when they added none. */
  images: string[]
}

const MAX_PHOTOS = 5
const MAX_PHOTO_BYTES = 5 * 1024 * 1024
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"]

/** A photo in the form: one already saved (S3 path) or a new file waiting to upload. */
type Photo = { key: string; path: string } | { key: string; file: File; preview: string }

/** Uploads a photo into the signed-in user's own folder and returns its S3 path. */
async function uploadPhoto(file: File) {
  const ext = file.type.split("/")[1] ?? "jpg"
  const { path } = await uploadData({
    path: ({ identityId }) => `project-images/${identityId}/${crypto.randomUUID()}.${ext}`,
    data: file,
    options: { contentType: file.type },
  }).result
  return path
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
  const [photos, setPhotos] = useState<Photo[]>(
    () => initialValues?.images.map((path) => ({ key: path, path })) ?? [],
  )
  const [photoError, setPhotoError] = useState("")
  const fileInput = useRef<HTMLInputElement>(null)
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const min = Number(budgetMin)
  const max = Number(budgetMax)
  const budgetValid = min > 0 && max > 0 && max >= min

  // Free the in-browser previews when the form goes away.
  const photosRef = useRef(photos)
  useEffect(() => {
    photosRef.current = photos
  }, [photos])
  useEffect(
    () => () => photosRef.current.forEach((p) => "preview" in p && URL.revokeObjectURL(p.preview)),
    [],
  )

  function addPhotos(files: FileList | null) {
    if (!files) return
    setPhotoError("")
    const added: Photo[] = []
    for (const file of Array.from(files)) {
      if (photos.length + added.length >= MAX_PHOTOS) {
        setPhotoError(`You can add up to ${MAX_PHOTOS} photos.`)
        break
      }
      if (!PHOTO_TYPES.includes(file.type)) {
        setPhotoError(`${file.name} isn't a JPG, PNG or WebP image.`)
        continue
      }
      if (file.size > MAX_PHOTO_BYTES) {
        setPhotoError(`${file.name} is larger than 5 MB.`)
        continue
      }
      added.push({ key: crypto.randomUUID(), file, preview: URL.createObjectURL(file) })
    }
    setPhotos((prev) => [...prev, ...added])
  }

  function removePhoto(key: string) {
    const photo = photos.find((p) => p.key === key)
    if (photo && "preview" in photo) URL.revokeObjectURL(photo.preview)
    setPhotos((prev) => prev.filter((p) => p.key !== key))
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitted(true)
    if (!title.trim() || !categoryId || !location.trim() || description.trim().length < 20 || !budgetValid) return

    setError("")
    setSaving(true)
    try {
      // Upload new photos first (in order), keeping the ones already saved.
      const images: string[] = []
      for (const photo of photos) {
        images.push("path" in photo ? photo.path : await uploadPhoto(photo.file))
      }
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        categoryId,
        location: location.trim(),
        budgetMin: min,
        budgetMax: max,
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
        </Field>

        <Field data-invalid={photoError ? true : undefined}>
          <FieldLabel>Photos</FieldLabel>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {photos.map((photo, i) => (
              <div key={photo.key} className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
                <ProjectImage
                  src={"path" in photo ? photo.path : photo.preview}
                  alt={`Project photo ${i + 1}`}
                  className="size-full object-cover"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="absolute right-1 top-1 size-7"
                  onClick={() => removePhoto(photo.key)}
                  aria-label={`Remove photo ${i + 1}`}
                >
                  <X />
                </Button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
              >
                <ImagePlus aria-hidden="true" />
                Add photo
              </button>
            )}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept={PHOTO_TYPES.join(",")}
            multiple
            hidden
            onChange={(e) => {
              addPhotos(e.target.files)
              e.target.value = "" // lets the same file be picked again after removing it
            }}
          />
          <FieldDescription>
            Optional. Up to {MAX_PHOTOS} JPG, PNG or WebP photos, 5 MB each. The first photo is the cover.
          </FieldDescription>
          {photoError && <FieldError>{photoError}</FieldError>}
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
          <Button type="submit" disabled={saving || disabled}>
            {saving ? submittingLabel : submitLabel}
          </Button>
        </div>
      </FieldGroup>
    </form>
  )
}

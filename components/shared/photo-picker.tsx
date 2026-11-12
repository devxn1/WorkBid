"use client"

import { useEffect, useRef, useState } from "react"
import { uploadData } from "aws-amplify/storage"
import { ImagePlus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel, FieldError } from "@/components/ui/field"
import { ProjectImage } from "@/components/shared/project-image"

const MAX_PHOTOS = 5
const MAX_PHOTO_BYTES = 5 * 1024 * 1024
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"]

/** A photo in a form: one already saved (S3 path) or a new file waiting to upload. */
export type Photo = { key: string; path: string } | { key: string; file: File; preview: string }

/** S3 folders users can upload into (see amplify/storage/resource.ts). */
type PhotoFolder = "project-images" | "portfolio-images"

/** Turns saved S3 paths into photos for the picker. */
export function savedPhotos(paths: string[]): Photo[] {
  return paths.map((path) => ({ key: path, path }))
}

/**
 * Uploads the new photos (in order) into the signed-in user's own folder and returns
 * every photo's S3 path, keeping the ones already saved.
 */
export async function uploadPhotos(photos: Photo[], folder: PhotoFolder) {
  const paths: string[] = []
  for (const photo of photos) {
    if ("path" in photo) {
      paths.push(photo.path)
      continue
    }
    const ext = photo.file.type.split("/")[1] ?? "jpg"
    const { path } = await uploadData({
      path: ({ identityId }) => `${folder}/${identityId}/${crypto.randomUUID()}.${ext}`,
      data: photo.file,
      options: { contentType: photo.file.type },
    }).result
    paths.push(path)
  }
  return paths
}

interface PhotoPickerProps {
  photos: Photo[]
  onChange: (photos: Photo[]) => void
  label?: string
  description?: string
}

/** Grid of photo thumbnails with add and remove buttons (up to 5 photos, 5 MB each). */
export function PhotoPicker({
  photos,
  onChange,
  label = "Photos",
  description = `Optional. Up to ${MAX_PHOTOS} JPG, PNG or WebP photos, 5 MB each. The first photo is the cover.`,
}: PhotoPickerProps) {
  const [error, setError] = useState("")
  const fileInput = useRef<HTMLInputElement>(null)

  // Free the in-browser previews when the picker goes away.
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
    setError("")
    const added: Photo[] = []
    for (const file of Array.from(files)) {
      if (photos.length + added.length >= MAX_PHOTOS) {
        setError(`You can add up to ${MAX_PHOTOS} photos.`)
        break
      }
      if (!PHOTO_TYPES.includes(file.type)) {
        setError(`${file.name} isn't a JPG, PNG or WebP image.`)
        continue
      }
      if (file.size > MAX_PHOTO_BYTES) {
        setError(`${file.name} is larger than 5 MB.`)
        continue
      }
      added.push({ key: crypto.randomUUID(), file, preview: URL.createObjectURL(file) })
    }
    onChange([...photos, ...added])
  }

  function removePhoto(key: string) {
    const photo = photos.find((p) => p.key === key)
    if (photo && "preview" in photo) URL.revokeObjectURL(photo.preview)
    onChange(photos.filter((p) => p.key !== key))
  }

  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel>{label}</FieldLabel>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        {photos.map((photo, i) => (
          <div key={photo.key} className="relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
            <ProjectImage
              src={"path" in photo ? photo.path : photo.preview}
              alt={`Photo ${i + 1}`}
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
      <FieldDescription>{description}</FieldDescription>
      {error && <FieldError>{error}</FieldError>}
    </Field>
  )
}

"use client"

import { useState } from "react"
import { Star } from "lucide-react"
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
import { Field, FieldLabel } from "@/components/ui/field"
import { useMarketplace } from "@/lib/store"
import { cn } from "@/lib/utils"
import type { Project } from "@/lib/types"

interface ReviewDialogProps {
  project: Project
  trigger: React.ReactElement
}

export function ReviewDialog({ project, trigger }: ReviewDialogProps) {
  const { addReview, getContractor } = useMarketplace()
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [text, setText] = useState("")

  const contractor = project.awardedContractorId ? getContractor(project.awardedContractorId) : undefined
  const valid = rating > 0 && text.trim().length >= 10

  function handleSubmit() {
    if (!valid) return
    addReview(project.projectId, rating, text.trim())
    setOpen(false)
    setRating(0)
    setText("")
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Review {contractor?.businessName ?? "contractor"}</DialogTitle>
          <DialogDescription>Share your experience on “{project.title}”.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel>Your rating</FieldLabel>
            <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHover(star)}
                  aria-label={`${star} star${star > 1 ? "s" : ""}`}
                  className="p-0.5"
                >
                  <Star
                    width={28}
                    height={28}
                    className={cn(
                      "transition-colors",
                      (hover || rating) >= star ? "fill-warning text-warning" : "text-muted-foreground/40",
                    )}
                  />
                </button>
              ))}
            </div>
          </Field>

          <Field>
            <FieldLabel htmlFor="review-text">Your review</FieldLabel>
            <Textarea
              id="review-text"
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="How was the quality of work, communication, and timeliness?"
            />
          </Field>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button onClick={handleSubmit} disabled={!valid}>
            Submit review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

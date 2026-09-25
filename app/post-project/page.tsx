"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { useMarketplace } from "@/lib/store"
import { categories } from "@/lib/mock-data"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CategoryIcon } from "@/components/shared/category-icon"

const categoryImages: Record<string, string> = {
  cat_remodeling: "/images/projects/kitchen.png",
  cat_plumbing: "/images/projects/bathroom.png",
  cat_electrical: "/images/projects/electrical.png",
  cat_painting: "/images/projects/painting.png",
  cat_carpentry: "/images/projects/deck.png",
  cat_roofing: "/images/projects/roof.png",
  cat_landscaping: "/images/projects/fence.png",
  cat_flooring: "/images/projects/flooring.png",
}

export default function PostProjectPage() {
  const { addProject, setRole } = useMarketplace()
  const router = useRouter()

  const [title, setTitle] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [location, setLocation] = useState("")
  const [description, setDescription] = useState("")
  const [budgetMin, setBudgetMin] = useState("")
  const [budgetMax, setBudgetMax] = useState("")
  const [submitted, setSubmitted] = useState(false)

  const min = Number(budgetMin)
  const max = Number(budgetMax)
  const budgetValid = min > 0 && max > 0 && max >= min

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (!title || !categoryId || !location || description.length < 20 || !budgetValid) return

    const project = addProject({
      title,
      description,
      categoryId,
      location,
      budgetMin: min,
      budgetMax: max,
      images: [categoryImages[categoryId] ?? "/images/projects/painting.png"],
    })
    setRole("client")
    router.push(`/projects/${project.projectId}`)
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <Button variant="ghost" size="sm" render={<Link href="/dashboard/client" />} className="mb-4 -ml-2">
        <ArrowLeft data-icon="inline-start" />
        Back to dashboard
      </Button>

      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground text-balance">
          Post a new project
        </h1>
        <p className="text-muted-foreground">
          Describe your job and set a budget. Verified contractors will send you competitive bids.
        </p>
      </header>

      <Card className="mt-6">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field data-invalid={submitted && !title ? true : undefined}>
                <FieldLabel htmlFor="title">Project title</FieldLabel>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Kitchen remodel with new cabinets"
                  aria-invalid={submitted && !title ? true : undefined}
                />
                {submitted && !title && <FieldError>Please add a title.</FieldError>}
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

                <Field data-invalid={submitted && !location ? true : undefined}>
                  <FieldLabel htmlFor="location">Location</FieldLabel>
                  <Input
                    id="location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Austin, TX"
                    aria-invalid={submitted && !location ? true : undefined}
                  />
                  {submitted && !location && <FieldError>Add a location.</FieldError>}
                </Field>
              </div>

              <Field data-invalid={submitted && description.length < 20 ? true : undefined}>
                <FieldLabel htmlFor="description">Description</FieldLabel>
                <Textarea
                  id="description"
                  rows={6}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the scope of work, materials, current condition, and any specific requirements."
                  aria-invalid={submitted && description.length < 20 ? true : undefined}
                />
                <FieldDescription>Be specific to get accurate bids. At least 20 characters.</FieldDescription>
                {submitted && description.length < 20 && (
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

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" render={<Link href="/dashboard/client" />}>
                  Cancel
                </Button>
                <Button type="submit">Post project</Button>
              </div>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

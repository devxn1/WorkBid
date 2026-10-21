"use client"

import { use, useEffect } from "react"
import Link from "next/link"
import { notFound, useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { useMarketplace } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  ProjectForm,
  isStockImage,
  stockImageFor,
  type ProjectFormValues,
} from "@/components/projects/project-form"

export default function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { authUser, authLoading, getProject, projectsLoading, updateProjectDetails } = useMarketplace()

  const project = getProject(id)
  const canEdit = !!project && !!authUser && project.clientId === authUser.userId && project.status === "open"

  // Only the owner can edit, and only while the project is still open for bids.
  useEffect(() => {
    if (authLoading || projectsLoading) return
    if (!authUser) router.replace("/login")
    else if (project && !canEdit) router.replace(`/projects/${id}`)
  }, [authLoading, projectsLoading, authUser, project, canEdit, id, router])

  if (!project) {
    if (projectsLoading) {
      return (
        <div className="mx-auto flex min-h-[50vh] max-w-2xl items-center justify-center px-4">
          <p className="text-sm text-muted-foreground">Loading project…</p>
        </div>
      )
    }
    return notFound()
  }

  if (!canEdit) return null

  async function handleSave(values: ProjectFormValues) {
    // A project still using its category's stock photo gets the new category's photo.
    const usesStockPhoto = project!.images.every(isStockImage)
    await updateProjectDetails(id, {
      ...values,
      ...(usesStockPhoto && { images: [stockImageFor(values.categoryId)] }),
    })
    router.push(`/projects/${id}`)
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <Button variant="ghost" size="sm" render={<Link href={`/projects/${id}`} />} className="mb-4 -ml-2">
        <ArrowLeft data-icon="inline-start" />
        Back to project
      </Button>

      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground text-balance">
          Edit project
        </h1>
        <p className="text-muted-foreground">
          You can change these details until you accept a bid. Contractors who already bid will see the updated
          project.
        </p>
      </header>

      <Card className="mt-6">
        <CardContent className="p-6">
          <ProjectForm
            initialValues={{
              title: project.title,
              categoryId: project.categoryId,
              location: project.location,
              description: project.description,
              budgetMin: project.budgetMin,
              budgetMax: project.budgetMax,
            }}
            submitLabel="Save changes"
            submittingLabel="Saving…"
            cancelHref={`/projects/${id}`}
            onSubmit={handleSave}
          />
        </CardContent>
      </Card>
    </div>
  )
}

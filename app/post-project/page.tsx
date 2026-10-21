"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { useMarketplace } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ProjectForm, stockImageFor, type ProjectFormValues } from "@/components/projects/project-form"

export default function PostProjectPage() {
  const { addProject, authUser, authLoading } = useMarketplace()
  const router = useRouter()

  // Only signed-in clients can post.
  useEffect(() => {
    if (!authLoading && !authUser) router.replace("/login")
  }, [authLoading, authUser, router])

  async function handlePost(values: ProjectFormValues) {
    // No photos uploaded: use the category's stock photo so the project card isn't empty.
    const images = values.images.length ? values.images : [stockImageFor(values.categoryId)]
    const project = await addProject({ ...values, images })
    router.push(`/projects/${project.projectId}`)
  }

  if (authUser?.userType === "contractor") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <h1 className="font-heading text-2xl font-bold text-foreground">Only clients can post projects</h1>
        <p className="mt-2 text-muted-foreground">
          You&apos;re signed in as a contractor. Browse open projects to find work instead.
        </p>
        <Button className="mt-6" render={<Link href="/projects" />}>
          Find work
        </Button>
      </div>
    )
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
          <ProjectForm
            submitLabel="Post project"
            submittingLabel="Posting…"
            cancelHref="/dashboard/client"
            disabled={!authUser}
            onSubmit={handlePost}
          />
        </CardContent>
      </Card>
    </div>
  )
}

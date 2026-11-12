"use client"

import { use, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Lock } from "lucide-react"
import { useMarketplace } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ProjectForm, stockImageFor, type ProjectFormValues } from "@/components/projects/project-form"

export default function PostProjectPage({ searchParams }: { searchParams: Promise<{ for?: string }> }) {
  // `for` = a contractor id: this is a private quote request for just them.
  const { for: forContractorId } = use(searchParams)
  const { addProject, authUser, authLoading, getContractor, requestContractor, contractorStatus } = useMarketplace()
  const router = useRouter()
  const invited = forContractorId ? getContractor(forContractorId) : undefined

  useEffect(() => {
    if (forContractorId) requestContractor(forContractorId)
  }, [forContractorId, requestContractor])

  // Only signed-in clients can post.
  useEffect(() => {
    if (!authLoading && !authUser) router.replace("/login")
  }, [authLoading, authUser, router])

  async function handlePost(values: ProjectFormValues) {
    // No photos uploaded: use the category's stock photo so the project card isn't empty.
    const images = values.images.length ? values.images : [stockImageFor(values.categoryId)]
    const project = await addProject({ ...values, images, invitedContractorId: invited?.contractorId })
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

  // Don't fall back to posting a public project if the contractor in the link isn't found.
  if (forContractorId && !invited) {
    if (contractorStatus(forContractorId) === "loading") {
      return <p className="py-24 text-center text-sm text-muted-foreground">Loading…</p>
    }
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <h1 className="font-heading text-2xl font-bold text-foreground">Contractor not found</h1>
        <p className="mt-2 text-muted-foreground">This quote request link doesn&apos;t point to a contractor.</p>
        <Button className="mt-6" render={<Link href="/contractors" />}>
          Find contractors
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
          {invited ? `Request a quote from ${invited.businessName}` : "Post a new project"}
        </h1>
        <p className="text-muted-foreground">
          {invited
            ? "Describe your job and set a budget. They'll get a notification and can send you a bid."
            : "Describe your job and set a budget. Verified contractors will send you competitive bids."}
        </p>
      </header>

      {invited && (
        <div className="mt-6 flex gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
          <Lock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <p className="text-foreground">
            This is a private request. It won&apos;t be listed in Browse projects, and only {invited.businessName} can
            bid on it.
          </p>
        </div>
      )}

      <Card className="mt-6">
        <CardContent className="p-6">
          <ProjectForm
            submitLabel={invited ? "Send request" : "Post project"}
            submittingLabel={invited ? "Sending…" : "Posting…"}
            cancelHref="/dashboard/client"
            disabled={!authUser}
            onSubmit={handlePost}
          />
        </CardContent>
      </Card>
    </div>
  )
}
